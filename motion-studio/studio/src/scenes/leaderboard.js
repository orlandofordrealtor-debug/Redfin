// Leaderboard: ranked bars race to their values on a glass board. Names can be anonymized
// for social posts (privacy setting) while staying real for internal videos.
import { textZone, drawHeader, popIn } from './common.js';
import { clamp, ease, seg, parseStat, formatNumber } from '../engine/util.js';
import { FONTS } from '../engine/brand.js';

export default {
  type: 'leaderboard',
  label: 'Leaderboard',
  description: 'Ranked bars that race to their values. Names anonymize for social.',
  defaults: { dur: 6, shot: 'push' },
  editable: [
    { key: 'eyebrow', label: 'Small label above', type: 'text' },
    { key: 'headline', label: 'Headline', type: 'text' },
    { key: 'sub', label: 'Supporting line or source', type: 'text' },
  ],
  build(ctx) {
    const { scene, group, world, stage, palette } = ctx;
    const portrait = stage.aspect < 0.95;
    const d = scene.data || {};
    const anon = d.anonymize;
    const rows = (d.rows || []).map((r, i) => ({ name: anon ? anonName(r.name, i) : r.name, raw: r.value, p: parseStat(r.value), note: r.note }))
      .filter(r => r.p).sort((a, b) => b.p.value - a.p.value).slice(0, 8);
    const max = Math.max(1e-6, ...rows.map(r => r.p.value));
    const pw = portrait ? 4.7 : 6.4;
    const ph = Math.max(2.4, rows.length * 0.56 + 0.8);
    let k = 0;
    const panel = world.panel({
      w: pw, h: ph, depth: 0.12, radius: 0.24, res: 1200,
      draw: (c, w, h) => drawBoard(c, w, h, rows, max, k, palette, palette.dark),
    });
    group.add(panel);
    const layout = portrait ? 'stack' : 'split';
    return {
      shot: { frame: { w: pw + 0.8, h: ph + 0.8 }, layout, pitch: 4, fov: portrait ? 40 : 32 },
      cues: rows.map((_, i) => ({ t: 0.7 + i * 0.1, type: 'tick' })),
      update(lt, info) {
        const pk = popIn(lt, 0.05, 0.9);
        const out = ease.inCubic(seg(lt, info.dur - 0.45, 0.5));
        panel.position.y = (1 - pk) * -2 - out;
        panel.rotation.y = (1 - pk) * -0.5 + (portrait ? 0 : -0.12);
        panel.userData.setOpacity(clamp(seg(lt, 0, 0.3)) * (1 - out));
        k = seg(lt, 0.6, 2.2);
        panel.userData.redraw();
      },
      draw(o, lt, info) {
        const zone = textZone(o, layout);
        zone.layout = layout;
        drawHeader(o, zone, scene.text, lt, { dur: info.dur, size: (portrait ? 74 : 72) * o.U, maxLines: 3 });
      },
    };
  },
};

function anonName(name, i) {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return `Agent ${i + 1}`;
  return parts.map(p => p[0].toUpperCase() + '.').join(' ');
}

function drawBoard(c, w, h, rows, max, k, palette, dark) {
  c.fillStyle = dark ? 'rgba(18,18,22,0.4)' : 'rgba(255,255,255,0.55)';
  c.fillRect(0, 0, w, h);
  const pad = w * 0.06;
  const rowH = (h - pad * 1.5) / Math.max(1, rows.length);
  const size = Math.min(rowH * 0.34, w * 0.04);
  const nameW = w * 0.3;
  const barX = pad + size * 2.2 + nameW;
  const barW = w - barX - pad - size * 4.2;
  rows.forEach((r, i) => {
    const kk = ease.outCubic(clamp((k - i * 0.07) / 0.75));
    const y = pad * 0.75 + i * rowH + rowH / 2;
    c.globalAlpha = clamp(kk * 3);
    c.font = `800 ${size}px ${FONTS.display}`;
    c.textBaseline = 'middle'; c.textAlign = 'left';
    c.fillStyle = i === 0 ? palette.accent : (dark ? 'rgba(255,255,255,0.5)' : 'rgba(17,17,17,0.4)');
    c.fillText(String(i + 1), pad, y);
    c.font = `700 ${size}px ${FONTS.body}`;
    c.fillStyle = dark ? '#FFFFFF' : '#111111';
    let name = r.name || '';
    while (c.measureText(name).width > nameW && name.length > 3) name = name.slice(0, -2);
    c.fillText(name !== r.name ? name + '…' : name, pad + size * 1.8, y);
    // track
    c.fillStyle = dark ? 'rgba(255,255,255,0.08)' : 'rgba(17,17,17,0.06)';
    roundRect(c, barX, y - rowH * 0.2, barW, rowH * 0.4, rowH * 0.2); c.fill();
    c.fillStyle = i === 0 ? palette.accent : (dark ? 'rgba(255,255,255,0.75)' : '#2A2B30');
    roundRect(c, barX, y - rowH * 0.2, Math.max(rowH * 0.4, barW * (r.p.value / max) * kk), rowH * 0.4, rowH * 0.2); c.fill();
    c.font = `800 ${size}px ${FONTS.display}`;
    c.textAlign = 'right';
    c.fillStyle = dark ? '#FFFFFF' : '#111111';
    c.fillText(formatNumber(r.p.value * kk, { prefix: r.p.prefix, suffix: r.p.suffix, decimals: r.p.decimals }), w - pad, y);
    c.globalAlpha = 1;
  });
}

function roundRect(c, x, y, w, h, r) {
  const rr = Math.min(r, w / 2, h / 2);
  c.beginPath();
  c.moveTo(x + rr, y); c.arcTo(x + w, y, x + w, y + h, rr); c.arcTo(x + w, y + h, x, y + h, rr);
  c.arcTo(x, y + h, x, y, rr); c.arcTo(x, y, x + w, y, rr); c.closePath();
}
