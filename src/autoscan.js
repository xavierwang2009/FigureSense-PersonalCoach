/**
 * Automatic checkpoint finder.
 *
 * Pose estimators are trained on people standing on land. On a swimmer who is inverted,
 * half submerged and refracted, the skeleton is unreliable — so the checkpoint search
 * does NOT depend on it. Instead it builds a background model of the still pool, then
 * measures the swimmer's silhouette *above the waterline* on every frame:
 *
 *   how tall it stands, how wide it lies, how much of it is out of the water at all.
 *
 * Those three numbers separate a layout from a vertical from a submerged body very
 * reliably, because they are exactly what the positions differ in. Pose landmarks are
 * still collected, but only to pre-fill the dots once a frame has been chosen.
 */

const SCAN_W = 320;
const FG_THRESHOLD = 26;
const clamp01 = v => Math.min(1, Math.max(0, v));

/* ------------------------------------------------------------------ */
/* Scanning                                                            */
/* ------------------------------------------------------------------ */

/**
 * Play the clip once, keeping a greyscale thumbnail and a pose per processed frame.
 * @returns {Promise<Array<{time:number, lm:object[]|null, gray:Uint8Array}>>}
 */
export function scanVideo(video, model, { onProgress } = {}) {
  return new Promise((resolve, reject) => {
    const w = SCAN_W;
    const h = Math.max(1, Math.round((w * video.videoHeight) / video.videoWidth));
    const work = document.createElement('canvas');
    work.width = w;
    work.height = h;
    const wctx = work.getContext('2d', { willReadFrequently: true });

    const samples = [];
    let lastTs = 0;
    let stopped = false;
    const duration = video.duration || 0;

    const grab = () => {
      wctx.drawImage(video, 0, 0, w, h);
      const rgba = wctx.getImageData(0, 0, w, h).data;
      const gray = new Uint8Array(w * h);
      for (let i = 0, p = 0; i < gray.length; i++, p += 4) {
        gray[i] = (rgba[p] * 77 + rgba[p + 1] * 151 + rgba[p + 2] * 28) >> 8;
      }

      let lm = null;
      try {
        // detectForVideo needs real, strictly increasing millisecond timestamps.
        const ts = Math.max(lastTs + 1, Math.round(video.currentTime * 1000));
        lastTs = ts;
        lm = model?.detectForVideo(work, ts).landmarks?.[0] ?? null;
      } catch { lm = null; }

      samples.push({ time: video.currentTime, lm, gray });
      onProgress?.(duration ? video.currentTime / duration : 0);
    };

    const finish = () => {
      if (stopped) return;
      stopped = true;
      video.pause();
      video.removeEventListener('ended', finish);
      samples.length >= 4 ? resolve(samples) : reject(new Error('Too few frames could be read from this clip.'));
    };

    const useRvfc = typeof video.requestVideoFrameCallback === 'function';
    const step = () => {
      if (stopped) return;
      grab();
      if (video.ended || video.paused) { finish(); return; }
      useRvfc ? video.requestVideoFrameCallback(step) : requestAnimationFrame(step);
    };

    video.addEventListener('ended', finish);
    video.muted = true;
    video.playbackRate = 1;
    video.currentTime = 0;
    video.play()
      .then(() => { useRvfc ? video.requestVideoFrameCallback(step) : requestAnimationFrame(step); })
      .catch(reject);
  });
}

/* ------------------------------------------------------------------ */
/* Silhouette features                                                 */
/* ------------------------------------------------------------------ */

/** Per-pixel median of up to 21 evenly spaced frames: the empty pool. */
export function backgroundOf(grays, size) {
  const take = Math.min(21, grays.length);
  const picks = [];
  for (let i = 0; i < take; i++) picks.push(grays[Math.floor((i * (grays.length - 1)) / Math.max(1, take - 1))]);
  const bg = new Uint8Array(size);
  const bucket = new Uint8Array(take);
  for (let p = 0; p < size; p++) {
    for (let k = 0; k < take; k++) bucket[k] = picks[k][p];
    const sorted = Array.prototype.slice.call(bucket).sort((a, b) => a - b);
    bg[p] = sorted[take >> 1];
  }
  return bg;
}

/**
 * Raw silhouette measurements above the waterline, in scan pixels.
 * `waterline` is [[x,y],[x,y]] in 0..1 image fractions.
 */
export function silhouette(gray, bg, w, h, waterline) {
  const [[ax, ay], [bx, by]] = waterline;
  const x0 = ax * w, y0 = ay * h, x1 = bx * w, y1 = by * h;
  const slope = Math.abs(x1 - x0) < 1e-6 ? 0 : (y1 - y0) / (x1 - x0);
  const lineY = x => y0 + slope * (x - x0);

  let count = 0, minY = Infinity, minX = Infinity, maxX = -Infinity, above = 0;
  for (let x = 0; x < w; x++) {
    const limit = Math.min(h, Math.floor(lineY(x) - 2));
    for (let y = 0; y < limit; y++) {
      above++;
      const p = y * w + x;
      if (Math.abs(gray[p] - bg[p]) <= FG_THRESHOLD) continue;
      count++;
      if (y < minY) minY = y;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
    }
  }
  if (!count) return { area: 0, top: 0, width: 0 };
  return {
    area: count / Math.max(1, above),
    top: Math.max(0, lineY((minX + maxX) / 2) - minY),
    width: maxX - minX + 1
  };
}

