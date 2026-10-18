// Small deterministic helpers shared by the engine, looks and scenes.
// Everything that moves is a pure function of time t, so renders are frame-exact.

export const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
export const lerp = (a, b, k) => a + (b - a) * k;
export const invLerp = (a, b, v) => (b === a ? 0 : clamp((v - a) / (b - a)));
export const smoothstep = (a, b, v) => { const x = invLerp(a, b, v); return x * x * (3 - 2 * x); };

/** Progress of t through [start, start + dur], clamped to 0..1. */
export const seg = (t, start, dur) => (dur <= 0 ? (t >= start ? 1 : 0) : clamp((t - start) / dur));

export const ease = {
  linear: x => x,
  inQuad: x => x * x,
  outQuad: x => 1 - (1 - x) * (1 - x),
  inOutQuad: x => (x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2),
  outCubic: x => 1 - Math.pow(1 - x, 3),
  inCubic: x => x * x * x,
  inOutCubic: x => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2),
  outQuart: x => 1 - Math.pow(1 - x, 4),
  inOutQuart: x => (x < 0.5 ? 8 * x * x * x * x : 1 - Math.pow(-2 * x + 2, 4) / 2),
  outExpo: x => (x >= 1 ? 1 : 1 - Math.pow(2, -10 * x)),
  inOutExpo: x => (x <= 0 ? 0 : x >= 1 ? 1 : x < 0.5 ? Math.pow(2, 20 * x - 10) / 2 : (2 - Math.pow(2, -20 * x + 10)) / 2),
  outBack: x => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2); },
  outBackSoft: x => { const c1 = 0.9, c3 = c1 + 1; return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2); },
  outElastic: x => (x <= 0 ? 0 : x >= 1 ? 1 : Math.pow(2, -10 * x) * Math.sin((x * 10 - 0.75) * (2 * Math.PI) / 3) + 1),
  inOutSine: x => -(Math.cos(Math.PI * x) - 1) / 2,
};

/** Seeded PRNG (mulberry32). Never use Math.random in anything that renders. */
export function rng(seed = 1) {
  let a = seed >>> 0;
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  next.range = (lo, hi) => lo + (hi - lo) * next();
  next.pick = arr => arr[Math.floor(next() * arr.length) % arr.length];
  next.gauss = () => {
    const u = Math.max(1e-9, next()), v = next();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  };
  return next;
}

/** Stable integer hash of a string, for seeding per-project randomness. */
export function hashString(s = '') {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

/** Smooth deterministic 1D noise in -1..1, used for camera drift and idle motion. */
export function noise1(x, seed = 0) {
  const i = Math.floor(x), f = x - i;
  const h = n => { const s = Math.sin((n + seed * 57.13) * 127.1) * 43758.5453; return (s - Math.floor(s)) * 2 - 1; };
  const u = f * f * (3 - 2 * f);
  return lerp(h(i), h(i + 1), u);
}

export function hexToRgb(hex) {
  const h = hex.replace('#', '');
  const v = h.length === 3 ? h.split('').map(c => c + c).join('') : h;
  const n = parseInt(v, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
export const rgba = (hex, a = 1) => { const [r, g, b] = hexToRgb(hex); return `rgba(${r},${g},${b},${a})`; };
export function mixHex(a, b, k) {
  const A = hexToRgb(a), B = hexToRgb(b);
  const c = A.map((v, i) => Math.round(lerp(v, B[i], k)));
  return '#' + c.map(v => v.toString(16).padStart(2, '0')).join('');
}

/** Formats a number the way a real estate audience reads it. */
export function formatNumber(value, fmt = {}) {
  const { prefix = '', suffix = '', decimals = 0, compact = false } = fmt;
  let v = value, unit = '';
  if (compact) {
    if (Math.abs(v) >= 1e9) { v /= 1e9; unit = 'B'; }
    else if (Math.abs(v) >= 1e6) { v /= 1e6; unit = 'M'; }
    else if (Math.abs(v) >= 1e4) { v /= 1e3; unit = 'K'; }
  }
  const s = v.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
  return prefix + s + unit + suffix;
}

/** Parses "$1.2M", "98%", "24", "1,250" into {value, prefix, suffix, decimals, compact}. */
export function parseStat(raw) {
  const s = String(raw ?? '').trim();
  const m = s.match(/^([^\d\-.]*)(-?[\d,]*\.?\d+)\s*([kKmMbB]?)(.*)$/);
  if (!m) return null;
  const [, pre, num, mag, rest] = m;
  let value = parseFloat(num.replace(/,/g, ''));
  if (!isFinite(value)) return null;
  const decimals = (num.split('.')[1] || '').length;
  const magU = mag.toUpperCase();
  return { value, prefix: pre.trim(), suffix: (magU + rest).trim(), decimals, compact: false, magnitude: magU };
}

export function wrapIndex(i, n) { return ((i % n) + n) % n; }
