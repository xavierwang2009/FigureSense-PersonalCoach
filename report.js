// report.js
// Draws a one-page report as an image the swimmer can save or send to a coach:
// the score, the five checkpoint frames with their scores, and what to work on.
// The image always uses a white background so it reads the same everywhere.

const W = 1080;          // image width in pixels
const PAD = 48;
const INK = '#10212E', MUTED = '#4F606D', ACCENT = '#0B5FA5', LINE = '#D3DDE4';
const FONT = 'system-ui, "Segoe UI", sans-serif';

// Write text that wraps at maxWidth. Returns the y below the last line.
function wrap(ctx, text, x, y, maxWidth, lineHeight, draw = true) {
  const words = text.split(' ');
  let line = '';
  for (const word of words) {
    const test = line ? line + ' ' + word : word;
    if (ctx.measureText(test).width > maxWidth && line) {
      if (draw) ctx.fillText(line, x, y);
      line = word;
      y += lineHeight;
    } else {
      line = test;
    }
  }
  if (line && draw) ctx.fillText(line, x, y);
  return y + lineHeight;
}

// figure: the figure data; out: the scoreFigure() result;
// swimmer: name text; thumb(id, width) returns a canvas of that checkpoint's frame, or null.
export function drawReport(figure, out, swimmer, thumb) {
  const thumbW = 300;
  const rows = out.results;
  const top = out.issues.slice(0, 3);
  const measure = document.createElement('canvas').getContext('2d');
  const tx = PAD + thumbW + 28;
  const summaries = rows.map(r => r.saved
    ? [...r.rows.filter(m => m.deduction && m.deduction.value > 0).map(m => m.metric.label),
       ...r.missed.map(m => m.text)].join(', ') : '');
  measure.font = `400 20px ${FONT}`;
  const heights = summaries.map(text => Math.max(190,
    wrap(measure, text ? 'Lost points: ' + text : 'All measurements on target', tx, 124, W - PAD - tx, 28, false) + 16));
  measure.font = `400 24px ${FONT}`;
  const issueHeight = top.reduce((sum, issue, i) => sum +
    wrap(measure, `${i + 1}. ${issue.title} (${issue.checkpoint.label}): ${issue.detail}`, PAD, 0, W - 2 * PAD, 32, false) + 6, 0);
  const H = 254 + heights.reduce((sum, h) => sum + h, 0) + 94 + Math.max(40, issueHeight) + 100;

  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, W, H);
  ctx.textBaseline = 'alphabetic';

  // Title
  let y = PAD + 36;
  ctx.fillStyle = INK;
  ctx.font = `700 40px ${FONT}`;
  ctx.fillText('FigureSense · ' + figure.name, PAD, y);
  y += 40;
  ctx.fillStyle = MUTED;
  ctx.font = `400 24px ${FONT}`;
  const date = new Date().toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
  ctx.fillText((swimmer ? swimmer + ' · ' : '') + date, PAD, y);

  // Score
  y += 90;
  ctx.fillStyle = ACCENT;
  ctx.font = `700 84px ${FONT}`;
  const scoreText = out.figureScore.toFixed(2);
  ctx.fillText(scoreText, PAD, y);
  const sw = ctx.measureText(scoreText).width;
  ctx.fillStyle = INK;
  ctx.font = `400 26px ${FONT}`;
  ctx.fillText(`figure score out of ${(10 * figure.dd).toFixed(0)}`, PAD + sw + 24, y - 34);
  ctx.fillStyle = MUTED;
  ctx.font = `400 22px ${FONT}`;
  const saved = rows.filter(r => r.saved).length;
  ctx.fillText(out.provisional ? `Provisional: ${saved} of ${rows.length} checkpoints saved` : 'All checkpoints saved',
    PAD + sw + 24, y);

  // Checkpoints
  y += 40;
  for (const [index, r] of rows.entries()) {
    ctx.strokeStyle = LINE;
    ctx.beginPath(); ctx.moveTo(PAD, y); ctx.lineTo(W - PAD, y); ctx.stroke();
    const t = r.saved ? thumb(r.checkpoint.id, thumbW) : null;
    if (t) {
      const scale = Math.min(thumbW / t.width, 170 / t.height);
      const width = t.width * scale, height = t.height * scale;
      ctx.drawImage(t, PAD + (thumbW - width) / 2, y + 10, width, height);
    } else {
      ctx.fillStyle = '#EAF0F4';
      ctx.fillRect(PAD, y + 10, thumbW, 170);
    }
    const tx = PAD + thumbW + 28;
    ctx.fillStyle = INK;
    ctx.font = `700 28px ${FONT}`;
    ctx.fillText(r.checkpoint.label, tx, y + 50);
    ctx.font = `400 24px ${FONT}`;
    ctx.fillStyle = r.saved ? INK : MUTED;
    ctx.fillText(r.saved ? `${r.score.toFixed(1)} / 10` + (r.checkpoint.weight ? '' : '  (reference, not scored)') : 'Not saved',
      tx, y + 88);
    if (r.saved) {
      ctx.fillStyle = MUTED;
      ctx.font = `400 20px ${FONT}`;
      const lost = summaries[index];
      wrap(ctx, lost.length ? 'Lost points: ' + lost : 'All measurements on target', tx, y + 124, W - PAD - tx, 28);
    }
    y += heights[index];
  }

  // What to work on
  ctx.strokeStyle = LINE;
  ctx.beginPath(); ctx.moveTo(PAD, y); ctx.lineTo(W - PAD, y); ctx.stroke();
  y += 50;
  ctx.fillStyle = INK;
  ctx.font = `700 30px ${FONT}`;
  ctx.fillText('What to work on', PAD, y);
  y += 44;
  ctx.font = `400 24px ${FONT}`;
  if (!top.length) {
    ctx.fillStyle = MUTED;
    ctx.fillText('Nothing lost points in the saved checkpoints.', PAD, y);
    y += 40;
  }
  top.forEach((issue, i) => {
    ctx.fillStyle = INK;
    y = wrap(ctx, `${i + 1}. ${issue.title} (${issue.checkpoint.label}): ${issue.detail}`, PAD, y, W - 2 * PAD, 32) + 6;
  });

  // Footer
  ctx.fillStyle = MUTED;
  ctx.font = `400 20px ${FONT}`;
  ctx.fillText('Practice estimate from a 2D video, not official judging.', PAD, H - PAD);
  return c;
}
