// geometry.js
// The math and the scoring. Points are { x, y } in image pixels; y grows downward.
// Every angle is measured against the waterline the swimmer marked, so a
// tilted phone does not change the result.

const MIN_WATER_GAP = 20;   // the two water points must be at least this far apart (px)
const MIN_SEGMENT = 12;     // two body points closer than this give no trustworthy angle (px)
export const CHECK_PENALTY = 0.2; // points lost for each coach's-eye item not met

const deg = rad => rad * 180 / Math.PI;

export function distance(p, q) {
  return Math.hypot(q.x - p.x, q.y - p.y);
}

// Two unit directions from the waterline: u runs along the water, n points up out of it.
export function waterFrame(waterA, waterB) {
  const len = distance(waterA, waterB);
  if (len < MIN_WATER_GAP) throw new Error('Place the two water points further apart.');
  let u = { x: (waterB.x - waterA.x) / len, y: (waterB.y - waterA.y) / len };
  if (u.x < 0) u = { x: -u.x, y: -u.y };      // always point to the right
  let n = { x: u.y, y: -u.x };
  if (n.y > 0) n = { x: -n.x, y: -n.y };      // always point up (y is smaller higher up)
  return { u, n };
}

function vector(p, q, nameP, nameQ) {
  const v = { x: q.x - p.x, y: q.y - p.y };
  const len = Math.hypot(v.x, v.y);
  if (len < MIN_SEGMENT) throw new Error(`The ${nameP} and ${nameQ} points are too close together.`);
  return { v, len };
}

// Clamp before acos: rounding can push the value just past ±1, and acos then returns NaN.
const safeAcos = c => Math.acos(Math.max(-1, Math.min(1, c)));

// Angle between the segment p→q and the water surface, 0–90°.
export function angleToWater(p, q, frame, names = ['first', 'second']) {
  const { v, len } = vector(p, q, ...names);
  return deg(safeAcos(Math.abs(v.x * frame.u.x + v.y * frame.u.y) / len));
}

// Angle between the segment p→q and the vertical (perpendicular to the water), 0–90°.
export function angleToVertical(p, q, frame, names = ['first', 'second']) {
  const { v, len } = vector(p, q, ...names);
  return deg(safeAcos(Math.abs(v.x * frame.n.x + v.y * frame.n.y) / len));
}

// Angle at b between b→a and b→c, 0–180°.
export function jointAngle(a, b, c, names = ['first', 'middle', 'last']) {
  const ba = vector(b, a, names[1], names[0]);
  const bc = vector(b, c, names[1], names[2]);
  return deg(safeAcos((ba.v.x * bc.v.x + ba.v.y * bc.v.y) / (ba.len * bc.len)));
}

// Turn a difference from the ideal into a deduction on the manual's 0.2 / 0.5 / 1.0 scale.
export function deductionFor(deviation, tol) {
  const [small, medium] = tol;
  const clean = small * 0.08;
  const d = deviation - 1e-9;
  if (d <= clean)  return { value: 0,   band: 'clean',  label: 'On target' };
  if (d <= small)  return { value: 0.2, band: 'small',  label: 'Small deviation' };
  if (d <= medium) return { value: 0.5, band: 'medium', label: 'Medium deviation' };
  return { value: 1.0, band: 'large', label: 'Large deviation' };
}

// Measure one requirement. Returns { value, deviation, deduction } or { error }.
export function evaluateMetric(metric, points, labels = {}) {
  const missing = metric.pts.filter(p => !points[p]);
  if (!points.waterA || !points.waterB) missing.unshift('water line');
  if (missing.length) {
    return { error: 'Mark the ' + missing.map(m => (labels[m] || m).toLowerCase()).join(' and ') + ' first.' };
  }
  try {
    const frame = waterFrame(points.waterA, points.waterB);
    const names = metric.pts.map(p => (labels[p] || p).toLowerCase());
    const [a, b, c] = metric.pts.map(p => points[p]);
    let value;
    if (metric.kind === 'toWater') value = angleToWater(a, b, frame, names);
    else if (metric.kind === 'toVertical') value = angleToVertical(a, b, frame, names);
    else value = jointAngle(a, b, c, names);
    const deviation = Math.abs(value - metric.ideal);
    return { value, deviation, deduction: deductionFor(deviation, metric.tol) };
  } catch (err) {
    return { error: err.message };
  }
}

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

