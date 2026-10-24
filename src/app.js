/**
 * FigureSense — Figure Advisor controller.
 *
 * Flow: pick group and figure -> upload a clip -> capture each checkpoint ->
 * read the diagnostics. Nothing leaves the browser tab.
 */

import { GROUPS, LANDMARKS, REFERENCE, DRILLS, getFigure } from './figures.js';
import { waterFrame, segmentToWater, referenceScale, evaluateMetric, evaluateCheck, deductionFor, scoreFigure, SCALED_KINDS } from './geometry.js';
import { poseArt, deviationDial } from './poses.js';
import { DEMO_HASH, DEMO_PICKS, poseCandidate, pickBalletSequence } from './ballet-assist.js';
import { scanVideo, addFeatures, pickCheckpoints, sampleAt } from './autoscan.js';

const $ = id => document.getElementById(id);
const video = $('video');
const canvas = $('canvas');
const ctx = canvas.getContext('2d', { willReadFrequently: true });

const TONE = { water: '#ffcf6b', body: '#B8E2FF', alt: '#edf7ff', accent: '#ff7a8a' };
// The same tones for page text, which must follow the light or dark theme rather than the video.
const CHIP_TONE = { water: 'var(--gold)', body: 'var(--accent)', alt: 'var(--ink)', accent: 'var(--rose)' };

// [from, to, skipIfPresent] — the third entry avoids doubling up on a jointed limb.
const SKELETON = [
  ['waterA', 'waterB'], ['head', 'shoulder'], ['shoulder', 'hip'],
  ['hip', 'knee'], ['knee', 'ankle'], ['ankle', 'toe'],
  ['hip', 'kneeB'], ['kneeB', 'ankleB'], ['ankleB', 'toeB'],
  ['hip', 'ankle', 'knee'], ['hip', 'ankleB', 'kneeB'], ['crotch', 'kneecap']
];

const POSE_IDS = {
  head: [0, 0], shoulder: [11, 12], hip: [23, 24],
  knee: [25, 26], ankle: [27, 28], toe: [31, 32]
};

const state = {
  figure: null,
  cpIndex: 0,
  captures: {},
  draft: null,
  activeLm: null,
  url: null,
  demo: false,
  models: {},
  tasks: null,
  busy: false,
  waterline: null,
  waterMode: false,
  samples: null,
  autoFrames: {},
  confidence: {},
  drafts: {},
  file: null
};

const el = (tag, cls, text) => {
  const node = document.createElement(tag);
  if (cls) node.className = cls;
  if (text !== undefined) node.textContent = text;
  return node;
};
const say = (text, tone = '') => {
  const s = $('status');
  s.textContent = text;
  s.className = 'status' + (tone ? ' is-' + tone : '');
};
const currentCp = () => state.figure?.checkpoints[state.cpIndex] ?? null;
/** Landmarks the current panel is collecting — just the surface while setting the waterline. */
const activeLandmarks = () => (state.waterMode ? ['waterA', 'waterB'] : currentCp()?.landmarks ?? []);
/** A checkpoint's share of the figure score, from the manual's numerical values. */
const shareOf = weight => Math.round((weight / state.figure.totalNV) * 100);
const isKeyCheckpoint = cp => cp.weight > 0 && cp.weight === Math.max(...state.figure.checkpoints.map(c => c.weight));

/** Saved checkpoints plus every frame found in the video that is not saved yet, as detected and marked
 *  unconfirmed. Edits on the Review page count only once they are saved. */
function measuredCaptures() {
  const out = {};
  const add = (id, d) => {
    if (!d?.points) return;
    try {
      out[id] = { points: d.points, frame: waterFrame(d.points.waterA, d.points.waterB), scale: referenceScale(d.points),
        time: d.time, checks: new Set(d.checks ?? []), bitmap: d.bitmap, width: d.width, height: d.height, auto: true };
    } catch { /* no surface reference yet: nothing to measure */ }
  };
  for (const [id, d] of Object.entries(state.autoFrames)) add(id, d);
  return { ...out, ...state.captures };
}

const ICONS = {
  check: '<path d="M3.5 8.5 6.5 11.5 12.5 4.5"/>',
  alert: '<path d="M8 3.5v5.5M8 12v.5"/>',
  eye: '<path d="M1.5 8s2.4-4.5 6.5-4.5S14.5 8 14.5 8 12.1 12.5 8 12.5 1.5 8 1.5 8Z"/><circle cx="8" cy="8" r="1.8"/>'
};
const icon = name => {
  const span = el('span', 'ico ico-' + name);
  span.innerHTML = `<svg viewBox="0 0 16 16" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${ICONS[name]}</svg>`;
  return span;
};

function clearReview() {
  state.captures = {};
  state.drafts = {};
  state.draft = null;
  state.cpIndex = 0;
  state.activeLm = null;
  state.waterMode = false;
  state.samples = null;
  state.autoFrames = {};
  state.confidence = {};
  state.autoAfterWaterline = false;
  $('thumbs').replaceChildren();
  $('tlMarks').replaceChildren();
  $('scoreboard').replaceChildren();
  $('diagnostics').replaceChildren();
  $('plan').replaceChildren();
  $('scanStatus').textContent = '';
}

/* ------------------------------------------------------- navigation */
function show(name, fromHistory = false) {
  const allowed = ['home','setup','upload','capture','diag'];
  if (!allowed.includes(name)) name = 'home';
  if (['upload','capture','diag'].includes(name) && !state.figure) name = 'setup';
  if (['capture','diag'].includes(name) && state.figure?.uploadOnly) name = 'upload';
  if (name === 'capture' && (!state.url || !video.videoWidth)) name = 'upload';
  const swap = () => showNow(name, fromHistory, animate);
  const animate = shownOnce && document.body.dataset.page !== name && !!document.startViewTransition && !reducedMotion.matches;
  shownOnce = true;
  if (animate) document.startViewTransition(swap); else swap();
}
let shownOnce = false;
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
function showNow(name, fromHistory, animated) {
  if (name !== 'upload') $('uploadPreview').pause();
  if (name !== 'capture') video.pause();
  if (name === 'capture') { $('autoscanCard').hidden = false; $('balletMethod').hidden = state.figure.id !== 'f101'; $('autoFind').disabled = state.figure.id !== 'f101' && !state.waterline; renderStepper(); renderCapturePanel(); }
  if (name === 'diag') renderDiagnostics();
  if (name === 'upload' && state.figure) $('uploadFigure').textContent = state.figure.number + ' · ' + state.figure.name;
  // Xavier's clip is a Ballet Leg: say so before the demo changes any other figure the swimmer picked.
  if (name === 'upload') $('demoFigureNote').hidden = !state.figure || state.figure.id === 'f101';
  document.body.dataset.page = name;
  document.querySelectorAll('.screen').forEach(s => s.classList.toggle('is-active', s.id === 'screen-' + name));
  document.querySelectorAll('.step').forEach(b => {
    b.classList.toggle('is-active', b.dataset.goto === name);
    if (b.dataset.goto === name) b.setAttribute('aria-current','step');
    else b.removeAttribute('aria-current');
  });
  placeStepGlow(true);
  if (!fromHistory && location.hash !== '#' + name) history.pushState(null, '', '#' + name);
  window.scrollTo({ top: 0, behavior: animated ? 'instant' : 'smooth' });
  if (name === 'diag') animateResults();
}
// The tab highlight: it glides to the active step and, after a click, lands with a soft pulse.
function placeStepGlow(arrive = false) {
  const steps = $('steps');
  let glow = steps.querySelector('.steps-glow');
  if (!glow) {
    glow = document.createElement('span');
    glow.className = 'steps-glow';
    glow.setAttribute('aria-hidden', 'true');
    steps.prepend(glow);
    new ResizeObserver(() => placeStepGlow()).observe(steps);
  }
  const active = steps.querySelector('.step.is-active');
  if (!active || !steps.offsetWidth) { steps.classList.remove('has-glow'); return; }
  const first = !steps.classList.contains('has-glow');
  steps.classList.toggle('glow-still', first);
  steps.style.setProperty('--glow-x', active.offsetLeft + 'px');
  steps.style.setProperty('--glow-w', active.offsetWidth + 'px');
  steps.classList.add('has-glow');
  if (first) requestAnimationFrame(() => requestAnimationFrame(() => steps.classList.remove('glow-still')));
  else if (arrive) { glow.classList.remove('is-arriving'); void glow.offsetWidth; glow.classList.add('is-arriving'); }
}
document.querySelectorAll('[data-goto]').forEach(btn => {
  btn.onclick = e => { e.preventDefault(); if (!state.busy) show(btn.dataset.goto); };
});
window.addEventListener('popstate', () => {
  // Back/forward during a scan would pause the video and cut the scan short; stay put.
  if (state.busy) { history.pushState(null, '', '#' + document.body.dataset.page); return; }
  show(location.hash.slice(1), true);
});
$('backToSetup').onclick = () => { if(!state.busy) show('setup'); };
$('toDiag').onclick = () => show('diag');

/* ---------------------------------------------------- group / figure */
function renderGroups() {
  const sel = $('group');
  for (const g of GROUPS) {
    const opt = el('option', null, g.label);
    opt.value = g.id;
    sel.append(opt);
  }
}

$('group').onchange = () => {
  clearReview();
  const group = GROUPS.find(g => g.id === $('group').value);
  const sel = $('figure');
  sel.replaceChildren();
  $('briefCard').hidden = true;
  $('uploadCard').hidden = true;
  state.figure = null;
  $('toUpload').disabled = true;

  if (!group) {
    sel.disabled = true;
    sel.append(new Option('Choose a group first', ''));
    $('groupNote').textContent = 'Groups and figures follow your team\'s figure sheet. Confirm the list in force for your meet.';
    return;
  }

  sel.disabled = false;
  sel.append(new Option('Choose a figure…', ''));
  for (const section of group.sections) {
    const parent = section.label ? el('optgroup') : sel;
    if (section.label) parent.label = section.label;
    for (const f of section.figures) {
      const label = `${f.number} · ${f.name}${f.dd ? ` — DD ${f.dd.toFixed(1)}` : ''}`;
      const opt = new Option(label, f.figure || 'catalog:' + f.number);
      parent.append(opt);
    }
    if (section.label) sel.append(parent);
  }
  $('groupNote').textContent = group.id === 'novice' ? group.note : group.id === 'intermediate' ? 'Ballet Leg includes manual checkpoint review. All listed figures support video upload.' : 'Choose any listed figure to upload a clip. Figure-specific analysis for this group is not available yet.';
};

$('figure').onchange = () => {
  clearReview();
  state.figure = null;
  $('toUpload').disabled = true;
  const id = $('figure').value;
  if (!id) { $('briefCard').hidden = true; $('uploadCard').hidden = true; return; }
  const group = GROUPS.find(g => g.id === $('group').value);
  const selected = group.sections.flatMap(section => section.figures).find(f => (f.figure || 'catalog:' + f.number) === id);
  state.figure = getFigure(id) || { ...selected, id, uploadOnly: true, checkpoints: [] };
  $('toUpload').disabled = !state.figure;
  state.captures = {};
  state.drafts = {};
  state.draft = null;
  state.cpIndex = 0;
  renderBrief();
  if (!state.figure.uploadOnly) renderReference();
  $('briefCard').hidden = false;
  $('uploadCard').hidden = false;
  $('startReview').hidden = !!state.figure.uploadOnly;
  $('startReview').disabled = !state.url || state.demo || !video.videoWidth || !!video.error;
  $('uploadSupport').hidden = !state.figure.uploadOnly;
  $('uploadSupport').textContent = state.figure.uploadOnly ? 'You can upload and play your ' + state.figure.name + ' video here. Checkpoint analysis and scoring for this figure are not available yet.' : '';
  $('briefCard').scrollIntoView({ behavior: 'smooth', block: 'start' });
};

