// Steps / checklist / agenda: items slide in on a glass panel and tick off one by one with an
// animated check and strikethrough (or numbered steps light up in sequence).
import { textZone, drawHeader, popIn } from './common.js';
import { clamp, ease, seg } from '../engine/util.js';
import { FONTS } from '../engine/brand.js';

export default {
  type: 'list',
  label: 'Steps or checklist',
  description: 'A list that ticks off item by item: steps, agenda, checklist, tips.',
  defaults: { dur: 5.5, shot: 'push' },
  editable: [
    { key: 'eyebrow', label: 'Small label above', type: 'text' },
    { key: 'headline', label: 'Headline', type: 'text' },
    { key: 'sub', label: 'Supporting line', type: 'text' },
  ],
  build(ctx) {
    const { scene, group, world, stage, palette } = ctx;
    const portrait = stage.aspect < 0.95;
    const d = scene.data || {};
    const items = (d.items || []).map(i => (typeof i === 'string' ? { text: i } : i)).filter(i => i.text).slice(0, 7);
    const mode = d.mode || 'check'; // check | steps | agenda
    const strike = d.strike ?? mode === 'check';
    const pw = portrait ? 4.6 : 5.6;
    const rowH = 0.62;
    const ph = Math.max(2.2, items.length * rowH + 0.9);
    const dark = palette.dark;
    let progress = new Array(items.length).fill(0);
    let ticks = new Array(items.length).fill(0);
    const panel = world.panel({
      w: pw, h: ph, depth: 0.12, radius: 0.24, res: 1100,
      draw: (c, w, h) => drawList(c, w, h, items, progress, ticks, { mode, strike, palette, dark }),
    });
    group.add(panel);
    const layout = portrait ? 'stack' : 'split';
    const itemStart = 0.8;
    const span = Math.max(0.4, (scene.dur - itemStart - 1.2) / Math.max(1, items.length));

    return {
      shot: { frame: { w: pw + 0.8, h: ph + 0.8 }, layout, pitch: 4, fov: portrait ? 40 : 32 },
      cues: items.map((_, i) => ({ t: itemStart + i * span + span * 0.55, type: 'tick' })),
      update(lt, info) {
        const k = popIn(lt, 0.05, 0.9);
        const out = ease.inCubic(seg(lt, info.dur - 0.45, 0.5));
        panel.position.y = (1 - k) * -2 - out * 0.8;
        panel.rotation.y = (1 - k) * (portrait ? 0.3 : -0.5) + (portrait ? 0 : -0.14) + Math.sin(lt * 0.5) * 0.03;
        panel.rotation.x = (1 - k) * 0.4;
        panel.userData.setOpacity(clamp(seg(lt, 0, 0.3)) * (1 - out));
        progress = items.map((_, i) => ease.outCubic(seg(lt, itemStart + i * span * 0.6, 0.6)));
        ticks = items.map((_, i) => ease.outCubic(seg(lt, itemStart + i * span + span * 0.45, 0.45)));
        panel.userData.redraw();
      },
      draw(o, lt, info) {
        const zone = textZone(o, layout);
        zone.layout = layout;
        drawHeader(o, zone, scene.text, lt, { dur: info.dur, size: (portrait ? 78 : 76) * o.U, maxLines: 3 });
      },
    };
  },
};

function drawList(c, w, h, items, progress, ticks, { mode, strike, palette, dark }) {
  c.fillStyle = dark ? 'rgba(18,18,22,0.4)' : 'rgba(255,255,255,0.5)';
  c.fillRect(0, 0, w, h);
  const pad = w * 0.07;
  const rowH = (h - pad * 1.4) / Math.max(1, items.length);
  const ink = dark ? '#FFFFFF' : '#111111';
  const sub = dark ? 'rgba(255,255,255,0.55)' : 'rgba(17,17,17,0.45)';
  const size = Math.min(rowH * 0.36, w * 0.045);
  items.forEach((it, i) => {
    const p = progress[i], tk = ticks[i];
    if (p <= 0) return;
    const y = pad * 0.7 + i * rowH + rowH / 2;
    const x = pad + (1 - p) * w * 0.08;
    c.globalAlpha = p;
    const r = size * 0.72;
    // marker
    c.beginPath();
    c.arc(x + r, y, r, 0, Math.PI * 2);
    if (mode === 'steps' || mode === 'agenda') {
      c.fillStyle = tk > 0.5 ? palette.accent : (dark ? 'rgba(255,255,255,0.12)' : 'rgba(17,17,17,0.08)');
      c.fill();
      c.fillStyle = tk > 0.5 ? '#FFFFFF' : ink;
      c.font = `800 ${size * 0.8}px ${FONTS.display}`;
      c.textAlign = 'center'; c.textBaseline = 'middle';
      c.fillText(String(i + 1), x + r, y + size * 0.04);
    } else {
      c.lineWidth = size * 0.1;
      c.strokeStyle = tk > 0 ? palette.accent : sub;
      c.stroke();
      if (tk > 0) {
        c.fillStyle = palette.accent;
        c.globalAlpha = p * tk;
        c.fill();
        c.globalAlpha = p;
        c.strokeStyle = '#FFFFFF';
        c.lineWidth = size * 0.12;
        c.lineCap = 'round'; c.lineJoin = 'round';
        c.beginPath();
        const ck = Math.min(1, tk * 1.4);
        const p1 = [x + r * 0.5, y + r * 0.02], p2 = [x + r * 0.88, y + r * 0.38], p3 = [x + r * 1.5, y - r * 0.38];
        c.moveTo(...p1);
        if (ck < 0.4) c.lineTo(p1[0] + (p2[0] - p1[0]) * (ck / 0.4), p1[1] + (p2[1] - p1[1]) * (ck / 0.4));
        else { c.lineTo(...p2); const k2 = (ck - 0.4) / 0.6; c.lineTo(p2[0] + (p3[0] - p2[0]) * k2, p2[1] + (p3[1] - p2[1]) * k2); }
        c.stroke();
      }
    }
    // text
    const tx = x + r * 2 + size * 0.7;
    c.textAlign = 'left'; c.textBaseline = 'middle';
    c.font = `700 ${size}px ${FONTS.body}`;
    let text = it.text;
    while (c.measureText(text).width > w - tx - pad && text.length > 4) text = text.slice(0, -2);
    if (text !== it.text) text = text.trimEnd() + '…';
    const done = strike && tk > 0;
    c.fillStyle = done ? sub : ink;
    c.fillText(text, tx, y - (it.note ? size * 0.35 : 0));
    if (it.note) {
      c.font = `500 ${size * 0.68}px ${FONTS.body}`;
      c.fillStyle = sub;
      c.fillText(it.note, tx, y + size * 0.62);
    }
    if (done) {
      c.font = `700 ${size}px ${FONTS.body}`;
      const tw = c.measureText(text).width;
      c.strokeStyle = palette.accent;
      c.lineWidth = size * 0.08;
      c.beginPath();
      c.moveTo(tx, y - (it.note ? size * 0.35 : 0));
      c.lineTo(tx + tw * tk, y - (it.note ? size * 0.35 : 0));
      c.stroke();
    }
    if (i < items.length - 1) {
      c.globalAlpha = p * 0.6;
      c.fillStyle = dark ? 'rgba(255,255,255,0.08)' : 'rgba(17,17,17,0.06)';
      c.fillRect(tx, y + rowH / 2 - 1, w - tx - pad, 2);
    }
    c.globalAlpha = 1;
  });
}
