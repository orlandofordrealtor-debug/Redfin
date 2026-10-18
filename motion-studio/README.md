# Redfin Powered by Rocket · Creative Studio

**Anything in. Amazing out.** A Three.js motion-graphics studio for Redfin sales leaders and agents:
start from a template, a description or a pile of photos and screenshots, and finish with polished,
on-brand video in every social and presentation size.

```
motion-studio/
├── studio/
│   ├── dist/motion-studio.html   ← the Studio. One file: open it in Chrome or Edge, share it with your team
│   ├── dist/render.html          ← headless render page used by the renderer
│   ├── src/engine/               ← Three.js engine (stage, post-processing, camera, overlay type layer)
│   ├── src/scenes/               ← 14 scene types (title, spotlight, gallery, property, numbers, chart…)
│   ├── src/stories/              ← 18 story templates (anniversary, just sold, market update…)
│   ├── src/looks/                ← 12 looks (Redfin Glass, Premium Clay, Holographic Globe, Luxury…)
│   ├── src/app/                  ← Studio UI
│   ├── assets/                   ← official Redfin Powered by Rocket logos, fonts
│   └── tools/                    ← build, thumbnails, glyph extraction
├── render/render.mjs             ← Claude Code renderer: Playwright + ffmpeg, frame-perfect MP4s
├── projects/                     ← project files (JSON) ready to render
└── brief.html                    ← the original intake questionnaire
```

## Use the Studio

Open `studio/dist/motion-studio.html` in **Chrome or Edge** (double-click it; no install, works offline).

1. **Start**: pick one of 18 templates, or **Describe it** (type what you want, drop in photos,
   screenshots, CSVs, notes or music) and the Studio picks a template and fills what it can.
2. **Content**: fill the fields. The coaching checklist shows what is required, what is missing and
   what would make it better.
3. **Look**: pick from 12 looks. The **Redfin brand** switch (on by default) re-skins every look in
   Redfin red and ink with the official Redfin Powered by Rocket lockup.
4. **Format & sound**: 9:16, 16:9, 1:1 and 4:5; length; 60 or 30 fps; music, voiceover, synthesized
   sound effects, burned-in captions; privacy (real names internally, initials for social).
5. **Polish**: edit any scene's words, length and camera move; reorder, hide or add scenes.
6. **Export**: MP4 (frame-exact, with sound), poster PNG, GIF, storyboard sheet, or hand off to
   Claude Code for final renders and delivery to Slack, Drive, email or GitHub. Batch mode makes one
   video per spreadsheet row.

**Reset** (top bar) starts over at any point. Projects save automatically in the browser; use
**Projects → Download** to move them between computers or hand them to Claude Code.

### Share it with your team

Send `studio/dist/motion-studio.html` (about 1.4 MB) by Slack, email or a shared drive. Everyone opens
their own copy; projects stay in each person's browser. Team members can export a project file and
send it to you or to Claude Code.

## Render with Claude Code

```bash
cd motion-studio/studio && npm install && node tools/build.mjs     # once, or after code changes
cd .. && node render/render.mjs projects/<project>.json --stills     # check one still per scene first
node render/render.mjs projects/<project>.json                       # full render
```

Options: `--formats 9x16,16x9,1x1,4x5` · `--exports mp4,poster,gif,storyboard,overlay` ·
`--fps 60` · `--scale 0.5` (half-res draft) · `--workers 2` · `--from 0 --to 8`.
Outputs land in `motion-studio/renders/<project-name>/`. Project files can reference images on disk
(relative paths) or carry them inline as data URLs (what the Studio exports).
`overlay` produces a ProRes 4444 `.mov` of the type and graphics on transparency for editing apps.

Rendering is software WebGL in the cloud container (about 1–3 s per 1080p frame), so a 25-second,
60 fps video takes a while; use `--scale 0.5 --fps 30` for quick drafts. In the browser on a normal
laptop the same export runs close to real time.

## How it is built

- **Deterministic**: every animation is a pure function of time `t`; the Studio preview, the
  in-browser exporter and the Claude Code renderer produce the same frames.
- **Pipeline**: scene → half-float HDR target with 4× MSAA → UnrealBloom (high threshold, so only
  glows and dissolve edges bloom) → tone mapping → final pass (film grain, vignette, chromatic
  aberration, optional scan lines) → 2D type layer composited after tone mapping so text stays crisp.
- **Brand**: official logo SVGs from the Redfin asset kit; red `#DE3341` and ink `#111111` come from
  those files. Headlines use Plus Jakarta Sans as a free stand-in for the brand typeface; brand font
  files can be added later through `applyBrandFonts`.
- **Honest content**: placeholders are labelled `PLACEHOLDER`, sample content says `Sample`, data
  scenes carry a source line, and end cards only show details that were entered.

### Add a template
Create `studio/src/stories/<name>.js` exporting `{ id, name, category, blurb, bestFor, fields, plan(fields) }`
and register it in `stories/index.js`. `plan()` returns a list of scenes (`type`, `dur`, `text`, `data`).

### Add a look
Follow `studio/src/looks/README.md`. Every scene renders in every look.

### Refresh gallery thumbnails
`node tools/build.mjs --only=render && node tools/thumbs.mjs && node tools/build.mjs`
