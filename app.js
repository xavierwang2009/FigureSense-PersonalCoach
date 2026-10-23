// app.js
// Connects the page to the other modules: video, capture, marking points,
// saving checkpoints, results and drills. Saved progress stays in this browser; videos and frames stay in this tab.

import { LANDMARKS, FIGURES, GROUPS, DRILLS, pointsNeeded, pointsUsed, videoLink, linkText, hintFor } from './figures.js';
import { scoreCheckpoint, scoreFigure, waterFrame, targetText } from './geometry.js';
import { poseCard, deviationGauge, deviationDial, targetLine } from './poses.js';
import { detectPose, scanVideo, seekTo } from './autoscan.js';
import { pointsFromPose } from './ballet-assist.js';
import { pickSequence } from './figure-assist.js';
import { loadHistory, makeReview, saveReview, deleteReview, clearHistory, previousFor } from './history.js';
import { drawReport } from './report.js';

const $ = id => document.getElementById(id);
const FRAME = 1 / 30;            // one frame at 30 fps
const MAX_BYTES = 200 * 1024 * 1024;
const GRAB_PX = 16;              // how close (on screen) a click must be to grab a point
const LABELS = Object.fromEntries(Object.entries(LANDMARKS).map(([k, v]) => [k, v.label]));

// The figure being reviewed. Changing it starts a new review (see the figure picker).
let FIG = FIGURES[0];
try {
  const remembered = FIGURES.find(f => f.number === localStorage.getItem('figuresense-figure'));
  if (remembered) FIG = remembered;
} catch { /* storage blocked: start with Ballet Leg */ }

// Checkpoint names, used in "save X first" messages.
function setCheckpointLabels() {
  for (const k of Object.keys(LABELS)) if (k.startsWith('cp:')) delete LABELS[k];
  for (const cp of FIG.checkpoints) LABELS['cp:' + cp.id] = cp.label;
}
setCheckpointLabels();
const scoredCount = () => FIG.checkpoints.filter(cp => cp.weight > 0).length;

// ---------------------------------------------------------------- state
let reviewVersion = 0;   // changes whenever the current review is cleared
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

// Small helpers for the prototype's look: icons, score colours and each checkpoint's share of the score.
const ICONS = {
  check: '<path d="M3.5 8.5 6.5 11.5 12.5 4.5"/>',
  alert: '<path d="M8 3.5v5.5M8 12v.5"/>',
  eye: '<path d="M1.5 8s2.4-4.5 6.5-4.5S14.5 8 14.5 8 12.1 12.5 8 12.5 1.5 8 1.5 8Z"/><circle cx="8" cy="8" r="1.8"/>',
};
const icon = name => `<span class="ico ico-${name}"><svg viewBox="0 0 16 16" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${ICONS[name]}</svg></span>`;
const scoreColor = score => (score >= 8 ? 'var(--accent)' : score >= 6 ? 'var(--gold)' : 'var(--rose)');
const shareOf = weight => (FIG.totalWeight ? Math.round(weight / FIG.totalWeight * 100) : 0);
// Ballet Leg's weights are the manual's numerical values (NV); Barracuda and Kip use practice weights.
const weightWord = () => (FIG.number === '101' ? 'NV' : 'weight');
const toggleClass = (el, name, on) => { if (el && el.classList) el.classList.toggle(name, on); };
const BAND_TEXT = { clean: 'Meets the requirement', small: 'Small deviation', medium: 'Medium deviation', large: 'Large deviation' };

// ---------------------------------------------------------------- 1. figure
// Is there work in this review that switching figure would clear?
const hasWork = () => Object.keys(state.saved).length > 0 || Object.values(state.drafts).some(d => d && d.frame);

function switchFigure(number) {
  FIG = FIGURES.find(f => f.number === number) || FIGURES[0];
  try { localStorage.setItem('figuresense-figure', FIG.number); } catch { /* fine without it */ }
  setCheckpointLabels();
  $('figSwitch').hidden = true;
  resetReview();
  renderFigure();
}

$('figPick').addEventListener('change', e => {
  const chosen = FIGURES.find(f => f.number === e.target.value);
  if (!hasWork()) { switchFigure(chosen.number); $('figNote').textContent = ''; return; }
  // Saved checkpoints belong to one figure, so ask before clearing them.
  e.target.value = FIG.number;
  $('figSwitch').hidden = false;
  $('figSwitch').dataset.fig = chosen.number;
  $('figSwitch').textContent = `Switch to ${chosen.short}`;
  $('figNote').textContent = 'Switching clears this review (saved progress is kept).';
});
$('figSwitch').addEventListener('click', e => {
  switchFigure(e.target.dataset.fig);
  $('figNote').textContent = `Now reviewing ${FIG.short}.`;
});

