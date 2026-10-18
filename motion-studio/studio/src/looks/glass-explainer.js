// Glass Explainer: a dark space lit by a huge dome of soft violet, orange, blue and pink light.
// Scenes sit at different 3D positions; the camera drifts within each one and whips between them.
// Frosted glass panels carry live white UI on their faces, clear glass shapes with dispersion and
// small glowing orbs float around for parallax, and one glowing trail threads every scene, drawing
// on as the story moves forward with a bright comet head.
import * as THREE from 'three';
import { BaseWorld } from '../engine/world.js';
import * as M from '../engine/materials.js';
import { BRAND } from '../engine/brand.js';
import { rng, clamp, ease, seg, lerp } from '../engine/util.js';
import { sceneView, propClear, bindEnv, roundBody } from './clay.js';

const TRANSITION = 1.0;

export function explainerPalette(mode = 'brand') {
  const base = {
    dark: true,
    bgTop: '#0A0814', bgBottom: '#030306',
    text: '#FFFFFF', sub: 'rgba(255,255,255,0.76)', accentText: '#FFFFFF',
    ink: '#F4F1FA', glassTint: '#ffffff', shadow: 0,
    line: 'rgba(255,255,255,0.22)', floorLine: '#ffffff',
    scrim: '#07060C', scrimAlpha: 0.5, fade: '#040308', logo: 'taglineReversed',
  };
  if (mode === 'native') {
    return {
      ...base,
      blobs: [
        { dir: [-0.7, 0.3, -0.65], color: '#6A3AE0', size: 0.46, k: 0.42 },
        { dir: [0.75, 0.0, -0.65], color: '#F07A3C', size: 0.4, k: 0.34 },
        { dir: [0.1, -0.45, -0.9], color: '#2F63E8', size: 0.46, k: 0.32 },
        { dir: [0.3, 0.6, -0.75], color: '#E0479A', size: 0.38, k: 0.28 },
        { dir: [-0.25, -0.15, -1], color: '#3B22A0', size: 0.42, k: 0.22 },
      ],
      rimTint: '#E6DCFF',
      accent: '#FF8A4C', accent2: '#B794FF', glow: '#FFB08A',
      orbs: ['#FF8A4C', '#B794FF', '#7FB2FF', '#FF8FC8', '#FFD2B0'],
      decor: ['#FF8A4C', '#F4F1FA', '#9C7BFF'],
      muted: '#CFC6FF', panelTint: '#F2EEFF',
    };
  }
  return {
    ...base,
    blobs: [
      { dir: [-0.7, 0.3, -0.65], color: '#4E26A0', size: 0.46, k: 0.42 },
      { dir: [0.75, 0.0, -0.65], color: '#E35A40', size: 0.4, k: 0.34 },
      { dir: [0.1, -0.45, -0.9], color: '#8E1529', size: 0.46, k: 0.34 },
      { dir: [0.3, 0.6, -0.75], color: '#A3305F', size: 0.38, k: 0.24 },
      { dir: [-0.25, -0.15, -1], color: '#2C1664', size: 0.42, k: 0.26 },
    ],
    rimTint: '#FFE4E0',
    accent: BRAND.red, accent2: '#FF8A7A', glow: BRAND.redGlow,
    orbs: [BRAND.redGlow, '#FF9A7A', '#B48CFF', '#FFC9B8', '#FF6F91'],
    decor: [BRAND.red, '#F6F1EE', '#FF8A7A'],
    muted: '#F3D6D6', panelTint: '#FFF1F0',
  };
}

