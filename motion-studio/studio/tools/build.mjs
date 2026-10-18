// Builds single-file HTML outputs (everything inlined: three.js, fonts, logos), so the Studio
// opens straight from disk, from a shared drive or from any static host.
//   dist/motion-studio.html  - the Studio app
//   dist/render.html         - headless render page used by ../render/render.mjs
import * as esbuild from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const outArg = process.argv.find(a => a.startsWith('--outdir='))?.split('=')[1];
const dist = outArg ? path.resolve(outArg) : path.join(root, 'dist');
fs.mkdirSync(dist, { recursive: true });
const watch = process.argv.includes('--watch');
const only = process.argv.find(a => a.startsWith('--only='))?.split('=')[1];

const font = (file, family, weight, style = 'normal') => {
  const b64 = fs.readFileSync(path.join(root, 'assets/fonts', file)).toString('base64');
  return `@font-face{font-family:"${family}";src:url(data:font/woff2;base64,${b64}) format("woff2");font-weight:${weight};font-style:${style};font-display:block}`;
};
const fontCSS = [
  font('PlusJakartaSans-normal.woff2', 'Plus Jakarta Sans', '200 800'),
  font('PlusJakartaSans-italic.woff2', 'Plus Jakarta Sans', '200 800', 'italic'),
  font('JetBrainsMono-normal.woff2', 'JetBrains Mono', '100 800'),
  font('CormorantGaramond-normal.woff2', 'Cormorant Garamond', '300 700'),
  font('CormorantGaramond-italic.woff2', 'Cormorant Garamond', '300 700', 'italic'),
].join('\n');

const common = {
  bundle: true,
  format: 'iife',
  minify: !process.argv.includes('--dev'),
  sourcemap: false,
  target: ['chrome110', 'safari16', 'firefox115'],
  loader: { '.svg': 'text', '.json': 'json' },
  logLevel: 'warning',
  legalComments: 'none',
};

async function buildRender() {
  const out = await esbuild.build({ ...common, entryPoints: [path.join(root, 'src/render-entry.js')], write: false });
  const js = out.outputFiles[0].text.replace(/<\/script/g, '<\\/script');
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>Motion Studio Render</title>
<style>${fontCSS}html,body{margin:0;background:#000}canvas{display:block}</style></head>
<body><canvas id="stage"></canvas><script>${js}</script></body></html>`;
  fs.writeFileSync(path.join(dist, 'render.html'), html);
  return html.length;
}

async function buildStudio() {
  const entry = path.join(root, 'src/app/main.js');
  if (!fs.existsSync(entry)) return 0;
  const out = await esbuild.build({ ...common, entryPoints: [entry], write: false });
  const js = out.outputFiles[0].text.replace(/<\/script/g, '<\\/script');
  const css = fs.readFileSync(path.join(root, 'src/app/studio.css'), 'utf8');
  const shell = fs.readFileSync(path.join(root, 'src/app/shell.html'), 'utf8');
  const html = shell
    .replace('/*FONTS*/', () => fontCSS)
    .replace('/*CSS*/', () => css)
    .replace('/*JS*/', () => js);
  fs.writeFileSync(path.join(dist, 'motion-studio.html'), html);
  return html.length;
}

async function run() {
  const t0 = Date.now();
  const sizes = {};
  if (!only || only === 'render') sizes.render = await buildRender();
  if (!only || only === 'studio') sizes.studio = await buildStudio();
  console.log(`Built in ${Date.now() - t0}ms`, Object.fromEntries(Object.entries(sizes).map(([k, v]) => [k, `${(v / 1024 / 1024).toFixed(2)} MB`])));
}

await run();
if (watch) {
  console.log('Watching src/ for changes…');
  let timer;
  fs.watch(path.join(root, 'src'), { recursive: true }, () => { clearTimeout(timer); timer = setTimeout(() => run().catch(e => console.error(e.message)), 150); });
}
