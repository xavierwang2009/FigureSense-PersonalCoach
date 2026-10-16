// Run: node tests/point-controls.cjs
// Checks pointer handlers without loading MediaPipe or a browser.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const elements = new Map();
function element(id) {
  if (!elements.has(id)) elements.set(id, {
    style: {}, hidden: false, width: 1000, height: 500,
    clientWidth: 500, clientHeight: 250, scrollLeft: 0, scrollTop: 0,
    handlers: {}, parentElement: { before() {} },
    addEventListener(name, fn) { this.handlers[name] = fn; },
    getBoundingClientRect() { return { left: 0, top: 0, width: 500, height: 250 }; },
    querySelectorAll() { return []; }, getContext() { return {}; },
    setPointerCapture() {},
  });
  return elements.get(id);
}
const source = fs.readFileSync(path.join(__dirname, '../app.js'), 'utf8')
  .replace(/^import .*;$/gm, '')
  .replace(/\/\/ ---------------------------------------------------------------- go[\s\S]*$/, '');
const sandbox = {
  document: {getElementById: element, createElement: () => element('created')},
  window: {innerHeight: 800, addEventListener() {}},
  LANDMARKS: {hip: {label: 'Hip'}},
  FIG: {checkpoints: [{id: 'first', checks: []}]},
  console, setTimeout,
};
vm.createContext(sandbox);
vm.runInContext(source + `
  renderMarking = () => {};
  draw = () => {};
  state.drafts.first = {frame: {}, points: {hip: {x: 200, y: 200}}};
  globalThis.controls = {state, nearestPoint, toCanvas, setZoom};
`, sandbox);
const {state, nearestPoint, toCanvas, setZoom} = sandbox.controls;
const canvas = element('markCanvas');
const point = () => state.drafts.first.points.hip;
const event = (id, x, y) => ({pointerId:id, clientX:x, clientY:y, button:0, pointerType:'touch'});
const send = (name, e) => canvas.handlers[name](e);
assert.equal(nearestPoint({x:250,y:200}, 'touch'), 'hip');
assert.equal(nearestPoint({x:250,y:200}, 'mouse'), null);
send('pointerdown', event(1,120,100)); // grab 20 screen pixels away
send('pointermove', event(1,120,100));
assert.equal(point().x,200, 'point must not jump to the finger');
send('pointerdown', event(2,100,100));
send('pointermove', event(2,300,100));
assert.equal(point().x,200, 'second finger must not move the point');
send('pointerup',event(2,300,100));
send('pointermove',event(1,130,100));
assert.equal(point().x,220, 'first finger stays active');
send('pointerup',event(1,130,100));
send('pointermove',event(1,300,100));
assert.equal(point().x,220, 'released gesture must stop');
point().x=0; point().y=0;
send('keydown',{key:'ArrowLeft',preventDefault(){}});
send('keydown',{key:'ArrowUp',preventDefault(){}});
assert.equal(point().x,0); assert.equal(point().y,0);
point().x=1000; point().y=500;
send('keydown',{key:'ArrowRight',shiftKey:true,preventDefault(){}});
send('keydown',{key:'ArrowDown',shiftKey:true,preventDefault(){}});
assert.equal(point().x,1000); assert.equal(point().y,500);
send('pointerdown',event(3,500,250));
send('pointercancel',event(3,500,250));
send('pointermove',event(3,0,0));
assert.equal(point().x,1000, 'cancelled gesture must stop');
assert.equal(toCanvas(event(1,250,125)).x,500);
console.log('PASS: touch reach, mouse reach, no jump, second-finger isolation, release, cancellation, keyboard bounds, coordinate scaling');
