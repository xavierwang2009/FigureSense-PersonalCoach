/**
 * FigureSense measurement engine.
 *
 * Everything here is 2D image geometry from a fixed side-on camera. Distances are
 * expressed in "shin lengths" so results are comparable between clips without a
 * calibrated scale. Nothing in this file is an official score.
 */

const sub = (a, b) => [a[0] - b[0], a[1] - b[1]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1];
const len = a => Math.hypot(a[0], a[1]);
const deg = r => (r * 180) / Math.PI;
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

export const distance = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);

/** Along-surface unit vector `u` and upward-in-image unit normal `n`. */
export function waterFrame(w1, w2) {
  const d = sub(w2, w1);
  const m = len(d);
  if (m < 20) throw new Error('The two waterline points are too close together to define the surface.');
  let u = [d[0] / m, d[1] / m];
  if (u[0] < 0) u = [-u[0], -u[1]];
  let n = [u[1], -u[0]];
  if (n[1] > 0) n = [-n[0], -n[1]];
  return { u, n };
}

/** Unsigned 0-90 deviation of segment p->q from the water surface line. */
export function segmentToWater(p, q, frame) {
  const v = sub(q, p);
  const m = len(v);
  if (m < 12) throw new Error('Those two points are too close together to measure an angle.');
  return deg(Math.acos(clamp(Math.abs(dot(v, frame.u)) / m, 0, 1)));
}

/** Unsigned 0-90 deviation of segment p->q from vertical (the plumb line). */
export function segmentToVertical(p, q, frame) {
  const v = sub(q, p);
  const m = len(v);
  if (m < 12) throw new Error('Those two points are too close together to measure an angle.');
  return deg(Math.acos(clamp(Math.abs(dot(v, frame.n)) / m, 0, 1)));
}

/** Signed elevation of p->q above the surface line, positive = rising out of the water. */
export function elevation(p, q, frame) {
  const v = sub(q, p);
  const m = len(v);
  if (m < 12) throw new Error('Those two points are too close together to measure an angle.');
  return deg(Math.asin(clamp(dot(v, frame.n) / m, -1, 1)));
}

/** Interior angle at b, in degrees, for the chain a-b-c. */
export function jointAngle(a, b, c) {
  const v1 = sub(a, b);
  const v2 = sub(c, b);
  const m = len(v1) * len(v2);
  if (m < 200) throw new Error('The joint points are too close together to measure an angle.');
  return deg(Math.acos(clamp(dot(v1, v2) / m, -1, 1)));
}

/** Signed height of p above the waterline, in shin lengths. */
export function heightAbove(p, w1, frame, scale) {
  return dot(sub(p, w1), frame.n) / scale;
}

/** Signed displacement between two image points along the surface axis, in shin lengths. */
export function alongWater(p, q, frame, scale) {
  return dot(sub(p, q), frame.u) / scale;
}

/** Signed height difference between two image points, in shin lengths. */
export function heightDifference(p, q, frame, scale) {
  return dot(sub(p, q), frame.n) / scale;
}

/** Metric kinds whose result is expressed in shin lengths and therefore need a scale. */
export const SCALED_KINDS = new Set(['heightChange', 'travelAlongWater', 'heightChart', 'nearSurface', 'heightShift', 'pointGap']);

/**
 * Reference length for a checkpoint, in pixels. Knee-to-ankle is preferred because it
 * is the segment the manual's inch thresholds scale most naturally against.
 */
export function referenceScale(pts) {
  const pairs = [
    ['knee', 'ankle', 1],
    ['kneecap', 'crotch', 1],
    ['hip', 'knee', 1],
    ['shoulder', 'hip', 1.1],
    ['hip', 'ankle', 0.5],
    ['head', 'hip', 0.75]
  ];
  for (const [a, b, factor] of pairs) {
    if (pts[a] && pts[b]) {
      const d = distance(pts[a], pts[b]) * factor;
      if (d >= 15) return d;
    }
  }
  return null;
}