// Swimmer groups follow the team's figure sheet. Figures FigureSense can't review yet are listed but greyed out.
const GROUP_LIST = typeof GROUPS === 'undefined' ? [] : GROUPS;
let groupId = 'intermediate';
try {
  const g = localStorage.getItem('figuresense-group');
  if (GROUP_LIST.some(x => x.id === g)) groupId = g;
} catch { /* storage blocked: Intermediate */ }

const figureOption = f => `<option value="${f.number}">${f.number} · ${f.name} (DD ${f.dd})</option>`;
function figureOptions() {
  const group = GROUP_LIST.find(g => g.id === groupId);
  if (!group) return FIGURES.map(figureOption).join('');
  const listed = new Set();
  let html = group.sections.map(section => {
    const options = section.figures.map(x => {
      const f = FIGURES.find(y => y.number === x.number);
      if (!f) return `<option value="" disabled>${x.number} · ${x.name} (coming later)</option>`;
      listed.add(f.number);
      return figureOption(f);
    }).join('');
    return section.label ? `<optgroup label="${section.label}">${options}</optgroup>` : options;
  }).join('');
  const others = FIGURES.filter(f => !listed.has(f.number));
  if (others.length) html += `<optgroup label="Other figures FigureSense can review">${others.map(figureOption).join('')}</optgroup>`;
  return html;
}

$('group').addEventListener('change', e => {
  groupId = e.target.value;
  try { localStorage.setItem('figuresense-group', groupId); } catch { /* fine without it */ }
  renderFigure();
});

function renderFigure() {
  const group = GROUP_LIST.find(g => g.id === groupId);
  $('group').innerHTML = GROUP_LIST.map(g => `<option value="${g.id}">${g.label}</option>`).join('');
  $('group').value = groupId;
  $('figPick').innerHTML = figureOptions();
  $('figPick').value = FIG.number;
  if (group) {
    const all = group.sections.flatMap(s => s.figures);
    const ready = all.filter(x => FIGURES.some(f => f.number === x.number)).length;
    $('groupNote').textContent = `${group.label} figure sheet: ${ready} of ${all.length} figures can be reviewed now; the rest are coming later.`;
  }
  $('figTitle').textContent = `Figure ${FIG.number} · ${FIG.name}`;
  $('figFacts').textContent = `DD ${FIG.dd} · total ${weightWord()} ${FIG.totalWeight.toFixed(1)}`;
  $('figSummary').textContent = FIG.summary;
  $('findMoments').textContent = `Find the ${FIG.checkpoints.length} moments for me`;
  // Position cards: an illustration or a diagram (the switch above them chooses).
  const top = Math.max(...FIG.checkpoints.map(cp => cp.weight));
  $('cpCards').innerHTML = FIG.checkpoints.map(cp => `
    <div class="seq-node${cp.weight === top ? ' is-key' : ''}">
      ${poseCard(cp.pose)}
      <b>${cp.label}</b>
      <small>${cp.weight ? `${weightWord()} ${cp.weight.toFixed(1)} · ${shareOf(cp.weight)}% of score` : 'Reference, not scored'}</small>
    </div>`).join('');
  // Technical requirements: what each position is measured against, and what a coach watches for.
  $('figReqs').innerHTML = FIG.checkpoints.map(cp => `
    <div class="req">
      <h4>${cp.label}${cp.weight ? '' : ' <small>(reference)</small>'}</h4>
      <ul>${(cp.metrics || []).map(m => `<li>${m.label}: <b>${targetText(m)}</b></li>`).join('')}
        ${cp.checks.map(c => `<li>${c.text} <small>${c.tests ? '(measured)' : "(coach's eye)"}</small></li>`).join('')}</ul>
    </div>`).join('');
  $('uploadFigure').textContent = `${FIG.number} · ${FIG.name}`;
  $('demoFigureNote').hidden = FIG.number === '101';
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
  loadClip(URL.createObjectURL(file));   // plays straight from the device, no upload
});

// Drop a video on the box (once permission is ticked).
const dropZone = $('fileLabel');
['dragenter', 'dragover'].forEach(name => dropZone.addEventListener(name, e => {
  e.preventDefault();
  if (!$('fileInput').disabled) toggleClass(dropZone, 'is-dragover', true);
}));
['dragleave', 'drop'].forEach(name => dropZone.addEventListener(name, () => toggleClass(dropZone, 'is-dragover', false)));
dropZone.addEventListener('drop', e => {
  e.preventDefault();
  if ($('fileInput').disabled) { $('videoInfo').textContent = 'Tick the permission box first.'; return; }
  const file = e.dataTransfer && e.dataTransfer.files[0];
  if (!file) return;
  if (!file.type.startsWith('video/')) { $('videoInfo').textContent = 'That file is not a video. Choose an MP4 or MOV clip.'; return; }
  if (file.size > MAX_BYTES) { $('videoInfo').textContent = 'That video is over 200 MB. Trim it to just the figure and try again.'; return; }
  loadClip(URL.createObjectURL(file));
});