/** Nebula dome: soft additive light blobs that slowly drift as the camera travels deeper. */
function nebulaMaterial(p) {
  const B = 5;
  const pos = [], col = [], size = [];
  for (let i = 0; i < B; i++) {
    const b = p.blobs[i];
    pos.push(b ? new THREE.Vector3(...b.dir).normalize() : new THREE.Vector3(0, -1, 0));
    col.push(b ? new THREE.Color(b.color).multiplyScalar(b.k ?? 0.5) : new THREE.Color(0, 0, 0));
    size.push(b ? b.size : 0);
  }
  return new THREE.ShaderMaterial({
    uniforms: {
      uTop: { value: new THREE.Color(p.bgTop) }, uBottom: { value: new THREE.Color(p.bgBottom) },
      uBlobPos: { value: pos }, uBlobCol: { value: col }, uBlobSize: { value: size }, uPhase: { value: 0 },
    },
    vertexShader: /* glsl */`
      varying vec3 vDir;
      void main() { vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */`
      uniform vec3 uTop, uBottom; uniform float uPhase;
      uniform vec3 uBlobPos[${B}]; uniform vec3 uBlobCol[${B}]; uniform float uBlobSize[${B}];
      varying vec3 vDir;
      float hash(vec3 p) { p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
      float vnoise(vec3 p) {
        vec3 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
        return mix(mix(mix(hash(i), hash(i + vec3(1,0,0)), f.x), mix(hash(i + vec3(0,1,0)), hash(i + vec3(1,1,0)), f.x), f.y),
                   mix(mix(hash(i + vec3(0,0,1)), hash(i + vec3(1,0,1)), f.x), mix(hash(i + vec3(0,1,1)), hash(i + vec3(1,1,1)), f.x), f.y), f.z);
      }
      vec3 rotY(vec3 d, float a) { float c = cos(a), s = sin(a); return vec3(c * d.x + s * d.z, d.y, -s * d.x + c * d.z); }
      void main() {
        vec3 d = normalize(vDir);
        vec3 col = mix(uBottom, uTop, smoothstep(-0.7, 0.9, d.y));
        float n = vnoise(d * 3.0 + vec3(uPhase * 0.6, 0.0, uPhase * 0.3)) * 0.6 + vnoise(d * 7.0 - vec3(0.0, uPhase * 0.4, 0.0)) * 0.4;
        for (int i = 0; i < ${B}; i++) {
          if (uBlobSize[i] <= 0.0) continue;
          float fi = float(i);
          vec3 bp = rotY(uBlobPos[i], 0.5 * sin(uPhase * (0.7 + 0.23 * fi) + fi * 1.9));
          bp = normalize(bp + vec3(0.0, sin(uPhase * 0.9 + fi * 2.3) * 0.18, 0.0));
          float k = exp(-pow(distance(d, bp) / max(uBlobSize[i], 1e-3), 2.0));
          col += uBlobCol[i] * k * (0.7 + 0.6 * n);
        }
        col += (hash(d * 733.0) - 0.5) * (2.0 / 255.0);
        gl_FragColor = vec4(max(col, 0.0), 1.0);
      }`,
    side: THREE.BackSide, depthWrite: false,
  });
}

/** Trail shader: energy flows toward a bright comet head; the tail stays softly lit. */
function trailMaterial({ color, head = '#ffffff', length = 100, intensity = 2.4 }) {
  return new THREE.ShaderMaterial({
    uniforms: {
      uColor: { value: new THREE.Color(color) }, uHead: { value: new THREE.Color(head) }, uLen: { value: length },
      uProgress: { value: 0 }, uTime: { value: 0 }, uIntensity: { value: intensity }, uOpacity: { value: 1 },
    },
    vertexShader: /* glsl */`
      varying vec2 vUv;
      void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */`
      uniform vec3 uColor, uHead; uniform float uLen, uProgress, uTime, uIntensity, uOpacity;
      varying vec2 vUv;
      void main() {
        if (vUv.x > uProgress) discard;
        float behind = max(0.0, (uProgress - vUv.x) * uLen);
        float pulse = 0.5 + 0.5 * sin(vUv.x * uLen * 1.3 - uTime * 7.0);
        float tail = 0.32 + 0.68 * exp(-behind / 22.0);
        float head = exp(-pow(behind / 1.1, 2.0));
        vec3 col = uColor * uIntensity * tail * (0.7 + 0.3 * pulse) + uHead * head * 5.0;
        gl_FragColor = vec4(col, uOpacity);
      }`,
    transparent: true, depthWrite: false,
  });
}

/** Soft round sprite for the dust field. */
function dotSprite() {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const x = c.getContext('2d');
  const g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.35, 'rgba(255,255,255,0.55)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = g;
  x.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

class ExplainerWorld extends BaseWorld {
  constructor(ctx) {
    super(ctx);
    this.style = 'glass';
    this.props = [];
  }

  /** Scenes float at different heights and depths along a gently winding path. */
  anchorFor(i) {
    return new THREE.Vector3(i * 21 + Math.sin(i * 1.7) * 6, Math.sin(i * 0.9 + 0.4) * 3.2, -i * 38 + Math.cos(i * 1.3) * 4);
  }

  glassMat(o = {}) {
    return bindEnv(M.glass(o), this.stage, o.env ?? 1);
  }

  materials() {
    const p = this.palette;
    const satin = (c, o = {}) => bindEnv(M.satin(c, { clearcoat: 1, roughness: 0.2, edgeColor: '#FFE7D6', ...o }), this.stage, o.env ?? 0.9);
    return {
      frame: () => this.glassMat({ tint: '#ffffff', roughness: 0.28, thickness: 0.6, transmission: 1, env: 1.0 }),
      panel: () => this.glassMat({ tint: p.panelTint, roughness: 0.4, thickness: 0.7, transmission: 1, ior: 1.42, env: 0.85 }),
      accent: () => satin(p.accent, { emissive: p.accent, emissiveIntensity: 0.12 }),
      glyph: () => satin(p.accent, { roughness: 0.2, rim: 0.22, rimColor: '#FFE2D2', emissive: p.accent, emissiveIntensity: 0.05 }),
      decor: i => {
        if (i % 3 === 0) return this.glassMat({ tint: '#ffffff', roughness: 0.04, thickness: 1.2, ior: 1.5, env: 1.2, dispersion: 0.3 });
        return satin(p.decor[i % p.decor.length], { roughness: 0.18 });
      },
      ink: () => satin(p.ink, { roughness: 0.28 }),
      muted: () => {
        const m = this.glassMat({ tint: p.muted, roughness: 0.34, thickness: 0.8, env: 0.8 });
        m.emissive.set(p.muted);
        m.emissiveIntensity = 0.16;
        return m;
      },
      glow: () => M.glow(p.glow, 2.6),
      line: () => M.flowMaterial({ color: p.accent, head: '#ffffff' }),
    };
  }

  environment() {
    const p = this.palette;
    this.dome = new THREE.Mesh(new THREE.SphereGeometry(150, 64, 32), nebulaMaterial(p));
    this.dome.renderOrder = -10;
    this.stage.scene.add(this.dome);
    this.addLights({ hemiSky: '#C9C0FF', hemiGround: '#1A1024', hemi: 0.45, key: 2.2, keyColor: '#FFF4EC', fill: 1.1, fillColor: '#8E7BFF' });
    this.keyLight.castShadow = false;       // no floor in deep space
    const rim = new THREE.DirectionalLight(p.accent, 1.6);
    rim.position.set(2, 5, -10);
    this.env.add(rim);
    this.lights.rim = rim;
  }

  /** Rounded glass slabs whose live faces get a crisp white border over the scene's UI. */
  panel(o = {}) {
    const w = o.w ?? 4, h = o.h ?? 2.4, radius = o.radius ?? 0.16;
    const draw = o.draw;
    const border = h >= 0.6 && w >= 0.6;
    const wrapped = (c, cw, ch, ...args) => {
      if (draw) draw(c, cw, ch, ...args);
      if (!border) return;
      const s = cw / w;
      const inset = Math.max(3, cw * 0.012);
      const r = Math.max(2, radius * s - inset * 0.6);
      c.save();
      // faint sheen across the top of the pane
      const g = c.createLinearGradient(0, 0, cw * 0.4, ch);
      g.addColorStop(0, 'rgba(255,255,255,0.10)');
      g.addColorStop(0.45, 'rgba(255,255,255,0.0)');
      c.fillStyle = g;
      roundRectPath(c, inset, inset, cw - inset * 2, ch - inset * 2, r);
      c.fill();
      c.lineWidth = Math.max(2, cw * 0.0035);
      c.strokeStyle = 'rgba(255,255,255,0.88)';
      c.stroke();
      c.restore();
    };
    const g = super.panel({ ...o, draw: wrapped });
    return roundBody(g, w, h, o.depth ?? 0.1, radius);
  }

  card(o = {}) { return roundBody(super.card(o), o.w ?? 3, o.h ?? 2, o.depth ?? 0.12, o.radius ?? 0.14); }

  /** Keep the official Redfin mark in Redfin red in every palette. */
  logo3d(key = 'redfin', opts = {}) {
    if (opts.material) return super.logo3d(key, opts);
    const red = bindEnv(M.satin(BRAND.red, { clearcoat: 1, roughness: 0.2, edgeColor: '#FFD9D2', emissive: BRAND.red, emissiveIntensity: 0.12 }), this.stage, 0.9);
    return super.logo3d(key, { ...opts, material: red });
  }

  onTimeline(scenes, duration) {
    const p = this.palette;
    const r = rng((this.ctx.seed || 3) ^ 0xa11ce);
    this.duration = duration;
    const views = scenes.map(s => sceneView(this, s));

    // Approximate camera path (same blend as the rig: lerp plus an outward arc)
    const path = [];
    views.forEach(v => path.push(v.pos.clone()));
    for (let i = 0; i < views.length - 1; i++) {
      const a = views[i].pos, b = views[i + 1].pos, dist = a.distanceTo(b);
      for (let k = 1; k < 24; k++) {
        const e = k / 24;
        const q = a.clone().lerp(b, e);
        q.z += Math.sin(Math.PI * e) * dist * 0.12;
        q.y += Math.sin(Math.PI * e) * dist * 0.12 * 0.35;
        path.push(q);
      }
    }
    const pathClear = (pt, rad, clear = 3.2) => path.every(q => q.distanceTo(pt) > clear + rad);

    const glassKinds = ['sphere', 'ring', 'ico', 'sphere', 'ico', 'ring'];
    const addGlass = (kind, rad, pos, t0, t1) => {
      let geo;
      if (kind === 'ring') geo = new THREE.TorusGeometry(rad, rad * 0.17, 24, 96);
      else if (kind === 'ico') geo = new THREE.IcosahedronGeometry(rad, 0);
      else geo = new THREE.SphereGeometry(rad, 48, 32);
      const mat = this.glassMat({ tint: '#ffffff', roughness: kind === 'ico' ? 0.02 : 0.05, thickness: rad * 1.6, ior: 1.5, env: 1.25, dispersion: 0.35 });
      if (kind === 'ico') mat.flatShading = true;
      const mesh = new THREE.Mesh(geo, mat);
      // a soft fresnel rim so clear glass reads as glass against deep space
      const shell = new THREE.Mesh(geo, M.fresnel({ color: p.rimTint, power: 2.6, intensity: 0.9, inner: 0.0 }));
      shell.scale.setScalar(1.015);
      mesh.add(shell);
      mesh.position.copy(pos);
      this.root.add(mesh);
      this.props.push({ mesh, base: pos.clone(), t0, t1, phase: r() * 10, amp: r.range(0.12, 0.3), spin: r.range(0.1, 0.3) * (r() < 0.5 ? -1 : 1), tilt: r.range(-0.6, 0.6), glass: true });
    };
    const addOrb = (rad, pos, t0, t1, color) => {
      const mesh = new THREE.Mesh(new THREE.SphereGeometry(rad, 20, 14), M.glow(color, r.range(3, 4.5)));
      mesh.position.copy(pos);
      this.root.add(mesh);
      this.props.push({ mesh, base: pos.clone(), t0, t1, phase: r() * 10, amp: r.range(0.1, 0.35), spin: 0, tilt: 0, glass: false });
    };

    scenes.forEach((s, si) => {
      if (s.inst.noDecor) return;
      const view = views[si];
      const t0 = s.start - 2.2, t1 = s.end + 2.2;
      const nGlass = 4, nOrbs = 8;
      const placed = [];
      const tryPlace = (rad, sampler, tries = 80) => {
        for (let k = 0; k < tries; k++) {
          const rel = sampler();
          const world = rel.clone().add(s.anchor);
          if (!propClear(view, s, rel, rad * 1.1, { avoidContent: true })) continue;
          if (!pathClear(world, rad)) continue;
          if (placed.some(q => q.p.distanceTo(world) < q.r + rad + 0.6)) continue;
          placed.push({ p: world, r: rad });
          return world;
        }
        return null;
      };
      for (let i = 0; i < nGlass; i++) {
        const kind = glassKinds[(si + i) % glassKinds.length];
        const rad = (kind === 'ring' ? r.range(0.55, 0.95) : r.range(0.4, 0.85)) * (i === 0 ? 1.3 : 1);
        const pos = tryPlace(rad, () => new THREE.Vector3((r() < 0.5 ? -1 : 1) * r.range(3, 11), r.range(-3.5, 4.8), r.range(-12, 0.5)));
        if (pos) addGlass(kind, rad, pos, t0, t1);
      }
      for (let i = 0; i < nOrbs; i++) {
        const rad = r.range(0.04, 0.12);
        const pos = tryPlace(rad, () => new THREE.Vector3(r.range(-12, 12), r.range(-4, 5.5), r.range(-16, 1)), 40);
        if (pos) addOrb(rad, pos, t0, t1, p.orbs[(si + i) % p.orbs.length]);
      }
      // transit props between this scene and the next: they streak past during the whip
      const next = scenes[si + 1];
      if (next) {
        const a = view.pos, b = views[si + 1].pos;
        const dir = b.clone().sub(a).normalize();
        const side = new THREE.Vector3().crossVectors(dir, new THREE.Vector3(0, 1, 0)).normalize();
        const up = new THREE.Vector3().crossVectors(side, dir).normalize();
        const tt0 = s.end - 2.0, tt1 = s.end + 2.0;
        for (let i = 0; i < 6; i++) {
          const glassy = i < 3;
          const rad = glassy ? r.range(0.35, 0.7) : r.range(0.05, 0.12);
          for (let k = 0; k < 40; k++) {
            const f = r.range(0.25, 0.8);
            const ang = r() * Math.PI * 2;
            const off = r.range(4.5, 9);
            const pos = a.clone().lerp(b, f).add(side.clone().multiplyScalar(Math.cos(ang) * off)).add(up.clone().multiplyScalar(Math.sin(ang) * off * 0.6));
            if (!pathClear(pos, rad, 3.5)) continue;
            const relA = pos.clone().sub(s.anchor), relB = pos.clone().sub(next.anchor);
            if (!propClear(view, s, relA, rad, { onScreen: false }) || !propClear(views[si + 1], next, relB, rad, { onScreen: false })) continue;
            if (glassy) addGlass(glassKinds[(i + si) % glassKinds.length], rad, pos, tt0, tt1);
            else addOrb(rad, pos, tt0, tt1, p.orbs[(i + si) % p.orbs.length]);
            break;
          }
        }
      }
    });

    this.buildTrail(scenes, duration, views);
    this.buildDust(scenes, views, r);
  }

  /** One glowing tube through every scene, under and behind the content. */
  buildTrail(scenes, duration, views) {
    if (scenes.length < 2) return;
    const p = this.palette;
    const pts = [];
    const v = new THREE.Vector3();
    // the trail runs under each scene, dropping lower wherever it would pass behind the scene's type
    const clearOfText = (view, list) => list.every(q => {
      v.copy(q).project(view.cam);
      const sx = v.x * 0.5 + 0.5, sy = 0.5 - v.y * 0.5;
      if (sx < -0.05 || sx > 1.05 || sy < -0.05 || sy > 1.05) return true;
      return view.text.every(([x0, y0, x1, y1]) => sx < x0 - 0.03 || sx > x1 + 0.03 || sy < y0 - 0.05 || sy > y1 + 0.05);
    });
    scenes.forEach((s, i) => {
      const a = s.anchor;
      const sway = i % 2 ? 0.4 : -0.4;
      let trio = null;
      for (const drop of [0, 1.1, 2.3, 3.6, 5]) {
        const L = new THREE.Vector3(a.x - 6.4, a.y - 3.2 + sway - drop, a.z - 2.2);
        const C = new THREE.Vector3(a.x, a.y - 3.9 - drop, a.z - 3.2);
        const R = new THREE.Vector3(a.x + 6.4, a.y - 3.2 - sway - drop, a.z - 2.2);
        trio = [L, C, R];
        const sample = new THREE.CatmullRomCurve3(trio).getPoints(12);
        if (clearOfText(views[i], sample)) break;
      }
      pts.push(...trio);
    });
    const curve = new THREE.CatmullRomCurve3(pts, false, 'catmullrom', 0.4);
    const div = 4000;
    const lengths = curve.getLengths(div);
    const total = lengths[div];
    const uAt = k => lengths[Math.round((k / (pts.length - 1)) * div)] / total;
    const mat = trailMaterial({ color: p.accent, head: '#ffffff', length: total, intensity: 2.3 });
    const geo = new THREE.TubeGeometry(curve, Math.min(1600, 70 * scenes.length), 0.05, 10, false);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.frustumCulled = false;
    this.root.add(mesh);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.13, 24, 16), M.glow('#ffffff', 4));
    this.root.add(head);
    const halo = new THREE.Mesh(new THREE.SphereGeometry(0.38, 24, 16), M.fresnel({ color: p.accent, power: 1.6, intensity: 2.2, inner: 0.25 }));
    head.add(halo);
    // keyframes: draw across each scene while it plays, then race to the next during the whip
    const keys = [{ t: 0, u: 0, ease: 'sine' }];
    scenes.forEach((s, i) => {
      const last = i === scenes.length - 1;
      keys.push({ t: i === 0 ? 0.6 : s.start + TRANSITION / 2, u: uAt(i * 3), ease: 'expo' });
      keys.push({ t: last ? duration - 0.6 : s.end - TRANSITION / 2, u: uAt(i * 3 + 2), ease: 'sine' });
    });
    this.trailKeys = keys;
    this.trailObj = { mesh, mat, curve, head };
  }

  trailProgress(t) {
    const keys = this.trailKeys;
    if (!keys) return 0;
    if (t <= keys[0].t) return keys[0].u;
    for (let i = 1; i < keys.length; i++) {
      const a = keys[i - 1], b = keys[i];
      if (t <= b.t) {
        const k = clamp((t - a.t) / Math.max(1e-4, b.t - a.t));
        const e = b.ease === 'expo' ? ease.inOutExpo(k) : ease.inOutSine(k);
        return lerp(a.u, b.u, e);
      }
    }
    return keys[keys.length - 1].u;
  }

  /** Fine dust along the whole route for depth and motion during the whips. */
  buildDust(scenes, views, r) {
    const p = this.palette;
    const pos = [], col = [];
    const cols = [new THREE.Color('#ffffff'), new THREE.Color(p.orbs[1]), new THREE.Color(p.orbs[2]), new THREE.Color(p.accent)];
    const per = 150;
    scenes.forEach((s, si) => {
      const a = s.anchor;
      const b = scenes[si + 1]?.anchor || a.clone().add(new THREE.Vector3(20, 0, -38));
      for (let i = 0; i < per; i++) {
        const q = a.clone().lerp(b, r()).add(new THREE.Vector3(r.range(-26, 26), r.range(-12, 14), r.range(-18, 10)));
        const rel = q.clone().sub(a);
        // never between the camera and the content
        if (Math.abs(rel.x) < 7 && rel.z > -3 && rel.y > -4.5 && rel.y < 5.5) continue;
        if (views[si].pos.distanceTo(q) < 4) continue;
        pos.push(q.x, q.y, q.z);
        const c = cols[i % cols.length];
        const k = r.range(0.35, 1);
        col.push(c.r * k, c.g * k, c.b * k);
      }
    });
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    const tex = dotSprite();
    this.track(tex);
    const mat = new THREE.PointsMaterial({ size: 0.11, map: tex, vertexColors: true, transparent: true, opacity: 0.75, depthWrite: false, blending: THREE.AdditiveBlending, sizeAttenuation: true });
    const pts = new THREE.Points(geo, mat);
    pts.frustumCulled = false;
    this.root.add(pts);
    this.dust = pts;
  }

  update(t) {
    super.update(t);
    const cam = this.stage.camera.position;
    if (this.dome) this.dome.material.uniforms.uPhase.value = -cam.z * 0.01 + cam.x * 0.004 + t * 0.03;
    for (const d of this.props) {
      const vis = t > d.t0 && t < d.t1;
      d.mesh.visible = vis;
      if (!vis) continue;
      const s = ease.outCubic(seg(t, d.t0, 1.0)) * (1 - ease.inCubic(seg(t, d.t1 - 1.0, 1.0)));
      d.mesh.scale.setScalar(Math.max(0.001, s));
      d.mesh.position.y = d.base.y + Math.sin(t * 0.55 + d.phase) * d.amp;
      if (d.glass) {
        d.mesh.rotation.set(d.tilt + Math.sin(t * 0.3 + d.phase) * 0.2, d.phase + t * d.spin, d.tilt * 0.5);
      }
    }
    if (this.dust) this.dust.position.y = Math.sin(t * 0.15) * 0.4;
    if (this.trailObj) {
      const u = clamp(this.trailProgress(t), 0.0005, 1);
      const { mat, curve, head } = this.trailObj;
      mat.uniforms.uProgress.value = u;
      mat.uniforms.uTime.value = t;
      head.position.copy(curve.getPointAt(u));
      head.scale.setScalar(1 + Math.sin(t * 5) * 0.08);
    }
  }
}

