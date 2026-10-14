// poses.js
// Small, still line drawings of each position, so a swimmer knows which
// moment to capture. The swimmer floats on her back, head on the left.
// Colors come from the page (CSS classes), so the drawings work in light and dark.

const W = 220, H = 120, WATER = 78;  // drawing size and the water level

// Body joints for each pose, in drawing coordinates.
const SHAPES = {
  layout: {
    head: [40, 70], shoulder: [62, 74], hip: [118, 76],
    knee: [150, 77], ankle: [184, 77], toe: [198, 75],
    kneeB: [150, 77], ankleB: [184, 77],
    target: 'Body flat along the surface',
  },
  bentknee: {
    head: [40, 70], shoulder: [62, 74], hip: [118, 76],
    knee: [118, 34], ankle: [148, 62], toe: [160, 68],
    kneeB: [150, 77], ankleB: [184, 77],
    target: 'Thigh vertical, toe at the other knee',
  },
  ballet: {
    head: [40, 70], shoulder: [62, 74], hip: [118, 76],
    knee: [118, 40], ankle: [118, 8], toe: [124, 2],
    kneeB: [150, 77], ankleB: [184, 77],
    target: 'Raised leg vertical, 90° to the body',
  },
};

const line = (a, b, cls) =>
  `<line x1="${a[0]}" y1="${a[1]}" x2="${b[0]}" y2="${b[1]}" class="${cls}" />`;

// Returns an <svg> string for one pose ('layout', 'bentknee' or 'ballet').
export function poseArt(name) {
  const s = SHAPES[name];
  const body = [
    line(s.shoulder, s.hip, 'pose-body'),
    line(s.hip, s.kneeB, 'pose-body'), line(s.kneeB, s.ankleB, 'pose-body'),
    line(s.hip, s.knee, 'pose-body'), line(s.knee, s.ankle, 'pose-body'), line(s.ankle, s.toe, 'pose-foot'),
  ].join('');
  // A dashed guide shows what the judges look for in this position.
  const guide = name === 'layout'
    ? line([20, WATER - 4], [206, WATER - 4], 'pose-guide')
    : line([s.hip[0], WATER], [s.hip[0], 0], 'pose-guide');
  return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${s.target}" class="pose-art">
    <rect x="0" y="${WATER}" width="${W}" height="${H - WATER}" class="pose-water" />
    <line x1="0" y1="${WATER}" x2="${W}" y2="${WATER}" class="pose-surface" />
    ${guide}${body}
    <circle cx="${s.head[0]}" cy="${s.head[1]}" r="9" class="pose-head" />
    <text x="${W / 2}" y="${H - 8}" text-anchor="middle" class="pose-caption">${s.target}</text>
  </svg>`;
}