// A different clip starts a new review, leaving saved progress untouched.
function loadClip(src) {
  resetReview();
  if (player.src && player.src.startsWith('blob:')) URL.revokeObjectURL(player.src);
  player.src = src;
  const preview = $('uploadPreview');
  if (preview) { preview.src = src; preview.hidden = false; }
  $('videoInfo').textContent = 'Loading…';
}

// Xavier's Ballet Leg clip, so a swimmer can try the app without a video of their own.
// (Xavier and the project owner approved publishing it; the permission box is for other swimmers' videos.)
$('demoClip').addEventListener('click', () => {
  if (hasWork() && !window.confirm('Load the demo and clear this review? Saved progress is kept.')) return;
  if (FIG.number !== '101') { switchFigure('101'); $('figNote').textContent = 'Switched to Ballet Leg for the demo.'; }
  const meta = document.querySelector('meta[name="fs-demo-clip"]');
  loadClip(meta ? meta.content : 'demo-assets/xavier-ballet-leg-demo.mp4');
  $('videoInfo').textContent = "Loading Xavier's demo…";
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
function showTime() {
  $('timeNow').textContent = player.currentTime.toFixed(2) + ' s';
  if (player.duration) $('tlProgress').style.width = (player.currentTime / player.duration) * 100 + '%';
}
player.addEventListener('timeupdate', showTime);
player.addEventListener('seeked', showTime);
player.addEventListener('play', () => { $('playPause').textContent = 'Pause'; });
player.addEventListener('pause', () => { $('playPause').textContent = 'Play'; });
player.addEventListener('durationchange', () => renderTimeline());

// The timeline under the video: click to jump; numbered marks show each checkpoint's frame.
$('tlTrack').addEventListener('click', e => {
  if (!player.duration) return;
  const r = $('tlTrack').getBoundingClientRect();
  player.pause();
  player.currentTime = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)) * player.duration;
});
function renderTimeline() {
  const dur = player.duration;
  if (!dur) { $('tlMarks').innerHTML = ''; return; }
  $('tlMarks').innerHTML = FIG.checkpoints.map((cp, i) => {
    const c = state.drafts[cp.id] || state.saved[cp.id];
    const t = c && c.time !== null ? c.time : state.picks ? state.picks[cp.id] : null;
    if (t === null || t === undefined) return '';
    return `<div class="tl-mark" style="left:${(t / dur) * 100}%" title="${cp.label}"><b>${i + 1}</b></div>`;
  }).join('');
}
function togglePlay() { if (player.paused) player.play(); else player.pause(); }
$('playPause').addEventListener('click', togglePlay);
function nudge(seconds) {
  if (!player.duration) return;
  player.pause();
  player.currentTime = Math.max(0, Math.min(player.duration, player.currentTime + seconds));
}
$('stepRow').addEventListener('click', e => {
  const b = e.target.closest && e.target.closest('[data-nudge]');
  if (b) nudge(Number(b.dataset.nudge));
});

function step(dir) {
  player.pause();
  player.currentTime = Math.max(0, Math.min(player.duration, player.currentTime + dir * FRAME));
}
$('prevFrame').addEventListener('click', () => step(-1));
$('nextFrame').addEventListener('click', () => step(1));

// Keyboard on the Review step: ←/→ one frame (Shift: 0.5 s), Space play/pause, C capture.
window.addEventListener('keydown', e => {
  if (document.body.dataset.page !== 'capture' || !player.videoWidth) return;
  const t = e.target;
  if (t && (t.tagName === 'INPUT' || t.tagName === 'SELECT' || t.tagName === 'TEXTAREA' || t === canvas)) return;
  if (e.key === 'ArrowLeft') { if (e.shiftKey) nudge(-0.5); else step(-1); e.preventDefault(); }
  else if (e.key === 'ArrowRight') { if (e.shiftKey) nudge(0.5); else step(1); e.preventDefault(); }
  else if (e.key === ' ' && !(t && t.tagName === 'BUTTON')) { togglePlay(); e.preventDefault(); }
  else if ((e.key === 'c' || e.key === 'C') && !e.repeat && !e.metaKey && !e.ctrlKey) { captureFrame(); e.preventDefault(); }
});

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
  const version = reviewVersion;
  const figure = FIG;
  const source = player.src;
  try {
    const samples = await scanVideo(player, {
      onProgress: f => { if (version !== reviewVersion) return; $('scanProgress').value = f; setStatus($('scanStatus'), `Looking through the video… ${Math.round(f * 100)}%`); },
    });
    if (version !== reviewVersion) return;
    const { side, times } = pickSequence(figure, samples);
    state.side = side;
    state.picks = times;
    const found = Object.values(times).filter(t => t !== null).length;
    const sideNote = FIG.finder === 'ballet' ? ` (working leg: swimmer's ${side})` : '';
    setStatus($('scanStatus'), found
      ? `Found ${found} of ${FIG.checkpoints.length} moments${sideNote}. Check each one before saving.`
      : `No clear ${FIG.short} found. Move to each moment yourself and capture it.`, found ? 'ok' : 'warn');
  } catch (err) {
    if (version !== reviewVersion) return;
    setStatus($('scanStatus'), "Pose detection couldn't load, so moments can't be found automatically. It needs an internet connection, and some hosts block it. You can still capture each frame yourself.", 'error');
    console.error(err);
  } finally {
    try {
      if (source === player.src) await seekTo(player, resumeAt);
    } catch (err) { console.error(err); }
    $('scanProgress').hidden = true;
    $('findMoments').disabled = false;
    scanning = false;
    renderPicks();
  }
});