function renderBrief() {
  const fig = state.figure;
  $('briefTitle').textContent = `Figure ${fig.number} · ${fig.name}`;
  $('briefSequenceTitle').hidden = !!fig.uploadOnly;
  $('briefReqs').closest('details').hidden = !!fig.uploadOnly;
  if (fig.uploadOnly) {
    $('briefDd').textContent = fig.dd ? `DD ${fig.dd.toFixed(1)}` : 'Video upload available';
    $('briefDesc').textContent = 'Upload a practice video for this figure. Its technical analysis sheet is not available yet.';
    ['briefSeq','briefReqs','briefChart'].forEach(id => $(id).replaceChildren());
    return;
  }
  $('briefDd').textContent = `DD ${fig.dd.toFixed(1)} · total NV ${fig.totalNV.toFixed(1)}`;
  $('briefDesc').textContent = fig.description;

  const seq = $('briefSeq');
  seq.replaceChildren();
  const topNv = Math.max(...fig.positions.map(p => p.nv ?? 0));
  fig.positions.forEach((pos, i) => {
    const node = el('div', 'seq-node' + (pos.nv === topNv ? ' is-key' : ''));
    const art = fig.checkpoints[i]?.art;
    if (art) node.append(poseArt(art, 'pose-seq'));
    node.append(el('b', null, pos.label),
      el('small', null, pos.nv ? `NV ${pos.nv.toFixed(1)} · ${Math.round((pos.nv / fig.totalNV) * 100)}% of score` : 'starting position'));
    seq.append(node);
  });

  const reqs = $('briefReqs');
  reqs.replaceChildren();
  const artOf = id => fig.checkpoints.find(c => c.id === id)?.art;
  fig.transitions.forEach(t => {
    const block = el('div', 'req');
    const fromArt = artOf(t.from);
    const toArt = artOf(t.to);
    if (fromArt && toArt) {
      const strip = el('div', 'req-art');
      strip.append(poseArt(fromArt, 'pose-req'), el('span', 'req-arrow', '→'), poseArt(toArt, 'pose-req'));
      block.append(strip);
    }
    block.append(el('h4', null, t.title));
    const list = el('ul');
    t.actions.forEach(a => list.append(el('li', null, a)));
    block.append(list);
    reqs.append(block);
  });

  const chart = $('briefChart');
  chart.replaceChildren();
  if (fig.heightChart) {
    chart.append(el('h3', 'mini-title', fig.heightChart.title));
    const table = el('table');
    const head = el('tr');
    head.append(el('th', null, 'Score'), el('th', null, fig.heightChart.caption));
    table.append(head);
    fig.heightChart.rows.forEach(([score, text]) => {
      const tr = el('tr');
      tr.append(el('td', null, score), el('td', null, text));
      table.append(tr);
    });
    chart.append(table);
  }
}

/* ------------------------------------------------------------ upload */
const busyUpload = () => {
  if (!state.busy) return false;
  $('setupStatus').textContent = 'Wait for the current scan to finish, then choose the clip.';
  $('setupStatus').className = 'status is-error';
  $('file').value = '';
  return true;
};
$('file').onchange = () => { if (!busyUpload()) loadVideoFile($('file').files[0]); };
// Browsers cannot open the picker at a folder path. Chromium can start on the Desktop and then
// remember the folder the last clip came from (e.g. Desktop › Xavier › FigureSense) for this site.
if ('showOpenFilePicker' in window && window.self === window.top) {
  $('file').addEventListener('click', async e => {
    e.preventDefault();
    if (busyUpload()) return;
    if (!$('consent').checked) { $('setupStatus').textContent = 'Tick the permission box before choosing a video.'; $('setupStatus').className = 'status is-error'; return; }
    try {
      const [handle] = await window.showOpenFilePicker({
        id: 'practice-clips', startIn: 'desktop',
        types: [{ description: 'Practice videos', accept: { 'video/*': ['.mp4', '.mov', '.m4v', '.webm'] } }]
      });
      loadVideoFile(await handle.getFile());
    } catch (err) {
      if (err.name === 'AbortError') return;
      $('setupStatus').textContent = 'The file picker could not open (' + err.message + '). Drop the clip on the box instead.';
      $('setupStatus').className = 'status is-error';
    }
  });
}
// Without this, a file dropped outside the drop zone opens in the tab and the review is lost.
for (const type of ['dragover', 'drop']) window.addEventListener(type, e => { if (e.dataTransfer?.types.includes('Files')) e.preventDefault(); });
$('dropzone').addEventListener('dragover', () => $('dropzone').classList.add('is-dragover'));
$('dropzone').addEventListener('dragleave', () => $('dropzone').classList.remove('is-dragover'));
$('dropzone').addEventListener('drop', e => {
  $('dropzone').classList.remove('is-dragover');
  if (!busyUpload()) loadVideoFile(e.dataTransfer.files[0]);
});
// The upload card only ever shows the swimmer's own clip.
function resetUploadCard() {
  $('uploadPreview').pause();
  $('uploadPreview').removeAttribute('src');
  $('uploadPreview').load();
  $('uploadPreview').hidden = true;
  $('file').value = '';
  $('dropzone').classList.remove('has-file');
  $('dropzone').querySelector('b').textContent = 'Choose a video';
  $('startReview').disabled = true;
  $('setupStatus').textContent = '';
  $('setupStatus').className = 'status';
}

// Xavier's demo goes straight into the review and leaves the upload card empty.
function loadVideoFile(file, demo = false) {
  const note = $('setupStatus');
  if (!file) return;
  if (file.type && !file.type.startsWith('video/')) { note.textContent = 'That is not a video file. Choose an MP4 or MOV clip.'; note.className = 'status is-error'; return; }
  if (!demo && !$('consent').checked) { $('file').value = ''; note.textContent = 'Tick the permission box before choosing a video.'; note.className = 'status is-error'; return; }
  if (file.size > 200 * 1024 * 1024) { $('file').value = ''; note.textContent = 'That file is over 200 MB. Trim or re-export the clip.'; note.className = 'status is-error'; return; }

  clearReview();
  $('startReview').disabled = true;
  if (state.url) URL.revokeObjectURL(state.url);
  state.file = file;
  state.demo = demo;
  state.url = URL.createObjectURL(file);
  state.captures = {};
  state.drafts = {};
  state.draft = null;
  state.cpIndex = 0;
  state.waterline = null;
  state.waterMode = false;
  state.samples = null;
  state.autoFrames = {};
  $('waterPill').textContent = 'waterline not set';
  $('waterPill').className = 'pill';
  $('autoFind').disabled = true;
  $('autoscanCard').hidden = false;
  $('scanbar').hidden = true;
  $('scanfill').style.width = '0%';
  video.src = state.url;
  resetUploadCard();
  if (demo) return;
  $('uploadPreview').src = state.url;
  $('dropzone').classList.add('has-file');
  $('dropzone').querySelector('b').textContent = file.name;
  note.textContent = 'Loading the clip…';
};

$('consent').onchange = () => {
  if ($('consent').checked) {
    // Drop the "tick the permission box" (or an earlier clip's) error.
    if ($('setupStatus').classList.contains('is-error')) { $('setupStatus').textContent = ''; $('setupStatus').className = 'status'; }
    return;
  }
  // Permission covers the swimmer's own clip; Xavier's demo stays.
  if (state.demo) return;
  clearReview();
  state.waterline = null;
  video.pause();
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  $('marking').hidden = true;
  $('autoFind').disabled = true;
  if (state.url) URL.revokeObjectURL(state.url);
  state.url = null;
  state.demo = false;
  resetUploadCard();
  video.removeAttribute('src');
  video.load();
  $('setupStatus').textContent = 'Video cleared.';
};

video.onloadedmetadata = () => {
  renderTimeline();
  if (state.demo) return;
  $('startReview').disabled = !state.figure || !!state.figure.uploadOnly;
  $('uploadPreview').hidden = false;
  const note = $('setupStatus');
  note.className = 'status is-ok';
  note.textContent = `Loaded — ${video.duration.toFixed(1)} s, ${video.videoWidth}×${video.videoHeight}.`;
};
video.onerror = () => {
  if (!state.url || state.demo) return;
  const note = $('setupStatus');
  note.className = 'status is-error';
  note.textContent = 'This browser could not decode the clip. Export it as an H.264 MP4 and try again.';
  $('startReview').disabled = true;
  $('uploadPreview').hidden = true;
};
video.ontimeupdate = () => {
  $('clock').textContent = video.currentTime.toFixed(2) + ' s';
  if (video.duration) $('tlProgress').style.width = (video.currentTime / video.duration) * 100 + '%';
};
video.onplay = () => { $('playPause').textContent = 'Pause'; };
video.onpause = () => { $('playPause').textContent = 'Play'; };

$('startReview').onclick = async () => {
  if (!state.figure || state.figure.uploadOnly || !video.videoWidth) return;
  state.cpIndex = 0;
  state.draft = null;
  renderStepper();
  renderCapturePanel();
  show('capture');
  if (state.figure.id === 'f101' && !Object.keys(state.autoFrames).length) await findBalletFrames();
  else if (state.figure.id !== 'f101' && !state.waterline && !Object.keys(state.captures).length) startWaterlineForAuto();
};

/* ----------------------------------------------------------- stage */
$('tlTrack').onclick = e => {
  if (!video.duration || state.busy) return;
  const box = e.currentTarget.getBoundingClientRect();
  video.currentTime = ((e.clientX - box.left) / box.width) * video.duration;
};
document.querySelectorAll('[data-nudge]').forEach(btn => {
  btn.onclick = () => nudge(Number(btn.dataset.nudge));
});
// Scans drive the shared video element; a pause would end a playback scan early.
function togglePlay() {
  if (state.busy) return;
  video.paused ? video.play() : video.pause();
}
$('playPause').onclick = togglePlay;

function nudge(seconds) {
  if (!video.duration || state.busy) return;
  video.pause();
  video.currentTime = Math.max(0, Math.min(video.duration - 0.001, video.currentTime + seconds));
}

document.addEventListener('keydown', e => {
  if ($('screen-capture').classList.contains('is-active') === false) return;
  // Cmd/Ctrl+C must copy, not replace the checkpoint's frame and dots.
  if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey) return;
  if (['INPUT', 'SELECT', 'TEXTAREA'].includes(e.target.tagName)) return;
  // Space still activates a focused button, link, disclosure or the video's own controls.
  if (e.key === ' ' && e.target.closest('button, a, summary, video')) return;
  if (e.key === 'ArrowLeft') { nudge(e.shiftKey ? -0.5 : -0.0334); e.preventDefault(); }
  else if (e.key === 'ArrowRight') { nudge(e.shiftKey ? 0.5 : 0.0334); e.preventDefault(); }
  else if (e.key === ' ') { togglePlay(); e.preventDefault(); }
  else if ((e.key === 'c' || e.key === 'C') && !e.repeat) { captureFrame(); e.preventDefault(); }
});

function renderTimeline() {
  const marks = $('tlMarks');
  marks.replaceChildren();
  if (!video.duration || !state.figure) return;
  state.figure.checkpoints.forEach((cp, i) => {
    const cap = state.drafts[cp.id] || state.captures[cp.id] || state.autoFrames[cp.id];
    if (!cap) return;
    const mark = el('div', 'tl-mark');
    mark.style.left = (cap.time / video.duration) * 100 + '%';
    mark.append(el('b', null, String(i + 1)));
    marks.append(mark);
  });
}

/* ------------------------------------------------------- checkpoints */
function renderStepper() {
  // Once frames exist the auto-find card has done its job: fold it into one status line.
  $('autoscanCard').classList.toggle('is-compact', !state.busy && !state.waterMode
    && (Object.keys(state.autoFrames).length > 0 || Object.keys(state.captures).length > 0));
  const wrap = $('stepper');
  wrap.replaceChildren();
  if (!state.figure) return;
  const scored = scoreFigure(state.figure, state.captures);
  state.figure.checkpoints.forEach((cp, i) => {
    const cap = state.captures[cp.id];
    const pending = !cap && (state.drafts[cp.id] || state.autoFrames[cp.id]);
    const edited = state.drafts[cp.id]?.edited || (i === state.cpIndex && state.draft?.edited);
    const item = el('li');
    const btn = el('button', 'stepdot' + (i === state.cpIndex ? ' is-current' : '') + (cap ? ' is-done' : pending ? ' is-pending' : ''));
    if (cp.art) btn.append(poseArt(cp.art, 'pose-sm'));
    const text = el('span');
    text.append(el('b', null, `${i + 1}. ` + cp.label.split(' · ')[0]),
      el('small', null, edited ? 'unsaved edits' : pending ? `${pending.time.toFixed(2)}s · review` : cp.weight ? `${shareOf(cp.weight)}% of score` : 'reference'));
    btn.append(text);
    if (cap) {
      const r = scored.results.find(x => x.checkpoint.id === cp.id);
      const score = el('em', null, r.score.toFixed(1));
      score.style.color = r.score >= 8 ? 'var(--accent)' : r.score >= 6 ? 'var(--gold)' : 'var(--rose)';
      btn.append(score);
    }
    btn.onclick = () => selectCheckpoint(i);
    item.append(btn);
    wrap.append(item);
  });
  renderThumbs();
  renderTimeline();
}

function renderThumbs() {
  const wrap = $('thumbs');
  wrap.replaceChildren();
  if (!state.figure) return;
  state.figure.checkpoints.forEach((cp, i) => {
    const cap = state.drafts[cp.id] || state.captures[cp.id] || state.autoFrames[cp.id];
    if (!cap) return;
    const btn = el('button', 'thumb');
    const img = el('img');
    img.src = cap.thumb || bitmapThumb(cap);
    img.alt = `${cp.label} at ${cap.time.toFixed(2)} seconds`;
    btn.append(img, el('span', null, `${i + 1} · ${cap.time.toFixed(2)}s`));
    btn.onclick = () => selectCheckpoint(i);
    wrap.append(btn);
  });
}

