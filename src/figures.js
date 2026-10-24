/**
 * Novice figure library for FigureSense.
 *
 * Source: World Aquatics / USA Artistic Swimming Figures Manual 2022-2025 review
 * sheets for figures 100, 201, 316 and 358. Text is paraphrased for coaching use;
 * the manual itself is not redistributed. Verify the edition in force for your meet.
 *
 * Scale note: distances are reported in "shin lengths" (knee-to-ankle of the marked
 * leg) because an above-water camera has no absolute scale. Inch thresholds printed
 * in the manual are converted with 1 shin length ~= 16 in, which is an approximation.
 */

const TRAVEL_GUIDE = [
  ['Small deduction 0.1', 'Minimal travel, or minimal lack of required travel'],
  ['Medium deduction 0.3', 'Obvious travel in one transition, and/or travel in several transitions'],
  ['Large deduction 0.5', 'Obvious travel in two or more transitions, and/or travel throughout']
];

const ANGLE_SCALE = [
  ['Small deviation', '1-15 degrees', '0.2'],
  ['Medium deviation', '16-30 degrees', '0.5'],
  ['Large deviation', '31 degrees or more', '1.0']
];

/** Landmark catalogue. `key` is used by metric specs. */
export const LANDMARKS = {
  waterA: { label: 'Waterline · left', hint: 'A point on the flat water surface to the swimmer\'s left', tone: 'water' },
  waterB: { label: 'Waterline · right', hint: 'A second surface point, well separated from the first', tone: 'water' },
  head: { label: 'Head', hint: 'Crown of the head', tone: 'body' },
  shoulder: { label: 'Shoulder', hint: 'Shoulder joint nearest the camera', tone: 'body' },
  hip: { label: 'Hip', hint: 'Hip joint - skip it if it is under water', tone: 'body' },
  knee: { label: 'Knee', hint: 'Knee of the working leg', tone: 'body' },
  ankle: { label: 'Ankle', hint: 'Ankle of the working leg', tone: 'body' },
  toe: { label: 'Toe', hint: 'Tip of the pointed toe', tone: 'accent' },
  kneeB: { label: 'Knee · other leg', hint: 'Knee of the second leg', tone: 'alt' },
  ankleB: { label: 'Ankle · other leg', hint: 'Ankle of the second leg', tone: 'alt' },
  toeB: { label: 'Toe · other leg', hint: 'Toe tip of the second leg', tone: 'alt' },
  crotch: { label: 'Crotch', hint: 'Height-chart anchor: where the legs meet', tone: 'accent' },
  kneecap: { label: 'Kneecap', hint: 'Height-chart anchor: centre of the kneecap', tone: 'accent' }
};

/**
 * Practice drills for the Ballet Leg plan, paraphrased from the linked coaching sources.
 * `sourced` marks a dose given by the source; otherwise the dose is a starting suggestion.
 */
export const DRILLS = {
 "wall-ballet-leg": {
  "name": "Ballet leg at the wall",
  "where": "Pool",
  "how": "Lie in a back layout with your feet against the pool wall. Go through the ballet leg while your upper body stays exactly where it is and your body stays one tight, straight line; the wall shows any drift.",
  "dose": "3–4 slow run-throughs per leg",
  "source": {
   "channel": "Natsumi Coaching",
   "title": "Wall ballet leg",
   "video": "_fS01-_mLvI",
   "start": 0,
   "end": 31,
   "url": "https://www.youtube.com/watch?v=_fS01-_mLvI&t=0s"
  },
  "sourced": false
 },
 "thigh-still": {
  "name": "Thigh-still extensions",
  "where": "Pool",
  "how": "From bent knee, keep the thigh exactly where it is and lift only the lower leg until it points straight up. Lower it back to bent knee the same way, thigh still. Start at the wall, on slow counts.",
  "dose": "5 slow extensions per leg",
  "source": {
   "channel": "Swim England",
   "title": "Ballet leg (Figure 101)",
   "video": "zht0xulr7Zc",
   "start": 10,
   "end": 22,
   "url": "https://www.youtube.com/watch?v=zht0xulr7Zc&t=10s"
  },
  "sourced": false
 },
 "layout-boards": {
  "name": "Layout hold on kickboards",
  "where": "Land",
  "how": "Lie on your back with your head on one kickboard and your feet on another. Lift your hips until you are one straight line, knees and feet extended and legs rolled in, and hold.",
  "dose": "3 holds of 15–20 s",
  "source": {
   "channel": "The Online Synchro Coach",
   "title": "Layout, sailboat and ballet leg drill on kickboards",
   "video": "Flk-_pupvu0",
   "start": 5,
   "end": 10,
   "url": "https://www.youtube.com/watch?v=Flk-_pupvu0&t=5s"
  },
  "sourced": false
 },
 "dry-hips-wall": {
  "name": "Dry hips at the wall",
  "where": "Pool",
  "how": "With your feet at the pool wall, go from back layout through bent knee to ballet leg and back while keeping both hips dry. Watch that the upper body stays still and the sculling stays easy.",
  "dose": "3–4 run-throughs per leg",
  "source": {
   "channel": "The Online Synchro Coach",
   "title": "Ballet Leg Drill",
   "video": "0GZ-f-7S65E",
   "start": 0,
   "end": 17,
   "url": "https://www.youtube.com/watch?v=0GZ-f-7S65E&t=0s"
  },
  "sourced": false
 },
 "layback-scull": {
  "name": "Layback sculling for height",
  "where": "Pool",
  "how": "Practise the scull that holds a ballet leg up: elbows bent, hands under the hips pressing the water down, so the hips rise and stay at the surface. Reaching toward your feet makes you pike.",
  "dose": "4 holds of 15 s",
  "source": {
   "channel": "Natsumi Coaching",
   "title": "Layback Sculling for Ballet Legs",
   "video": "CzYpbjrOTrc",
   "start": 28,
   "end": 100,
   "url": "https://www.youtube.com/watch?v=CzYpbjrOTrc&t=28s"
  },
  "sourced": false
 },
 "ballet-laps": {
  "name": "Travelling ballet legs",
  "where": "Pool",
  "how": "Travel headfirst in a back layout with standard sculling. Lift into a ballet leg, return to layout, then do the other leg, one count per movement on an even beat, with a full layout in between.",
  "dose": "One length, alternating legs",
  "source": {
   "channel": "Swim England",
   "title": "Alternating ballet legs while travelling head first",
   "video": "JdfNGxCfDwU",
   "start": 5,
   "end": 18,
   "url": "https://www.youtube.com/watch?v=JdfNGxCfDwU&t=5s"
  },
  "sourced": false
 },
 "floor-ballet-leg": {
  "name": "Bridge with a ballet leg",
  "where": "Land",
  "how": "Lie on your back with knees bent and lift your hips into a bridge. Raise one leg straight up and hold it still with the hips level, then lower the hips with control.",
  "dose": "3 holds of 10 s per leg",
  "source": {
   "channel": "Natsumi Coaching",
   "title": "Training for Ballet leg",
   "video": "5iBki3t56fU",
   "start": 124,
   "end": 178,
   "url": "https://www.youtube.com/watch?v=5iBki3t56fU&t=124s"
  },
  "sourced": false
 },
 "ballet-leg-boards": {
  "name": "Ballet leg hold on kickboards",
  "where": "Land",
  "how": "Head on one kickboard, the surface foot on another, hips lifted. Raise one leg to an exact 90° with knees extended and toes pointed, and hold without letting the hips sink.",
  "dose": "3 holds of 15 s per leg",
  "source": {
   "channel": "The Online Synchro Coach",
   "title": "Layout, sailboat and ballet leg drill on kickboards",
   "video": "Flk-_pupvu0",
   "start": 19,
   "end": 31,
   "url": "https://www.youtube.com/watch?v=Flk-_pupvu0&t=19s"
  },
  "sourced": false
 },
 "layout-blocks": {
  "name": "Back layout on blocks",
  "where": "Land",
  "how": "Lie with your head and heels on blocks and lift your hips until your body is one flat line from ear to ankle. Hold it, then move to bent knee and back without the hips dropping.",
  "dose": "3 holds of 20 s",
  "source": {
   "channel": "Aquatica Synchro Club",
   "title": "Practicing Back Layout Position on Land",
   "video": "I3KkBPRtVFI",
   "start": 10,
   "end": 45,
   "url": "https://www.youtube.com/watch?v=I3KkBPRtVFI&t=10s"
  },
  "sourced": false
 },
 "plank": {
  "name": "Plank, then lift an arm and leg",
  "where": "Land",
  "how": "Hold one straight line from head to heels on your elbows. When that is steady, lift one arm and the opposite leg without the hips twisting or sagging.",
  "dose": "3 holds of 20–30 s",
  "source": {
   "channel": "Natsumi Coaching",
   "title": "Training for Ballet leg",
   "video": "5iBki3t56fU",
   "start": 180,
   "end": 252,
   "url": "https://www.youtube.com/watch?v=5iBki3t56fU&t=180s"
  },
  "sourced": false
 },
 "seated-pike": {
  "name": "Seated pike stretch",
  "where": "Land",
  "how": "Sit with legs together and straight, toes pointed, and reach toward your toes as far as you can with straight legs. Ease off if it causes sharp pain.",
  "dose": "Hold 20 s, 2–3 times",
  "source": {
   "channel": "Natsumi Coaching",
   "title": "How to Improve Your Pointed Toes",
   "video": "-xOs_6QC9g8",
   "start": 210,
   "end": 258,
   "url": "https://www.youtube.com/watch?v=-xOs_6QC9g8&t=210s"
  },
  "sourced": false
 },
 "floor-rehearsal": {
  "name": "Floor figure rehearsal",
  "where": "Land",
  "how": "Lie on your back and move through back layout, bent knee, ballet leg, bent knee and back layout on slow, even counts. Keep the thigh still while the lower leg moves; check from the side in a mirror or on a phone video.",
  "dose": "3 slow run-throughs per leg",
  "source": {
   "channel": "Natsumi Coaching",
   "title": "Training for Ballet leg",
   "video": "5iBki3t56fU",
   "start": 40,
   "end": 124,
   "url": "https://www.youtube.com/watch?v=5iBki3t56fU&t=40s"
  },
  "sourced": false
 },
 "band-point": {
  "name": "Band toe points",
  "where": "Land",
  "how": "Sit with legs straight and a resistance band under the ball of the foot. Point the toes down against the band, then return slowly. Keep the knee straight.",
  "dose": "2 sets of 15 per foot",
  "source": {
   "channel": "Natsumi Coaching",
   "title": "How to Improve Your Pointed Toes",
   "video": "-xOs_6QC9g8",
   "start": 40,
   "end": 145,
   "url": "https://www.youtube.com/watch?v=-xOs_6QC9g8&t=40s"
  },
  "sourced": false
 },
 "toe-slide": {
  "name": "Toe slides",
  "where": "Land or pool",
  "how": "On your back, slide the big toe along the inside of the straight leg up to bent knee and back down, keeping contact the whole way.",
  "dose": "5 slow slides per leg",
  "source": {
   "channel": "Swim England",
   "title": "Ballet leg (Figure 101)",
   "video": "zht0xulr7Zc",
   "start": 5,
   "end": 27,
   "url": "https://www.youtube.com/watch?v=zht0xulr7Zc&t=5s"
  },
  "sourced": false
 }
};

