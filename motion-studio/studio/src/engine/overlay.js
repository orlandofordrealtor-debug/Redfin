// 2D typography and UI layer, drawn every frame in design units and composited after tone mapping.
import { FONTS } from './brand.js';
import { clamp, ease, seg, rgba, lerp } from './util.js';

const DEFAULT_THEME = {
  text: '#111111', sub: '#5D626B', accent: '#DE3341', accentText: '#FFFFFF',
  scrim: '#FFFFFF', scrimAlpha: 0.0, chipBg: '#111111', chipText: '#FFFFFF',
  shadow: 'rgba(0,0,0,0)', panel: 'rgba(255,255,255,0.82)', panelStroke: 'rgba(255,255,255,0.9)',
  mono: '#5D626B', logo: 'tagline', dark: false,
  displayFamily: null, displayWeight: null, displayStyle: null,
};

export class Overlay {
  constructor(stage) {
    this.stage = stage;
    this.theme = { ...DEFAULT_THEME };
  }

  /** Replaces the theme (starting from defaults) so nothing leaks from the previous look. */
  setTheme(t) { this.theme = { ...DEFAULT_THEME, ...t }; }

  begin() {
    this.ctx = this.stage.beginOverlay();
    const { width: W, height: H } = this.stage;
    this.W = W; this.H = H;
    this.U = Math.min(W, H) / 1080;          // 1 unit = 1px at 1080 short side
    this.portrait = H > W * 1.05;
    this.square = Math.abs(W - H) / H < 0.3 && !this.portrait;
    const portraitTall = H / W > 1.6;
    // Safe areas leave room for social app chrome on vertical formats
    this.safe = portraitTall
      ? { top: H * 0.085, bottom: H * 0.135, left: W * 0.075, right: W * 0.075 }
      : { top: H * 0.075, bottom: H * 0.08, left: W * 0.06, right: W * 0.06 };
    this.safe.w = W - this.safe.left - this.safe.right;
    this.safe.h = H - this.safe.top - this.safe.bottom;
    return this.ctx;
  }

  font(size, weight = 700, family = 'display', style = 'normal') {
    // A look can swap the headline face (e.g. serif for Luxury) via theme.displayFamily
    if (family === 'display' && this.theme?.displayFamily) {
      family = this.theme.displayFamily;
      if (this.theme.displayWeight) weight = this.theme.displayWeight;
      if (this.theme.displayStyle) style = this.theme.displayStyle;
    }
    const fam = FONTS[family] || family;
    return `${style} ${weight} ${Math.round(size * 10) / 10}px ${fam}`;
  }

  setTracking(px) {
    if ('letterSpacing' in this.ctx) this.ctx.letterSpacing = `${px}px`;
  }

  measure(str, o = {}) {
    const c = this.ctx;
    c.font = this.font(o.size || 40, o.weight || 700, o.family || 'display', o.style);
    this.setTracking((o.tracking || 0) * (o.size || 40));
    const w = c.measureText(str).width;
    this.setTracking(0);
    return w;
  }

  wrap(str, maxWidth, o = {}) {
    const words = String(str ?? '').split(/\s+/).filter(Boolean);
    const lines = [];
    let line = '';
    for (const w of words) {
      const test = line ? line + ' ' + w : w;
      if (this.measure(test, o) > maxWidth && line) { lines.push(line); line = w; }
      else line = test;
    }
    if (line) lines.push(line);
    // explicit line breaks
    return lines.flatMap(l => l.split('\n'));
  }

  /** Shrinks the size until the text fits in maxLines within maxWidth, then balances the lines. */
  fit(str, maxWidth, o = {}, maxLines = 2, minSize = 18) {
    let size = o.size || 80;
    let lines = this.wrap(str, maxWidth, { ...o, size });
    while ((lines.length > maxLines || lines.some(l => this.measure(l, { ...o, size }) > maxWidth)) && size > minSize) {
      size *= 0.94;
      lines = this.wrap(str, maxWidth, { ...o, size });
    }
    return { size, lines: this.balance(str, lines, maxWidth, { ...o, size }) };
  }