function renderPicks() {
  const list = $('picks');
  renderTimeline();
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
  const version = reviewVersion;
  selectCheckpoint(id);
  await seekTo(player, state.picks[id]);
  if (version !== reviewVersion || state.current !== id) return;
  await captureFrame();
  if (state.picks) await suggestPoints(true);
  document.dispatchEvent(new CustomEvent('fs-goto', { detail: 'capture' }));   // nav.js shows the Review step
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
  $('tabs').innerHTML = FIG.checkpoints.map((cp, i) => {
    const d = state.drafts[cp.id], s = state.saved[cp.id];
    const edited = s && d && snapshot(d) !== snapshot(s);
    const pending = !s && d && d.frame;
    const cls = 'stepdot' + (cp.id === state.current ? ' is-current' : '') + (s ? ' is-done' : pending ? ' is-pending' : '');
    const sub = edited ? 'unsaved edits' : pending ? `${d.time.toFixed(2)}s · not saved yet` : cp.weight ? `${shareOf(cp.weight)}% of score` : 'reference';
    const score = s ? scoreCheckpoint(cp, s.points, s.checks, LABELS, state.saved).score : null;
    return `<li><button type="button" class="${cls}" data-cp="${cp.id}" aria-pressed="${cp.id === state.current}">${poseCard(cp.pose, 'pose-sm')}
      <span><b>${i + 1}. ${cp.label}</b><small>${sub}</small></span>${score === null ? '' : `<em style="color:${scoreColor(score)}">${score.toFixed(1)}</em>`}</button></li>`;
  }).join('');
  renderTimeline();
  renderThumbs();
}

// Small pictures of each captured frame, to jump between checkpoints.
function renderThumbs() {
  $('thumbs').innerHTML = FIG.checkpoints.map((cp, i) => {
    const c = state.drafts[cp.id] || state.saved[cp.id];
    if (!c || !c.thumb) return '';
    return `<button type="button" class="thumb" data-cp="${cp.id}"><img src="${c.thumb}" alt="${cp.label} at ${c.time.toFixed(2)} seconds"><span>${i + 1} · ${c.time.toFixed(2)}s</span></button>`;
  }).join('');
}
$('thumbs').addEventListener('click', e => {
  const b = e.target.closest && e.target.closest('[data-cp]');
  if (b) selectCheckpoint(b.dataset.cp);
});
$('tabs').addEventListener('click', e => {
  const b = e.target.closest('[data-cp]');
  if (b) selectCheckpoint(b.dataset.cp);
});

