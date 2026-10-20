(() => {
  const root = document.documentElement;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');

  /* ------------------------------------------------------------ theme */
  const themeButtons = [...document.querySelectorAll('[data-theme-toggle]')];
  function syncThemeButtons() {
    const next = root.dataset.theme === 'light' ? 'dark' : 'light';
    themeButtons.forEach(button => {
      button.setAttribute('aria-label', `Switch to ${next} theme`);
      button.title = `Switch to ${next} theme`;
    });
  }
  // The new palette floods out from the switch like a ripple across the pool.
  function setTheme(theme, origin) {
    const apply = () => { root.dataset.theme = theme; syncThemeButtons(); };
    if (!origin || !document.startViewTransition || reduced.matches) { apply(); return; }
    const box = origin.getBoundingClientRect();
    const x = box.left + box.width / 2, y = box.top + box.height / 2;
    const radius = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y));
    root.classList.add('theme-switching');
    const transition = document.startViewTransition(apply);
    transition.ready.then(() => root.animate(
      { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${radius}px at ${x}px ${y}px)`] },
      { duration: 720, easing: 'cubic-bezier(.16, 1, .3, 1)', pseudoElement: '::view-transition-new(root)' }
    )).catch(() => {});
    transition.finished.finally(() => root.classList.remove('theme-switching'));
  }
  themeButtons.forEach(button => button.addEventListener('click', () => {
    const theme = root.dataset.theme === 'light' ? 'dark' : 'light';
    try { localStorage.setItem('fs-theme', theme); } catch {}
    setTheme(theme, button);
  }));
  matchMedia('(prefers-color-scheme: light)').addEventListener('change', event => {
    let stored = null;
    try { stored = localStorage.getItem('fs-theme'); } catch {}
    if (!stored) setTheme(event.matches ? 'light' : 'dark');
  });
  syncThemeButtons();

  /* ------------------------------------------------ live analysis hero */
  const hero = document.querySelector('.fs-hero');
  const stage = document.getElementById('heroStage');
  if (!hero || !stage) return;
  const screen = document.getElementById('anScreen');
  const video = document.getElementById('anVideo');
  const canvas = document.getElementById('anOverlay');
  const ctx = canvas.getContext('2d');
  const scrub = document.getElementById('anScrub');
  const fill = document.getElementById('anFill');
  const ticks = document.getElementById('anTicks');
  const chipText = document.getElementById('anChip');
  const angleOut = document.getElementById('anAngle');
  const lock = document.getElementById('anLock');
  const caption = document.getElementById('hero-feedback');
  const tabs = [...document.querySelectorAll('.hero-step')];
  const motion = document.querySelector('.hero-motion');
  const clipUrl = document.querySelector('meta[name="fs-demo-clip"]')?.content;

  // Xavier's demo clip, tracked offline with MediaPipe Pose (full) at 15 fps in the 640 × 360 frame.
  // Working-leg joints are tracked; the surface leg and waterline are interpolated from the reviewed
  // checkpoint annotations, and joints settle onto those annotations within 0.25 s of each checkpoint.
  // Row: head, shoulder, hip, knee, ankle, other ankle, waterline A, waterline B (x, y each).
  const FPS = 15;
  const TRACK = '228,225,251,250,324,255,379,250,427,252,469,240,170,234,510,234;228,224,252,250,331,252,391,248,444,250,469,240,170,234,510,234;228,221,254,248,335,249,399,245,458,246,469,240,170,234,510,234;228,218,255,247,336,247,401,243,464,244,469,240,170,234,510,234;229,217,256,245,337,245,403,242,466,243,469,240,170,234,510,234;229,215,256,244,338,244,403,241,467,243,469,240,170,234,510,234;229,214,256,242,338,243,404,240,468,242,469,240,170,234,510,234;229,213,256,241,339,242,404,239,468,241,469,240,170,234,510,234;229,213,256,240,338,241,404,239,468,241,469,240,170,234,510,234;228,213,256,238,337,241,404,238,468,240,469,240,170,234,510,234;227,213,255,236,336,240,403,238,468,239,469,240,170,234,510,234;227,213,255,234,335,239,401,238,468,238,469,240,170,234,510,234;227,213,255,232,336,238,400,238,469,237,469,240,170,234,510,234;227,213,255,231,337,237,400,238,472,236,469,240,170,234,510,234;227,214,255,229,338,236,400,238,474,235,469,240,170,234,510,234;227,214,255,229,338,236,400,238,475,235,469,240,170,234,510,234;227,215,255,229,338,236,400,238,474,235,468,239,170,234,509,234;227,215,255,231,338,235,400,237,471,235,468,239,170,234,508,234;226,215,255,233,336,235,400,236,466,235,467,238,170,233,508,233;226,215,254,235,334,235,399,235,462,234,466,238,170,233,507,233;225,215,254,236,333,235,398,234,458,234,465,237,170,233,506,233;225,215,254,236,332,235,397,234,456,234,465,237,170,233,505,233;225,215,254,235,332,236,396,234,455,233,464,236,170,233,504,233;225,215,254,234,333,236,396,234,456,233,463,236,170,232,504,232;225,215,255,233,335,237,398,233,457,233,463,235,170,232,503,232;226,214,255,234,336,237,400,232,458,233,462,235,170,232,502,232;227,214,255,235,336,237,400,231,458,233,461,234,170,232,501,232;228,214,255,236,334,238,399,230,458,234,460,234,170,231,500,231;228,213,254,235,332,239,398,230,458,234,460,233,170,231,500,231;228,212,255,234,330,240,395,230,455,232,459,233,170,231,499,231;229,211,255,233,327,240,389,229,448,231,458,232,170,231,498,231;230,210,255,233,326,240,383,225,438,231,457,231,170,231,497,231;230,209,255,234,327,242,378,218,426,231,457,231,170,230,496,230;231,208,256,234,329,243,373,212,414,231,456,230,170,230,496,230;232,208,258,233,331,243,368,207,405,230,455,230,170,230,495,230;233,208,258,232,331,244,363,205,397,230,455,229,170,230,494,230;233,207,258,232,330,244,359,205,390,229,454,229,170,230,493,230;233,207,258,232,327,244,356,205,389,229,453,228,170,229,492,229;233,206,256,232,325,244,351,205,390,228,452,228,170,229,492,229;233,206,255,233,324,242,347,204,389,228,452,227,170,229,491,229;233,206,254,234,324,241,345,204,389,228,451,227,170,229,490,229;232,206,254,235,324,240,344,203,389,228,450,226,170,228,489,228;231,206,254,235,324,239,344,203,389,228,450,226,170,228,488,228;231,206,254,234,324,239,343,202,388,227,449,225,170,228,488,228;230,206,253,233,323,240,342,202,384,227,448,225,170,228,487,228;228,206,251,232,322,240,341,203,382,228,447,224,170,228,486,228;227,207,250,232,320,240,340,203,379,228,447,223,170,227,485,227;226,207,249,232,320,239,337,204,376,228,446,223,170,227,484,227;226,208,249,232,319,238,335,204,376,227,445,222,170,227,484,227;226,208,249,232,318,237,334,203,376,227,445,222,170,227,483,227;225,208,250,231,317,236,332,203,375,227,444,221,170,227,482,227;225,208,250,230,316,235,331,203,374,227,443,221,170,226,481,226;225,207,250,229,315,235,331,203,374,227,442,220,170,226,480,226;224,205,250,229,315,235,331,203,374,227,442,220,170,226,480,226;224,204,250,229,315,236,331,203,374,227,442,219,170,225,480,225;223,203,249,230,315,237,331,202,373,227,442,218,170,224,480,224;223,202,248,229,315,237,331,200,372,226,442,218,170,224,480,224;222,201,247,228,316,236,331,199,371,224,442,217,170,223,480,223;222,200,247,226,316,235,330,198,367,223,442,217,170,223,480,223;222,199,247,225,315,234,330,198,365,223,442,216,170,222,480,222;223,199,247,225,315,233,329,200,366,223,442,216,170,221,480,221;223,198,247,225,316,233,327,201,365,222,442,215,170,221,480,221;224,197,247,225,315,233,323,200,365,219,442,214,170,220,480,220;225,196,247,225,315,232,321,197,367,214,442,214,170,219,480,219;226,196,247,225,314,231,319,195,369,209,441,213,170,219,480,219;226,195,247,224,314,231,318,194,370,202,441,213,170,218,480,218;226,194,248,223,314,231,316,193,371,197,441,212,170,218,480,218;226,193,248,223,314,231,315,193,370,192,441,211,170,217,480,217;226,193,248,222,313,230,315,193,368,184,441,211,170,216,480,216;226,193,248,220,312,230,315,192,365,177,441,210,170,216,480,216;226,193,247,219,311,230,315,191,362,171,441,209,170,215,480,215;226,193,247,218,311,229,315,190,360,164,441,209,170,214,480,214;226,193,248,217,311,228,317,188,359,157,441,208,170,214,480,214;225,193,249,216,311,227,318,187,358,153,441,208,170,213,480,213;225,192,250,215,311,225,320,184,356,149,441,207,170,213,480,213;225,192,249,215,310,223,321,180,354,145,441,207,170,212,480,212;225,192,248,215,310,221,321,179,352,142,441,206,170,211,480,211;225,192,246,217,310,219,321,177,349,137,441,205,170,211,480,211;225,191,246,217,311,216,321,174,347,131,441,205,170,210,480,210;224,190,246,215,312,216,322,173,346,128,441,204,170,210,480,210;224,189,247,212,312,216,323,172,344,126,441,204,170,209,480,209;223,188,248,210,312,217,323,171,341,124,441,203,170,208,480,208;222,187,248,209,312,217,322,170,339,122,441,202,170,208,480,208;222,187,247,210,311,216,321,167,336,119,441,202,170,207,480,207;221,186,245,210,311,212,319,163,333,115,441,201,170,206,480,206;221,185,244,208,311,208,318,159,330,112,441,200,170,206,480,206;220,184,244,206,310,207,318,157,327,109,441,200,170,205,480,205;219,183,244,205,310,208,317,157,326,108,440,199,170,205,480,205;219,182,244,205,309,208,316,158,325,107,440,199,170,204,480,204;218,181,243,205,308,209,316,160,326,108,440,198,170,203,480,203;218,180,243,204,308,209,317,161,326,108,440,198,170,203,480,203;218,180,243,203,309,208,318,160,327,108,440,197,170,202,480,202;217,180,243,201,309,206,320,158,327,108,440,196,170,201,480,201;218,179,243,199,310,204,321,156,328,108,440,196,170,201,480,201;218,178,245,197,310,204,322,155,329,108,440,195,170,200,480,200;219,177,246,196,311,203,323,153,330,108,440,195,170,200,480,200;220,176,247,195,312,202,324,151,331,108,440,194,170,199,480,199;220,175,247,194,312,202,325,150,331,108,440,193,170,198,480,198;221,175,247,194,312,202,325,150,331,108,440,193,170,198,480,198;221,175,247,195,312,203,324,151,331,108,440,193,170,198,480,198;221,175,247,195,312,203,323,152,331,108,440,192,170,197,480,197;221,175,246,196,311,203,322,153,331,108,439,192,170,197,480,197;221,174,246,196,310,203,321,154,331,108,439,192,170,197,480,197;221,174,245,197,310,203,321,156,331,109,439,192,170,196,480,196;221,174,244,198,311,204,320,157,331,109,439,191,170,196,480,196;221,173,244,200,312,204,319,157,331,109,439,191,170,196,480,196;221,173,244,199,312,203,319,156,331,108,439,191,170,195,480,195;221,172,243,198,310,203,319,156,331,107,439,191,170,195,480,195;221,171,242,197,309,202,318,156,331,107,438,190,170,195,480,195;220,171,241,195,308,201,318,156,330,107,438,190,170,194,480,194;220,171,240,194,307,201,317,156,330,107,438,190,170,194,480,194;219,170,240,193,307,200,316,155,329,106,438,190,170,194,480,194;219,170,241,194,307,199,315,153,328,104,438,189,170,193,480,193;219,170,241,194,306,199,315,153,327,104,438,189,170,193,480,193;219,170,241,194,305,199,315,152,326,104,437,189,170,193,480,193;219,169,241,193,303,199,314,152,325,103,437,189,170,193,480,193;219,168,240,192,302,198,313,152,324,102,437,188,170,192,480,192;218,168,238,192,302,198,313,152,324,102,437,188,170,192,480,192;218,168,238,192,303,198,313,152,325,103,437,188,170,192,480,192;218,168,238,194,304,199,313,153,326,105,437,188,170,191,480,191;219,168,240,195,305,199,313,154,329,106,437,188,170,191,480,191;218,168,241,194,304,199,312,156,335,110,436,187,170,191,480,191;218,167,241,192,303,200,311,158,343,116,436,187,170,190,480,190;218,167,239,190,302,200,311,159,348,122,436,187,170,190,480,190;218,167,238,190,301,200,310,160,352,129,436,187,170,190,480,190;218,167,237,190,301,200,310,160,356,136,436,186,170,189,480,189;218,167,237,190,302,200,310,161,359,143,436,186,170,189,480,189;218,166,238,190,303,201,310,161,359,152,435,186,170,189,480,189;219,166,239,189,304,200,309,161,359,162,435,186,170,189,480,189;219,165,239,188,304,200,308,161,358,169,435,185,170,188,480,188;219,164,238,188,303,200,307,161,357,175,435,185,170,188,480,188;219,163,237,187,303,201,308,161,356,180,435,185,170,188,480,188;220,162,238,187,302,202,309,160,355,182,435,185,170,187,480,187;221,162,239,187,302,202,310,160,354,183,434,184,170,187,480,187;221,161,240,185,303,202,312,160,354,184,434,184,170,187,480,187;222,161,241,184,303,200,315,159,353,185,434,184,170,186,480,186;223,161,241,184,304,197,316,159,352,187,434,184,170,186,480,186;224,160,242,184,305,196,318,160,353,188,434,183,170,186,480,186;224,160,243,184,306,195,320,160,354,188,434,183,170,185,480,185;224,160,244,184,307,194,320,160,357,187,434,183,170,185,480,185;224,160,245,183,308,192,321,159,361,184,433,183,170,185,480,185;224,160,245,182,309,190,321,158,362,183,433,182,170,184,480,184;224,160,245,181,309,189,321,158,363,182,433,182,170,184,480,184;223,159,245,181,309,189,321,158,363,182,433,182,170,184,480,184;223,158,245,181,309,189,321,158,361,182,433,181,170,183,480,183;223,157,244,181,308,189,320,157,359,182,434,181,170,182,480,182;223,156,244,181,308,189,320,156,356,182,434,180,170,182,480,182;223,155,244,181,307,189,320,154,355,181,434,180,170,181,480,181;222,155,243,179,307,188,321,151,357,179,434,179,170,180,480,180;222,154,243,176,308,187,323,150,361,178,435,179,170,179,480,179;221,153,242,174,308,187,326,149,364,177,435,178,170,179,480,179;220,152,241,174,308,188,330,150,369,176,435,177,170,178,480,178;219,151,241,173,308,187,334,150,374,175,435,177,170,177,480,177;219,150,240,173,308,185,339,152,382,174,435,176,170,177,480,177;218,150,238,172,307,183,344,155,393,174,436,176,170,176,480,176;218,149,238,172,307,182,348,158,401,173,436,175,170,175,480,175;218,148,237,172,307,181,353,159,406,172,436,175,170,175,480,175;218,147,237,171,308,179,359,161,412,171,436,174,170,174,480,174;218,144,237,168,308,178,364,164,415,170,437,174,170,173,480,173;218,143,237,165,308,177,367,166,418,170,437,173,170,172,480,172;217,142,237,163,308,174,369,167,420,170,437,173,170,172,480,172;216,141,237,162,309,172,370,168,420,170,437,172,170,171,480,171;216,141,238,161,309,170,369,167,420,170,438,172,170,170,480,170;216,141,238,162,309,169,369,167,423,170,438,171,170,170,480,170;216,141,239,162,310,168,370,167,426,169,438,171,170,169,480,169;216,141,239,162,311,167,370,167,428,168,438,170,170,168,480,168;216,141,240,162,313,166,371,166,428,167,438,169,170,168,480,168;216,141,241,162,314,165,371,165,429,166,439,169,170,167,480,167;216,141,242,161,314,164,373,164,431,165,439,168,170,166,480,166;216,141,243,159,315,163,374,164,434,163,439,168,170,165,480,165;216,141,244,158,315,163,374,164,437,162,439,167,170,165,480,165;216,140,245,157,315,164,375,165,440,161,440,167,170,164,480,164;216,140,245,157,315,164,375,165,442,161,440,166,170,163,480,163;217,139,245,157,315,164,375,165,442,161,440,166,170,163,480,163;217,139,245,157,315,164,375,164,440,161,440,166,170,163,480,163;217,139,245,157,316,163,376,163,438,161,440,166,170,163,480,163;217,139,245,156,317,162,377,163,436,161,440,166,170,163,480,163;217,139,245,156,317,161,377,163,436,162,440,166,170,163,480,163;217,139,245,156,317,161,377,163,435,163,440,166,170,163,480,163;217,138,245,156,317,161,377,163,435,165,440,166,170,163,480,163;218,138,245,155,318,161,377,163,435,166,440,166,170,163,480,163;219,137,246,154,318,160,377,161,433,164,440,166,170,163,480,163;219,137,246,154,319,160,378,160,433,162,440,166,170,163,480,163'.split(';').map(row => {
    const v = row.split(',').map(Number);
    return { head: [v[0], v[1]], shoulder: [v[2], v[3]], hip: [v[4], v[5]], knee: [v[6], v[7]], ankle: [v[8], v[9]], ankleB: [v[10], v[11]], waterA: [v[12], v[13]], waterB: [v[14], v[15]] };
  });
  // Readings from the reviewed demo annotations, scored by the app's own measurement engine.
  const CHECKPOINTS = [
    { t: 1.0, where: 'Checkpoint 1 of 5 · reference', name: 'Back Layout', metric: 'Trunk vs surface', value: 4.8, verdict: 'Small deviation', band: 'small', guide: 'trunk' },
    { t: 3.5, where: 'Checkpoint 2 of 5 · 24% of the score', name: 'Bent Knee', metric: 'Thigh from vertical', value: 26.6, verdict: 'Medium deviation · −0.5', band: 'medium', guide: 'thigh' },
    { t: 6.5, where: 'Checkpoint 3 of 5 · 26% of the score', name: 'Ballet Leg', metric: 'Raised leg from vertical', value: 11.4, verdict: 'Small deviation · −0.2', band: 'small', guide: 'leg' },
    { t: 9.5, where: 'Checkpoint 4 of 5 · 26% of the score', name: 'Bent Knee', metric: 'Thigh from vertical', value: 21.2, verdict: 'Medium deviation · −0.5', band: 'medium', guide: 'thigh' },
    { t: 11.5, where: 'Checkpoint 5 of 5 · 24% of the score', name: 'Back Layout', metric: 'Surface leg alignment', value: 0.9, verdict: 'Within tolerance', band: 'small', guide: 'surface' }
  ];
  const NEXT_MOVE = { where: 'Your next focus', name: 'Ballet Leg', metric: 'Raised leg', value: 11.4, tail: ' off vertical', verdict: 'Biggest gain · 26% of score', band: 'small', guide: 'leg' };
  const SCENES = [
    ['Start with your clip.', 'Choose a figure. Add a practice video.'],
    ['Catch the little things.', 'Review your body line, height and alignment.'],
    ['Know what to work on.', 'Find your focus for the next practice.']
  ];
  const DURATION = (TRACK.length - 1) / FPS;
  const ACQUIRE_MS = 950, LOCK_MS = 1900, END_MS = 4200, RESUME_MS = 900;
  const APPEAR = { head: .12, shoulder: .22, hip: .32, knee: .42, ankle: .52, ankleB: .6 };
  const AQUA = '#B8E2FF', GOLD = '#FFCF6B', NIGHT = '#011022';
  // The swimmer fills only part of the wide clip, so the screen frames them 1.42× closer.
  const CAM = { z: 1.42, x: 340, y: 225 };
  video.style.transformOrigin = `${CAM.x / 640 * 100}% ${CAM.y / 360 * 100}%`;
  video.style.transform = `scale(${CAM.z})`;

  let mode = 'poster', modeStart = 0, lockIndex = 2, nextLock = 0, chapter = -1;
  let userPaused = reduced.matches, scrubbing = false, scrubT = 6.5, holdUntil = 0, animateUntil = 0;
  let inView = true, raf = 0, loaded = false, loadStarted = false, lastAngle = '', lastAria = '';
  const passed = new Set();

  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
  const ease = x => 1 - Math.pow(1 - clamp(x, 0, 1), 3);
  const lerp = (a, b, u) => [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u];
  function poseAt(t) {
    const f = clamp(t, 0, DURATION) * FPS, i = Math.floor(f), j = Math.min(TRACK.length - 1, i + 1), u = f - i;
    const out = {};
    for (const key in TRACK[i]) out[key] = lerp(TRACK[i][key], TRACK[j][key], u);
    return out;
  }
  /** Surface direction and upward normal from the waterline, as in the app's measurement engine. */
  function surface(p) {
    let u = [p.waterB[0] - p.waterA[0], p.waterB[1] - p.waterA[1]];
    const m = Math.hypot(...u); u = [u[0] / m, u[1] / m];
    if (u[0] < 0) u = [-u[0], -u[1]];
    let n = [u[1], -u[0]];
    if (n[1] > 0) n = [-n[0], -n[1]];
    return { u, n };
  }
  const elevation = p => {
    const { u, n } = surface(p), v = [p.ankle[0] - p.hip[0], p.ankle[1] - p.hip[1]];
    return clamp(Math.atan2(v[0] * n[0] + v[1] * n[1], v[0] * u[0] + v[1] * u[1]) * 180 / Math.PI, 0, 180);
  };

  CHECKPOINTS.forEach((cp, i) => {
    const li = document.createElement('li');
    li.style.setProperty('--at', (cp.t / DURATION * 100).toFixed(2) + '%');
    li.title = cp.name;
    li.append(document.createElement('i'));
    ticks.append(li);
    cp.tick = li;
  });

  /* ---------------------------------------------------------- loading */
  function fetchClip() {
    if (!window.fsDemoClip) {
      window.fsDemoClip = fetch(clipUrl).then(response => {
        if (!response.ok) throw new Error('The demo video could not be loaded.');
        return response.blob();
      });
      window.fsDemoClip.catch(() => { window.fsDemoClip = null; });
    }
    return window.fsDemoClip;
  }
  function loadClip() {
    if (loadStarted || !clipUrl) return;
    loadStarted = true;
    fetchClip().then(blob => {
      video.src = URL.createObjectURL(blob);
      video.addEventListener('loadeddata', () => {
        loaded = true;
        screen.classList.add('has-video');
        if (userPaused) showStatic(); else startCycle(performance.now());
      }, { once: true });
    }).catch(() => { loadStarted = false; chip('Scrub to explore the reviewed checkpoints'); });
  }

  /* ---------------------------------------------------- state machine */
  const chip = text => { if (chipText.textContent !== text) chipText.textContent = text; };
  function setChapter(i) {
    if (i === chapter) return;
    chapter = i;
    tabs.forEach((tab, k) => {
      tab.setAttribute('aria-selected', String(k === i));
      tab.tabIndex = k === i ? 0 : -1;
    });
    const [title, body] = SCENES[i];
    const text = caption.querySelector(':scope > span');
    text.querySelector('b').textContent = title;
    text.querySelector('span').textContent = body;
    caption.classList.remove('is-changing');
    void caption.offsetWidth;
    caption.classList.add('is-changing');
  }
  function showLock(card) {
    document.getElementById('anLockWhere').textContent = card.where;
    document.getElementById('anLockTitle').textContent = card.name;
    const metric = document.getElementById('anLockMetric');
    metric.replaceChildren(card.metric + ' ', Object.assign(document.createElement('b'), { textContent: card.value.toFixed(1) + '°' }), card.tail || '');
    const verdict = document.getElementById('anLockVerdict');
    verdict.textContent = card.verdict;
    verdict.classList.toggle('is-medium', card.band === 'medium');
    lock.classList.remove('is-shown');
    void lock.offsetWidth;
    lock.classList.add('is-shown');
  }
  function markTicks(t, current = -1) {
    CHECKPOINTS.forEach((cp, i) => {
      cp.tick.classList.toggle('is-passed', t >= cp.t - .01);
      cp.tick.classList.toggle('is-current', i === current);
    });
  }
  function seek(t) { if (loaded) video.currentTime = clamp(t, 0, Math.max(0, (video.duration || DURATION) - .01)); }
  function play() { if (loaded && !userPaused && active()) video.play().catch(blocked); }
  function blocked() { userPaused = true; syncMotion(); }

  function startCycle(now) {
    mode = 'acquire'; modeStart = now; nextLock = 0; lockIndex = -1; passed.clear(); stage.classList.remove('is-ending');
    seek(0); markTicks(-1); lock.classList.remove('is-shown'); screen.classList.remove('is-locked');
    chip('Finding the swimmer'); setChapter(0); play(); kick();
  }
  function lockOn(i, now, settle = true) {
    const cp = CHECKPOINTS[i];
    video.pause(); seek(cp.t);
    mode = 'lock'; modeStart = settle ? now : now - 10000; lockIndex = i; nextLock = i + 1; stage.classList.remove('is-ending');
    animateUntil = now + 900;
    markTicks(cp.t, i); showLock(cp); screen.classList.add('is-locked');
    chip('Checkpoint locked'); setChapter(1); kick();
  }
  function finish(now) {
    video.pause(); seek(DURATION);
    mode = 'end'; modeStart = now; lockIndex = 2; animateUntil = now + 900; stage.classList.add('is-ending');
    markTicks(DURATION, -1); showLock(NEXT_MOVE); screen.classList.add('is-locked');
    chip('Your next focus'); setChapter(2); kick();
  }
  function showStatic() { lockOn(2, performance.now(), !reduced.matches); }

  function currentTime() {
    if (scrubbing || mode === 'hold') return scrubT;
    if (mode === 'lock' || mode === 'poster') return CHECKPOINTS[lockIndex].t;
    if (mode === 'end') return DURATION;
    return loaded ? video.currentTime : 0;
  }

  function step(now) {
    if (scrubbing) return;
    if (mode === 'acquire' && now - modeStart > ACQUIRE_MS) { mode = 'play'; chip('Tracking joints'); setChapter(1); }
    if ((mode === 'acquire' || mode === 'play') && loaded && !video.paused) {
      const t = video.currentTime;
      if (nextLock < CHECKPOINTS.length && t >= CHECKPOINTS[nextLock].t) lockOn(nextLock, now);
      else if (t >= DURATION - .04) finish(now);
      else markTicks(t);
    }
    if (userPaused) return;
    if (mode === 'lock' && now - modeStart > LOCK_MS) {
      mode = 'play'; screen.classList.remove('is-locked'); chip('Tracking joints');
      CHECKPOINTS[lockIndex].tick.classList.remove('is-current');
      play();
    }
    if (mode === 'hold' && now > holdUntil) { mode = 'play'; chip('Tracking joints'); play(); }
    if (mode === 'end' && now - modeStart > END_MS) startCycle(now);
  }

  /* ---------------------------------------------------------- drawing */
  function resize() {
    const dpr = Math.min(2, devicePixelRatio || 1);
    const w = Math.round(screen.clientWidth * dpr), h = Math.round(screen.clientHeight * dpr);
    if (w && (canvas.width !== w || canvas.height !== h)) { canvas.width = w; canvas.height = h; }
    draw(performance.now());
  }
  function label(text, x, y, k, color) {
    ctx.font = `700 ${11 * k}px Manrope, system-ui, sans-serif`;
    const w = ctx.measureText(text).width;
    ctx.fillStyle = 'rgba(1, 16, 34, .82)';
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(x - 6 * k, y - 13 * k, w + 12 * k, 19 * k, 5 * k); else ctx.rect(x - 6 * k, y - 13 * k, w + 12 * k, 19 * k);
    ctx.fill();
    ctx.fillStyle = color; ctx.fillText(text, x, y);
  }
  function draw(now) {
    const W = canvas.width, H = canvas.height;
    if (!W) return;
    const k = W / 640;
    ctx.clearRect(0, 0, W, H);
    const t = currentTime();
    const raw = poseAt(t), P = {};
    for (const key in raw) P[key] = [(CAM.x + (raw[key][0] - CAM.x) * CAM.z) * k, (CAM.y + (raw[key][1] - CAM.y) * CAM.z) * (H / 360)];
    const acq = mode === 'acquire' ? (now - modeStart) / 1000 : 9;
    const shown = key => acq >= APPEAR[key];

    if (mode === 'acquire') {
      const x = W * ease(acq / .85) - 40 * k;
      const beam = ctx.createLinearGradient(x - 70 * k, 0, x + 30 * k, 0);
      beam.addColorStop(0, 'rgba(184, 226, 255, 0)');
      beam.addColorStop(.8, 'rgba(184, 226, 255, .22)');
      beam.addColorStop(1, 'rgba(184, 226, 255, 0)');
      ctx.fillStyle = beam; ctx.fillRect(x - 70 * k, 0, 100 * k, H);
    }

    // The surface reference, extended across the frame.
    const { u, n } = surface(P);
    const reveal = ease((acq - .02) / .45);
    const a = [P.waterA[0] - u[0] * 2000, P.waterA[1] - u[1] * 2000];
    ctx.save();
    ctx.beginPath(); ctx.rect(0, 0, W * reveal, H); ctx.clip();
    ctx.setLineDash([7 * k, 6 * k]); ctx.lineWidth = 1.6 * k; ctx.strokeStyle = 'rgba(255, 207, 107, .8)';
    ctx.beginPath(); ctx.moveTo(...a); ctx.lineTo(a[0] + u[0] * 4000, a[1] + u[1] * 4000); ctx.stroke();
    ctx.restore();
    ctx.setLineDash([]);

    const bones = [['head', 'shoulder', .5], ['shoulder', 'hip', 1], ['hip', 'knee', 1], ['knee', 'ankle', 1], ['hip', 'ankleB', .7]];
    for (const [from, to, alpha] of bones) {
      if (!shown(from) || !shown(to)) continue;
      const grow = ease((acq - Math.max(APPEAR[from], APPEAR[to])) / .3);
      const end = lerp(P[from], P[to], grow);
      ctx.lineCap = 'round';
      ctx.strokeStyle = 'rgba(1, 16, 34, .55)'; ctx.lineWidth = 5.5 * k;
      ctx.beginPath(); ctx.moveTo(...P[from]); ctx.lineTo(...end); ctx.stroke();
      ctx.strokeStyle = from === 'hip' && to === 'ankleB' ? `rgba(238, 245, 255, ${alpha})` : `rgba(184, 226, 255, ${alpha})`;
      ctx.lineWidth = 2.6 * k;
      ctx.beginPath(); ctx.moveTo(...P[from]); ctx.lineTo(...end); ctx.stroke();
    }

    const card = mode === 'end' ? NEXT_MOVE : CHECKPOINTS[lockIndex];
    const guiding = (mode === 'lock' || mode === 'end' || mode === 'poster') && card;
    const p = guiding ? ease((now - modeStart - 120) / 700) : 0;
    if (guiding) drawGuide(card, P, u, n, k, p);
    else if (shown('ankle') && mode !== 'poster') {
      // Live lift: the raised leg's angle above the surface, drawn at the hip.
      const s = Math.atan2(u[1], u[0]), e = Math.atan2(P.ankle[1] - P.hip[1], P.ankle[0] - P.hip[0]);
      const sweep = (e - s + Math.PI * 3) % (Math.PI * 2) - Math.PI;
      ctx.strokeStyle = 'rgba(255, 207, 107, .75)'; ctx.lineWidth = 2 * k;
      ctx.beginPath(); ctx.arc(...P.hip, 24 * k, s, s + sweep, sweep < 0); ctx.stroke();
    }

    for (const key of ['head', 'shoulder', 'hip', 'knee', 'ankle', 'ankleB']) {
      if (!shown(key)) continue;
      const q = (acq - APPEAR[key]) / .45;
      if (q < 1) {
        ctx.strokeStyle = `rgba(184, 226, 255, ${1 - q})`; ctx.lineWidth = 1.5 * k;
        ctx.beginPath(); ctx.arc(...P[key], (5 + 16 * ease(q)) * k, 0, Math.PI * 2); ctx.stroke();
      }
      if (guiding && p < 1) {
        ctx.strokeStyle = `rgba(255, 207, 107, ${.8 * (1 - p)})`; ctx.lineWidth = 1.5 * k;
        ctx.beginPath(); ctx.arc(...P[key], (6 + 14 * p) * k, 0, Math.PI * 2); ctx.stroke();
      }
      const r = (key === 'head' ? 6 : 4.4) * k;
      ctx.beginPath(); ctx.arc(...P[key], r, 0, Math.PI * 2);
      ctx.lineWidth = 1.6 * k; ctx.strokeStyle = NIGHT;
      if (key === 'head') { ctx.fillStyle = 'rgba(1, 16, 34, .35)'; ctx.fill(); ctx.strokeStyle = AQUA; ctx.stroke(); continue; }
      ctx.fillStyle = key === 'hip' ? GOLD : key === 'ankleB' ? '#EEF5FF' : AQUA;
      ctx.fill(); ctx.stroke();
    }

    const angle = String(Math.round(elevation(raw)));
    if (angle !== lastAngle) { angleOut.textContent = angle; lastAngle = angle; }
    fill.style.width = (t / DURATION * 100).toFixed(2) + '%';
    const aria = t.toFixed(1);
    if (aria !== lastAria) {
      lastAria = aria;
      scrub.setAttribute('aria-valuenow', aria);
      const near = CHECKPOINTS.find(cp => Math.abs(cp.t - t) < .2);
      scrub.setAttribute('aria-valuetext', `${aria} seconds${near ? ', ' + near.name + ' checkpoint' : ''}`);
    }
  }
  function drawGuide(card, P, u, n, k, p) {
    ctx.save();
    if (card.guide === 'leg' || card.guide === 'thigh') {
      const end = card.guide === 'leg' ? P.ankle : P.knee;
      const length = Math.hypot(end[0] - P.hip[0], end[1] - P.hip[1]) + 18 * k;
      ctx.setLineDash([5 * k, 5 * k]); ctx.strokeStyle = `rgba(255, 207, 107, ${.9 * p})`; ctx.lineWidth = 1.6 * k;
      ctx.beginPath(); ctx.moveTo(...P.hip); ctx.lineTo(P.hip[0] + n[0] * length * p, P.hip[1] + n[1] * length * p); ctx.stroke();
      ctx.setLineDash([]);
      const s = Math.atan2(n[1], n[0]), e = Math.atan2(end[1] - P.hip[1], end[0] - P.hip[0]);
      const sweep = (e - s + Math.PI * 3) % (Math.PI * 2) - Math.PI;
      ctx.strokeStyle = GOLD; ctx.lineWidth = 2.4 * k;
      ctx.beginPath(); ctx.arc(...P.hip, 38 * k, s, s + sweep * p, sweep < 0); ctx.stroke();
      ctx.strokeStyle = 'rgba(184, 226, 255, .95)'; ctx.lineWidth = 4 * k; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(...P.hip); ctx.lineTo(...end); ctx.globalAlpha = .35 * p; ctx.stroke(); ctx.globalAlpha = 1;
      if (p > .05) label(`${(card.value * p).toFixed(1)}°`, P.hip[0] + (sweep < 0 ? -84 : 46) * k, P.hip[1] - 36 * k, k, GOLD);
    } else {
      const [from, to] = card.guide === 'trunk' ? ['shoulder', 'hip'] : ['hip', 'ankleB'];
      ctx.strokeStyle = `rgba(255, 207, 107, ${.85 * p})`; ctx.lineWidth = 5 * k; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(...P[from]); ctx.lineTo(...lerp(P[from], P[to], p)); ctx.stroke();
      const mid = lerp(P[from], P[to], .5);
      if (p > .05) label(`${(card.value * p).toFixed(1)}°`, mid[0] - 14 * k, mid[1] - 18 * k, k, GOLD);
    }
    ctx.restore();
  }

  /* ------------------------------------------------------------- loop */
  const active = () => inView && !document.hidden && document.body.dataset.page === 'home';
  function frame(now) {
    raf = 0;
    if (!active()) return;
    step(now);
    draw(now);
    const moving = loaded && !video.paused;
    if (moving || scrubbing || mode === 'acquire' || now < animateUntil || (!userPaused && ['lock', 'hold', 'end'].includes(mode))) kick();
  }
  function kick() { if (!raf && active()) raf = requestAnimationFrame(frame); }
  function refresh() {
    if (active()) {
      if (!loaded && !loadStarted && !navigator.connection?.saveData) loadClip();
      if (loaded && !userPaused && (mode === 'acquire' || mode === 'play')) play();
      kick();
    } else if (loaded) video.pause();
  }

  /* ------------------------------------------------------- scrubbing */
  let dragStart = null;
  const timeAt = clientX => {
    const box = scrub.getBoundingClientRect();
    return clamp((clientX - box.left) / box.width, 0, 1) * DURATION;
  };
  function scrubTo(t) {
    scrubT = clamp(t, 0, DURATION);
    seek(scrubT);
    markTicks(scrubT);
    setChapter(scrubT < CHECKPOINTS[0].t - .05 ? 0 : 1);
    kick();
  }
  function release(now, t) {
    const near = CHECKPOINTS.findIndex(cp => Math.abs(cp.t - t) < .3);
    if (near >= 0) { lockOn(near, now); return; }
    mode = 'hold'; holdUntil = now + RESUME_MS; nextLock = CHECKPOINTS.findIndex(cp => cp.t > t + .01); stage.classList.remove('is-ending');
    if (nextLock < 0) nextLock = CHECKPOINTS.length;
    lock.classList.remove('is-shown'); screen.classList.remove('is-locked');
    chip(userPaused ? 'Paused · drag to explore' : 'Tracking joints');
    kick();
  }
  screen.addEventListener('pointerdown', event => {
    if (event.button !== 0 || event.target.closest('button')) return;
    loadClip();
    dragStart = { x: event.clientX, y: event.clientY, moved: false, id: event.pointerId };
  });
  screen.addEventListener('pointermove', event => {
    if (!dragStart) {
      if (event.pointerType !== 'mouse' || reduced.matches) return;
      const box = screen.getBoundingClientRect();
      screen.style.setProperty('--tilt-x', `${((event.clientX - box.left) / box.width - .5) * 7}deg`);
      screen.style.setProperty('--tilt-y', `${((event.clientY - box.top) / box.height - .5) * -5}deg`);
      return;
    }
    const dx = event.clientX - dragStart.x, dy = event.clientY - dragStart.y;
    if (!dragStart.moved) {
      if (Math.abs(dy) > Math.abs(dx) && Math.abs(dy) > 8) { dragStart = null; return; }
      if (Math.abs(dx) < 6) return;
      dragStart.moved = true; scrubbing = true; video.pause();
      screen.classList.add('is-scrubbing'); screen.setPointerCapture(dragStart.id);
      lock.classList.remove('is-shown'); screen.classList.remove('is-locked');
      chip('Scrubbing');
    }
    scrubTo(timeAt(event.clientX));
  });
  function endDrag(event) {
    if (!dragStart) return;
    const moved = dragStart.moved;
    dragStart = null; scrubbing = false; screen.classList.remove('is-scrubbing');
    const t = moved ? scrubT : timeAt(event.clientX);
    if (!moved) { video.pause(); scrubTo(t); }
    release(performance.now(), t);
  }
  screen.addEventListener('pointerup', endDrag);
  screen.addEventListener('pointercancel', () => { dragStart = null; scrubbing = false; screen.classList.remove('is-scrubbing'); });
  screen.addEventListener('pointerleave', () => { screen.style.setProperty('--tilt-x', '0deg'); screen.style.setProperty('--tilt-y', '0deg'); });
  scrub.addEventListener('keydown', event => {
    const t = currentTime();
    let next;
    if (event.key === 'ArrowRight' || event.key === 'ArrowUp') next = t + (event.shiftKey ? 2 : .5);
    else if (event.key === 'ArrowLeft' || event.key === 'ArrowDown') next = t - (event.shiftKey ? 2 : .5);
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = DURATION;
    else if (event.key === 'PageDown') next = (CHECKPOINTS.find(cp => cp.t > t + .05) || CHECKPOINTS.at(-1)).t;
    else if (event.key === 'PageUp') next = ([...CHECKPOINTS].reverse().find(cp => cp.t < t - .05) || CHECKPOINTS[0]).t;
    if (next === undefined) return;
    event.preventDefault();
    loadClip(); video.pause(); scrubTo(next); release(performance.now(), scrubT);
  });

  /* ------------------------------------------------- chapters & motion */
  function jump(i) {
    loadClip();
    const now = performance.now();
    if (i === 0) { if (loaded) startCycle(now); else setChapter(0); }
    else if (i === 1) lockOn(0, now);
    else finish(now);
  }
  tabs.forEach((tab, index) => {
    tab.addEventListener('click', () => jump(index));
    tab.addEventListener('keydown', event => {
      let next;
      if (event.key === 'ArrowRight') next = (index + 1) % tabs.length;
      if (event.key === 'ArrowLeft') next = (index + tabs.length - 1) % tabs.length;
      if (event.key === 'Home') next = 0;
      if (event.key === 'End') next = tabs.length - 1;
      if (next === undefined) return;
      event.preventDefault();
      jump(next);
      tabs[next].focus();
    });
  });
  function syncMotion() {
    hero.classList.toggle('motion-paused', userPaused);
    motion.setAttribute('aria-pressed', String(userPaused));
    motion.setAttribute('aria-label', userPaused ? 'Play the live analysis' : 'Pause the live analysis');
    motion.title = userPaused ? 'Play' : 'Pause';
  }
  motion.addEventListener('click', () => {
    userPaused = !userPaused;
    syncMotion();
    loadClip();
    const now = performance.now();
    if (userPaused) { video.pause(); chip('Paused · drag to explore'); }
    else if (mode === 'poster' || mode === 'end') startCycle(now);
    else { modeStart = now; holdUntil = now; if (mode === 'acquire' || mode === 'play') play(); }
    kick();
  });
  reduced.addEventListener('change', event => { if (event.matches) { userPaused = true; video.pause(); syncMotion(); } });

  // A finished or newly started clip must wake the loop, which sleeps while nothing moves.
  video.addEventListener('ended', () => { if (mode === 'play' || mode === 'acquire') finish(performance.now()); });
  video.addEventListener('playing', kick);
  new ResizeObserver(resize).observe(screen);
  new IntersectionObserver(entries => { inView = entries[0].isIntersecting; refresh(); }, { threshold: .15 }).observe(stage);
  document.addEventListener('visibilitychange', refresh);
  new MutationObserver(refresh).observe(document.body, { attributes: true, attributeFilter: ['data-page'] });
  syncMotion();
  setChapter(0);
  // Until the clip arrives, the reviewed Ballet Leg checkpoint stands in as a complete still.
  showLock(CHECKPOINTS[2]); markTicks(CHECKPOINTS[2].t, 2); screen.classList.add('is-locked');
  chip('Drag to explore the checkpoints');
  // Let the page paint first; the 7 MB clip follows once the browser is idle.
  const idle = window.requestIdleCallback || (cb => setTimeout(cb, 600));
  addEventListener('load', () => idle(refresh, { timeout: 1500 }), { once: true });
  resize();
})();