/* ----------------------------------------------------- capture panel */
function renderCapturePanel() {
  const cp = currentCp();
  if (!cp) return;
  $('guideCue').textContent = state.waterMode ? 'Two dots along the surface. Keep them far apart.' : cp.cue;
  const fig = state.figure;
  $('capFigure').textContent = `FIGURE ${fig.number} · DD ${fig.dd.toFixed(1)}`;
  $('capArt').replaceChildren(cp.art ? poseArt(cp.art, 'pose-lg') : document.createTextNode(''));

  if (state.waterMode) {
    $('capTitle').textContent = fig.name;
    $('capStep').textContent = 'Setup · mark the water surface';
    $('capCue').textContent = 'Click two points along the flat waterline, as far apart as you can. This is reused for every checkpoint.';
    $('markTitle').textContent = 'Waterline';
  } else {
    const conf = state.confidence[cp.id];
    $('capTitle').textContent = fig.name;
    $('capStep').textContent = `Step ${state.cpIndex + 1} of ${fig.checkpoints.length} · ${cp.label}`
      + (conf !== undefined && conf < 0.35 ? '  ·  auto-pick uncertain' : '');
    $('capStep').classList.toggle('is-unsure', conf !== undefined && conf < 0.35);
    $('capCue').textContent = cp.cue;
    $('markTitle').textContent = 'Inspect & fine-tune';
  }
  $('cpWeight').textContent = state.waterMode ? 'set once'
    : cp.weight ? `NV ${cp.weight.toFixed(1)} · ${shareOf(cp.weight)}% of the figure score`
    : 'reference frame';
  $('cpWeight').className = 'pill' + (!state.waterMode && isKeyCheckpoint(cp) ? ' pill-key' : '');

  const cap = state.waterMode ? null : state.captures[cp.id];
  const auto = state.waterMode ? null : state.autoFrames[cp.id];
  const working = state.draft || state.drafts[cp.id] || (cap ? draftFromCapture(cap) : auto ? draftFromCapture(auto) : null);
  state.draft = working;

  const hasFrame = !!working;
  $('marking').hidden = !hasFrame;
  $('canvasEmpty').hidden = hasFrame;
  $('zoomBar').hidden = !hasFrame;
  $('dropCp').hidden = !(cap || state.drafts[cp.id]) || state.waterMode;
  $('aiSuggest').hidden = state.waterMode;
  $('toDiag').hidden = state.waterMode;
  document.querySelector('.coach').hidden = state.waterMode;
  $('autoFlag').hidden = state.waterMode || !working;
  $('autoFlag').textContent = working?.source || 'Manually selected frame · review the landmark positions.';
  $('measurementNote').hidden = fig.id !== 'f101' || state.waterMode;
  document.querySelector('.checkpoint-refine').hidden = state.waterMode || !working;
  $('saveCp').textContent = state.waterMode ? 'Save waterline' : cap ? (working?.edited ? 'Save changes' : 'Update checkpoint') : 'Save checkpoint';

  if (!hasFrame) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    $('live').replaceChildren();
    say('Scrub to the position shown above, then capture it.');
    return;
  }

  canvas.width = working.width;
  canvas.height = working.height;
  document.querySelector('.canvas-wrap').style.aspectRatio = `${working.width} / ${working.height}`;
  resetView();
  if (fig.id === 'f101' && !state.waterMode) requestAnimationFrame(focusSwimmer);
  $('frameTime').textContent = working.time.toFixed(3) + ' s';
  if (!state.activeLm || !activeLandmarks().includes(state.activeLm)) state.activeLm = nextUnset();
  draw();
  renderChips();
  renderChecks();
  renderLive();

  if (!cap && auto) {
    const missing = cp.landmarks.filter(k => !working.points[k] && k !== 'hip');
    say(missing.length
      ? `Frame at ${working.time.toFixed(2)} s. Still to place: ${missing.map(k => LANDMARKS[k].label).join(', ')}.`
      : `Frame at ${working.time.toFixed(2)} s. Check the dots, then save.`);
  }
}

function draftFromCapture(cap) {
  return {
    source: cap.source, points: Object.fromEntries(Object.entries(cap.points).map(([k,p])=>[k,p.slice()])), bitmap: cap.bitmap, time: cap.time,
    width: cap.width, height: cap.height, checks: new Set(cap.checks ?? [])
  };
}

function nextUnset() {
  const keys = activeLandmarks();
  return keys.find(k => !state.draft.points[k]) || keys[0];
}

function renderChips() {
  const wrap = $('lmChips');
  wrap.replaceChildren();
  if (!state.draft) return;
  activeLandmarks().forEach(key => {
    const meta = LANDMARKS[key];
    const set = !!state.draft.points[key];
    const chip = el('button', 'lm-chip' + (set ? ' is-set' : '') + (state.activeLm === key ? ' is-active' : ''));
    chip.style.color = state.activeLm === key ? '' : CHIP_TONE[meta.tone];
    const dot = el('span', 'dotk');
    dot.style.background = TONE[meta.tone];
    chip.append(dot, document.createTextNode(meta.label));
    chip.title = key === 'hip' && state.figure.id === 'f101' ? 'Estimated hip joint. Required for these angles; refine only where you can identify it.' : meta.hint;
    chip.onclick = () => { state.activeLm = key; draw(); renderChips(); say(chip.title); };
    wrap.append(chip);
  });
}

function renderChecks() {
  const wrap = $('checks');
  wrap.replaceChildren();
  const cp = currentCp();
  if (!cp || !state.draft || state.waterMode) return;
  let probe = null;
  try {
    probe = { points: state.draft.points, frame: waterFrame(state.draft.points.waterA, state.draft.points.waterB), scale: referenceScale(state.draft.points) };
  } catch { /* measured items wait for the surface reference */ }
  const frames = measuredCaptures();
  let measured = 0;
  cp.checks.forEach((text, i) => {
    const tests = cp.checkTests?.[i];
    const result = tests && probe ? evaluateCheck(tests, probe, frames) : null;
    if (result) {
      measured++;
      const row = el('div', 'check is-measured ' + (result.pass ? 'is-pass' : 'is-fail'));
      const body = el('span');
      body.append(el('b', null, text));
      result.parts.forEach(p => body.append(el('small', null, `${p.label}: ${p.display} (needs ${p.limit})`)));
      row.append(icon(result.pass ? 'check' : 'alert'), body);
      wrap.append(row);
      return;
    }
    const label = el('label', 'check');
    const box = el('input');
    box.type = 'checkbox';
    box.checked = state.draft.checks.has(i);
    box.onchange = () => {
      box.checked ? state.draft.checks.add(i) : state.draft.checks.delete(i);
      // Ticks are observations, not measurements, so a saved checkpoint stays confirmed.
      const cap = state.captures[cp.id];
      if (cap) { cap.checks = new Set(state.draft.checks); renderStepper(); }
    };
    const body = el('span');
    body.append(document.createTextNode(text));
    body.append(el('small', null, tests
      ? 'Measured from the video once the frames it compares are captured. Tick it if you see it.'
      : `Coach's eye: ${cp.checkNotes?.[i] || 'a side camera cannot show this.'}`));
    label.append(box, body);
    wrap.append(label);
  });
  const coach = cp.checks.length - measured;
  $('checkCount').textContent = [measured && `${measured} measured from the video`, coach && `${coach} for your coach`].filter(Boolean).join(' · ');
}

