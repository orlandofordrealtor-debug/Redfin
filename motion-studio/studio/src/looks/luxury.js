// Luxury Listing: a dark, hushed showroom. Espresso-black space lit by one warm spotlight pool,
// a polished black floor, a fluted wall with champagne-gold inlays, black glass frames with thin
// gold edges, serif headlines and slow, gliding camera moves.
import * as THREE from 'three';
import { BaseWorld, setMatOpacity } from '../engine/world.js';
import * as M from '../engine/materials.js';
import { BRAND } from '../engine/brand.js';
import { slab } from '../engine/geo.js';
import { rng, noise1 } from '../engine/util.js';

const GOLD = '#D9B57C';        // champagne gold (metals, glow)
const GOLD_CHIP = '#9E7A44';   // deeper antique gold: carries white chip text on the native palette
const FACE_GOLD = '#E3C690';  // canvas-face highlight on black panels
const PUTTY = BRAND.putty;     // #F3EEE7 warm text
const ESPRESSO = '#0B0807';

export function luxuryPalette(mode = 'brand') {
  const brand = mode === 'brand';
  return {
    dark: true,
    bgTop: '#120E0B', bgBottom: '#040303',
    blobs: [
      { dir: [0, 0.28, -1], color: '#271C12', size: 0.4 },
      { dir: [-0.75, 0.55, -0.45], color: '#17110D', size: 0.5 },
      { dir: [0.8, 0.2, -0.5], color: '#160F0B', size: 0.45 },
    ],
    text: PUTTY, sub: 'rgba(243,238,231,0.70)',
    accent: brand ? BRAND.red : GOLD_CHIP,
    accent2: GOLD, accentText: '#FFFFFF',
    ink: PUTTY, glassTint: '#1A1612',
    decor: [GOLD, '#0E0C0B', PUTTY, GOLD],
    muted: '#3B3026', glow: '#F2D39C', line: 'rgba(217,181,124,0.38)', floorLine: GOLD,
    shadow: 0.55, scrim: '#070505', scrimAlpha: 0.5, fade: '#040303', logo: 'taglineReversed',
    gold: GOLD,
  };
}

/** Champagne gold that still supports the dissolve/rim hooks (M.gold has none). */
function goldMat(o = {}) {
  return M.satin(o.color || GOLD, { metalness: 1, roughness: o.roughness ?? 0.24, clearcoat: 0.5, env: o.env ?? 1.35, rim: 0.12, rimColor: '#FFE6B5', edgeColor: '#FFD27F' });
}

/** Polished black glass: glossy, nearly opaque, picks up crisp highlights from the room. */
function blackGlass(o = {}) {
  return M.satin(o.color || '#0A0908', { roughness: o.roughness ?? 0.1, clearcoat: 1, env: o.env ?? 1.0, rim: 0.1, rimColor: '#F4DDB4', edgeColor: '#FFD27F' });
}

function rrShape(w, h, r, s = new THREE.Shape()) {
  const x = -w / 2, y = -h / 2;
  r = Math.max(0.0005, Math.min(r, w / 2, h / 2));
  s.moveTo(x + r, y);
  s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r);
  s.lineTo(x + w, y + h - r); s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  s.lineTo(x + r, y + h); s.quadraticCurveTo(x, y + h, x, y + h - r);
  s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y);
  return s;
}

/** Flat rounded-rect outline of thickness t (outer size w x h). */
function hairline(w, h, r, t) {
  const s = rrShape(w, h, r);
  s.holes.push(rrShape(w - t * 2, h - t * 2, Math.max(0.0005, r - t), new THREE.Path()));
  return new THREE.ShapeGeometry(s, 10);
}

