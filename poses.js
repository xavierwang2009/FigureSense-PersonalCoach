// poses.js
// Small, still line drawings of each position, so a swimmer knows which
// moment to capture. The swimmer floats on her back, head on the left.
// Colors come from the page (CSS classes), so the drawings work in light and dark.

const W = 220, H = 150, WATER = 78;  // drawing size and the water level

// Body joints for each pose, in drawing coordinates. head: null = under the water, out of view.
// guide: what the dashed line shows ('surface', or a vertical line through 'hip' or 'knee').
const SHAPES = {
  layout: {
    head: [40, 70], shoulder: [62, 74], hip: [118, 76],
    knee: [150, 77], ankle: [184, 77], toe: [198, 75],
    kneeB: [150, 77], ankleB: [184, 77],
    guide: 'surface', target: 'Body flat along the surface',
  },
  bentknee: {
    head: [40, 70], shoulder: [62, 74], hip: [118, 76],
    knee: [118, 34], ankle: [148, 62], toe: [160, 68],
    kneeB: [150, 77], ankleB: [184, 77],
    guide: 'hip', target: 'Thigh vertical, toe at the other knee',
  },
  ballet: {
    head: [40, 70], shoulder: [62, 74], hip: [118, 76],
    knee: [118, 40], ankle: [118, 8], toe: [124, 2],
    kneeB: [150, 77], ankleB: [184, 77],
    guide: 'hip', target: 'Raised leg vertical, 90° to the body',
  },
  // Stage 2 poses (Barracuda and Kip). The swimmer is upside down for these.
  backpike: {
    head: [133, 96], shoulder: [126, 108], hip: [110, 128],
    knee: [110, 107], ankle: [110, 86], toe: [110, 81],
    kneeB: [113, 107], ankleB: [113, 86],
    guide: 'hip', target: 'Legs vertical, toes just under, pike ≤ 45°',
  },
  vertical: {
    head: [110, 116], shoulder: [110, 104], hip: [110, 70],
    knee: [110, 42], ankle: [110, 14], toe: [110, 6],
    kneeB: [113, 42], ankleB: [113, 14],
    guide: 'hip', target: 'Legs vertical, hips high, body in line',
  },
  descent: {
    head: null, shoulder: [110, 124], hip: [110, 94],
    knee: [110, 68], ankle: [110, 42], toe: [110, 34],
    kneeB: [113, 68], ankleB: [113, 42],
    guide: 'hip', target: 'Sinks straight down, legs together',
  },
  tuck: {
    head: [106, 118], shoulder: [116, 106], hip: [128, 92],
    knee: [96, 88], ankle: [96, 52], toe: [96, 45],
    kneeB: [99, 88], ankleB: [99, 52],
    guide: 'knee', target: 'Shins vertical, knees drawn in',
  },
};

const line = (a, b, cls) =>
  `<line x1="${a[0]}" y1="${a[1]}" x2="${b[0]}" y2="${b[1]}" class="${cls}" />`;

