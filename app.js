// app.js
// Connects the page to the other modules: video, capture, marking points,
// saving checkpoints, results and drills. Saved progress stays in this browser; videos and frames stay in this tab.

import { LANDMARKS, BALLET_LEG as FIG, DRILLS, pointsNeeded, pointsUsed, videoLink } from './figures.js';
import { scoreCheckpoint, scoreFigure, waterFrame } from './geometry.js';
import { poseArt, deviationGauge, targetLine } from './poses.js';
import { detectPose, scanVideo, seekTo } from './autoscan.js';
import { pickBalletSequence, pointsFromPose } from './ballet-assist.js';
import { loadHistory, makeReview, saveReview, deleteReview, clearHistory, previousFor } from './history.js';
import { drawReport } from './report.js';

const $ = id => document.getElementById(id);
const FRAME = 1 / 30;            // one frame at 30 fps
const MAX_BYTES = 200 * 1024 * 1024;
const GRAB_PX = 16;              // how close (on screen) a click must be to grab a point
const LABELS = Object.fromEntries(Object.entries(LANDMARKS).map(([k, v]) => [k, v.label]));
for (const cp of FIG.checkpoints) LABELS['cp:' + cp.id] = cp.label;   // used in "save X first" messages

// ---------------------------------------------------------------- state
const state = {
  current: FIG.checkpoints[0].id,
  drafts: {},     // the checkpoint you are working on: { time, frame, points, checks, note }
  saved: {},      // copies taken when you press Save; results use only these
  selected: null, // the point the next click places
  side: null,     // the working leg found by a scan or suggestion
  picks: null,    // suggested times from "Find the five moments"
  zoom: 1,        // how much bigger than "fit" the frame is shown
};
const cpById = id => FIG.checkpoints.find(c => c.id === id);
const draft = () => state.drafts[state.current];

function newDraft() {
  return { time: null, frame: null, points: {}, checks: cpById(state.current).checks.map(() => false), note: '' };
}
const snapshot = d => JSON.stringify({ t: d.time, p: d.points, c: d.checks });

function setStatus(el, text, kind = '') {
  el.textContent = text;
  el.className = 'status' + (kind ? ' ' + kind : '');
}

// ---------------------------------------------------------------- 1. figure
function renderFigure() {
  $('figSummary').textContent = FIG.summary;
  $('figFacts').textContent = `Figure ${FIG.number} · degree of difficulty ${FIG.dd} · five checkpoints, four of them scored`;
  $('cpCards').innerHTML = FIG.checkpoints.map(cp => `
    <div class="cp-card">
      ${poseArt(cp.pose)}
      <b>${cp.label}</b>
      <span class="share">${cp.weight ? Math.round(cp.weight / FIG.totalWeight * 100) + '% of score' : 'Reference, not scored'}</span>
    </div>`).join('');
}

// ---------------------------------------------------------------- 2. video
const player = $('player');

$('permission').addEventListener('change', e => {
  $('fileInput').disabled = !e.target.checked;
  $('fileLabel').classList.toggle('disabled', !e.target.checked);
});

$('fileInput').addEventListener('change', e => {
  const file = e.target.files[0];
  if (!file) return;
  if (!file.type.startsWith('video/')) { $('videoInfo').textContent = 'That file is not a video. Choose an MP4 or MOV clip.'; return; }
  if (file.size > MAX_BYTES) { $('videoInfo').textContent = 'That video is over 200 MB. Trim it to just the figure and try again.'; return; }
  // A different clip starts a new review, leaving saved progress untouched.
  resetReview();
  if (player.src) URL.revokeObjectURL(player.src);
  player.src = URL.createObjectURL(file);   // plays straight from the device, no upload
  $('videoInfo').textContent = 'Loading…';
});

player.addEventListener('loadedmetadata', () => {
  $('videoInfo').textContent = `${player.duration.toFixed(1)} s, ${player.videoWidth}×${player.videoHeight}`;
  $('mediaBox').hidden = false;
  $('stepRow').hidden = false;
  $('autoBox').hidden = false;
  $('capture').disabled = false;
  state.picks = null;
  renderPicks();
});
player.addEventListener('error', () => {
  $('videoInfo').textContent = "This video can't be played here. Export it as an H.264 MP4 and try again.";
});
player.addEventListener('timeupdate', () => { $('timeNow').textContent = player.currentTime.toFixed(2) + ' s'; });
player.addEventListener('seeked', () => { $('timeNow').textContent = player.currentTime.toFixed(2) + ' s'; });

function step(dir) {
  player.pause();
  player.currentTime = Math.max(0, Math.min(player.duration, player.currentTime + dir * FRAME));
}
$('prevFrame').addEventListener('click', () => step(-1));
$('nextFrame').addEventListener('click', () => step(1));

// Find the five moments automatically (optional).
let scanning = false;
$('findMoments').addEventListener('click', async () => {
  if (scanning) return;
  scanning = true;
  $('findMoments').disabled = true;
  $('scanProgress').hidden = false;
  $('scanProgress').value = 0;
  setStatus($('scanStatus'), 'Loading pose detection…');
  const resumeAt = player.currentTime;
  try {
    const samples = await scanVideo(player, {
      onProgress: f => { $('scanProgress').value = f; setStatus($('scanStatus'), `Looking through the video… ${Math.round(f * 100)}%`); },
    });
    const { side, times } = pickBalletSequence(samples);
    state.side = side;
    state.picks = times;
    const found = Object.values(times).filter(t => t !== null).length;
    setStatus($('scanStatus'), found
      ? `Found ${found} of 5 moments (working leg: swimmer's ${side}). Check each one before saving.`
      : 'No clear Ballet Leg found. Move to each moment yourself and capture it.', found ? 'ok' : 'warn');
  } catch (err) {
    setStatus($('scanStatus'), "Pose detection couldn't load, so moments can't be found automatically. It needs an internet connection, and some hosts block it. You can still capture each frame yourself.", 'error');
    console.error(err);
  }
  await seekTo(player, resumeAt);
  $('scanProgress').hidden = true;
  $('findMoments').disabled = false;
  scanning = false;
  renderPicks();
});