/** The back wall: fluted dark panels with champagne inlay lines, warmed by the spotlight pool. */
function wallMaterial({ base, flute, pool, line }) {
  return new THREE.ShaderMaterial({
    uniforms: {
      uBase: { value: new THREE.Color(base) }, uFlute: { value: new THREE.Color(flute) },
      uPool: { value: new THREE.Color(pool) }, uLine: { value: new THREE.Color(line) },
    },
    vertexShader: /* glsl */`
      varying vec3 vW; varying vec2 vL;
      void main() { vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; vL = position.xy; gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: /* glsl */`
      uniform vec3 uBase, uFlute, uPool, uLine;
      varying vec3 vW; varying vec2 vL;
      void main() {
        float x = vW.x;
        float f = fract(x / 0.9);
        float flute = pow(clamp(sin(f * 3.14159), 0.0, 1.0), 0.7);
        float h = vL.y;                                   // height above the floor
        float pool = exp(-pow(vL.x / 10.0, 2.0)) * exp(-pow(max(h - 2.5, 0.0) / 7.5, 2.0));
        vec3 col = mix(uBase, uFlute, flute * (0.35 + 0.65 * pool));
        col += uPool * pool;
        // gold inlays every 7.2 units, with a fainter pair beside each
        float d = abs(fract(x / 7.2 + 0.5) - 0.5) * 7.2;
        float aa = fwidth(x) * 1.2;
        float ln = 1.0 - smoothstep(0.012, 0.012 + aa, d);
        float ln2 = 1.0 - smoothstep(0.006, 0.006 + aa, abs(d - 0.22));
        float lineFade = (0.25 + 0.75 * pool) * (1.0 - smoothstep(4.0, 14.0, h));
        col += uLine * (ln + ln2 * 0.4) * lineFade;
        // floor contact shadow
        col *= mix(0.55, 1.0, smoothstep(0.0, 1.2, h));
        gl_FragColor = vec4(col, 1.0);
      }`,
  });
}

/** Polished dark floor with faked reflections (cheap enough for software WebGL renders). */
function floorMaterial({ base, pool, line, wallZ }) {
  return new THREE.ShaderMaterial({
    uniforms: {
      uBase: { value: new THREE.Color(base) }, uPool: { value: new THREE.Color(pool) }, uLine: { value: new THREE.Color(line) },
      uFocus: { value: new THREE.Vector3() }, uWallZ: { value: wallZ },
    },
    vertexShader: /* glsl */`
      varying vec3 vW;
      void main() { vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: /* glsl */`
      uniform vec3 uBase, uPool, uLine, uFocus; uniform float uWallZ;
      varying vec3 vW;
      void main() {
        vec2 L = vW.xz - uFocus.xz;
        float dWall = max(L.y - uWallZ, 0.0);
        float pool = exp(-pow(L.x / 6.5, 2.0) - pow((L.y + 0.5) / 4.5, 2.0));
        float sheen = exp(-pow(L.x / 14.0, 2.0)) * exp(-dWall / 4.0);
        vec3 col = uBase + uPool * (pool * 0.9 + sheen * 0.55);
        float d = abs(fract(vW.x / 7.2 + 0.5) - 0.5) * 7.2;
        float aa = fwidth(vW.x) * 1.5;
        float streak = 1.0 - smoothstep(0.015, 0.09 + aa, d);
        float streak2 = 1.0 - smoothstep(0.01, 0.05 + aa, abs(d - 0.22));
        col += uLine * (streak + streak2 * 0.35) * exp(-dWall / 5.0) * 0.22;
        col *= 1.0 - smoothstep(16.0, 55.0, length(L));
        gl_FragColor = vec4(col, 1.0);
      }`,
  });
}

class LuxuryWorld extends BaseWorld {
  constructor(ctx, mode) {
    super(ctx);
    this.mode = mode;
    this.style = 'luxe';
    this.floorY = -2.6;
  }

  materials() {
    const p = this.palette;
    const brand = this.mode === 'brand';
    return {
      frame: () => blackGlass(),
      panel: () => blackGlass({ color: '#0E0C0A', roughness: 0.16, env: 0.85 }),
      accent: () => (brand ? M.satin('#C92637', { clearcoat: 1, roughness: 0.26, rim: 0.15, rimColor: '#FFD9C4', edgeColor: '#FFD27F' }) : goldMat({ color: '#E6C48C', roughness: 0.18 })),
      glyph: () => goldMat(),
      decor: i => (i % 3 === 1 ? blackGlass() : i % 3 === 2 ? M.satin(PUTTY, { roughness: 0.28, clearcoat: 1 }) : goldMat()),
      ink: () => M.satin(PUTTY, { roughness: 0.3, clearcoat: 0.8 }),
      muted: () => M.satin('#4A3A2A', { metalness: 0.85, roughness: 0.38, clearcoat: 0.6, env: 1.1, rim: 0.08, edgeColor: '#FFD27F' }),
      glow: () => M.glow(p.glow, 2.0),
      line: () => M.flowMaterial({ color: GOLD, head: '#FFF1D6', intensity: 1.6 }),
    };
  }

  environment() {
    const p = this.palette;
    this.dome = new THREE.Mesh(new THREE.SphereGeometry(150, 48, 24), M.domeMaterial({ top: p.bgTop, bottom: p.bgBottom, blobs: p.blobs, noise: 0.008 }));
    this.dome.renderOrder = -10;
    this.stage.scene.add(this.dome);
    this.addLights({ hemiSky: '#FFE8CC', hemiGround: '#0A0706', hemi: 0.22, key: 1.25, keyColor: '#FFE0B6', fill: 0.28, fillColor: '#B9C6FF', shadowRadius: 10 });

    // One warm spotlight makes the pool of light the scene stands in
    const spot = new THREE.SpotLight('#FFD7A0', 340, 48, 0.5, 0.85, 2);
    spot.position.set(0.5, 13, 3.5);
    spot.target.position.set(0, this.floorY, -1.2);
    this.env.add(spot, spot.target);
    this.spot = spot;

    // Polished black stone floor: a dark gloss with the spotlight pool, the wall's warm glow and
    // the gold inlays reflected as soft streaks, plus a shadow pass on top
    this.floorMat = floorMaterial({ base: '#030202', pool: '#2A1B0F', line: GOLD, wallZ: -15 });
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(220, 220), this.floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = this.floorY;
    this.env.add(floor);
    const shade = new THREE.Mesh(new THREE.PlaneGeometry(220, 220), M.shadowFloor(p.shadow));
    shade.rotation.x = -Math.PI / 2;
    shade.position.y = this.floorY + 0.003;
    shade.receiveShadow = true;
    this.env.add(shade);

    // Fluted wall with gold inlays far behind every scene
    const wall = new THREE.Mesh(new THREE.PlaneGeometry(120, 44), wallMaterial({ base: '#050403', flute: '#100C09', pool: '#1F150C', line: '#C9A266' }));
    wall.geometry.translate(0, 22, 0);
    wall.position.set(0, this.floorY, -15);
    this.env.add(wall);

    // Warm dust motes drifting through the light (instanced, pure function of t)
    const N = 150;
    const r = rng((this.ctx.seed || 3) + 17);
    const mote = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 1), M.glow('#FFD9A3', 1.6), N);
    mote.frustumCulled = false;
    this.motes = { mesh: mote, parts: Array.from({ length: N }, () => ({ x: r.range(-11, 11), y: r.range(0, 9), z: r.range(-12, -2.2), s: r.range(0.012, 0.034), sp: r.range(0.04, 0.12), ph: r() * 50 })) };
    this.env.add(mote);
  }

  /** Card: black glass with a gold rim and a gold hairline around the photo. */
  card(opts = {}) {
    const g = super.card(opts);
    const { w, h } = g.userData;
    const depth = opts.depth ?? 0.12, radius = opts.radius ?? 0.14, bezel = opts.bezel ?? 0.09;
    const goldA = goldMat({ roughness: 0.22 });
    const rim = new THREE.Mesh(slab(w + 0.06, h + 0.06, depth * 0.5, radius + 0.03), goldA);
    rim.position.z = -depth * 0.12;
    g.add(rim);
    const goldB = M.satin(GOLD, { metalness: 1, roughness: 0.3, clearcoat: 0.3, env: 1.4, rim: 0 });
    const line = new THREE.Mesh(hairline(w - bezel * 2 + 0.05, h - bezel * 2 + 0.05, Math.max(0.03, radius - bezel * 0.6 + 0.025), 0.016), goldB);
    line.position.z = depth / 2 + 0.006;
    g.add(line);
    const base = g.userData.setOpacity;
    g.userData.setOpacity = a => { base(a); setMatOpacity(goldA, a); setMatOpacity(goldB, a); };
    return g;
  }

  /** Panel: black lacquer with a gold rim and an inset gold hairline. */
  panel(opts = {}) {
    // Canvas faces (stat values, checks, the leader's bar) print in champagne; the palette accent
    // (Redfin red in brand mode) stays for chips and the price.
    const pal = this.palette;
    const draw = opts.draw;
    const wrapped = draw ? (c, w, h, ...args) => {
      const prev = pal.accent;
      pal.accent = FACE_GOLD;
      try { draw(c, w, h, ...args); } finally { pal.accent = prev; }
    } : null;
    const g = super.panel({ ...opts, draw: wrapped });
    const { w, h } = g.userData;
    const depth = opts.depth ?? 0.1, radius = opts.radius ?? 0.16;
    const goldA = goldMat({ roughness: 0.22 });
    const rim = new THREE.Mesh(slab(w + 0.05, h + 0.05, depth * 0.5, radius + 0.025), goldA);
    rim.position.z = -depth * 0.12;
    g.add(rim);
    let goldB = null;
    if (Math.min(w, h) > 0.6) {
      goldB = M.satin(GOLD, { metalness: 1, roughness: 0.3, clearcoat: 0.3, env: 1.4, rim: 0 });
      const inset = Math.min(0.12, Math.min(w, h) * 0.05);
      const line = new THREE.Mesh(hairline(w - inset * 2, h - inset * 2, Math.max(0.02, radius - inset), 0.012), goldB);
      line.position.z = depth / 2 + 0.009;
      g.add(line);
    }
    const base = g.userData.setOpacity;
    g.userData.setOpacity = a => { base(a); setMatOpacity(goldA, a); if (goldB) setMatOpacity(goldB, a); };
    return g;
  }

  /** Every halo is champagne gold here, whatever color the scene asked for. */
  ring(r = 1, tube = 0.04) {
    return super.ring(r, tube * 0.8, this.mats.glow());
  }

  trail(points, opts = {}) {
    return super.trail(points, { ...opts, color: GOLD });
  }

  /**
   * Black glass monoliths with gold caps frame each scene and gold spheres drift slowly behind.
   * Props stay clear of the text side: split layouts keep them right of the subject.
   */
  onTimeline(scenes, duration) {
    const r = rng((this.ctx.seed || 5) + 101);
    this.props = [];
    const portrait = this.stage.aspect < 0.95;
    const colGeo = slab(1.0, 6.2, 0.7, 0.04);
    const capGeo = slab(1.08, 0.08, 0.78, 0.02);
    const inlayGeo = new THREE.BoxGeometry(0.03, 5.4, 0.02);
    const sphereGeo = new THREE.SphereGeometry(1, 48, 32);
    scenes.forEach(s => {
      const a = s.anchor;
      const layout = s.inst.shot?.layout || 'center';
      const split = !portrait && layout === 'split';
      const sides = split ? [1] : [-1, 1];
      if (!portrait) {
        sides.forEach(side => {
          const x = split ? r.range(5.8, 6.6) : side * r.range(7.2, 8.4);
          const z = split ? r.range(-6.8, -5.6) : r.range(-6.2, -4.4);
          const col = new THREE.Group();
          const body = new THREE.Mesh(colGeo, blackGlass({ roughness: 0.12 }));
          body.position.y = 3.1;
          body.castShadow = true;
          col.add(body);
          const capMat = goldMat({ roughness: 0.2 });
          [0.04, 6.16].forEach(y => { const c = new THREE.Mesh(capGeo, capMat); c.position.y = y; col.add(c); });
          const inlay = new THREE.Mesh(inlayGeo, M.glow(GOLD, 1.2));
          inlay.position.set(0, 3.1, 0.36);
          col.add(inlay);
          col.position.set(a.x + x, this.floorY, a.z + z);
          col.rotation.y = -Math.sign(x) * 0.35;
          this.root.add(col);
        });
      }
      // drifting spheres: gold and black glass, behind the content plane
      const n = s.inst.noDecor ? 0 : 3;
      for (let i = 0; i < n; i++) {
        const side = split ? 1 : (i % 2 ? 1 : -1);
        const rad = r.range(0.16, 0.34) * (i === 0 ? 1.5 : 1);
        const mesh = new THREE.Mesh(sphereGeo, i === 1 ? blackGlass() : goldMat({ roughness: 0.16 }));
        mesh.scale.setScalar(rad);
        mesh.castShadow = true;
        const base = portrait
          ? new THREE.Vector3(side * r.range(2.2, 3.6), r.range(-1.6, 1.4), r.range(-7, -3.5))
          : split
            ? new THREE.Vector3(r.range(3.2, 6.4), r.range(-0.8, 3.2), r.range(-7.5, -3.5))
            : new THREE.Vector3(side * r.range(5.2, 7.2), r.range(-0.6, 3.2), r.range(-6.5, -2.4));
        base.add(a);
        mesh.position.copy(base);
        this.root.add(mesh);
        this.props.push({ mesh, base, phase: r() * 10, amp: r.range(0.12, 0.26) });
      }
    });
    this.duration = duration;
  }

  update(t) {
    super.update(t);
    if (this.floorMat) this.floorMat.uniforms.uFocus.value.copy(this.env.position);
    for (const d of this.props || []) {
      d.mesh.position.y = d.base.y + Math.sin(t * 0.38 + d.phase) * d.amp;
      d.mesh.position.x = d.base.x + noise1(t * 0.12 + d.phase, 5) * 0.2;
      d.mesh.rotation.y = t * 0.15 + d.phase;
    }
    if (this.motes) {
      const { mesh, parts } = this.motes;
      const m4 = _m4, q = _q, p = _p, s = _s;
      for (let i = 0; i < parts.length; i++) {
        const P = parts[i];
        const y = ((P.y + t * P.sp) % 9 + 9) % 9;
        p.set(P.x + Math.sin(t * 0.21 + P.ph) * 0.35, this.floorY + 0.3 + y, P.z + Math.cos(t * 0.17 + P.ph) * 0.25);
        const tw = 0.55 + 0.45 * Math.sin(t * 1.3 + P.ph * 3.1);
        const fade = Math.min(1, y / 1.2, (9 - y) / 1.5);
        s.setScalar(P.s * tw * Math.max(0, fade));
        m4.compose(p, q, s);
        mesh.setMatrixAt(i, m4);
      }
      mesh.instanceMatrix.needsUpdate = true;
    }
    if (this.keyLight) {
      this.keyLight.target.position.set(0, 0, 0);
      this.keyLight.position.set(5, 13, 8);
    }
  }
}

