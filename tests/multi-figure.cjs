// Run: node tests/multi-figure.cjs
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const read=n=>fs.readFileSync(path.join(__dirname,'..',n),'utf8');
function load(n,names,extras={}) {const b={...extras};vm.createContext(b);vm.runInContext(read(n).replace(/^import .*;$/gm,'').replace(/export /g,'')+`\nglobalThis.api={${names}};`,b);return b.api;}
const f=load('figures.js','FIGURES');
const g=load('geometry.js','evaluateMetric,evaluateTest,targetText,scoreFigure');
const a=load('figure-assist.js','pickBarracudaSequence,pickKipSequence,shapeOf');
const p=(x,y)=>({x,y,vis:1});
const leg=(h,k,t)=>({hip:p(...h),knee:p(...k),ankle:p(...t)});
const flat=leg([0,200],[50,200],[100,200]);
const low=leg([0,300],[0,250],[0,200]);
const top=leg([0,100],[0,50],[0,0]);
const down=leg([0,200],[0,150],[0,100]);
const tuck=leg([40,200],[0,200],[0,150]);
const samples=legs=>legs.map((right,time)=>({time,pose:{right}}));
assert.equal(a.shapeOf(undefined),null);
assert.deepEqual(JSON.parse(JSON.stringify(a.pickBarracudaSequence(samples([flat,low,top,down,low])).times)),{bl:0,pike:1,vertical:2,descent:3});
assert.deepEqual(JSON.parse(JSON.stringify(a.pickKipSequence(samples([flat,tuck,top,down,low])).times)),{bl:0,tuck:1,vertical:2,descent:3});
assert.equal(a.pickKipSequence(samples([flat,tuck])).times.vertical,null);
const metric=f.FIGURES[2].checkpoints[1].metrics.find(m=>m.atMost);
for(const [angle,expected] of [[60,0],[90,0],[120,30]]) {
 const rad=angle*Math.PI/180;
 const pts={waterA:p(0,200),waterB:p(200,200),hip:p(100,0),knee:p(0,0),ankle:p(100*Math.cos(rad),100*Math.sin(rad))};
 assert(Math.abs(g.evaluateMetric(metric,pts).deviation-expected)<1e-6);
}
assert.equal(g.targetText(metric),'≤ 90°');
for(const figure of f.FIGURES) assert.equal(figure.checkpoints.reduce((s,c)=>s+c.weight,0),figure.totalWeight);

const harness={require,__dirname,console,setTimeout(){}};vm.createContext(harness);
vm.runInContext(read('tests/point-controls.cjs').split('const {state, nearestPoint')[0]+'\nglobalThis.app=sandbox;globalThis.el=element;',harness);
const app=harness.app,el=harness.el;
let resolvePose,resolveScan;
Object.assign(app,{detectPose:()=>new Promise(r=>resolvePose=r),scanVideo:()=>new Promise(r=>resolveScan=r),seekTo:async()=>{},pickSequence:()=>{throw Error('stale scan used');},console:{error(){}}});
vm.runInContext('renderResults=()=>{}; renderFigure=()=>{};',app);
(async()=>{
 const pending=vm.runInContext('suggestPoints()',app);
 vm.runInContext('resetReview()',app);
 resolvePose({});await pending;
 assert.equal(app.controls.state.side,null);
 const scan=el('findMoments').handlers.click();
 vm.runInContext('resetReview()',app);
 resolveScan([]);await scan;
 assert.equal(app.controls.state.picks,null);
 assert.equal(el('findMoments').disabled,false);
 app.FIGURES=f.FIGURES;
 let remembered;
 app.localStorage={setItem(key,value){remembered=value;}};
 app.controls.state.drafts.first={frame:{}};
 el('figSwitch').dataset={};
 el('figPick').handlers.change({target:{value:'301'}});
 assert.equal(el('figSwitch').hidden,false,'unfinished review requires confirmation');
 assert(app.controls.state.drafts.first,'review survives until confirmation');
 el('figSwitch').handlers.click({target:el('figSwitch')});
 assert.equal(remembered,'301');
 assert.equal(app.controls.state.current,'bl');
 assert.equal(Object.keys(app.controls.state.drafts).length,0);
 console.log('PASS: figure switch confirmation and remembered choice');
 console.log('PASS: four-moment sequences, missing poses, tighter tuck target, weight totals, stale scan/pose rejection and scan cleanup');
})().catch(e=>{console.error(e);process.exitCode=1;});