function renderPicks() {
  const list = $('picks');
  if (!state.picks) { list.innerHTML = ''; return; }
  list.innerHTML = FIG.checkpoints.map(cp => {
    const t = state.picks[cp.id];
    return `<li><span>${cp.label}</span><span class="num">${t === null ? 'not found' : t.toFixed(2) + ' s'}</span>
      ${t === null ? '' : `<button type="button" data-go="${cp.id}">Capture it</button>`}</li>`;
  }).join('');
}
$('picks').addEventListener('click', async e => {
  const id = e.target.dataset && e.target.dataset.go;
  if (!id) return;
  selectCheckpoint(id);
  await seekTo(player, state.picks[id]);
  await captureFrame();
  if (state.picks) await suggestPoints(true);
  $('mark').scrollIntoView({ block: 'start' });
});

// ---------------------------------------------------------------- 3. mark
const canvas = $('markCanvas');
const ctx = canvas.getContext('2d');

// ---- zoom: show the frame bigger so points can be placed precisely.
// The canvas keeps its full-size pixels; only its size on screen changes,
// so the measurements stay exactly the same at every zoom level.
const ZOOMS = [1, 1.5, 2, 3, 4];
const frameBox = $('frameBox');
const zoomRow = document.createElement('div');
zoomRow.className = 'row';
zoomRow.innerHTML = `
  <button type="button" id="zoomOut" aria-label="Zoom out">−</button>
  <span class="num" id="zoomLabel">1×</span>
  <button type="button" id="zoomIn" aria-label="Zoom in">+</button>
  <button type="button" id="zoomFit">Fit</button>
  <span class="muted small">Zoom in centers on the selected point. When zoomed, drag empty space to look around.</span>`;
frameBox.parentElement.before(zoomRow);
frameBox.style.minWidth = '0';
canvas.style.height = 'auto';
for (const button of zoomRow.querySelectorAll('button')) {
  button.style.minWidth = '44px';
  button.style.minHeight = '44px';
}

// The on-screen scale at 1×: as wide as the box, no taller than 70% of the screen.
function fitScale() {
  const w = frameBox.clientWidth || canvas.width;
  return Math.min(w / canvas.width, (window.innerHeight * 0.7) / canvas.height, 1);
}

// Resize the canvas on screen. focus (optional) is a point to put in the middle of the view.
function applyZoom(focus = null) {
  const d = draft();
  const zoomed = state.zoom > 1;
  zoomRow.hidden = !(d && d.frame);
  zoomRow.style.display = d && d.frame ? '' : 'none';
  $('zoomLabel').textContent = state.zoom + '×';
  $('zoomOut').disabled = state.zoom === ZOOMS[0];
  $('zoomIn').disabled = state.zoom === ZOOMS[ZOOMS.length - 1];
  $('zoomFit').disabled = !zoomed;
  if (!d || !d.frame) return;
  // Remember which part of the frame is in the middle of the view now.
  const old = canvas.getBoundingClientRect();
  const box = frameBox.getBoundingClientRect();
  // Use the actual canvas position: a fitted portrait frame may be centered.
  let cx = old.width ? (box.left + frameBox.clientWidth / 2 - old.left) / old.width * canvas.width : canvas.width / 2;
  let cy = old.height ? (box.top + frameBox.clientHeight / 2 - old.top) / old.height * canvas.height : canvas.height / 2;
  if (focus) { cx = focus.x; cy = focus.y; }
  const width = canvas.width * fitScale() * state.zoom;
  canvas.style.width = width + 'px';
  canvas.style.maxWidth = zoomed ? 'none' : '';
  canvas.style.maxHeight = zoomed ? 'none' : '';
  frameBox.style.overflow = zoomed ? 'auto' : '';
  frameBox.style.placeItems = zoomed ? 'start' : '';
  frameBox.style.maxHeight = zoomed ? '75vh' : '';
  // Scroll so the same spot (or the focus point) is in the middle again.
  const k = width / canvas.width;
  frameBox.scrollLeft = cx * k - frameBox.clientWidth / 2;
  frameBox.scrollTop = cy * k - frameBox.clientHeight / 2;
  draw();
}

// dir: +1 zoom in, -1 zoom out, 0 back to fit.
function setZoom(dir) {
  const i = ZOOMS.indexOf(state.zoom);
  const next = dir === 0 ? 1 : ZOOMS[Math.max(0, Math.min(ZOOMS.length - 1, i + dir))];
  if (next === state.zoom) return;
  state.zoom = next;
  const d = draft();
  const p = d && state.selected && d.points[state.selected];
  applyZoom(dir > 0 && p ? p : null);
}
$('zoomIn').addEventListener('click', () => setZoom(1));
$('zoomOut').addEventListener('click', () => setZoom(-1));
$('zoomFit').addEventListener('click', () => setZoom(0));

