// Run: node tests/keep-results.cjs
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { webcrypto } = require('node:crypto');
const read = file => fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
let stored = null, blocked = false;
const storage = {
  getItem() { return stored; },
  setItem(key, value) { if (blocked) throw Error('blocked'); stored = value; },
};
function history() {
  const box = { localStorage: storage, crypto: webcrypto };
  vm.createContext(box);
  vm.runInContext(read('history.js').replace(/export /g, ''), box);
  return box;
}
const h = history();
const result = {figureScore: 12, provisional: true, issues: [], results: [
  {checkpoint: {id: 'a'}, saved: true, score: 8}, {checkpoint: {id: 'b'}, saved: false},
]};
const first = h.makeReview({number: 101}, result, ' Xavier ');
first.date = '2026-10-01T00:00:00.000Z';
assert(h.saveReview(first));
assert.equal(history().loadHistory()[0].swimmer, 'Xavier', 'fresh module restores saved review');
assert(!stored.includes('frame'), 'history does not store frames');
assert(h.saveReview({...first, figureScore: 13}));
assert.equal(h.loadHistory().length, 1, 'update does not duplicate review');
const next = {...first, id: 'next', date: '2026-10-08T00:00:00.000Z'};
assert.equal(h.previousFor(h.loadHistory(), next).id, first.id);
assert.equal(h.previousFor(h.loadHistory(), {...next, swimmer: 'Other'}), null);
assert.equal(h.previousFor([{...first, scoringVersion: 1}], next), null,
  'do not compare scores from before measured coach checks were introduced');
assert.equal(h.previousFor(h.loadHistory(), {...next, scores: {a: 8, b: 9}}), null,
  'different checkpoint coverage must not show a progress delta');
assert.notEqual(h.makeReview({number: 101}, result, '').id, h.makeReview({number: 101}, result, '').id);
blocked = true;
assert.equal(h.saveReview(next), false);
assert.equal(h.deleteReview(first.id), false);
assert.equal(h.clearHistory(), false);
assert.equal(h.loadHistory().length, 1);
blocked = false;
assert(h.deleteReview(first.id));
assert.equal(h.loadHistory().length, 0);

// Capture drawing calls to verify full-frame scaling and text layout.
const canvases = [];
const document = {createElement() {
  const c = {width: 0, height: 0, text: [], images: []};
  const ctx = {font: '', fillRect() {}, beginPath() {}, moveTo() {}, lineTo() {}, stroke() {},
    measureText(text) { return {width: text.length * (parseInt(this.font.match(/(\d+)px/)[1]) * 0.55)}; },
    fillText(text, x, y) { c.text.push({text, x, y}); },
    drawImage(...args) { c.images.push(args); },
  };
  c.getContext = () => ctx;
  canvases.push(c);
  return c;
}};
const report = {document};
vm.createContext(report);
vm.runInContext(read('report.js').replace(/export /g, ''), report);
const rows = Array.from({length: 5}, (_, i) => ({checkpoint: {id: String(i), label: 'Checkpoint '+i, weight: 1},
  saved: true, score: 9, rows: [], missed: [{text: 'Coach check needs attention'}]}));
const out = {figureScore: 14.4, provisional: false, results: rows,
  issues: Array.from({length: 3}, () => ({title: 'Body position', checkpoint: {label: 'Ballet leg'}, detail: 'Practice this adjustment carefully. '.repeat(14)}))};
const image = report.drawReport({name: 'Ballet Leg', dd: 1.6}, out, 'Xavier', () => ({width: 300, height: 600}));
assert.equal(image.images.length, 5);
for (const args of image.images) {
  assert.equal(args.length, 5, 'draw whole source, not a cropped source rectangle');
  assert.equal(args[3] / args[4], 0.5, 'preserve portrait aspect ratio');
  assert(args[4] <= 170);
}
assert(image.text.some(t => t.text.includes('Coach check needs attention')));
const footer = image.text.at(-1);
assert(image.text.slice(0,-1).every(t => t.y < footer.y), 'long feedback must fit above footer');
assert(footer.y < image.height);
console.log('PASS: persistence, updates, comparison coverage, storage failures, deletion, report frames and long feedback');

// Reuse the point-control DOM stub to exercise the real app button handlers.
const setup = read('tests/point-controls.cjs').split('const {state, nearestPoint')[0];
const harness = {require, __dirname, console, setTimeout() {}};
vm.createContext(harness);
vm.runInContext(setup + '\nglobalThis.appSandbox = sandbox; globalThis.el = element;', harness);
const app = harness.appSandbox, el = harness.el;
Object.assign(app, {
  loadHistory: h.loadHistory, makeReview: h.makeReview, saveReview: h.saveReview,
  deleteReview: h.deleteReview, clearHistory: h.clearHistory, previousFor: h.previousFor,
  scoreFigure: () => result,
  URL: {createObjectURL: () => 'blob:test', revokeObjectURL() {}},
});
vm.runInContext('renderResults = () => {};', app);
el('swimmerName').value = 'Test swimmer';
el('saveProgress').handlers.click();
const original = h.loadHistory()[0];
el('saveProgress').handlers.click();
assert.equal(h.loadHistory().length, 1);
assert.equal(h.loadHistory()[0].date, original.date, 'updates preserve original review date');
blocked = true;
el('clearProgress').handlers.click();
el('clearProgress').handlers.click();
assert(el('clearNote').textContent.includes('Could not clear'));
assert.equal(h.loadHistory().length, 1);
blocked = false;
el('fileInput').handlers.change({target: {files: [{type: 'video/mp4', size: 100}]}});
el('saveProgress').handlers.click();
assert.equal(h.loadHistory().length, 2, 'new video saves a new review instead of replacing the old one');
assert.equal(Object.keys(app.controls.state.saved).length, 0, 'new video clears old checkpoints');
console.log('PASS: app save/update, failed clear message, new-video review separation');
