// Run: node tests/results-review.cjs
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const read = name => fs.readFileSync(path.join(__dirname, '..', name), 'utf8');
function moduleBox(name, exports) {
  const box = {};
  vm.createContext(box);
  vm.runInContext(read(name).replace(/export /g, '') + `\nglobalThis.api={${exports}};`, box);
  return box.api;
}
const g = moduleBox('geometry.js', 'evaluateTest,evaluateCheck,scoreFigure,waterFrame,targetText');
const f = moduleBox('figures.js', 'BALLET_LEG,DRILLS,videoLink,linkText');
const drawings = moduleBox('poses.js', 'targetLine,deviationGauge');
const point = (x,y) => ({x,y});
const pts = {waterA:point(0,100),waterB:point(100,100),shoulder:point(0,90),hip:point(100,90),knee:point(100,40),ankle:point(100,-10),ankleB:point(200,90)};
const check = {tests:[{kind:'joint',pts:['hip','knee','ankle'],min:165,unit:'°'}]};
assert.equal(g.evaluateCheck(check,false,pts,{},{}).pass,true);
const incomplete = {...pts}; delete incomplete.ankle;
assert.equal(g.evaluateCheck(check,true,incomplete,{},{}).measured,false);
assert.equal(g.evaluateCheck(check,true,incomplete,{},{}).pass,true);
assert(g.evaluateTest({kind:'segmentShift',pts:['hip','knee'],ref:'a'}, {...pts,knee:pts.hip},{a:{points:pts}}).error);
const earlier = {...pts}; delete earlier.knee; delete earlier.ankle;
assert.equal(g.evaluateTest({kind:'heightShift',pts:['shoulder'],ref:'a'},pts,{a:{points:earlier}}).value,0,
  'same height must not change merely because one frame lacks a shin');
const frame = g.waterFrame(pts.waterA,pts.waterB);
const line = drawings.targetLine({kind:'joint',pts:['hip','knee','ankle'],ideal:180},pts,frame);
assert(Math.abs(line.to.x-100)<1e-8); assert(Math.abs(line.to.y+10)<1e-8);
assert(drawings.deviationGauge(60,[15,30]).includes('x1="90.0"'));

const setup = read('tests/point-controls.cjs').split('const {state, nearestPoint')[0];
const harness = {require,__dirname,console,setTimeout(){}};
vm.createContext(harness);
vm.runInContext(setup+'\nglobalThis.app=sandbox;',harness);
const app = harness.app;
Object.assign(app,{waterFrame:g.waterFrame,targetLine:drawings.targetLine,deviationGauge:drawings.deviationGauge,
  DRILLS:f.DRILLS,videoLink:f.videoLink,linkText:f.linkText,targetText:g.targetText,getComputedStyle:()=>({getPropertyValue:()=>''})});
vm.runInContext('FIG.drillsFor = {}; globalThis.review={paint,summaryHtml,planHtml,resultHtml};', app);
app.FIG.drillsFor = f.BALLET_LEG.drillsFor;
const issue = {title:'Knee extension',checkpoint:{label:'Ballet Leg'},drillKey:'knee',kind:'measured',cost:1};
const result = {saved:true,checkpoint:{id:'ballet',label:'Ballet Leg',weight:11},time:1,score:9,
  rows:[{metric:{label:'Knee',ideal:180,tol:[15,30]},value:160,deviation:20,deduction:{value:0.5,band:'medium',label:'Medium'}}],
  checkResults:[{check:{text:'Check'},measured:true,pass:true,parts:[]},{check:{text:'Other'},measured:false,pass:false}]};
const out={results:[result],issues:[issue,issue]};
const plan=app.review.planHtml(out);
assert.equal(plan.split('Thigh-still extensions').length-1,1,'drills deduplicated');
assert(plan.includes('In the pool') && plan.includes('On land') && plan.includes('Helps with: Knee extension'));
assert(app.review.summaryHtml(out).includes('1 met by measurement, 0 met by eye'));
assert(app.review.resultHtml(result).includes('class="gauge"'),'saved rows include gauges');
let targets=0;
app.targetLine=(...args)=>{targets++;return drawings.targetLine(...args);};
const ctx={canvas:{width:30,height:30},drawImage(){},beginPath(){},setLineDash(){},moveTo(){},lineTo(){},stroke(){},arc(){},fill(){}};
app.review.paint(ctx,{},pts,0.1,{targets:[{kind:'toWater',pts:['shoulder','hip'],ideal:0}]});
assert.equal(targets,1,'thumbnail waterline below 20 display pixels still draws target');
console.log('PASS: measured/manual checks, degenerate segments, shared height scale, target geometry, gauges, summary counts, deduplicated plan, small thumbnails');