// ---- coach's-eye items measured from the points

// A length to measure heights in, so results don't depend on how far away the camera is.
// The shin (knee to ankle) is preferred; other body segments stand in, scaled to about a shin.
export function referenceScale(pts) {
  const pairs = [['knee', 'ankle', 1], ['hip', 'knee', 1], ['shoulder', 'hip', 1.1], ['hip', 'ankle', 0.5]];
  for (const [a, b, factor] of pairs) {
    if (pts[a] && pts[b]) {
      const d = distance(pts[a], pts[b]) * factor;
      if (d >= 15) return d;
    }
  }
  return null;
}

// Height of point p above the waterline, in shin lengths (negative = below the surface).
function heightAbove(p, pts, frame, scale) {
  return ((p.x - pts.waterA.x) * frame.n.x + (p.y - pts.waterA.y) * frame.n.y) / scale;
}

// Direction of the segment p→q measured against the waterline, in degrees.
function heading(p, q, frame) {
  const v = { x: q.x - p.x, y: q.y - p.y };
  return deg(Math.atan2(v.x * frame.n.x + v.y * frame.n.y, v.x * frame.u.x + v.y * frame.u.y));
}

// Measure one test. pts = this checkpoint's points; others = { checkpointId: { points } }.
// Returns { value } or { error } (error = can't be measured yet, so fall back to ticking by eye).
export function evaluateTest(test, pts, others = {}, labels = {}) {
  const name = p => (labels[p] || p).toLowerCase();
  const missing = test.pts.filter(p => !pts[p]);
  if (!pts.waterA || !pts.waterB) missing.unshift('water line');
  if (missing.length) return { error: 'Mark the ' + missing.map(name).join(' and ') + ' to measure this.' };
  let frame;
  try { frame = waterFrame(pts.waterA, pts.waterB); } catch (err) { return { error: err.message }; }
  let ref = null, refFrame = null;
  if (test.ref) {
    ref = others[test.ref] && others[test.ref].points;
    if (!ref) return { error: `Save ${labels['cp:' + test.ref] || 'the earlier checkpoint'} first to measure this.` };
    if (!ref.waterA || !ref.waterB || test.pts.some(p => !ref[p])) return { error: 'The earlier checkpoint is missing points this needs.' };
    try { refFrame = waterFrame(ref.waterA, ref.waterB); } catch (err) { return { error: err.message }; }
  }
  try {
    const [a, b, c] = test.pts.map(p => pts[p]);
    if (test.kind === 'toWater') return { value: angleToWater(a, b, frame, test.pts.map(name)) };
    if (test.kind === 'joint') return { value: jointAngle(a, b, c, test.pts.map(name)) };
    if (test.kind === 'segmentShift') {
      // How far a segment turned since the earlier checkpoint, each against its own waterline.
      let value = Math.abs(heading(a, b, frame) - heading(ref[test.pts[0]], ref[test.pts[1]], refFrame));
      if (value > 180) value = 360 - value;
      return { value };
    }
    const scale = referenceScale(pts);
    if (!scale) return { error: 'Mark two body points (like knee and ankle) so heights can be measured.' };
    if (test.kind === 'nearSurface') return { value: Math.max(...test.pts.map(p => Math.abs(heightAbove(pts[p], pts, frame, scale)))) };
    if (test.kind === 'pointGap') return { value: distance(a, b) / scale };
    if (test.kind === 'heightShift') {
      const refScale = referenceScale(ref);
      if (!refScale) return { error: 'The earlier checkpoint needs two body points for scale.' };
      return { value: Math.abs(heightAbove(a, pts, frame, scale) - heightAbove(ref[test.pts[0]], ref, refFrame, refScale)) };
    }
    return { error: 'Unknown test.' };
  } catch (err) {
    return { error: err.message };
  }
}

