// Brand system. Colors come from the official Redfin Powered by Rocket logo files
// (red #DE3341, ink #111111). Supporting neutrals are studio choices built around them.
import logoTagline from '../../assets/logos/redfin-powered-by-rocket.svg';
import logoTaglineReversed from '../../assets/logos/redfin-powered-by-rocket-reversed.svg';
import logoTaglineBlack from '../../assets/logos/redfin-powered-by-rocket-black.svg';
import logoRelationship from '../../assets/logos/redfin-rocket-relationship.svg';
import logoRelationshipReversed from '../../assets/logos/redfin-rocket-relationship-reversed.svg';
import logoRedfin from '../../assets/logos/redfin.svg';
import logoRedfinReversed from '../../assets/logos/redfin-reversed.svg';
import premierWhite from '../../assets/logos/premier-white.svg';
import premierPutty from '../../assets/logos/premier-putty.svg';
import premierMushroom from '../../assets/logos/premier-mushroom.svg';

export const BRAND = {
  red: '#DE3341',
  redDeep: '#B3202E',
  redGlow: '#FF5A66',
  ink: '#111111',
  white: '#FFFFFF',
  paper: '#F7F5F2',
  mist: '#ECE8E4',
  stone: '#D9D3CC',
  slate: '#5D626B',
  charcoal: '#1C1D21',
  night: '#0B0B0D',
  gold: '#E8A33D',
  mushroom: '#463C33',
  putty: '#F3EEE7',
  lineName: 'Redfin | Powered by Rocket',
  brokerage: 'Redfin',
};

export const FONTS = {
  display: '"Plus Jakarta Sans", "Helvetica Neue", Arial, sans-serif',
  body: '"Plus Jakarta Sans", "Helvetica Neue", Arial, sans-serif',
  mono: '"JetBrains Mono", ui-monospace, Menlo, Consolas, monospace',
  serif: '"Cormorant Garamond", "Times New Roman", Georgia, serif',
};

const DEFAULT_FONTS = { ...FONTS };
const registered = new Map();

async function registerFont(family, src) {
  const prev = registered.get(family);
  if (prev?.src === src) return;
  const face = new FontFace(family, `url(${src})`);
  await face.load();
  if (prev) document.fonts.delete(prev.face);   // replacing a font file swaps the face, not adds a second
  document.fonts.add(face);
  registered.set(family, { src, face });
}

/**
 * Uses brand font files supplied with the project ({ display, body } as data URLs) for headlines
 * and body text, or restores the defaults when none are given.
 */
export async function applyBrandFonts(fonts = {}) {
  FONTS.display = DEFAULT_FONTS.display;
  FONTS.body = DEFAULT_FONTS.body;
  try {
    if (fonts?.display) { await registerFont('Brand Display', fonts.display); FONTS.display = `"Brand Display", ${DEFAULT_FONTS.display}`; }
    if (fonts?.body) { await registerFont('Brand Body', fonts.body); FONTS.body = `"Brand Body", ${DEFAULT_FONTS.body}`; }
  } catch (e) { /* an unreadable font file falls back to the default faces */ }
}

export const LOGO_SVGS = {
  tagline: logoTagline,
  taglineReversed: logoTaglineReversed,
  taglineBlack: logoTaglineBlack,
  relationship: logoRelationship,
  relationshipReversed: logoRelationshipReversed,
  redfin: logoRedfin,
  redfinReversed: logoRedfinReversed,
  premierWhite,
  premierPutty,
  premierMushroom,
};

const logoCache = new Map();
/** Loads an official logo SVG as an <img> for drawing on 2D canvases. */
export function loadLogo(key) {
  if (logoCache.has(key)) return logoCache.get(key);
  const svg = LOGO_SVGS[key];
  const p = new Promise((resolve, reject) => {
    const img = new Image();
    img.decoding = 'sync';
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  });
  logoCache.set(key, p);
  return p;
}

export async function loadAllLogos() {
  const out = {};
  await Promise.all(Object.keys(LOGO_SVGS).map(async k => { out[k] = await loadLogo(k); }));
  return out;
}

/** Native aspect of each logo (from its viewBox), so lockups are never stretched. */
export function logoAspect(key) {
  const m = LOGO_SVGS[key].match(/viewBox="\s*[\d.\-]+\s+[\d.\-]+\s+([\d.]+)\s+([\d.]+)/);
  return m ? parseFloat(m[1]) / parseFloat(m[2]) : 3;
}