function renderTabs() {
  $('tabs').innerHTML = FIG.checkpoints.map(cp => {
    const d = state.drafts[cp.id], s = state.saved[cp.id];
    let label = '<small>Empty</small>';
    if (s && d && snapshot(d) !== snapshot(s)) label = '<small class="edits">Unsaved changes</small>';
    else if (s) label = `<small class="saved">Saved · ${scoreCheckpoint(cp, s.points, s.checks, LABELS, state.saved).score.toFixed(1)}</small>`;
    else if (d && d.frame) label = '<small>Not saved yet</small>';
    return `<button type="button" class="tab" data-cp="${cp.id}" aria-pressed="${cp.id === state.current}">${cp.label}${label}</button>`;
  }).join('');
}
$('tabs').addEventListener('click', e => {
  const b = e.target.closest('[data-cp]');
  if (b) selectCheckpoint(b.dataset.cp);
});

function selectCheckpoint(id) {
  state.current = id;
  state.selected = null;
  const s = state.saved[id];
  if (s && s.time !== null && player.duration) seekTo(player, s.time);
  renderMarking();
}

async function captureFrame() {
  if (!player.videoWidth) return;
  player.pause();
  const frame = document.createElement('canvas');
  frame.width = player.videoWidth;
  frame.height = player.videoHeight;
  frame.getContext('2d').drawImage(player, 0, 0);
  if (!draft()) state.drafts[state.current] = state.saved[state.current] ? copyDraft(state.saved[state.current]) : newDraft();
  const d = draft();
  d.frame = frame;
  d.time = player.currentTime;
  d.note = '';
  // The camera usually stays still, so reuse a water line from another checkpoint.
  if (!d.points.waterA || !d.points.waterB) {
    const donor = FIG.checkpoints.map(c => state.drafts[c.id] || state.saved[c.id])
      .find(o => o && o !== d && o.points.waterA && o.points.waterB);
    if (donor) {
      d.points.waterA = { ...donor.points.waterA };
      d.points.waterB = { ...donor.points.waterB };
      d.note = 'Water line copied from another checkpoint. Check it still sits on the surface.';
    }
  }
  state.selected = nextMissing();
  renderMarking();
}
$('capture').addEventListener('click', captureFrame);

function copyDraft(s) {
  return { time: s.time, frame: s.frame, points: JSON.parse(JSON.stringify(s.points)), checks: [...s.checks], note: '' };
}

async function suggestPoints(quiet = false) {
  const d = draft();
  if (!d || !d.frame) return;
  $('suggest').disabled = true;
  setStatus($('markStatus'), 'Finding the body…');
  try {
    const pose = await detectPose(d.frame);
    if (!pose) { setStatus($('markStatus'), 'No swimmer found in this frame. Place the points yourself.', 'warn'); return; }
    const { side, points } = pointsFromPose(pose, state.side);
    state.side = side;
    let placed = 0;
    const wanted = pointsUsed(cpById(state.current));   // only the points this checkpoint uses
    for (const [name, p] of Object.entries(points)) if (p && wanted.includes(name)) { d.points[name] = p; placed++; }
    state.selected = nextMissing();
    setStatus($('markStatus'), `Suggested ${placed} body points. Check each one and drag it if needed` +
      (d.points.waterA ? '.' : ', then mark the water line.'), placed ? 'ok' : 'warn');
  } catch (err) {
    if (!quiet) setStatus($('markStatus'), "Pose detection couldn't load here. It needs an internet connection, and some hosts block it. Place the points yourself.", 'error');
    console.error(err);
  } finally {
    $('suggest').disabled = false;
    renderMarking(false);
  }
}
$('suggest').addEventListener('click', () => suggestPoints());

function nextMissing() {
  const d = draft();
  const cp = cpById(state.current);
  const needed = pointsNeeded(cp);
  const order = [...needed, ...pointsUsed(cp).filter(n => !needed.includes(n))];
  return order.find(n => !d || !d.points[n]) || null;
}

function renderMarking(clearStatus = true) {
  const cp = cpById(state.current);
  const d = draft() || (state.saved[cp.id] ? (state.drafts[cp.id] = copyDraft(state.saved[cp.id])) : null);
  $('cue').innerHTML = `<b>${cp.label}.</b> ${cp.cue}`;
  $('frameTime').textContent = d && d.time !== null ? `Frame at ${d.time.toFixed(2)} s` : '';
  $('suggest').disabled = !(d && d.frame);
  $('frameEmpty').hidden = !!(d && d.frame);
  canvas.hidden = !(d && d.frame);
  if (d && d.frame) { canvas.width = d.frame.width; canvas.height = d.frame.height; }
  applyZoom();
  if (clearStatus) setStatus($('markStatus'), d && d.note ? d.note : '', d && d.note ? 'warn' : '');

  // point chips
  const needed = pointsNeeded(cp);
  $('chips').innerHTML = pointsUsed(cp).map(n => `<button type="button" class="chip${d && d.points[n] ? ' placed' : ''}${needed.includes(n) ? '' : ' optional'}"
      data-pt="${n}" aria-pressed="${state.selected === n}" title="${LANDMARKS[n].hint}${needed.includes(n) ? '' : ' (optional: lets a coach\'s-eye item be measured)'}">${LANDMARKS[n].label}${needed.includes(n) ? '' : ' <small>optional</small>'}</button>`).join('');
  $('pointHint').textContent = state.selected ? `Next: ${LANDMARKS[state.selected].hint}.` : (d && d.frame ? 'All points placed. Drag any that are off.' : 'Capture a frame first.');

  // coach's-eye checks
  $('checks').innerHTML = '<legend>Coach\'s eye</legend>' + cp.checks.map((c, i) => `
    <label class="check"><input type="checkbox" data-check="${i}" ${d && d.checks[i] ? 'checked' : ''} ${d && d.frame ? '' : 'disabled'}>
      <span>${c.text}<small class="check-note" data-note="${i}"></small></span></label>`).join('');

  renderLive();
  renderTabs();
  draw();
}