/* ------------------------------------------------------------------ */
/* Official height charts                                              */
/* ------------------------------------------------------------------ */

const SPLIT_ANCHORS = [
  [80, 2.5], [100, 3.5], [115, 4.5], [135, 5.5], [155, 6.5], [165, 7.5], [175, 8.5], [180, 9.5]
];

const SPLIT_BANDS = [
  [180, 'Excellent / near perfect — 180° flat, crotch and legs dry'],
  [170, 'Very good — 170-180°, legs dry'],
  [160, 'Good — 160-170°, legs almost dry'],
  [150, 'Competent — 150-160°, lower legs dry'],
  [140, 'Between Satisfactory and Competent — 140-150°'],
  [130, 'Satisfactory — 130-140°, crotch under water'],
  [120, 'Between Deficient and Satisfactory — 120-130°'],
  [110, 'Deficient — 110-120°, legs under water'],
  [100, 'Between Weak and Deficient — 100-110°'],
  [0, 'Weak — up to 100°, feet come out vertically']
];

/** Split angle (degrees at the hip) -> height-chart score and printed band. */
export function splitChart(angle) {
  const a = clamp(angle, 0, 180);
  let score = SPLIT_ANCHORS[0][1];
  for (let i = 0; i < SPLIT_ANCHORS.length - 1; i++) {
    const [a0, s0] = SPLIT_ANCHORS[i];
    const [a1, s1] = SPLIT_ANCHORS[i + 1];
    if (a >= a0 && a <= a1) { score = s0 + ((a - a0) / (a1 - a0)) * (s1 - s0); break; }
    if (a > a1) score = s1;
  }
  const band = SPLIT_BANDS.find(([floor]) => a >= floor)[1];
  return { score: Math.round(clamp(score, 0.1, 9.5) * 10) / 10, band };
}

const THIGH_BANDS = [
  [-0.35, 'Perfect — water at the top of the pelvis'],
  [0, 'Excellent / near perfect — water above the crotch'],
  [0.12, 'Very good — water at crotch level'],
  [0.38, 'Good — water at the upper thigh'],
  [0.62, 'Competent — water at mid-thigh'],
  [0.88, 'Satisfactory — water at the low thigh'],
  [1.12, 'Deficient — water at the kneecap'],
  [Infinity, 'Weak — water below the kneecap']
];

/**
 * Bent Knee Vertical height. `u` is where the waterline sits between the crotch (u=0)
 * and the kneecap (u=1) along the support leg.
 */
export function thighChart(u) {
  let score;
  if (u <= 0) score = 8.5 + 1.5 * Math.min(1, -u / 0.35);
  else score = 8.5 - 4 * u;
  const band = THIGH_BANDS.find(([ceil]) => u <= ceil)[1];
  return { score: Math.round(clamp(score, 0.5, 10) * 10) / 10, band };
}

/* ------------------------------------------------------------------ */
/* Deviation -> deduction                                              */
/* ------------------------------------------------------------------ */

/** Maps a deviation onto the manual's 0.2 / 0.5 / 1.0 scale. */
export function deductionFor(deviation, tol) {
  const [small, medium, clean = small * 0.08] = tol;
  const d = deviation - 1e-9;
  if (d <= clean) return { value: 0, band: 'clean', label: 'Within tolerance' };
  if (d <= small) return { value: 0.2, band: 'small', label: 'Small deviation' };
  if (d <= medium) return { value: 0.5, band: 'medium', label: 'Medium deviation' };
  return { value: 1.0, band: 'large', label: 'Large deviation' };
}

/** Figure-level travel deduction from the individual travel findings. */
export function travelDeduction(bands) {
  const large = bands.filter(b => b === 'large').length;
  const medium = bands.filter(b => b === 'medium').length;
  const small = bands.filter(b => b === 'small').length;
  if (large || medium >= 2) return { value: 0.5, label: 'Large travel deduction' };
  if (medium || small >= 2) return { value: 0.3, label: 'Medium travel deduction' };
  if (small) return { value: 0.1, label: 'Small travel deduction' };
  return { value: 0, label: 'No travel deduction' };
}

