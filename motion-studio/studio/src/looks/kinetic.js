// Kinetic Type: text first, fast and punchy. Flat bold color fields that alternate scene by scene
// and wipe across on every cut, big flat slabs and bars that snap in and out in sync with the
// scenes, cel-shaded objects with hard offset shadows, and no gloss or glow except on accents.
import * as THREE from 'three';
import { BaseWorld, setMatOpacity } from '../engine/world.js';
import * as M from '../engine/materials.js';
import { BRAND } from '../engine/brand.js';
import { slab } from '../engine/geo.js';
import { rng, clamp, ease } from '../engine/util.js';

const INK = '#111111';
const CUT = 0.6;   // transition seconds: the wipe and the slabs are timed to it

/**
 * Two tones per palette alternate by scene index. Text color never changes within a palette
 * (white on brand, ink on native), so every tone is chosen to carry that text.
 *   safe: colors that may sit behind text; thin: the text color, only ever used as thin bars.
 */
const TONES = {
  brand: [
    { field: BRAND.red, chip: INK, frame: INK, panel: INK, edge: '#FFFFFF', shadow: '#8E1420', face: '#FF4D5A', glyph: '#FFFFFF', mark: '#FFFFFF', accent: INK, muted: '#FFFFFF', ring: '#FFFFFF', line: '#FFFFFF', decor: [INK, '#FFFFFF', '#A81E2B'], safe: [INK, '#A81E2B', '#C42633'], thin: '#FFFFFF' },
    { field: '#121212', chip: BRAND.red, frame: BRAND.red, panel: '#262626', edge: BRAND.red, shadow: BRAND.red, face: '#FF4D5A', glyph: BRAND.red, mark: BRAND.red, accent: BRAND.red, muted: '#F2F0EE', ring: BRAND.red, line: BRAND.red, decor: [BRAND.red, '#F2F0EE', '#3A3A3A'], safe: [BRAND.red, '#3A3A3A', '#B3202E'], thin: '#FFFFFF' },
  ],
  native: [
    { field: '#FFE600', chip: INK, frame: '#FFFFFF', panel: '#FFFFFF', edge: INK, shadow: INK, face: INK, glyph: INK, mark: INK, accent: INK, muted: '#FFFFFF', ring: INK, line: INK, decor: [INK, '#FFFFFF', '#FFB800'], safe: ['#FFF7A8', '#F2C200', '#C6F432'], thin: INK },
    { field: '#C6F432', chip: INK, frame: '#FFFFFF', panel: '#FFFFFF', edge: INK, shadow: INK, face: INK, glyph: INK, mark: INK, accent: INK, muted: '#FFFFFF', ring: INK, line: INK, decor: [INK, '#FFFFFF', '#9ED400'], safe: ['#EBFFB0', '#9FD000', '#FFE600'], thin: INK },
  ],
};

export function kineticPalette(mode = 'brand') {
  const T = TONES[mode === 'native' ? 'native' : 'brand'];
  if (mode === 'native') {
    return {
      dark: false,
      bgTop: T[0].field, bgBottom: T[0].field, blobs: [],
      text: '#0A0A0A', sub: 'rgba(10,10,10,0.74)', accent: INK, accent2: '#FFFFFF', accentText: '#FFFFFF',
      ink: INK, glassTint: '#ffffff', decor: T[0].decor, muted: '#FFFFFF', glow: INK, line: 'rgba(10,10,10,0.25)', floorLine: INK,
      shadow: 0, scrim: T[0].field, scrimAlpha: 0, fade: T[0].field, logo: 'tagline', tones: T,
    };
  }
  return {
    dark: true,
    bgTop: T[0].field, bgBottom: T[0].field, blobs: [],
    text: '#FFFFFF', sub: 'rgba(255,255,255,0.88)', accent: BRAND.red, accent2: '#FFFFFF', accentText: '#FFFFFF',
    ink: '#FFFFFF', glassTint: '#ffffff', decor: T[0].decor, muted: '#FFFFFF', glow: '#FFFFFF', line: 'rgba(255,255,255,0.3)', floorLine: '#FFFFFF',
    shadow: 0, scrim: INK, scrimAlpha: 0, fade: T[0].field, logo: 'taglineReversed', tones: T,
  };
}