function selectCheckpoint(id) {
  state.current = id;
  state.selected = null;
  const s = state.drafts[id] || state.saved[id];
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
  d.thumb = smallCopy(frame, 160);
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

function smallCopy(frame, width) {
  try {
    const c = document.createElement('canvas');
    c.width = width;
    c.height = Math.round(frame.height * width / frame.width);
    c.getContext('2d').drawImage(frame, 0, 0, c.width, c.height);
    return c.toDataURL('image/jpeg', 0.7);
  } catch { return null; }
}

// Fine-tune this checkpoint's frame by one video frame; the dots stay where they are.
let shiftingFrame = false;
async function shiftFrame(dir) {
  const d = draft();
  if (shiftingFrame || !d || !d.frame || !player.duration) return;
  const version = reviewVersion, id = state.current;
  shiftingFrame = true;
  try {
    await seekTo(player, Math.max(0, Math.min(player.duration, d.time + dir * FRAME)));
    if (version !== reviewVersion || state.current !== id || draft() !== d) return;
    // captureFrame keeps the current points and checks; do not restore an older copy.
    await captureFrame();
  } catch (err) {
    if (version === reviewVersion && state.current === id) setStatus($('markStatus'), 'Could not move to that frame. Try again.', 'error');
  } finally {
    shiftingFrame = false;
  }
}
$('cpEarlier').addEventListener('click', () => shiftFrame(-1));
$('cpLater').addEventListener('click', () => shiftFrame(1));

function copyDraft(s) {
  return { time: s.time, frame: s.frame, thumb: s.thumb, points: JSON.parse(JSON.stringify(s.points)), checks: [...s.checks], note: '' };
}

async function suggestPoints(quiet = false) {
  const d = draft();
  if (!d || !d.frame) return;
  const version = reviewVersion, checkpoint = state.current, frame = d.frame;
  const current = () => version === reviewVersion && state.current === checkpoint && draft() === d && d.frame === frame;
  $('suggest').disabled = true;
  setStatus($('markStatus'), 'Finding the body…');
  try {
    const pose = await detectPose(frame);
    if (!current()) return;
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
    if (!quiet && current()) setStatus($('markStatus'), "Pose detection couldn't load here. It needs an internet connection, and some hosts block it. Place the points yourself.", 'error');
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
  const index = FIG.checkpoints.indexOf(cp);
  // The heading: the position's picture, the figure and which step this is.
  $('capArt').innerHTML = poseCard(cp.pose, 'pose-lg');
  $('capFigure').textContent = `FIGURE ${FIG.number} · DD ${FIG.dd}`;
  $('capTitle').textContent = FIG.name;
  $('capStep').textContent = `Step ${index + 1} of ${FIG.checkpoints.length} · ${cp.label}`;
  $('cue').innerHTML = `<b>${cp.label}.</b> ${cp.cue}`;
  $('cpWeight').textContent = cp.weight ? `${weightWord()} ${cp.weight.toFixed(1)} · ${shareOf(cp.weight)}%` : 'reference';
  $('frameTime').textContent = d && d.time !== null ? `${d.time.toFixed(2)} s` : '—';
  $('refineRow').hidden = !(d && d.frame);
  $('suggest').disabled = !(d && d.frame);
  $('frameEmpty').hidden = !!(d && d.frame);
  canvas.hidden = !(d && d.frame);
  if (d && d.frame) { canvas.width = d.frame.width; canvas.height = d.frame.height; }
  applyZoom();
  if (clearStatus) setStatus($('markStatus'), d && d.note ? d.note : '', d && d.note ? 'warn' : '');

  // point chips: a coloured dot that fills in once the point is placed
  const needed = pointsNeeded(cp);
  $('chips').innerHTML = pointsUsed(cp).map(n => {
    const cls = 'lm-chip chip' + (d && d.points[n] ? ' is-set placed' : '') + (state.selected === n ? ' is-active' : '') + (needed.includes(n) ? '' : ' optional');
    const tone = n.startsWith('water') ? '#2F8FE0' : 'var(--mark, #C9471F)';
    return `<button type="button" class="${cls}" data-pt="${n}" aria-pressed="${state.selected === n}"
      title="${hintFor(FIG, n)}${needed.includes(n) ? '' : ' (optional: lets a coach\'s-eye item be measured)'}"><span class="dotk" style="background:${tone}"></span>${LANDMARKS[n].label}${needed.includes(n) ? '' : ' <small>optional</small>'}</button>`;
  }).join('');
  $('pointHint').textContent = state.selected ? `Next: ${hintFor(FIG, state.selected)}.` : (d && d.frame ? 'All points placed. Drag any that are off.' : 'Capture a frame first.');

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
  // Live measurement cards with the deviation dial.
  $('live').innerHTML = result.rows.map(r => {
    if (r.error) return `<div class="mcard band-error"><span>${r.metric.label}</span><strong>${r.error}</strong><small>Target ${targetText(r.metric)}</small></div>`;
    const dial = typeof deviationDial === 'function' ? deviationDial(r.deviation, r.metric.tol) : deviationGauge(r.deviation, r.metric.tol);
    return `<div class="mcard band-${r.deduction.band}"><span>${r.metric.label}</span><strong>${r.value.toFixed(1)}°</strong>${dial}
      <small>Target ${targetText(r.metric)} · ${r.deduction.label}${r.deduction.value ? ' −' + r.deduction.value.toFixed(1) : ''}</small></div>`;
  }).join('');
  // Coach's eye: measured items are decided by the points; the rest are ticked by eye.
  let measured = 0;
  $('checks').innerHTML = result.checkResults.map((c, i) => {
    if (c.measured) {
      measured++;
      return `<div class="check is-measured ${c.pass ? 'is-pass' : 'is-fail'}">${icon(c.pass ? 'check' : 'alert')}<span><b>${c.check.text}</b>
        ${c.parts.map(p => `<small>${p.test.label}: ${p.display} (needs ${p.limit})</small>`).join('')}</span></div>`;
    }
    return `<label class="check"><input type="checkbox" data-check="${i}" ${d && d.checks[i] ? 'checked' : ''} ${d && d.frame ? '' : 'disabled'}>
      <span>${c.check.text}<small>${c.check.tests ? 'Tick by eye for now. ' + c.reason : "Coach's eye: tick it if you see it."}</small></span></label>`;
  }).join('');
  const coach = result.checkResults.length - measured;
  $('checkCount').textContent = [measured && `${measured} measured from the video`, coach && `${coach} for your coach`].filter(Boolean).join(' · ');
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
    box.innerHTML = '<div class="card"><p class="empty-note">Save at least one scored checkpoint to see results.</p></div>';
    $('keepBox').hidden = true;
    return;
  }
  $('keepBox').hidden = false;
  $('saveProgress').textContent = historyId ? 'Update my saved progress' : 'Save to my progress';
  const savedCount = out.results.filter(r => r.saved).length;
  box.innerHTML = `
    <div class="scoreboard" id="scoreboard" data-complete="${!out.provisional}">
      <div class="score-hero">
        <p class="eyebrow">FIGURE ${FIG.number} · ${FIG.name}</p>
        <div class="big">${out.figureScore.toFixed(2)}</div>
        ${out.provisional ? `<span class="pill pill-warn score-flag">Provisional · ${savedCount} of ${FIG.checkpoints.length} saved</span>` : ''}
        <p class="big-sub">Practice score ${out.practice.toFixed(2)} × DD ${FIG.dd}, out of ${(10 * FIG.dd).toFixed(0)}. ${out.provisional ? 'Save the other checkpoints on the Review step for a full total.' : 'An uncalibrated estimate from one camera angle.'}</p>
      </div>
      <div class="score-stats">
        <div class="stat"><span>Practice score / 10</span><b>${out.practice.toFixed(2)}</b></div>
        <div class="stat"><span>Degree of difficulty</span><b>${FIG.dd}</b></div>
        <div class="stat"><span>Checkpoints saved</span><b>${savedCount} of ${FIG.checkpoints.length}</b></div>
      </div>
    </div>
    ${summaryHtml(out)}
    <div class="card">
      <div class="card-head"><h2>Diagnostics</h2><span class="pill">measured against the figure's requirements</span></div>
      <div class="seq-strip" id="diagSeq">${FIG.checkpoints.map(cp => {
        const r = out.results.find(x => x.checkpoint.id === cp.id);
        return `<div class="seq-node">${poseCard(cp.pose)}<b>${cp.label}</b>${r && r.saved ? `<em style="color:${scoreColor(r.score)}">${r.score.toFixed(1)}</em>` : ''}<small>${cp.weight ? shareOf(cp.weight) + '% of score' : 'reference'}</small></div>`;
      }).join('')}</div>
      <div id="diagnostics">${out.results.map(resultHtml).join('')}</div>
    </div>
    <div class="card">
      <div class="card-head"><h2>What to work on</h2><span class="pill">drills ranked by score impact</span></div>
      <div id="plan">${planHtml(out)}</div>
    </div>`;
  // Draw the frames with your lines and the green target lines.
  for (const r of out.results) {
    if (!r.saved) continue;
    const s = state.saved[r.checkpoint.id];
    const c = box.querySelector && box.querySelector(`canvas[data-thumb="${r.checkpoint.id}"]`);
    if (!c) continue;
    const k = Math.min(1, 640 / s.frame.width);
    c.width = Math.round(s.frame.width * k);
    c.height = Math.round(s.frame.height * k);
    paint(c.getContext('2d'), s.frame, s.points, k, { lineWidth: 2, targets: lostMetrics(r) });
  }
}

// Results buttons: "Find this checkpoint" and "Watch the drill" (plays just the drill's part of the video here).
$('resultsBody').addEventListener('click', e => {
  const find = e.target.closest && e.target.closest('[data-find]');
  if (find) {
    selectCheckpoint(find.dataset.find);
    document.dispatchEvent(new CustomEvent('fs-goto', { detail: 'capture' }));
    return;
  }
  const watch = e.target.closest && e.target.closest('[data-watch]');
  if (!watch) return;
  const d = DRILLS[watch.dataset.watch];
  const v = d && d.video;
  if (!v) return;
  const frame = document.createElement('iframe');
  frame.className = 'drill-video';
  frame.dataset.watch = watch.dataset.watch;
  frame.title = `${d.name}: ${v.title || 'drill video'}, by ${v.channel}`;
  frame.src = `https://www.youtube-nocookie.com/embed/${v.id}?start=${v.start || 0}${v.end ? '&end=' + v.end : ''}&autoplay=1&rel=0&playsinline=1`;
  frame.allow = 'autoplay; encrypted-media; picture-in-picture; fullscreen';
  frame.allowFullscreen = true;
  frame.referrerPolicy = 'strict-origin-when-cross-origin';
  watch.replaceWith(frame);
});

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
  img.alt = `Report with the ${FIG.short} score, the checkpoints and what to work on`;
  $('reportImgBox').replaceChildren(img);
  $('reportDownload').href = url;
  // Inside the Claude page viewer, downloads are blocked, so only the save-the-image tip shows there.
  $('reportDownload').hidden = !!window.claude;
  $('reportBox').hidden = false;
  setStatus($('keepStatus'), 'Report image ready.', 'ok');
});