export const FIGURES = [
  {
    id: 'f100',
    number: '100',
    name: 'Bent Knee, Alternate',
    dd: 1.1,
    accent: '#4ad6c0',
    tagline: 'Control and stillness. Two legs, one unchanged body line.',
    description:
      'From a Back Layout Position, with one leg remaining extended at the surface, the toe of the other leg is drawn along the inside of the extended leg until the thigh is vertical to assume a Bent Knee Back Layout Position. The toe moves back down until a Back Layout Position is assumed. The action is then repeated with the opposite leg.',
    totalNV: 42.0,
    positions: [
      { label: 'Back Layout', nv: null, pv: null },
      { label: 'Bent Knee Back Layout', nv: 10.5, pv: 2.5 },
      { label: 'Back Layout', nv: 10.5, pv: 2.5 },
      { label: 'Bent Knee Back Layout', nv: 10.5, pv: 2.5 },
      { label: 'Back Layout', nv: 10.5, pv: 2.5 }
    ],
    checkpoints: [
      {
        id: 'bl1',
        label: 'Back Layout · start',
        cue: 'Freeze the still starting layout before any leg movement.',
        art: 'backLayout',
        signature: 'flatSurface',
        weight: 0,
        landmarks: ['waterA', 'waterB', 'shoulder', 'hip', 'knee', 'ankle'],
        metrics: [
          { id: 'bodyline', kind: 'segmentToWater', label: 'Body line vs surface', pts: ['shoulder', 'ankle'], ideal: 0, tol: [15, 30], unit: '°', note: 'A flat Back Layout reads near 0°.' }
        ],
        checks: ['Face, chest, thighs and feet at the surface', 'Head and trunk still, no sculling wobble']
      },
      {
        id: 'bkbl1',
        label: 'Bent Knee Back Layout · leg 1',
        cue: 'Freeze at the top of the first bent knee, thigh vertical.',
        art: 'bentKneeBack',
        signature: 'liftWhileFlat',
        weight: 10.5,
        landmarks: ['waterA', 'waterB', 'shoulder', 'hip', 'knee', 'ankle', 'ankleB'],
        metrics: [
          { id: 'thigh', kind: 'segmentToVertical', label: 'Thigh verticality', pts: ['hip', 'knee'], ideal: 0, tol: [15, 30], unit: '°', note: 'Manual requires the thigh vertical to the surface.' },
          { id: 'hipdrop', kind: 'heightChange', label: 'Hip drop', pts: ['hip'], ref: 'bl1', ideal: 0, tol: [0.2, 0.8], unit: ' shin', note: '~0.2 shin = 3 in, ~0.8 shin = 13 in.' },
          { id: 'travel', kind: 'travelAlongWater', label: 'Head-first travel', pts: ['shoulder'], ref: 'bl1', ideal: 0, tol: [0.38, 0.9], unit: ' shin', note: '~0.38 shin = 6 in.', travel: true }
        ],
        checks: ['Toe stayed in contact with the inside of the extended leg', 'Extended foot never left the surface', 'Position held only long enough to show control']
      },
      {
        id: 'bl2',
        label: 'Back Layout · return',
        cue: 'Freeze the moment the feet rejoin at the surface.',
        art: 'backLayout',
        signature: 'flatSurface',
        weight: 10.5,
        landmarks: ['waterA', 'waterB', 'shoulder', 'hip', 'knee', 'ankle'],
        metrics: [
          { id: 'bodyline', kind: 'segmentToWater', label: 'Body line vs surface', pts: ['shoulder', 'ankle'], ideal: 0, tol: [15, 30], unit: '°' },
          { id: 'hipdrop', kind: 'heightChange', label: 'Hip drop vs start', pts: ['hip'], ref: 'bl1', ideal: 0, tol: [0.2, 0.8], unit: ' shin' }
        ],
        checks: ['Full extension reached as the feet joined', 'Height held constant through the lowering']
      },
      {
        id: 'bkbl2',
        label: 'Bent Knee Back Layout · leg 2',
        cue: 'Freeze at the top of the opposite bent knee.',
        art: 'bentKneeBack',
        signature: 'liftWhileFlat',
        weight: 10.5,
        landmarks: ['waterA', 'waterB', 'shoulder', 'hip', 'knee', 'ankle', 'ankleB'],
        metrics: [
          { id: 'thigh', kind: 'segmentToVertical', label: 'Thigh verticality', pts: ['hip', 'knee'], ideal: 0, tol: [15, 30], unit: '°' },
          { id: 'hipdrop', kind: 'heightChange', label: 'Hip drop', pts: ['hip'], ref: 'bl1', ideal: 0, tol: [0.2, 0.8], unit: ' shin' },
          { id: 'travel', kind: 'travelAlongWater', label: 'Head-first travel', pts: ['shoulder'], ref: 'bl1', ideal: 0, tol: [0.38, 0.9], unit: ' shin', travel: true }
        ],
        checks: ['Second side matched the first in height and speed', 'Shoulders stayed open, head not lifting forward']
      },
      {
        id: 'bl3',
        label: 'Back Layout · finish',
        cue: 'Freeze the finished layout.',
        art: 'backLayout',
        signature: 'flatSurface',
        weight: 10.5,
        landmarks: ['waterA', 'waterB', 'shoulder', 'hip', 'knee', 'ankle'],
        metrics: [
          { id: 'bodyline', kind: 'segmentToWater', label: 'Body line vs surface', pts: ['shoulder', 'ankle'], ideal: 0, tol: [15, 30], unit: '°' },
          { id: 'travel', kind: 'travelAlongWater', label: 'Total travel', pts: ['shoulder'], ref: 'bl1', ideal: 0, tol: [0.38, 0.9], unit: ' shin', travel: true }
        ],
        checks: ['Finished flat and still', 'Whole figure kept an even tempo']
      }
    ],
    tempo: null,
    transitions: [
      {
        title: 'To assume a Bent Knee Back Layout',
        from: 'bl1', to: 'bkbl1',
        rules: [
          'Begin in a Back Layout Position. One leg remains at the surface throughout.',
          'The foot of the other leg is drawn along the inside of the extended leg to assume a Bent Knee Back Layout Position.'
        ],
        actions: [
          'See BP 1 Back Layout Position.',
          'The toe of the bending leg maintains contact with the inside of the extended leg. Minimal drop in hips. Position held just long enough to demonstrate control and accuracy.',
          'Height remains constant throughout the movement.',
          'The head and trunk remain stationary throughout.'
        ]
      },
      {
        title: 'To lower from Bent Knee Back Layout to Back Layout',
        from: 'bkbl1', to: 'bl2',
        rules: ['From a Bent Knee Back Layout Position, the toe moves along the inside of the extended leg until a Back Layout Position is assumed.'],
        actions: [
          'Height remains constant throughout the movement.',
          'Full extension in Back Layout Position to be achieved as the feet are joined.',
          'The head and trunk remain stationary throughout.'
        ]
      }
    ],
    deductions: [
      {
        phase: 'Back Layout to Bent Knee Back Layout',
        rows: [
          ['Body travels forward or headfirst up to 6 in as the leg is lifted', 'Body travels forward or headfirst more than 6 in as the leg is lifted', '—'],
          ['Hips drop up to 3 in during the transition', 'Hips drop 4-12 in during the transition', 'Hips drop more than 13 in during the transition'],
          ['—', 'Shoulders rounded, head is forward', 'Body sitting in water more than 12 in, head off the water']
        ]
      },
      {
        phase: 'Bent Knee Back Layout to Back Layout',
        rows: [['Hips near surface', '—', 'Hips deep, shoulders rounded, head off surface']]
      }
    ],
    heightChart: null,
    drills: {
      thigh: ['Wall drill: lie back with the head at the wall, draw the toe up the shin and stop when a partner says "vertical". Repeat 8 times, eyes closed on the last 4.', 'Dry-land: lying on your back, slide the heel to the knee and hold 3 s. Check the thigh against a vertical line taped on the wall.'],
      hipdrop: ['Sculling isolation: hold Back Layout and do 20 s of support scull while a partner lightly taps the hip - the hip should not sink under the tap.', 'Half-speed reps: perform the bend over 8 counts instead of 4, keeping the hip bone dry the whole time.'],
      travel: ['Lane-line reference: line the crown of the head up with a lane marker and complete both bends without losing the marker.', 'Reverse the scull pressure slightly as the knee bends to cancel head-first drift.'],
      bodyline: ['Streamline hold: 30 s Back Layout with the ears in the water and toes at the surface, checking hips, thighs and toes are all dry.']
    }
  },

  {
    id: 'f201',
    number: '201',
    name: 'Dolphin',
    dd: 1.4,
    accent: '#5aa9f5',
    autoScan: 'dolphin',
    tagline: 'One clean circle. Same point in, same point out.',
    description:
      'From a Back Layout Position, with head leading, the head, hips and feet leave the surface sequentially at the same point to assume a Dolphin Arch as the body travels a circle of roughly 2.5 m diameter, proportional to the swimmer. The body follows the circumference until the head, hips and feet break the surface sequentially at the same point and the body straightens to a Back Layout Position.',
    totalNV: 32.0,
    positions: [
      { label: 'Back Layout', nv: null, pv: null },
      { label: 'Quarter point · arch', nv: 8.0, pv: 2.5 },
      { label: 'Half point', nv: 8.0, pv: 2.5 },
      { label: 'Three-quarter point', nv: 8.0, pv: 2.5 },
      { label: 'Back Layout', nv: 8.0, pv: 2.5 }
    ],
    checkpoints: [
      {
        id: 'start',
        label: 'Back Layout · head submerges',
        cue: 'Freeze the instant the head goes under. This is the reference point of the whole circle.',
        art: 'dolphinStart',
        weight: 0,
        landmarks: ['waterA', 'waterB', 'head', 'hip', 'ankle'],
        metrics: [
          { id: 'bodyline', kind: 'segmentToWater', label: 'Body line vs surface', pts: ['hip', 'ankle'], ideal: 0, tol: [15, 30], unit: '°' }
        ],
        checks: ['Head, hips and feet left the surface through the same point', 'Head led, the body did not press down flat']
      },
      {
        id: 'q1',
        label: 'Quarter point · Dolphin Arch',
        cue: 'Freeze where the head reaches the quarter point. Mark whatever is still visible.',
        art: 'dolphinQ1',
        weight: 8.0,
        landmarks: ['waterA', 'waterB', 'ankle', 'toe'],
        metrics: [],
        checks: ['Dolphin Arch reached exactly at the quarter point', 'Feet still at the surface, toes pointed', 'Arch is even, not hinged at the hips']
      },
      {
        id: 'q2',
        label: 'Half point',
        cue: 'Freeze at the deepest part of the circle.',
        art: 'dolphinQ2',
        weight: 8.0,
        landmarks: ['waterA', 'waterB'],
        metrics: [],
        checks: ['Body passed through the half point of a round circle', 'Circle depth looks proportional to the swimmer\'s height']
      },
      {
        id: 'q3',
        label: 'Three-quarter point',
        cue: 'Freeze as the head begins to rise back toward the surface.',
        art: 'dolphinQ3',
        weight: 8.0,
        landmarks: ['waterA', 'waterB', 'toe'],
        metrics: [],
        checks: ['Third quarter is the same size and shape as the first', 'Arch maintained, no early straightening']
      },
      {
        id: 'finish',
        label: 'Back Layout · feet surface',
        cue: 'Freeze when the toes break the surface at the end.',
        art: 'dolphinFinish',
        weight: 8.0,
        landmarks: ['waterA', 'waterB', 'head', 'hip', 'ankle'],
        metrics: [
          { id: 'closure', kind: 'travelAlongWater', label: 'Exit point vs entry point', pts: ['ankle'], refPt: 'head', ref: 'start', ideal: 0, tol: [0.5, 1.2], unit: ' shin', note: 'The feet should surface where the head went under.', travel: true },
          { id: 'bodyline', kind: 'segmentToWater', label: 'Finish body line', pts: ['hip', 'ankle'], ideal: 0, tol: [15, 30], unit: '°' }
        ],
        checks: ['Body rose, straightened and moved along the surface at the same time', 'Finished stationary in Back Layout']
      }
    ],
    tempo: {
      label: 'Quarter tempo evenness',
      cue: 'Each quarter of the circle should take the same time.',
      checkpoints: ['start', 'q1', 'q2', 'q3', 'finish'],
      tol: [0.12, 0.25],
      note: 'Largest quarter duration divided by the average, minus 1. An even circle reads near 0.'
    },
    transitions: [
      {
        title: 'BM 14 Dolphin',
        from: 'start', to: 'finish',
        rules: [
          'A Dolphin is started in a Back Layout Position.',
          'The body follows the circumference of a circle roughly 2.5 m in diameter, depending on the height of the swimmer.',
          'The head, hips and feet leave the surface sequentially to assume a Dolphin Arch as the body moves around the circle.',
          'Movement continues until the body straightens as it surfaces to a Back Layout Position, with head, hips and feet breaking surface at the same point.'
        ],
        actions: [
          'See Back Layout Position.',
          'The size of the circle should be in proportion to the height of the swimmer.',
          'Head, hips and feet leave the surface through the same point, with the Dolphin Arch achieved as the head reaches the quarter point. An accurate circle passes the quarter, half and three-quarter points with each quarter the same size and shape.',
          'Body rises, straightens and moves along the surface simultaneously, with a stationary Back Layout achieved as the feet surface where the head emerged.'
        ]
      }
    ],
    deductions: [
      {
        phase: 'Circle accuracy (angle-deviation scale)',
        rows: [
          ['Circle slightly oval, quarters marginally uneven', 'One quarter clearly larger or smaller than the others', 'Circle shape lost, quarters obviously unequal'],
          ['Feet surface slightly off the entry point', 'Feet surface clearly away from the entry point', 'Figure finishes well away from the entry point']
        ]
      }
    ],
    heightChart: null,
    drills: {
      closure: ['Mark the entry point with a floating cue (coach\'s hand above the water) and finish the circle trying to touch it with the toes.', 'Swim the second half slightly stronger - most swimmers under-travel the return arc.'],
      tempo: ['Count 4-4-4-4 out loud on deck, then swim the circle to a partner counting the same tempo.', 'Film from the side and clap on each quarter; check the claps are evenly spaced.'],
      bodyline: ['Practise the entry and exit only: press the head under and rise again 10 times, keeping hips and toes at the surface.']
    }
  },

  {
    id: 'f316',
    number: '316',
    name: 'Kipnus',
    dd: 1.4,
    accent: '#8f7bf5',
    tagline: 'Kip, unroll, and hold the bent knee high.',
    description:
      'From a Back Layout Position, a Kip is executed until the shins are perpendicular to the surface. With the shins staying perpendicular, the trunk unrolls as the legs assume a Bent Knee Vertical Position midway between the former vertical line through the hips and the former vertical line through the head and shins. Maintaining the Bent Knee Vertical, the body descends along its longitudinal axis until the toes are submerged.',
    totalNV: 30.0,
    positions: [
      { label: 'Back Layout', nv: null, pv: null },
      { label: 'Surface Tuck', nv: 3.0, pv: 0.1 },
      { label: 'Inverted Tuck', nv: 2.0, pv: 0.07 },
      { label: 'Bent Knee Vertical', nv: 15.0, pv: 0.5 },
      { label: 'Vertical Descent', nv: 10.0, pv: 0.33 }
    ],
    checkpoints: [
      {
        id: 'bl',
        label: 'Back Layout · start',
        cue: 'Freeze the still layout before the knees draw in.',
        art: 'backLayout',
        signature: 'flatSurface',
        weight: 0,
        landmarks: ['waterA', 'waterB', 'head', 'shoulder', 'hip', 'ankle'],
        metrics: [
          { id: 'bodyline', kind: 'segmentToWater', label: 'Body line vs surface', pts: ['shoulder', 'ankle'], ideal: 0, tol: [15, 30], unit: '°' }
        ],
        checks: ['Flat, still Back Layout with toes at the surface']
      },
      {
        id: 'tuck',
        label: 'Surface Tuck',
        cue: 'Freeze when the tuck is at its most compact on the surface.',
        art: 'surfaceTuck',
        signature: 'compactSurface',
        weight: 3.0,
        landmarks: ['waterA', 'waterB', 'head', 'shoulder', 'hip', 'knee'],
        metrics: [
          { id: 'headhold', kind: 'travelAlongWater', label: 'Head displacement', pts: ['head'], ref: 'bl', ideal: 0, tol: [0.3, 0.8], unit: ' shin', note: 'Head and shoulders should stay where they started.', travel: true }
        ],
        checks: ['Knees, shins and toes drew along the surface', 'Tuck formed where the trunk was in Back Layout', 'Head and shoulders stayed stationary']
      },
      {
        id: 'itk',
        label: 'Inverted Tuck · shins perpendicular',
        cue: 'Freeze when the shins are perpendicular to the water.',
        art: 'invertedTuck',
        signature: 'narrowStanding',
        weight: 2.0,
        landmarks: ['waterA', 'waterB', 'knee', 'ankle', 'toe'],
        metrics: [
          { id: 'shins', kind: 'segmentToVertical', label: 'Shin verticality', pts: ['knee', 'ankle'], ideal: 0, tol: [15, 30], unit: '°', note: 'Manual requires shins perpendicular to the surface.' }
        ],
        checks: ['Tuck stayed tight, knees on the chest', 'Continuous motion from the leg draw to the inverted tuck', 'Head tucked in, not leading the shoulders back']
      },
      {
        id: 'bkv',
        label: 'Bent Knee Vertical · max height',
        cue: 'Freeze at maximum height. Mark the crotch and kneecap so the height chart can be read.',
        art: 'bentKneeVertical',
        signature: 'tallest',
        weight: 15.0,
        landmarks: ['waterA', 'waterB', 'hip', 'crotch', 'kneecap', 'knee', 'toe'],
        metrics: [
          { id: 'align', kind: 'segmentToVertical', label: 'Vertical alignment', pts: ['hip', 'toe'], ideal: 0, tol: [15, 30], unit: '°', note: 'Support leg from hip to toe against a plumb line.' },
          { id: 'height', kind: 'heightChart', label: 'Height (chart score)', chart: 'thigh', ideal: 10, unit: '' }
        ],
        checks: ['Bent Knee Vertical and maximum height reached at the same moment', 'Position held only long enough to define it', 'Legs did not open at the hips to reach vertical']
      },
      {
        id: 'descent',
        label: 'Toes submerged',
        cue: 'Freeze the instant the toes disappear. The Bent Knee Vertical is held all the way down.',
        art: 'bentKneeDescent',
        signature: 'submerged',
        weight: 10.0,
        landmarks: ['waterA', 'waterB'],
        metrics: [],
        checks: ['Descent tempo uniform and matching the rest of the figure', 'Bent Knee Vertical held all the way down', 'No travel during the descent']
      }
    ],
    tempo: {
      label: 'Descent tempo match',
      cue: 'The descent should run at the same speed as the rest of the figure.',
      checkpoints: ['tuck', 'itk', 'bkv', 'descent'],
      tol: [0.2, 0.45],
      note: 'Longest phase divided by the average, minus 1. Uniform tempo reads near 0.'
    },
    transitions: [
      {
        title: 'Back Layout to Inverted Tuck Position',
        from: 'bl', to: 'itk',
        rules: ['From a Back Layout Position the knees, shins and toes are drawn along the surface to assume a Tuck Position. With continuous motion the tuck becomes more compact and a partial Somersault Back Tuck is executed until the shins are perpendicular to the surface.'],
        actions: [
          'With head and shoulders remaining stationary, the knees, shins and toes are drawn to the body to assume a tight tuck at the position occupied by the trunk in Back Layout.',
          'There is continuous motion from the initiation of the leg draw to achievement of the Inverted Tuck Position.'
        ]
      },
      {
        title: 'Inverted Tuck to Bent Knee Vertical',
        from: 'itk', to: 'bkv',
        rules: ['The trunk unrolls as the legs are straightened to assume a Bent Knee Vertical Position midway between the former vertical line through the hips and the former vertical line through the head and shins.'],
        actions: [
          'Bent Knee Vertical Position and maximum height achieved simultaneously.',
          'The position is held only long enough to define it and to show completion of the transition before the Vertical Descent.'
        ]
      },
      {
        title: 'BM 10 Vertical Descent',
        from: 'bkv', to: 'descent',
        rules: ['Maintaining a Bent Knee Vertical Position, the body descends along its longitudinal axis until the toes are submerged.'],
        actions: ['Unless otherwise stated, the tempo of the descent is uniform and at the same speed as the rest of the figure.']
      }
    ],
    deductions: [
      {
        phase: 'Inverted Back Tuck to Bent Knee Vertical',
        rows: [
          ['Head moves off the surface toward the knees to assume the tuck', 'Head and torso move toward the feet to assume the tuck', '—'],
          ['Tuck could be tighter', 'Head out of line', 'Knees off chest, head not tucked in'],
          ['Unroll and leg extension are simultaneous but the bent knee vertical is slightly off the midway point', 'Unroll is not simultaneous; the leg reaches bent knee vertical and then the back unrolls under it', 'Head and back move to vertical and then the legs open at the hips before straightening'],
          ['—', '—', 'Head leads the shoulders backward to open the tuck']
        ]
      }
    ],
    heightChart: {
      title: 'Height chart · Bent Knee Vertical',
      caption: 'Water level on the support leg at maximum height.',
      rows: [
        ['10', 'Top of pelvis'],
        ['9.5', 'Above crotch'],
        ['8.5', 'Crotch level'],
        ['7.5', 'Upper thigh'],
        ['6.5', 'Mid-thigh'],
        ['5.5', 'Low thigh, well above kneecap'],
        ['4.5', 'Kneecap'],
        ['3.5', 'Below kneecap']
      ]
    },
    drills: {
      height: ['Vertical thrust from a tuck against the wall: 6 reps, holding max height for 2 s and having a partner call the water level.', 'Eggbeater / support scull power sets - 4 x 20 s pushing the water down, not out.'],
      align: ['Plumb-line check: film from the side with a weighted line hanging in shot and freeze at max height.', 'Wall vertical: press the back of the support leg to the wall so hip and toe share one line.'],
      shins: ['Slow-motion kip: take 8 counts to arrive with the shins perpendicular, checking against a vertical pool ladder rail.'],
      headhold: ['Anchor drill: place a floating marker beside the ear and complete the leg draw without the marker moving.'],
      tempo: ['Count the whole figure 4-4-4-4 and have a partner clap the descent so it matches the earlier phases.']
    }
  },

  {
    id: 'f358',
    number: '358',
    name: 'Snapping Turtle',
    dd: 1.7,
    accent: '#f4a259',
    tagline: 'Flat split, fast snap, straight down.',
    description:
      'From a Front Layout Position a Walkover, Front is executed to a Split Position. The legs are rapidly and symmetrically joined to assume a Vertical Position. Maintaining the Vertical Position, the body rapidly descends along its longitudinal axis until the toes are submerged.',
    totalNV: 56.0,
    positions: [
      { label: 'Front Layout', nv: null, pv: null },
      { label: 'Front Pike', nv: 6.0, pv: 1.07 },
      { label: 'Split', nv: 20.0, pv: 3.57 },
      { label: 'Vertical', nv: 16.0, pv: 2.86 },
      { label: 'Vertical Descent', nv: 14.0, pv: 2.5 }
    ],
    checkpoints: [
      {
        id: 'fl',
        label: 'Front Layout · start',
        cue: 'Freeze the still front layout, face in the water.',
        art: 'frontLayout',
        signature: 'flatSurface',
        weight: 0,
        landmarks: ['waterA', 'waterB', 'head', 'shoulder', 'hip', 'ankle'],
        metrics: [
          { id: 'bodyline', kind: 'segmentToWater', label: 'Body line vs surface', pts: ['shoulder', 'ankle'], ideal: 0, tol: [15, 30], unit: '°' }
        ],
        checks: ['Face in the water, body flat and still']
      },
      {
        id: 'pike',
        label: 'Front Pike · surface',
        cue: 'Freeze when the pike is complete and the legs are still at the surface.',
        art: 'frontPike',
        signature: 'legsOnlySurface',
        weight: 6.0,
        landmarks: ['waterA', 'waterB', 'shoulder', 'hip', 'knee', 'ankle'],
        metrics: [
          { id: 'trunk', kind: 'segmentToVertical', label: 'Trunk verticality', pts: ['hip', 'shoulder'], ideal: 0, tol: [15, 30], unit: '°', note: 'The trunk should hang straight down.' },
          { id: 'replace', kind: 'travelAlongWater', label: 'Hips replaced the head', pts: ['hip'], refPt: 'head', ref: 'fl', ideal: 0, tol: [0.38, 0.75], unit: ' shin', note: 'Hips should finish where the head started; ~0.38 shin = 6 in.', travel: true }
        ],
        checks: ['Uniform, smooth downward motion of the trunk', 'Hips and head locked into position at the same time', 'Legs and feet stayed at the surface']
      },
      {
        id: 'split',
        label: 'Split Position',
        cue: 'Freeze the widest, most even moment of the split.',
        art: 'split',
        signature: 'widest',
        weight: 20.0,
        landmarks: ['waterA', 'waterB', 'hip', 'shoulder', 'ankle', 'ankleB'],
        metrics: [
          { id: 'splitangle', kind: 'splitAngle', label: 'Split angle (chart score)', pts: ['ankle', 'hip', 'ankleB'], chart: 'split', unit: '°' },
          { id: 'trunk', kind: 'segmentToVertical', label: 'Trunk verticality', pts: ['hip', 'shoulder'], ideal: 0, tol: [15, 30], unit: '°' },
          { id: 'even', kind: 'splitEvenness', label: 'Split evenness', pts: ['ankle', 'hip', 'ankleB'], ideal: 0, tol: [10, 25], unit: '°', note: 'Difference between the front and back leg angles.' }
        ],
        checks: ['Leg lifted in a 180° arc with constant height', 'Hips and shoulders square', 'Front leg fully extended at the surface', 'Stationary leg\'s foot stayed at the surface']
      },
      {
        id: 'vert',
        label: 'Vertical Position',
        cue: 'Freeze the instant the legs finish joining.',
        art: 'vertical',
        signature: 'tallest',
        weight: 16.0,
        landmarks: ['waterA', 'waterB', 'hip', 'knee', 'toe'],
        metrics: [
          { id: 'align', kind: 'segmentToVertical', label: 'Vertical alignment', pts: ['hip', 'toe'], ideal: 0, tol: [15, 30], unit: '°' }
        ],
        checks: ['Legs fully extended', 'Legs split evenly and joined on a vertical line', 'The join was performed rapidly']
      },
      {
        id: 'descent',
        label: 'Toes submerged',
        cue: 'Freeze the instant the toes disappear.',
        art: 'verticalDescent',
        signature: 'submerged',
        weight: 14.0,
        landmarks: ['waterA', 'waterB'],
        metrics: [],
        checks: ['Descent uniform and rapid', 'Vertical alignment held all the way down']
      }
    ],
    tempo: {
      label: 'Snap speed',
      cue: 'Split to Vertical to submerged toes must be rapid.',
      checkpoints: ['split', 'vert', 'descent'],
      mode: 'fast',
      tol: [1.6, 2.4, 1.2],
      note: 'Total seconds from Split to submerged toes. Under about 1.2 s reads as rapid.'
    },
    transitions: [
      {
        title: 'BM 3 To assume a Front Pike Position',
        from: 'fl', to: 'pike',
        rules: ['From a Front Layout Position with face in the water, the trunk moves downward to assume a Front Pike Position as the buttocks, legs and feet travel along the surface until the hips occupy the position of the head at the beginning of this action.'],
        actions: ['Uniform motion in the downward movement of the trunk. The trunk remains straight throughout. Hips and head lock into position simultaneously.', 'Smooth, even downward movement of the trunk.']
      },
      {
        title: 'Surface Front Pike to Split Position',
        from: 'pike', to: 'split',
        rules: ['One leg is lifted in a 180° arc over the surface to Split Position.'],
        actions: [
          'Constant height and continuous uniform motion to achieve the Split Position.',
          'Trunk maintains its vertical alignment, with hips and shoulders square.',
          'Full extension of the horizontal leg at the surface of the water.',
          'Foot of the stationary leg remains at the surface.'
        ]
      },
      {
        title: 'Split to Vertical Transition',
        from: 'split', to: 'vert',
        rules: ['The legs are rapidly joined to assume a Vertical Position.'],
        actions: ['Full extension of the legs.', 'Legs split evenly and join in a vertical line.', 'Performed rapidly.']
      },
      {
        title: 'BM 10 Vertical Descent',
        from: 'vert', to: 'descent',
        rules: ['Maintaining a Vertical Position the body rapidly descends along its longitudinal axis until the toes are submerged.'],
        actions: ['The tempo of the descent is uniform and performed rapidly.']
      }
    ],
    deductions: [
      {
        phase: 'Front Layout to Front Pike',
        rows: [
          ['Hips do not replace the position of the head, moving forward up to 6 in', 'Hips do not replace the position of the head, moving forward 6-12 in', 'No forward movement; the body hinges down into the pike']
        ]
      },
      {
        phase: 'Split Position',
        rows: [['See the height chart for splits', '—', 'Piked hips in front split']]
      }
    ],
    heightChart: {
      title: 'Height chart · Split',
      caption: 'Angle of split and the resulting water level.',
      rows: [
        ['9.5', '180° flat — crotch and legs dry'],
        ['8.5', '170-180° — legs dry'],
        ['7.5', '160-170° — legs almost dry'],
        ['6.5', '150-160° — lower legs dry, crotch under water'],
        ['5.5', '130-140° — lower legs dry, crotch under water'],
        ['4.5', '110-120° — feet above the surface, legs under water'],
        ['3.5', 'up to 100° — feet come out vertically'],
        ['0.1-2.9', 'scissors']
      ]
    },
    drills: {
      splitangle: ['Deck split holds: 3 x 30 s front split each side with the hips square, stopping before pain.', 'Wall split: back to the wall, slide the top leg up the wall to feel a flat, square split.'],
      even: ['Split against a mirror or a filmed side view: check the two legs make equal angles with the water line.'],
      replace: ['Pike travel drill: put a marker at the head, pike down slowly and check the hip arrives at the marker.', 'Practise the pike over 8 counts, then 4, keeping the hip on the marker.'],
      trunk: ['Wall pike: hold the pike with the back flat against the wall for 15 s x 6.'],
      align: ['Vertical joins from a split, 10 reps, aiming to hear a single "snap" rather than one leg arriving late.'],
      tempo: ['Time the snap with a phone stopwatch. Try to move Split to submerged toes in under 1.2 s while keeping the line.']
    }
  }
];