$('chips').addEventListener('click', e => {
  const b = e.target.closest('[data-pt]');
  if (!b) return;
  state.selected = b.dataset.pt;
  renderMarking(false);
  canvas.focus();
});
$('checks').addEventListener('change', e => {
  const i = e.target.dataset.check;
  if (i === undefined || !draft()) return;
  draft().checks[+i] = e.target.checked;
  renderLive();
  renderTabs();
});

function renderLive() {
  const cp = cpById(state.current);
  const d = draft();
  const result = scoreCheckpoint(cp, d ? d.points : {}, d ? d.checks : [], LABELS, state.saved);
  $('liveRows').innerHTML = result.rows.map(r => `<tr>
      <td>${r.metric.label}</td>
      <td class="num">${r.metric.ideal}°</td>
      <td class="num">${r.error ? '–' : r.value.toFixed(1) + '°'}</td>
      <td>${r.error ? `<span class="pill none">${r.error}</span>` : `${deviationGauge(r.deviation, r.metric.tol)} <span class="pill ${r.deduction.band}">${r.deduction.label}${r.deduction.value ? ' −' + r.deduction.value.toFixed(1) : ''}</span>`}</td>
    </tr>`).join('');
  // Coach's-eye items: measured ones are decided by the points; the rest are ticked by eye.
  result.checkResults.forEach((c, i) => {
    const box = $('checks').querySelector(`[data-check="${i}"]`);
    const note = $('checks').querySelector(`[data-note="${i}"]`);
    if (!box || !note) return;
    if (c.measured) {
      box.checked = c.pass;
      box.disabled = true;
      note.textContent = 'Measured: ' + c.parts.map(p => `${p.test.label.toLowerCase()} ${p.display} (needs ${p.limit})`).join('; ');
      note.className = 'check-note ' + (c.pass ? 'ok' : 'bad');
    } else {
      box.checked = !!(d && d.checks[i]);
      box.disabled = !(d && d.frame);
      note.textContent = c.check.tests ? 'Tick by eye for now. ' + c.reason : 'Tick by eye.';
      note.className = 'check-note';
    }
  });
  const ready = d && d.frame && result.complete;
  $('liveScore').textContent = ready ? `Checkpoint score ${result.score.toFixed(1)} / 10` : '';
  const s = state.saved[cp.id];
  $('save').disabled = !(d && d.frame);
  $('save').textContent = s ? 'Save changes' : 'Save checkpoint';
}

$('save').addEventListener('click', () => {
  const cp = cpById(state.current);
  const d = draft();
  const missing = pointsNeeded(cp).filter(n => !d.points[n]);
  if (missing.length) {
    setStatus($('markStatus'), 'Place every point before saving. Still missing: ' + missing.map(n => LANDMARKS[n].label).join(', ') + '.', 'error');
    return;
  }
  try { waterFrame(d.points.waterA, d.points.waterB); }
  catch (err) { setStatus($('markStatus'), err.message, 'error'); return; }
  const result = scoreCheckpoint(cp, d.points, d.checks, LABELS, state.saved);
  const broken = result.rows.find(r => r.error);
  if (broken) { setStatus($('markStatus'), broken.error, 'error'); return; }
  // Checkpoints must be in time order.
  const order = FIG.checkpoints.map(c => c.id);
  const me = order.indexOf(cp.id);
  for (const [id, s] of Object.entries(state.saved)) {
    const other = order.indexOf(id);
    if (other < me && s.time >= d.time) { setStatus($('markStatus'), `This frame must come after ${cpById(id).label} (${s.time.toFixed(2)} s).`, 'error'); return; }
    if (other > me && s.time <= d.time) { setStatus($('markStatus'), `This frame must come before ${cpById(id).label} (${s.time.toFixed(2)} s).`, 'error'); return; }
  }
  state.saved[cp.id] = copyDraft(d);
  d.note = '';
  setStatus($('markStatus'), `Saved ${cp.label}: ${result.score.toFixed(1)} / 10.`, 'ok');
  renderTabs();
  renderLive();
  renderResults();
});

// ---- drawing the frame with the points
function screenScale() {
  const r = canvas.getBoundingClientRect();
  return r.width ? canvas.width / r.width : 1;
}

const TARGET = '#2BBF6A';   // green: where a line should be

