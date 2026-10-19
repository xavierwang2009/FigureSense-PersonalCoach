// figure-assist.js
// "Find the moments" for every figure. Ballet Leg uses ballet-assist.js;
// Barracuda and Kip (Stage 2) are found here from the same pose points.
// These are suggestions only. The swimmer checks each one before saving.
//
// How the moments are recognised (y grows downward in the picture):
//   upright legs : hip-to-ankle line within 25° of straight up, knee straight (≥ 150°)
//   Vertical     : the upright frame where the hip is highest
//   Back Pike    : before that, upright legs with the ankle at its lowest (toes just under)
//   Back Tuck    : before that, knee bent under 100° with the shin pointing up (within 35°)
//   Descent      : after the Vertical, upright legs with the ankle halfway down
//   Back Layout  : the last flat frame before the figure starts

import { pickBalletSequence } from './ballet-assist.js';

const SEEN = 0.5;   // loose, because we only need the rough shape to find moments
const deg = rad => rad * 180 / Math.PI;
const dist = (a, b) => Math.hypot(b.x - a.x, b.y - a.y);

// Angle of a→b away from straight up in the picture, 0–180°.
function fromUp(a, b) {
  const len = dist(a, b) || 1;
  return deg(Math.acos(Math.max(-1, Math.min(1, (a.y - b.y) / len))));
}

function joint(a, b, c) {
  const v1 = { x: a.x - b.x, y: a.y - b.y }, v2 = { x: c.x - b.x, y: c.y - b.y };
  const cos = (v1.x * v2.x + v1.y * v2.y) / ((Math.hypot(v1.x, v1.y) * Math.hypot(v2.x, v2.y)) || 1);
  return deg(Math.acos(Math.max(-1, Math.min(1, cos))));
}

// Measures of one leg in one frame, or null if the leg isn't clear.
export function shapeOf(leg) {
  const { hip, knee, ankle } = leg;
  if (![hip, knee, ankle].every(p => p && p.vis >= SEEN)) return null;
  const length = dist(hip, knee) + dist(knee, ankle);
  if (length < 1) return null;
  return {
    length,
    hipY: hip.y,
    ankleY: ankle.y,
    lift: (hip.y - ankle.y) / length,      // 1 = ankle straight above the hip
    kneeLift: (hip.y - knee.y) / length,
    legFromUp: fromUp(hip, ankle),
    shinFromUp: fromUp(knee, ankle),
    knee: joint(hip, knee, ankle),
  };
}

// For figures with the legs together, use the side MediaPipe sees best over the whole video.
export function clearestSide(samples) {
  const total = { left: 0, right: 0 };
  for (const s of samples) {
    if (!s.pose) continue;
    for (const side of ['left', 'right']) {
      for (const k of ['hip', 'knee', 'ankle']) total[side] += (s.pose[side][k] && s.pose[side][k].vis) || 0;
    }
  }
  if (!total.left && !total.right) return null;
  return total.left >= total.right ? 'left' : 'right';
}

const isUpright = m => m.legFromUp <= 25 && m.knee >= 150;
const isLayout = m => Math.abs(m.lift) < 0.12 && Math.abs(m.kneeLift) < 0.12 && m.knee > 150;

// Shared steps: the Vertical peak, the Descent after it, and the Back Layout before `startBefore`.
function peakOf(frames) {
  const up = frames.filter(f => isUpright(f.m));
  if (!up.length) return null;
  return up.reduce((a, b) => (b.m.hipY < a.m.hipY ? b : a));
}

function descentAfter(frames, peak) {
  const down = frames.filter(f => f.time > peak.time && f.m.legFromUp <= 30 && f.m.knee >= 150);
  if (!down.length) return null;
  const lowest = Math.max(...down.map(f => f.m.ankleY));
  if (lowest - peak.m.ankleY < 0.2 * peak.m.length) return null;   // the legs never really went down
  const half = (peak.m.ankleY + lowest) / 2;
  return down.reduce((a, b) => (Math.abs(b.m.ankleY - half) < Math.abs(a.m.ankleY - half) ? b : a));
}

function layoutBefore(frames, time) {
  const flat = frames.filter(f => f.time < time && isLayout(f.m));
  return flat.length ? flat[flat.length - 1] : null;
}

const timeOf = f => (f ? f.time : null);

export function pickBarracudaSequence(samples) {
  const side = clearestSide(samples);
  const times = { bl: null, pike: null, vertical: null, descent: null };
  if (!side) return { side, times };
  const frames = samples.map(s => ({ time: s.time, m: s.pose ? shapeOf(s.pose[side]) : null })).filter(f => f.m);
  const peak = peakOf(frames);
  if (!peak) return { side, times };
  times.vertical = peak.time;
  // Back Pike: upright legs in the 3 s before the thrust, with the ankle lowest (toes just under).
  const before = frames.filter(f => f.time < peak.time && f.time >= peak.time - 3 && f.m.legFromUp <= 30 && f.m.knee >= 150);
  const pike = before.length ? before.reduce((a, b) => (b.m.ankleY > a.m.ankleY ? b : a)) : null;
  // A real pike sits clearly lower than the peak; otherwise leave it for the swimmer.
  times.pike = pike && pike.m.ankleY - peak.m.ankleY > 0.2 * peak.m.length ? pike.time : null;
  times.descent = timeOf(descentAfter(frames, peak));
  times.bl = timeOf(layoutBefore(frames, times.pike ?? peak.time));
  return { side, times };
}

export function pickKipSequence(samples) {
  const side = clearestSide(samples);
  const times = { bl: null, tuck: null, vertical: null, descent: null };
  if (!side) return { side, times };
  const frames = samples.map(s => ({ time: s.time, m: s.pose ? shapeOf(s.pose[side]) : null })).filter(f => f.m);
  const peak = peakOf(frames);
  if (!peak) return { side, times };
  times.vertical = peak.time;
  // Back Tuck: knee clearly bent with the shin pointing up, before the Vertical.
  const tucked = frames.filter(f => f.time < peak.time && f.m.knee < 100 && f.m.shinFromUp <= 35);
  const tuck = tucked.length ? tucked.reduce((a, b) => (b.m.shinFromUp < a.m.shinFromUp ? b : a)) : null;
  times.tuck = timeOf(tuck);
  times.descent = timeOf(descentAfter(frames, peak));
  times.bl = timeOf(layoutBefore(frames, times.tuck ?? peak.time));
  return { side, times };
}

// Pick the moments for whichever figure is selected. Returns { side, times } keyed by checkpoint id.
export function pickSequence(figure, samples) {
  if (figure.finder === 'barracuda') return pickBarracudaSequence(samples);
  if (figure.finder === 'kip') return pickKipSequence(samples);
  return pickBalletSequence(samples);
}