export const REFERENCE = { TRAVEL_GUIDE, ANGLE_SCALE };

// Ballet Leg: supplied February 2026 manual, BP 1 / BP 3 and BM 1 / BM 2.
FIGURES.push({"id": "f101", "number": "101", "name": "Ballet Leg, Single", "dd": 1.6, "accent": "#B8E2FF", "manualReview": true, "tagline": "Keep the body long and the raised leg vertical.", "description": "Begin in Back Layout. Draw one foot along the inside of the extended leg to Bent Knee Back Layout. Extend the knee without moving the thigh to Ballet Leg. Bend the knee without moving the thigh, then return to Back Layout. Review only visible landmarks; measurements are 2D estimates.", "totalNV": 43, "positions": [{"label": "Back Layout", "nv": null, "pv": null}, {"label": "Bent Knee Back Layout", "nv": 10.5, "pv": null}, {"label": "Ballet Leg", "nv": 11, "pv": null}, {"label": "Bent Knee Back Layout", "nv": 11, "pv": null}, {"label": "Back Layout", "nv": 10.5, "pv": null}], "checkpoints": [{"id": "bl1", "label": "Back Layout · start", "cue": "Capture the starting back layout. Keep the same working leg labels throughout.", "weight": 0, "landmarks": ["waterA", "waterB", "shoulder", "hip", "knee", "ankle", "ankleB"], "metrics": [{"id": "bodyline", "kind": "segmentToWater", "label": "Trunk vs surface", "pts": ["shoulder", "hip"], "ideal": 0, "tol": [15, 30], "unit": "°", "note": "Estimated 2D angle from reviewed landmarks. Camera elevation and submerged points limit accuracy."}, {"id": "surfaceleg", "kind": "segmentToWater", "label": "Surface leg alignment", "pts": ["hip", "ankleB"], "ideal": 0, "tol": [15, 30], "unit": "°", "note": "Estimated 2D angle from reviewed landmarks. Camera elevation and submerged points limit accuracy."}], "checks": ["Face, chest, thighs and feet at the surface", "Ears, shoulders, hips and ankles horizontally aligned"], "art": "backLayout", "checkTests": [[{"kind": "nearSurface", "pts": ["shoulder", "hip", "knee", "ankle"], "label": "Furthest landmark from the surface", "unit": " shin", "max": 0.35}], [{"kind": "segmentToWater", "pts": ["shoulder", "ankle"], "label": "Shoulder-to-ankle line vs surface", "unit": "°", "max": 10}]], "checkDrills": ["height", "bodyline"]}, {"id": "bk1", "label": "Bent Knee · entry", "cue": "Capture the bent-knee position before the leg straightens.", "weight": 10.5, "landmarks": ["waterA", "waterB", "shoulder", "hip", "knee", "ankle", "ankleB"], "metrics": [{"id": "bodyline", "kind": "segmentToWater", "label": "Trunk vs surface", "pts": ["shoulder", "hip"], "ideal": 0, "tol": [15, 30], "unit": "°", "note": "Estimated 2D angle from reviewed landmarks. Camera elevation and submerged points limit accuracy."}, {"id": "surfaceleg", "kind": "segmentToWater", "label": "Surface leg alignment", "pts": ["hip", "ankleB"], "ideal": 0, "tol": [15, 30], "unit": "°", "note": "Estimated 2D angle from reviewed landmarks. Camera elevation and submerged points limit accuracy."}, {"id": "thigh", "kind": "segmentToVertical", "label": "Thigh deviation from vertical", "pts": ["hip", "knee"], "ideal": 0, "tol": [15, 30], "unit": "°", "note": "Estimated 2D angle from reviewed landmarks. Camera elevation and submerged points limit accuracy."}], "checks": ["Toe follows the inside of the extended leg", "Head and trunk remain still; surface leg stays extended"], "art": "bentKneeBack", "checkTests": [null, [{"kind": "heightShift", "pts": ["shoulder"], "label": "Shoulder height change since the start", "unit": " shin", "ref": "bl1", "max": 0.3}, {"kind": "segmentShift", "pts": ["shoulder", "hip"], "label": "Trunk turned since the start", "unit": "°", "ref": "bl1", "max": 8}, {"kind": "segmentToWater", "pts": ["hip", "ankleB"], "label": "Surface leg vs surface", "unit": "°", "max": 10}]], "checkNotes": ["The toe is hidden from a side camera and below the surface.", null], "checkDrills": ["toepath", "height"]}, {"id": "ballet", "label": "Ballet Leg", "art": "balletLeg", "cue": "Capture the raised-leg position. Mark the working hip, knee and ankle only where visible.", "weight": 11, "landmarks": ["waterA", "waterB", "shoulder", "hip", "knee", "ankle", "ankleB"], "metrics": [{"id": "vertical", "kind": "segmentToVertical", "label": "Raised leg deviation from vertical", "pts": ["hip", "ankle"], "ideal": 0, "tol": [15, 30], "unit": "°", "note": "Estimated 2D angle from reviewed landmarks. Camera elevation and submerged points limit accuracy."}, {"id": "knee", "kind": "jointAngle", "label": "Raised knee extension", "pts": ["hip", "knee", "ankle"], "ideal": 180, "tol": [15, 30], "unit": "°", "note": "Estimated 2D angle from reviewed landmarks. Camera elevation and submerged points limit accuracy."}, {"id": "hipangle", "kind": "jointAngle", "label": "Leg-to-trunk angle", "pts": ["shoulder", "hip", "ankle"], "ideal": 90, "tol": [15, 30], "unit": "°", "note": "Estimated 2D angle from reviewed landmarks. Camera elevation and submerged points limit accuracy."}, {"id": "bodyline", "kind": "segmentToWater", "label": "Trunk vs surface", "pts": ["shoulder", "hip"], "ideal": 0, "tol": [15, 30], "unit": "°", "note": "Estimated 2D angle from reviewed landmarks. Camera elevation and submerged points limit accuracy."}, {"id": "surfaceleg", "kind": "segmentToWater", "label": "Surface leg alignment", "pts": ["hip", "ankleB"], "ideal": 0, "tol": [15, 30], "unit": "°", "note": "Estimated 2D angle from reviewed landmarks. Camera elevation and submerged points limit accuracy."}], "checks": ["Raised leg fully extended", "Toes pointed", "Body and surface leg remain horizontally aligned", "Thigh stayed still during knee extension"], "checkTests": [[{"kind": "jointAngle", "pts": ["hip", "knee", "ankle"], "label": "Knee angle", "unit": "°", "min": 165}], null, [{"kind": "segmentToWater", "pts": ["shoulder", "hip"], "label": "Trunk vs surface", "unit": "°", "max": 10}, {"kind": "segmentToWater", "pts": ["hip", "ankleB"], "label": "Surface leg vs surface", "unit": "°", "max": 10}], [{"kind": "segmentShift", "pts": ["hip", "knee"], "label": "Thigh turned since the bent knee", "unit": "°", "ref": "bk1", "max": 10}]], "checkNotes": [null, "Toe shape needs a foot landmark the clip does not track.", null, null], "checkDrills": ["knee", "toes", "bodyline", "thigh"]}, {"id": "bk2", "label": "Bent Knee · lowering", "cue": "Capture the bent knee on the way down, before the foot slides back.", "weight": 11, "landmarks": ["waterA", "waterB", "shoulder", "hip", "knee", "ankle", "ankleB"], "metrics": [{"id": "bodyline", "kind": "segmentToWater", "label": "Trunk vs surface", "pts": ["shoulder", "hip"], "ideal": 0, "tol": [15, 30], "unit": "°", "note": "Estimated 2D angle from reviewed landmarks. Camera elevation and submerged points limit accuracy."}, {"id": "surfaceleg", "kind": "segmentToWater", "label": "Surface leg alignment", "pts": ["hip", "ankleB"], "ideal": 0, "tol": [15, 30], "unit": "°", "note": "Estimated 2D angle from reviewed landmarks. Camera elevation and submerged points limit accuracy."}, {"id": "thigh", "kind": "segmentToVertical", "label": "Thigh deviation from vertical", "pts": ["hip", "knee"], "ideal": 0, "tol": [15, 30], "unit": "°", "note": "Estimated 2D angle from reviewed landmarks. Camera elevation and submerged points limit accuracy."}], "checks": ["Thigh remains still as the knee bends", "Height maintained; head and trunk remain still"], "art": "bentKneeBack", "checkTests": [[{"kind": "segmentShift", "pts": ["hip", "knee"], "label": "Thigh turned since the Ballet Leg", "unit": "°", "ref": "ballet", "max": 10}], [{"kind": "heightShift", "pts": ["hip"], "label": "Hip height change since the Ballet Leg", "unit": " shin", "ref": "ballet", "max": 0.3}, {"kind": "heightShift", "pts": ["shoulder"], "label": "Shoulder height change since the Ballet Leg", "unit": " shin", "ref": "ballet", "max": 0.3}, {"kind": "segmentShift", "pts": ["shoulder", "hip"], "label": "Trunk turned since the Ballet Leg", "unit": "°", "ref": "ballet", "max": 8}]], "checkDrills": ["thigh", "height"]}, {"id": "bl2", "label": "Back Layout · finish", "cue": "Capture the finish when both legs are extended and the feet rejoin.", "weight": 10.5, "landmarks": ["waterA", "waterB", "shoulder", "hip", "knee", "ankle", "ankleB"], "metrics": [{"id": "bodyline", "kind": "segmentToWater", "label": "Trunk vs surface", "pts": ["shoulder", "hip"], "ideal": 0, "tol": [15, 30], "unit": "°", "note": "Estimated 2D angle from reviewed landmarks. Camera elevation and submerged points limit accuracy."}, {"id": "surfaceleg", "kind": "segmentToWater", "label": "Surface leg alignment", "pts": ["hip", "ankleB"], "ideal": 0, "tol": [15, 30], "unit": "°", "note": "Estimated 2D angle from reviewed landmarks. Camera elevation and submerged points limit accuracy."}], "checks": ["Full extension as the feet join", "Finished in horizontal alignment", "Controlled, even motion into the finish"], "art": "backLayout", "checkTests": [[{"kind": "jointAngle", "pts": ["hip", "knee", "ankle"], "label": "Knee angle", "unit": "°", "min": 165}, {"kind": "pointGap", "pts": ["ankle", "ankleB"], "label": "Gap between the feet", "unit": " shin", "max": 0.35}], [{"kind": "segmentToWater", "pts": ["shoulder", "ankle"], "label": "Shoulder-to-ankle line vs surface", "unit": "°", "max": 10}], null], "checkNotes": [null, null, "Smoothness happens between frames; single checkpoints cannot show it."], "checkDrills": ["feet", "bodyline", "control"]}], "tempo": null, "heightChart": null, "deductions": [], "transitions": [{"title": "Assume Bent Knee Back Layout", "from": "bl1", "to": "bk1", "rules": ["Draw the foot along the inside of the extended leg."], "actions": ["Keep the other leg at the surface.", "Maintain head and trunk position."]}, {"title": "Extend to Ballet Leg", "from": "bk1", "to": "ballet", "rules": ["Straighten the knee without moving the thigh."], "actions": ["Raised leg perpendicular to surface and trunk.", "Maintain horizontal alignment and height."]}, {"title": "Lower to Bent Knee", "from": "ballet", "to": "bk2", "rules": ["Bend the knee without moving the thigh."], "actions": ["Maintain height and body alignment."]}, {"title": "Return to Back Layout", "from": "bk2", "to": "bl2", "rules": ["Slide the toe along the extended leg until the feet join."], "actions": ["Reach full extension as the feet join.", "Keep head and trunk stationary."]}], "drills": {"vertical": ["wall-ballet-leg", "ballet-leg-boards", "seated-pike"], "knee": ["thigh-still", "floor-ballet-leg"], "hipangle": ["layback-scull", "seated-pike"], "bodyline": ["layout-boards", "layout-blocks", "plank"], "surfaceleg": ["layout-boards", "wall-ballet-leg"], "thigh": ["thigh-still", "floor-rehearsal"], "height": ["layback-scull", "dry-hips-wall"], "feet": ["toe-slide", "layout-boards"], "toes": ["band-point"], "toepath": ["toe-slide"], "control": ["floor-rehearsal", "ballet-laps"]}});