/** Attach normalised features (0..1) to every sample. */
export function addFeatures(samples, waterline, w, h) {
  const bg = backgroundOf(samples.map(s => s.gray), w * h);
  const raw = samples.map(s => silhouette(s.gray, bg, w, h, waterline));
  const maxTop = Math.max(1e-6, ...raw.map(r => r.top));
  const maxWidth = Math.max(1e-6, ...raw.map(r => r.width));
  const maxArea = Math.max(1e-6, ...raw.map(r => r.area));
  samples.forEach((s, i) => {
    s.f = {
      h: clamp01(raw[i].top / maxTop),
      w: clamp01(raw[i].width / maxWidth),
      a: clamp01(raw[i].area / maxArea),
      raw: raw[i]
    };
  });
  return samples;
}

/* ------------------------------------------------------------------ */
/* Signatures                                                          */
/* ------------------------------------------------------------------ */

/**
 * Each signature scores how well one frame matches one position, using only
 * height / width / area of the silhouette above the surface.
 */
export const SIGNATURES = {
  // Whole body lying at the surface: long, flat, plenty showing.
  flatSurface: f => (1 - f.h) * f.w * clamp01(f.a * 1.6),

  // Legs at the surface but the trunk hanging straight down: long, flat, less showing.
  legsOnlySurface: f => (1 - f.h) * f.w * clamp01((0.75 - f.a) / 0.6),

  // Drawn into a ball at the surface: low and short, still visible.
  compactSurface: f => (1 - f.h) * (1 - f.w) * clamp01(f.a * 2.2),

  // Shins perpendicular out of the water: narrow and standing, but not yet at full height.
  narrowStanding: f => f.h * (1 - f.w) * clamp01(f.a * 2.5),

  // Maximum height, which is what the height charts actually grade.
  tallest: f => f.h * f.h * clamp01((1 - f.w) + 0.35),

  // Legs opened along the surface: the widest the swimmer ever gets while still up.
  widest: f => f.w * f.w * clamp01(f.h / 0.25),

  // A knee lifting while the body stays long at the surface.
  liftWhileFlat: f => f.w * clamp01(f.h / 0.45) * clamp01(f.a * 1.6),

  // Nothing left above the surface.
  submerged: f => clamp01((0.12 - f.a) / 0.12)
};

/* ------------------------------------------------------------------ */
/* Checkpoint picking                                                  */
/* ------------------------------------------------------------------ */

/** Longest run of frames with essentially nothing above the surface. */
export function submergedRun(samples) {
  let best = null, run = null;
  samples.forEach((s, i) => {
    const under = !s.f || s.f.a < 0.12;
    if (under) run = run ? { from: run.from, to: i } : { from: i, to: i };
    else if (run) { if (!best || run.to - run.from > best.to - best.from) best = run; run = null; }
  });
  if (run && (!best || run.to - run.from > best.to - best.from)) best = run;
  return best;
}

/** The Dolphin is defined by its circle, so its checkpoints are fractions of the dive. */
function pickDolphin(figure, samples) {
  const run = submergedRun(samples);
  if (!run || run.to - run.from < 3) return null;
  const at = frac => samples[Math.round(run.from + (run.to - run.from) * frac)].time;
  const byId = {
    start: samples[Math.max(0, run.from - 1)].time,
    q1: at(0.25),
    q2: at(0.5),
    q3: at(0.75),
    finish: samples[Math.min(samples.length - 1, run.to + 1)].time
  };
  const times = {};
  const confidence = {};
  for (const cp of figure.checkpoints) {
    if (byId[cp.id] === undefined) continue;
    times[cp.id] = byId[cp.id];
    confidence[cp.id] = 0.8;
  }
  return { times, confidence };
}

/**
 * Choose one frame per checkpoint, maximising total signature score while keeping the
 * checkpoints in the order the figure is performed.
 * @returns {{times:object, confidence:object}|null}
 */
export function pickCheckpoints(figure, samples) {
  if (figure.autoScan === 'dolphin') return pickDolphin(figure, samples);

  const cps = figure.checkpoints;
  const n = samples.length;
  if (n < cps.length) return null;

  const scores = cps.map(cp => {
    const fn = SIGNATURES[cp.signature];
    return samples.map(s => (s.f && fn ? fn(s.f) : 0));
  });

  const best = cps.map(() => new Float64Array(n).fill(-Infinity));
  const from = cps.map(() => new Int32Array(n).fill(-1));
  for (let i = 0; i < n; i++) best[0][i] = scores[0][i];
  for (let c = 1; c < cps.length; c++) {
    let runBest = -Infinity, runIdx = -1;
    for (let i = 0; i < n; i++) {
      if (i > 0 && best[c - 1][i - 1] > runBest) { runBest = best[c - 1][i - 1]; runIdx = i - 1; }
      if (runIdx >= 0) { best[c][i] = runBest + scores[c][i]; from[c][i] = runIdx; }
    }
  }

  const last = cps.length - 1;
  let endIdx = -1, endVal = -Infinity;
  for (let i = 0; i < n; i++) if (best[last][i] > endVal) { endVal = best[last][i]; endIdx = i; }
  if (endIdx < 0 || !Number.isFinite(endVal)) return null;

  const times = {};
  const confidence = {};
  let idx = endIdx;
  for (let c = last; c >= 0; c--) {
    times[cps[c].id] = samples[idx].time;
    // How much better this frame is than a typical frame for the same signature.
    const mean = scores[c].reduce((s, v) => s + v, 0) / n;
    confidence[cps[c].id] = clamp01((scores[c][idx] - mean) / Math.max(0.08, scores[c][idx] || 0.08));
    idx = from[c][idx];
    if (idx < 0 && c > 0) return null;
  }
  return { times, confidence };
}

/** Nearest scanned sample to a given time. */
export function sampleAt(samples, time) {
  if (!samples?.length) return null;
  let best = null, gap = Infinity;
  for (const s of samples) {
    const d = Math.abs(s.time - time);
    if (d < gap) { gap = d; best = s; }
  }
  return best;
}
