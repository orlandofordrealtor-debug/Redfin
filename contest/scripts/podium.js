// Render the week's three podium infographics (1080x1920 PNG each) for the team agenda.
//   node contest/scripts/podium.js <week> <fonts.css>
// #1 Gold Standard, #2 Cover Story, #3 Liftoff, all built from data/season.json and data/deals.json.
const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const [week, fontsCss] = process.argv.slice(2);
const pad = String(week).padStart(2, "0");
const OUT = path.join(ROOT, "exports", `week-${pad}`, "podium");
fs.mkdirSync(OUT, { recursive: true });

const season = JSON.parse(fs.readFileSync(path.join(ROOT, "data", "season.json"), "utf8"));
const deals = JSON.parse(fs.readFileSync(path.join(ROOT, "data", "deals.json"), "utf8"));
const data = JSON.stringify({ week: +week, season, deals }).replace(/</g, "\\u003c");
let html = fs.readFileSync(path.join(ROOT, "templates", "podium.html"), "utf8")
  .replace("__PODIUM_DATA__", data)
  .replace(/<link rel="stylesheet" href="https:\/\/fonts\.googleapis\.com[^>]*>/, `<style>${fs.readFileSync(fontsCss, "utf8")}</style>`);
const tmp = fs.mkdtempSync(path.join(require("os").tmpdir(), "podium-"));
fs.writeFileSync(path.join(tmp, "podium.html"), html);

(async () => {
  const browser = await chromium.launch();
  const page = await (await browser.newContext({ viewport: { width: 1200, height: 2000 }, deviceScaleFactor: 1 })).newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("file://" + path.join(tmp, "podium.html"));
  await page.evaluate(() => document.fonts.ready);
  const places = await page.evaluate(() => (window.PODIUM || { places: [] }).places);
  const names = { 1: "1-gold-standard", 2: "2-cover-story", 3: "3-liftoff" };
  for (const p of places) {
    const file = path.join(OUT, `week-${pad}-podium-${names[p]}.png`);
    await page.locator("#pod" + p).screenshot({ path: file });
    console.log("podium", p, "->", file);
  }
  if (errors.length) console.log("page errors:", errors);
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