  /** Like CSS text-wrap: balance. Narrows the wrap width while the line count holds. */
  balance(str, lines, maxWidth, o) {
    if (lines.length < 2 || String(str).includes('\n')) return lines;
    let lo = maxWidth * 0.4, hi = maxWidth, best = lines;
    for (let i = 0; i < 12; i++) {
      const mid = (lo + hi) / 2;
      const l = this.wrap(str, mid, o);
      if (l.length === lines.length && !l.some(x => this.measure(x, o) > mid + 0.5)) { best = l; hi = mid; } else lo = mid;
    }
    return best;
  }

  text(str, x, y, o = {}) {
    const c = this.ctx;
    const size = o.size || 40;
    c.save();
    c.globalAlpha = clamp(o.alpha ?? 1);
    c.font = this.font(size, o.weight || 700, o.family || 'display', o.style);
    this.setTracking((o.tracking || 0) * size);
    c.textAlign = o.align || 'left';
    c.textBaseline = o.baseline || 'alphabetic';
    if (o.shadow) { c.shadowColor = o.shadow; c.shadowBlur = o.shadowBlur ?? size * 0.35; c.shadowOffsetY = o.shadowY ?? size * 0.06; }
    if (o.gradient) {
      const w = this.measure(str, o);
      const x0 = o.align === 'center' ? x - w / 2 : o.align === 'right' ? x - w : x;
      const g = c.createLinearGradient(x0, y - size, x0 + w, y);
      o.gradient.forEach(([stop, col]) => g.addColorStop(stop, col));
      c.fillStyle = g;
    } else c.fillStyle = o.color || this.theme.text;
    c.fillText(str, x, y);
    if (o.stroke) { c.lineWidth = o.strokeWidth || 2; c.strokeStyle = o.stroke; c.strokeText(str, x, y); }
    this.setTracking(0);
    c.restore();
  }

  /**
   * Multi-line text with a reveal animation. k is 0..1 reveal progress.
   * modes: rise (lines slide up from a mask), words (word by word), type (characters), fade.
   * Returns the block height.
   */
  textBlock(str, x, y, o = {}) {
    const size = o.size || 60;
    const lh = (o.lineHeight || 1.08) * size;
    const lines = o.lines || this.wrap(str, o.maxWidth || this.W, o);
    const k = o.k ?? 1;
    const mode = o.mode || 'rise';
    const out = o.out ?? 0;             // 0..1 exit progress
    const c = this.ctx;
    const n = lines.length;
    lines.forEach((line, i) => {
      const ly = y + i * lh;
      const stagger = o.stagger ?? 0.18;
      const span = Math.max(0.0001, 1 - stagger * (n - 1));
      const lk = clamp((k - i * stagger) / span);
      const ok = clamp((out - (n - 1 - i) * 0.08) / 0.7);
      if (lk <= 0) return;
      if (mode === 'type') {
        const chars = Math.floor(line.length * lk);
        this.text(line.slice(0, chars), x, ly, { ...o, size, alpha: (o.alpha ?? 1) * (1 - ok) });
        return;
      }
      if (mode === 'words') {
        const words = line.split(' ');
        let cx = x;
        const full = this.measure(line, { ...o, size });
        if (o.align === 'center') cx = x - full / 2; else if (o.align === 'right') cx = x - full;
        words.forEach((w, wi) => {
          const wk = ease.outCubic(clamp(lk * (words.length + 2) / 3 - wi * 0.33));
          const ww = this.measure(w + ' ', { ...o, size });
          this.text(w, cx, ly + (1 - wk) * size * 0.35, { ...o, size, align: 'left', alpha: wk * (o.alpha ?? 1) * (1 - ok) });
          cx += ww;
        });
        return;
      }
      const e = ease.outCubic(lk);
      const eo = ease.inCubic(ok);
      if (mode === 'fade') {
        this.text(line, x, ly, { ...o, size, alpha: e * (1 - eo) * (o.alpha ?? 1) });
        return;
      }
      // rise: each line slides up out of its own mask
      c.save();
      const w = this.measure(line, { ...o, size }) + size;
      const x0 = o.align === 'center' ? x - w / 2 : o.align === 'right' ? x - w : x - size * 0.2;
      c.beginPath();
      c.rect(x0, ly - size * 1.05, w + size * 0.4, lh + size * 0.12);
      c.clip();
      this.text(line, x, ly + (1 - e) * lh * 0.9 - eo * lh * 0.9, { ...o, size, alpha: (o.alpha ?? 1) * (0.25 + 0.75 * e) * (1 - eo) });
      c.restore();
    });
    return n * lh;
  }