// Draws a frame plus its points onto any 2D context, scaled by k.
// opts.targets: metrics to draw the target line for.
function paint(c, frame, points, k, opts = {}) {
  const css = getComputedStyle(document.documentElement);
  const mark = css.getPropertyValue('--mark').trim() || '#C9471F';
  const water = '#2F8FE0';
  c.drawImage(frame, 0, 0, c.canvas.width, c.canvas.height);
  const P = n => points[n] && { x: points[n].x * k, y: points[n].y * k };
  const lw = opts.lineWidth || 3;
  const line = (a, b, color, w, dash = []) => { if (!a || !b) return; c.beginPath(); c.setLineDash(dash); c.strokeStyle = color; c.lineWidth = w; c.moveTo(a.x, a.y); c.lineTo(b.x, b.y); c.stroke(); c.setLineDash([]); };
  const wa = P('waterA'), wb = P('waterB'), hip = P('hip');
  if (wa && wb) {
    let f = null;
    try { f = waterFrame(points.waterA, points.waterB); } catch { /* too close; just draw the segment */ }
    if (f) {
      const L = c.canvas.width * 2;
      line({ x: wa.x - f.u.x * L, y: wa.y - f.u.y * L }, { x: wa.x + f.u.x * L, y: wa.y + f.u.y * L }, water, lw * 0.8, [10 * lw / 3, 8 * lw / 3]);
      if (hip) line(hip, { x: hip.x + f.n.x * L, y: hip.y + f.n.y * L }, '#FFFFFF', lw * 0.7, [6 * lw / 3, 6 * lw / 3]); // the vertical through the hip
    } else line(wa, wb, water, lw);
  }
  line(P('shoulder'), hip, mark, lw);
  line(hip, P('knee'), mark, lw);
  line(P('knee'), P('ankle'), mark, lw);
  line(hip, P('ankleB'), mark, lw);
  // Where each measurement that lost points SHOULD be: green dashed lines.
  if (opts.targets && wa && wb) {
    let f = null;
    try { f = waterFrame(points.waterA, points.waterB); } catch { /* skip */ }
    const scaled = {};
    for (const n of Object.keys(points)) scaled[n] = P(n);
    for (const metric of f ? opts.targets : []) {
      if (!metric.pts.every(n => scaled[n])) continue;
      const t = targetLine(metric, scaled, f);
      line(t.from, t.to, TARGET, lw * 1.1, [7 * lw / 3, 5 * lw / 3]);
      c.beginPath(); c.arc(t.to.x, t.to.y, 4 * lw / 3, 0, Math.PI * 2); c.fillStyle = TARGET; c.fill();
    }
  }
  for (const [name, p] of Object.entries(points)) {
    if (!p) continue;
    const q = { x: p.x * k, y: p.y * k };
    const r = (opts.selected === name ? 9 : 6) * lw / 3;
    c.beginPath(); c.arc(q.x, q.y, r, 0, Math.PI * 2);
    c.fillStyle = name.startsWith('water') ? water : mark; c.fill();
    c.lineWidth = lw * 0.6; c.strokeStyle = '#FFFFFF'; c.stroke();
    if (opts.labels) {
      c.font = `700 ${13 * lw / 3}px system-ui, sans-serif`;
      const text = LANDMARKS[name].label;
      const w = c.measureText(text).width;
      c.fillStyle = 'rgba(8, 20, 30, 0.75)';
      c.fillRect(q.x + r + 3, q.y - r - 16 * lw / 3, w + 8 * lw / 3, 18 * lw / 3);
      c.fillStyle = '#FFFFFF';
      c.fillText(text, q.x + r + 3 + 4 * lw / 3, q.y - r - 3 * lw / 3);
    }
  }
}

function draw() {
  const d = draft();
  if (!d || !d.frame || canvas.hidden) return;
  const s = screenScale();
  paint(ctx, d.frame, d.points, 1, { lineWidth: 3 * s, selected: state.selected, labels: true });
}

function toCanvas(e) {
  const r = canvas.getBoundingClientRect();
  return { x: (e.clientX - r.left) * canvas.width / r.width, y: (e.clientY - r.top) * canvas.height / r.height };
}
function nearestPoint(p, pointerType) {
  const d = draft();
  const reach = (pointerType === 'touch' ? 28 : GRAB_PX) * screenScale();
  let best = null, bestDist = reach;
  for (const [name, q] of Object.entries(d.points)) {
    if (!q) continue;
    const dist = Math.hypot(q.x - p.x, q.y - p.y);
    if (dist <= bestDist) { best = name; bestDist = dist; }
  }
  return best;
}

let activePointer = null; // ignore extra fingers until the current gesture ends
let dragging = null;   // the point being moved and where the finger grabbed it
let panning = null;    // pressing on empty space: a tap places a point, a drag moves the view
canvas.addEventListener('pointerdown', e => {
  if (activePointer !== null || e.button !== 0) return;
  const d = draft();
  if (!d || !d.frame) return;
  const p = toCanvas(e);
  const hit = nearestPoint(p, e.pointerType);
  activePointer = e.pointerId;
  canvas.setPointerCapture(e.pointerId);
  if (hit) {
    dragging = { name: hit, dx: d.points[hit].x - p.x, dy: d.points[hit].y - p.y };
    state.selected = hit;
    // Do not resize or scroll the canvas in the middle of a gesture.
    draw();
    return;
  }
  panning = { x: e.clientX, y: e.clientY, left: frameBox.scrollLeft, top: frameBox.scrollTop, moved: false, at: p };
});
canvas.addEventListener('pointermove', e => {
  if (e.pointerId !== activePointer) return;
  if (dragging) {
    const p = toCanvas(e);
    draft().points[dragging.name] = { x: Math.max(0, Math.min(canvas.width, p.x + dragging.dx)), y: Math.max(0, Math.min(canvas.height, p.y + dragging.dy)) };
    draw();
    return;
  }
  if (panning) {
    const dx = e.clientX - panning.x, dy = e.clientY - panning.y;
    if (Math.hypot(dx, dy) > 6) panning.moved = true;   // more than a small wobble counts as a drag
    if (panning.moved && state.zoom > 1) {
      frameBox.scrollLeft = panning.left - dx;
      frameBox.scrollTop = panning.top - dy;
    }
  }
});