function roundRectPath(c, x, y, w, h, r) {
  const rr = Math.min(r, w / 2, h / 2);
  c.beginPath();
  c.moveTo(x + rr, y);
  c.arcTo(x + w, y, x + w, y + h, rr);
  c.arcTo(x + w, y + h, x, y + h, rr);
  c.arcTo(x, y + h, x, y, rr);
  c.arcTo(x, y, x + w, y, rr);
  c.closePath();
}

export default {
  id: 'glass-explainer',
  name: 'Glass Explainer',
  family: 'Glass',
  description: 'Dark space with glowing color, frosted glass panels and a camera that flies from scene to scene.',
  bestFor: 'Explainers, product walkthroughs, process stories, recruiting',
  swatch: ['#0C0A16', '#6A3AE0', '#FF8A4C', '#FFFFFF'],
  native: 'native',
  post: {
    bloom: { strength: 0.55, radius: 0.6, threshold: 1.0 },
    grain: 0.035, vignette: 0.38, vignetteColor: '#000000', ca: 0.0026, tone: 'neutral', exposure: 1.0,
  },
  transition: { style: 'whip', duration: TRANSITION },
  drift: 1.25,
  palette: mode => explainerPalette(mode === 'native' ? 'native' : 'brand'),
  overlayTheme: p => ({
    text: p.text, sub: p.sub, accent: p.accent, accentText: '#FFFFFF', scrim: p.scrim, scrimAlpha: p.scrimAlpha,
    chipBg: p.accent, chipText: '#FFFFFF', panel: 'rgba(20,18,30,0.82)', panelStroke: 'rgba(255,255,255,0.2)', dark: true,
  }),
  create: ctx => new ExplainerWorld(ctx),
};
