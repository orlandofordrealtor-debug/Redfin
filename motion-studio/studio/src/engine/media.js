// Media loading and clearly-labelled placeholders for anything the user hasn't supplied yet.
import qrcode from 'qrcode-generator';
import { rng, mixHex } from './util.js';
import { FONTS } from './brand.js';

const imageCache = new Map();

export function loadImage(src) {
  if (!src) return Promise.resolve(null);
  if (imageCache.has(src)) return imageCache.get(src);
  const p = new Promise(resolve => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.decoding = 'async';
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
  imageCache.set(src, p);
  return p;
}

/** Reads a File/Blob into a data URL so projects stay portable. */
export function fileToDataURL(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}

/** Downscales large photos so projects stay light (longest side capped). */
export async function normalizePhoto(file, maxSide = 2000, quality = 0.9) {
  const url = await fileToDataURL(file);
  if (!/^data:image\/(jpeg|png|webp)/.test(url)) return url;
  const img = await loadImage(url);
  if (!img) return url;
  const s = Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight));
  if (s >= 1 && file.size < 2.5e6) return url;
  const c = document.createElement('canvas');
  c.width = Math.round(img.naturalWidth * s);
  c.height = Math.round(img.naturalHeight * s);
  c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
  return c.toDataURL(file.type === 'image/png' ? 'image/png' : 'image/jpeg', quality);
}

export function makeQR(text) {
  if (!text) return null;
  try {
    const qr = qrcode(0, 'M');
    qr.addData(String(text));
    qr.make();
    return qr;
  } catch (e) {
    return null;
  }
}

const SKIES = [
  ['#9CC9F0', '#F7E1C8'], ['#F6B892', '#FBE7CF'], ['#86B7E8', '#E9F1FA'],
  ['#C9B6E8', '#FCE4D6'], ['#7FB2DE', '#FDF1DC'],
];
const WALLS = ['#F4F1EC', '#E9E2D6', '#D8D2C8', '#2E2F33', '#C9B9A6', '#EDE7DF'];

/** A tasteful illustrated home, marked as a placeholder, for previews before real photos arrive. */
export function placeholderHome(seed = 1, label = 'Add a closing photo', w = 1600, h = 1066) {
  const r = rng(seed * 977 + 13);
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const x = c.getContext('2d');
  const [skyTop, skyBottom] = SKIES[Math.floor(r() * SKIES.length)];
  const g = x.createLinearGradient(0, 0, 0, h * 0.72);
  g.addColorStop(0, skyTop); g.addColorStop(1, skyBottom);
  x.fillStyle = g; x.fillRect(0, 0, w, h);
  // distant hills
  x.fillStyle = mixHex(skyBottom, '#6F8F7A', 0.35);
  x.beginPath(); x.moveTo(0, h * 0.62);
  for (let i = 0; i <= 8; i++) x.lineTo((w / 8) * i, h * (0.56 + r() * 0.06));
  x.lineTo(w, h); x.lineTo(0, h); x.fill();
  // lawn
  x.fillStyle = '#7FA36B'; x.fillRect(0, h * 0.74, w, h * 0.26);
  x.fillStyle = '#C9C2B6'; x.fillRect(w * 0.44, h * 0.74, w * 0.12, h * 0.26);
  // house body
  const wall = WALLS[Math.floor(r() * WALLS.length)];
  const dark = wall === '#2E2F33';
  const bx = w * 0.18, by = h * 0.36, bw = w * 0.64, bh = h * 0.38;
  x.fillStyle = 'rgba(0,0,0,0.12)'; x.fillRect(bx + 18, by + bh - 4, bw, 22);
  x.fillStyle = wall; x.fillRect(bx, by, bw, bh);
  const modern = r() > 0.45;
  x.fillStyle = dark ? '#1C1C1E' : '#3B3A3E';
  if (modern) {
    x.fillRect(bx - w * 0.02, by - h * 0.03, bw + w * 0.04, h * 0.035);
    x.fillStyle = mixHex(wall, '#000000', 0.08);
    x.fillRect(bx + bw * 0.55, by - h * 0.13, bw * 0.45, h * 0.13);
    x.fillStyle = dark ? '#1C1C1E' : '#3B3A3E';
    x.fillRect(bx + bw * 0.53, by - h * 0.155, bw * 0.49, h * 0.03);
  } else {
    x.beginPath(); x.moveTo(bx - w * 0.03, by); x.lineTo(bx + bw / 2, by - h * 0.2); x.lineTo(bx + bw + w * 0.03, by); x.closePath(); x.fill();
  }
  // windows with warm light
  const win = (wx, wy, ww, wh) => {
    const wg = x.createLinearGradient(wx, wy, wx, wy + wh);
    wg.addColorStop(0, '#FFE7B8'); wg.addColorStop(1, '#F2B866');
    x.fillStyle = '#2B2B2E'; x.fillRect(wx - 6, wy - 6, ww + 12, wh + 12);
    x.fillStyle = wg; x.fillRect(wx, wy, ww, wh);
    x.fillStyle = 'rgba(255,255,255,0.25)'; x.fillRect(wx, wy, ww * 0.35, wh);
  };
  win(bx + bw * 0.08, by + bh * 0.22, bw * 0.22, bh * 0.42);
  win(bx + bw * 0.68, by + bh * 0.22, bw * 0.24, bh * 0.42);
  if (modern) win(bx + bw * 0.6, by - h * 0.105, bw * 0.34, h * 0.08);
  x.fillStyle = '#5A4632'; x.fillRect(bx + bw * 0.43, by + bh * 0.38, bw * 0.14, bh * 0.62);
  // palms
  const palm = px => {
    x.strokeStyle = '#6B5643'; x.lineWidth = w * 0.008;
    x.beginPath(); x.moveTo(px, h * 0.76); x.quadraticCurveTo(px + w * 0.02, h * 0.45, px - w * 0.01, h * 0.2); x.stroke();
    x.fillStyle = '#3E6B4A';
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * Math.PI * 2;
      x.beginPath(); x.ellipse(px - w * 0.01 + Math.cos(a) * w * 0.035, h * 0.2 + Math.sin(a) * h * 0.02, w * 0.045, h * 0.012, a, 0, Math.PI * 2); x.fill();
    }
  };
  if (r() > 0.3) palm(w * (0.08 + r() * 0.05));
  if (r() > 0.5) palm(w * (0.9 + r() * 0.04));
  // placeholder tag
  x.fillStyle = 'rgba(17,17,17,0.72)';
  const tag = `PLACEHOLDER · ${label}`;
  x.font = `700 ${Math.round(h * 0.032)}px ${FONTS.mono}`;
  const tw = x.measureText(tag).width;
  roundRectPath(x, w / 2 - tw / 2 - 28, h * 0.86, tw + 56, h * 0.075, h * 0.0375);
  x.fill();
  x.fillStyle = '#FFFFFF'; x.textAlign = 'center'; x.textBaseline = 'middle';
  x.fillText(tag, w / 2, h * 0.86 + h * 0.0375);
  return c;
}

