// Site-wide effects: the animated mark and intro, water ripples, card glow, magnetic buttons
// and the results splash. All of it is decoration: nothing here
// may block the review tool, and reduced motion turns the moving parts off.
(() => {
  const root = document.documentElement;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const fine = matchMedia('(pointer: fine)');
  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
  const page = () => document.body.dataset.page;
  const accentRgb = () => getComputedStyle(root).getPropertyValue('--accent-rgb').trim() || '124, 196, 255';

  /* ------------------------------------------------------ the mark */
  function play(mark) {
    if (reduced.matches || !mark) return;
    mark.classList.remove('is-playing', 'is-idle');
    void mark.getBoundingClientRect();
    mark.classList.add('is-playing');
    clearTimeout(mark.fxTimer);
    mark.fxTimer = setTimeout(() => { mark.classList.remove('is-playing'); mark.classList.add('is-idle'); }, 3000);
  }
  const brand = document.querySelector('.topbar .brand');
  const mark = brand?.querySelector('.fs-mark');
  brand?.addEventListener('pointerenter', () => { if (!mark.classList.contains('is-playing')) play(mark); });
  brand?.addEventListener('focus', () => { if (!mark.classList.contains('is-playing')) play(mark); });

  const wave = document.querySelector('.hero-wave');
  const drawWave = () => wave?.classList.add('is-drawn');

  /* ----------------------------------------------------- the intro */
  // The mark plays large, then flies into the top bar. Once per tab session; any input skips it.
  const intro = document.getElementById('fsIntro');
  if (intro && 'intro' in root.dataset && mark) {
    try { sessionStorage.setItem('fs-intro', '1'); } catch {}
    const big = mark.cloneNode(true);
    big.classList.remove('brand-mark');
    intro.querySelector('.fs-intro-mark').append(big);
    play(big);
    let done = false;
    const finish = fast => {
      if (done) return;
      done = true;
      const from = big.getBoundingClientRect(), to = mark.getBoundingClientRect();
      const duration = fast ? 260 : 760;
      big.style.transformOrigin = '0 0';
      big.animate([{ transform: 'none' }, { transform: `translate(${to.left - from.left}px, ${to.top - from.top}px) scale(${to.width / from.width})` }],
        { duration, easing: 'cubic-bezier(.7, 0, .2, 1)', fill: 'forwards' });
      intro.querySelector('.fs-intro-word').animate([{ opacity: 1 }, { opacity: 0, transform: 'translateY(-10px)' }], { duration: duration * .5, fill: 'forwards' });
      intro.querySelector('.fs-intro-bg').animate([{ opacity: 1 }, { opacity: 0 }], { duration, delay: duration * .25, easing: 'ease-out', fill: 'forwards' })
        .finished.then(() => {
          delete root.dataset.intro;
          intro.remove();
          mark.classList.add('is-idle');
          drawWave();
        });
    };
    setTimeout(() => finish(false), 1500);
    for (const type of ['pointerdown', 'keydown', 'wheel', 'touchstart']) addEventListener(type, () => finish(true), { once: true, passive: true });
  } else {
    intro?.remove();
    addEventListener('load', () => { play(mark); setTimeout(drawWave, 500); }, { once: true });
  }

  /* --------------------------------------------------- water ripples */
  // The pointer moves like a fingertip on the pool: rings trail it across the whole page and a
  // soft ring rides with it. Never over the measuring image, where the pointer places dots.
  const canvas = document.getElementById('fsRipples');
  const ripples = [];
  let rippleRaf = 0, last = null, rgb = accentRgb();
  const ctx = canvas?.getContext('2d');
  function sizeCanvas() {
    if (!canvas) return;
    const dpr = Math.min(2, devicePixelRatio || 1);
    canvas.width = Math.round(innerWidth * dpr); canvas.height = Math.round(innerHeight * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  function spawn(x, y, size, strength) {
    if (!ctx || reduced.matches || document.hidden) return;
    ripples.push({ x, y, size, strength, start: performance.now() });
    if (ripples.length > 40) ripples.shift();
    if (!rippleRaf) rippleRaf = requestAnimationFrame(drawRipples);
  }
  function drawRipples(now) {
    rippleRaf = 0;
    ctx.clearRect(0, 0, innerWidth, innerHeight);
    for (let i = ripples.length - 1; i >= 0; i--) {
      const r = ripples[i], life = r.size > 60 ? 1500 : 900, u = (now - r.start) / life;
      if (u >= 1) { ripples.splice(i, 1); continue; }
      const e = 1 - Math.pow(1 - u, 3);
      for (const [k, a] of [[1, 1], [.62, .55]]) {
        const radius = Math.max(.1, r.size * e * k);
        ctx.strokeStyle = `rgba(${rgb}, ${(1 - u) * r.strength * a})`;
        ctx.lineWidth = r.size > 60 ? 1.6 : 1.3;
        ctx.beginPath(); ctx.ellipse(r.x, r.y, radius, radius * .5, 0, 0, Math.PI * 2); ctx.stroke();
      }
    }
    if (ripples.length) rippleRaf = requestAnimationFrame(drawRipples);
  }
  if (canvas) {
    sizeCanvas();
    addEventListener('resize', sizeCanvas);
    const precise = e => e.target.closest?.('#canvasWrap');
    addEventListener('pointermove', e => {
      if (e.pointerType !== 'mouse' || precise(e)) return;
      const moved = last ? Math.hypot(e.clientX - last.x, e.clientY - last.y) : Infinity;
      if (moved < 20 && !(moved > 4 && e.timeStamp - last.t > 70)) return;
      last = { x: e.clientX, y: e.clientY, t: e.timeStamp };
      spawn(e.clientX, e.clientY, 34, .5);
    }, { passive: true });
    addEventListener('pointerdown', e => { if (!precise(e)) spawn(e.clientX, e.clientY, 130, .7); }, { passive: true });
    new MutationObserver(() => { rgb = accentRgb(); }).observe(root, { attributes: true, attributeFilter: ['data-theme'] });
  }

  /* ------------------------------------------------------ cursor ring */
  // A soft ring rides with the pointer, swells over anything clickable and dips on press.
  if (fine.matches && !reduced.matches) {
    const ring = document.createElement('div');
    ring.className = 'fs-cursor is-hidden';
    ring.setAttribute('aria-hidden', 'true');
    document.body.append(ring);
    let tx = -100, ty = -100, x = -100, y = -100, ringRaf = 0;
    const follow = () => {
      x += (tx - x) * .28; y += (ty - y) * .28;
      ring.style.translate = `${x.toFixed(1)}px ${y.toFixed(1)}px`;
      ringRaf = Math.abs(tx - x) + Math.abs(ty - y) > .3 ? requestAnimationFrame(follow) : 0;
    };
    addEventListener('pointermove', e => {
      if (e.pointerType !== 'mouse') return;
      tx = e.clientX; ty = e.clientY;
      if (x < -50) { x = tx; y = ty; }
      ring.classList.toggle('is-hidden', !!e.target.closest?.('#canvasWrap'));
      ring.classList.toggle('is-over', !!e.target.closest?.('a, button, summary, label, select, input, [role="slider"], [role="tab"], .stepdot'));
      if (!ringRaf) ringRaf = requestAnimationFrame(follow);
    }, { passive: true });
    addEventListener('pointerdown', () => ring.classList.add('is-down'), { passive: true });
    addEventListener('pointerup', () => ring.classList.remove('is-down'), { passive: true });
    document.documentElement.addEventListener('pointerleave', () => ring.classList.add('is-hidden'));
    reduced.addEventListener('change', ev => { if (ev.matches) ring.remove(); });
  }

  /* --------------------------------------- card glow and magnetic buttons */
  const GLOW = '.card:not(.mark-card), .score-hero, .stat, .seq-node:not(:has(.pose-switch)), .stepdot, .an-lock, .demo-entry';
  const MAGNET = '.hero-primary, .btn-primary, .theme-toggle, .hero-motion';
  let magnet = null;
  const release = () => { if (magnet) { magnet.style.translate = ''; magnet = null; } };
  document.addEventListener('pointermove', e => {
    if (!fine.matches || e.pointerType !== 'mouse') return;
    const glow = e.target.closest?.(GLOW);
    if (glow) {
      const box = glow.getBoundingClientRect();
      glow.classList.add('fx-glow');
      glow.style.setProperty('--mx', `${e.clientX - box.left}px`);
      glow.style.setProperty('--my', `${e.clientY - box.top}px`);
    }
    const target = reduced.matches ? null : e.target.closest?.(MAGNET);
    if (target !== magnet) release();
    if (target && !target.disabled) {
      magnet = target;
      target.classList.add('fx-magnetic');
      const box = target.getBoundingClientRect();
      const dx = clamp((e.clientX - (box.left + box.width / 2)) * .22, -9, 9);
      const dy = clamp((e.clientY - (box.top + box.height / 2)) * .3, -7, 7);
      target.style.translate = `${dx.toFixed(1)}px ${dy.toFixed(1)}px`;
    }
  }, { passive: true });
  document.addEventListener('pointerleave', release);
  document.addEventListener('pointerdown', release);

  /* ------------------------------------------------ 3D position cards */
  // A position card tilts toward the pointer, its picture lifts off the card and a highlight
  // follows the pointer across the illustration.
  let tilted = null;
  const untilt = () => {
    if (!tilted) return;
    tilted.classList.remove('is-tilting');
    for (const name of ['--rx', '--ry', '--gx', '--gy']) tilted.style.removeProperty(name);
    tilted = null;
  };
  document.addEventListener('pointermove', e => {
    if (!fine.matches || reduced.matches || e.pointerType !== 'mouse') return;
    const card = e.target.closest?.('.seq-node');
    if (card !== tilted) untilt();
    if (!card?.querySelector('.pose-switch')) return;
    tilted = card;
    const box = card.getBoundingClientRect();
    const px = clamp((e.clientX - box.left) / box.width, 0, 1), py = clamp((e.clientY - box.top) / box.height, 0, 1);
    card.classList.add('is-tilting');
    card.style.setProperty('--ry', `${((px - .5) * 18).toFixed(2)}deg`);
    card.style.setProperty('--rx', `${((.5 - py) * 14).toFixed(2)}deg`);
    card.style.setProperty('--gx', `${(px * 100).toFixed(1)}%`);
    card.style.setProperty('--gy', `${(py * 100).toFixed(1)}%`);
  }, { passive: true });
  document.addEventListener('pointerleave', untilt);

  /* --------------------------------------------------- results splash */
  // A burst of spray and rings from the score when a complete result arrives.
  let splashed = '';
  document.addEventListener('fs:results', () => {
    if (reduced.matches) return;
    setTimeout(() => {
      const big = document.querySelector('#scoreboard .big');
      if (!big) return;
      const box = big.getBoundingClientRect(), key = big.closest('.score-hero')?.textContent || '';
      if (key === splashed || !box.width) return;
      splashed = key;
      const layer = document.createElement('canvas');
      layer.setAttribute('aria-hidden', 'true');
      Object.assign(layer.style, { position: 'fixed', inset: '0', width: '100vw', height: '100vh', zIndex: '60', pointerEvents: 'none' });
      document.body.append(layer);
      const dpr = Math.min(2, devicePixelRatio || 1), g = layer.getContext('2d');
      layer.width = innerWidth * dpr; layer.height = innerHeight * dpr; g.scale(dpr, dpr);
      const ox = box.left + box.width * .55, oy = box.top + box.height * .55, tint = accentRgb();
      const drops = Array.from({ length: 46 }, () => {
        const a = -Math.PI / 2 + (Math.random() - .5) * 2.3, v = 4 + Math.random() * 7;
        return { x: ox + (Math.random() - .5) * box.width * .6, y: oy, vx: Math.cos(a) * v, vy: Math.sin(a) * v, r: 1.6 + Math.random() * 3.2, gold: Math.random() < .22 };
      });
      const start = performance.now();
      const step = now => {
        const t = (now - start) / 1500;
        g.clearRect(0, 0, innerWidth, innerHeight);
        for (const [k, delay] of [[1, 0], [.7, .12], [.45, .24]]) {
          const u = clamp((t - delay) / .8, 0, 1);
          if (u <= 0 || u >= 1) continue;
          const r = box.width * .75 * k * (1 - Math.pow(1 - u, 3));
          g.strokeStyle = `rgba(${tint}, ${.55 * (1 - u)})`; g.lineWidth = 2;
          g.beginPath(); g.ellipse(ox, oy + box.height * .25, r, r * .3, 0, 0, Math.PI * 2); g.stroke();
        }
        for (const d of drops) {
          d.vy += .28; d.x += d.vx; d.y += d.vy; d.vx *= .99;
          g.fillStyle = d.gold ? `rgba(255, 207, 107, ${1 - t})` : `rgba(${tint}, ${.9 * (1 - t)})`;
          g.beginPath(); g.arc(d.x, d.y, d.r * (1 - t * .4), 0, Math.PI * 2); g.fill();
        }
        if (t < 1) requestAnimationFrame(step); else layer.remove();
      };
      requestAnimationFrame(step);
    }, 380);
  });
})();
