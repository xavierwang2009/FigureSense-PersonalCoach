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

// Score one checkpoint. checksMet is a list of true/false, one per coach's-eye item.
//   score = 10 − deductions − 0.2 × items not met   (kept between 0 and 10)
export function scoreCheckpoint(checkpoint, points, checksMet = [], labels = {}) {
  const rows = checkpoint.metrics.map(metric => ({ metric, ...evaluateMetric(metric, points, labels) }));
  const deductions = rows.reduce((sum, r) => sum + (r.deduction ? r.deduction.value : 0), 0);
  const missed = checkpoint.checks.filter((_, i) => !checksMet[i]);
  const checkPenalty = missed.length * CHECK_PENALTY;
  const complete = rows.every(r => !r.error);
  const score = clamp(10 - deductions - checkPenalty, 0, 10);
  return { rows, deductions, missed, checkPenalty, complete, score };
}

// Score the whole figure from the SAVED checkpoints only.
//   practice score = Σ(score × weight) ÷ Σ(weight)   (weighted checkpoints only)
//   figure score   = practice score × degree of difficulty
export function scoreFigure(figure, saved, labels = {}) {
  const results = figure.checkpoints.map(cp => {
    const s = saved[cp.id];
    if (!s) return { checkpoint: cp, saved: false };
    return { checkpoint: cp, saved: true, time: s.time, ...scoreCheckpoint(cp, s.points, s.checks, labels) };
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
    r.checkpoint.checks.forEach((check, i) => {
      if (r.missed.includes(check)) {
        issues.push({
          checkpoint: r.checkpoint, kind: 'coach', title: check.text,
          detail: `Not ticked as met (−${CHECK_PENALTY.toFixed(1)})`,
          drillKey: check.drills, cost: CHECK_PENALTY * share * figure.dd,
        });
      }
    });
  }
  return issues.filter(i => i.cost > 0).sort((a, b) => b.cost - a.cost);
}
