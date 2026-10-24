// Tests the measurement engine the current app loads (src/geometry.js).
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const load=name=>import('data:text/javascript;base64,'+Buffer.from(fs.readFileSync(path.join(__dirname,'..','src',name))).toString('base64'));
const near=(a,b,eps=1e-6)=>assert.ok(Math.abs(a-b)<eps,`${a} != ${b}`);
(async()=>{
 const g=await load('geometry.js');
 // Image y grows downward, so "up" out of the water is negative y.
 const level=g.waterFrame([0,300],[600,300]);
 const sameFrame=(f,u,n)=>{f.u.forEach((v,i)=>near(v,u[i]));f.n.forEach((v,i)=>near(v,n[i]));};
 sameFrame(level,[1,0],[0,-1]);
 // Point order does not change the frame.
 sameFrame(g.waterFrame([600,300],[0,300]),[1,0],[0,-1]);
 assert.throws(()=>g.waterFrame([0,0],[10,0]),/too close/);
 near(g.segmentToVertical([100,300],[100,100],level),0);
 near(g.segmentToVertical([100,300],[300,100],level),45);
 near(g.segmentToWater([0,300],[200,300],level),0);
 near(g.elevation([0,300],[100,200],level),45);
 near(g.elevation([0,300],[100,400],level),-45);
 near(g.jointAngle([0,0],[100,0],[200,0]),180);
 near(g.jointAngle([0,0],[100,0],[100,100]),90);
 assert.throws(()=>g.jointAngle([0,0],[1,0],[2,0]),/too close/);
 // Angles are measured against the marked surface, so a tilted camera is compensated.
 const t=Math.PI/12,rot=([x,y])=>[x*Math.cos(t)-y*Math.sin(t),x*Math.sin(t)+y*Math.cos(t)];
 const tilted=g.waterFrame(rot([0,300]),rot([600,300]));
 near(g.segmentToVertical(rot([100,300]),rot([100,100]),tilted),0);
 near(g.segmentToVertical(rot([100,300]),rot([300,100]),tilted),45);
 near(g.heightAbove(rot([50,250]),rot([0,300]),tilted,50),1);
 // Knee-to-ankle is the preferred reference length; tiny segments are ignored.
 assert.equal(g.referenceScale({knee:[0,0],ankle:[0,80],hip:[0,-200]}),80);
 assert.equal(g.referenceScale({knee:[0,0],ankle:[0,5],hip:[0,-100]}),100);
 assert.equal(g.referenceScale({hip:[0,0]}),null);
 // 0.2 / 0.5 / 1.0 deduction bands, with the default clean band at 8% of the small limit.
 assert.equal(g.deductionFor(1,[15,30]).value,0);
 assert.equal(g.deductionFor(1.3,[15,30]).value,0.2);
 assert.equal(g.deductionFor(15,[15,30]).value,0.2);
 assert.equal(g.deductionFor(20,[15,30]).value,0.5);
 assert.equal(g.deductionFor(31,[15,30]).value,1);
 assert.equal(g.travelDeduction(['clean','small']).value,0.1);
 assert.equal(g.travelDeduction(['small','small']).value,0.3);
 assert.equal(g.travelDeduction(['medium','medium']).value,0.5);
 // Height charts: interpolated anchors, clamped at both ends.
 assert.equal(g.splitChart(180).score,9.5);
 assert.equal(g.splitChart(90).score,3);
 assert.equal(g.splitChart(40).score,2.5);
 for(const [angle,band] of [[175,/^Very good/],[145,/140-150/],[135,/^Satisfactory/],[125,/120-130/],[115,/^Deficient/],[105,/100-110/],[95,/^Weak/]])
  assert.match(g.splitChart(angle).band,band,String(angle));
 assert.equal(g.thighChart(0).score,8.5);
 assert.equal(g.thighChart(-1).score,10);
 // Whole-figure score: weighted mean of checkpoint scores (reference checkpoints excluded) x DD.
 const spec={id:'v',kind:'segmentToVertical',pts:['hip','knee'],ideal:0,tol:[15,30],unit:'°'};
 const figure={dd:2,checkpoints:[
  {id:'ref',weight:0,metrics:[],checks:[]},
  {id:'a',weight:1,metrics:[spec],checks:['x']},
  {id:'b',weight:3,metrics:[spec],checks:[]}
 ]};
 const cap=(knee,checks=[])=>({points:{hip:[0,300],knee},frame:level,scale:100,time:0,checks:new Set(checks)});
 const partial=g.scoreFigure(figure,{a:cap([0,100])});
 assert.equal(partial.complete,false);assert.equal(partial.practiceScore,null);near(partial.coverage,0.25);
 const full=g.scoreFigure(figure,{ref:cap([0,100]),a:cap([0,100]),b:cap([200,100])});
 assert.equal(full.complete,true);
 near(full.results[1].score,9.8); // unconfirmed coach's-eye item costs 0.2
 near(full.results[2].score,9);   // 45° from vertical is a large deviation
 near(full.practiceScore,(9.8*1+9*3)/4);
 near(full.awarded,full.practiceScore*2);
 // Unconfirmed automatic placements never produce a figure score.
 assert.equal(g.scoreFigure(figure,{a:cap([0,100]),b:{...cap([0,100]),auto:true}}).complete,false);
 console.log('PASS: surface frame, tilt compensation, joint angles, reference length, deduction bands, height charts, figure scoring.');
})().catch(error=>{console.error(error);process.exitCode=1;});
