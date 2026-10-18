#!/usr/bin/env node
// Deterministic frame-by-frame renderer: Playwright drives the Studio's own engine page,
// ffmpeg encodes. Same engine as the browser Studio, so previews and renders match.
//
// Usage:
//   node render/render.mjs <project.json> [options]
// Options:
//   --out <dir>                 output folder (default: renders/<project name>)
//   --formats 9x16,16x9,1x1,4x5  sizes to render (default: project.formats)
//   --exports mp4,poster,gif,storyboard,overlay  (default: project.exports)
//   --stills                    only render check stills from every scene (fast)
//   --times 1.5,4,8             explicit still times (seconds)
//   --fps 60                    frame rate (default 60)
//   --scale 1                   render scale (0.5 = half resolution draft)
//   --quality final|draft       draft skips MSAA for speed
//   --workers 2                 parallel browser pages
//   --from 0 --to 10            render a time range only
//   --page <render.html>        use a different build of the render page
import { chromium } from '/opt/node-tools/node_modules/playwright/index.mjs';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
let studioDist = path.resolve(here, '../studio/dist/render.html');

function args() {
  const a = process.argv.slice(2);
  const o = { _: [] };
  for (let i = 0; i < a.length; i++) {
    if (a[i].startsWith('--')) {
      const k = a[i].slice(2);
      const v = a[i + 1] && !a[i + 1].startsWith('--') ? a[++i] : true;
      o[k] = v;
    } else o._.push(a[i]);
  }
  return o;
}

const opt = args();
if (!opt._[0]) {
  console.error('Usage: node render/render.mjs <project.json> [--stills] [--formats 9x16] [--exports mp4,poster]');
  process.exit(1);
}

if (opt.page) studioDist = path.resolve(opt.page);
const projectPath = path.resolve(opt._[0]);
const projectDir = path.dirname(projectPath);
const project = JSON.parse(fs.readFileSync(projectPath, 'utf8'));
inlineLocalMedia(project, projectDir);

const slug = (project.name || 'video').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const outDir = path.resolve(opt.out || path.join(here, '..', 'renders', slug));
fs.mkdirSync(outDir, { recursive: true });

const fps = Number(opt.fps || 60);
const scale = Number(opt.scale || 1);
const quality = opt.quality || 'final';
const workers = Math.max(1, Number(opt.workers || 1));
const formats = String(opt.formats || (project.formats || [project.format || '9x16']).join(',')).split(',');
const exportsWanted = opt.exports ? String(opt.exports).split(',') : Object.entries(project.exports || { mp4: true, poster: true }).filter(([, v]) => v).map(([k]) => k);

/** Lets project files reference images on disk; they are inlined as data URLs for the page. */
function inlineLocalMedia(p, dir) {
  const toData = v => {
    if (typeof v !== 'string' || /^(data:|https?:)/.test(v)) return v;
    const f = path.resolve(dir, v);
    if (!fs.existsSync(f)) { console.warn(`  ! media not found: ${v}`); return null; }
    const ext = path.extname(f).slice(1).toLowerCase();
    const mime = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', gif: 'image/gif', svg: 'image/svg+xml' }[ext] || 'application/octet-stream';
    return `data:${mime};base64,${fs.readFileSync(f).toString('base64')}`;
  };
  const f = p.fields || {};
  for (const k of ['headshot', 'screenshot', 'logo']) {
    if (typeof f[k] === 'string') f[k] = toData(f[k]);
    else if (f[k]?.src) f[k].src = toData(f[k].src);
  }
  if (Array.isArray(f.photos)) f.photos = f.photos.map(ph => (typeof ph === 'string' ? { src: toData(ph) } : { ...ph, src: toData(ph.src) })).filter(ph => ph.src);
  if (Array.isArray(f.people)) f.people.forEach(pp => { if (pp.photo) pp.photo = toData(pp.photo); });
}

async function openPage(browser, fmt) {
  const page = await browser.newPage({ viewport: { width: 400, height: 400 } });
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto('file://' + studioDist);
  await page.waitForFunction(() => window.MS_READY === true);
  const info = await page.evaluate(([p, o]) => window.MS.load(p, o), [{ ...project, format: fmt }, { scale, quality }]);
  if (errors.length) console.warn('  page warnings:', errors.slice(0, 3).join(' | '));
  return { page, info, errors };
}