/** Neutral portrait silhouette, marked as a placeholder. */
export function placeholderPortrait(label = 'Add headshot', size = 1000) {
  const c = document.createElement('canvas');
  c.width = size; c.height = size;
  const x = c.getContext('2d');
  const g = x.createLinearGradient(0, 0, 0, size);
  g.addColorStop(0, '#E9E4DE'); g.addColorStop(1, '#CFC7BD');
  x.fillStyle = g; x.fillRect(0, 0, size, size);
  x.fillStyle = '#A99F94';
  x.beginPath(); x.arc(size / 2, size * 0.4, size * 0.17, 0, Math.PI * 2); x.fill();
  x.beginPath(); x.ellipse(size / 2, size * 0.92, size * 0.34, size * 0.3, 0, Math.PI, 0); x.fill();
  x.fillStyle = 'rgba(17,17,17,0.7)';
  x.font = `700 ${Math.round(size * 0.04)}px ${FONTS.mono}`;
  const tw = x.measureText(label.toUpperCase()).width;
  roundRectPath(x, size / 2 - tw / 2 - 24, size * 0.82, tw + 48, size * 0.07, size * 0.035);
  x.fill();
  x.fillStyle = '#FFFFFF'; x.textAlign = 'center'; x.textBaseline = 'middle';
  x.fillText(label.toUpperCase(), size / 2, size * 0.855);
  return c;
}

function roundRectPath(x, px, py, w, h, r) {
  x.beginPath();
  x.moveTo(px + r, py);
  x.arcTo(px + w, py, px + w, py + h, r);
  x.arcTo(px + w, py + h, px, py + h, r);
  x.arcTo(px, py + h, px, py, r);
  x.arcTo(px, py, px + w, py, r);
  x.closePath();
}

/** Minimal CSV parser (quoted fields supported) returning rows of objects. */
export function parseCSV(text) {
  const rows = [];
  let row = [], field = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (q) {
      if (ch === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (ch === '"') q = false;
      else field += ch;
    } else if (ch === '"') q = true;
    else if (ch === ',') { row.push(field); field = ''; }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(field); rows.push(row); row = []; field = '';
    } else field += ch;
  }
  if (field || row.length) { row.push(field); rows.push(row); }
  const clean = rows.filter(r => r.some(v => v.trim() !== ''));
  if (!clean.length) return { headers: [], rows: [] };
  const headers = clean[0].map(h => h.trim());
  return { headers, rows: clean.slice(1).map(r => Object.fromEntries(headers.map((h, i) => [h, (r[i] ?? '').trim()]))) };
}