// Put the selected point (or the next missing one) where the swimmer tapped.
function placeAt(p) {
  const d = draft();
  const name = state.selected || nextMissing();
  if (!name) return;
  d.points[name] = p;
  state.selected = nextMissing();
  renderMarking(false);
}
canvas.addEventListener('pointerup', e => {
  if (e.pointerId !== activePointer) return;
  activePointer = null;
  if (dragging) { dragging = null; renderMarking(false); return; }
  if (panning) {
    const tap = !panning.moved, at = panning.at;
    panning = null;
    if (tap) placeAt(at);
  }
});
function cancelGesture(e) {
  if (e.pointerId !== activePointer) return;
  activePointer = null;
  dragging = null;
  panning = null;
  renderMarking(false);
}
canvas.addEventListener('pointercancel', cancelGesture);
canvas.addEventListener('lostpointercapture', cancelGesture);

canvas.addEventListener('keydown', e => {
  if (e.key === '+' || e.key === '=') { setZoom(1); e.preventDefault(); return; }
  if (e.key === '-') { setZoom(-1); e.preventDefault(); return; }
  const d = draft();
  const name = state.selected;
  if (!d || !name) return;
  if (e.key === 'Delete' || e.key === 'Backspace') {
    delete d.points[name];
    renderMarking(false);
    e.preventDefault();
    return;
  }
  const p = d.points[name];
  const moves = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
  if (!p || !moves[e.key]) return;
  const n = e.shiftKey ? 5 : 1;
  p.x = Math.max(0, Math.min(canvas.width, p.x + moves[e.key][0] * n));
  p.y = Math.max(0, Math.min(canvas.height, p.y + moves[e.key][1] * n));
  e.preventDefault();
  renderMarking(false);
});
window.addEventListener('resize', () => applyZoom());

// ---------------------------------------------------------------- 4. results
function renderResults() {
  const box = $('resultsBody');
  const out = scoreFigure(FIG, state.saved, LABELS);
  // The results changed, so an old report image is out of date.
  $('reportBox').hidden = true;
  setStatus($('keepStatus'), '');
  if (out.figureScore === null) {
    box.innerHTML = '<p class="muted">Save at least one scored checkpoint to see results.</p>';
    $('keepBox').hidden = true;
    return;
  }
  $('keepBox').hidden = false;
  $('saveProgress').textContent = historyId ? 'Update my saved progress' : 'Save to my progress';
  const savedCount = out.results.filter(r => r.saved).length;
  const top = out.issues.slice(0, 3);
  box.innerHTML = `
    <div class="score">
      <span class="big">${out.figureScore.toFixed(2)}</span>
      <span>figure score (out of ${(10 * FIG.dd).toFixed(0)})<br><span class="muted small">practice score ${out.practice.toFixed(2)} / 10 × difficulty ${FIG.dd}</span></span>
      ${out.provisional ? `<span class="pill small">Provisional · ${savedCount} of 5 checkpoints saved</span>` : '<span class="pill clean">All 5 checkpoints saved</span>'}
    </div>
    ${summaryHtml(out)}
    <div>
      <h3>What to work on</h3>
      ${top.length ? `<ol class="issues">${top.map(issueHtml).join('')}</ol>` : '<p class="muted">Nothing lost points in the saved checkpoints. Keep it up.</p>'}
    </div>
    ${planHtml(out)}
    <div style="display:grid;gap:14px">
      <h3>Checkpoint by checkpoint</h3>
      <p class="muted small">Orange lines are what you did. <span class="target-key">Green dashed lines</span> show where a line should be, for each measurement that lost points.</p>
      ${out.results.map(resultHtml).join('')}
    </div>`;
  // Draw the small frames.
  for (const r of out.results) {
    if (!r.saved) continue;
    const s = state.saved[r.checkpoint.id];
    const c = box.querySelector(`canvas[data-thumb="${r.checkpoint.id}"]`);
    const k = Math.min(1, 480 / s.frame.width);
    c.width = Math.round(s.frame.width * k);
    c.height = Math.round(s.frame.height * k);
    paint(c.getContext('2d'), s.frame, s.points, k, { lineWidth: 2, targets: lostMetrics(r) });
  }
}

// The measurements in one result that lost points (these get a target line).
const lostMetrics = r => r.rows.filter(row => row.deduction && row.deduction.value > 0).map(row => row.metric);

// ---------------------------------------------------------------- keep results
let historyId = null;   // once this review is saved, saving again updates it instead of adding a copy

// Make HTML-safe text from what someone typed (so a name can't break the page).
const esc = s => String(s).replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]);

// A small copy of one checkpoint's saved frame, with its lines drawn on.
function thumb(id, width) {
  const s = state.saved[id];
  if (!s) return null;
  const k = width / s.frame.width;
  const c = document.createElement('canvas');
  c.width = width;
  c.height = Math.round(s.frame.height * k);
  const r = scoreCheckpoint(cpById(id), s.points, s.checks, LABELS, state.saved);
  paint(c.getContext('2d'), s.frame, s.points, k, { lineWidth: 2, targets: lostMetrics(r) });
  return c;
}