// Saved reviews keep the figure number; show its short name when we know it.
const figureName = number => {
  const f = FIGURES.find(x => x.number === number);
  return f ? f.short : 'Figure ' + number;
};

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
      <td>${esc(figureName(r.figure))}</td>
      <td class="num">${r.figureScore.toFixed(2)}${r.provisional ? ' <span class="pill small">provisional</span>' : ''}</td>
      <td class="num">${change}</td>
      <td>${r.top.length ? esc(r.top[0]) : '<span class="muted">nothing lost points</span>'}</td>
      <td><button type="button" class="link" data-del="${esc(r.id)}">Delete</button></td>
    </tr>`;
  }).join('');
  $('progressBody').innerHTML = `<div class="table-wrap"><table>
    <thead><tr><th>Date</th><th>Swimmer</th><th>Figure</th><th class="num">Score</th><th class="num">Change</th><th>Top thing to work on</th><th></th></tr></thead>
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
  return `<div class="summary-stats">
    <div class="stat"><span>Strongest saved checkpoint</span><b>${best ? `${best.checkpoint.label} · ${best.score.toFixed(1)}` : '—'}</b></div>
    <div class="stat"><span>Lowest saved score</span><b>${worst && worst !== best ? `${worst.checkpoint.label} · ${worst.score.toFixed(1)}` : '—'}</b></div>
    <div class="stat"><span>Measurements on target</span><b>${onTarget} of ${rows.length}</b></div>
    <div class="stat"><span>Coach's-eye items met</span><b>${met} of ${checks.length}</b><small>${measured} met by measurement, ${met - measured} met by eye</small></div>
  </div>`;
}

