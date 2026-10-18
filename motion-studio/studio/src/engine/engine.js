// MotionEngine: loads a project, builds the look's world and the story's scenes, and renders
// any time t deterministically. Used by the Studio preview, the in-browser exporter and the
// Node renderer (Playwright), so all three produce identical frames.
import * as THREE from 'three';
import { Stage, FORMATS } from './stage.js';
import { Overlay } from './overlay.js';
import { CameraRig, makeShot, fitDistance } from './camera.js';
import { loadAllLogos, BRAND, applyBrandFonts } from './brand.js';
import { loadImage, placeholderHome, placeholderPortrait, makeQR } from './media.js';
import { clamp, ease, hashString, seg } from './util.js';
import { LOOKS } from '../looks/index.js';
import { SCENES } from '../scenes/index.js';
import { STORIES } from '../stories/index.js';
import { normalizeProject, planScenes } from './project.js';

export class MotionEngine {
  constructor({ canvas, scale = 1, quality = 'final' } = {}) {
    this.stage = new Stage({ canvas, format: '16x9', scale, quality });
    this.overlay = new Overlay(this.stage);
    this.rig = new CameraRig(this.stage.camera);
    this.scenes = [];
    this.duration = 10;
    this.ready = false;
    this.lastT = 0;
  }

  get canvas() { return this.stage.canvas; }

  async load(rawProject, { scale } = {}) {
    const project = normalizeProject(rawProject);
    this.project = project;
    if (project.brand?.fonts) applyBrandFonts(project.brand.fonts);
    await this.loadFonts();
    this.logos = await loadAllLogos();
    this.stage.setFormat(project.format, scale ?? this.stage.scale);
    this.assets = await this.resolveMedia(project);
    this.rebuild();
    this.ready = true;
    return this;
  }

  async loadFonts() {
    if (!document.fonts) return;
    const specs = ['800 100px "Plus Jakarta Sans"', '700 100px "Plus Jakarta Sans"', '500 100px "Plus Jakarta Sans"', '400 100px "Plus Jakarta Sans"',
      'italic 600 100px "Plus Jakarta Sans"', '500 100px "JetBrains Mono"', '700 100px "JetBrains Mono"', '600 100px "Cormorant Garamond"', 'italic 500 100px "Cormorant Garamond"'];
    try { await Promise.all(specs.map(s => document.fonts.load(s))); } catch (e) { /* fall back to system fonts */ }
    if (this.project?.brand?.fonts) {
      try { await Promise.all(['700 100px "Brand Display"', '400 100px "Brand Body"'].map(s => document.fonts.load(s))); } catch (e) { /* optional */ }
    }
  }

  /** Turns project media references into drawable images, filling gaps with labelled placeholders. */
  async resolveMedia(project) {
    const f = project.fields;
    const assets = { photos: [], headshot: null, logo: null, screenshot: null, qr: null, placeholders: [] };
    const seed = hashString(project.id || 'p');
    assets.headshot = await loadImage(f.headshot?.src || f.headshot);
    if (!assets.headshot && project.story !== 'market-update') {
      assets.headshot = placeholderPortrait('Add headshot');
      assets.headshotPlaceholder = true;
    }
    const photos = Array.isArray(f.photos) ? f.photos : [];
    for (const p of photos) {
      const img = await loadImage(p?.src || p);
      if (img) assets.photos.push({ img, caption: p?.caption || '', sub: p?.sub || '' });
    }
    assets.photoPlaceholders = 0;
    const want = STORIES[project.story]?.minPhotos ?? 0;
    for (let i = assets.photos.length; i < want; i++) {
      assets.photos.push({ img: placeholderHome(seed + i, 'Add a photo'), caption: '', sub: '', placeholder: true });
      assets.photoPlaceholders++;
    }
    assets.screenshot = await loadImage(f.screenshot?.src || f.screenshot);
    assets.extraLogo = await loadImage(f.logo?.src || f.logo);
    assets.qr = makeQR(f.qrLink || f.link || '');
    return assets;
  }

