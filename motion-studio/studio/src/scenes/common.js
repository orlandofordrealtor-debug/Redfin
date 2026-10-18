// Shared layout and typography helpers for scenes. Text zones adapt to every format:
// wide = text left / 3D right (split) or text on top (stack); vertical = text on top, 3D below.
import * as THREE from 'three';
import { clamp, ease, seg } from '../engine/util.js';
import { envelope } from '../engine/overlay.js';

/** Returns the text zone for a layout. align 'left' uses x as the left edge, 'center' as center. */
export function textZone(o, layout = 'stack') {
  const s = o.safe;
  if (layout === 'split' && !o.portrait) {
    return { x: s.left, y: s.top + s.h * 0.2, w: s.w * 0.43, h: s.h * 0.6, align: 'left', vcenter: true };
  }
  if (layout === 'stackBottom') {
    const h = o.portrait ? s.h * 0.3 : s.h * 0.3;
    return { x: o.W / 2, y: o.H - s.bottom - h, w: s.w * (o.portrait ? 1 : 0.8), h, align: 'center', bottom: true };
  }
  if (layout === 'center') {
    return { x: o.W / 2, y: s.top + s.h * 0.3, w: s.w * (o.portrait ? 1 : 0.78), h: s.h * 0.4, align: 'center', vcenter: true };
  }
  const top = s.top + (o.portrait ? s.h * 0.075 : s.h * 0.02);
  return { x: o.W / 2, y: top, w: s.w * (o.portrait ? 1 : 0.8), h: s.h * 0.3, align: 'center' };
}

export function headlineSize(o, layout) {
  if (o.portrait) return 92 * o.U;
  if (layout === 'split') return 86 * o.U;
  return 80 * o.U;
}

/**
 * Draws eyebrow chip + headline + subline inside a zone with staggered reveals.
 * Returns the y just below the block.
 */
export function drawHeader(o, zone, text = {}, lt, { inAt = 0.15, dur, out = 0.45, size = null, maxLines = 3, subSize = null, eyebrowStyle = 'chip', mode = 'rise', color, subColor, accentWord } = {}) {
  const { eyebrow, headline, sub } = text;
  const hs = size || headlineSize(o, zone.layout);
  const fit = headline ? o.fit(headline, zone.w, { size: hs, weight: 800, tracking: -0.02 }, maxLines, hs * 0.45) : { size: hs, lines: [] };
  const ss = subSize || Math.max(30 * o.U, fit.size * 0.36);
  const subLines = sub ? o.wrap(sub, Math.min(zone.w, (o.portrait ? 0.92 : 0.7) * o.W), { size: ss, weight: 500, family: 'body' }) : [];
  const eyebrowH = eyebrow ? 26 * o.U * 2.1 + 26 * o.U : 0;
  const blockH = eyebrowH + fit.lines.length * fit.size * 1.04 + (subLines.length ? 24 * o.U + subLines.length * ss * 1.3 : 0);
  let y = zone.vcenter ? zone.y + (zone.h - blockH) / 2 : zone.bottom ? zone.y + zone.h - blockH : zone.y;
  const env = envelope(lt, inAt, 0.9, dur, out);
  const outK = seg(lt, dur - out, out);
  if (eyebrow) {
    const a = clamp(ease.outCubic(seg(lt, inAt, 0.5)) * (1 - ease.inCubic(outK)));
    if (eyebrowStyle === 'chip') o.chip(eyebrow.toUpperCase(), zone.x, y, { align: zone.align, size: 24 * o.U, alpha: a, bg: o.theme.accent, color: '#ffffff' });
    else o.text(eyebrow.toUpperCase(), zone.x, y + 26 * o.U, { size: 26 * o.U, family: 'mono', weight: 700, color: o.theme.accent, tracking: 0.14, align: zone.align, alpha: a });
    y += eyebrowH;
  }
  if (fit.lines.length) {
    const k = seg(lt, inAt + 0.12, 0.9);
    o.textBlock('', zone.x, y + fit.size * 0.86, {
      lines: fit.lines, size: fit.size, weight: 800, tracking: -0.02, align: zone.align, k, out: outK, mode,
      color: color || o.theme.text, lineHeight: 1.04,
    });
    if (accentWord) underlineAccent(o, zone, fit, y, accentWord, k, outK);
    y += fit.lines.length * fit.size * 1.04;
  }
  if (subLines.length) {
    y += 24 * o.U;
    const k = seg(lt, inAt + 0.45, 0.8);
    o.textBlock('', zone.x, y + ss * 0.95, { lines: subLines, size: ss, weight: 500, family: 'body', align: zone.align, k, out: outK, mode: 'fade', color: subColor || o.theme.sub, lineHeight: 1.3 });
    y += subLines.length * ss * 1.3;
  }
  return { bottom: y, env, blockH, size: fit.size };
}

function underlineAccent(o, zone, fit, y, word, k, outK) {
  const lineIdx = fit.lines.findIndex(l => l.includes(word));
  if (lineIdx < 0) return;
  const line = fit.lines[lineIdx];
  const opts = { size: fit.size, weight: 800, tracking: -0.02 };
  const full = o.measure(line, opts);
  const before = o.measure(line.slice(0, line.indexOf(word)), opts);
  const ww = o.measure(word, opts);
  const x0 = zone.align === 'center' ? zone.x - full / 2 + before : zone.x + before;
  const ly = y + fit.size * 0.86 + lineIdx * fit.size * 1.04 + fit.size * 0.14;
  const kk = ease.outCubic(seg(k, 0.6, 0.4));
  o.ctx.save();
  o.ctx.globalAlpha = 1 - outK;
  o.ctx.fillStyle = o.theme.accent;
  o.roundRect(x0, ly, ww * kk, fit.size * 0.09, fit.size * 0.045);
  o.ctx.fill();
  o.ctx.restore();
}

/** Projected label chip pinned to a 3D point. */
export function pinLabel(o, stage, worldPos, label, { alpha = 1, dy = 0, size = 22, bg, color, align = 'center' } = {}) {
  if (!label) return;
  const p = stage.project(worldPos);
  if (!p.visible) return;
  o.chip(label, p.x, p.y + dy * o.U, { align, size: size * o.U, alpha, bg: bg || o.theme.chipBg, color: color || o.theme.chipText });
}

export function worldPos(obj, offset = new THREE.Vector3()) {
  obj.updateWorldMatrix(true, false);
  return offset.clone().applyMatrix4(obj.matrixWorld);
}

/** Standard 3D entrance: rise + scale with overshoot, 0..1. */
export function popIn(lt, start, dur = 0.9) {
  return ease.outBackSoft(seg(lt, start, dur));
}

/** Standard 3D exit near the end of a scene, 1..0. */
export function popOut(lt, sceneDur, dur = 0.45) {
  return 1 - ease.inCubic(seg(lt, sceneDur - dur * 0.6, dur));
}

/** Quadratic Bezier point for arcing fly-ins. */
export function bezier(a, b, c, t, out = new THREE.Vector3()) {
  const u = 1 - t;
  return out.set(
    u * u * a.x + 2 * u * t * b.x + t * t * c.x,
    u * u * a.y + 2 * u * t * b.y + t * t * c.y,
    u * u * a.z + 2 * u * t * b.z + t * t * c.z,
  );
}

export function layoutFor(o_or_aspect, preferred = 'split') {
  const portrait = typeof o_or_aspect === 'number' ? o_or_aspect < 0.95 : o_or_aspect.portrait;
  if (preferred === 'split' && portrait) return 'stack';
  return preferred;
}
