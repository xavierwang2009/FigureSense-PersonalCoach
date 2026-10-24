const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const {spawnSync}=require('node:child_process');
const root=path.resolve(__dirname,'..');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
assert.equal(html,fs.readFileSync(path.join(root,'FigureSense-Hero.html'),'utf8'));
const sources=JSON.parse(html.match(/const sources = (\{.*?\});\nconst urls/s)[1]);
for(const [name,source] of Object.entries(sources)){
 assert.equal(source,fs.readFileSync(path.join(root,'src',name),'utf8'),`${name}: index.html is out of date with src/; run python3 scripts/build.py`);
 const result=spawnSync(process.execPath,['--input-type=module','--check'],{input:source,encoding:'utf8'});
 assert.equal(result.status,0,`${name}: ${result.stderr}`);
}
const load=name=>import('data:text/javascript;base64,'+Buffer.from(sources[name]).toString('base64'));
(async()=>{
 const {DEMO_HASH,DEMO_PICKS,poseCandidate,pickBalletSequence}=await load('ballet-assist.js');
 const {waterFrame,referenceScale,evaluateMetric}=await load('geometry.js');
 const {getFigure}=await load('figures.js');
 const file=fs.readFileSync(path.join(root,'demo-assets/xavier-ballet-leg-demo.mp4'));
 assert.equal(crypto.createHash('sha256').update(file).digest('hex'),DEMO_HASH);
 const cps=getFigure('f101').checkpoints;
 assert.deepEqual(DEMO_PICKS.map(p=>p.id),cps.map(c=>c.id));
 DEMO_PICKS.forEach((p,i)=>{
  if(i)assert.ok(p.time>DEMO_PICKS[i-1].time);
  for(const key of cps[i].landmarks)assert.ok(p.points[key],key);
  const probe={points:p.points,frame:waterFrame(p.points.waterA,p.points.waterB),scale:referenceScale(p.points),time:p.time};
  for(const spec of cps[i].metrics)assert.ok(Number.isFinite(evaluateMetric(spec,probe,{}).value));
 });
 const sample=(time,scores)=>({time,candidate:{scores,points:{}}});
 const seq=[sample(0,[.95,0,0,0,.95]),sample(1,[0,.9,0,.9,0]),sample(2,[0,0,.95,0,0]),sample(3,[0,.9,0,.9,0]),sample(4,[.95,0,0,0,.95])];
 assert.deepEqual(pickBalletSequence(seq).map(s=>s.time),[0,1,2,3,4]);
 assert.equal(pickBalletSequence(seq.slice(0,4)),null);
 assert.equal(pickBalletSequence(seq.map(s=>sample(s.time,[.1,.1,.1,.1,.1]))),null);
 assert.equal(pickBalletSequence(seq.map(s=>({...s,time:s.time*.05}))),null);
 assert.equal(poseCandidate(null,1280,720,[[0,300],[1280,300]]),null);
 assert.match(sources['app.js'],/querySelectorAll\('\[data-demo\]'\)/);
 assert.match(html,/downloads\/FigureSense-Demo.zip/);
 for(const m of html.matchAll(/--([\w-]+):\s*var\(--([\w-]+)\)/g))assert.notEqual(m[1],m[2],`theme token --${m[1]} refers to itself`);
 console.log('Current demo checks passed: syntax, matching entries and src/, exact clip identity, complete annotations, finite angles, ordered candidates and rejection paths.');
})().catch(error=>{console.error(error);process.exitCode=1;});