/** Flat color field with a hard diagonal wipe from one tone to the next (screen space). */
function fieldMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: { uA: { value: new THREE.Color() }, uB: { value: new THREE.Color() }, uK: { value: 0 }, uRes: { value: new THREE.Vector2(1920, 1080) } },
    vertexShader: /* glsl */`void main() { gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */`
      uniform vec3 uA, uB; uniform float uK; uniform vec2 uRes;
      void main() {
        vec2 sp = gl_FragCoord.xy / uRes;
        float d = sp.x + (sp.y - 0.5) * 0.42;
        float edge = mix(1.3, -0.3, uK);
        float aa = fwidth(d) * 1.2;
        gl_FragColor = vec4(mix(uA, uB, smoothstep(edge - aa, edge + aa, d)), 1.0);
      }`,
    side: THREE.BackSide, depthWrite: false,
  });
}

/**
 * Big slab layouts in screen units (x across, y up, both -1..1 of the visible half-size), behind the
 * content. They only use the tone's "safe" colors, which carry the text color, so they may cross text.
 */
const LAYOUTS = [
  [ // diagonal band
    { x: 0.08, y: -0.2, w: 3.4, h: 0.5, r: -0.2, c: 0 },
    { x: 0.84, y: 0.66, w: 0.62, h: 0.9, r: 0, c: 1 },
  ],
  [ // pillar and floor bar
    { x: 0.74, y: 0.05, w: 0.5, h: 2.6, r: 0.07, c: 0 },
    { x: -0.35, y: -0.78, w: 2.2, h: 0.32, r: 0, c: 2 },
  ],
  [ // two-tone split
    { x: -0.82, y: 0, w: 1.25, h: 2.8, r: 0.13, c: 1 },
    { x: 0.7, y: -0.58, w: 0.42, h: 0.75, r: 0.785, c: 0 },
  ],
  [ // stripes
    { x: -0.2, y: 0.55, w: 3.2, h: 0.2, r: 0.16, c: 0 },
    { x: 0.1, y: -0.45, w: 3.2, h: 0.34, r: 0.16, c: 1 },
  ],
];

/** Thin text-colored bars live only at the frame edges, clear of every text zone and the logo. */
const THIN = {
  wide: [
    [{ x: 0.3, y: -0.945, w: 1.4, h: 0.02 }],
    [{ x: 0.74, y: 0.86, w: 0.4, h: 0.02 }, { x: 0.78, y: 0.8, w: 0.32, h: 0.02 }],
    [{ x: -0.35, y: -0.945, w: 1.1, h: 0.02 }, { x: 0.8, y: 0.86, w: 0.28, h: 0.02 }],
  ],
  tall: [
    [{ x: 0.0, y: -0.955, w: 1.5, h: 0.011 }],
    [{ x: -0.7, y: 0.93, w: 0.36, h: 0.011 }, { x: -0.66, y: 0.895, w: 0.28, h: 0.011 }],
    [{ x: 0.7, y: 0.93, w: 0.36, h: 0.011 }, { x: 0.66, y: 0.895, w: 0.28, h: 0.011 }],
  ],
};

class KineticWorld extends BaseWorld {
  constructor(ctx, mode) {
    super(ctx);
    this.mode = mode;
    this.style = 'paper';
    this.tones = this.palette.tones;
    this.buildTone = this.tones[0];
    const grad = new THREE.DataTexture(new Uint8Array([140, 255]), 2, 1, THREE.RedFormat);
    grad.minFilter = grad.magFilter = THREE.NearestFilter;
    grad.needsUpdate = true;
    this.gradient = this.track(grad);
  }

  /** Cel-shaded, matte: two flat tones, no gloss. Supports the dissolve hook. */
  toon(color, edge = '#FFFFFF') {
    const m = new THREE.MeshToonMaterial({ color, gradientMap: this.gradient });
    return M.enhance(m, { rim: 0, edgeColor: edge, edgeIntensity: 3 });
  }

  /** Scene i is built right after anchorFor(i): pick that scene's tone for everything it creates. */
  anchorFor(i) {
    this.buildTone = this.tones[i % this.tones.length];
    return super.anchorFor(i);
  }

  materials() {
    const tone = () => this.buildTone;
    return {
      frame: () => this.toon(tone().frame),
      panel: () => this.toon(tone().panel),
      accent: () => this.toon(tone().accent),
      glyph: () => this.toon(tone().glyph, tone().thin),
      decor: i => this.toon(tone().decor[i % tone().decor.length]),
      ink: () => this.toon(this.mode === 'native' ? INK : '#FFFFFF'),
      muted: () => this.toon(tone().muted),
      glow: () => new THREE.MeshBasicMaterial({ color: tone().ring }),
      line: () => M.flowMaterial({ color: tone().line, head: tone().line, intensity: 1 }),
    };
  }

  environment() {
    this.fieldMat = fieldMaterial();
    this.dome = new THREE.Mesh(new THREE.SphereGeometry(150, 32, 16), this.fieldMat);
    this.dome.renderOrder = -10;
    this.stage.scene.add(this.dome);
    this.addLights({ hemiSky: '#FFFFFF', hemiGround: '#FFFFFF', hemi: 2.1, key: 1.3, keyColor: '#FFFFFF', fill: 0, shadowRadius: 1 });
    this.keyLight.castShadow = false;
    this.slabGroup = new THREE.Group();
    this.root.add(this.slabGroup);            // root sits at the origin, so local = world
  }

  /** Hard offset shadow + flat edge, the graphic signature of this look. */
  addFlatBacking(g, w, h, depth, radius, tone, withEdge = true) {
    const mats = [];
    if (withEdge) {
      const em = new THREE.MeshBasicMaterial({ color: tone.edge });
      const e = new THREE.Mesh(slab(w + 0.09, h + 0.09, depth * 0.4, radius + 0.045), em);
      e.position.z = -depth * 0.1;
      g.add(e);
      mats.push(em);
    }
    const sm = new THREE.MeshBasicMaterial({ color: tone.shadow });
    const s = new THREE.Mesh(slab(w + 0.09, h + 0.09, depth * 0.4, radius + 0.045), sm);
    s.position.set(0.16, -0.16, -depth * 0.6);
    g.add(s);
    mats.push(sm);
    return mats;
  }

  panel(opts = {}) {
    const tone = this.buildTone;
    const pal = this.palette;
    const draw = opts.draw;
    // canvas faces print their highlight in the scene's tone
    const wrapped = draw ? (c, w, h, ...args) => {
      const prev = pal.accent;
      pal.accent = tone.face;
      try { draw(c, w, h, ...args); } finally { pal.accent = prev; }
    } : null;
    const g = super.panel({ ...opts, draw: wrapped });
    const { w, h } = g.userData;
    const mats = this.addFlatBacking(g, w, h, opts.depth ?? 0.1, opts.radius ?? 0.16, tone, Math.min(w, h) > 0.3);
    const base = g.userData.setOpacity;
    g.userData.setOpacity = a => { base(a); mats.forEach(m => setMatOpacity(m, a)); };
    return g;
  }

  card(opts = {}) {
    const g = super.card(opts);
    const { w, h } = g.userData;
    const mats = this.addFlatBacking(g, w, h, opts.depth ?? 0.12, opts.radius ?? 0.14, this.buildTone, false);
    const base = g.userData.setOpacity;
    g.userData.setOpacity = a => { base(a); mats.forEach(m => setMatOpacity(m, a)); };
    return g;
  }

  /** Chart bars get flat side edges in the tone's edge color so they never merge into a slab. */
  bars(values, opts = {}) {
    const g = super.bars(values, opts);
    const tone = this.buildTone;
    const width = opts.width ?? 0.6, depth = opts.depth ?? 0.6;
    const mat = new THREE.MeshBasicMaterial({ color: tone.edge });
    const geo = slab(width + 0.09, 1.0, depth * 0.4, Math.min(0.08, width * 0.2));
    g.userData.meshes.forEach(m => {
      const e = new THREE.Mesh(geo, mat);
      e.position.z = -depth * 0.32;
      m.add(e);
    });
    return g;
  }

  /** Rings are flat strokes in the tone's color: graphic, never glowing. */
  ring(r = 1, tube = 0.04) {
    const mesh = new THREE.Mesh(new THREE.TorusGeometry(r, Math.max(0.014, tube * 1.1), 6, 128), new THREE.MeshBasicMaterial({ color: this.buildTone.ring }));
    return mesh;
  }

  logo3d(key = 'redfin', opts = {}) {
    return super.logo3d(key, { ...opts, material: opts.material || this.toon(this.buildTone.mark) });
  }

  trail(points, opts = {}) {
    return super.trail(points, { ...opts, color: this.buildTone.line });
  }

  onTimeline(scenes, duration) {
    this.buildTone = this.tones[0];
    this.scenesRef = scenes;
    this.duration = duration;
    this.T = CUT;
    const r = rng((this.ctx.seed || 3) + 7);
    const geo = new THREE.BoxGeometry(1, 1, 0.02);
    let last = -1;
    // Text first: the big-message scene is pure type here, so its ornament behind the words goes
    scenes.forEach(s => { if (s.type === 'message') s.group.children.forEach(c => { c.visible = false; }); });
    this.slabSets = scenes.map((s, si) => {
      const tone = this.tones[si % this.tones.length];
      let li = Math.floor(r() * LAYOUTS.length);
      if (li === last) li = (li + 1) % LAYOUTS.length;
      last = li;
      const flip = r() < 0.5 ? -1 : 1;
      const group = new THREE.Group();
      group.visible = false;
      this.slabGroup.add(group);
      const portrait = this.stage.aspect < 0.95;
      const thinSets = THIN[portrait ? 'tall' : 'wide'];
      const hasSteps = !portrait && this.ctx.project?.chrome?.steps?.length;
      let thin = thinSets[si % thinSets.length];
      if (hasSteps) thin = thin.filter(L => L.y < 0);
      const specs = [
        ...LAYOUTS[li].map(L => ({ ...L, x: L.x * flip, r: L.r * flip, color: tone.safe[L.c % tone.safe.length] })),
        ...thin.map(L => ({ ...L, r: 0, thin: true, color: tone.thin })),
      ];
      const items = specs.map((L, j) => {
        const mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: L.color }));
        mesh.renderOrder = -5 + j * 0.01;
        group.add(mesh);
        // slide along the slab's long axis: in from one side, out through the other
        const along = L.w >= L.h ? new THREE.Vector2(Math.cos(L.r), Math.sin(L.r)) : new THREE.Vector2(-Math.sin(L.r), Math.cos(L.r));
        const sign = (j % 2 ? -1 : 1) * flip;
        return { mesh, L, dir: along.multiplyScalar(sign), delay: j * 0.05 };
      });
      return { group, items, s };
    });
  }

  /** Which tone the backdrop shows at t, and the wipe between neighbours. */
  fieldAt(t) {
    const sc = this.scenesRef || [];
    const T = this.T || CUT;
    let i = sc.findIndex(s => t < s.end);
    if (i < 0) i = sc.length - 1;
    const tone = k => this.tones[k % this.tones.length];
    if (i < sc.length - 1 && t > sc[i].end - T / 2) {
      return { a: tone(i), b: tone(i + 1), k: ease.inOutExpo(clamp((t - (sc[i].end - T / 2)) / T)) };
    }
    if (i > 0 && t < sc[i].start + T / 2) {
      return { a: tone(i - 1), b: tone(i), k: ease.inOutExpo(clamp((t - (sc[i].start - T / 2)) / T)) };
    }
    return { a: tone(i), b: tone(i), k: 0 };
  }

  update(t) {
    super.update(t);
    const cam = this.stage.camera;
    const f = this.fieldAt(t);
    const u = this.fieldMat.uniforms;
    u.uA.value.set(f.a.field);
    u.uB.value.set(f.b.field);
    u.uK.value = f.k;
    u.uRes.value.set(this.stage.pw, this.stage.ph);
    // chips follow the tone on screen (the switch lands mid-wipe)
    const cur = f.k >= 0.5 ? f.b : f.a;
    const th = this.ctx.overlay?.theme;
    if (th) { th.accent = cur.chip; th.chipBg = cur.chip; }
    this.palette.fade = cur.field;   // the opening and closing fades land on the field on screen

    // camera-locked slab plane, a few units behind the scene in focus
    const D = cam.position.distanceTo(this.focusPoint) + 4.5;
    cam.getWorldDirection(_v);
    this.slabGroup.position.copy(cam.position).addScaledVector(_v, D);
    this.slabGroup.quaternion.copy(cam.quaternion);
    const hh = Math.tan(THREE.MathUtils.degToRad(cam.fov / 2)) * D;
    const hw = hh * cam.aspect;
    const T = this.T;
    const travel = 2.6 * Math.max(hw, hh);
    for (const set of this.slabSets || []) {
      const { s } = set;
      const live = t > s.start - T * 0.6 && t < s.end + T * 0.4;
      set.group.visible = live;
      if (!live) continue;
      for (const it of set.items) {
        const { L } = it;
        const kin = ease.outExpo(clamp((t - (s.start - T * 0.3) - it.delay) / 0.5));
        const kout = inExpo(clamp((t - (s.end - T * 0.45) - it.delay * 0.5) / 0.38));
        const off = (1 - kin) * -travel + kout * travel;
        it.mesh.position.set(L.x * hw + it.dir.x * off, L.y * hh + it.dir.y * off, 0);
        it.mesh.rotation.z = L.r;
        const horiz = L.w >= L.h;
        it.mesh.scale.set(L.thin && !horiz ? Math.max(0.03, L.w * hw) : L.w * hw, L.thin && horiz ? Math.max(0.035, L.h * hh) : L.h * hh, 1);
      }
    }
  }
}

const _v = new THREE.Vector3();
const inExpo = x => (x <= 0 ? 0 : Math.pow(2, 10 * x - 10));

export default {
  id: 'kinetic',
  name: 'Kinetic Type',
  family: 'Type',
  description: 'Text first, fast and punchy: bold flat color that flips every scene, with slabs that snap in on the beat.',
  bestFor: 'Announcements, tips, recruiting hooks, short social posts, quotes',
  swatch: ['#DE3341', '#121212', '#FFFFFF', '#111111'],
  native: 'native',
  post: {
    bloom: { strength: 0.25, radius: 0.4, threshold: 1.6 },
    grain: 0.012, vignette: 0.0, ca: 0.0, tone: 'neutral', exposure: 1.0, vignetteColor: '#000000', scanlines: 0, band: 0,
  },
  transition: { style: 'whip', duration: CUT },
  drift: 0.35,
  palette: mode => kineticPalette(mode === 'native' ? 'native' : 'brand'),
  overlayTheme: p => ({
    text: p.text, sub: p.sub, accent: p.tones[0].chip, accentText: '#FFFFFF', scrim: p.scrim, scrimAlpha: 0,
    chipBg: p.tones[0].chip, chipText: '#FFFFFF', panel: p.dark ? 'rgba(17,17,17,0.92)' : 'rgba(255,255,255,0.95)',
    panelStroke: p.dark ? 'rgba(255,255,255,0.9)' : 'rgba(17,17,17,0.9)', dark: p.dark,
    displayFamily: 'display', displayWeight: 800, displayStyle: 'italic',
  }),
  create: ctx => new KineticWorld(ctx, ctx.project?.brand?.mode === 'native' ? 'native' : 'brand'),
};
