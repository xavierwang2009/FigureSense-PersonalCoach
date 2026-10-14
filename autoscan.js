// autoscan.js
// Body-point suggestions with MediaPipe Pose (Google, open source, Apache 2.0),
// and a scan that looks at the whole video a few frames per second.
// MediaPipe is downloaded from the internet the first time it is used.
// Everything runs in the browser: the video never leaves the device.

const MP_VERSION = '0.10.35';
const MP_BASE = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${MP_VERSION}`;
const MODEL_URL = 'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task';

// MediaPipe's numbers for the body points we use. [left, right]
const INDEX = { shoulder: [11, 12], hip: [23, 24], knee: [25, 26], ankle: [27, 28] };
export const MIN_VISIBILITY = 0.7;   // below this, a point is left for the swimmer to place

let modelPromise = null;

// Load MediaPipe once and reuse it.
export function loadPoseModel() {
  if (!modelPromise) {
    modelPromise = (async () => {
      const { FilesetResolver, PoseLandmarker } = await import(`${MP_BASE}/vision_bundle.mjs`);
      const files = await FilesetResolver.forVisionTasks(`${MP_BASE}/wasm`);
      return PoseLandmarker.createFromOptions(files, {
        baseOptions: { modelAssetPath: MODEL_URL },
        runningMode: 'IMAGE',
        numPoses: 1,
      });
    })();
    modelPromise.catch(() => { modelPromise = null; }); // allow a retry after a failure
  }
  return modelPromise;
}

// Find one person in a canvas. Returns both sides' points in pixels, or null.
//   { left: { shoulder: {x, y, vis}, ... }, right: { ... } }
export async function detectPose(canvas) {
  const model = await loadPoseModel();
  const result = model.detect(canvas);
  const lm = result.landmarks && result.landmarks[0];
  if (!lm) return null;
  const side = i => {
    const out = {};
    for (const [name, pair] of Object.entries(INDEX)) {
      const p = lm[pair[i]];
      out[name] = { x: p.x * canvas.width, y: p.y * canvas.height, vis: p.visibility ?? 0 };
    }
    return out;
  };
  return { left: side(0), right: side(1) };
}

// Wait until the video has moved to a new time and the frame is ready to draw.
export function seekTo(video, time) {
  return new Promise(resolve => {
    if (Math.abs(video.currentTime - time) < 0.001) { resolve(); return; }
    video.addEventListener('seeked', () => resolve(), { once: true });
    video.currentTime = time;
  });
}

// Look at the video every `step` seconds and detect the pose in each frame.
// Returns [{ time, pose }]. onProgress(fraction) reports how far it got.
export async function scanVideo(video, { step = 0.25, onProgress = () => {}, shouldStop = () => false } = {}) {
  await loadPoseModel();
  const canvas = document.createElement('canvas');
  // A smaller copy is enough for finding the moments and is much faster.
  const scale = Math.min(1, 640 / video.videoWidth);
  canvas.width = Math.round(video.videoWidth * scale);
  canvas.height = Math.round(video.videoHeight * scale);
  const ctx = canvas.getContext('2d');
  const samples = [];
  const total = Math.max(1, Math.floor(video.duration / step));
  for (let i = 0; i <= total; i++) {
    if (shouldStop()) break;
    const time = Math.min(video.duration - 0.01, i * step);
    await seekTo(video, time);
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const pose = await detectPose(canvas);
    if (pose) {
      // Store points in full-size video pixels.
      for (const s of ['left', 'right']) {
        for (const p of Object.values(pose[s])) { p.x /= scale; p.y /= scale; }
      }
    }
    samples.push({ time, pose });
    onProgress(i / total);
  }
  return samples;
}
