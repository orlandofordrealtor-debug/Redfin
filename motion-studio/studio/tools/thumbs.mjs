// Renders real preview frames for the template gallery and look picker, saved as small WebP
// data URLs in src/data/thumbs.json (rebuild the Studio afterwards).
// Usage: node tools/thumbs.mjs [--only stories|looks]
import { chromium } from '/opt/node-tools/node_modules/playwright/index.mjs';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const outFile = path.join(root, 'src/data/thumbs.json');
const only = process.argv.includes('--only') ? process.argv[process.argv.indexOf('--only') + 1] : null;
const existing = fs.existsSync(outFile) ? JSON.parse(fs.readFileSync(outFile, 'utf8')) : { stories: {}, looks: {} };

const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await b.newPage();
page.on('pageerror', e => console.log('  page error:', e.message));
await page.goto('file://' + path.join(root, 'dist/render.html'));
await page.waitForFunction(() => window.MS_READY === true);

const lists = await page.evaluate(() => {
  const e = window.MS;
  return { stories: e.storyList(), looks: e.lookList() };
});

async function grab(project, pick) {
  return page.evaluate(async ([p, pick]) => {
    const info = await window.MS.load(p, { scale: 0.34, quality: 'final' });
    const tl = info.timeline;
    const s = pick.map(type => tl.find(x => x.type === type)).find(Boolean) || tl[0];   // first match in priority order
    window.MS.frame(s.start + Math.min(s.dur * 0.68, s.dur - 0.35));
    const src = document.getElementById('stage');
    const c = document.createElement('canvas');
    c.width = 480; c.height = Math.round(480 * (src.height / src.width));
    c.getContext('2d').drawImage(src, 0, 0, c.width, c.height);
    return c.toDataURL('image/webp', 0.72);
  }, [project, pick]);
}

if (!only || only === 'stories') {
  for (const s of lists.stories) {
    const look = lists.looks.find(l => l.id === s.defaultLook && !l.placeholder) ? s.defaultLook : 'brand-glass';
    const project = { id: `thumb-${s.id}`, story: s.id, look, format: '16x9', fields: { ...s.defaults, ...s.sample } };
    existing.stories[s.id] = await grab(project, s.thumbScenes || ['hero', 'property', 'chart', 'stats', 'leaderboard', 'portrait', 'quote', 'timeline', 'list', 'screenshot', 'intro']);
    console.log(`  story ${s.id} (${look}) ${Math.round(existing.stories[s.id].length / 1024)} KB`);
  }
}
if (!only || only === 'looks') {
  for (const l of lists.looks) {
    if (l.placeholder) continue;
    const project = { id: `thumb-look-${l.id}`, story: 'showcase', look: l.id, format: '16x9', fields: { qrLink: 'https://www.redfin.com' } };
    existing.looks[l.id] = await grab(project, ['hero']);
    console.log(`  look ${l.id} ${Math.round(existing.looks[l.id].length / 1024)} KB`);
  }
}
fs.writeFileSync(outFile, JSON.stringify(existing));
console.log(`Wrote ${outFile} (${Math.round(fs.statSync(outFile).size / 1024)} KB)`);
await b.close();
