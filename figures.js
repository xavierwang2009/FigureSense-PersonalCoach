// figures.js
// The "rulebook": what FigureSense knows about each figure.
// Data only, no logic. Ballet Leg values come from the FigureSense prototype,
// which takes them from the World Aquatics figure manual (February 2026).
// Barracuda and Kip (added in Stage 2) follow the World Aquatics basic-position
// definitions; their checkpoint weights and limits are practice estimates.


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
  short: 'Ballet Leg',
  finder: 'ballet', // how "Find the moments" looks for the checkpoints (figure-assist.js)
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
        { text: 'Marked shoulder, hip, knee and ankle near the waterline', drills: 'height',
          tests: [{ kind: 'nearSurface', pts: ['shoulder', 'hip', 'knee', 'ankle'], label: 'Furthest point from the surface', max: 0.35, unit: ' shin' }] },
        { text: 'Shoulder-to-ankle line near horizontal', drills: 'bodyline',
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
        { text: 'Similar shoulder height and trunk angle to the start; surface leg near horizontal', drills: 'height',
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
        { text: 'Similar thigh angle to Bent Knee · entry', drills: 'thigh',
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
        { text: 'Similar thigh angle to Ballet Leg', drills: 'thigh',
          tests: [{ kind: 'segmentShift', pts: ['hip', 'knee'], ref: 'ballet', label: 'Thigh turned since Ballet Leg', max: 10, unit: '°' }] },
        { text: 'Similar hip height, shoulder height and trunk angle to Ballet Leg', drills: 'height',
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
        { text: 'Working knee extended and ankles close together', drills: 'feet',
          tests: [
            { kind: 'joint', pts: ['hip', 'knee', 'ankle'], label: 'Knee angle', min: 165, unit: '°' },
            { kind: 'pointGap', pts: ['ankle', 'ankleB'], label: 'Gap between the feet', max: 0.35, unit: ' shin' },
          ] },
        { text: 'Finished with shoulder-to-ankle line near horizontal', drills: 'bodyline',
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

// Point hints for figures where both legs move together (no "working leg").
const TOGETHER_HINTS = {
  hip:    'Hip joint nearest the camera',
  knee:   'Knee nearest the camera',
  ankle:  'Ankle nearest the camera',
  ankleB: 'Ankle of the other leg (the legs should be together)',
  shoulder: 'Shoulder nearest the camera (under the water in a vertical)',
};
const UNDERWATER = ' Much of the body is under the water here: mark the points you can see clearly and skip the rest.';

// The start of Barracuda and Kip: a reference back layout, not scored.
const layoutStart = (cue) => ({
  id: 'bl', label: 'Back Layout · start', weight: 0, pose: 'layout', cue,
  metrics: [
    { id: 'bodyline', label: 'Trunk vs surface', kind: 'toWater', pts: ['shoulder', 'hip'], ideal: 0, tol: TOL },
    { id: 'legline',  label: 'Legs vs surface',  kind: 'toWater', pts: ['hip', 'ankle'],    ideal: 0, tol: TOL },
  ],
  checks: [
    { text: 'Marked shoulder, hip, knee and ankle near the waterline', drills: 'bodyline',
      tests: [{ kind: 'nearSurface', pts: ['shoulder', 'hip', 'knee', 'ankle'], label: 'Furthest point from the surface', max: 0.35, unit: ' shin' }] },
    { text: 'Shoulder-to-ankle line near horizontal', drills: 'bodyline',
      tests: [{ kind: 'toWater', pts: ['shoulder', 'ankle'], label: 'Shoulder-to-ankle line vs surface', max: 10, unit: '°' }] },
  ],
});

// The vertical descent that ends both figures.
const descent = (ref, refLabel) => ({
  id: 'descent', label: 'Vertical Descent', weight: 8, pose: 'descent',
  cue: 'Capture the middle of the descent, when the legs are about halfway down.',
  metrics: [
    { id: 'legsvertical', label: 'Legs away from vertical', kind: 'toVertical', pts: ['hip', 'ankle'],         ideal: 0,   tol: TOL },
    { id: 'knee',         label: 'Knee extension',          kind: 'joint',      pts: ['hip', 'knee', 'ankle'], ideal: 180, tol: TOL },
  ],
  checks: [
    { text: 'Similar leg angle to the vertical before it', drills: 'legsvertical',
      tests: [{ kind: 'segmentShift', pts: ['hip', 'ankle'], ref, label: `Legs turned since ${refLabel}`, max: 10, unit: '°' }] },
    { text: 'Ankles close together', drills: 'together',
      tests: [{ kind: 'pointGap', pts: ['ankle', 'ankleB'], label: 'Gap between the feet', max: 0.35, unit: ' shin' }] },
    { text: 'Steady tempo until the toes are under the water', drills: 'tempo' },
  ],
});

export const BARRACUDA = {
  number: '301',
  name: 'Barracuda',
  short: 'Barracuda',
  finder: 'barracuda',
  dd: 1.8,         // the team's figure sheet (Intermediate and 12 & Under)
  totalWeight: 32,   // practice weights: Back Pike 10, Vertical 14, Descent 8
  hints: TOGETHER_HINTS,
  summary: 'Begin in Back Layout. Raise the legs to vertical as the body sinks into a Back Pike, toes just under the surface. ' +
           'Thrust up into a Vertical as high as possible, then do a Vertical Descent at the same tempo as the thrust.',
  checkpoints: [
    layoutStart('Capture the starting back layout, before the legs start to lift.'),
    {
      id: 'pike', label: 'Back Pike', weight: 10, pose: 'backpike',
      cue: 'Capture the back pike just before the thrust: legs straight up, toes just under the surface.' + UNDERWATER,
      metrics: [
        { id: 'legsvertical', label: 'Legs away from vertical', kind: 'toVertical', pts: ['hip', 'ankle'],         ideal: 0,   tol: TOL },
        { id: 'knee',         label: 'Knee extension',          kind: 'joint',      pts: ['hip', 'knee', 'ankle'], ideal: 180, tol: TOL },
      ],
      checks: [
        { text: 'Shoulder–hip–ankle angle 45° or less (tight pike)', drills: 'pikeangle',
          tests: [{ kind: 'joint', pts: ['shoulder', 'hip', 'ankle'], label: 'Hip angle', max: 45, unit: '°' }] },
        { text: 'Ankle near the waterline (check toe depth by eye)', drills: 'pikeangle',
          tests: [{ kind: 'nearSurface', pts: ['ankle'], label: 'Ankle distance from the surface', max: 0.5, unit: ' shin' }] },
        { text: 'Ankles close together', drills: 'together',
          tests: [{ kind: 'pointGap', pts: ['ankle', 'ankleB'], label: 'Gap between the feet', max: 0.35, unit: ' shin' }] },
      ],
    },
    {
      id: 'vertical', label: 'Vertical · highest point', weight: 14, pose: 'vertical',
      cue: 'Capture the top of the thrust, when the body is highest out of the water.',
      metrics: [
        { id: 'legsvertical', label: 'Legs away from vertical', kind: 'toVertical', pts: ['hip', 'ankle'],         ideal: 0,   tol: TOL },
        { id: 'knee',         label: 'Knee extension',          kind: 'joint',      pts: ['hip', 'knee', 'ankle'], ideal: 180, tol: TOL },
      ],
      checks: [
        { text: 'Hip at or above the waterline (high thrust)', drills: 'height',
          tests: [{ kind: 'heightOf', pts: ['hip'], label: 'Hip height above the surface', min: 0, unit: ' shin' }] },
        { text: 'Shoulder-to-ankle line near vertical', drills: 'alignment',
          tests: [{ kind: 'toVertical', pts: ['shoulder', 'ankle'], label: 'Shoulder-to-ankle line vs vertical', max: 10, unit: '°' }] },
        { text: 'Ankles close together', drills: 'together',
          tests: [{ kind: 'pointGap', pts: ['ankle', 'ankleB'], label: 'Gap between the feet', max: 0.35, unit: ' shin' }] },
        { text: 'Toes pointed', drills: 'toes' },
      ],
    },
    descent('vertical', 'the highest point'),
  ],
  drillsFor: {
    bodyline:     ['layout-boards', 'layout-blocks', 'plank'],
    legline:      ['layout-boards', 'layout-blocks'],
    legsvertical: ['vertical-hang', 'wall-vertical', 'pike-setup'],
    knee:         ['vertical-hang', 'band-point'],
    pikeangle:    ['roll-down', 'pike-setup', 'seated-pike'],
    height:       ['thrust-ladder', 'build-height', 'roll-down'],
    alignment:    ['wall-vertical', 'vertical-hang', 'core-pilates'],
    together:     ['vertical-hang', 'band-point'],
    toes:         ['band-point'],
    tempo:        ['thrust-ladder', 'build-height'],
  },
};

export const KIP = {
  number: '311',
  name: 'Kip',
  short: 'Kip',
  finder: 'kip',
  dd: 1.6,
  totalWeight: 32,   // practice weights: Tuck 10, Vertical 14, Descent 8
  hints: TOGETHER_HINTS,
  summary: 'Begin in Back Layout. Do a partial back somersault in a tuck until the shins are perpendicular to the surface. ' +
           'Unroll the trunk as the legs straighten to a Vertical, then do a Vertical Descent.',
  checkpoints: [
    layoutStart('Capture the starting back layout, before the knees start to draw in.'),
    {
      id: 'tuck', label: 'Back Tuck · shins vertical', weight: 10, pose: 'tuck',
      cue: 'Capture the tuck when the shins point straight up, just before the legs start to extend.' + UNDERWATER,
      metrics: [
        { id: 'shins', label: 'Shins away from vertical', kind: 'toVertical', pts: ['knee', 'ankle'],         ideal: 0,  tol: TOL },
        { id: 'tuck',  label: 'Knee bend (90° or tighter)', kind: 'joint', atMost: true, pts: ['hip', 'knee', 'ankle'], ideal: 90, tol: TOL },
      ],
      checks: [
        { text: 'Ankles close together', drills: 'together',
          tests: [{ kind: 'pointGap', pts: ['ankle', 'ankleB'], label: 'Gap between the feet', max: 0.35, unit: ' shin' }] },
        { text: 'Shoulder–hip–knee angle 60° or less (knees drawn in)', drills: 'tuck',
          tests: [{ kind: 'joint', pts: ['shoulder', 'hip', 'knee'], label: 'Hip angle', max: 60, unit: '°' }] },
        { text: 'Rolls straight through without pausing', drills: 'tempo' },
      ],
    },
    {
      id: 'vertical', label: 'Vertical', weight: 14, pose: 'vertical',
      cue: 'Capture the vertical at its highest, after the legs have fully straightened.',
      metrics: [
        { id: 'legsvertical', label: 'Legs away from vertical', kind: 'toVertical', pts: ['hip', 'ankle'],         ideal: 0,   tol: TOL },
        { id: 'knee',         label: 'Knee extension',          kind: 'joint',      pts: ['hip', 'knee', 'ankle'], ideal: 180, tol: TOL },
      ],
      checks: [
        { text: 'Shoulder-to-ankle line near vertical', drills: 'alignment',
          tests: [{ kind: 'toVertical', pts: ['shoulder', 'ankle'], label: 'Shoulder-to-ankle line vs vertical', max: 10, unit: '°' }] },
        { text: 'Ankles close together', drills: 'together',
          tests: [{ kind: 'pointGap', pts: ['ankle', 'ankleB'], label: 'Gap between the feet', max: 0.35, unit: ' shin' }] },
        { text: 'Knee at or above the waterline', drills: 'height',
          tests: [{ kind: 'heightOf', pts: ['knee'], label: 'Knee height above the surface', min: 0, unit: ' shin' }] },
        { text: 'Toes pointed', drills: 'toes' },
      ],
    },
    descent('vertical', 'the Vertical'),
  ],
  drillsFor: {
    bodyline:     ['layout-boards', 'layout-blocks', 'plank'],
    legline:      ['layout-boards', 'layout-blocks'],
    shins:        ['tub-roll', 'floor-kip'],
    tuck:         ['tub-roll', 'floor-kip'],
    legsvertical: ['vertical-hang', 'wall-vertical'],
    knee:         ['vertical-hang', 'band-point'],
    height:       ['build-height', 'vertical-hang'],
    alignment:    ['wall-vertical', 'vertical-hang', 'core-pilates'],
    together:     ['vertical-hang', 'band-point'],
    toes:         ['band-point'],
    tempo:        ['tub-roll', 'build-height'],
  },
};

// Every figure the app offers, in the order shown in the picker.
export const FIGURES = [BALLET_LEG, BARRACUDA, KIP];

// Swimmer groups and their figures, from the team's figure sheet (as in the FigureSense prototype).
// "number" matches a figure above when FigureSense Simple can review it; the rest are listed
// so swimmers see their whole sheet, but cannot be reviewed here yet.
export const GROUPS = [
  { id: 'novice', label: 'Novice', sections: [{ label: null, figures: [
    { number: '100', name: 'Bent Knee, Alternate' }, { number: '201', name: 'Dolphin' },
    { number: '316', name: 'Kipnus' }, { number: '358', name: 'Snapping Turtle' }] }] },
  { id: 'intermediate', label: 'Intermediate', sections: [
    { label: 'Compulsory', figures: [{ number: '101', name: 'Ballet Leg, Single' }, { number: '301', name: 'Barracuda' }] },
    { label: 'Selection group 1', figures: [{ number: '360', name: 'Walkover, Front' }, { number: '318', name: 'Kip, Bent Knee' }] },
    { label: 'Selection group 2', figures: [{ number: '348', name: 'Tower' }, { number: '420', name: 'Walkover, Back' }] }] },
  { id: 'u12', label: '12 & Under', sections: [
    { label: 'Compulsory', figures: [{ number: '106', name: 'Ballet Leg, Straight' }, { number: '301', name: 'Barracuda' }] },
    { label: 'Optional group 1', figures: [{ number: '359', name: 'Front Ariana' }, { number: '348', name: 'Tower' }] },
    { label: 'Optional group 2', figures: [{ number: '363', name: 'Water Drop' }, { number: '401', name: 'Swordfish' }] },
    { label: 'Optional group 3', figures: [{ number: '311', name: 'Kip' }, { number: '227d', name: 'Swanita, Spinning 180' }] }] },
  { id: 'youth', label: 'Youth', sections: [
    { label: 'Section A', figures: [{ number: '307e', name: 'Flying Fish, Spinning 360' }, { number: '437', name: 'Cyclone, Open 180' },
      { number: '308h', name: 'Barracuda Airborne Split, Spin Up 180' }, { number: '407', name: 'Swordfish Straight Leg Ariana' }] },
    { label: 'Section B', figures: [{ number: '356f', name: 'Whip, Continuous Spin 720' }, { number: '441', name: 'Saturn' },
      { number: '352', name: 'Venus' }, { number: '240i', name: 'Albatross, Spin Up 360' }] },
    { label: 'Section C', figures: [{ number: '140j', name: 'Flamingo, Bent Knee, Combined Spin 360 + 360' }, { number: '421', name: 'Walkover, Back Closing 360' },
      { number: '440d', name: 'Ipanema, Spinning 180' }, { number: '154f', name: 'London, Continuous Spin 720' }] }] },
];

// The drill library. Each video link starts at the moment the drill begins; "end" is where
// the drill's part of the video stops (the same segments the FigureSense prototype plays).
// Drills without a video link to a written guide instead ("guide").
export const DRILLS = {
  'wall-ballet-leg': {
    name: 'Ballet leg at the wall', where: 'Pool', dose: '3–4 slow run-throughs per leg',
    how: 'Lie in a back layout with your feet against the pool wall. Go through the ballet leg while your upper body stays exactly where it is and your body stays one tight, straight line. The wall shows any drift.',
    video: { channel: 'Natsumi Coaching', id: '_fS01-_mLvI', start: 0 , end: 31, title: 'Wall ballet leg' },
  },
  'thigh-still': {
    name: 'Thigh-still extensions', where: 'Pool', dose: '5 slow extensions per leg',
    how: 'From bent knee, keep the thigh exactly where it is and lift only the lower leg until it points straight up. Lower it back to bent knee the same way. Start at the wall, on slow counts.',
    video: { channel: 'Swim England', id: 'zht0xulr7Zc', start: 10 , end: 22, title: 'Ballet leg (Figure 101)' },
  },
  'layout-boards': {
    name: 'Layout hold on kickboards', where: 'Land', dose: '3 holds of 15–20 s',
    how: 'Lie on your back with your head on one kickboard and your feet on another. Lift your hips until you are one straight line, knees and feet extended, and hold.',
    video: { channel: 'The Online Synchro Coach', id: 'Flk-_pupvu0', start: 5 , end: 10, title: 'Layout, sailboat and ballet leg drill on kickboards' },
  },
  'ballet-leg-boards': {
    name: 'Ballet leg hold on kickboards', where: 'Land', dose: '3 holds of 15 s per leg',
    how: 'Head on one kickboard, the surface foot on another, hips lifted. Raise one leg to exactly 90° with knees extended and toes pointed, and hold without letting the hips sink.',
    video: { channel: 'The Online Synchro Coach', id: 'Flk-_pupvu0', start: 19 , end: 31, title: 'Layout, sailboat and ballet leg drill on kickboards' },
  },
  'layback-scull': {
    name: 'Layback sculling for height', where: 'Pool', dose: '4 holds of 15 s',
    how: 'Practise the scull that holds a ballet leg up: elbows bent, hands under the hips pressing the water down, so the hips rise and stay at the surface. Reaching toward your feet makes you pike.',
    video: { channel: 'Natsumi Coaching', id: 'CzYpbjrOTrc', start: 28 , end: 100, title: 'Layback Sculling for Ballet Legs' },
  },
  'ballet-laps': {
    name: 'Travelling ballet legs', where: 'Pool', dose: 'One length, alternating legs',
    how: 'Travel headfirst in a back layout. Lift into a ballet leg, return to layout, then do the other leg, one count per movement on an even beat, with a full layout in between.',
    video: { channel: 'Swim England', id: 'JdfNGxCfDwU', start: 5 , end: 18, title: 'Alternating ballet legs while travelling head first' },
  },
  'floor-ballet-leg': {
    name: 'Bridge with a ballet leg', where: 'Land', dose: '3 holds of 10 s per leg',
    how: 'Lie on your back with knees bent and lift your hips into a bridge. Raise one leg straight up and hold it still with the hips level, then lower the hips with control.',
    video: { channel: 'Natsumi Coaching', id: '5iBki3t56fU', start: 124 , end: 178, title: 'Training for Ballet leg' },
  },
  'layout-blocks': {
    name: 'Back layout on blocks', where: 'Land', dose: '3 holds of 20 s',
    how: 'Lie with your head and heels on blocks and lift your hips until your body is one flat line from ear to ankle. Hold it, then move to bent knee and back without the hips dropping.',
    video: { channel: 'Aquatica Synchro Club', id: 'I3KkBPRtVFI', start: 10 , end: 45, title: 'Practicing Back Layout Position on Land' },
  },
  'plank': {
    name: 'Plank, then lift an arm and leg', where: 'Land', dose: '3 holds of 20–30 s',
    how: 'Hold one straight line from head to heels on your elbows. When that is steady, lift one arm and the opposite leg without the hips twisting or sagging.',
    video: { channel: 'Natsumi Coaching', id: '5iBki3t56fU', start: 180 , end: 252, title: 'Training for Ballet leg' },
  },
  'seated-pike': {
    name: 'Seated pike stretch', where: 'Land', dose: 'Hold 20 s, 2–3 times',
    how: 'Sit with legs together and straight, toes pointed, and reach toward your toes as far as you can with straight legs. Ease off if it causes sharp pain.',
    video: { channel: 'Natsumi Coaching', id: '-xOs_6QC9g8', start: 210 , end: 258, title: 'How to Improve Your Pointed Toes' },
  },
  'floor-rehearsal': {
    name: 'Floor figure rehearsal', where: 'Land', dose: '3 slow run-throughs per leg',
    how: 'Lie on your back and move through back layout, bent knee, ballet leg, bent knee and back layout on slow, even counts. Keep the thigh still while the lower leg moves. Check from the side in a mirror or a phone video.',
    video: { channel: 'Natsumi Coaching', id: '5iBki3t56fU', start: 40 , end: 124, title: 'Training for Ballet leg' },
  },
  'band-point': {
    name: 'Band toe points', where: 'Land', dose: '2 sets of 15 per foot',
    how: 'Sit with legs straight and a resistance band under the ball of the foot. Point the toes down against the band, then return slowly. Keep the knee straight.',
    video: { channel: 'Natsumi Coaching', id: '-xOs_6QC9g8', start: 40 , end: 145, title: 'How to Improve Your Pointed Toes' },
  },
  'toe-slide': {
    name: 'Toe slides', where: 'Land or pool', dose: '5 slow slides per leg',
    how: 'On your back, slide the big toe along the inside of the straight leg up to bent knee and back down, keeping contact the whole way.',
    video: { channel: 'Swim England', id: 'zht0xulr7Zc', start: 5 , end: 27, title: 'Ballet leg (Figure 101)' },
  },
  'dry-hips-wall': {
    name: 'Dry hips at the wall', where: 'Pool', dose: '3–4 run-throughs per leg',
    how: 'With your feet at the pool wall, go from back layout through bent knee to ballet leg and back while keeping both hips dry. The upper body stays still and the sculling stays easy.',
    video: { channel: 'The Online Synchro Coach', id: '0GZ-f-7S65E', start: 0 , end: 17, title: 'Ballet Leg Drill' },
  },
  // ---- Stage 2: Barracuda and Kip drills. Summarised from SwimOutlet's written guides.
  'roll-down': {
    name: 'Seated pike roll-down', where: 'Land', dose: '5 slow roll-downs',
    how: 'Sit with legs straight and together, fold forward until your chest is close to your legs, then roll back slowly one vertebra at a time until your shoulders and head reach the floor. The unroll is the same movement as the thrust.',
    guide: { name: 'SwimOutlet: Barracuda thrust', url: 'https://www.swimoutlet.com/blogs/guides/how-to-do-a-barracuda-thrust-in-synchronized-swimming' },
  },
  'pike-setup': {
    name: 'Back pike set-up holds', where: 'Pool', dose: '3 short holds, with a coach watching',
    how: 'Sink into a back pike with the toes about 15 cm under the surface. Keep the trunk close to the legs, legs straight up, toes pointed, and scull with palms down near the ankles. Hold briefly, then come up.',
    guide: { name: 'SwimOutlet: Barracuda thrust', url: 'https://www.swimoutlet.com/blogs/guides/how-to-do-a-barracuda-thrust-in-synchronized-swimming' },
  },
  'thrust-ladder': {
    name: 'Thrust height ladder', where: 'Pool', dose: '4–6 thrusts, rest between',
    how: 'Unroll fast under the legs as the toes reach the surface. First aim to bring the belly button to the surface, then the ribs. Stay vertical with feet together and sink at the same speed; consistency matters more than height.',
    guide: { name: 'SwimOutlet: Barracuda thrust', url: 'https://www.swimoutlet.com/blogs/guides/how-to-do-a-barracuda-thrust-in-synchronized-swimming' },
  },
  'vertical-hang': {
    name: 'Vertical balance hang', where: 'Pool', dose: '3 holds of up to 20 s',
    how: 'Hold an upside-down vertical at your natural floating height and find the balance point where you barely need your hands. Keep the head in line with the body, not tucked.',
    guide: { name: 'SwimOutlet: Vertical alignment', url: 'https://www.swimoutlet.com/blogs/guides/how-to-find-vertical-alignment-in-synchronized-swimming' },
  },
  'wall-vertical': {
    name: 'Vertical against the wall', where: 'Pool', dose: '3–4 holds of 15 s',
    how: 'With your back against the pool wall and hands on the gutter, press your body and the back of your head flat against the wall. A partner checks the line from the side.',
    guide: { name: 'SwimOutlet: Vertical alignment', url: 'https://www.swimoutlet.com/blogs/guides/how-to-find-vertical-alignment-in-synchronized-swimming' },
  },
  'build-height': {
    name: 'Add height slowly', where: 'Pool', dose: '3–4 rises',
    how: 'Start just under the water in your straightest vertical and rise slowly by sculling harder. When the shape starts to break, stop and hold there. Notice which part drifts first and work on it.',
    guide: { name: 'SwimOutlet: Vertical alignment', url: 'https://www.swimoutlet.com/blogs/guides/how-to-find-vertical-alignment-in-synchronized-swimming' },
  },
  'core-pilates': {
    name: 'Core strength (Pilates mat work)', where: 'Land', dose: '10 minutes, 3 times a week',
    how: 'Mat exercises for the abdominals, back and shoulders, such as hollow holds and planks, help you hold a straight vertical for longer.',
    guide: { name: 'SwimOutlet: Vertical alignment', url: 'https://www.swimoutlet.com/blogs/guides/how-to-find-vertical-alignment-in-synchronized-swimming' },
  },
  'tub-roll': {
    name: 'Tub roll-through', where: 'Pool', dose: '4–5 slow roll-throughs',
    how: 'From a back layout, draw the knees in with the shins sliding along the surface, then roll straight through into the tuck without stopping. Take the last breath just before the knees reach the chin.',
    guide: { name: 'SwimOutlet: Kipnus and Kip', url: 'https://www.swimoutlet.com/guides/how-to-do-the-kipnus-kip-bent-knee-in-synchronized-swimming' },
  },
  'floor-kip': {
    name: 'Floor kip shape', where: 'Land', dose: '5 slow repeats',
    how: 'Lie on your back, pull the knees in to a tight tuck with shins pointing straight up, then roll back onto the shoulders and straighten the legs up to vertical. Check the shapes from the side in a phone video.',
    guide: { name: 'SwimOutlet: Kipnus and Kip', url: 'https://www.swimoutlet.com/guides/how-to-do-the-kipnus-kip-bent-knee-in-synchronized-swimming' },
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

// A link that opens a drill's video at the right second, or its written guide.
export function videoLink(drill) {
  if (!drill.video) return drill.guide.url;
  return 'https://www.youtube.com/watch?v=' + drill.video.id + '&t=' + drill.video.start + 's';
}

// The words for that link.
export function linkText(drill) {
  return drill.video ? `Watch the demo (${drill.video.channel})` : `Read the guide (${drill.guide.name})`;
}

// The hint for a point on this figure (some figures word the leg points differently).
export function hintFor(figure, name) {
  return (figure.hints && figure.hints[name]) || LANDMARKS[name].hint;
}
