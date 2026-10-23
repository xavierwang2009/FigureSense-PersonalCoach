// nav.js
// The step-by-step screens (Home · Figure · Video · Review · Results · Progress),
// the gliding tab highlight and the Illustration / Diagram switch.
// Adapted from the FigureSense prototype (xavierwang2009/FigureSense, src/app.js).
// app.js does the work on each screen; this file only decides which screen shows.
// Other code can ask for a screen with:  document.dispatchEvent(new CustomEvent('fs-goto', { detail: 'capture' }))

const $ = id => document.getElementById(id);
const SCREENS = ['home', 'setup', 'upload', 'capture', 'diag', 'progress'];
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
const player = $('player');
const hasVideo = () => !!(player && player.videoWidth);

let shownOnce = false;

export function show(name, fromHistory = false) {
  if (!SCREENS.includes(name)) name = 'home';
  // Review needs a video; send the swimmer to the Video step first.
  if (name === 'capture' && !hasVideo()) name = 'upload';
  const animate = shownOnce && document.body.dataset.page !== name && !!document.startViewTransition && !reducedMotion.matches;
  shownOnce = true;
  const swap = () => showNow(name, fromHistory, animate);
  if (animate) document.startViewTransition(swap); else swap();
}

function showNow(name, fromHistory, animated) {
  if (name !== 'capture' && player) player.pause();
  if (name !== 'upload') $('uploadPreview')?.pause();
  if (name !== 'diag') document.querySelectorAll('iframe.drill-video').forEach(frame => {
    // Unload hidden drill playback; the source link remains available.
    const button = document.createElement('button');
    button.type = 'button'; button.className = 'drill-watch';
    button.dataset.watch = frame.dataset.watch; button.textContent = 'Watch the drill';
    frame.replaceWith(button);
  });
  document.body.dataset.page = name;
  document.querySelectorAll('.screen').forEach(s => s.classList.toggle('is-active', s.id === 'screen-' + name));
  document.querySelectorAll('.step').forEach(b => {
    const on = b.dataset.goto === name;
    b.classList.toggle('is-active', on);
    if (on) b.setAttribute('aria-current', 'step'); else b.removeAttribute('aria-current');
  });
  placeStepGlow(true);
  if (!fromHistory && location.hash !== '#' + name) history.pushState(null, '', '#' + name);
  window.scrollTo({ top: 0, behavior: animated ? 'instant' : 'smooth' });
  // The marking canvas sizes itself to its box; tell it the box may have changed.
  if (name === 'capture') window.dispatchEvent(new Event('resize'));
  if (name === 'diag') animateResults();
}

// Results arrive with a count-up score, cards that fade in one after another, and a splash
// (hero-assets/fx.js) once every checkpoint is saved. Adapted from the prototype.
function animateResults() {
  const board = $('scoreboard');
  if (!board || reducedMotion.matches) return;
  const ease = 'cubic-bezier(.2,.8,.2,1)';
  const counters = [board.querySelector('.big'), board.querySelector('.stat b')].filter(Boolean);
  for (const node of counters) {
    const text = node.dataset.scoreText || node.textContent;
    node.dataset.scoreText = text;
    if (node.scoreAnimation) cancelAnimationFrame(node.scoreAnimation);
    const target = parseFloat(text);
    if (!Number.isFinite(target)) continue;
    const decimals = (text.split('.')[1] || '').replace(/\D.*$/, '').length;
    const start = performance.now();
    const tick = now => {
      const u = Math.min(1, (now - start) / 1100);
      node.textContent = u < 1 ? (target * (1 - Math.pow(1 - u, 4))).toFixed(decimals) : text;
      if (u < 1) node.scoreAnimation = requestAnimationFrame(tick);
    };
    node.scoreAnimation = requestAnimationFrame(tick);
  }
  [...document.querySelectorAll('#diagSeq .seq-node, #diagnostics .cmp-card, #plan > *, #plan .drill-card')].forEach((node, i) => {
    node.animate([{ opacity: 0, transform: 'translateY(14px)' }, { opacity: 1, transform: 'none' }],
      { duration: 520, delay: 120 + Math.min(i, 14) * 45, easing: ease, fill: 'backwards' });
  });
  if (board.dataset.complete === 'true') document.dispatchEvent(new CustomEvent('fs:results'));
}

// The tab highlight glides to the active step and lands with a soft pulse.
function placeStepGlow(arrive = false) {
  const steps = $('steps');
  if (!steps) return;
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

document.addEventListener('click', e => {
  const b = e.target.closest('[data-goto]');
  if (!b || b.disabled) return;
  e.preventDefault();
  show(b.dataset.goto);
});
document.addEventListener('fs-goto', e => show(e.detail));
window.addEventListener('popstate', () => show(location.hash.slice(1), true));

// "Continue to review" works once a video has loaded.
const toReview = $('toReview');
if (player && toReview) {
  const sync = () => { toReview.disabled = !hasVideo(); };
  player.addEventListener('loadedmetadata', sync);
  player.addEventListener('emptied', sync);
  sync();
}

// ---- Illustration | Diagram switch for the position pictures (remembered on this device).
const viewFlip = $('viewFlip');
if (viewFlip) {
  const choices = [...viewFlip.querySelectorAll('[role="radio"]')];
  const setTechnical = (on, animate = false) => {
    viewFlip.dataset.view = on ? 'tech' : 'art';
    choices.forEach(b => {
      const picked = (b.dataset.view === 'tech') === on;
      b.setAttribute('aria-checked', String(picked));
      b.tabIndex = picked ? 0 : -1;
    });
    document.body.classList.toggle('technical-view', on);
    if (animate && !reducedMotion.matches) {
      viewFlip.querySelector('.view-flip-thumb').animate(
        [{ transform: 'rotateY(0deg)' }, { transform: `rotateY(${on ? -34 : 34}deg) scaleX(1.08)`, offset: .35 }, { transform: 'rotateY(0deg)' }],
        { duration: 620, easing: 'ease-out' });
    }
  };
  const choose = on => {
    setTechnical(on, true);
    try { localStorage.setItem('fs-technical', on ? '1' : '0'); } catch { /* fine without it */ }
  };
  choices.forEach(b => b.addEventListener('click', () => choose(b.dataset.view === 'tech')));
  viewFlip.addEventListener('keydown', e => {
    if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) return;
    e.preventDefault();
    const on = e.key === 'ArrowRight' || e.key === 'ArrowDown';
    choose(on);
    choices.find(b => (b.dataset.view === 'tech') === on).focus();
  });
  let saved = false;
  try { saved = localStorage.getItem('fs-technical') === '1'; } catch { /* default: illustrations */ }
  setTechnical(saved);
}

// Start on the screen in the address (#setup, #upload…), or Home.
show(location.hash.slice(1) || 'home', true);