// Returns an <svg> string for one pose (a key of SHAPES).
export function poseArt(name) {
  const s = SHAPES[name];
  const body = [
    line(s.shoulder, s.hip, 'pose-body'),
    line(s.hip, s.kneeB, 'pose-body'), line(s.kneeB, s.ankleB, 'pose-body'),
    line(s.hip, s.knee, 'pose-body'), line(s.knee, s.ankle, 'pose-body'), line(s.ankle, s.toe, 'pose-foot'),
  ].join('');
  // A dashed guide shows what the judges look for in this position.
  const at = s[s.guide];
  const guide = s.guide === 'surface'
    ? line([20, WATER - 4], [206, WATER - 4], 'pose-guide')
    : line([at[0], at[1]], [at[0], 0], 'pose-guide');
  return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${s.target}" class="pose-art">
    <rect x="0" y="${WATER}" width="${W}" height="${H - WATER}" class="pose-water" />
    <line x1="0" y1="${WATER}" x2="${W}" y2="${WATER}" class="pose-surface" />
    ${guide}${body}
    ${s.head ? `<circle cx="${s.head[0]}" cy="${s.head[1]}" r="9" class="pose-head" />` : ''}
    <text x="${W / 2}" y="${H - 6}" text-anchor="middle" class="pose-caption">${s.target}</text>
  </svg>`;
}

// ---------------------------------------------------------------- comparison

// A small bar that shows how far off one measurement is.
// Green = on target, amber = small, red = medium or large. The dark tick is the swimmer.
export function deviationGauge(deviation, tol) {
  const [small, medium] = tol;
  const max = medium * 1.5;                 // the bar runs from 0 to 1.5 × the medium limit
  const W = 90, H = 14;
  const x = v => (Math.min(v, max) / max) * W;
  const clean = small * 0.08;
  const seg = (a, b, cls) => `<rect x="${x(a).toFixed(1)}" y="3" width="${(x(b) - x(a)).toFixed(1)}" height="8" class="${cls}" />`;
  const m = x(deviation);
  return `<svg class="gauge" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="${deviation.toFixed(1)} away from the target">
    ${seg(0, clean, 'g-clean')}${seg(clean, small, 'g-small')}${seg(small, medium, 'g-medium')}${seg(medium, max, 'g-large')}
    <line x1="${m.toFixed(1)}" y1="0" x2="${m.toFixed(1)}" y2="${H}" class="g-mark" />
  </svg>`;
}

// Where a measured segment SHOULD point. Returns { from, to } in the same units as the points.
//   toWater: same length, along the water.   toVertical: same length, straight up from the water.
//   joint:   the last segment turned so the angle at the middle point equals the target.
export function targetLine(metric, pts, frame) {
  const [a, b, c] = metric.pts.map(p => pts[p]);
  if (metric.kind === 'toWater' || metric.kind === 'toVertical') {
    const v = { x: b.x - a.x, y: b.y - a.y };
    const len = Math.hypot(v.x, v.y);
    const dir = metric.kind === 'toWater' ? frame.u : frame.n;
    const sign = v.x * dir.x + v.y * dir.y >= 0 ? 1 : -1;   // keep the same general direction
    return { from: a, to: { x: a.x + dir.x * sign * len, y: a.y + dir.y * sign * len } };
  }
  // joint: start from b→a and turn it by the target angle, toward the side c is on.
  const ba = { x: a.x - b.x, y: a.y - b.y }, bc = { x: c.x - b.x, y: c.y - b.y };
  const lenA = Math.hypot(ba.x, ba.y), lenC = Math.hypot(bc.x, bc.y);
  const t = metric.ideal * Math.PI / 180;
  const turn = s => ({ x: (ba.x * Math.cos(s * t) - ba.y * Math.sin(s * t)) / lenA, y: (ba.x * Math.sin(s * t) + ba.y * Math.cos(s * t)) / lenA });
  const p1 = turn(1), p2 = turn(-1);
  const closer = (p1.x * bc.x + p1.y * bc.y) >= (p2.x * bc.x + p2.y * bc.y) ? p1 : p2;
  return { from: b, to: { x: b.x + closer.x * lenC, y: b.y + closer.y * lenC } };
}

// ---------------------------------------------------------------- illustrations
// The prototype's swimmer illustrations (art/poses-sprite.jpg is a 2 × 2 sheet:
// back layout, bent knee · bent knee vertical, vertical; Ballet Leg has its own picture).
// Each card holds an illustration and the diagram above; the Illustration / Diagram
// switch (body.technical-view, see nav.js) chooses which one shows.
const ILLUSTRATION = {
  layout:   { pos: '0% 0%',     ratio: '627 / 537', label: 'Back layout' },
  bentknee: { pos: '100% 0%',   ratio: '627 / 537', label: 'Bent knee back layout' },
  vertical: { pos: '100% 100%', ratio: '627 / 717', label: 'Vertical position' },
  descent:  { pos: '100% 100%', ratio: '627 / 717', label: 'Vertical position' },
  ballet:   { img: 'hero-assets/ballet-leg-human.png', ratio: '3 / 2', label: 'Ballet Leg' },
};

export function poseCard(name) {
  const art = ILLUSTRATION[name];
  if (!art) return `<span class="pose-switch pose-seq pose-diagram-only">${poseArt(name)}</span>`;
  const style = art.img
    ? `background-image:url('${art.img}');background-size:contain;background-position:center;aspect-ratio:${art.ratio}`
    : `background-image:url('art/poses-sprite.jpg');background-size:200% auto;background-position:${art.pos};aspect-ratio:${art.ratio}`;
  return `<span class="pose-switch pose-seq">
    <span class="character-pose" style="${style}" role="img" aria-label="${art.label}, illustrated"></span>
    <span class="technical-pose">${poseArt(name)}</span>
  </span>`;
}
