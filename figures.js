// figures.js
// The "rulebook": what FigureSense knows about Ballet Leg.
// Data only, no logic. Values come from the FigureSense prototype,
// which takes them from the World Aquatics figure manual (February 2026).

// The points a swimmer marks on a frame.
export const LANDMARKS = {
  waterA:   { label: 'Water 1',  hint: 'A point on the flat water surface, on one side of the swimmer' },
  waterB:   { label: 'Water 2',  hint: 'A second surface point, well away from the first' },
  shoulder: { label: 'Shoulder', hint: 'Shoulder joint nearest the camera' },
  hip:      { label: 'Hip',      hint: 'Hip joint of the working (raised) leg' },
  knee:     { label: 'Knee',     hint: 'Knee of the working leg' },
  ankle:    { label: 'Ankle',    hint: 'Ankle of the working leg' },
  ankleB:   { label: 'Other ankle', hint: 'Ankle of the leg that stays on the surface' },
};

// How far off a measurement may be before points are taken off.
// [small, medium] in degrees. Anything within 8% of "small" counts as clean.
// These are practice estimates, not official judging values.
const TOL = [15, 30];

export const BALLET_LEG = {
  number: '101',
  name: 'Ballet Leg, Single',
  dd: 1.6,          // degree of difficulty
  totalWeight: 43,  // the numerical values (NV) of the scored positions add up to 43
  summary: 'Begin in Back Layout. Draw one foot along the inside of the extended leg to Bent Knee Back Layout. ' +
           'Extend the knee without moving the thigh to Ballet Leg. Bend the knee without moving the thigh, ' +
           'then return to Back Layout.',
  checkpoints: [
    {
      id: 'bl1', label: 'Back Layout · start', weight: 0, pose: 'layout',
      cue: 'Capture the starting back layout, before the foot starts to move.',
      metrics: [
        { id: 'bodyline',   label: 'Trunk vs surface',      kind: 'toWater',    pts: ['shoulder', 'hip'], ideal: 0, tol: TOL },
        { id: 'surfaceleg', label: 'Surface leg alignment', kind: 'toWater',    pts: ['hip', 'ankleB'],  ideal: 0, tol: TOL },
      ],
      checks: [
        { text: 'Face, chest, thighs and feet at the surface', drills: 'height',
          tests: [{ kind: 'nearSurface', pts: ['shoulder', 'hip', 'knee', 'ankle'], label: 'Furthest point from the surface', max: 0.35, unit: ' shin' }] },
        { text: 'Ears, shoulders, hips and ankles in one horizontal line', drills: 'bodyline',
          tests: [{ kind: 'toWater', pts: ['shoulder', 'ankle'], label: 'Shoulder-to-ankle line vs surface', max: 10, unit: '°' }] },
      ],
    },
    {
      id: 'bk1', label: 'Bent Knee · entry', weight: 10.5, pose: 'bentknee',
      cue: 'Capture the bent-knee position before the leg straightens.',
      metrics: [
        { id: 'bodyline',   label: 'Trunk vs surface',             kind: 'toWater',    pts: ['shoulder', 'hip'], ideal: 0, tol: TOL },
        { id: 'surfaceleg', label: 'Surface leg alignment',        kind: 'toWater',    pts: ['hip', 'ankleB'],  ideal: 0, tol: TOL },
        { id: 'thigh',      label: 'Thigh away from vertical',     kind: 'toVertical', pts: ['hip', 'knee'],    ideal: 0, tol: TOL },
      ],
      checks: [
        { text: 'Toe follows the inside of the extended leg', drills: 'toepath' },
        { text: 'Head and trunk stay still; surface leg stays extended', drills: 'height',
          tests: [
            { kind: 'heightShift', pts: ['shoulder'], ref: 'bl1', label: 'Shoulder height change since the start', max: 0.3, unit: ' shin' },
            { kind: 'segmentShift', pts: ['shoulder', 'hip'], ref: 'bl1', label: 'Trunk turned since the start', max: 8, unit: '°' },
            { kind: 'toWater', pts: ['hip', 'ankleB'], label: 'Surface leg vs surface', max: 10, unit: '°' },
          ] },
      ],
    },
    {
      id: 'ballet', label: 'Ballet Leg', weight: 11, pose: 'ballet',
      cue: 'Capture the raised leg at its highest, straightest moment.',
      metrics: [
        { id: 'vertical',   label: 'Raised leg away from vertical', kind: 'toVertical', pts: ['hip', 'ankle'],             ideal: 0,   tol: TOL },
        { id: 'knee',       label: 'Raised knee extension',         kind: 'joint',      pts: ['hip', 'knee', 'ankle'],     ideal: 180, tol: TOL },
        { id: 'hipangle',   label: 'Leg-to-trunk angle',            kind: 'joint',      pts: ['shoulder', 'hip', 'ankle'], ideal: 90,  tol: TOL },
        { id: 'bodyline',   label: 'Trunk vs surface',              kind: 'toWater',    pts: ['shoulder', 'hip'],          ideal: 0,   tol: TOL },
        { id: 'surfaceleg', label: 'Surface leg alignment',         kind: 'toWater',    pts: ['hip', 'ankleB'],            ideal: 0,   tol: TOL },
      ],
      checks: [
        { text: 'Raised leg fully extended', drills: 'knee',
          tests: [{ kind: 'joint', pts: ['hip', 'knee', 'ankle'], label: 'Knee angle', min: 165, unit: '°' }] },
        { text: 'Toes pointed', drills: 'toes' },
        { text: 'Body and surface leg stay horizontally aligned', drills: 'bodyline',
          tests: [
            { kind: 'toWater', pts: ['shoulder', 'hip'], label: 'Trunk vs surface', max: 10, unit: '°' },
            { kind: 'toWater', pts: ['hip', 'ankleB'], label: 'Surface leg vs surface', max: 10, unit: '°' },
          ] },
        { text: 'Thigh stayed still while the knee straightened', drills: 'thigh',
          tests: [{ kind: 'segmentShift', pts: ['hip', 'knee'], ref: 'bk1', label: 'Thigh turned since Bent Knee · entry', max: 10, unit: '°' }] },
      ],
    },
    {
      id: 'bk2', label: 'Bent Knee · lowering', weight: 11, pose: 'bentknee',
      cue: 'Capture the bent knee on the way down, before the foot slides back.',
      metrics: [
        { id: 'bodyline',   label: 'Trunk vs surface',         kind: 'toWater',    pts: ['shoulder', 'hip'], ideal: 0, tol: TOL },
        { id: 'surfaceleg', label: 'Surface leg alignment',    kind: 'toWater',    pts: ['hip', 'ankleB'],  ideal: 0, tol: TOL },
        { id: 'thigh',      label: 'Thigh away from vertical', kind: 'toVertical', pts: ['hip', 'knee'],    ideal: 0, tol: TOL },
      ],
      checks: [
        { text: 'Thigh stays still as the knee bends', drills: 'thigh',
          tests: [{ kind: 'segmentShift', pts: ['hip', 'knee'], ref: 'ballet', label: 'Thigh turned since Ballet Leg', max: 10, unit: '°' }] },
        { text: 'Height kept; head and trunk stay still', drills: 'height',
          tests: [
            { kind: 'heightShift', pts: ['hip'], ref: 'ballet', label: 'Hip height change since Ballet Leg', max: 0.3, unit: ' shin' },
            { kind: 'heightShift', pts: ['shoulder'], ref: 'ballet', label: 'Shoulder height change since Ballet Leg', max: 0.3, unit: ' shin' },
            { kind: 'segmentShift', pts: ['shoulder', 'hip'], ref: 'ballet', label: 'Trunk turned since Ballet Leg', max: 8, unit: '°' },
          ] },
      ],
    },
    {
      id: 'bl2', label: 'Back Layout · finish', weight: 10.5, pose: 'layout',
      cue: 'Capture the finish, when both legs are extended and the feet join.',
      metrics: [
        { id: 'bodyline',   label: 'Trunk vs surface',      kind: 'toWater', pts: ['shoulder', 'hip'], ideal: 0, tol: TOL },
        { id: 'surfaceleg', label: 'Surface leg alignment', kind: 'toWater', pts: ['hip', 'ankleB'],  ideal: 0, tol: TOL },
      ],
      checks: [
        { text: 'Full extension as the feet join', drills: 'feet',
          tests: [
            { kind: 'joint', pts: ['hip', 'knee', 'ankle'], label: 'Knee angle', min: 165, unit: '°' },
            { kind: 'pointGap', pts: ['ankle', 'ankleB'], label: 'Gap between the feet', max: 0.35, unit: ' shin' },
          ] },
        { text: 'Finished in horizontal alignment', drills: 'bodyline',
          tests: [{ kind: 'toWater', pts: ['shoulder', 'ankle'], label: 'Shoulder-to-ankle line vs surface', max: 10, unit: '°' }] },
        { text: 'Controlled, even motion into the finish', drills: 'control' },
      ],
    },
  ],
  // Which drills help with which problem. Keys match metric ids and the
  // "drills" field of each coach's-eye check.
  drillsFor: {
    vertical:   ['wall-ballet-leg', 'ballet-leg-boards', 'seated-pike'],
    knee:       ['thigh-still', 'floor-ballet-leg'],
    hipangle:   ['layback-scull', 'seated-pike'],
    bodyline:   ['layout-boards', 'layout-blocks', 'plank'],
    surfaceleg: ['layout-boards', 'wall-ballet-leg'],
    thigh:      ['thigh-still', 'floor-rehearsal'],
    height:     ['layback-scull', 'dry-hips-wall'],
    feet:       ['toe-slide', 'layout-boards'],
    toes:       ['band-point'],
    toepath:    ['toe-slide'],
    control:    ['floor-rehearsal', 'ballet-laps'],
  },
};

