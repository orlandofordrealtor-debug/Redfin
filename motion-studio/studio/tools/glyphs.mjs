// Extracts glyph outlines from a TTF so the engine can extrude real 3D numbers and short words.
// Usage: node tools/glyphs.mjs <font.ttf> [out.json]
import fs from 'node:fs';
import path from 'node:path';
import opentype from 'opentype.js';

const [fontPath, outPath = 'src/data/glyphs.json'] = process.argv.slice(2);
if (!fontPath) {
  console.error('Usage: node tools/glyphs.mjs <font.ttf> [out.json]');
  process.exit(1);
}

const font = opentype.parse(fs.readFileSync(fontPath).buffer);
const chars = '0123456789+%$.,:#/-!&?ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz ';
const glyphs = {};
for (const ch of chars) {
  const g = font.charToGlyph(ch);
  // y is flipped so the engine can use the outline in a y-up world directly
  const cmds = g.getPath(0, 0, font.unitsPerEm).commands.map(c => {
    const flip = v => (v === undefined ? undefined : Math.round(-v * 10) / 10);
    const r = v => Math.round(v * 10) / 10;
    switch (c.type) {
      case 'M': case 'L': return [c.type, r(c.x), flip(c.y)];
      case 'Q': return ['Q', r(c.x1), flip(c.y1), r(c.x), flip(c.y)];
      case 'C': return ['C', r(c.x1), flip(c.y1), r(c.x2), flip(c.y2), r(c.x), flip(c.y)];
      default: return ['Z'];
    }
  });
  glyphs[ch] = { a: Math.round(g.advanceWidth * 10) / 10, p: cmds };
}

const out = {
  family: font.names.fontFamily.en,
  unitsPerEm: font.unitsPerEm,
  ascender: font.ascender,
  descender: font.descender,
  capHeight: font.tables.os2 ? font.tables.os2.sCapHeight : font.ascender * 0.7,
  glyphs,
};
fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, JSON.stringify(out));
console.log(`Wrote ${Object.keys(glyphs).length} glyphs from ${out.family} to ${outPath} (${fs.statSync(outPath).size} bytes)`);