$('saveProgress').addEventListener('click', () => {
  const out = scoreFigure(FIG, state.saved, LABELS);
  if (out.figureScore === null) return;
  const review = makeReview(FIG, out, $('swimmerName').value);
  if (historyId) {
    const previous = loadHistory().find(r => r.id === historyId);
    if (previous) review.date = previous.date;
    review.id = historyId;
  }   // same review: replace the earlier save
  if (!saveReview(review)) {
    setStatus($('keepStatus'), "This browser won't let the app save (a private window or blocked site data). Make a report image instead.", 'error');
    return;
  }
  setStatus($('keepStatus'), historyId ? 'Saved progress updated.' : 'Saved to your progress on this device.', 'ok');
  historyId = review.id;
  $('saveProgress').textContent = 'Update my saved progress';
  renderProgress();
});

$('swimmerName').addEventListener('input', () => {
  $('reportBox').hidden = true;
  setStatus($('keepStatus'), '');
});

$('makeReport').addEventListener('click', () => {
  const out = scoreFigure(FIG, state.saved, LABELS);
  if (out.figureScore === null) return;
  const image = drawReport(FIG, out, $('swimmerName').value.trim(), thumb);
  const url = image.toDataURL('image/png');
  const img = document.createElement('img');
  img.src = url;
  img.alt = 'Report with the figure score, the five checkpoints and what to work on';
  $('reportImgBox').replaceChildren(img);
  $('reportDownload').href = url;
  // Inside the Claude page viewer, downloads are blocked, so only the save-the-image tip shows there.
  $('reportDownload').hidden = !!window.claude;
  $('reportBox').hidden = false;
  setStatus($('keepStatus'), 'Report image ready.', 'ok');
});