/* ------------------------------------------------------------------ */
/* Metric evaluation                                                   */
/* ------------------------------------------------------------------ */

const need = (pts, keys) => {
  const missing = keys.filter(k => !pts[k]);
  if (missing.length) throw new Error(`Mark ${missing.join(', ')} first.`);
};

/**
 * Evaluate one metric spec against a captured checkpoint.
 * `frames` maps checkpoint id -> { points, frame, scale } for cross-frame metrics.
 */
export function evaluateMetric(spec, cp, frames) {
  const { points: pts, frame, scale } = cp;
  if (SCALED_KINDS.has(spec.kind) && !scale) throw new Error('Mark at least two body landmarks so distances have a reference length.');
  switch (spec.kind) {
    case 'segmentToWater': {
      need(pts, spec.pts);
      const value = segmentToWater(pts[spec.pts[0]], pts[spec.pts[1]], frame);
      return { value, display: value.toFixed(1) + spec.unit, deviation: Math.abs(value - spec.ideal) };
    }
    case 'segmentToVertical': {
      need(pts, spec.pts);
      const value = segmentToVertical(pts[spec.pts[0]], pts[spec.pts[1]], frame);
      return { value, display: value.toFixed(1) + spec.unit, deviation: Math.abs(value - spec.ideal) };
    }
    case 'heightChange': {
      need(pts, spec.pts);
      const ref = frames[spec.ref];
      if (!ref) throw new Error('Capture the reference checkpoint first.');
      need(ref.points, spec.pts);
      const drop = -heightDifference(pts[spec.pts[0]], ref.points[spec.pts[0]], frame, scale);
      return {
        value: drop,
        display: (drop >= 0 ? '↓ ' : '↑ ') + Math.abs(drop).toFixed(2) + spec.unit,
        deviation: Math.max(0, drop)
      };
    }
    case 'travelAlongWater': {
      need(pts, spec.pts);
      const ref = frames[spec.ref];
      if (!ref) throw new Error('Capture the reference checkpoint first.');
      const refKey = spec.refPt || spec.pts[0];
      need(ref.points, [refKey]);
      const shift = alongWater(pts[spec.pts[0]], ref.points[refKey], frame, scale);
      return { value: shift, display: Math.abs(shift).toFixed(2) + spec.unit, deviation: Math.abs(shift) };
    }
    case 'jointAngle': {
      need(pts, spec.pts);
      const value = jointAngle(...spec.pts.map(key => pts[key]));
      return { value, display: value.toFixed(1) + spec.unit, deviation: Math.abs(value - spec.ideal) };
    }
    case 'splitAngle': {
      need(pts, spec.pts);
      const angle = jointAngle(pts[spec.pts[0]], pts[spec.pts[1]], pts[spec.pts[2]]);
      const chart = splitChart(angle);
      return { value: angle, display: angle.toFixed(1) + '°', chartScore: chart.score, band: chart.band };
    }
    case 'splitEvenness': {
      need(pts, spec.pts);
      const a = elevation(pts[spec.pts[1]], pts[spec.pts[0]], frame);
      const b = elevation(pts[spec.pts[1]], pts[spec.pts[2]], frame);
      const value = Math.abs(a - b);
      return { value, display: value.toFixed(1) + spec.unit, deviation: value };
    }
    case 'heightChart': {
      need(pts, ['crotch', 'kneecap', 'waterA']);
      const hC = heightAbove(pts.crotch, pts.waterA, frame, scale);
      const hK = heightAbove(pts.kneecap, pts.waterA, frame, scale);
      const thigh = hK - hC;
      if (Math.abs(thigh) < 0.05) throw new Error('The crotch and kneecap marks are too close together.');
      const u = (0 - hC) / thigh;
      const chart = thighChart(u);
      return { value: u, display: chart.band.split('—')[1]?.trim() || chart.band, chartScore: chart.score, band: chart.band };
    }
    case 'nearSurface': {
      // Furthest of the points from the surface line, above or below, in shin lengths.
      need(pts, [...spec.pts, 'waterA']);
      const value = Math.max(...spec.pts.map(k => Math.abs(heightAbove(pts[k], pts.waterA, frame, scale))));
      return { value, display: value.toFixed(2) + spec.unit, deviation: value };
    }
    case 'segmentShift': {
      // How far a segment turned since the reference checkpoint, each measured against its own
      // waterline so a panning camera does not count as movement.
      need(pts, spec.pts);
      const ref = frames[spec.ref];
      if (!ref) throw new Error('Capture the reference checkpoint first.');
      need(ref.points, spec.pts);
      const heading = (p, q, f) => Math.atan2(dot(sub(q, p), f.n), dot(sub(q, p), f.u));
      let value = Math.abs(deg(heading(pts[spec.pts[0]], pts[spec.pts[1]], frame) - heading(ref.points[spec.pts[0]], ref.points[spec.pts[1]], ref.frame)));
      if (value > 180) value = 360 - value;
      return { value, display: value.toFixed(1) + spec.unit, deviation: value };
    }
    case 'heightShift': {
      // Change in a point's height above its own frame's waterline since the reference checkpoint.
      need(pts, [spec.pts[0], 'waterA']);
      const ref = frames[spec.ref];
      if (!ref) throw new Error('Capture the reference checkpoint first.');
      need(ref.points, [spec.pts[0], 'waterA']);
      if (!ref.scale) throw new Error('The reference checkpoint needs two body landmarks for scale.');
      const value = Math.abs(heightAbove(pts[spec.pts[0]], pts.waterA, frame, scale) - heightAbove(ref.points[spec.pts[0]], ref.points.waterA, ref.frame, ref.scale));
      return { value, display: value.toFixed(2) + spec.unit, deviation: value };
    }
    case 'pointGap': {
      need(pts, spec.pts);
      const value = distance(pts[spec.pts[0]], pts[spec.pts[1]]) / scale;
      return { value, display: value.toFixed(2) + spec.unit, deviation: value };
    }
    default:
      throw new Error(`Unknown metric kind: ${spec.kind}`);
  }
}