const clock = t => `${Math.floor(t / 60)}:${String(Math.round(t % 60)).padStart(2, '0')}`;
const WHERE_TEXT = { Pool: 'In the pool', Land: 'On land', 'Land or pool': 'On land or in the pool' };

// One drill: where, how, how much, and its video segment (played in the card) or a written guide.
function drillCard(id, helps) {
  const d = DRILLS[id];
  const v = d.video;
  const watch = v ? `<button type="button" class="drill-watch" data-watch="${id}"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="11" fill="currentColor"/><path d="m10 8 6 4-6 4Z" fill="#FFFFFF"/></svg>
      <span>Watch the drill · ${clock(v.start || 0)}${v.end ? '–' + clock(v.end) : ''}</span><small>${v.channel}${v.title ? ': ' + v.title : ''}</small></button>` : '';
  return `<article class="drill-card" data-where="${d.where === 'Pool' ? 'pool' : 'land'}">
    <div class="drill-top"><span class="drill-where">${WHERE_TEXT[d.where] || d.where}</span><h4>${d.name}</h4></div>
    <p class="drill-how">${d.how}</p>
    <p class="drill-dose"><b>Amount: </b>${d.dose}<small> · a starting point to agree with your coach</small></p>
    <p class="drill-helps">Helps with: ${helps.join('; ')}</p>
    ${watch}<a class="drill-source" href="${videoLink(d)}" target="_blank" rel="noopener">${v ? 'Open on YouTube ↗' : linkText(d) + ' ↗'}</a>
  </article>`;
}

// ---- practice plan: the biggest problems first, each with drills (pool and land)
function planHtml(out) {
  const scored = out.results.filter(r => r.saved && r.checkpoint.weight > 0);
  if (!scored.length) return '<p class="empty-note">Save some checkpoints and a plan will appear here.</p>';
  // Which problems each drill helps with.
  const helps = new Map();
  for (const issue of out.issues.slice(0, 5)) {
    for (const id of (FIG.drillsFor[issue.drillKey] || []).slice(0, 2)) {
      if (!helps.has(id)) helps.set(id, []);
      if (!helps.get(id).includes(issue.title)) helps.get(id).push(issue.title);
    }
  }
  const weakest = scored.reduce((a, b) => ((10 - b.score) * b.checkpoint.weight > (10 - a.score) * a.checkpoint.weight ? b : a));
  let html = `<div class="plan-focus"><h3>Focus: ${weakest.checkpoint.label}</h3>
    <p>Worth ${shareOf(weakest.checkpoint.weight)}% of the figure score and scores ${weakest.score.toFixed(1)}. Improving it moves the total more than anything else you saved.</p></div>`;
  const used = new Set(), seen = new Set();
  let shown = 0;
  for (const issue of out.issues) {
    if (shown >= 3 || seen.has(issue.drillKey)) continue;
    const ids = (FIG.drillsFor[issue.drillKey] || []).filter(id => DRILLS[id] && !used.has(id)).slice(0, 2);
    if (!ids.length) continue;
    seen.add(issue.drillKey);
    ids.forEach(id => used.add(id));
    shown++;
    html += `<section class="plan-item"><div class="plan-head"><span class="plan-num">${shown}</span><div>
        <h3>${issue.title}</h3><p class="plan-detail">${issue.checkpoint.label} · ${issue.detail} · costs about ${issue.cost.toFixed(2)} figure points</p></div></div>
      <div class="drill-grid">${ids.map(id => drillCard(id, helps.get(id) || [issue.title])).join('')}</div></section>`;
  }
  if (!shown) html += '<p class="empty-note">Nothing lost points in the saved checkpoints. Keep filming from the same angle and compare week to week.</p>';
  // What the camera cannot see still gets practice, but the coach decides whether it is right.
  const coach = scored.flatMap(r => r.checkResults.filter(c => !c.measured && !c.pass).map(c => ({ c, r })));
  if (coach.length) {
    html += `<section class="plan-item plan-coach"><div class="plan-head">${icon('eye')}<div>
        <h3>Ask your coach to watch for</h3><p class="plan-detail">A side camera cannot judge these. Practise them, and let your coach confirm.</p></div></div>
      <ul class="coach-list">${coach.map(({ c, r }) => `<li><b>${r.checkpoint.label}: </b>${c.check.text}</li>`).join('')}</ul></section>`;
  }
  return html + '<p class="plan-safety">Practise in the pool only with a qualified coach or lifeguard on deck, and never do breath-hold work alone. Stop any stretch or exercise that causes sharp pain.</p>';
}

