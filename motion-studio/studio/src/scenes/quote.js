// Review / testimonial: stars pop in, the quote writes onto a glass card, the reviewer signs off.
import { textZone, drawHeader, popIn } from './common.js';
import { clamp, ease, seg } from '../engine/util.js';
import { FONTS } from '../engine/brand.js';

export default {
  type: 'quote',
  label: 'Review',
  description: 'A client review with stars, the quote and who said it.',
  defaults: { dur: 5.5, shot: 'push' },
  editable: [
    { key: 'eyebrow', label: 'Small label above', type: 'text' },
    { key: 'headline', label: 'Headline', type: 'text' },
    { key: 'quote', label: 'Quote', type: 'textarea', data: true },
    { key: 'author', label: 'Who said it', type: 'text', data: true },
  ],
  build(ctx) {
    const { scene, group, world, stage, palette } = ctx;
    const portrait = stage.aspect < 0.95;
    const d = scene.data || {};
    const stars = Math.max(0, Math.min(5, Number(d.stars ?? 5)));
    const pw = portrait ? 4.6 : 6, ph = portrait ? 4.2 : 3.4;
    let typed = 0, starK = 0, authorK = 0;
    const panel = world.panel({
      w: pw, h: ph, depth: 0.12, radius: 0.26, res: 1200,
      draw: (c, w, h) => drawQuote(c, w, h, d, { typed, starK, authorK, stars, palette, dark: palette.dark }),
    });
    group.add(panel);
    const accent = world.orb(0.38, 0, world.mats.accent());
    accent.position.set(pw / 2 - 0.2, ph / 2 - 0.1, 0.5);
    group.add(accent);
    const layout = scene.text?.headline ? 'stack' : 'center';

    return {
      shot: { frame: { w: pw + 0.8, h: ph + 0.8 }, layout, pitch: 3, fov: portrait ? 40 : 32 },
      cues: Array.from({ length: stars }, (_, i) => ({ t: 0.7 + i * 0.12, type: 'pop' })),
      update(lt, info) {
        const k = popIn(lt, 0.05, 0.9);
        const out = ease.inCubic(seg(lt, info.dur - 0.45, 0.5));
        panel.position.y = (1 - k) * -2 - out;
        panel.rotation.y = (1 - k) * 0.5 + Math.sin(lt * 0.4) * 0.04;
        panel.userData.setOpacity(clamp(seg(lt, 0, 0.3)) * (1 - out));
        accent.scale.setScalar(Math.max(0.001, ease.outBack(seg(lt, 0.5, 0.6)) * (1 - out)));
        starK = seg(lt, 0.6, 0.8);
        typed = ease.inOutSine(seg(lt, 1.0, Math.max(1, info.dur - 2.6)));
        authorK = ease.outCubic(seg(lt, info.dur - 1.6, 0.6));
        panel.userData.redraw();
      },
      draw(o, lt, info) {
        if (scene.text?.headline || scene.text?.eyebrow) {
          const zone = textZone(o, 'stack');
          zone.layout = 'stack';
          drawHeader(o, zone, scene.text, lt, { dur: info.dur, size: (portrait ? 70 : 64) * o.U, maxLines: 2 });
        }
      },
    };
  },
};

function drawQuote(c, w, h, d, { typed, starK, authorK, stars, palette, dark }) {
  c.fillStyle = dark ? 'rgba(18,18,22,0.4)' : 'rgba(255,255,255,0.55)';
  c.fillRect(0, 0, w, h);
  const pad = w * 0.08;
  // stars
  const ss = w * 0.055;
  for (let i = 0; i < stars; i++) {
    const k = clamp(starK * stars - i);
    if (k <= 0) continue;
    const s = ss * ease.outBack(k);
    const cx = pad + i * ss * 1.3 + ss / 2, cy = pad + ss / 2;
    c.beginPath();
    for (let p = 0; p < 10; p++) {
      const r = p % 2 === 0 ? s / 2 : s / 4.6;
      const a = -Math.PI / 2 + (p * Math.PI) / 5;
      c.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
    }
    c.closePath();
    c.fillStyle = '#E8A33D';
    c.fill();
  }
  // big quote mark
  c.fillStyle = palette.accent;
  c.globalAlpha = 0.9;
  c.font = `800 ${w * 0.16}px ${FONTS.display}`;
  c.textBaseline = 'alphabetic';
  c.fillText('“', w - pad - w * 0.1, pad + w * 0.12);
  c.globalAlpha = 1;
  // quote text, typed on
  const quote = String(d.quote || '');
  const shown = quote.slice(0, Math.ceil(quote.length * typed));
  let size = w * 0.05;
  const maxW = w - pad * 2;
  const wrap = (txt, sz) => {
    c.font = `600 ${sz}px ${FONTS.body}`;
    const words = txt.split(/\s+/); const lines = []; let line = '';
    for (const wd of words) { const t = line ? line + ' ' + wd : wd; if (c.measureText(t).width > maxW && line) { lines.push(line); line = wd; } else line = t; }
    if (line) lines.push(line);
    return lines;
  };
  let full = wrap(quote, size);
  const avail = h - pad * 2 - ss * 1.6 - h * 0.16;
  while (full.length * size * 1.35 > avail && size > w * 0.026) { size *= 0.93; full = wrap(quote, size); }
  const lines = wrap(shown, size);
  c.fillStyle = dark ? '#FFFFFF' : '#111111';
  c.font = `600 ${size}px ${FONTS.body}`;
  lines.forEach((l, i) => c.fillText(l, pad, pad + ss * 1.6 + size * 1.1 + i * size * 1.35));
  // author
  if (d.author) {
    c.globalAlpha = authorK;
    c.fillStyle = palette.accent;
    c.fillRect(pad, h - pad - size * 1.6, w * 0.06, size * 0.12);
    c.fillStyle = dark ? 'rgba(255,255,255,0.8)' : '#4A4E57';
    c.font = `700 ${size * 0.82}px ${FONTS.body}`;
    c.fillText(d.author, pad + w * 0.08, h - pad - size * 1.35);
    c.globalAlpha = 1;
  }
}