  /** Rebuilds look + scenes (after edits to the project). */
  rebuild() {
    this.disposeWorld();
    const p = this.project;
    const look = LOOKS[p.look] || LOOKS['brand-glass'];
    this.look = look;
    const palette = look.palette(p.brand?.mode === 'native' ? 'native' : 'brand', p.brand);
    this.palette = palette;
    this.stage.applyPost({ ...look.post, ...(p.post || {}) });
    this.overlay.setTheme(look.overlayTheme(palette));
    const ctx = {
      stage: this.stage, project: p, palette, assets: this.assets, logos: this.logos,
      seed: hashString(p.id + p.look), overlay: this.overlay, fields: p.fields, energy: p.energy || 'standard',
    };
    this.ctx = ctx;
    this.world = look.create(ctx).init();

    const plan = planScenes(p);
    this.plan = plan;
    const T = look.transition?.duration ?? 0.9;
    let t = 0;
    this.scenes = plan.map((sc, i) => {
      const def = SCENES[sc.type];
      const anchor = this.world.anchorFor(i);
      const group = new THREE.Group();
      group.position.copy(anchor);
      this.world.root.add(group);
      const inst = def.build({ ...ctx, scene: sc, index: i, count: plan.length, group, world: this.world, anchor });
      const s = { ...sc, def, inst, group, anchor, start: t, end: t + sc.dur, index: i };
      t += sc.dur;
      return s;
    });
    this.duration = t;
    this.transition = T;
    this.world.onTimeline?.(this.scenes, this.duration);

    const energy = { calm: 0.6, standard: 1, energetic: 1.5 }[ctx.energy] ?? 1;
    const tracks = this.scenes.map(s => ({ start: s.start, end: s.end, shot: this.shotFor(s, energy) }));
    this.rig.configure(tracks, { transition: T, style: look.transition?.style || 'whip', drift: (look.drift ?? 1) * energy, seed: ctx.seed % 1000 });
    this.renderFrame(Math.min(this.lastT, this.duration));
  }

  shotFor(s, energy) {
    const st = this.stage;
    const shot = s.inst.shot || {};
    const fov = shot.fov || (st.aspect < 0.8 ? 42 : 34);
    const frame = shot.frame || { w: 8, h: 5 };
    const layout = shot.layout || 'center';
    // Leave room for text: split = text left / 3D right; stack = text top / 3D below
    let fw = frame.w, fh = frame.h, ox = 0, oy = 0;
    const portrait = st.aspect < 0.95;
    if (layout === 'split' && !portrait) { fw = frame.w / 0.56; ox = -0.2; }
    else if ((layout === 'split' || layout === 'stack') && portrait) { fh = frame.h / 0.6; oy = 0.15; }
    else if (layout === 'stack') { fh = frame.h / 0.62; oy = 0.14; }
    else if (layout === 'stackBottom') { fh = frame.h / (portrait ? 0.6 : 0.62); oy = portrait ? -0.12 : -0.1; }
    else if (layout === 'low') { fh = frame.h / 0.7; oy = 0.08; }
    const dist = fitDistance(fw, fh, fov, st.aspect, shot.margin ?? 1.06);
    const vh = 2 * Math.tan(THREE.MathUtils.degToRad(fov) / 2) * dist;
    const vw = vh * st.aspect;
    // ox < 0 puts the subject right of center (camera pans left); oy > 0 puts it below center
    const targetOffset = new THREE.Vector3(ox * vw, oy * vh, 0).add(shot.offset || new THREE.Vector3());
    const preset = s.shot || shot.preset || 'push';
    const anchor = s.anchor.clone().add(shot.center || new THREE.Vector3());
    return makeShot(preset, { anchor, dist, fov, yaw: shot.yaw ?? 0, pitch: shot.pitch ?? 6, amount: energy, targetOffset });
  }

  /** Renders time t (seconds). Fully synchronous and deterministic. */
  renderFrame(t) {
    if (!this.world) return;
    this.lastT = t;
    const T = this.transition;
    const o = this.overlay;
    o.begin();

    // Focus the environment on the current scene (blend across the transition)
    let cur = this.scenes.findIndex(s => t < s.end);
    if (cur < 0) cur = this.scenes.length - 1;
    const sc = this.scenes[cur];
    const focus = sc.anchor.clone();
    if (cur < this.scenes.length - 1 && t > sc.end - T / 2) {
      focus.lerp(this.scenes[cur + 1].anchor, ease.inOutCubic(clamp((t - (sc.end - T / 2)) / T)));
    } else if (cur > 0 && t < sc.start + T / 2) {
      focus.copy(this.scenes[cur - 1].anchor).lerp(sc.anchor, ease.inOutCubic(clamp((t - (sc.start - T / 2)) / T)));
    }
    this.world.focus(focus);

    for (const s of this.scenes) {
      const lt = t - s.start;
      const active = t >= s.start - T * 1.2 && t <= s.end + T * 1.2;
      s.group.visible = active;
      if (!active) continue;
      const info = { dur: s.dur, k: clamp(lt / s.dur), t, T, first: s.index === 0, last: s.index === this.scenes.length - 1 };
      s.inst.update?.(lt, info);
    }
    this.rig.update(t);
    this.stage.camera.updateMatrixWorld();
    this.world.update(t);

    // Overlay pass: scenes draw their typography; adjacent scenes cross over during transitions
    for (const s of this.scenes) {
      const lt = t - s.start;
      if (t < s.start - T * 0.6 || t > s.end + T * 0.6) continue;
      const info = { dur: s.dur, k: clamp(lt / s.dur), t, T, first: s.index === 0, last: s.index === this.scenes.length - 1 };
      s.inst.draw?.(o, lt, info);
    }
    this.drawChrome(o, t);

    // Gentle fade in at the very start and out at the very end
    const fadeIn = 1 - ease.outCubic(seg(t, 0, 0.5));
    const fadeOut = ease.inCubic(seg(t, this.duration - 0.4, 0.4));
    this.stage.render(t, { fade: Math.max(fadeIn, fadeOut) * (this.project.fadeEdges === false ? 0 : 1), fadeColor: this.palette.fade || this.palette.bgBottom || '#ffffff' });
  }