const _m4 = new THREE.Matrix4(), _q = new THREE.Quaternion(), _p = new THREE.Vector3(), _s = new THREE.Vector3();

export default {
  id: 'luxury',
  name: 'Luxury Listing',
  family: 'Luxury',
  description: 'A dark, hushed showroom: warm spotlight, polished black floor, gold-edged black glass and serif type.',
  bestFor: 'Luxury listings, Premier homes, high-end open houses, milestone sales',
  swatch: ['#120E0B', '#040303', '#D9B57C', '#F3EEE7'],
  native: 'native',
  post: {
    bloom: { strength: 0.6, radius: 0.7, threshold: 1.0 },
    grain: 0.034, vignette: 0.5, ca: 0.0014, tone: 'neutral', exposure: 1.0, vignetteColor: '#000000', scanlines: 0, band: 0,
  },
  transition: { style: 'glide', duration: 1.3 },
  drift: 0.45,
  palette: mode => luxuryPalette(mode === 'native' ? 'native' : 'brand'),
  overlayTheme: p => ({
    text: p.text, sub: p.sub, accent: p.accent, accentText: '#FFFFFF', scrim: p.scrim, scrimAlpha: p.scrimAlpha,
    chipBg: p.accent, chipText: '#FFFFFF', panel: 'rgba(14,11,9,0.86)', panelStroke: 'rgba(217,181,124,0.45)', dark: true,
    mono: 'rgba(243,238,231,0.6)', displayFamily: 'serif', displayWeight: 600, displayStyle: null,
  }),
  create: ctx => new LuxuryWorld(ctx, ctx.project?.brand?.mode === 'native' ? 'native' : 'brand'),
};
