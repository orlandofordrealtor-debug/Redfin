# Authoring a look

A **look** is a visual world: backdrop, floor, lights, materials, palette, post-processing and
camera feel. Every scene in `src/scenes/` renders in every look, because scenes only use the
factories on `BaseWorld` (`src/engine/world.js`). A look changes *how* those factories look.

## Module shape

```js
// src/looks/my-look.js
import * as THREE from 'three';
import { BaseWorld } from '../engine/world.js';
import * as M from '../engine/materials.js';
import { BRAND } from '../engine/brand.js';

class MyWorld extends BaseWorld {
  materials() { /* return the material set below */ }
  environment() { /* dome/backdrop, lights (this.addLights()), floor */ }
  onTimeline(scenes, duration) { /* optional: ambient props around each scene anchor */ }
  update(t) { super.update(t); /* ambient motion, always a pure function of t */ }
}

export default {
  id: 'my-look',               // kebab-case, unique
  name: 'My Look',             // shown in the Studio
  family: 'Clay' | 'Glass' | 'Holographic' | 'Luxury' | 'Celebration' | 'Data' | 'Type' | 'Map' | 'Architectural' | 'Signature',
  description: 'One sentence a non-designer understands.',
  bestFor: 'Which videos this look suits',
  swatch: ['#bg', '#bg2', '#accent', '#ink'],   // 4 colors for the picker thumbnail
  native: 'native',            // this look has its own palette and a Redfin re-skin
  post: { bloom: { strength, radius, threshold }, grain, vignette, ca, tone: 'neutral'|'aces', exposure, vignetteColor, scanlines?, band? },
  transition: { style: 'whip' | 'glide', duration: 0.9 },
  drift: 1,                    // camera drift amount
  palette: mode => (mode === 'brand' ? brandPalette : nativePalette),
  overlayTheme: p => ({ text, sub, accent, accentText, scrim, scrimAlpha, chipBg, chipText, panel, panelStroke, dark }),
  create: ctx => new MyWorld(ctx),
};
```

Register it in `src/looks/index.js`.

## Palette keys used by the engine and scenes

`dark` (bool), `bgTop`, `bgBottom`, `blobs` ([{dir:[x,y,z], color, size}]), `text`, `sub`, `accent`,
`accent2`, `accentText`, `ink`, `glassTint`, `decor` (array of colors), `muted`, `glow`, `line`,
`floorLine`, `shadow` (0-1), `scrim`, `scrimAlpha`, `fade` (fade-in/out color), `logo`
(`'tagline'` on light backgrounds, `'taglineReversed'` on dark).

**Brand mode** (default for every project): the "Redfin brand" switch re-skins every look. In
`palette('brand')` keep the look's materials and mood but map the accent to Redfin red
`BRAND.red` (#DE3341), inks to `BRAND.ink` (#111111) on light looks or warm white on dark looks,
and keep neutrals. `palette('native')` is the look's original palette.

## Material set (`materials()` must return all of these as factories)

| key | used for |
| --- | --- |
| `frame()` | body of photo cards |
| `panel()` | body of glass/clay panels that carry live canvas faces |
| `accent()` | accent objects, highlighted chart bar, 3D logo red |
| `glyph()` | extruded numbers/words (should support `userData.u.uDissolve`: use `M.satin`/`M.clay` which call `M.enhance`) |
| `decor(i)` | ambient spheres, i cycles colors |
| `ink()` | dark (or light on dark looks) solid parts |
| `muted()` | non-highlighted chart bars |
| `glow()` | HDR glow rings (values above 1 bloom) |
| `line()` | flowing trail material |

## Optional hooks

- `drawOverlay(o, t, { scenes, duration, current })` on your world class draws look-specific HUD on the
  2D layer every frame (corner brackets, a mono timecode rail, a news ticker). Keep it inside `o.safe`
  margins and away from the top-center brand logo and the scene's text zones.
- `overlayTheme` may set `displayFamily: 'serif'` (Cormorant Garamond), `displayWeight` and
  `displayStyle` to change the headline typeface for the look.
- Override any `BaseWorld` factory (`card`, `panel`, `orb`, `ring`, `bars`...) in your world class if
  the look needs a different object, as long as it returns the same shape (`userData.setOpacity`,
  `userData.redraw` for panels, `userData.set` for bars, etc.).

## Rules

- Everything that moves is a pure function of `t`. Never use `Math.random()`; use `rng(seed)` from `engine/util.js`.
- Keep ambient props away from where scenes put content: around each `scene.anchor`, content lives
  roughly within x ±4.5, y -2.5..3.5, z -1..1. Props go behind (z < -1.5) or wide (|x| > 4.5).
- The dome must follow the camera (`this.dome.position.copy(camera.position)` is done in `BaseWorld.update`).
- Set bloom `threshold` above the brightest non-emissive surface (above 1.0 on light looks), so only
  emissive glow and dissolve edges bloom. Light looks wash out otherwise.
- Clamp any value that goes into `pow()` in custom shaders.
- Text is drawn by scenes on the 2D overlay; pick `overlayTheme` colors with strong contrast against the backdrop.

## Checking a look

```bash
cd motion-studio/studio && node tools/build.mjs --only=render
cd .. && node render/render.mjs <project.json> --stills --scale 0.5 --formats 16x9,9x16 --out /tmp/look-check
```

A project that exercises every scene: `{"name":"check","story":"showcase","look":"my-look","format":"16x9","fields":{"qrLink":"https://www.redfin.com"}}`.
Add `"brand":{"mode":"native"}` to see the native palette. Look at the contact sheet and fix anything
unreadable, clipped, washed out or cluttered before calling it done.