/** Tempo consistency (`even`) or total elapsed time (`fast`). */
export function evaluateTempo(spec, times) {
  const stamps = spec.checkpoints.map(id => times[id]).filter(t => typeof t === 'number');
  if (stamps.length < spec.checkpoints.length) return null;
  if (spec.mode === 'fast') {
    const total = stamps[stamps.length - 1] - stamps[0];
    return { value: total, display: total.toFixed(2) + ' s', deviation: Math.max(0, total) };
  }
  const gaps = [];
  for (let i = 1; i < stamps.length; i++) gaps.push(stamps[i] - stamps[i - 1]);
  if (gaps.some(g => g <= 0)) return null;
  const avg = gaps.reduce((a, b) => a + b, 0) / gaps.length;
  const spread = Math.max(...gaps) / avg - 1;
  return { value: spread, display: '±' + (spread * 100).toFixed(0) + '%', deviation: spread };
}

/**
 * Answer a coach's-eye item from the landmarks. Each test passes when its value is within
 * `max` (or at least `min`). Returns null when the frames cannot answer it, so the item
 * falls back to the coach's eye.
 */
export function evaluateCheck(tests, cp, frames) {
  const parts = [];
  for (const test of tests) {
    let out;
    try { out = evaluateMetric(test, cp, frames); } catch { return null; }
    const pass = test.max != null ? out.value <= test.max + 1e-9 : out.value >= test.min - 1e-9;
    const limit = test.max != null ? `≤ ${test.max}${test.unit}` : `≥ ${test.min}${test.unit}`;
    parts.push({ label: test.label, value: out.value, display: out.display, limit, pass });
  }
  return { pass: parts.every(p => p.pass), parts };
}