function renderProgress() {
  const list = loadHistory().slice().sort((a, b) => (a.date < b.date ? 1 : -1));   // newest first
  $('clearProgress').hidden = !list.length;
  if (!list.length) {
    $('progressBody').innerHTML = '<p class="muted">No saved reviews yet. Use "Save to my progress" under Results.</p>';
    return;
  }
  const rows = list.map(r => {
    const prev = previousFor(list, r);
    let change = '<span class="muted">—</span>';
    if (prev) {
      const d = r.figureScore - prev.figureScore;
      change = Math.abs(d) < 0.005 ? '<span class="muted">same</span>'
        : `<span class="${d > 0 ? 'up' : 'down'}">${d > 0 ? '+' : '−'}${Math.abs(d).toFixed(2)}</span>`;
    }
    const when = new Date(r.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
    return `<tr>
      <td>${when}</td>
      <td>${r.swimmer ? esc(r.swimmer) : '<span class="muted">—</span>'}</td>
      <td class="num">${r.figureScore.toFixed(2)}${r.provisional ? ' <span class="pill small">provisional</span>' : ''}</td>
      <td class="num">${change}</td>
      <td>${r.top.length ? esc(r.top[0]) : '<span class="muted">nothing lost points</span>'}</td>
      <td><button type="button" class="link" data-del="${esc(r.id)}">Delete</button></td>
    </tr>`;
  }).join('');
  $('progressBody').innerHTML = `<div class="table-wrap"><table>
    <thead><tr><th>Date</th><th>Swimmer</th><th class="num">Score</th><th class="num">Change</th><th>Top thing to work on</th><th></th></tr></thead>
    <tbody>${rows}</tbody></table></div>`;
}

$('progressBody').addEventListener('click', e => {
  const id = e.target.dataset && e.target.dataset.del;
  if (!id) return;
  if (!deleteReview(id)) {
    $('clearNote').textContent = 'Could not delete the review. Browser storage may be blocked.';
    return;
  }
  if (id === historyId) { historyId = null; $('saveProgress').textContent = 'Save to my progress'; }
  renderProgress();
});

let clearArmed = false;
$('clearProgress').addEventListener('click', () => {
  if (!clearArmed) {
    clearArmed = true;
    $('clearProgress').textContent = 'Click again to delete every saved review';
    setTimeout(() => { clearArmed = false; $('clearProgress').textContent = 'Clear all saved reviews'; }, 5000);
    return;
  }
  clearArmed = false;
  $('clearProgress').textContent = 'Clear all saved reviews';
  if (!clearHistory()) {
    $('clearNote').textContent = 'Could not clear reviews. Browser storage may be blocked.';
    return;
  }
  historyId = null;
  $('saveProgress').textContent = 'Save to my progress';
  $('clearNote').textContent = 'All saved reviews deleted.';
  renderProgress();
});

function issueHtml(issue) {
  const drills = (FIG.drillsFor[issue.drillKey] || []).slice(0, 2).map(id => DRILLS[id]);
  return `<li>
    <b>${issue.title}</b> <span class="muted">· ${issue.checkpoint.label}</span><br>
    <span class="small">${issue.detail}. Costs about <span class="num">${issue.cost.toFixed(2)}</span> figure points.</span><br>
    <span class="small muted">Drills: ${drills.map(d => d.name).join(', ')} (see the practice plan)</span></li>`;
}

// ---- whole-figure summary
function summaryHtml(out) {
  const saved = out.results.filter(r => r.saved);
  const scored = saved.filter(r => r.checkpoint.weight > 0);
  const rows = saved.flatMap(r => r.rows);
  const onTarget = rows.filter(row => row.deduction && row.deduction.value === 0).length;
  const checks = saved.flatMap(r => r.checkResults);
  const met = checks.filter(c => c.pass).length;
  const measured = checks.filter(c => c.measured && c.pass).length;
  const best = scored.length ? scored.reduce((a, b) => (b.score > a.score ? b : a)) : null;
  const worst = scored.length ? scored.reduce((a, b) => (b.score < a.score ? b : a)) : null;
  const focus = !out.issues.length ? 'No deductions in the saved checkpoints.'
    : `Focus: ${out.issues[0].title} (${out.issues[0].checkpoint.label}).`;
  return `<div class="summary">
    <div><span class="muted small">Strongest saved checkpoint</span><b>${best ? `${best.checkpoint.label} · ${best.score.toFixed(1)}` : '—'}</b></div>
    <div><span class="muted small">Lowest saved score</span><b>${worst && worst !== best ? `${worst.checkpoint.label} · ${worst.score.toFixed(1)}` : '—'}</b></div>
    <div><span class="muted small">Measurements on target</span><b class="num">${onTarget} of ${rows.length}</b></div>
    <div><span class="muted small">Coach's-eye items met</span><b class="num">${met} of ${checks.length}</b><span class="muted small">${measured} met by measurement, ${met - measured} met by eye</span></div>
    <p class="summary-focus">${focus}</p>
  </div>`;
}

// ---- practice plan: drills for the biggest problems, grouped by where you do them
function planHtml(out) {
  const picked = new Map();   // drill id -> the problems it helps with
  for (const issue of out.issues.slice(0, 5)) {
    for (const id of (FIG.drillsFor[issue.drillKey] || []).slice(0, 2)) {
      if (!picked.has(id)) picked.set(id, []);
      const why = issue.title;
      if (!picked.get(id).includes(why)) picked.get(id).push(why);
    }
  }
  if (!picked.size) return '';
  const card = id => {
    const d = DRILLS[id];
    return `<div class="drill"><span class="where">${d.dose}</span><b>${d.name}</b><span>${d.how}</span>
      <span class="small muted">Helps with: ${picked.get(id).join('; ')}</span>
      <a href="${videoLink(d)}" target="_blank" rel="noopener">Watch the demo (${d.video.channel})</a></div>`;
  };
  const ids = [...picked.keys()];
  const pool = ids.filter(id => DRILLS[id].where === 'Pool');
  const land = ids.filter(id => DRILLS[id].where !== 'Pool');   // "Land" and "Land or pool"
  return `<div class="plan">
    <h3>Practice plan</h3>
    <p class="muted small">Drills for the top problems above. Practise with a coach or lifeguard present, and never practise breath-holding alone.</p>
    ${pool.length ? `<h4>In the pool</h4><div class="drills">${pool.map(card).join('')}</div>` : ''}
    ${land.length ? `<h4>On land</h4><div class="drills">${land.map(card).join('')}</div>` : ''}
  </div>`;
}

function resultHtml(r) {
  const cp = r.checkpoint;
  if (!r.saved) {
    return `<div class="result-cp"><div class="muted small">Not saved</div>
      <div><h3>${cp.label}</h3><p class="muted small">No saved frame yet${cp.weight ? '' : ' (reference only)'}.</p></div></div>`;
  }
  const rows = r.rows.map(row => `<tr><td>${row.metric.label}</td><td class="num">${row.metric.ideal}°</td>
      <td class="num">${row.value.toFixed(1)}°</td><td>${deviationGauge(row.deviation, row.metric.tol)} <span class="pill ${row.deduction.band}">${row.deduction.label}${row.deduction.value ? ' −' + row.deduction.value.toFixed(1) : ''}</span></td></tr>`).join('');
  const checks = r.checkResults.map(c => {
    const target = c.measured ? c.parts.map(p => p.limit).join('<br>') : 'Met';
    const yours = c.measured ? c.parts.map(p => p.display).join('<br>') : (c.pass ? 'Ticked' : 'Not ticked');
    return `<tr><td>${c.check.text}<br><span class="muted small">${c.measured ? 'Measured' : 'By eye'}</span></td><td class="num">${target}</td><td class="num">${yours}</td>
      <td><span class="pill ${c.pass ? 'clean' : 'small'}">${c.pass ? 'Met' : 'Not met −0.2'}</span></td></tr>`;
  }).join('');
  return `<div class="result-cp">
    <canvas data-thumb="${cp.id}" aria-label="${cp.label} frame with the measured lines"></canvas>
    <div style="display:grid;gap:8px;min-width:0">
      <h3>${cp.label} · <span class="num">${r.score.toFixed(1)} / 10</span> <span class="muted small">at ${r.time.toFixed(2)} s${cp.weight ? '' : ', reference only'}</span></h3>
      <div class="table-wrap"><table>
        <thead><tr><th>Requirement</th><th class="num">Target</th><th class="num">Your video</th><th>Result</th></tr></thead>
        <tbody>${rows}${checks}</tbody></table></div>
    </div></div>`;
}

// ---------------------------------------------------------------- start over
let armed = false;
$('startOver').addEventListener('click', () => {
  if (!armed) {
    armed = true;
    $('startOver').textContent = 'Click again to clear everything';
    $('startOverNote').textContent = 'This clears the current review. Saved progress is kept.';
    setTimeout(() => { armed = false; $('startOver').textContent = 'Start over'; $('startOverNote').textContent = ''; }, 5000);
    return;
  }
  armed = false;
  resetReview();
  $('startOver').textContent = 'Start over';
  $('startOverNote').textContent = 'Cleared.';
});

function resetReview() {
  state.drafts = {}; state.saved = {}; state.picks = null; state.side = null; state.selected = null; state.zoom = 1;
  state.current = FIG.checkpoints[0].id;
  historyId = null;   // a new review (saved progress from before is kept)
  renderPicks(); renderMarking(); renderResults();
}

// ---------------------------------------------------------------- go
renderFigure();
renderMarking();
renderResults();
renderProgress();