export const getFigure = id => FIGURES.find(f => f.id === id);

/**
 * Competition groups and their figures. `figure` links to a FIGURES entry; entries
 * without one are listed so the swimmer can see the whole group, but are not yet
 * built. Source: the coach's group/figure sheet.
 */
export const GROUPS = [
  {
    id: 'novice',
    label: 'Novice',
    note: 'All four Novice figures are fully supported.',
    sections: [{
      label: null,
      figures: [
        { number: '100', name: 'Bent Knee, Alternate', dd: 1.1, figure: 'f100' },
        { number: '201', name: 'Dolphin', dd: 1.4, figure: 'f201' },
        { number: '316', name: 'Kipnus', dd: 1.4, figure: 'f316' },
        { number: '358', name: 'Snapping Turtle', dd: 1.7, figure: 'f358' }
      ]
    }]
  },
  {
    id: 'intermediate',
    label: 'Intermediate',
    note: 'Figure sheets not built yet — Novice is the current release.',
    sections: [
      { label: 'Compulsory', figures: [
        { number: '101', name: 'Ballet Leg, Single', dd: 1.6, figure: 'f101' },
        { number: '301', name: 'Barracuda', dd: 1.8 }
      ] },
      { label: 'Selection group 1', figures: [
        { number: '360', name: 'Walkover, Front', dd: 1.9 },
        { number: '318', name: 'Kip, Bent Knee', dd: 1.8 }
      ] },
      { label: 'Selection group 2', figures: [
        { number: '348', name: 'Tower', dd: 1.9 },
        { number: '420', name: 'Walkover, Back', dd: 2.1 }
      ] }
    ]
  },
  {
    id: 'u12',
    label: '12 & Under',
    note: 'Figure sheets not built yet — Novice is the current release.',
    sections: [
      { label: 'Compulsory', figures: [
        { number: '106', name: 'Ballet Leg, Straight' },
        { number: '301', name: 'Barracuda' }
      ] },
      { label: 'Optional group 1', figures: [
        { number: '359', name: 'Front Ariana' },
        { number: '348', name: 'Tower' }
      ] },
      { label: 'Optional group 2', figures: [
        { number: '363', name: 'Water Drop' },
        { number: '401', name: 'Swordfish' }
      ] },
      { label: 'Optional group 3', figures: [
        { number: '311', name: 'Kip' },
        { number: '227d', name: 'Swanita, Spinning 180' }
      ] }
    ]
  },
  {
    id: 'youth',
    label: 'Youth',
    note: 'Figure sheets not built yet — Novice is the current release.',
    sections: [
      { label: 'Section A · group 1', figures: [
        { number: '307e', name: 'Flying Fish, Spinning 360' },
        { number: '437', name: 'Cyclone, Open 180' }
      ] },
      { label: 'Section A · group 2', figures: [
        { number: '308h', name: 'Barracuda Airborne Split, Spin Up 180' },
        { number: '407', name: 'Swordfish Straight Leg Ariana' }
      ] },
      { label: 'Section B · group 3', figures: [
        { number: '356f', name: 'Whip, Continuous Spin 720' },
        { number: '441', name: 'Saturn' }
      ] },
      { label: 'Section B · group 4', figures: [
        { number: '352', name: 'Venus' },
        { number: '240i', name: 'Albatross, Spin Up 360' }
      ] },
      { label: 'Section C · group 5', figures: [
        { number: '140j', name: 'Flamingo, Bent Knee, Combined Spin 360 + 360' },
        { number: '421', name: 'Walkover, Back Closing 360' }
      ] },
      { label: 'Section C · group 6', figures: [
        { number: '440d', name: 'Ipanema, Spinning 180' },
        { number: '154f', name: 'London, Continuous Spin 720' }
      ] }
    ]
  }
];