// Decide one coach's-eye item: measured when every test can be measured, otherwise ticked by eye.
export function evaluateCheck(check, ticked, pts, others, labels) {
  if (check.tests) {
    const parts = check.tests.map(t => {
      const out = evaluateTest(t, pts, others, labels);
      if (out.error) return { test: t, error: out.error };
      const pass = t.max !== undefined ? out.value <= t.max + 1e-9 : out.value >= t.min - 1e-9;
      const digits = t.unit === '°' ? 1 : 2;
      return {
        test: t, value: out.value, pass,
        display: out.value.toFixed(digits) + t.unit,
        limit: (t.max !== undefined ? '≤ ' + t.max : '≥ ' + t.min) + t.unit,
      };
    });
    const unmeasured = parts.find(p => p.error);
    if (!unmeasured) return { check, measured: true, pass: parts.every(p => p.pass), parts };
    return { check, measured: false, pass: !!ticked, reason: unmeasured.error };
  }
  return { check, measured: false, pass: !!ticked, reason: null };
}

// Score one checkpoint. checksMet is a list of true/false (ticked by eye), one per coach's-eye item;
// a measured item uses its measurement instead. others = the other checkpoints, for "since" tests.
//   score = 10 − deductions − 0.2 × items not met   (kept between 0 and 10)
export function scoreCheckpoint(checkpoint, points, checksMet = [], labels = {}, others = {}) {
  const rows = checkpoint.metrics.map(metric => ({ metric, ...evaluateMetric(metric, points, labels) }));
  const deductions = rows.reduce((sum, r) => sum + (r.deduction ? r.deduction.value : 0), 0);
  const checkResults = checkpoint.checks.map((c, i) => evaluateCheck(c, checksMet[i], points, others, labels));
  const missed = checkResults.filter(r => !r.pass).map(r => r.check);
  const checkPenalty = missed.length * CHECK_PENALTY;
  const complete = rows.every(r => !r.error);
  const score = clamp(10 - deductions - checkPenalty, 0, 10);
  return { rows, deductions, checkResults, missed, checkPenalty, complete, score };
}

// Score the whole figure from the SAVED checkpoints only.
//   practice score = Σ(score × weight) ÷ Σ(weight)   (weighted checkpoints only)
//   figure score   = practice score × degree of difficulty
export function scoreFigure(figure, saved, labels = {}) {
  const results = figure.checkpoints.map(cp => {
    const s = saved[cp.id];
    if (!s) return { checkpoint: cp, saved: false };
    return { checkpoint: cp, saved: true, time: s.time, ...scoreCheckpoint(cp, s.points, s.checks, labels, saved) };
  });
  const weighted = results.filter(r => r.saved && r.checkpoint.weight > 0);
  const totalWeight = weighted.reduce((sum, r) => sum + r.checkpoint.weight, 0);
  const practice = totalWeight ? weighted.reduce((sum, r) => sum + r.score * r.checkpoint.weight, 0) / totalWeight : null;
  const allSaved = results.every(r => r.saved);
  return {
    results,
    practice,
    figureScore: practice === null ? null : practice * figure.dd,
    provisional: !allSaved,
    issues: rankIssues(figure, results),
  };
}

// Every shortfall, ranked by how many figure points it costs:
// points lost × the checkpoint's share of the score.
export function rankIssues(figure, results) {
  const issues = [];
  for (const r of results) {
    if (!r.saved) continue;
    const share = r.checkpoint.weight / figure.totalWeight;
    for (const row of r.rows) {
      if (row.deduction && row.deduction.value > 0) {
        issues.push({
          checkpoint: r.checkpoint, kind: 'measured', title: row.metric.label,
          detail: `${row.value.toFixed(1)}° measured, target ${row.metric.ideal}° (${row.deduction.label.toLowerCase()}, −${row.deduction.value.toFixed(1)})`,
          drillKey: row.metric.id, cost: row.deduction.value * share * figure.dd,
        });
      }
    }
    for (const c of r.checkResults) {
      if (c.pass) continue;
      const failed = c.measured ? c.parts.filter(p => !p.pass).map(p => `${p.test.label} ${p.display} (needs ${p.limit})`).join('; ') : '';
      issues.push({
        checkpoint: r.checkpoint, kind: 'coach', title: c.check.text,
        detail: (c.measured ? `Measured: ${failed}` : 'Not ticked as met') + ` (−${CHECK_PENALTY.toFixed(1)})`,
        drillKey: c.check.drills, cost: CHECK_PENALTY * share * figure.dd,
      });
    }
  }
  return issues.filter(i => i.cost > 0).sort((a, b) => b.cost - a.cost);
}