  roundRect(x, y, w, h, r) {
    const c = this.ctx;
    const rr = Math.min(r, w / 2, h / 2);
    c.beginPath();
    c.moveTo(x + rr, y);
    c.arcTo(x + w, y, x + w, y + h, rr);
    c.arcTo(x + w, y + h, x, y + h, rr);
    c.arcTo(x, y + h, x, y, rr);
    c.arcTo(x, y, x + w, y, rr);
    c.closePath();
  }

  panel(x, y, w, h, o = {}) {
    const c = this.ctx;
    c.save();
    c.globalAlpha = clamp(o.alpha ?? 1);
    if (o.shadow !== false) {
      c.shadowColor = o.shadowColor || 'rgba(17,17,17,0.18)';
      c.shadowBlur = o.shadowBlur ?? 40 * this.U;
      c.shadowOffsetY = o.shadowY ?? 14 * this.U;
    }
    this.roundRect(x, y, w, h, o.r ?? 28 * this.U);
    c.fillStyle = o.fill || this.theme.panel;
    c.fill();
    c.shadowColor = 'transparent';
    if (o.stroke !== false) {
      c.lineWidth = o.lineWidth || 1.5 * this.U;
      c.strokeStyle = o.stroke || this.theme.panelStroke;
      c.stroke();
    }
    c.restore();
  }

  /** Soft light or dark wash behind text so it stays readable over 3D. */
  scrim(x, y, w, h, o = {}) {
    const a = (o.alpha ?? this.theme.scrimAlpha);
    if (a <= 0.001) return;
    const c = this.ctx;
    c.save();
    const cx = x + w / 2, cy = y + h / 2;
    const r = Math.max(w, h) * 0.75;
    const g = c.createRadialGradient(cx, cy, 0, cx, cy, r);
    const col = o.color || this.theme.scrim;
    g.addColorStop(0, rgba(col, a));
    g.addColorStop(0.55, rgba(col, a * 0.75));
    g.addColorStop(1, rgba(col, 0));
    c.fillStyle = g;
    c.fillRect(x - w * 0.3, y - h * 0.5, w * 1.6, h * 2);
    c.restore();
  }

  /** Full-width top or bottom gradient band. */
  band(edge = 'top', size = 0.3, o = {}) {
    const a = o.alpha ?? this.theme.scrimAlpha;
    if (a <= 0.001) return;
    const c = this.ctx;
    const h = this.H * size;
    const y0 = edge === 'top' ? 0 : this.H - h;
    const g = c.createLinearGradient(0, edge === 'top' ? 0 : this.H, 0, edge === 'top' ? h : this.H - h);
    const col = o.color || this.theme.scrim;
    g.addColorStop(0, rgba(col, a));
    g.addColorStop(1, rgba(col, 0));
    c.save();
    c.fillStyle = g;
    c.fillRect(0, y0, this.W, h);
    c.restore();
  }

  chip(label, x, y, o = {}) {
    const size = o.size || 26 * this.U;
    const padX = o.padX ?? size * 0.75;
    const padY = o.padY ?? size * 0.45;
    const w = this.measure(label, { size, weight: o.weight || 700, family: o.family || 'mono', tracking: o.tracking ?? 0.08 }) + padX * 2;
    const h = size + padY * 2;
    const x0 = o.align === 'center' ? x - w / 2 : o.align === 'right' ? x - w : x;
    const c = this.ctx;
    c.save();
    c.globalAlpha = clamp(o.alpha ?? 1);
    this.roundRect(x0, y, w, h, o.r ?? h / 2);
    c.fillStyle = o.bg || this.theme.chipBg;
    c.fill();
    if (o.stroke) { c.lineWidth = 1.5 * this.U; c.strokeStyle = o.stroke; c.stroke(); }
    c.restore();
    this.text(label, x0 + w / 2, y + h / 2 + size * 0.36, {
      size, weight: o.weight || 700, family: o.family || 'mono', color: o.color || this.theme.chipText,
      align: 'center', tracking: o.tracking ?? 0.08, alpha: o.alpha ?? 1,
    });
    return { w, h, x: x0 };
  }