/* ---------------------------------------------------------- drawing */
function draw() {
  const d = state.draft;
  if (!d) return;
  ctx.putImageData(d.bitmap, 0, 0);
  const scale = Math.max(1, canvas.width / 960);

  ctx.lineWidth = 2.5 * scale;
  ctx.lineCap = 'round';
  for (const [a, b, skipIf] of SKELETON) {
    if (!d.points[a] || !d.points[b] || (skipIf && d.points[skipIf])) continue;
    ctx.strokeStyle = a === 'waterA' ? 'rgba(255,207,107,.85)' : 'rgba(136,196,255,.85)';
    if (a === 'waterA') ctx.setLineDash([10 * scale, 8 * scale]); else ctx.setLineDash([]);
    ctx.beginPath();
    ctx.moveTo(...d.points[a]);
    ctx.lineTo(...d.points[b]);
    ctx.stroke();
  }
  ctx.setLineDash([]);

  for (const key of Object.keys(d.points)) {
    const p = d.points[key];
    if (!p) continue;
    const tone = TONE[LANDMARKS[key].tone];
    ctx.beginPath();
    ctx.arc(p[0], p[1], 6 * scale, 0, Math.PI * 2);
    ctx.fillStyle = tone;
    ctx.fill();
    ctx.lineWidth = 2 * scale;
    ctx.strokeStyle = 'rgba(4,18,29,.85)';
    ctx.stroke();
    if (key === state.activeLm) {
      ctx.beginPath();
      ctx.arc(p[0], p[1], 12 * scale, 0, Math.PI * 2);
      ctx.strokeStyle = tone;
      ctx.lineWidth = 1.5 * scale;
      ctx.stroke();
    }
    if (ripple?.key === key) {
      const u = Math.min(1, (performance.now() - ripple.start) / 450);
      ctx.beginPath();
      ctx.arc(p[0], p[1], (8 + 22 * (1 - Math.pow(1 - u, 3))) * scale, 0, Math.PI * 2);
      ctx.strokeStyle = tone;
      ctx.globalAlpha = 1 - u;
      ctx.lineWidth = 2 * scale;
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
  }
  if (state.figure.id === 'f101' && !state.waterMode) drawBalletMeasures(d, scale);
}

/* ------------------------------------------------------- zoom & pan */
const view = { zoom: 1, x: 0, y: 0 };
const wrapEl = () => $('canvasWrap');

function applyView() {
  const wrap = wrapEl();
  const w = wrap.clientWidth;
  const h = wrap.clientHeight;
  view.x = Math.min(0, Math.max(w - w * view.zoom, view.x));
  view.y = Math.min(0, Math.max(h - h * view.zoom, view.y));
  canvas.style.transform = `translate(${view.x}px, ${view.y}px) scale(${view.zoom})`;
  $('zoomLevel').textContent = Math.round(view.zoom * 100) + '%';
  wrap.classList.toggle('is-zoomed', view.zoom > 1);
}

/** Zoom towards a client point so the pixel under the cursor stays put. */
function setZoom(next, clientX, clientY) {
  const rect = wrapEl().getBoundingClientRect();
  const px = clientX == null ? rect.width / 2 : clientX - rect.left;
  const py = clientY == null ? rect.height / 2 : clientY - rect.top;
  const z = Math.min(8, Math.max(1, next));
  view.x = px - (px - view.x) * (z / view.zoom);
  view.y = py - (py - view.y) * (z / view.zoom);
  view.zoom = z;
  applyView();
}

function resetView() {
  view.zoom = 1;
  view.x = 0;
  view.y = 0;
  applyView();
}

$('zoomIn').onclick = () => setZoom(view.zoom * 1.4);
$('zoomOut').onclick = () => setZoom(view.zoom / 1.4);
$('zoomReset').onclick = resetView;

// Plain wheel scrolls the page; pinch (sent as ctrl+wheel) or Ctrl/⌘ + wheel zooms.
wrapEl().addEventListener('wheel', e => {
  if (!state.draft || !(e.ctrlKey || e.metaKey)) return;
  e.preventDefault();
  setZoom(view.zoom * Math.exp(-Math.max(-60, Math.min(60, e.deltaY)) * 0.003), e.clientX, e.clientY);
}, { passive: false });

const canvasPoint = e => {
  const r=canvas.getBoundingClientRect();
  return [Math.max(0,Math.min(canvas.width,(e.clientX-r.left)/r.width*canvas.width)),Math.max(0,Math.min(canvas.height,(e.clientY-r.top)/r.height*canvas.height))];
};
let drag = null;
canvas.addEventListener('pointerdown', e => {
  if (!state.draft || state.busy || e.button !== 0) return;
  const p=canvasPoint(e), radius=14*canvas.width/canvas.getBoundingClientRect().width;
  const key=activeLandmarks().filter(k=>state.draft.points[k]).sort((a,b)=>Math.hypot(...state.draft.points[a].map((v,i)=>v-p[i]))-Math.hypot(...state.draft.points[b].map((v,i)=>v-p[i]))).find(k=>Math.hypot(...state.draft.points[k].map((v,i)=>v-p[i]))<radius);
  drag={x:e.clientX,y:e.clientY,vx:view.x,vy:view.y,key,moved:false};
  if(key) {state.activeLm=key;draw();renderChips();}
  canvas.setPointerCapture(e.pointerId);
});
canvas.addEventListener('pointermove', e => {
  if(!drag)return;
  const dx=e.clientX-drag.x,dy=e.clientY-drag.y;
  if(Math.hypot(dx,dy)>3)drag.moved=true;
  if(!drag.moved)return;
  if(drag.key) {state.draft.points[drag.key]=canvasPoint(e);invalidateCheckpoint();draw();renderLive();}
  else {view.x=drag.vx+dx;view.y=drag.vy+dy;applyView();}
});
canvas.addEventListener('pointerup', e => {
  if(!drag)return;
  const old=drag;drag=null;
  if(!old.moved && !old.key)placePoint(...canvasPoint(e));
  if(old.key) {renderStepper();say('Point moved. The live readings here update now; Results change only when you save.');}
});
canvas.addEventListener('pointercancel',()=>{drag=null;});
canvas.tabIndex=0;
canvas.addEventListener('keydown',e=>{
  if(!state.draft || !['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key))return;
  const p=state.draft.points[state.activeLm];if(!p)return;
  e.stopPropagation();e.preventDefault();const step=e.shiftKey?5:1;
  placePoint(p[0]+(e.key==='ArrowRight'?step:e.key==='ArrowLeft'?-step:0),p[1]+(e.key==='ArrowDown'?step:e.key==='ArrowUp'?-step:0),true);
});

let ripple = null;
function rippleAt(key) {
  if (reducedMotion.matches) return;
  ripple = { key, start: performance.now() };
  const tick = now => { if (!ripple || ripple.key !== key) return; draw(); if (now - ripple.start < 450) requestAnimationFrame(tick); else { ripple = null; draw(); } };
  requestAnimationFrame(tick);
}
function placePoint(x, y, keepActive = false) {
  const key = state.activeLm || nextUnset();
  if (!keepActive) rippleAt(key);
  state.draft.points[key] = [Math.max(0,Math.min(canvas.width,x)), Math.max(0,Math.min(canvas.height,y))];
  invalidateCheckpoint();
  const remaining = activeLandmarks().filter(k => !state.draft.points[k]);
  state.activeLm = keepActive ? key : remaining[0] || key;
  draw();
  renderChips();
  renderLive();
  say(remaining.length
    ? `Next: ${LANDMARKS[state.activeLm].label} — ${LANDMARKS[state.activeLm].hint}`
    : state.waterMode ? 'Waterline ready. Save it to unlock auto-find.' : 'All landmarks placed. Check the coach\'s-eye list, then save: Results use these marks only after you save.', remaining.length ? '' : 'ok');
}

$('resetPts').onclick = () => {
  if (!state.draft) return;
  state.draft.points = state.waterMode || !state.waterline ? {} : { waterA: state.waterline[0].slice(), waterB: state.waterline[1].slice() };
  invalidateCheckpoint();
  state.activeLm = nextUnset();
  draw();
  renderChips();
  renderLive();
  say('Marks cleared. Start with ' + LANDMARKS[state.activeLm].label + '.');
};

/* --------------------------------------------------------- capturing */
function captureFrame() {
  if (!video.videoWidth || state.busy) return false;
  if (video.seeking) { say('Wait for the new frame to finish loading, then capture it.'); return false; }
  video.pause();
  const width = Math.min(video.videoWidth, 1280);
  const height = Math.round((width * video.videoHeight) / video.videoWidth);
  canvas.width = width;
  canvas.height = height;
  ctx.drawImage(video, 0, 0, width, height);
  const points = state.waterline && !state.waterMode
    ? { waterA: state.waterline[0].slice(), waterB: state.waterline[1].slice() }
    : {};
  state.draft = {
    points, bitmap: ctx.getImageData(0, 0, width, height),
    time: video.currentTime, width, height, checks: new Set()
  };
  if (!state.waterMode) invalidateCheckpoint();
  state.activeLm = nextUnset();
  renderCapturePanel();
  say(`Frame captured at ${video.currentTime.toFixed(2)} s. Click the image to place ${LANDMARKS[state.activeLm].label}.`, 'ok');
  return true;
}
$('capture').onclick = captureFrame;

// Re-pick: take the frame the user has scrubbed to and pre-fill it like auto-find would.
$('useFrame').onclick = () => {
  if (state.busy || state.waterMode || !captureFrame()) return;
  invalidateCheckpoint();
  if(state.draft) state.draft.source='Frame changed · place joints again for this frame.';
  renderStepper();
};

function makeThumb() {
  const t = document.createElement('canvas');
  t.width = 160;
  t.height = Math.round((160 * canvas.height) / canvas.width);
  t.getContext('2d').drawImage(canvas, 0, 0, t.width, t.height);
  return t.toDataURL('image/jpeg', 0.6);
}

$('saveCp').onclick = () => {
  const cp = currentCp();
  const d = state.draft;
  if (!d || state.busy) return;

  if (state.waterMode) {
    if (!d.points.waterA || !d.points.waterB) { say('Place both waterline points first.', 'error'); return; }
    try { waterFrame(d.points.waterA, d.points.waterB); } catch (err) { say(err.message, 'error'); return; }
    state.waterline = [d.points.waterA.slice(), d.points.waterB.slice()];
    state.waterMode = false;
    state.draft = null;
    $('waterPill').textContent = 'waterline set';
    $('waterPill').className = 'pill pill-good';
    $('autoFind').disabled = false;
    scanSay('Waterline saved. Run auto-find, or capture the checkpoints yourself.', 'ok');
    renderCapturePanel();
    if (state.autoAfterWaterline) {
      state.autoAfterWaterline = false;
      scanSay('Waterline saved. Finding your checkpoints automatically…', 'ok');
      $('autoFind').onclick();
    }
    return;
  }

  const missing = cp.landmarks.filter(k => !d.points[k] && (k !== 'hip' || state.figure.id === 'f101'));
  if (state.figure.id === 'f101') {
    const i=state.cpIndex, prev=state.figure.checkpoints[i-1], next=state.figure.checkpoints[i+1];
    const before=prev && (state.captures[prev.id] || state.autoFrames[prev.id]);
    const after=next && (state.captures[next.id] || state.autoFrames[next.id]);
    if ((before && d.time<=before.time) || (after && d.time>=after.time)) { say('Keep checkpoint frames in sequence. Choose a time between its neighboring checkpoints.', 'error'); return; }
  }
  if (missing.length) { say(`Still to mark: ${missing.map(k => LANDMARKS[k].label).join(', ')}.`, 'error'); return; }

  let frame, scale;
  try {
    frame = waterFrame(d.points.waterA, d.points.waterB);
    scale = referenceScale(d.points);
    if (!scale && cp.metrics.some(m => SCALED_KINDS.has(m.kind))) {
      throw new Error('This checkpoint measures a distance, so mark at least two body landmarks for reference.');
    }
  } catch (err) { say(err.message, 'error'); return; }

  state.captures[cp.id] = {
    points: { ...d.points }, bitmap: d.bitmap, frame, scale,
    time: d.time, checks: new Set(d.checks), thumb: makeThumb(),
    width: d.width, height: d.height, auto: false, source: d.source
  };
  delete state.drafts[cp.id];
  if (state.draft) state.draft.edited = false;
  renderStepper();

  const next = state.figure.checkpoints.findIndex((c, i) => i > state.cpIndex && !state.captures[c.id]);
  if (next >= 0) {
    state.draft = null;
    selectCheckpoint(next);
    say('Saved. Now find: ' + currentCp().label, 'ok');
    // Saving from below the fold would otherwise switch checkpoints out of sight.
    if ($('stepper').getBoundingClientRect().top < 0) $('stepper').scrollIntoView({ block: 'start' });
  } else {
    renderDiagnostics();
    show('diag');
  }
};

$('dropCp').onclick = () => {
  delete state.captures[currentCp().id];
  delete state.drafts[currentCp().id];
  delete state.autoFrames[currentCp().id];
  state.draft = null;
  renderStepper();
  renderCapturePanel();
  say('Checkpoint removed.');
};

/* ------------------------------------------------------ live metrics */
function renderLive() {
  renderChecks();
  const wrap = $('live');
  wrap.replaceChildren();
  const cp = currentCp();
  if (!cp || !state.draft || state.waterMode) return;
  let frame, scale;
  try {
    frame = waterFrame(state.draft.points.waterA, state.draft.points.waterB);
    scale = referenceScale(state.draft.points);
  } catch { return; }
  const probe = { points: state.draft.points, frame, scale, time: state.draft.time };

  for (const spec of cp.metrics) {
    const card = el('div', 'mcard');
    card.append(el('span', null, spec.label));
    try {
      const out = evaluateMetric(spec, probe, state.captures);
      card.append(el('strong', null, out.chartScore != null ? out.chartScore.toFixed(1) + ' / 10' : out.display));
      if (out.chartScore != null) {
        card.classList.add('band-' + (out.chartScore >= 8 ? 'clean' : out.chartScore >= 6 ? 'small' : out.chartScore >= 4.5 ? 'medium' : 'large'));
        card.append(el('small', null, out.band + ' · measured ' + out.display));
      } else {
        const ded = deductionFor(out.deviation, spec.tol);
        card.classList.add('band-' + ded.band);
        if (spec.unit === '°') card.append(deviationDial(out.deviation, spec.tol));
        if (state.figure.id === 'f101') card.append(el('small', null, `Target ${spec.ideal}° · difference ${out.deviation.toFixed(1)}°`));
        else card.append(el('small', null, `${ded.label}${ded.value ? ' · −' + ded.value.toFixed(1) : ''}${spec.note ? ' · ' + spec.note : ''}`));
      }
    } catch (err) {
      card.classList.add('band-error');
      card.append(el('strong', null, '—'), el('small', null, err.message));
    }
    wrap.append(card);
  }
}

/* --------------------------------------------------------------- AI */
const TASKS_VERSION = '0.10.35';
const CDNS = ['https://cdn.jsdelivr.net/npm', 'https://unpkg.com'];
const MODEL_URL = 'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task';

/** Try each CDN in turn so one blocked or missing host does not kill the feature. */
async function loadTasksVision() {
  let lastError;
  for (const cdn of CDNS) {
    const base = `${cdn}/@mediapipe/tasks-vision@${TASKS_VERSION}`;
    try {
      const lib = await import(/* @vite-ignore */ `${base}/vision_bundle.mjs`);
      const fileset = await lib.FilesetResolver.forVisionTasks(`${base}/wasm`);
      return { lib, fileset };
    } catch (err) { lastError = err; }
  }
  throw new Error('Could not download the pose model library. ' + (lastError?.message ?? ''));
}

async function getModel(mode) {
  if (state.models[mode]) return state.models[mode];
  const { lib, fileset } = state.tasks ?? (state.tasks = await loadTasksVision());
  state.models[mode] = await lib.PoseLandmarker.createFromOptions(fileset, {
    baseOptions: { modelAssetPath: MODEL_URL },
    runningMode: mode, numPoses: 1, minPoseDetectionConfidence: 0.5, minPosePresenceConfidence: 0.5
  });
  return state.models[mode];
}

/** Copy the landmarks a checkpoint needs out of a detected pose, in canvas pixels. */
function placeFromPose(lm, cp, points, w, h, minVisibility = 0.7) {
  const vis = ids => ids.reduce((s, i) => s + (lm[i]?.visibility || 0), 0);
  let primaryLeft = vis([11, 23, 25, 27]) >= vis([12, 24, 26, 28]);
  // With two legs to tell apart, the working leg is the raised one, not the more visible one.
  const thighTilt = (hipId, kneeId) => {
    const a = lm[hipId], b = lm[kneeId];
    if ((a?.visibility ?? 0) < minVisibility || (b?.visibility ?? 0) < minVisibility) return null;
    try { return segmentToWater([a.x * w, a.y * h], [b.x * w, b.y * h], waterFrame(points.waterA, points.waterB)); } catch { return null; }
  };
  if (cp.landmarks.some(k => k.endsWith('B')) && points.waterA && points.waterB) {
    const left = thighTilt(23, 25), right = thighTilt(24, 26);
    if (left != null && right != null && Math.abs(left - right) > 15) primaryLeft = left > right;
  }
  let placed = 0;
  for (const key of cp.landmarks) {
    const ids = POSE_IDS[key] || (key.endsWith('B') ? POSE_IDS[key.slice(0, -1)] : null);
    if (!ids || points[key]) continue;
    const useLeft = key.endsWith('B') ? !primaryLeft : primaryLeft;
    const p = lm[useLeft ? ids[0] : ids[1]];
    if (p && (p.visibility ?? 0) >= minVisibility && p.x >= 0 && p.x <= 1 && p.y >= 0 && p.y <= 1) {
      points[key] = [p.x * w, p.y * h];
      placed++;
    }
  }
  return placed;
}

$('aiSuggest').onclick = async () => {
  if (!state.draft || state.busy) return;
  const cp = currentCp();
  const suggestible = k => POSE_IDS[k] || (k.endsWith('B') && POSE_IDS[k.slice(0, -1)]);
  if (!cp.landmarks.some(k => suggestible(k) && !state.draft.points[k])) {
    say('Every landmark the hint can suggest is already placed. Clear marks first for fresh suggestions.');
    return;
  }
  state.busy = true;
  $('aiSuggest').disabled = true;
  say('Loading the pose model on this device. The first run can take a moment…');
  try {
    const model = await getModel('IMAGE');
    if (!state.draft) return;
    ctx.putImageData(state.draft.bitmap, 0, 0);
    const lm = model.detect(canvas).landmarks?.[0];
    if (!lm) { draw(); say('No reliable pose was found. Mark the points by hand — nothing was invented.', 'error'); return; }
    const placed = placeFromPose(lm, cp, state.draft.points, canvas.width, canvas.height);
    if(placed) invalidateCheckpoint();
    state.activeLm = nextUnset();
    draw();
    renderChips();
    renderLive();
    say(`${placed} landmark${placed === 1 ? '' : 's'} suggested. Check every dot yourself and remove anything under water.`, placed ? 'ok' : 'error');
  } catch {
    draw();
    say('The pose model could not load in this browser. Manual marking still works exactly the same.', 'error');
  } finally {
    state.busy = false;
    $('aiSuggest').disabled = false;
  }
};

/* ------------------------------------------------- waterline & scan */
const scanSay = (text, tone = '') => {
  const s = $('scanStatus');
  s.textContent = text;
  s.className = 'status' + (tone ? ' is-' + tone : '');
};

$('setWaterline').onclick = () => {
  if(state.busy)return;
  rememberDraft();
  if (!video.videoWidth) { scanSay('Load a clip first.', 'error'); return; }
  state.waterMode = true;
  state.draft = null;
  captureFrame();
  say('Click two points along the flat water surface, well apart. The camera does not move, so you only do this once.');
};

$('skipAuto').onclick = () => {
  $('autoscanCard').hidden = true;
  say('Manual mode. Scrub to each checkpoint and capture it yourself.');
};

$('autoFind').onclick = async () => {
  if (state.figure.id === 'f101') { await findBalletFrames(); return; }
  if (!state.waterline || state.busy) return;
  state.busy = true;
  $('autoFind').disabled = true;
  $('scanbar').hidden = false;
  $('autoscanCard').classList.remove('is-compact');
  scanSay('Loading the pose model…');
  try {
    const model = await getModel('VIDEO').catch(() => null);
    scanSay('Playing the clip and measuring the swimmer against the surface…');
    const samples = await scanVideo(video, model, {
      onProgress: p => { $('scanfill').style.width = Math.round(p * 100) + '%'; }
    });
    $('scanfill').style.width = '100%';

    const scanW = 320;
    const scanH = Math.max(1, Math.round((scanW * video.videoHeight) / video.videoWidth));
    addFeatures(samples, normalisedWaterline(), scanW, scanH);
    state.samples = samples;

    const picks = pickCheckpoints(state.figure, samples);
    if (!picks) { scanSay('The scan could not separate the positions in this clip. Capture the checkpoints manually.', 'error'); return; }

    state.autoFrames = {};
    state.confidence = picks.confidence || {};
    let saved = 0, partial = 0, unsure = 0, kept = 0;
    for (const cp of state.figure.checkpoints) {
      const time = picks.times[cp.id];
      if (time === undefined) continue;
      const own = state.captures[cp.id];
      if ((own && !own.auto) || state.drafts[cp.id]) { kept++; continue; }
      const result = await autoCapture(cp, time);
      if (result === 'saved') saved++;
      else if (result === 'partial') partial++;
      if ((state.confidence[cp.id] ?? 0) < 0.35) unsure++;
    }
    state.cpIndex = 0;
    state.draft = null;
    renderStepper();
    renderCapturePanel();
    renderDiagnostics();
    scanSay([
      `${saved} checkpoint${saved === 1 ? '' : 's'} placed`,
      partial ? `${partial} still need a few dots` : '',
      kept ? `${kept} kept as you left ${kept === 1 ? 'it' : 'them'}` : '',
      unsure ? `${unsure} look uncertain — check those first` : ''
    ].filter(Boolean).join(' · ') + '. Every frame is ready below; re-pick anything that looks wrong.', saved ? 'ok' : 'error');
  } catch (err) {
    scanSay('Auto-find failed: ' + err.message + ' You can still capture manually.', 'error');
  } finally {
    state.busy = false;
    $('autoFind').disabled = false;
    renderStepper();
  }
};

/** Waterline as 0..1 image fractions, which is what the scanner works in. */
function normalisedWaterline() {
  const width = Math.min(video.videoWidth, 1280);
  const height = Math.round((width * video.videoHeight) / video.videoWidth);
  return state.waterline.map(([x, y]) => [x / width, y / height]);
}

// A seek to the current position fires no `seeked` event, which would stall the loop.
const seekTo = time => new Promise((resolve,reject) => {
  if (Math.abs(video.currentTime-time)<1e-4 && !video.seeking && video.readyState>=2) {resolve();return;}
  const timer=setTimeout(()=>finish(new Error('The requested video frame could not be decoded.')),5000);
  function finish(error) {clearTimeout(timer);video.removeEventListener('seeked',done);video.removeEventListener('error',failed);error?reject(error):resolve();}
  const done=()=>finish();const failed=()=>finish(new Error('Video decoding failed.'));
  video.addEventListener('seeked',done,{once:true});video.addEventListener('error',failed,{once:true});video.currentTime=time;
});

/**
 * Grab a frame at `time` and pre-fill it with the scan's landmarks plus the waterline.
 * The frame is always kept: underwater joints often cannot be placed automatically, and
 * a frame with a few missing dots is still far more useful than no frame at all.
 */
async function autoCapture(cp, time) {
  await seekTo(time);
  const width = Math.min(video.videoWidth, 1280);
  const height = Math.round((width * video.videoHeight) / video.videoWidth);
  canvas.width = width;
  canvas.height = height;
  ctx.drawImage(video, 0, 0, width, height);

  const points = { waterA: state.waterline[0].slice(), waterB: state.waterline[1].slice() };
  const sample = sampleAt(state.samples, time);
  if (sample?.lm) placeFromPose(sample.lm, cp, points, width, height, 0.45);

  const bitmap = ctx.getImageData(0, 0, width, height);
  state.autoFrames[cp.id] = { points, bitmap, time, width, height };

  const missing = cp.landmarks.filter(k => !points[k] && k !== 'hip');
  if (missing.length) return 'partial';

  let frame, scale;
  try {
    frame = waterFrame(points.waterA, points.waterB);
    scale = referenceScale(points);
    if (!scale && cp.metrics.some(m => SCALED_KINDS.has(m.kind))) return 'partial';
  } catch { return 'partial'; }

  const thumbCanvas = document.createElement('canvas');
  thumbCanvas.width = 160;
  thumbCanvas.height = Math.round((160 * height) / width);
  thumbCanvas.getContext('2d').drawImage(canvas, 0, 0, thumbCanvas.width, thumbCanvas.height);

  state.captures[cp.id] = {
    points, bitmap, frame, scale, time,
    checks: new Set(), thumb: thumbCanvas.toDataURL('image/jpeg', 0.6),
    width, height, auto: true
  };
  return 'saved';
}

/* ------------------------------------------------------- diagnostics */
function renderDiagnostics() {
  const fig = state.figure;
  const board = $('scoreboard');
  const list = $('diagnostics');
  const plan = $('plan');
  board.replaceChildren();
  list.replaceChildren();
  plan.replaceChildren();
  if (!fig) return;

  rememberDraft();
  // Everything found in the video is measured; unsaved frames count as unconfirmed suggestions.
  const captures = measuredCaptures();
  const s = scoreFigure(fig, captures);
  board.dataset.complete = String(s.complete);
  const unconfirmed = s.results.filter(r => r.captured && r.auto).length;

  const hero = el('div', 'score-hero');
  hero.style.setProperty('--glow', fig.accent);
  hero.append(el('p', 'eyebrow', `FIGURE ${fig.number} · ${fig.name}`));
  hero.append(el('div', 'big', s.awarded != null ? s.awarded.toFixed(2) : '—'));
  if (s.provisional) hero.append(el('span', 'pill pill-warn score-flag', 'Provisional'));
  hero.append(el('p', 'big-sub', s.complete
    ? `Practice score ${s.practiceScore.toFixed(2)} × DD ${fig.dd.toFixed(1)}. An uncalibrated estimate from one camera angle.`
    : s.provisional
      ? `Practice score ${s.practiceScore.toFixed(2)} × DD ${fig.dd.toFixed(1)}, measured from the frames found in your video. ${unconfirmed} checkpoint${unconfirmed === 1 ? ' is an unconfirmed suggestion' : 's are unconfirmed suggestions'}: check and save ${unconfirmed === 1 ? 'it' : 'them'} on the Review step to confirm the score.`
      : `${Math.round(s.coverage * 100)}% of the scored positions were found. Capture the missing checkpoints on the Review step for a total.`));
  board.append(hero);

  const stats = el('div', 'score-stats');
  const addStat = (label, value) => {
    const row = el('div', 'stat');
    row.append(el('span', null, label), el('b', null, value));
    stats.append(row);
  };
  addStat('Practice score / 10', s.practiceScore != null ? s.practiceScore.toFixed(2) : '—');
  addStat('Degree of difficulty', fig.dd.toFixed(1));
  addStat('Travel deduction', s.travel.value ? '−' + s.travel.value.toFixed(1) : 'none');
  if (s.tempo) addStat(fig.tempo.label, `${s.tempo.display} · −${s.tempo.deduction.value.toFixed(1)}`);
  else if (fig.tempo) addStat(fig.tempo.label, 'needs all checkpoints');
  board.append(stats);

  renderDiagSequence(fig, s);
  s.results.forEach((r, i) => list.append(comparisonCard(fig, r, i, captures[r.checkpoint.id])));
  list.append(wholeFigureCard(fig, s));

  renderPlan(plan, fig, s);
}

/* ------------------------------------------------- required vs. video */
const BAND_TEXT = { clean: 'Meets the requirement', small: 'Small deviation', medium: 'Medium deviation', large: 'Large deviation' };

function targetText(spec) {
  switch (spec.kind) {
    case 'segmentToVertical': return '0° from vertical';
    case 'segmentToWater': return '0°, level with the surface';
    case 'jointAngle': return spec.ideal === 180 ? '180°, fully straight' : spec.ideal === 90 ? '90°, a right angle' : `${spec.ideal}°`;
    case 'heightChange': return 'No drop';
    case 'travelAlongWater': return 'No travel';
    case 'splitAngle': return '180° split';
    case 'splitEvenness': return 'Both legs level';
    case 'heightChart': return 'Water at the top of the pelvis';
    default: return spec.ideal != null ? `${spec.ideal}${spec.unit}` : '—';
  }
}

/** One checkpoint: the frame with the requirement drawn over it, beside a required-vs-video table. */
function comparisonCard(fig, r, index, cap) {
  const cp = r.checkpoint;
  const card = el('article', 'cmp-card');
  const head = el('header', 'cmp-head');
  const title = el('div', 'cmp-title');
  title.append(el('span', 'cmp-num', String(index + 1)), el('h3', null, cp.label));
  head.append(title);
  const meta = el('div', 'cmp-meta');
  meta.append(el('span', null, cp.weight ? `${shareOf(cp.weight)}% of score` : 'Reference, not scored'));
  if (r.captured) {
    const score = el('b', 'cmp-score', r.score.toFixed(1));
    score.style.color = r.score >= 8 ? 'var(--accent)' : r.score >= 6 ? 'var(--gold)' : 'var(--rose)';
    meta.append(score);
    meta.append(el('span', 'pill ' + (r.auto ? 'pill-warn' : 'pill-good'), r.auto ? 'Unconfirmed suggestion' : 'Confirmed'));
  }
  head.append(meta);
  card.append(head);

  if (!r.captured) {
    card.classList.add('is-missing');
    const empty = el('div', 'cmp-empty');
    empty.append(el('p', null, `Not found in the video yet. ${cp.cue}`));
    const go = el('button', 'btn btn-ghost', 'Find this checkpoint');
    go.type = 'button';
    go.onclick = () => { selectCheckpoint(index); show('capture'); };
    empty.append(go);
    card.append(empty);
    return card;
  }

  const body = el('div', 'cmp-body');
  if (cap?.bitmap) {
    const figureEl = el('figure', 'cmp-figure');
    const canvasEl = el('canvas');
    canvasEl.setAttribute('role', 'img');
    canvasEl.setAttribute('aria-label', `${cp.label}: your position with the required lines drawn over it`);
    figureEl.append(canvasEl);
    const legend = el('figcaption', 'cmp-legend');
    legend.innerHTML = '<span><i class="lg-yours"></i>Your position</span><span><i class="lg-req"></i>Required</span><span><i class="lg-dev"></i>Deviation</span>';
    figureEl.append(legend);
    body.append(figureEl);
    requestAnimationFrame(() => drawComparison(canvasEl, cap, cp, r));
  }

  const table = el('table', 'cmp-table');
  const thead = el('thead');
  const hr = el('tr');
  ['Requirement', 'Required', 'In your video', 'Result'].forEach(h => hr.append(el('th', null, h)));
  thead.append(hr);
  const tbody = el('tbody');
  const row = (what, required, yours, cls, result, iconName) => {
    const tr = el('tr', 'is-' + cls);
    tr.append(el('th', null, what), el('td', null, required), el('td', 'cmp-yours', yours));
    const res = el('td', 'cmp-result');
    const inner = el('div');
    inner.append(icon(iconName), el('span', null, result));
    res.append(inner);
    tr.append(res);
    tbody.append(tr);
  };
  const scored = cp.weight > 0;
  for (const m of r.metrics) {
    if (m.error) { row(m.spec.label, targetText(m.spec), '—', 'missing', 'Not measurable: ' + m.error, 'eye'); continue; }
    if (m.chartScore != null) {
      row(m.spec.label, targetText(m.spec), m.display, m.chartScore >= 8 ? 'good' : 'dev', `${m.chartScore.toFixed(1)} / 10 · ${m.band}`, m.chartScore >= 8 ? 'check' : 'alert');
      continue;
    }
    const good = m.deduction.band === 'clean';
    const off = m.spec.unit === '°' && m.deviation >= .05 && Math.abs(m.value - m.deviation) > .05 ? ` · ${m.deviation.toFixed(1)}° off` : '';
    row(m.spec.label, targetText(m.spec), m.display + off, good ? 'good' : 'dev-' + m.deduction.band,
      good ? BAND_TEXT.clean : BAND_TEXT[m.deduction.band] + (scored ? ` · −${m.deduction.value.toFixed(1)}` : ' · not scored'), good ? 'check' : 'alert');
  }
  r.checkResults.forEach((c, i) => {
    if (c.measured) {
      row(c.text, c.parts.map(p => `${p.label} ${p.limit}`).join(' · '), c.parts.map(p => p.display).join(' · '),
        c.pass ? 'good' : 'dev-small', c.pass ? BAND_TEXT.clean : 'Not met' + (scored ? ' · −0.2' : ' · not scored'), c.pass ? 'check' : 'alert');
    } else {
      row(c.text, 'Coach checks', c.visible ? (cp.checkNotes?.[i] || 'Not visible from a side camera.') : 'Needs the earlier checkpoint to measure.',
        c.pass ? 'good' : 'coach', c.pass ? 'Confirmed by you' : 'Ask your coach' + (scored ? ' · −0.2 until confirmed' : ''), c.pass ? 'check' : 'eye');
    }
  });
  table.append(thead, tbody);
  const wrap = el('div', 'cmp-table-wrap');
  wrap.append(table);
  body.append(wrap);
  card.append(body);
  return card;
}

function wholeFigureCard(fig, s) {
  const card = el('article', 'cmp-card cmp-whole');
  const head = el('header', 'cmp-head');
  const title = el('div', 'cmp-title');
  title.append(el('h3', null, 'Whole figure'));
  head.append(title);
  card.append(head);
  const table = el('table', 'cmp-table');
  const tbody = el('tbody');
  const add = (what, required, yours, good, result) => {
    const tr = el('tr', good ? 'is-good' : 'is-dev-medium');
    const res = el('td', 'cmp-result');
    const inner = el('div');
    inner.append(icon(good ? 'check' : 'alert'), el('span', null, result));
    res.append(inner);
    tr.append(el('th', null, what), el('td', null, required), el('td', 'cmp-yours', yours), res);
    tbody.append(tr);
  };
  add('Travel', 'Stay in place', s.travel.value ? `−${s.travel.value.toFixed(1)}` : 'None measured', !s.travel.value, s.travel.label);
  if (s.tempo) add(fig.tempo.label, 'Even tempo', s.tempo.display, !s.tempo.deduction.value, s.tempo.deduction.value ? `${s.tempo.deduction.label} · −${s.tempo.deduction.value.toFixed(1)}` : BAND_TEXT.clean);
  table.append(tbody);
  card.append(table);
  return card;
}

/** Draw the frame around the swimmer, the body as measured, and each requirement as a dashed guide. */
function drawComparison(canvasEl, cap, cp, r) {
  const body = Object.entries(cap.points).filter(([k, p]) => p && !k.startsWith('water'));
  if (!body.length) return;
  const xs = body.map(([, p]) => p[0]), ys = body.map(([, p]) => p[1]);
  let x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
  const pad = Math.max(60, (x1 - x0) * .35);
  x0 -= pad; x1 += pad; y0 -= pad * .8; y1 += pad * .8;
  const aspect = 16 / 10;
  if ((x1 - x0) / (y1 - y0) < aspect) { const w = (y1 - y0) * aspect, cx = (x0 + x1) / 2; x0 = cx - w / 2; x1 = cx + w / 2; }
  else { const h = (x1 - x0) / aspect, cy = (y0 + y1) / 2; y0 = cy - h / 2; y1 = cy + h / 2; }
  const sw = Math.min(cap.width, x1 - x0), sh = Math.min(cap.height, y1 - y0);
  x0 = Math.max(0, Math.min(cap.width - sw, x0)); y0 = Math.max(0, Math.min(cap.height - sh, y0));
  const cssW = canvasEl.clientWidth || 520, dpr = Math.min(2, devicePixelRatio || 1);
  canvasEl.width = Math.round(cssW * dpr); canvasEl.height = Math.round(cssW / aspect * dpr);
  const W = canvasEl.width, H = canvasEl.height, k = W / sw, f = W / 520;
  const g = canvasEl.getContext('2d');
  const src = document.createElement('canvas');
  src.width = cap.width; src.height = cap.height;
  src.getContext('2d').putImageData(cap.bitmap, 0, 0);
  g.drawImage(src, x0, y0, sw, sh, 0, 0, W, H);
  g.fillStyle = 'rgba(1, 16, 34, .28)'; g.fillRect(0, 0, W, H);
  const P = key => cap.points[key] && [(cap.points[key][0] - x0) * k, (cap.points[key][1] - y0) * k];
  const { u, n } = cap.frame;
  const colour = { clean: '#7CC4FF', small: '#DCEBFF', medium: '#FFCF6B', large: '#FF7A8A' };
  const line = (a, b, style, width, dash = []) => { g.setLineDash(dash); g.strokeStyle = style; g.lineWidth = width * f; g.beginPath(); g.moveTo(...a); g.lineTo(...b); g.stroke(); g.setLineDash([]); };
  const label = (text, x, y, c) => {
    g.font = `700 ${12 * f}px Manrope, system-ui, sans-serif`;
    const w = g.measureText(text).width;
    g.fillStyle = 'rgba(1, 16, 34, .88)'; g.beginPath();
    if (g.roundRect) g.roundRect(x - 6 * f, y - 14 * f, w + 12 * f, 20 * f, 5 * f); else g.rect(x - 6 * f, y - 14 * f, w + 12 * f, 20 * f);
    g.fill(); g.fillStyle = c; g.fillText(text, x, y);
  };
  // Surface reference across the crop.
  if (cap.points.waterA) {
    const a = P('waterA');
    line([a[0] - u[0] * 4000, a[1] - u[1] * 4000], [a[0] + u[0] * 4000, a[1] + u[1] * 4000], 'rgba(255, 207, 107, .85)', 1.6, [8 * f, 6 * f]);
  }
  for (const [a, b] of [['head', 'shoulder'], ['shoulder', 'hip'], ['hip', 'knee'], ['knee', 'ankle'], ['ankle', 'toe'], ['hip', 'ankleB'], ['hip', 'crotch'], ['crotch', 'kneecap']]) {
    if (P(a) && P(b)) { line(P(a), P(b), 'rgba(1, 16, 34, .6)', 6); line(P(a), P(b), '#B8E4FF', 3); }
  }
  // Each requirement: a dashed guide from the measuring joint, and the gap to the real line.
  const guide = (anchor, actual, wantAngle, band, text, labelSide = 1) => {
    const len = Math.hypot(actual[0] - anchor[0], actual[1] - anchor[1]);
    const want = [anchor[0] + Math.cos(wantAngle) * len, anchor[1] + Math.sin(wantAngle) * len];
    line(anchor, want, 'rgba(255, 255, 255, .92)', 2.2, [7 * f, 6 * f]);
    if (band === 'clean') return;
    const got = Math.atan2(actual[1] - anchor[1], actual[0] - anchor[0]);
    const sweep = ((got - wantAngle + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
    g.strokeStyle = colour[band]; g.lineWidth = 3 * f; g.beginPath();
    g.arc(anchor[0], anchor[1], Math.min(len * .55, 70 * f), wantAngle, wantAngle + sweep, sweep < 0); g.stroke();
    const mid = wantAngle + sweep / 2, rr = Math.min(len * .55, 70 * f) + 16 * f;
    label(text, anchor[0] + Math.cos(mid) * rr + (labelSide < 0 ? -40 * f : 4 * f), anchor[1] + Math.sin(mid) * rr, colour[band]);
  };
  for (const m of r.metrics) {
    if (m.error || !m.deduction) continue;
    const [a, b, c] = m.spec.pts.map(P);
    if (!a || !b) continue;
    const band = m.deduction.band, text = `${m.deviation.toFixed(1)}°`;
    if (m.spec.kind === 'segmentToVertical') guide(a, b, Math.atan2(n[1], n[0]), band, text);
    else if (m.spec.kind === 'segmentToWater') {
      const dir = (b[0] - a[0]) * u[0] + (b[1] - a[1]) * u[1] >= 0 ? 1 : -1;
      guide(a, b, Math.atan2(u[1] * dir, u[0] * dir), band, text);
    } else if (m.spec.kind === 'jointAngle' && c) {
      const ta = Math.atan2(a[1] - b[1], a[0] - b[0]), tc = Math.atan2(c[1] - b[1], c[0] - b[0]);
      const side = Math.sign(((tc - ta + Math.PI * 3) % (Math.PI * 2)) - Math.PI) || 1;
      guide(b, c, ta + side * m.spec.ideal * Math.PI / 180, band, text);
    }
  }
  // A failed stillness check: where the segment pointed at the earlier checkpoint.
  const frames = measuredCaptures();
  r.checkResults.forEach((cr, i) => {
    if (!cr.measured || cr.pass) return;
    for (const [t, test] of (cp.checkTests?.[i] || []).entries()) {
      const part = cr.parts[t];
      if (test.kind !== 'segmentShift' || part.pass) continue;
      const ref = frames[test.ref];
      const [a, b] = test.pts.map(P);
      if (!ref || !a || !b) continue;
      const ra = ref.points[test.pts[0]], rb = ref.points[test.pts[1]];
      const head = Math.atan2((rb[0] - ra[0]) * ref.frame.n[0] + (rb[1] - ra[1]) * ref.frame.n[1], (rb[0] - ra[0]) * ref.frame.u[0] + (rb[1] - ra[1]) * ref.frame.u[1]);
      const want = [u[0] * Math.cos(head) + n[0] * Math.sin(head), u[1] * Math.cos(head) + n[1] * Math.sin(head)];
      guide(a, b, Math.atan2(want[1], want[0]), 'medium', `moved ${part.display}`, -1);
    }
  });
  for (const [key] of body) {
    const p = P(key);
    g.beginPath(); g.arc(p[0], p[1], 4.6 * f, 0, Math.PI * 2);
    g.fillStyle = key === 'hip' ? '#FFCF6B' : '#EAF6FF'; g.fill();
    g.lineWidth = 1.6 * f; g.strokeStyle = '#03101D'; g.stroke();
  }
}

function animateResults() {
  if (reducedMotion.matches) return;
  const ease = 'cubic-bezier(.16, 1, .3, 1)';
  for (const node of [document.querySelector('#scoreboard .big'), document.querySelector('#scoreboard .stat b')]) {
    const text = node?.textContent ?? '', target = parseFloat(text);
    if (!Number.isFinite(target)) continue;
    const decimals = (text.split('.')[1] || '').length, start = performance.now();
    const tick = now => {
      const u = Math.min(1, (now - start) / 1100);
      node.textContent = u < 1 ? (target * (1 - Math.pow(1 - u, 4))).toFixed(decimals) : text;
      if (u < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }
  [...document.querySelectorAll('#diagSeq .seq-node, #diagnostics .cmp-card, #plan > *, #plan .drill-card')].forEach((node, i) => {
    node.animate([{ opacity: 0, transform: 'translateY(14px)' }, { opacity: 1, transform: 'none' }],
      { duration: 520, delay: 120 + Math.min(i, 14) * 45, easing: ease, fill: 'backwards' });
  });
  if ($('scoreboard').dataset.complete === 'true') document.dispatchEvent(new CustomEvent('fs:results'));
  document.querySelectorAll('#diagnostics .dial-needle').forEach((needle, i) => {
    const deg = Math.atan2(needle.x2.baseVal.value - 60, 70 - needle.y2.baseVal.value) * 180 / Math.PI;
    needle.style.transformOrigin = '60px 70px';
    needle.animate([{ transform: `rotate(${-deg}deg)` }, { transform: 'rotate(0deg)' }],
      { duration: 900, delay: 300 + Math.min(i, 14) * 45, easing: ease, fill: 'backwards' });
  });
}

/** The whole figure at a glance: every position, its diagram and how it scored. */
function renderDiagSequence(fig, s) {
  const strip = $('diagSeq');
  strip.replaceChildren();
  fig.checkpoints.forEach(cp => {
    const r = s.results.find(x => x.checkpoint.id === cp.id);
    const node = el('div', 'seq-node' + (isKeyCheckpoint(cp) ? ' is-key' : ''));
    if (cp.art) node.append(poseArt(cp.art, 'pose-seq'));
    node.append(el('b', null, cp.label.split(' · ')[0]));
    if (r?.captured) {
      const score = el('em', null, r.score.toFixed(1));
      score.style.color = r.score >= 8 ? 'var(--accent)' : r.score >= 6 ? 'var(--gold)' : 'var(--rose)';
      node.append(score);
    }
    node.append(el('small', null, (cp.weight ? `${shareOf(cp.weight)}% of score` : 'reference') + (r?.auto ? ' · unconfirmed' : '')));
    strip.append(node);
  });
}

function renderPlan(plan, fig, s) {
  const captured = s.results.filter(r => r.captured && r.checkpoint.weight > 0);
  if (!captured.length) { plan.append(el('p', 'empty-note', 'Capture some checkpoints and a plan will appear here.')); return; }

  const weakest = [...captured].sort((a, b) => ((10 - b.score) * b.checkpoint.weight) - ((10 - a.score) * a.checkpoint.weight))[0];
  const focus = el('div', 'plan-focus');
  focus.append(el('h3', null, `Focus: ${weakest.checkpoint.label}`));
  focus.append(el('p', null, `Worth ${shareOf(weakest.checkpoint.weight)}% of the figure score (NV ${weakest.checkpoint.weight.toFixed(1)} of ${fig.totalNV.toFixed(1)}) and scores ${weakest.score.toFixed(1)}. Improving it moves the total more than anything else you captured.`));
  plan.append(focus);

  // Every measured shortfall, ranked by how much it costs the score; each names the drills that train it.
  const issues = [];
  for (const r of captured) {
    for (const m of r.metrics) {
      if (m.error) continue;
      if (m.chartScore != null && m.chartScore < 8) issues.push({ drill: m.spec.id, weight: r.checkpoint.weight * (8 - m.chartScore), title: `${m.spec.label}: ${m.display}`, detail: m.band, where: r.checkpoint.label });
      else if (m.deduction?.value) issues.push({ drill: m.spec.id, weight: r.checkpoint.weight * m.deduction.value, title: `${m.spec.label}: ${m.display}`, detail: `${m.deduction.label} · −${m.deduction.value.toFixed(1)}`, where: r.checkpoint.label });
    }
    r.checkResults.forEach((c, i) => {
      if (!c.measured || c.pass) return;
      const part = c.parts.find(p => !p.pass);
      issues.push({ drill: r.checkpoint.checkDrills?.[i], weight: r.checkpoint.weight * 0.2, title: c.text, detail: `Not met: ${part.label.toLowerCase()} ${part.display}, needs ${part.limit} · −0.2`, where: r.checkpoint.label });
    });
  }
  if (s.tempo?.deduction.value) issues.push({ drill: 'tempo', weight: fig.totalNV * s.tempo.deduction.value * 0.2, title: `${fig.tempo.label}: ${s.tempo.display}`, detail: fig.tempo.note, where: 'Whole figure' });
  issues.sort((a, b) => b.weight - a.weight);

  const used = new Set();
  const drillsFor = (key, limit) => (fig.drills?.[key] || [])
    .filter(d => !used.has(d))
    .slice(0, limit)
    .map(d => { used.add(d); return DRILLS[d] ? drillCard(DRILLS[d]) : el('p', 'drill-how', d); });

  const seen = new Set();
  let shown = 0;
  for (const issue of issues) {
    if (shown >= 3 || seen.has(issue.drill)) continue;
    const cards = drillsFor(issue.drill, 2);
    if (!cards.length) continue;
    seen.add(issue.drill);
    shown++;
    const block = el('section', 'plan-item');
    const head = el('div', 'plan-head');
    head.append(el('span', 'plan-num', String(shown)));
    const text = el('div');
    text.append(el('h3', null, issue.title), el('p', 'plan-detail', `${issue.where} · ${issue.detail}`));
    head.append(text);
    block.append(head);
    const grid = el('div', 'drill-grid');
    grid.append(...cards);
    block.append(grid);
    plan.append(block);
  }
  if (!shown) plan.append(el('p', 'empty-note', 'No measured deviation crossed a deduction band. Keep filming from the same angle and compare week to week.'));

  // What the camera cannot see still gets practice, but the coach decides whether it is right.
  const coach = captured.flatMap(r => r.checkResults.map((c, i) => ({ c, r, i })).filter(({ c }) => !c.measured && !c.pass));
  if (coach.length) {
    const block = el('section', 'plan-item plan-coach');
    const head = el('div', 'plan-head');
    head.append(icon('eye'));
    const text = el('div');
    text.append(el('h3', null, 'Ask your coach to watch for'), el('p', 'plan-detail', 'A side camera cannot judge these. Practise them, and let your coach confirm.'));
    head.append(text);
    block.append(head);
    const list = el('ul', 'coach-list');
    coach.forEach(({ c, r, i }) => {
      const item = el('li');
      item.append(el('b', null, `${r.checkpoint.label}: `), document.createTextNode(c.text));
      const key = fig.drills?.[r.checkpoint.checkDrills?.[i]]?.find(d => DRILLS[d]);
      if (key) item.append(el('span', 'coach-drill', ` · Practise with ${DRILLS[key].name.toLowerCase()} (${DRILLS[key].where.toLowerCase()}).`));
      list.append(item);
    });
    block.append(list);
    plan.append(block);
  }

  plan.append(el('p', 'plan-safety', 'Practise in the pool only with a qualified coach or lifeguard on deck, and never do breath-hold work alone. Stop any stretch or exercise that causes sharp pain.'));
}

function drillCard(d) {
  const card = el('article', 'drill-card');
  card.dataset.where = d.where.startsWith('Land') ? 'land' : 'pool';
  const top = el('div', 'drill-top');
  top.append(el('span', 'drill-where', d.where), el('h4', null, d.name));
  card.append(top);
  card.append(el('p', 'drill-how', d.how));
  const dose = el('p', 'drill-dose');
  dose.append(el('b', null, 'Amount: '), document.createTextNode(d.dose), el('small', null, d.sourced ? ' · as given in the source' : ' · a starting point to agree with your coach'));
  card.append(dose);
  // The drill on video: it plays here, from the moment the drill starts to the moment it ends.
  const src = d.source;
  const clock = t => `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`;
  const watch = el('button', 'drill-watch');
  watch.type = 'button';
  watch.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="11" fill="currentColor"/><path d="m10 8 6 4-6 4Z" fill="#FFFFFF"/></svg>';
  watch.append(el('span', null, `Watch the drill · ${clock(src.start)}–${clock(src.end)}`), el('small', null, `${src.channel}: ${src.title}`));
  watch.onclick = () => {
    const frame = document.createElement('iframe');
    frame.className = 'drill-video';
    frame.title = `${d.name}: ${src.title}, by ${src.channel}`;
    frame.src = `https://www.youtube-nocookie.com/embed/${src.video}?start=${src.start}&end=${src.end}&autoplay=1&rel=0&playsinline=1`;
    frame.allow = 'autoplay; encrypted-media; picture-in-picture; fullscreen';
    frame.allowFullscreen = true;
    frame.referrerPolicy = 'strict-origin-when-cross-origin';
    watch.replaceWith(frame);
  };
  const open = el('a', 'drill-source', 'Open on YouTube ↗');
  open.href = src.url; open.target = '_blank'; open.rel = 'noopener';
  card.append(watch, open);
  return card;
}

/* --------------------------------------------------------- reference */
function renderReference() {
  const fig = state.figure;
  const body = $('referenceBody');
  body.replaceChildren();

  for (const t of fig.transitions) {
    body.append(el('h3', null, t.title));
    const table = el('table');
    const head = el('tr');
    head.append(el('th', null, 'Rule book description'), el('th', null, 'Diagrams'), el('th', null, 'Major desired actions'));
    table.append(head);
    const rows = Math.max(t.rules.length, t.actions.length);
    const fromArt = fig.checkpoints.find(c => c.id === t.from)?.art;
    const toArt = fig.checkpoints.find(c => c.id === t.to)?.art;
    for (let i = 0; i < rows; i++) {
      const tr = el('tr');
      tr.append(el('td', null, t.rules[i] || ''));
      if (i === 0) {
        const cell = el('td', 'ref-art');
        cell.rowSpan = rows;
        if (fromArt && toArt) cell.append(poseArt(fromArt, 'pose-req'), el('span', 'req-arrow', '→'), poseArt(toArt, 'pose-req'));
        tr.append(cell);
      }
      tr.append(el('td', null, t.actions[i] || ''));
      table.append(tr);
    }
    body.append(table);
  }

  for (const d of fig.deductions) {
    body.append(el('h3', null, 'Deduction guidelines · ' + d.phase));
    const table = el('table');
    const head = el('tr');
    head.append(el('th', null, 'Small — 0.2 (1-15°)'), el('th', null, 'Medium — 0.5 (16-30°)'), el('th', null, 'Large — 1.0 (31°+)'));
    table.append(head);
    d.rows.forEach(cells => {
      const tr = el('tr');
      cells.forEach(c => tr.append(el('td', null, c)));
      table.append(tr);
    });
    body.append(table);
  }

  body.append(el('h3', null, 'Visible scales of angle deviation'));
  body.append(el('p', 'muted', 'Applied to plumb-line points of reference when evaluating the vertical and horizontal alignments a figure requires.'));
  const scale = el('table');
  const scaleHead = el('tr');
  scaleHead.append(el('th', null, 'Deviation'), el('th', null, 'Angle'), el('th', null, 'Deduction'));
  scale.append(scaleHead);
  REFERENCE.ANGLE_SCALE.forEach(([label, range, value]) => {
    const tr = el('tr');
    tr.append(el('td', null, label), el('td', null, range), el('td', null, value));
    scale.append(tr);
  });
  body.append(scale);

  body.append(el('h3', null, 'Travel deduction guidelines'));
  const travel = el('table');
  REFERENCE.TRAVEL_GUIDE.forEach(([label, text]) => {
    const tr = el('tr');
    tr.append(el('th', null, label), el('td', null, text));
    travel.append(tr);
  });
  body.append(travel);
}

$('startOver').onclick = () => {
  clearReview();
  state.captures = {};
  state.drafts = {};
  state.draft = null;
  state.cpIndex = 0;
  renderStepper();
  show('setup');
};

/* ------------------------------------------------ illustration / diagram */
// Chosen on the figure card, remembered on this device and applied on every page. On a switch
// the pictures in view turn over one after another, like a row of cards.
const viewFlip = $('viewFlip');
const viewChoices = [...viewFlip.querySelectorAll('[role="radio"]')];

function posesInView() {
  return [...document.querySelectorAll('.pose-switch')]
    .map(pose => [pose, pose.getBoundingClientRect()])
    .filter(([, r]) => r.width && r.bottom > 0 && r.top < innerHeight)
    .sort(([, a], [, b]) => Math.round(a.top / 80) - Math.round(b.top / 80) || a.left - b.left)
    .slice(0, 24)
    .map(([pose]) => pose);
}

async function turnOver(pose, dir, delay) {
  const edge = deg => `perspective(700px) rotateY(${deg}deg)`;
  // Flat while turning, so a card's own panel never hides the half that swings behind it.
  const card = pose.closest('.seq-node');
  card?.classList.add('is-turning');
  try {
    const out = pose.animate([{ transform: edge(0), filter: 'brightness(1)' }, { transform: edge(90 * dir), filter: 'brightness(.5)' }],
      { duration: 190, delay, easing: 'cubic-bezier(.55, 0, 1, .45)', fill: 'forwards' });
    await out.finished;
    pose.classList.remove('face-art', 'face-tech');
    const back = pose.animate([{ transform: edge(-90 * dir), filter: 'brightness(.5)' }, { transform: edge(14 * dir), filter: 'brightness(1.08)', offset: .65 }, { transform: edge(0), filter: 'brightness(1)' }],
      { duration: 520, easing: 'cubic-bezier(.2, .8, .3, 1)' });
    out.cancel();
    await back.finished;
  } catch { pose.classList.remove('face-art', 'face-tech'); }
  if (!pose.getAnimations().length) card?.classList.remove('is-turning');
}

function setTechnical(on, animate = false) {
  viewFlip.dataset.view = on ? 'tech' : 'art';
  viewChoices.forEach(b => {
    const picked = (b.dataset.view === 'tech') === on;
    b.setAttribute('aria-checked', String(picked));
    b.tabIndex = picked ? 0 : -1;
  });
  if (document.body.classList.contains('technical-view') === on) return;
  const still = !animate || matchMedia('(prefers-reduced-motion: reduce)').matches;
  const turning = still ? [] : posesInView();
  turning.forEach(pose => {
    pose.getAnimations().forEach(a => a.cancel());
    pose.classList.remove('face-art', 'face-tech');
    pose.classList.add(on ? 'face-art' : 'face-tech');
  });
  document.body.classList.toggle('technical-view', on);
  const dir = on ? 1 : -1;
  turning.forEach((pose, i) => turnOver(pose, dir, i * 75));
  if (!still) viewFlip.querySelector('.view-flip-thumb').animate(
    [{ transform: 'rotateY(0deg)' }, { transform: `rotateY(${-34 * dir}deg) scaleX(1.08)`, offset: .35 }, { transform: 'rotateY(0deg)' }],
    { duration: 620, easing: 'ease-out' });
}

function chooseView(on) {
  setTechnical(on, true);
  try { localStorage.setItem('fs-technical', on ? '1' : '0'); } catch {}
}
viewChoices.forEach(b => { b.onclick = () => chooseView(b.dataset.view === 'tech'); });
viewFlip.onkeydown = e => {
  if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) return;
  e.preventDefault();
  const on = e.key === 'ArrowRight' || e.key === 'ArrowDown';
  chooseView(on);
  viewChoices.find(b => (b.dataset.view === 'tech') === on).focus();
};
try { setTechnical(localStorage.getItem('fs-technical') === '1'); } catch {}

renderGroups();
show(location.hash.slice(1) || 'home', true);


/* Ballet Leg assisted review: suggestions remain separate from confirmed captures. */
function rememberDraft() {
  if(state.draft && !state.waterMode && currentCp())state.drafts[currentCp().id]=state.draft;
}
// An edit stays a draft: Results keep the saved (or detected) marks until it is saved.
function invalidateCheckpoint() {
  if(state.waterMode || !currentCp() || !state.draft)return;
  const saved=!!state.captures[currentCp().id];
  if(!state.draft.edited) {
    state.draft.edited=true;
    say(`Unsaved changes. Results keep using the ${saved?'saved':'detected'} marks until you save.`);
    rememberDraft();renderStepper();
  }
  rememberDraft();
  $('saveCp').textContent=saved?'Save changes':'Save checkpoint';
}
function selectCheckpoint(i) {
  if(state.busy)return;
  rememberDraft();
  state.waterMode=false;state.cpIndex=i;state.draft=null;state.activeLm=null;
  const id=currentCp().id, d=state.drafts[id] || state.captures[id] || state.autoFrames[id];
  video.pause();if(d)video.currentTime=d.time;
  renderStepper();renderCapturePanel();
}
function bitmapThumb(d) {
  const c=document.createElement('canvas');c.width=d.width;c.height=d.height;
  c.getContext('2d').putImageData(d.bitmap,0,0);
  const t=document.createElement('canvas');t.width=160;t.height=160*d.height/d.width;
  t.getContext('2d').drawImage(c,0,0,t.width,t.height);
  return t.toDataURL('image/jpeg',0.65);
}
function focusSwimmer() {
  if(!state.draft)return;
  const pts=Object.entries(state.draft.points).filter(([k])=>!k.startsWith('water')).map(([,p])=>p);
  if(pts.length<2){resetView();return;}
  const xs=pts.map(p=>p[0]),ys=pts.map(p=>p[1]);
  const minX=Math.max(0,Math.min(...xs)-120),maxX=Math.min(canvas.width,Math.max(...xs)+90);
  const minY=Math.max(0,Math.min(...ys)-85),maxY=Math.min(canvas.height,Math.max(...ys)+85);
  view.zoom=Math.min(4,Math.max(1,Math.min(canvas.width/(maxX-minX),canvas.height/(maxY-minY))));
  const wrap=wrapEl();
  view.x=wrap.clientWidth/2-((minX+maxX)/2/canvas.width)*wrap.clientWidth*view.zoom;
  view.y=wrap.clientHeight/2-((minY+maxY)/2/canvas.height)*wrap.clientHeight*view.zoom;
  applyView();draw();
}
$('zoomSwimmer').onclick=focusSwimmer;
function drawBalletMeasures(d,scale) {
  const f=scale/Math.max(1,view.zoom*0.7);
  const label=(text,x,y,color='#edf7ff')=>{
    ctx.font=`600 ${13*f}px system-ui`;const w=ctx.measureText(text).width;
    x=Math.max(2,Math.min(canvas.width-w-12*f,x));y=Math.max(18*f,Math.min(canvas.height-4*f,y));
    ctx.fillStyle='rgba(3,26,43,.90)';ctx.fillRect(x-5*f,y-15*f,w+10*f,20*f);
    ctx.fillStyle=color;ctx.fillText(text,x,y);
  };
  for(const k of ['shoulder','hip','knee','ankle','ankleB']) {
    const p=d.points[k];if(!p)continue;
    const names={shoulder:'Shoulder',hip:'Hip',knee:'Knee',ankle:'Working ankle',ankleB:'Surface ankle'};
    label(names[k],p[0]+12*f,p[1]+(k==='hip'?25:-12)*f);
  }
  let frame;try{frame=waterFrame(d.points.waterA,d.points.waterB);}catch{return;}
  const probe={points:d.points,frame,scale:referenceScale(d.points),time:d.time};
  for(const spec of currentCp().metrics.filter(m=>m.kind==='jointAngle')) {
    if(spec.pts.some(k=>!d.points[k]))continue;
    const [a,b,c]=spec.pts.map(k=>d.points[k]);
    let start=Math.atan2(a[1]-b[1],a[0]-b[0]),end=Math.atan2(c[1]-b[1],c[0]-b[0]);
    let sweep=(end-start+Math.PI*3)%(Math.PI*2)-Math.PI;
    ctx.beginPath();ctx.strokeStyle='#ffcf6b';ctx.lineWidth=2*f;
    ctx.arc(b[0],b[1],23*f,start,start+sweep,sweep<0);ctx.stroke();
    try{const out=evaluateMetric(spec,probe,state.captures);label(out.display,b[0]+30*f,b[1]+(spec.pts[1]==='knee'?8:-22)*f,'#ffcf6b');}catch{}
  }
  const vertical=currentCp().metrics.find(m=>m.kind==='segmentToVertical');
  if(vertical)try{
    const out=evaluateMetric(vertical,probe,state.captures),hip=d.points.hip;
    const end=d.points[vertical.pts[1]],length=Math.hypot(end[0]-hip[0],end[1]-hip[1])+15*f;
    ctx.strokeStyle='rgba(255,207,107,.8)';ctx.lineWidth=1.5*f;ctx.setLineDash([5*f,5*f]);
    ctx.beginPath();ctx.moveTo(...hip);ctx.lineTo(hip[0]+frame.n[0]*length,hip[1]+frame.n[1]*length);ctx.stroke();ctx.setLineDash([]);
    const start=Math.atan2(frame.n[1],frame.n[0]),finish=Math.atan2(end[1]-hip[1],end[0]-hip[0]);
    const sweep=(finish-start+Math.PI*3)%(Math.PI*2)-Math.PI;
    ctx.beginPath();ctx.arc(hip[0],hip[1],36*f,start,start+sweep,sweep<0);ctx.stroke();
    label(`${out.display} from vertical`,hip[0]-140*f,hip[1]+62*f,'#ffcf6b');
  }catch{}
}
async function readCheckpoint(time, points={}, source='Suggested frame · review every dot.') {
  await seekTo(Math.max(0,Math.min(video.duration-0.001,time)));
  const c=document.createElement('canvas');c.width=Math.min(video.videoWidth,1280);c.height=Math.round(c.width*video.videoHeight/video.videoWidth);
  const cx=c.getContext('2d',{willReadFrequently:true});cx.drawImage(video,0,0,c.width,c.height);
  const d={time:video.currentTime,width:c.width,height:c.height,bitmap:cx.getImageData(0,0,c.width,c.height),points,checks:new Set(),source};
  d.thumb=bitmapThumb(d);return d;
}
async function fineTuneCheckpoint(delta) {
  if(!state.draft || state.busy || state.waterMode)return;
  const old=state.draft, target=Math.max(0,Math.min(video.duration-0.001,old.time+delta));
  state.busy=true;video.pause();
  try {
    const points=Object.fromEntries(Object.entries(old.points).map(([k,p])=>[k,p.slice()]));
    state.draft=await readCheckpoint(target,points,'Frame adjusted · dots carried from the previous frame. Realign them before saving.');
    invalidateCheckpoint();renderStepper();renderCapturePanel();
  }catch(err){say(err.message,'error');}
  finally{state.busy=false;}
}
$('cpEarlier').onclick=()=>fineTuneCheckpoint(-1/30);
$('cpLater').onclick=()=>fineTuneCheckpoint(1/30);
async function findBalletFrames() {
  if(state.busy || !state.file || !video.videoWidth)return;
  if(Object.keys(state.captures).length || Object.keys(state.drafts).length || Object.keys(state.autoFrames).length) {
    scanSay('Your checkpoint edits are retained. Select a checkpoint to refine its frame or dots, or delete its frames to run auto-find again.');return;
  }
  state.busy=true;video.pause();$('autoFind').disabled=true;$('scanbar').hidden=false;$('autoscanCard').classList.remove('is-compact');
  let needsWaterline=false;
  scanSay('Checking the clip and preparing checkpoint suggestions…');
  try {
    const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',await state.file.arrayBuffer())),b=>b.toString(16).padStart(2,'0')).join('');
    let suggestions;
    if(hash===DEMO_HASH) {
      const sx=Math.min(video.videoWidth,1280)/640,sy=Math.round(Math.min(video.videoWidth,1280)*video.videoHeight/video.videoWidth)/360;
      suggestions=DEMO_PICKS.map(p=>({...p,points:Object.fromEntries(Object.entries(p.points).map(([k,v])=>[k,[v[0]*sx,v[1]*sy]])),source:'Reviewed demo suggestion · approximate joints and surface reference. Drag to refine.'}));
    } else {
      if(!state.waterline){needsWaterline=true;return;}
      scanSay('Loading on-device pose detection. The video stays in this browser.');
      let timer;
      const model=await Promise.race([getModel('IMAGE'),new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error('Pose model download timed out.')),30000);})]).finally(()=>clearTimeout(timer));
      const c=document.createElement('canvas');c.width=640;c.height=Math.round(640*video.videoHeight/video.videoWidth);
      const cx=c.getContext('2d');const samples=[];
      const width=Math.min(video.videoWidth,1280),height=Math.round(width*video.videoHeight/video.videoWidth);
      const step=Math.max(0.25,video.duration/480);
      for(let t=0;t<video.duration-0.04;t+=step) {
        await seekTo(t);cx.drawImage(video,0,0,c.width,c.height);
        const lm=model.detect(c).landmarks?.[0];
        samples.push({time:video.currentTime,candidate:poseCandidate(lm,width,height,state.waterline)});
        $('scanfill').style.width=Math.round(t/video.duration*100)+'%';
        scanSay(`Finding positions in sequence… ${Math.round(t/video.duration*100)}%`);
      }
      const picks=pickBalletSequence(samples);
      if(!picks){scanSay('The swimmer could not be tracked through all five positions. Capture each checkpoint manually; no measurements have been invented.','error');return;}
      suggestions=picks.map((p,i)=>({id:state.figure.checkpoints[i].id,time:p.time,points:{waterA:state.waterline[0].slice(),waterB:state.waterline[1].slice(),...p.candidate.points},source:'Pose-based suggestion · unconfirmed. Check frame, joints and surface reference.'}));
    }
    for(const p of suggestions)state.autoFrames[p.id]=await readCheckpoint(p.time,p.points,p.source);
    state.waterline=[suggestions[0].points.waterA.slice(),suggestions[0].points.waterB.slice()];
    $('waterPill').textContent='surface reference · review';$('scanfill').style.width='100%';
    state.cpIndex=0;state.draft=null;
    await seekTo(suggestions[0].time);
    renderStepper();renderCapturePanel();
    scanSay('5 checkpoint suggestions ready. Select each frame, adjust its dots, then save to confirm.','ok');
  } catch(err) {scanSay('Could not prepare suggestions. '+err.message+' Capture frames manually instead.','error');}
  finally{state.busy=false;$('autoFind').disabled=false;renderStepper();if(needsWaterline)startWaterlineForAuto();}
}

// Uploads run hands-free: the only manual step is the surface line, then finding starts by itself.
function startWaterlineForAuto() {
  state.autoAfterWaterline=true;
  $('setWaterline').onclick();
  scanSay('Mark the waterline: click two points along the flat surface. Checkpoint finding starts as soon as you save it.');
}


// Xavier's demo runs the same review as an upload, without touching the upload card.
async function openDemo() {
  if(state.busy)return;
  const buttons=[...document.querySelectorAll('[data-demo]')];
  const notices=[...document.querySelectorAll('[data-demo-status]')];
  const message=text=>notices.forEach(n=>n.textContent=text);
  state.busy=true;buttons.forEach(b=>b.disabled=true);
  message('Opening Xavier’s Ballet Leg demo…');
  try {
    // The home page may already have fetched the clip for its live analysis.
    window.fsDemoClip??=fetch(document.querySelector('meta[name="fs-demo-clip"]').content).then(response=>{
      if(!response.ok)throw new Error('The demo video could not be loaded.');
      return response.blob();
    });
    let blob;
    try{blob=await window.fsDemoClip;}catch(error){window.fsDemoClip=null;throw error;}
    const file=new File([blob],'xavier-ballet-leg-demo.mp4',{type:'video/mp4'});
    $('group').value='intermediate';$('group').onchange();
    $('figure').value='f101';$('figure').onchange();
    await new Promise((resolve,reject)=>{
      const timer=setTimeout(()=>finish(new Error('The demo video took too long to load.')),15000);
      const ready=()=>finish();const failed=()=>finish(new Error('The browser could not read the demo video.'));
      function finish(error){clearTimeout(timer);video.removeEventListener('loadeddata',ready);video.removeEventListener('error',failed);error?reject(error):resolve();}
      video.addEventListener('loadeddata',ready,{once:true});video.addEventListener('error',failed,{once:true});
      // The supplied demonstration clip, not a user upload, so no permission box is needed.
      loadVideoFile(file,true);
    });
    state.busy=false;
    await $('startReview').onclick();
    if(state.autoFrames.ballet)selectCheckpoint(2);
    message('');
    // The review opens at the very top: header, checkpoints and video are all in the first screen.
    window.scrollTo({ top: 0, behavior: 'instant' });
  }catch(error){message(error.message+' Try again or upload your own clip.');}
  finally{state.busy=false;buttons.forEach(b=>b.disabled=false);}
}
document.querySelectorAll('[data-demo]').forEach(b=>b.onclick=openDemo);
if(new URLSearchParams(location.search).get('demo')==='1' || document.documentElement.dataset.startDemo==='true')openDemo();