// The drill library. Each video link starts at the moment the drill begins.
export const DRILLS = {
  'wall-ballet-leg': {
    name: 'Ballet leg at the wall', where: 'Pool', dose: '3–4 slow run-throughs per leg',
    how: 'Lie in a back layout with your feet against the pool wall. Go through the ballet leg while your upper body stays exactly where it is and your body stays one tight, straight line. The wall shows any drift.',
    video: { channel: 'Natsumi Coaching', id: '_fS01-_mLvI', start: 0 },
  },
  'thigh-still': {
    name: 'Thigh-still extensions', where: 'Pool', dose: '5 slow extensions per leg',
    how: 'From bent knee, keep the thigh exactly where it is and lift only the lower leg until it points straight up. Lower it back to bent knee the same way. Start at the wall, on slow counts.',
    video: { channel: 'Swim England', id: 'zht0xulr7Zc', start: 10 },
  },
  'layout-boards': {
    name: 'Layout hold on kickboards', where: 'Land', dose: '3 holds of 15–20 s',
    how: 'Lie on your back with your head on one kickboard and your feet on another. Lift your hips until you are one straight line, knees and feet extended, and hold.',
    video: { channel: 'The Online Synchro Coach', id: 'Flk-_pupvu0', start: 5 },
  },
  'ballet-leg-boards': {
    name: 'Ballet leg hold on kickboards', where: 'Land', dose: '3 holds of 15 s per leg',
    how: 'Head on one kickboard, the surface foot on another, hips lifted. Raise one leg to exactly 90° with knees extended and toes pointed, and hold without letting the hips sink.',
    video: { channel: 'The Online Synchro Coach', id: 'Flk-_pupvu0', start: 19 },
  },
  'layback-scull': {
    name: 'Layback sculling for height', where: 'Pool', dose: '4 holds of 15 s',
    how: 'Practise the scull that holds a ballet leg up: elbows bent, hands under the hips pressing the water down, so the hips rise and stay at the surface. Reaching toward your feet makes you pike.',
    video: { channel: 'Natsumi Coaching', id: 'CzYpbjrOTrc', start: 28 },
  },
  'ballet-laps': {
    name: 'Travelling ballet legs', where: 'Pool', dose: 'One length, alternating legs',
    how: 'Travel headfirst in a back layout. Lift into a ballet leg, return to layout, then do the other leg, one count per movement on an even beat, with a full layout in between.',
    video: { channel: 'Swim England', id: 'JdfNGxCfDwU', start: 5 },
  },
  'floor-ballet-leg': {
    name: 'Bridge with a ballet leg', where: 'Land', dose: '3 holds of 10 s per leg',
    how: 'Lie on your back with knees bent and lift your hips into a bridge. Raise one leg straight up and hold it still with the hips level, then lower the hips with control.',
    video: { channel: 'Natsumi Coaching', id: '5iBki3t56fU', start: 124 },
  },
  'layout-blocks': {
    name: 'Back layout on blocks', where: 'Land', dose: '3 holds of 20 s',
    how: 'Lie with your head and heels on blocks and lift your hips until your body is one flat line from ear to ankle. Hold it, then move to bent knee and back without the hips dropping.',
    video: { channel: 'Aquatica Synchro Club', id: 'I3KkBPRtVFI', start: 10 },
  },
  'plank': {
    name: 'Plank, then lift an arm and leg', where: 'Land', dose: '3 holds of 20–30 s',
    how: 'Hold one straight line from head to heels on your elbows. When that is steady, lift one arm and the opposite leg without the hips twisting or sagging.',
    video: { channel: 'Natsumi Coaching', id: '5iBki3t56fU', start: 180 },
  },
  'seated-pike': {
    name: 'Seated pike stretch', where: 'Land', dose: 'Hold 20 s, 2–3 times',
    how: 'Sit with legs together and straight, toes pointed, and reach toward your toes as far as you can with straight legs. Ease off if it causes sharp pain.',
    video: { channel: 'Natsumi Coaching', id: '-xOs_6QC9g8', start: 210 },
  },
  'floor-rehearsal': {
    name: 'Floor figure rehearsal', where: 'Land', dose: '3 slow run-throughs per leg',
    how: 'Lie on your back and move through back layout, bent knee, ballet leg, bent knee and back layout on slow, even counts. Keep the thigh still while the lower leg moves. Check from the side in a mirror or a phone video.',
    video: { channel: 'Natsumi Coaching', id: '5iBki3t56fU', start: 40 },
  },
  'band-point': {
    name: 'Band toe points', where: 'Land', dose: '2 sets of 15 per foot',
    how: 'Sit with legs straight and a resistance band under the ball of the foot. Point the toes down against the band, then return slowly. Keep the knee straight.',
    video: { channel: 'Natsumi Coaching', id: '-xOs_6QC9g8', start: 40 },
  },
  'toe-slide': {
    name: 'Toe slides', where: 'Land or pool', dose: '5 slow slides per leg',
    how: 'On your back, slide the big toe along the inside of the straight leg up to bent knee and back down, keeping contact the whole way.',
    video: { channel: 'Swim England', id: 'zht0xulr7Zc', start: 5 },
  },
  'dry-hips-wall': {
    name: 'Dry hips at the wall', where: 'Pool', dose: '3–4 run-throughs per leg',
    how: 'With your feet at the pool wall, go from back layout through bent knee to ballet leg and back while keeping both hips dry. The upper body stays still and the sculling stays easy.',
    video: { channel: 'The Online Synchro Coach', id: '0GZ-f-7S65E', start: 0 },
  },
};

// Coach's-eye "tests": when the needed points are marked, an item is measured
// instead of ticked by eye. Each test passes when its value is at most "max"
// (or at least "min"). "ref" compares with another saved checkpoint.
// "shin" units are lengths in shin lengths (knee to ankle), so they don't depend on how
// far the camera is. These limits are the prototype's practice estimates.

// The points each checkpoint needs (every point any of its metrics uses, plus the waterline).
export function pointsNeeded(checkpoint) {
  const names = new Set(['waterA', 'waterB']);
  for (const m of checkpoint.metrics) m.pts.forEach(p => names.add(p));
  return Object.keys(LANDMARKS).filter(n => names.has(n));
}

// Points a checkpoint can use: the needed ones plus optional ones that let
// coach's-eye items be measured automatically.
export function pointsUsed(checkpoint) {
  const names = new Set(pointsNeeded(checkpoint));
  for (const c of checkpoint.checks) for (const t of c.tests || []) t.pts.forEach(p => names.add(p));
  return Object.keys(LANDMARKS).filter(n => names.has(n));
}

// A link that opens a drill's video at the right second.
export function videoLink(drill) {
  return 'https://www.youtube.com/watch?v=' + drill.video.id + '&t=' + drill.video.start + 's';
}
