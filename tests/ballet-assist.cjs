// Run: node tests/ballet-assist.cjs
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const box = {MIN_VISIBILITY: 0.65};
vm.createContext(box);
vm.runInContext(fs.readFileSync(path.join(__dirname, '../ballet-assist.js'), 'utf8')
  .replace(/^import .*;$/gm, '').replace(/export /g, ''), box);
const p = (x,y) => ({x,y,vis:1});
const leg = (knee,ankle) => ({hip:p(0,100), knee, ankle});
const flat = leg(p(50,100),p(100,100));
const raised = leg(p(0,50),p(0,0));
const bent = leg(p(0,50),p(40,100));
const tilted = leg(p(15,50),p(40,100));
const reflection = leg(p(0,150),p(0,200));
const submergedFoot = leg(p(0,50),p(40,200));
const highFoot = leg(p(0,50),p(40,20));
const sample = (time,right) => ({time,pose:{left:flat,right}});
const pick = legs => box.pickBalletSequence(legs.map((l,i)=>sample(i,l)));
const result = pick([flat,tilted,bent,raised,bent,reflection,flat]);
assert.equal(result.side,'right');
assert.deepEqual(JSON.parse(JSON.stringify(result.times)),{bl1:0,bk1:2,ballet:3,bk2:4,bl2:6});
assert.equal(pick([flat,bent,raised,bent,reflection]).times.bl2,null, 'downward reflection is not a finish');
for(const invalid of [submergedFoot,highFoot]) {
  const r = pick([flat,invalid,raised,invalid,flat]);
  assert.equal(r.times.bk1,null,'no near-level foot means no entry suggestion');
  assert.equal(r.times.bk2,null,'no near-level foot means no lowering suggestion');
}
assert.equal(pick([flat,flat]).times.ballet,null);
assert.equal(box.pickBalletSequence([]).side,null);
console.log('PASS: right working leg, ordered checkpoints, vertical-thigh choice, reflection rejection, near-level foot requirement, missing moments');

// Exercise the app's suggestion handler with extra detected points.
const harness = {require, __dirname, console, setTimeout() {}};
vm.createContext(harness);
const setup = fs.readFileSync(path.join(__dirname, 'point-controls.cjs'), 'utf8')
  .split('const {state, nearestPoint')[0];
vm.runInContext(setup + '\nglobalThis.app = sandbox; globalThis.el = element;', harness);
Object.assign(harness.app, {
  detectPose: async () => ({}),
  pointsFromPose: () => ({side:'right', points:{hip:p(10,10), knee:p(20,20), ankle:p(30,30)}}),
  pointsNeeded: () => ['hip'],
  pointsUsed: () => ['hip'],   // Stage 1: suggestions also fill optional points
});
vm.runInContext('suggestPoints()', harness.app).then(() => {
  assert.match(harness.el('markStatus').textContent, /^Suggested 1 body points/);
  assert.equal(harness.app.controls.state.drafts.first.points.knee,undefined);
  console.log('PASS: only checkpoint-required body points are applied and counted');
}).catch(error => { console.error(error); process.exitCode = 1; });
