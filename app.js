// app.js
// Connects the page to the other modules: video, capture, marking points,
// saving checkpoints, results and drills. Everything stays in this browser tab.

import { LANDMARKS, BALLET_LEG as FIG, DRILLS, pointsNeeded, videoLink } from './figures.js';
import { scoreCheckpoint, scoreFigure, waterFrame } from './geometry.js';
import { poseArt } from './poses.js';
import { detectPose, scanVideo, seekTo } from './autoscan.js';
import { pickBalletSequence, pointsFromPose } from './ballet-assist.js';

const $ = id => document.getElementById(id);
const FRAME = 1 / 30;            // one frame at 30 fps
const MAX_BYTES = 200 * 1024 * 1024;
const GRAB_PX = 16;              // how close (on screen) a click must be to grab a point
const LABELS = Object.fromEntries(Object.entries(LANDMARKS).map(([k, v]) => [k, v.label]));

// ---------------------------------------------------------------- state
const state = {
  current: FIG.checkpoints[0].id,
  drafts: {},     // the checkpoint you are working on: { time, frame, points, checks, note }
  saved: {},      // copies taken when you press Save; results use only these
  selected: null, // the point the next click places
  side: null,     // the working leg found by a scan or suggestion
  picks: null,    // suggested times from "Find the five moments"
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

function renderTabs() {
  $('tabs').innerHTML = FIG.checkpoints.map(cp => {
    const d = state.drafts[cp.id], s = state.saved[cp.id];
    let label = '<small>Empty</small>';
    if (s && d && snapshot(d) !== snapshot(s)) label = '<small class="edits">Unsaved changes</small>';
    else if (s) label = `<small class="saved">Saved · ${scoreCheckpoint(cp, s.points, s.checks, LABELS).score.toFixed(1)}</small>`;
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
    for (const [name, p] of Object.entries(points)) if (p) { d.points[name] = p; placed++; }
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
  return pointsNeeded(cpById(state.current)).find(n => !d || !d.points[n]) || null;
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
  if (clearStatus) setStatus($('markStatus'), d && d.note ? d.note : '', d && d.note ? 'warn' : '');

  // point chips
  $('chips').innerHTML = pointsNeeded(cp).map(n => `<button type="button" class="chip${d && d.points[n] ? ' placed' : ''}"
      data-pt="${n}" aria-pressed="${state.selected === n}" title="${LANDMARKS[n].hint}">${LANDMARKS[n].label}</button>`).join('');
  $('pointHint').textContent = state.selected ? `Next: ${LANDMARKS[state.selected].hint}.` : (d && d.frame ? 'All points placed. Drag any that are off.' : 'Capture a frame first.');

  // coach's-eye checks
  $('checks').innerHTML = '<legend>Coach\'s eye: tick what you see</legend>' + cp.checks.map((c, i) => `
    <label class="check"><input type="checkbox" data-check="${i}" ${d && d.checks[i] ? 'checked' : ''} ${d && d.frame ? '' : 'disabled'}><span>${c.text}</span></label>`).join('');

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
  const result = scoreCheckpoint(cp, d ? d.points : {}, d ? d.checks : [], LABELS);
  $('liveRows').innerHTML = result.rows.map(r => `<tr>
      <td>${r.metric.label}</td>
      <td class="num">${r.metric.ideal}°</td>
      <td class="num">${r.error ? '–' : r.value.toFixed(1) + '°'}</td>
      <td>${r.error ? `<span class="pill none">${r.error}</span>` : `<span class="pill ${r.deduction.band}">${r.deduction.label}${r.deduction.value ? ' −' + r.deduction.value.toFixed(1) : ''}</span>`}</td>
    </tr>`).join('');
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
  const result = scoreCheckpoint(cp, d.points, d.checks, LABELS);
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

// Draws a frame plus its points onto any 2D context, scaled by k.
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
    try { f = waterFrame(wa, wb); } catch { /* too close; just draw the segment */ }
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
function nearestPoint(p) {
  const d = draft();
  const reach = GRAB_PX * screenScale();
  let best = null, bestDist = reach;
  for (const [name, q] of Object.entries(d.points)) {
    if (!q) continue;
    const dist = Math.hypot(q.x - p.x, q.y - p.y);
    if (dist <= bestDist) { best = name; bestDist = dist; }
  }
  return best;
}

let dragging = null;
canvas.addEventListener('pointerdown', e => {
  const d = draft();
  if (!d || !d.frame) return;
  const p = toCanvas(e);
  const hit = nearestPoint(p);
  if (hit) {
    dragging = hit;
    state.selected = hit;
    canvas.setPointerCapture(e.pointerId);
  } else {
    const name = state.selected && !d.points[state.selected] ? state.selected : (state.selected || nextMissing());
    if (!name) return;
    d.points[name] = p;
    state.selected = nextMissing();
  }
  renderMarking(false);
});
canvas.addEventListener('pointermove', e => {
  if (!dragging) return;
  const p = toCanvas(e);
  draft().points[dragging] = { x: Math.max(0, Math.min(canvas.width, p.x)), y: Math.max(0, Math.min(canvas.height, p.y)) };
  draw();
});
const endDrag = () => { if (dragging) { dragging = null; renderMarking(false); } };
canvas.addEventListener('pointerup', endDrag);
canvas.addEventListener('pointercancel', endDrag);

canvas.addEventListener('keydown', e => {
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
  p.x += moves[e.key][0] * n;
  p.y += moves[e.key][1] * n;
  e.preventDefault();
  renderMarking(false);
});
window.addEventListener('resize', draw);

// ---------------------------------------------------------------- 4. results
function renderResults() {
  const box = $('resultsBody');
  const out = scoreFigure(FIG, state.saved, LABELS);
  if (out.figureScore === null) {
    box.innerHTML = '<p class="muted">Save at least one scored checkpoint to see results.</p>';
    return;
  }
  const savedCount = out.results.filter(r => r.saved).length;
  const top = out.issues.slice(0, 3);
  box.innerHTML = `
    <div class="score">
      <span class="big">${out.figureScore.toFixed(2)}</span>
      <span>figure score (out of ${(10 * FIG.dd).toFixed(0)})<br><span class="muted small">practice score ${out.practice.toFixed(2)} / 10 × difficulty ${FIG.dd}</span></span>
      ${out.provisional ? `<span class="pill small">Provisional · ${savedCount} of 5 checkpoints saved</span>` : '<span class="pill clean">All 5 checkpoints saved</span>'}
    </div>
    <div>
      <h3>What to work on</h3>
      ${top.length ? `<ol class="issues">${top.map(issueHtml).join('')}</ol>` : '<p class="muted">Nothing lost points in the saved checkpoints. Keep it up.</p>'}
    </div>
    <div style="display:grid;gap:14px">
      <h3>Checkpoint by checkpoint</h3>
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
    paint(c.getContext('2d'), s.frame, s.points, k, { lineWidth: 2 });
  }
}

function issueHtml(issue) {
  const drills = (FIG.drillsFor[issue.drillKey] || []).slice(0, 2).map(id => DRILLS[id]);
  return `<li>
    <b>${issue.title}</b> <span class="muted">· ${issue.checkpoint.label}</span><br>
    <span class="small">${issue.detail}. Costs about <span class="num">${issue.cost.toFixed(2)}</span> figure points.</span>
    <div class="drills">${drills.map(d => `
      <div class="drill"><span class="where">${d.where} · ${d.dose}</span><b>${d.name}</b><span>${d.how}</span>
        <a href="${videoLink(d)}" target="_blank" rel="noopener">Watch the demo (${d.video.channel})</a></div>`).join('')}
    </div></li>`;
}

function resultHtml(r) {
  const cp = r.checkpoint;
  if (!r.saved) {
    return `<div class="result-cp"><div class="muted small">Not saved</div>
      <div><h3>${cp.label}</h3><p class="muted small">No saved frame yet${cp.weight ? '' : ' (reference only)'}.</p></div></div>`;
  }
  const rows = r.rows.map(row => `<tr><td>${row.metric.label}</td><td class="num">${row.metric.ideal}°</td>
      <td class="num">${row.value.toFixed(1)}°</td><td><span class="pill ${row.deduction.band}">${row.deduction.label}${row.deduction.value ? ' −' + row.deduction.value.toFixed(1) : ''}</span></td></tr>`).join('');
  const checks = cp.checks.map(c => `<tr><td>${c.text}</td><td class="num">Met</td><td class="num">${r.missed.includes(c) ? 'No' : 'Yes'}</td>
      <td><span class="pill ${r.missed.includes(c) ? 'small' : 'clean'}">${r.missed.includes(c) ? 'Not met −0.2' : 'Met'}</span></td></tr>`).join('');
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
    $('startOverNote').textContent = 'This removes all frames, points and results.';
    setTimeout(() => { armed = false; $('startOver').textContent = 'Start over'; $('startOverNote').textContent = ''; }, 5000);
    return;
  }
  armed = false;
  state.drafts = {}; state.saved = {}; state.picks = null; state.side = null; state.selected = null;
  state.current = FIG.checkpoints[0].id;
  $('startOver').textContent = 'Start over';
  $('startOverNote').textContent = 'Cleared.';
  renderPicks(); renderMarking(); renderResults();
});

// ---------------------------------------------------------------- go
renderFigure();
renderMarking();
renderResults();