function run(cmd, argv, { input } = {}) {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, argv, { stdio: [input ? 'pipe' : 'ignore', 'ignore', 'pipe'] });
    let err = '';
    p.stderr.on('data', d => { err += d; });
    p.on('close', code => (code === 0 ? resolve() : reject(new Error(`${cmd} exited ${code}: ${err.slice(-800)}`))));
    if (input) input(p.stdin);
  });
}

const b64 = dataUrl => Buffer.from(dataUrl.slice(dataUrl.indexOf(',') + 1), 'base64');

async function renderStills(browser, fmt, times) {
  const { page, info } = await openPage(browser, fmt);
  const ts = times || info.timeline.map(s => s.start + Math.min(s.dur * 0.62, s.dur - 0.5));
  const files = [];
  for (let i = 0; i < ts.length; i++) {
    const t0 = Date.now();
    const data = await page.evaluate(([t]) => window.MS.frameData(t, 'image/png'), [ts[i]]);
    const f = path.join(outDir, `still-${fmt}-${String(i + 1).padStart(2, '0')}.png`);
    fs.writeFileSync(f, b64(data));
    files.push(f);
    console.log(`  still ${i + 1}/${ts.length} t=${ts[i].toFixed(2)}s (${info.timeline.find(s => ts[i] < s.end)?.label || ''}) ${Date.now() - t0}ms`);
  }
  await page.close();
  return { files, info, times: ts };
}

async function contactSheet(files, out, cols = 4) {
  // Copy into a numbered sequence so ffmpeg's tile filter can lay them out
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'sheet-'));
  files.forEach((f, i) => fs.copyFileSync(f, path.join(tmp, `${String(i + 1).padStart(3, '0')}.png`)));
  const rows = Math.ceil(files.length / cols);
  await run('ffmpeg', ['-y', '-loglevel', 'error', '-framerate', '1', '-i', path.join(tmp, '%03d.png'),
    '-vf', `scale=360:-2,tile=${cols}x${rows}:padding=12:margin=12:color=0x222222`, '-frames:v', '1', out]);
  fs.rmSync(tmp, { recursive: true, force: true });
  return out;
}