  /** Brand bug, step chips and captions that sit above every scene. */
  drawChrome(o, t) {
    const p = this.project;
    const pal = this.palette;
    const cur = this.scenes.find(s => t < s.end) || this.scenes[this.scenes.length - 1];
    const isEnd = cur?.type === 'endcard' || cur?.type === 'intro';
    const showBug = p.chrome?.logo !== false && !isEnd;
    if (showBug) {
      const logo = this.logos[pal.dark ? 'taglineReversed' : 'tagline'];
      const w = (o.portrait ? 250 : 230) * o.U;
      const a = clamp(seg(t, 0.6, 0.6)) * (1 - seg(t, cur.end - 0.3, 0.3) * (this.scenes[this.scenes.length - 1] === cur ? 1 : 0));
      const y = o.safe.top * (o.portrait ? 0.55 : 0.5);
      o.logo(logo, o.portrait ? o.W / 2 : o.safe.left, y - 10 * o.U, w, { alpha: a * 0.96, align: o.portrait ? 'center' : 'left' });
    }
    // step chips (top right on wide formats)
    const steps = p.chrome?.steps;
    if (steps && steps.length && !o.portrait) {
      let x = o.W - o.safe.right;
      const y = o.safe.top * 0.5 - 22 * o.U;
      const activeLabel = cur?.step;
      for (let i = steps.length - 1; i >= 0; i--) {
        const on = steps[i] === activeLabel;
        const { w } = o.chip(steps[i].toUpperCase(), x, y, { align: 'right', size: 19 * o.U, bg: on ? pal.accent : 'rgba(0,0,0,0)', color: on ? '#ffffff' : pal.sub, stroke: on ? null : pal.line || 'rgba(0,0,0,0.15)', alpha: clamp(seg(t, 0.8, 0.5)) });
        x -= w + 10 * o.U;
      }
    }
    // burned-in captions
    if (p.captions?.on && Array.isArray(p.captions.lines)) {
      const line = p.captions.lines.find(c => t >= c.start && t < c.end);
      if (line) {
        const size = 40 * o.U;
        const y = o.H - o.safe.bottom * 0.62;
        const w = Math.min(o.measure(line.text, { size, weight: 700, family: 'body' }) + 56 * o.U, o.W - 80 * o.U);
        o.panel(o.W / 2 - w / 2, y - size * 1.25, w, size * 1.9, { fill: 'rgba(17,17,17,0.78)', stroke: false, r: 18 * o.U, shadow: false });
        o.text(line.text, o.W / 2, y, { size, weight: 700, family: 'body', color: '#ffffff', align: 'center' });
      }
    }
  }

  setFormat(format, scale) {
    this.project.format = format;
    this.stage.setFormat(format, scale ?? this.stage.scale);
    this.rebuild();
  }

  setScale(scale) {
    this.stage.setFormat(this.project.format, scale);
    this.renderFrame(this.lastT);
  }

  /** Scene boundaries, for the timeline UI. */
  timeline() {
    return this.scenes.map(s => ({ id: s.id, type: s.type, label: s.label || s.def.label, start: s.start, end: s.end, dur: s.dur }));
  }

  /** Sound-effect cues aligned to scene transitions and reveals. */
  cues() {
    const out = [];
    this.scenes.forEach((s, i) => {
      if (i > 0) out.push({ t: s.start - this.transition * 0.45, type: 'whoosh' });
      (s.inst.cues || []).forEach(c => out.push({ ...c, t: s.start + c.t }));
    });
    return out.filter(c => c.t >= 0 && c.t < this.duration);
  }

  snapshot(t, type = 'image/png', quality = 0.92) {
    this.renderFrame(t);
    return this.stage.canvas.toDataURL(type, quality);
  }

  disposeWorld() {
    if (this.world) this.world.dispose();
    this.world = null;
    this.scenes = [];
  }

  dispose() {
    this.disposeWorld();
    this.stage.dispose();
  }
}

export { FORMATS, BRAND };