  /** Draws an image cover-cropped into a rounded rect. */
  image(img, x, y, w, h, o = {}) {
    if (!img) return;
    const c = this.ctx;
    const iw = img.naturalWidth || img.videoWidth || img.width;
    const ih = img.naturalHeight || img.videoHeight || img.height;
    if (!iw || !ih) return;
    const s = Math.max(w / iw, h / ih) * (o.zoom || 1);
    const dw = iw * s, dh = ih * s;
    const fx = o.focusX ?? 0.5, fy = o.focusY ?? 0.4;
    const dx = x + (w - dw) * fx, dy = y + (h - dh) * fy;
    c.save();
    c.globalAlpha = clamp(o.alpha ?? 1);
    if (o.shadow) { c.shadowColor = o.shadow; c.shadowBlur = 40 * this.U; c.shadowOffsetY = 16 * this.U; }
    this.roundRect(x, y, w, h, o.r ?? 0);
    if (o.shadow) { c.fillStyle = '#000'; c.fill(); c.shadowColor = 'transparent'; }
    c.clip();
    c.drawImage(img, dx, dy, dw, dh);
    c.restore();
    if (o.stroke) {
      c.save(); c.globalAlpha = clamp(o.alpha ?? 1);
      this.roundRect(x, y, w, h, o.r ?? 0); c.lineWidth = o.strokeWidth || 3 * this.U; c.strokeStyle = o.stroke; c.stroke();
      c.restore();
    }
  }

  /** Draws a circular portrait with an optional ring. */
  avatar(img, cx, cy, r, o = {}) {
    const c = this.ctx;
    c.save();
    c.globalAlpha = clamp(o.alpha ?? 1);
    if (o.ring) {
      c.beginPath(); c.arc(cx, cy, r + (o.ringGap ?? 8 * this.U) + (o.ringWidth ?? 6 * this.U) / 2, 0, Math.PI * 2);
      c.lineWidth = o.ringWidth ?? 6 * this.U; c.strokeStyle = o.ring; c.stroke();
    }
    c.beginPath(); c.arc(cx, cy, r, 0, Math.PI * 2); c.clip();
    if (img) {
      const iw = img.naturalWidth || img.width, ih = img.naturalHeight || img.height;
      const s = Math.max((2 * r) / iw, (2 * r) / ih);
      c.drawImage(img, cx - (iw * s) / 2, cy - r - (ih * s - 2 * r) * (o.focusY ?? 0.25), iw * s, ih * s);
    }
    c.restore();
  }

  logo(img, x, y, w, o = {}) {
    if (!img) return 0;
    const iw = img.naturalWidth || img.width || 300, ih = img.naturalHeight || img.height || 100;
    const h = w * (ih / iw);
    const x0 = o.align === 'center' ? x - w / 2 : o.align === 'right' ? x - w : x;
    const c = this.ctx;
    c.save();
    c.globalAlpha = clamp(o.alpha ?? 1);
    c.drawImage(img, x0, y, w, h);
    c.restore();
    return h;
  }

  /** QR code from a qrcode-generator instance. */
  qr(qr, x, y, size, o = {}) {
    if (!qr) return;
    const c = this.ctx;
    const n = qr.getModuleCount();
    const quiet = o.quiet ?? 2;
    const cell = size / (n + quiet * 2);
    c.save();
    c.globalAlpha = clamp(o.alpha ?? 1);
    this.roundRect(x, y, size, size, o.r ?? 18 * this.U);
    c.fillStyle = o.light || '#FFFFFF';
    c.fill();
    c.fillStyle = o.dark || '#111111';
    const reveal = o.k ?? 1;
    for (let r = 0; r < n; r++) {
      for (let col = 0; col < n; col++) {
        if (!qr.isDark(r, col)) continue;
        // diagonal sweep reveal
        const d = (r + col) / (2 * n);
        if (d > reveal * 1.05) continue;
        c.fillRect(x + (col + quiet) * cell, y + (r + quiet) * cell, Math.ceil(cell), Math.ceil(cell));
      }
    }
    c.restore();
  }