async function renderVideo(browser, fmt) {
  const probe = await openPage(browser, fmt);
  const info = probe.info;
  await probe.page.close();
  const from = Number(opt.from || 0);
  const to = Math.min(Number(opt.to || info.duration), info.duration);
  const total = Math.round((to - from) * fps);
  const base = path.join(outDir, `${slug}-${fmt}`);
  console.log(`  ${fmt}: ${info.width}x${info.height}, ${(to - from).toFixed(2)}s, ${total} frames @ ${fps}fps, ${workers} worker(s)`);

  // Split frames across workers; each writes its own segment, then concat
  const chunk = Math.ceil(total / workers);
  const t0 = Date.now();
  let done = 0;
  const segs = await Promise.all(Array.from({ length: workers }, async (_, w) => {
    const a = w * chunk, b = Math.min(total, a + chunk);
    if (a >= b) return null;
    const { page } = await openPage(browser, fmt);
    const segFile = `${base}.part${w}.mp4`;
    await run('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(fps), '-c:v', 'mjpeg', '-i', '-',
      '-c:v', 'libx264', '-preset', 'medium', '-crf', '17', '-pix_fmt', 'yuv420p', '-r', String(fps), segFile], {
      input: async stdin => {
        for (let f = a; f < b; f++) {
          const t = from + f / fps;
          const data = await page.evaluate(([tt]) => window.MS.frameData(tt, 'image/jpeg', 0.95), [t]);
          if (!stdin.write(b64(data))) await new Promise(r => stdin.once('drain', r));
          done++;
          if (done % 30 === 0) {
            const el = (Date.now() - t0) / 1000;
            process.stdout.write(`\r  frames ${done}/${total}  ${(done / el).toFixed(1)} fps  eta ${Math.round((total - done) / (done / el))}s   `);
          }
        }
        stdin.end();
      },
    });
    await page.close();
    return segFile;
  }));
  process.stdout.write('\n');
  const parts = segs.filter(Boolean);
  const silent = `${base}.silent.mp4`;
  if (parts.length === 1) fs.renameSync(parts[0], silent);
  else {
    const list = `${base}.parts.txt`;
    fs.writeFileSync(list, parts.map(p => `file '${p.replace(/'/g, "'\\''")}'`).join('\n'));
    await run('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', list, '-c', 'copy', silent]);
    parts.forEach(p => fs.unlinkSync(p));
    fs.unlinkSync(list);
  }
  const out = `${base}.mp4`;
  const audio = project.audio || {};
  const musicPath = audio.musicFile ? path.resolve(projectDir, audio.musicFile) : null;
  if (musicPath && fs.existsSync(musicPath)) {
    const dur = (to - from).toFixed(3);
    await run('ffmpeg', ['-y', '-loglevel', 'error', '-i', silent, '-i', musicPath, '-filter_complex',
      `[1:a]atrim=0:${dur},afade=t=in:d=0.6,afade=t=out:st=${Math.max(0, dur - 1.2)}:d=1.2,volume=${audio.musicVolume ?? 0.8}[a]`,
      '-map', '0:v', '-map', '[a]', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k', '-shortest', '-movflags', '+faststart', out]);
    fs.unlinkSync(silent);
  } else {
    await run('ffmpeg', ['-y', '-loglevel', 'error', '-i', silent, '-c', 'copy', '-movflags', '+faststart', out]);
    fs.unlinkSync(silent);
  }
  console.log(`  ✓ ${path.relative(process.cwd(), out)}  (${((Date.now() - t0) / 1000).toFixed(0)}s)`);
  return { out, info };
}

async function main() {
  const browser = await chromium.launch({
    args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--disable-gpu-sandbox'],
  });
  try {
    for (const fmt of formats) {
      console.log(`\n▶ ${project.name || slug} · ${fmt}`);
      if (opt.stills) {
        const times = opt.times ? String(opt.times).split(',').map(Number) : null;
        const { files } = await renderStills(browser, fmt, times);
        const sheet = await contactSheet(files, path.join(outDir, `stills-${fmt}.png`), fmt === '16x9' ? 3 : 4);
        console.log(`  ✓ contact sheet ${path.relative(process.cwd(), sheet)}`);
        continue;
      }
      let video = null;
      if (exportsWanted.includes('mp4') || exportsWanted.includes('gif')) video = await renderVideo(browser, fmt);
      if (exportsWanted.includes('poster') || exportsWanted.includes('storyboard')) {
        const { files, info } = await renderStills(browser, fmt);
        if (exportsWanted.includes('poster')) {
          const posterIdx = Math.max(0, info.timeline.findIndex(s => s.type === 'hero' || s.type === 'property'));
          fs.copyFileSync(files[posterIdx], path.join(outDir, `${slug}-${fmt}-poster.png`));
          console.log(`  ✓ poster`);
        }
        if (exportsWanted.includes('storyboard')) {
          await contactSheet(files, path.join(outDir, `${slug}-${fmt}-storyboard.png`), fmt === '16x9' ? 3 : 4);
          console.log(`  ✓ storyboard`);
        }
        if (!exportsWanted.includes('storyboard')) files.forEach(f => fs.unlinkSync(f));
      }
      if (exportsWanted.includes('gif') && video) {
        const gif = path.join(outDir, `${slug}-${fmt}.gif`);
        const w = fmt === '16x9' ? 720 : 480;
        await run('ffmpeg', ['-y', '-loglevel', 'error', '-i', video.out, '-vf', `fps=15,scale=${w}:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=192[p];[b][p]paletteuse=dither=sierra2_4a`, gif]);
        console.log(`  ✓ gif`);
        if (!exportsWanted.includes('mp4')) fs.unlinkSync(video.out);
      }
      if (exportsWanted.includes('overlay')) {
        const { page, info } = await openPage(browser, fmt);
        const total = Math.round(info.duration * fps);
        const out = path.join(outDir, `${slug}-${fmt}-overlay.mov`);
        await run('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(fps), '-c:v', 'png', '-i', '-',
          '-c:v', 'prores_ks', '-profile:v', '4444', '-pix_fmt', 'yuva444p10le', out], {
          input: async stdin => {
            for (let f = 0; f < total; f++) {
              const data = await page.evaluate(([t]) => window.MS.overlayData(t), [f / fps]);
              if (!stdin.write(b64(data))) await new Promise(r => stdin.once('drain', r));
            }
            stdin.end();
          },
        });
        await page.close();
        console.log(`  ✓ transparent overlay (ProRes 4444)`);
      }
    }
  } finally {
    await browser.close();
  }
  console.log(`\nDone → ${outDir}`);
}

main().catch(e => { console.error(e); process.exit(1); });
