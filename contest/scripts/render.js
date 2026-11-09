// Render the weekly exports: Slack card PNG, full-board PNG, 16:9 slide PNGs and the MP4 reel.
//   node contest/scripts/render.js <week> <fonts.css> [--skip-reel] [--qa <dir>]
const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

const ROOT = path.resolve(__dirname, "..");
const [week, fontsCss, ...flags] = process.argv.slice(2);
const pad = String(week).padStart(2, "0");
const OUT = path.join(ROOT, "exports", `week-${pad}`);
const qaDir = flags.includes("--qa") ? flags[flags.indexOf("--qa") + 1] : null;
fs.mkdirSync(OUT, { recursive: true });

const FONT_LINK = /<link rel="stylesheet" href="https:\/\/fonts\.googleapis\.com[^>]*>/;
const fonts = `<style>${fs.readFileSync(fontsCss, "utf8")}</style>`;
const tmp = fs.mkdtempSync(path.join(require("os").tmpdir(), "board-"));

function stage(file, wrap) {
  let html = fs.readFileSync(path.join(ROOT, "site", file), "utf8").replace(FONT_LINK, fonts);
  // The artifact host wraps the page in a standards-mode skeleton; mirror that locally.
  if (wrap) html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover"></head><body>${html}</body></html>`;
  const p = path.join(tmp, file);
  fs.writeFileSync(p, html);
  return "file://" + p;
}

(async () => {
  const browser = await chromium.launch();
  const board = stage("leaderboard.html", true);

  // Slack card (portrait, final frame of every animation)
  let ctx = await browser.newContext({ viewport: { width: 940, height: 1200 }, deviceScaleFactor: 2, reducedMotion: "reduce" });
  let page = await ctx.newPage();
  await page.goto(board + "#card");
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: path.join(OUT, `week-${pad}-slack-card.png`), fullPage: true });
  await page.goto(board);
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: path.join(OUT, `week-${pad}-full-board.png`), fullPage: true });
  await ctx.close();

  // 16:9 slides for the team meeting
  ctx = await browser.newContext({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1, reducedMotion: "reduce" });
  page = await ctx.newPage();
  await page.goto(board);
  await page.evaluate(() => document.fonts.ready);
  await page.evaluate(() => { document.body.classList.add("capture"); window.__board.enterPresent(0); });
  const n = await page.evaluate(() => window.__board.count());
  const slideDir = path.join(OUT, "slides-16x9");
  fs.mkdirSync(slideDir, { recursive: true });
  for (let i = 0; i < n; i++) {
    await page.evaluate((k) => window.__board.show(k), i);
    await page.waitForTimeout(150);
    await page.screenshot({ path: path.join(slideDir, `slide-${String(i + 1).padStart(2, "0")}.png`) });
  }
  await ctx.close();

  // Phone-width QA shot (not an export)
  if (qaDir) {
    fs.mkdirSync(qaDir, { recursive: true });
    ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, reducedMotion: "reduce" });
    page = await ctx.newPage();
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
    await page.goto(board);
    await page.evaluate(() => document.fonts.ready);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    await page.screenshot({ path: path.join(qaDir, "phone.png"), fullPage: true });
    console.log("phone horizontal overflow px:", overflow, "errors:", errors);
    await ctx.close();
  }

  // MP4 reel: deterministic frame capture, 30 fps
  if (!flags.includes("--skip-reel")) {
    const reel = stage("reel.html", false);
    ctx = await browser.newContext({ viewport: { width: 1080, height: 1350 }, deviceScaleFactor: 1 });
    page = await ctx.newPage();
    await page.goto(reel + "#capture");
    await page.evaluate(() => document.fonts.ready);
    const dur = await page.evaluate(() => window.REEL.DURATION);
    const frames = path.join(tmp, "frames");
    fs.mkdirSync(frames, { recursive: true });
    const fps = 30, total = Math.round((dur / 1000) * fps);
    for (let f = 0; f < total; f++) {
      await page.evaluate((ms) => window.REEL.seek(ms), (f * 1000) / fps);
      await page.screenshot({ path: path.join(frames, `f${String(f).padStart(4, "0")}.jpg`), type: "jpeg", quality: 92 });
    }
    await ctx.close();
    const mp4 = path.join(OUT, `week-${pad}-reel.mp4`);
    execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-framerate", String(fps), "-i", path.join(frames, "f%04d.jpg"),
      "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "20", "-preset", "slow", "-movflags", "+faststart", mp4]);
    console.log("reel:", mp4, Math.round(fs.statSync(mp4).size / 1024), "KB,", total, "frames");
    if (qaDir) for (const ms of [1500, 4600, 8400, 10300, 14600, 17600, 19600]) {
      const f = Math.round((ms / 1000) * fps);
      fs.copyFileSync(path.join(frames, `f${String(f).padStart(4, "0")}.jpg`), path.join(qaDir, `reel-${ms}.jpg`));
    }
  }
  await browser.close();
  console.log("exports in", OUT);
})().catch((e) => { console.error(e); process.exit(1); });