/* ------------------------------------------------------------------ */
/* Figure scoring                                                      */
/* ------------------------------------------------------------------ */

const CHECK_PENALTY = 0.2;

/**
 * Score a whole figure.
 * @param {object} figure Figure definition from figures.js
 * @param {object} captures Map of checkpoint id -> { points, frame, scale, time, checks:Set }
 */
export function scoreFigure(figure, captures) {
  const results = [];
  const travelBands = [];

  for (const cp of figure.checkpoints) {
    const cap = captures[cp.id];
    if (!cap) { results.push({ checkpoint: cp, captured: false, metrics: [] }); continue; }
    const metrics = [];
    let chartScore = null;
    let deductions = 0;

    for (const spec of cp.metrics) {
      let out;
      try {
        out = evaluateMetric(spec, cap, captures);
      } catch (err) {
        metrics.push({ spec, error: err.message });
        continue;
      }
      if (out.chartScore != null) {
        chartScore = chartScore == null ? out.chartScore : Math.min(chartScore, out.chartScore);
        metrics.push({ spec, ...out, deduction: null });
        continue;
      }
      const ded = deductionFor(out.deviation, spec.tol);
      if (spec.travel) travelBands.push(ded.band);
      else deductions += ded.value;
      metrics.push({ spec, ...out, deduction: ded });
    }

    // Items the landmarks can answer are measured; the rest need the coach's eye (or the user's tick).
    const checkResults = cp.checks.map((text, i) => {
      const tests = cp.checkTests?.[i];
      const measured = tests ? evaluateCheck(tests, cap, captures) : null;
      if (measured) return { text, measured: true, pass: measured.pass, parts: measured.parts };
      return { text, measured: false, pass: !!cap.checks?.has(i), visible: !tests };
    });
    const missedChecks = checkResults.filter(c => !c.pass).map(c => c.text);
    const checkPenalty = missedChecks.length * CHECK_PENALTY;
    const base = chartScore == null ? 10 : chartScore;
    const score = clamp(base - deductions - checkPenalty, 0, 10);

    results.push({
      checkpoint: cp, captured: true, metrics, checkResults, missedChecks, checkPenalty,
      deductions, chartScore, score, time: cap.time, auto: !!cap.auto
    });
  }

  let tempo = null;
  if (figure.tempo) {
    const times = {};
    for (const [id, cap] of Object.entries(captures)) times[id] = cap.time;
    const out = evaluateTempo(figure.tempo, times);
    if (out) tempo = { ...out, spec: figure.tempo, deduction: deductionFor(out.deviation, figure.tempo.tol) };
  }

  const scored = results.filter(r => r.captured && r.checkpoint.weight > 0);
  const totalWeight = scored.reduce((s, r) => s + r.checkpoint.weight, 0);
  const coverage = figure.checkpoints.filter(c => c.weight > 0).reduce((s, c) => s + c.weight, 0);
  const travel = travelDeduction(travelBands);

  let weighted = null;
  let awarded = null;
  // Every weighted checkpoint measured; `complete` additionally needs each one confirmed by hand.
  const measuredAll = totalWeight > 0 && Math.abs(totalWeight - coverage) < 1e-6
    && scored.every(r => !r.metrics.some(m => m.error))
    && (!figure.tempo || tempo !== null);
  const complete = measuredAll && scored.every(r => !captures[r.checkpoint.id].auto);
  if (measuredAll) {
    weighted = scored.reduce((s, r) => s + r.score * r.checkpoint.weight, 0) / totalWeight;
    if (tempo) weighted -= tempo.deduction.value;
    weighted = clamp(weighted - travel.value, 0, 10);
    awarded = weighted * figure.dd;
  }

  return {
    results, tempo, travel, complete,
    provisional: measuredAll && !complete,
    coverage: totalWeight / coverage,
    practiceScore: weighted,
    awarded
  };
}
