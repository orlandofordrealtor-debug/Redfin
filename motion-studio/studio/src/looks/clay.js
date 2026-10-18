// Premium Clay: a soft, off-white clay studio. A custom GLSL gradient dome, a shadow-catching floor
// with a dotted grid that fades with distance, hemisphere + soft VSM key + cool fill lights over the
// RoomEnvironment reflections. Every object is matte clay (sheen, soft rim, noise dissolve with
// glowing edges), so things materialise in and melt away. Pastel props with one accent.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { BaseWorld } from '../engine/world.js';
import * as M from '../engine/materials.js';
import { BRAND } from '../engine/brand.js';
import { fitDistance } from '../engine/camera.js';
import { rng, clamp, ease, seg } from '../engine/util.js';

const DEG = Math.PI / 180;
const V0 = new THREE.Vector3();

// ---------------------------------------------------------------------------------------------
// Shared helpers for ambient props (also used by the Glass looks). They approximate the camera
// each scene will use (mirrors MotionEngine.shotFor at mid-scene), so props can be kept clear of
// the scene's content volume and of the 2D text zones in every format.
// ---------------------------------------------------------------------------------------------

/** Approximate camera for a scene: { cam, pos, target, fov, aspect, text: [[x0,y0,x1,y1]...] } in 0..1 screen units. */
export function sceneView(world, s) {
  const st = world.stage;
  const shot = s.inst.shot || {};
  const fov = shot.fov || (st.aspect < 0.8 ? 42 : 34);
  const frame = shot.frame || { w: 8, h: 5 };
  const layout = shot.layout || 'center';
  const portrait = st.aspect < 0.95;
  let fw = frame.w, fh = frame.h, ox = 0, oy = 0;
  if (layout === 'split' && !portrait) { fw = frame.w / 0.56; ox = -0.2; }
  else if ((layout === 'split' || layout === 'stack') && portrait) { fh = frame.h / 0.6; oy = 0.15; }
  else if (layout === 'stack') { fh = frame.h / 0.62; oy = 0.14; }
  else if (layout === 'stackBottom') { fh = frame.h / (portrait ? 0.6 : 0.62); oy = portrait ? -0.12 : -0.1; }
  else if (layout === 'low') { fh = frame.h / 0.7; oy = 0.08; }
  const dist = fitDistance(fw, fh, fov, st.aspect, shot.margin ?? 1.06);
  const vh = 2 * Math.tan((fov * DEG) / 2) * dist;
  const vw = vh * st.aspect;
  const target = s.anchor.clone().add(shot.center || V0).add(new THREE.Vector3(ox * vw, oy * vh, 0)).add(shot.offset || V0);
  const yaw = (shot.yaw ?? 0) * DEG, pitch = (shot.pitch ?? 6) * DEG;
  const pos = new THREE.Vector3(Math.sin(yaw) * Math.cos(pitch) * dist, Math.sin(pitch) * dist, Math.cos(yaw) * Math.cos(pitch) * dist).add(target);
  const cam = new THREE.PerspectiveCamera(fov, st.aspect, 0.1, 600);
  cam.position.copy(pos);
  cam.lookAt(target);
  cam.updateMatrixWorld();
  // screen rectangle covered by the scene's framed content
  const c0 = s.anchor.clone().add(shot.center || V0);
  let x0 = 1, y0 = 1, x1 = 0, y1 = 0;
  for (const [sx, sy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    const v = c0.clone().add(new THREE.Vector3(sx * frame.w / 2, sy * frame.h / 2, 0)).project(cam);
    const px = v.x * 0.5 + 0.5, py = 0.5 - v.y * 0.5;
    x0 = Math.min(x0, px); x1 = Math.max(x1, px); y0 = Math.min(y0, py); y1 = Math.max(y1, py);
  }
  return { cam, pos, target, fov, aspect: st.aspect, dist, portrait, text: textRects(s, layout, portrait), content: [x0, y0, x1, y1] };
}

/** Screen rectangles (0..1, y down) where the scene draws type, plus the brand bug. */
export function textRects(s, layout, portrait) {
  const r = [portrait ? [0.28, 0, 0.72, 0.09] : [0, 0, 0.27, 0.12]];
  if (s.type === 'endcard') { r.push(portrait ? [0.03, 0.03, 0.97, 0.97] : [0.12, 0.03, 0.88, 0.97]); return r; }
  if (s.type === 'timeline' && portrait) layout = 'stackBottom';
  switch (layout) {
    case 'split': r.push(portrait ? [0, 0.06, 1, 0.42] : [0, 0.16, 0.5, 0.84]); break;
    case 'stack': r.push(portrait ? [0, 0.06, 1, 0.42] : [0.08, 0.03, 0.92, 0.42]); break;
    case 'stackBottom': r.push(portrait ? [0, 0.56, 1, 0.93] : [0.08, 0.6, 0.92, 0.96]); break;
    case 'center': r.push([0.05, 0.27, 0.95, 0.73]); break;
    case 'low': r.push([0.12, 0.53, 0.88, 0.94]); break;
    default: break;
  }
  return r;
}

/** True when a prop at rel (relative to the scene anchor) would crowd the scene's own content. */
export function blockedByContent(type, rel, radius = 0.5) {
  const x = Math.abs(rel.x) - radius, y = rel.y, z = rel.z - radius;
  if (x < 4.8 && y > -3.0 - radius && y < 3.9 + radius && z > -1.8) return true;
  if (type === 'gallery' && x < 7.4 && z > -4.4 && y > -2.8 && y < 2.8) return true;
  if (type === 'message' && x < 3.4 && Math.abs(y) < 3.2 && z > -5.8) return true;
  if (type === 'endcard' && x < 5.2 && Math.abs(y) < 5.2 && z > -8.5) return true;
  return false;
}

/** Whether a prop is visible in the scene's frame, clear of type and not in front of content. */
export function propClear(view, s, rel, radius, { onScreen = true, minDist = 4, inside = false, avoidContent = false } = {}) {
  if (blockedByContent(s.type, rel, radius)) return false;
  const p = rel.clone().add(s.anchor);
  const d = view.cam.position.distanceTo(p);
  if (d < minDist + radius) return false;
  const v = p.clone().project(view.cam);
  if (v.z > 1 || v.z < -1) return false;
  const sx = v.x * 0.5 + 0.5, sy = 0.5 - v.y * 0.5;
  const ry = radius / (2 * d * Math.tan((view.fov * DEG) / 2));
  const rx = ry / view.aspect;
  if (onScreen && (sx < -rx * 0.4 || sx > 1 + rx * 0.4 || sy < -ry * 0.4 || sy > 1 + ry * 0.4)) return false;
  if (inside && (sx - rx < 0.02 || sx + rx > 0.98 || sy - ry < 0.02 || sy + ry > 0.98)) return false;
  const rects = avoidContent && s.type !== 'endcard' ? [...view.text, view.content] : view.text;
  for (const [x0, y0, x1, y1] of rects) {
    if (sx + rx > x0 && sx - rx < x1 && sy + ry > y0 && sy - ry < y1) return false;
  }
  return true;
}

/** A rounded-rectangle slab (extruded with a soft bevel), so panels get real corner radii. */
export function roundedSlab(w, h, d, r) {
  const bevel = Math.max(0.004, Math.min(d * 0.42, 0.06, r * 0.6));
  const iw = Math.max(0.01, w - bevel * 2), ih = Math.max(0.01, h - bevel * 2);
  const rr = Math.max(0.002, Math.min(r - bevel * 0.5, iw / 2, ih / 2));
  const x = -iw / 2, y = -ih / 2;
  const sh = new THREE.Shape();
  sh.moveTo(x + rr, y);
  sh.lineTo(x + iw - rr, y);
  sh.quadraticCurveTo(x + iw, y, x + iw, y + rr);
  sh.lineTo(x + iw, y + ih - rr);
  sh.quadraticCurveTo(x + iw, y + ih, x + iw - rr, y + ih);
  sh.lineTo(x + rr, y + ih);
  sh.quadraticCurveTo(x, y + ih, x, y + ih - rr);
  sh.lineTo(x, y + rr);
  sh.quadraticCurveTo(x, y, x + rr, y);
  const depth = Math.max(0.002, d - bevel * 2);
  const geo = new THREE.ExtrudeGeometry(sh, { depth, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 5, curveSegments: 12 });
  geo.translate(0, 0, -depth / 2);
  return geo;
}

/** Swaps a card/panel body for a rounded slab with the same footprint. */
export function roundBody(g, w, h, d, r) {
  const body = g.userData.body;
  if (!body) return g;
  body.geometry.dispose();
  body.geometry = roundedSlab(w, h, d, r);
  return g;
}

// ---------------------------------------------------------------------------------------------
// Palette
// ---------------------------------------------------------------------------------------------

const PASTEL = { peach: '#F7BFA4', sky: '#A6CCEF', butter: '#F6DC93', mint: '#AEDFC6', lilac: '#C9C1F2', blush: '#F3BDC0' };

export function clayPalette(mode = 'brand') {
  const base = {
    dark: false,
    bgTop: '#FDFCFA', bgBottom: '#EDE8E2', cove: '#FFFFFF',
    slab: '#F3EEE8', hemiGround: '#E6DCCF',
    accentText: '#FFFFFF', glassTint: '#ffffff',
    shadow: 0.22, dotOpacity: 0.42,
    scrim: '#FBFAF7', scrimAlpha: 0.55, fade: '#F6F2EC', logo: 'tagline',
  };
  if (mode === 'native') {
    return {
      ...base,
      blobs: [
        { dir: [-0.85, 0.12, -0.55], color: '#FBE4D8', size: 0.55 },
        { dir: [0.85, 0.2, -0.5], color: '#DFEAF8', size: 0.55 },
        { dir: [0.05, 0.75, -0.6], color: '#FBF2D9', size: 0.6 },
        { dir: [0.1, -0.3, -0.95], color: '#ECE8FA', size: 0.5 },
      ],
      text: '#1E1B4B', sub: '#4A4C63', accent: '#4F46E5', accent2: PASTEL.peach,
      ink: '#1E1B4B', edge: '#8079FF', glow: '#8B85FF',
      decor: [PASTEL.peach, PASTEL.sky, PASTEL.butter, PASTEL.mint, PASTEL.lilac],
      muted: '#F5CDB9', line: 'rgba(30,27,75,0.16)', floorLine: '#4F46E5', shadowColor: '#2A2358',
    };
  }
  return {
    ...base,
    blobs: [
      { dir: [-0.85, 0.12, -0.55], color: '#FBE3D9', size: 0.55 },
      { dir: [0.85, 0.2, -0.5], color: '#E3ECF7', size: 0.55 },
      { dir: [0.05, 0.75, -0.6], color: '#FBF2DC', size: 0.6 },
      { dir: [0.1, -0.3, -0.95], color: '#F4EFEA', size: 0.5 },
    ],
    text: BRAND.ink, sub: '#4A4E57', accent: BRAND.red, accent2: PASTEL.butter,
    ink: '#1C1D21', edge: '#FF6B75', glow: BRAND.redGlow,
    decor: [PASTEL.peach, PASTEL.sky, PASTEL.butter, PASTEL.mint, PASTEL.blush],
    muted: '#BFD8EE', line: 'rgba(17,17,17,0.14)', floorLine: '#8E8178', shadowColor: '#3A2A26',
  };
}

// ---------------------------------------------------------------------------------------------
// Materials and backdrop
// ---------------------------------------------------------------------------------------------

/**
 * three r169 ignores material.envMapIntensity when the env comes from scene.environment (it uses
 * scene.environmentIntensity instead), so looks bind the env map per material to control it.
 */
export function bindEnv(mat, stage, intensity) {
  mat.envMap = stage.envTexture;
  mat.envMapIntensity = intensity;
  return mat;
}

/** Clay (MeshPhysical + sheen) with a soft rim and a dissolve whose edge glows hot enough to bloom. */
export function clayMat(color, { stage = null, edge = '#8079FF', roughness = 0.62, rim = 0.26, env = 0.42, intensity = 11, width = 0.07 } = {}) {
  const m = M.clay(color, { roughness, rim, env, edgeColor: edge, rimColor: '#FFFFFF' });
  if (stage) bindEnv(m, stage, env);
  m.userData.u.uEdgeIntensity.value = intensity;
  m.userData.u.uEdgeWidth.value = width;
  return m;
}

/** Studio sweep: a warm vertical gradient, a soft bounce where floor meets wall, faint pastel washes. */
function clayDomeMaterial(p) {
  const B = 4;
  const pos = [], col = [], size = [];
  for (let i = 0; i < B; i++) {
    const b = p.blobs[i];
    pos.push(b ? new THREE.Vector3(...b.dir).normalize() : new THREE.Vector3(0, -1, 0));
    col.push(new THREE.Color(b ? b.color : '#000000'));
    size.push(b ? b.size : 0);
  }
  return new THREE.ShaderMaterial({
    uniforms: {
      uTop: { value: new THREE.Color(p.bgTop) }, uBottom: { value: new THREE.Color(p.bgBottom) }, uCove: { value: new THREE.Color(p.cove) },
      uBlobPos: { value: pos }, uBlobCol: { value: col }, uBlobSize: { value: size },
    },
    vertexShader: /* glsl */`
      varying vec3 vDir;
      void main() { vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */`
      uniform vec3 uTop, uBottom, uCove;
      uniform vec3 uBlobPos[${B}]; uniform vec3 uBlobCol[${B}]; uniform float uBlobSize[${B}];
      varying vec3 vDir;
      float hash(vec3 p) { p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
      void main() {
        vec3 d = normalize(vDir);
        float y = d.y;
        vec3 col = mix(uBottom, uTop, smoothstep(-0.42, 0.5, y));
        col = mix(col, uCove, exp(-pow((y + 0.015) * 5.0, 2.0)) * 0.42);
        for (int i = 0; i < ${B}; i++) {
          if (uBlobSize[i] <= 0.0) continue;
          float k = exp(-pow(distance(d, uBlobPos[i]) / max(uBlobSize[i], 1e-3), 2.0));
          col = mix(col, uBlobCol[i], k * 0.7);
        }
        col *= 1.0 - 0.07 * smoothstep(0.35, 1.0, abs(y));
        col += (hash(d * 911.0) - 0.5) * (1.6 / 255.0);
        gl_FragColor = vec4(col, 1.0);
      }`,
    side: THREE.BackSide, depthWrite: false,
  });
}

// ---------------------------------------------------------------------------------------------
// World
// ---------------------------------------------------------------------------------------------

class ClayWorld extends BaseWorld {
  constructor(ctx) {
    super(ctx);
    this.style = 'clay';
    this.floorY = -2.6;
    this.props = [];
  }

  materials() {
    const p = this.palette;
    const clay = (c, o = {}) => this.clay(c, o);
    return {
      frame: () => clay(p.slab, { roughness: 0.64, rim: 0.2 }),
      panel: () => clay(p.slab, { roughness: 0.68, rim: 0.18 }),
      accent: () => clay(p.accent, { roughness: 0.5, rim: 0.22, env: 0.5 }),
      glyph: () => clay(p.accent, { roughness: 0.46, rim: 0.3, env: 0.55 }),
      decor: i => clay(p.decor[i % p.decor.length]),
      ink: () => clay(p.ink, { roughness: 0.55, rim: 0.16 }),
      muted: () => clay(p.muted, { roughness: 0.64 }),
      glow: () => M.glow(p.glow, 2.4),
      line: () => M.flowMaterial({ color: p.accent, head: '#ffffff', intensity: 2.2 }),
    };
  }

  clay(color, o = {}) {
    return clayMat(color, { stage: this.stage, edge: this.palette.edge, ...o });
  }

  environment() {
    const p = this.palette;
    this.dome = new THREE.Mesh(new THREE.SphereGeometry(150, 64, 32), clayDomeMaterial(p));
    this.dome.renderOrder = -10;
    this.stage.scene.add(this.dome);

    this.addLights({ hemiSky: '#FFFFFF', hemiGround: p.hemiGround, hemi: 0.7, key: 2.6, keyColor: '#FFF4E8', fill: 0.6, fillColor: '#BFD2FF', shadowRadius: 18 });
    const key = this.keyLight;
    key.position.set(5, 13, 8);
    key.shadow.blurSamples = 24;
    key.shadow.bias = -0.0005;
    key.shadow.normalBias = 0.02;
    this.lights.fill.position.set(-9, 3, 5);

    const shadowMat = M.shadowFloor(p.shadow);
    shadowMat.color = new THREE.Color(p.shadowColor);
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(220, 220), shadowMat);
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = this.floorY;
    floor.receiveShadow = true;
    this.env.add(floor);
    this.floor = floor;

    const dots = new THREE.Mesh(new THREE.PlaneGeometry(70, 70), M.dotFloorMaterial({ color: p.floorLine, spacing: 0.6, dot: 0.055, fade: 28, opacity: p.dotOpacity }));
    dots.rotation.x = -Math.PI / 2;
    dots.position.y = this.floorY + 0.003;
    this.env.add(dots);
  }

  card(o = {}) { return roundBody(super.card(o), o.w ?? 3, o.h ?? 2, o.depth ?? 0.12, o.radius ?? 0.14); }

  panel(o = {}) { return roundBody(super.panel(o), o.w ?? 4, o.h ?? 2.4, o.depth ?? 0.1, o.radius ?? 0.16); }

  /** The official Redfin mark stays Redfin red in every palette, rendered in clay. */
  logo3d(key = 'redfin', opts = {}) {
    if (opts.material) return super.logo3d(key, opts);
    return super.logo3d(key, { ...opts, material: this.clay(BRAND.red, { roughness: 0.48, rim: 0.24, env: 0.5 }) });
  }

  /** Pastel clay props around every scene that materialise in with the scene and melt away after it. */
  onTimeline(scenes, duration) {
    const p = this.palette;
    const r = rng((this.ctx.seed || 11) ^ 0x5eed);
    this.duration = duration;
    const shapes = ['sphere', 'pill', 'cube', 'sphere', 'donut', 'dome', 'sphere'];
    scenes.forEach((s, si) => {
      if (s.inst.noDecor) return;
      const view = sceneView(this, s);
      const want = (s.inst.decorCount ?? 5) + 1;
      const placed = [];
      for (let i = 0, tries = 0; placed.length < want && tries < want * 70; tries++) {
        const kind = shapes[(si * 3 + placed.length) % shapes.length];
        const grounded = kind === 'dome' || (kind !== 'donut' && r() < 0.42);
        const size = grounded ? r.range(0.55, 1.05) : r.range(0.3, 0.72) * (placed.length === 0 ? 1.35 : 1);
        const side = r() < 0.5 ? -1 : 1;
        const halfH = kind === 'pill' ? size * 1.05 : kind === 'dome' ? 0 : kind === 'donut' ? size * 0.32 : size * (kind === 'cube' ? 0.75 : 1);
        const rel = grounded
          ? new THREE.Vector3(side * r.range(3.5, 10.5), this.floorY - s.anchor.y + halfH, r.range(-9, 3))
          : new THREE.Vector3(side * r.range(2.5, 10.5), r.range(-1.6, 4.2), r.range(-9, 1.5));
        const bound = Math.max(size, halfH);
        if (!propClear(view, s, rel, bound * 1.15, { avoidContent: true })) continue;
        if (placed.some(q => q.rel.distanceTo(rel) < q.bound + bound + 0.5)) continue;
        placed.push({ rel, bound, kind, size, grounded });
        i++;
      }
      placed.forEach((q, i) => {
        const mat = this.clay(p.decor[(si + i * 2) % p.decor.length], { roughness: r.range(0.55, 0.7), intensity: 9 });
        const mesh = new THREE.Mesh(propGeometry(q.kind, q.size), mat);
        mesh.castShadow = true;
        mesh.receiveShadow = false;
        const base = q.rel.clone().add(s.anchor);
        mesh.position.copy(base);
        if (q.kind === 'pill') mesh.rotation.z = q.grounded ? Math.PI / 2 : r.range(-0.6, 0.6);
        if (q.kind === 'donut' && q.grounded) mesh.rotation.x = Math.PI / 2;
        mesh.visible = false;
        this.root.add(mesh);
        this.props.push({
          mesh, mat, base, kind: q.kind, grounded: q.grounded, t0: s.start, t1: s.end,
          delay: 0.08 + i * 0.12, phase: r() * 10, amp: q.grounded ? 0 : r.range(0.1, 0.24), freq: r.range(0.5, 0.85),
          spin: r.range(0.08, 0.2) * (r() < 0.5 ? -1 : 1), rot0: r() * Math.PI * 2, tilt: r.range(-0.35, 0.35),
        });
      });
      // studio set marks: thin corner brackets on the floor around the scene's footprint
      if (s.type !== 'endcard') this.root.add(floorMarks(s.anchor, this.floorY, p.floorLine));
    });
  }

  update(t) {
    super.update(t);
    for (const d of this.props) {
      const vis = t > d.t0 - 1.4 && t < d.t1 + 1.4;
      d.mesh.visible = vis;
      if (!vis) continue;
      const din = 1 - ease.outCubic(seg(t, d.t0 - 0.15 + d.delay, 1.5));
      const dout = ease.inCubic(seg(t, d.t1 - 0.5, 0.75));
      d.mat.userData.u.uDissolve.value = clamp(Math.max(din, dout));
      if (d.grounded) {
        if (d.kind === 'cube') d.mesh.rotation.y = d.rot0 + t * d.spin * 0.5;
        else if (d.kind === 'donut') d.mesh.rotation.z = d.rot0 + t * d.spin * 0.5;
      } else {
        d.mesh.position.y = d.base.y + Math.sin(t * d.freq + d.phase) * d.amp;
        d.mesh.position.x = d.base.x + Math.sin(t * d.freq * 0.6 + d.phase * 1.7) * d.amp * 0.4;
        d.mesh.rotation.y = d.rot0 + t * d.spin;
        d.mesh.rotation.x = d.tilt + Math.sin(t * 0.4 + d.phase) * 0.12;
      }
    }
  }
}

function propGeometry(kind, s) {
  switch (kind) {
    case 'pill': return new THREE.CapsuleGeometry(s * 0.5, s * 1.1, 12, 40);
    case 'cube': return new RoundedBoxGeometry(s * 1.5, s * 1.5, s * 1.5, 6, s * 0.34);
    case 'donut': return new THREE.TorusGeometry(s * 0.72, s * 0.32, 32, 96);
    case 'dome': return new THREE.SphereGeometry(s, 64, 32, 0, Math.PI * 2, 0, Math.PI / 2);
    default: return new THREE.SphereGeometry(s, 64, 40);
  }
}

/** Four L-shaped registration marks drawn as LineSegments on the floor. */
function floorMarks(anchor, floorY, color) {
  const x = 5.4, zf = 2.6, zb = -3.4, L = 0.7, y = floorY + 0.006;
  const pts = [];
  for (const [cx, cz, sx, sz] of [[-x, zb, 1, 1], [x, zb, -1, 1], [-x, zf, 1, -1], [x, zf, -1, -1]]) {
    pts.push(cx, y, cz, cx + sx * L, y, cz);
    pts.push(cx, y, cz, cx, y, cz + sz * L);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
  const mat = new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.45, depthWrite: false });
  const lines = new THREE.LineSegments(geo, mat);
  lines.position.set(anchor.x, 0, anchor.z);
  return lines;
}

const post = {
  bloom: { strength: 0.7, radius: 0.5, threshold: 1.7 },
  grain: 0.018, vignette: 0.15, vignetteColor: '#6F655C', ca: 0.0008, tone: 'neutral', exposure: 1.03,
};

export default {
  id: 'clay',
  name: 'Premium Clay',
  family: 'Clay',
  description: 'Soft off-white clay studio with pastel shapes that materialise in and melt away.',
  bestFor: 'Explainers, tips, process steps, friendly team updates',
  swatch: ['#FCFBF8', '#EAE4DC', '#4F46E5', '#1E1B4B'],
  native: 'native',
  post,
  transition: { style: 'glide', duration: 1.0 },
  drift: 0.8,
  palette: mode => clayPalette(mode === 'native' ? 'native' : 'brand'),
  overlayTheme: p => ({
    text: p.text, sub: p.sub, accent: p.accent, accentText: '#FFFFFF', scrim: p.scrim, scrimAlpha: p.scrimAlpha,
    chipBg: p.accent, chipText: '#FFFFFF', panel: 'rgba(255,255,255,0.9)', panelStroke: 'rgba(255,255,255,1)', dark: false,
  }),
  create: ctx => new ClayWorld(ctx),
};
