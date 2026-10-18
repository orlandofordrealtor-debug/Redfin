// By the numbers: up to four glass tiles; each number counts up on the tile's live face.
import * as THREE from 'three';
import { textZone, drawHeader, popIn } from './common.js';
import { clamp, ease, seg, parseStat, formatNumber } from '../engine/util.js';
import { FONTS } from '../engine/brand.js';

export default {
  type: 'stats',
  label: 'By the numbers',
  description: 'Up to four numbers that count up on glass tiles.',
  defaults: { dur: 4.5, shot: 'dolly' },
  editable: [
    { key: 'eyebrow', label: 'Small label above', type: 'text' },
    { key: 'headline', label: 'Headline', type: 'text' },
    { key: 'sub', label: 'Supporting line or source', type: 'text' },
  ],
  build(ctx) {
    const { scene, group, world, stage, palette } = ctx;
    const portrait = stage.aspect < 0.95;
    const layout = portrait ? 'stack' : 'stack';
    const stats = (scene.data?.stats || []).filter(s => s && String(s.value ?? '').trim() !== '').slice(0, 4);
    const n = Math.max(1, stats.length);
    const cols = portrait ? (n === 4 ? 2 : 1) : n === 4 ? 2 : n;
    const rows = Math.ceil(n / cols);
    const tw = portrait ? (cols === 1 ? 4.6 : 2.6) : n === 4 ? 3.2 : n === 1 ? 4.4 : 3.1;
    const th = portrait ? (cols === 1 ? 1.75 : 2.4) : 2.2;
    const gap = 0.35;
    const dark = palette.dark;
    const tiles = stats.map((st, i) => {
      const parsed = parseStat(st.value);
      const tile = world.panel({
        w: tw, h: th, depth: 0.12, radius: 0.22, res: 760,
        draw: (c, w, h, k = 0) => drawTile(c, w, h, st, parsed, k, palette, dark, cols === 1 && portrait),
      });
      const col = i % cols, row = Math.floor(i / cols);
      tile.position.set((col - (cols - 1) / 2) * (tw + gap), ((rows - 1) / 2 - row) * (th + gap), 0);
      tile.userData.base = tile.position.clone();
      group.add(tile);
      return tile;
    });

    return {
      shot: { frame: { w: cols * tw + (cols - 1) * gap + 0.8, h: rows * th + (rows - 1) * gap + 0.8 }, layout, pitch: 4, fov: portrait ? 40 : 32 },
      cues: tiles.map((_, i) => ({ t: 0.5 + i * 0.18, type: 'tick' })),
      update(lt, info) {
        const out = ease.inCubic(seg(lt, info.dur - 0.45, 0.5));
        tiles.forEach((t, i) => {
          const k = popIn(lt, 0.15 + i * 0.16, 0.9);
          t.position.copy(t.userData.base);
          t.position.y += (1 - k) * -1.5 - out * 0.8;
          t.position.z += (1 - k) * -2;
          t.rotation.x = (1 - k) * 0.5;
          t.rotation.y = Math.sin(lt * 0.5 + i) * 0.05;
          t.userData.setOpacity(clamp(seg(lt, 0.15 + i * 0.16, 0.3)) * (1 - out));
          const ck = ease.outExpo(seg(lt, 0.45 + i * 0.16, 1.6));
          t.userData.redraw(ck);
        });
      },
      draw(o, lt, info) {
        const zone = textZone(o, layout);
        zone.layout = layout;
        drawHeader(o, zone, scene.text, lt, { dur: info.dur, size: portrait ? 80 * o.U : 72 * o.U, maxLines: 2 });
      },
    };
  },
};

function drawTile(c, w, h, st, parsed, k, palette, dark, wide) {
  const ink = dark ? '#FFFFFF' : '#111111';
  const sub = dark ? 'rgba(255,255,255,0.75)' : '#4A4E57';
  c.fillStyle = dark ? 'rgba(20,20,24,0.35)' : 'rgba(255,255,255,0.45)';
  c.fillRect(0, 0, w, h);
  const value = parsed ? formatNumber(parsed.value * k, { prefix: parsed.prefix, suffix: parsed.suffix, decimals: parsed.decimals }) : String(st.value);
  const pad = w * 0.08;
  c.textBaseline = 'alphabetic';
  if (wide) {
    let size = h * 0.5;
    c.font = `800 ${size}px ${FONTS.display}`;
    while (c.measureText(value).width > w * 0.5 && size > 20) { size *= 0.94; c.font = `800 ${size}px ${FONTS.display}`; }
    c.fillStyle = palette.accent;
    c.fillText(value, pad, h * 0.5 + size * 0.36);
    c.fillStyle = ink;
    drawWrapped(c, st.label || '', pad + w * 0.54, h * 0.5, w * 0.4, h * 0.13, 600, sub);
  } else {
    let size = h * 0.4;
    c.font = `800 ${size}px ${FONTS.display}`;
    while (c.measureText(value).width > w - pad * 2 && size > 20) { size *= 0.94; c.font = `800 ${size}px ${FONTS.display}`; }
    c.fillStyle = palette.accent;
    c.fillText(value, pad, h * 0.52);
    drawWrapped(c, st.label || '', pad, h * 0.66, w - pad * 2, h * 0.105, 600, sub, true);
  }
  c.fillStyle = palette.accent;
  c.fillRect(pad, h * 0.1, w * 0.12 * Math.min(1, k * 1.5), h * 0.025);
}

function drawWrapped(c, text, x, y, maxW, size, weight, color, top = false) {
  c.font = `${weight} ${size}px ${FONTS.body}`;
  c.fillStyle = color;
  const words = String(text).split(/\s+/);
  const lines = [];
  let line = '';
  for (const wd of words) {
    const t = line ? line + ' ' + wd : wd;
    if (c.measureText(t).width > maxW && line) { lines.push(line); line = wd; } else line = t;
  }
  if (line) lines.push(line);
  const lh = size * 1.25;
  const y0 = top ? y + size : y - ((lines.length - 1) * lh) / 2 + size * 0.35;
  lines.slice(0, 3).forEach((l, i) => c.fillText(l, x, y0 + i * lh));
}