// ---- one checkpoint: your frame with the target lines, beside a required-vs-your-video table
function resultHtml(r, index = 0) {
  const cp = r.checkpoint;
  const meta = cp.weight ? `${shareOf(cp.weight)}% of score` : 'Reference, not scored';
  const head = `<header class="cmp-head"><div class="cmp-title"><span class="cmp-num">${index + 1}</span><h3>${cp.label}</h3></div>
    <div class="cmp-meta"><span>${meta}</span>${r.saved ? `<b class="cmp-score" style="color:${scoreColor(r.score)}">${r.score.toFixed(1)}</b><span class="pill pill-good">Saved · ${r.time.toFixed(2)} s</span>` : ''}</div></header>`;
  if (!r.saved) {
    return `<article class="cmp-card is-missing">${head}<div class="cmp-empty"><p>No saved frame yet. ${cp.cue || ''}</p>
      <button type="button" class="btn btn-ghost" data-find="${cp.id}">Find this checkpoint</button></div></article>`;
  }
  const scored = cp.weight > 0;
  const row = (what, required, yours, cls, result, ico) =>
    `<tr class="is-${cls}"><th>${what}</th><td>${required}</td><td class="cmp-yours">${yours}</td><td class="cmp-result"><div>${icon(ico)}<span>${result}</span></div></td></tr>`;
  const rows = r.rows.map(m => {
    const good = m.deduction.band === 'clean';
    return row(m.metric.label, targetText(m.metric), `${m.value.toFixed(1)}°${Math.abs(m.value - m.deviation) > 0.05 ? ` · ${m.deviation.toFixed(1)}° off` : ''} ${deviationGauge(m.deviation, m.metric.tol)}`,
      good ? 'good' : 'dev-' + m.deduction.band,
      good ? BAND_TEXT.clean : (BAND_TEXT[m.deduction.band] || m.deduction.label) + (scored ? ` · −${m.deduction.value.toFixed(1)}` : ' · not scored'), good ? 'check' : 'alert');
  }).join('');
  const checks = r.checkResults.map(c => c.measured
    ? row(c.check.text, c.parts.map(p => p.limit).join(' · '), c.parts.map(p => p.display).join(' · '), c.pass ? 'good' : 'dev-small',
        c.pass ? BAND_TEXT.clean : 'Not met' + (scored ? ' · −0.2' : ' · not scored'), c.pass ? 'check' : 'alert')
    : row(c.check.text, 'Coach checks', c.pass ? 'Ticked by you' : 'Not ticked', c.pass ? 'good' : 'coach',
        c.pass ? 'Confirmed by you' : 'Ask your coach' + (scored ? ' · −0.2 until confirmed' : ''), c.pass ? 'check' : 'eye')).join('');
  return `<article class="cmp-card">${head}<div class="cmp-body">
    <figure class="cmp-figure"><canvas data-thumb="${cp.id}" role="img" aria-label="${cp.label}: your position with the target lines drawn over it"></canvas>
      <figcaption class="cmp-legend"><span><i class="lg-yours"></i>Your position</span><span><i class="lg-req"></i>Where it should be</span></figcaption></figure>
    <div class="cmp-table-wrap"><table class="cmp-table"><thead><tr><th>Requirement</th><th>Required</th><th>In your video</th><th>Result</th></tr></thead>
      <tbody>${rows}${checks}</tbody></table></div></div></article>`;
}

// ---------------------------------------------------------------- start over
let armed = false;
$('startOver').addEventListener('click', () => {
  if (!armed) {
    armed = true;
    $('startOver').textContent = 'Click again to clear everything';
    $('startOverNote').textContent = 'This clears the current review. Saved progress is kept.';
    setTimeout(() => { armed = false; $('startOver').textContent = 'New review'; $('startOverNote').textContent = ''; }, 5000);
    return;
  }
  armed = false;
  resetReview();
  $('startOver').textContent = 'New review';
  $('startOverNote').textContent = 'Cleared.';
  document.dispatchEvent(new CustomEvent('fs-goto', { detail: 'setup' }));
});

function resetReview() {
  reviewVersion++;
  setStatus($('scanStatus'), '');
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
