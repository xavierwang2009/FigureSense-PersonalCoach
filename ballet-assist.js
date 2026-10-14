// ballet-assist.js
// Ballet Leg helpers built on the pose points from autoscan.js:
//  - which leg is the working (raised) leg
//  - which moments in the video look like each of the five checkpoints
//  - turning a detected pose into suggested body points
// These are suggestions only. The swimmer always checks them before saving.

import { MIN_VISIBILITY } from './autoscan.js';

const SCAN_VISIBILITY = 0.5;  // looser, because we only need the rough shape to find moments

const deg = rad => rad * 180 / Math.PI;
const dist = (a, b) => Math.hypot(b.x - a.x, b.y - a.y);
const seen = (...pts) => pts.every(p => p && p.vis >= SCAN_VISIBILITY);

// Angle of the segment a→b away from straight up in the picture, 0–180°.
function fromUp(a, b) {
  const len = dist(a, b) || 1;
  return deg(Math.acos(Math.max(-1, Math.min(1, (a.y - b.y) / len))));
}

function joint(a, b, c) {
  const v1 = { x: a.x - b.x, y: a.y - b.y }, v2 = { x: c.x - b.x, y: c.y - b.y };
  const cos = (v1.x * v2.x + v1.y * v2.y) / ((Math.hypot(v1.x, v1.y) * Math.hypot(v2.x, v2.y)) || 1);
  return deg(Math.acos(Math.max(-1, Math.min(1, cos))));
}

// Simple measures of one leg in one frame, or null if the leg isn't visible.
export function legMeasures(leg) {
  if (!seen(leg.hip, leg.knee, leg.ankle)) return null;
  const length = dist(leg.hip, leg.knee) + dist(leg.knee, leg.ankle);
  return {
    lift: (leg.hip.y - leg.ankle.y) / length,      // 1 = ankle straight above the hip, 0 = level
    kneeLift: (leg.hip.y - leg.knee.y) / length,
    legFromUp: fromUp(leg.hip, leg.ankle),         // 0 = leg points straight up
    thighFromUp: fromUp(leg.hip, leg.knee),
    knee: joint(leg.hip, leg.knee, leg.ankle),     // 180 = straight knee
  };
}

// The working leg is the one that gets lifted highest during the video.
export function workingSide(samples) {
  const best = { left: -Infinity, right: -Infinity };
  for (const s of samples) {
    if (!s.pose) continue;
    for (const side of ['left', 'right']) {
      const m = legMeasures(s.pose[side]);
      if (m) best[side] = Math.max(best[side], m.lift);
    }
  }
  if (best.left === -Infinity && best.right === -Infinity) return null;
  return best.left >= best.right ? 'left' : 'right';
}

const isLayout = m => m.lift < 0.12 && m.kneeLift < 0.12 && m.knee > 150;
const isBentKnee = m => m.knee < 130 && m.thighFromUp < 40;

// Suggest a time for each checkpoint. Returns { side, times: { bl1, bk1, ballet, bk2, bl2 } }
// with null for any moment it could not find.
export function pickBalletSequence(samples) {
  const side = workingSide(samples);
  const times = { bl1: null, bk1: null, ballet: null, bk2: null, bl2: null };
  if (!side) return { side, times };

  const frames = samples
    .map(s => ({ time: s.time, m: s.pose ? legMeasures(s.pose[side]) : null }))
    .filter(f => f.m);

  // Ballet Leg: the straight leg closest to vertical. If several frames are
  // nearly as good, take the middle one (the leg is being held there).
  const raised = frames.filter(f => f.m.knee >= 150 && f.m.legFromUp <= 45);
  if (!raised.length) return { side, times };
  const bestAngle = Math.min(...raised.map(f => f.m.legFromUp));
  const held = raised.filter(f => f.m.legFromUp <= bestAngle + 3);
  const ballet = held[Math.floor(held.length / 2)];
  times.ballet = ballet.time;

  const before = frames.filter(f => f.time < ballet.time);
  const after = frames.filter(f => f.time > ballet.time);

  // Bent Knee: thigh closest to vertical with the knee clearly bent.
  const pickBent = list => {
    const bent = list.filter(f => isBentKnee(f.m));
    if (!bent.length) return null;
    return bent.reduce((a, b) => (b.m.thighFromUp < a.m.thighFromUp ? b : a));
  };
  const bk1 = pickBent(before);
  const bk2 = pickBent(after);
  times.bk1 = bk1 ? bk1.time : null;
  times.bk2 = bk2 ? bk2.time : null;

  // Back Layout start: the last flat frame before the knee starts to rise.
  const startLimit = bk1 ? bk1.time : ballet.time;
  const flatBefore = before.filter(f => f.time < startLimit && isLayout(f.m));
  times.bl1 = flatBefore.length ? flatBefore[flatBefore.length - 1].time : null;

  // Back Layout finish: the first flat frame after the leg comes back down.
  const endLimit = bk2 ? bk2.time : ballet.time;
  const flatAfter = after.find(f => f.time > endLimit && isLayout(f.m));
  times.bl2 = flatAfter ? flatAfter.time : null;

  return { side, times };
}

// Turn a detected pose into suggested points for the marking screen.
// side: the working leg if known; otherwise the leg lifted more in this frame.
// Points MediaPipe is unsure about are left out so the swimmer places them.
export function pointsFromPose(pose, side = null) {
  if (!side) {
    const l = legMeasures(pose.left), r = legMeasures(pose.right);
    if (l && r && Math.abs(l.lift - r.lift) > 0.15) side = l.lift > r.lift ? 'left' : 'right';
    else side = (pose.left.knee.vis + pose.left.ankle.vis) >= (pose.right.knee.vis + pose.right.ankle.vis) ? 'left' : 'right';
  }
  const other = side === 'left' ? 'right' : 'left';
  const work = pose[side], rest = pose[other];
  const shoulder = pose.left.shoulder.vis >= pose.right.shoulder.vis ? pose.left.shoulder : pose.right.shoulder;
  const pick = p => (p && p.vis >= MIN_VISIBILITY ? { x: p.x, y: p.y } : null);
  return {
    side,
    points: {
      shoulder: pick(shoulder),
      hip: pick(work.hip),
      knee: pick(work.knee),
      ankle: pick(work.ankle),
      ankleB: pick(rest.ankle),
    },
  };
}