  /** Equal Housing Opportunity mark: house outline with an equal sign. */
  eho(x, y, size, o = {}) {
    const c = this.ctx;
    const col = o.color || this.theme.text;
    c.save();
    c.globalAlpha = clamp(o.alpha ?? 1);
    c.strokeStyle = col; c.fillStyle = col;
    c.lineWidth = size * 0.07;
    c.lineJoin = 'miter';
    const w = size, h = size;
    c.beginPath();
    c.moveTo(x + w * 0.5, y + h * 0.06);
    c.lineTo(x + w * 0.96, y + h * 0.42);
    c.lineTo(x + w * 0.84, y + h * 0.42);
    c.lineTo(x + w * 0.84, y + h * 0.94);
    c.lineTo(x + w * 0.16, y + h * 0.94);
    c.lineTo(x + w * 0.16, y + h * 0.42);
    c.lineTo(x + w * 0.04, y + h * 0.42);
    c.closePath();
    c.stroke();
    c.fillRect(x + w * 0.32, y + h * 0.53, w * 0.36, h * 0.09);
    c.fillRect(x + w * 0.32, y + h * 0.70, w * 0.36, h * 0.09);
    c.restore();
    if (o.label !== false) {
      this.text('EQUAL HOUSING', x + w + size * 0.25, y + h * 0.45, { size: size * 0.28, weight: 700, family: 'body', color: col, alpha: o.alpha, tracking: 0.04 });
      this.text('OPPORTUNITY', x + w + size * 0.25, y + h * 0.82, { size: size * 0.28, weight: 700, family: 'body', color: col, alpha: o.alpha, tracking: 0.04 });
    }
  }

  stars(count, x, y, size, o = {}) {
    const c = this.ctx;
    for (let i = 0; i < count; i++) {
      const k = clamp((o.k ?? 1) * count - i);
      if (k <= 0) continue;
      const s = size * ease.outBack(k);
      const cx = x + i * size * 1.25 + size / 2, cy = y + size / 2;
      c.save();
      c.globalAlpha = clamp(k * (o.alpha ?? 1));
      c.beginPath();
      for (let p = 0; p < 10; p++) {
        const r = p % 2 === 0 ? s / 2 : s / 4.6;
        const a = -Math.PI / 2 + (p * Math.PI) / 5;
        c.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
      }
      c.closePath();
      c.fillStyle = o.color || '#E8A33D';
      c.fill();
      c.restore();
    }
  }

  line(x1, y1, x2, y2, o = {}) {
    const c = this.ctx;
    c.save();
    c.globalAlpha = clamp(o.alpha ?? 1);
    c.strokeStyle = o.color || this.theme.text;
    c.lineWidth = o.width || 2 * this.U;
    c.beginPath(); c.moveTo(x1, y1); c.lineTo(lerp(x1, x2, o.k ?? 1), lerp(y1, y2, o.k ?? 1)); c.stroke();
    c.restore();
  }

  /** Corner brackets framing a region, drawn on with k. */
  brackets(x, y, w, h, o = {}) {
    const c = this.ctx;
    const len = (o.len || 40 * this.U) * ease.outCubic(o.k ?? 1);
    c.save();
    c.globalAlpha = clamp(o.alpha ?? 1);
    c.strokeStyle = o.color || this.theme.accent;
    c.lineWidth = o.width || 3 * this.U;
    c.lineCap = 'square';
    const corners = [[x, y, 1, 1], [x + w, y, -1, 1], [x, y + h, 1, -1], [x + w, y + h, -1, -1]];
    for (const [cx, cy, sx, sy] of corners) {
      c.beginPath(); c.moveTo(cx + sx * len, cy); c.lineTo(cx, cy); c.lineTo(cx, cy + sy * len); c.stroke();
    }
    c.restore();
  }
}

/** Standard in/out envelope for a scene element: returns {k, out, alpha}. */
export function envelope(t, start, inDur, end, outDur = 0.45) {
  const k = seg(t, start, inDur);
  const out = seg(t, end - outDur, outDur);
  return { k, out, alpha: clamp(ease.outCubic(k) * (1 - ease.inCubic(out))) };
}
