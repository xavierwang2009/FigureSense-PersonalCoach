// Run: node tests/feature-update.cjs
const assert = require('node:assert/strict'), fs = require('node:fs'), vm = require('node:vm'), path = require('node:path');
const read = n => fs.readFileSync(path.join(__dirname, '..', n), 'utf8');
const harness = { require, __dirname, console, setTimeout() {} };
vm.createContext(harness);
vm.runInContext(read('tests/point-controls.cjs').split('const {state, nearestPoint')[0] + '\nglobalThis.app=sandbox;', harness);
const app = harness.app;
let resolveSeek, captures = 0;
app.seekTo = () => new Promise(resolve => { resolveSeek = resolve; });
app.countCapture = () => captures++;
vm.runInContext('player.duration=12; renderResults=()=>{}; captureFrame=async()=>countCapture();', app);
(async () => {
  const pending = vm.runInContext('shiftFrame(1)', app);
  vm.runInContext("state.current='other'", app);
  resolveSeek(); await pending;
  assert.equal(captures, 0, 'a switched checkpoint cannot receive an earlier seek');
  vm.runInContext("state.current='first'", app);
  const valid = vm.runInContext('shiftFrame(1)', app);
  await vm.runInContext('shiftFrame(1)', app);
  resolveSeek(); await valid;
  assert.equal(captures, 1, 'overlapping fine-tune clicks are ignored');
  const reset = vm.runInContext('shiftFrame(1)', app);
  vm.runInContext('resetReview()', app);
  resolveSeek(); await reset;
  assert.equal(captures, 1, 'reset review rejects an old seek');

  const h = {}; vm.createContext(h); vm.runInContext(read('history.js').replace(/export /g, ''), h);
  const old = { id:'old', date:'2026-10-20', swimmer:'Xavier', figure:'301', scoringVersion:2, scores:{pike:8} };
  const current = { ...old, id:'new', date:'2026-10-22', dd:1.8 };
  assert.equal(h.previousFor([old], current), null, 'DD changes must not appear as swimmer progress');
  assert.equal(h.previousFor([{...old,dd:1.8}], current).id, 'old');
  assert.equal(h.previousFor([{...old,figure:'101'}], {...current,figure:'101',dd:1.6}).id, 'old');

  const node = { textContent:'12.80', dataset:{} }, queue = new Map(); let next = 0;
  const box = { $:()=>({querySelector:s=>s==='.big'?node:null,dataset:{complete:'false'}}), reducedMotion:{matches:false}, performance:{now:()=>0},
    requestAnimationFrame:fn=>{queue.set(++next,fn);return next;}, cancelAnimationFrame:id=>queue.delete(id), document:{querySelectorAll:()=>[]} };
  vm.createContext(box);
  const code = read('nav.js').split('function animateResults() {')[1].split('// The tab highlight')[0];
  vm.runInContext('function animateResults() {' + code, box);
  vm.runInContext('animateResults()',box); const tick = queue.get(next); queue.delete(next); tick(100);
  assert.notEqual(node.textContent,'12.80');
  vm.runInContext('animateResults()',box); assert.equal(queue.size,1,'re-entry cancels the previous counter');
  queue.get(next)(1200); assert.equal(node.textContent,'12.80','re-entry restores the actual score');
  console.log('PASS: stale frame shifts, overlapping shifts, DD-aware comparisons, stable result counters');
})().catch(err=>{console.error(err);process.exitCode=1;});
