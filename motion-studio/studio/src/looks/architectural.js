// Blueprint: a wireframe home that builds into a finished render. Blueprint-blue drafting space
// with a fine white line grid; behind every scene a modern house drafts itself in glowing lines,
// fills in as a matte white model from the ground up and lights its windows by the scene's end.
// Cards and panels are white architectural model board with thin drafted borders.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { BaseWorld, setMatOpacity } from '../engine/world.js';
import * as M from '../engine/materials.js';
import { BRAND } from '../engine/brand.js';
import { clamp, ease, seg, rng, rgba } from '../engine/util.js';

export function blueprintPalette(mode = 'brand') {
  if (mode === 'native') {
    return {
      dark: true,
      bgTop: '#1C4F8E', bgBottom: '#0B2C58',
      blobs: [{ dir: [0, 0.15, -1], color: '#2563A8', size: 0.45 }, { dir: [-0.8, 0.6, -0.2], color: '#123C70', size: 0.5 }],
      text: '#FFFFFF', sub: 'rgba(228,239,255,0.82)', accent: '#E2552C', accent2: '#FFFFFF', accentText: '#FFFFFF',
      ink: '#FFFFFF', glassTint: '#ffffff', decor: ['#F4F7FB', '#BCD4F0', '#E2552C', '#F4F7FB'],
      board: '#F3F6FA', boardLine: '#1C4F8E', muted: '#E9EEF5',
      house: { line: '#E6F1FF', lineGlow: 2.4, head: '#FFFFFF', solid: '#E9EFF7', glass: '#FFC978', glassGlow: 3.2, edge: '#9CC8FF' },
      grid: '#FFFFFF', gridOpacity: 0.16, gridMajor: 0.32,
      glow: '#FFFFFF', line: 'rgba(255,255,255,0.35)', floorLine: '#FFFFFF', sheet: 'rgba(255,255,255,0.5)',
      shadow: 0.3, scrim: '#0B2C58', scrimAlpha: 0.5, fade: '#0B2C58', logo: 'taglineReversed',
    };
  }
  return {
    dark: false,
    bgTop: '#FBF9F5', bgBottom: '#EDE7DD',
    blobs: [{ dir: [0, 0.15, -1], color: '#F7F3EC', size: 0.5 }, { dir: [0.8, 0.5, -0.3], color: '#F3E6E2', size: 0.45 }],
    text: BRAND.ink, sub: '#4A4E57', accent: BRAND.red, accent2: BRAND.ink, accentText: '#FFFFFF',
    ink: BRAND.ink, glassTint: '#ffffff', decor: ['#FFFFFF', '#E7E1D8', BRAND.red, '#FFFFFF'],
    board: '#FFFFFF', boardLine: BRAND.ink, muted: '#E4DED5',
    house: { line: '#22252B', lineGlow: 1.0, head: BRAND.red, solid: '#FFFFFF', glass: '#3A4350', glassGlow: 1.0, edge: BRAND.red },
    grid: '#2A2D33', gridOpacity: 0.09, gridMajor: 0.16,
    glow: BRAND.red, line: 'rgba(17,17,17,0.18)', floorLine: '#2A2D33', sheet: 'rgba(17,17,17,0.38)',
    shadow: 0.14, scrim: '#FFFFFF', scrimAlpha: 0.6, fade: '#F5F1EA', logo: 'tagline',
  };
}

// ---------- the house ----------

function wallGeo(w, h, t, holes = []) {
  const s = new THREE.Shape();
  s.moveTo(-w / 2, 0); s.lineTo(w / 2, 0); s.lineTo(w / 2, h); s.lineTo(-w / 2, h); s.closePath();
  holes.forEach(o => {
    const p = new THREE.Path();
    p.moveTo(o.x - o.w / 2, o.y); p.lineTo(o.x - o.w / 2, o.y + o.h); p.lineTo(o.x + o.w / 2, o.y + o.h); p.lineTo(o.x + o.w / 2, o.y); p.closePath();
    s.holes.push(p);
  });
  const g = new THREE.ExtrudeGeometry(s, { depth: t, bevelEnabled: false, curveSegments: 1 });
  g.translate(0, 0, -t / 2);
  return g;
}

/** Collects solid parts, glass panes and their transforms for one house. */
class HouseKit {
  constructor() { this.solids = []; this.panes = []; }
  add(geo, m) { this.solids.push(geo.applyMatrix4(m)); }
  box(w, h, d, x, y, z, ry = 0, rz = 0) {
    const g = new THREE.BoxGeometry(w, h, d).toNonIndexed();
    g.deleteAttribute('uv');
    this.add(g, new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, ry, rz)), new THREE.Vector3(1, 1, 1)));
  }
  /** A volume of four walls with window/door holes. holes: { front, back, left, right }. */
  volume(W, H, D, ox, oy, oz, holes = {}, t = 0.14) {
    const sides = [
      { w: W, holes: holes.front || [], m: [0, D / 2 - t / 2, 0] },
      { w: W, holes: holes.back || [], m: [0, -D / 2 + t / 2, Math.PI] },
      { w: D - t * 2, holes: holes.left || [], m: [-W / 2 + t / 2, 0, -Math.PI / 2] },
      { w: D - t * 2, holes: holes.right || [], m: [W / 2 - t / 2, 0, Math.PI / 2] },
    ];
    for (const s of sides) {
      const g = wallGeo(s.w, H, t, s.holes);
      g.deleteAttribute('uv');
      const [dx, dz, ry] = s.m;
      const isSide = Math.abs(ry) === Math.PI / 2;
      const pos = new THREE.Vector3(ox + (isSide ? dx : 0), oy, oz + (isSide ? 0 : dz));
      const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, ry, 0));
      const m = new THREE.Matrix4().compose(pos, q, new THREE.Vector3(1, 1, 1));
      this.add(g, m);
      s.holes.forEach(o => {
        const pg = new THREE.PlaneGeometry(o.w, o.h);
        pg.deleteAttribute('uv');
        pg.translate(o.x, o.y + o.h / 2, 0);
        this.panes.push(pg.applyMatrix4(m));
      });
    }
  }
  gable(W, H, D, ox, oy, oz) {
    const s = new THREE.Shape();
    s.moveTo(-W / 2, 0); s.lineTo(W / 2, 0); s.lineTo(0, H); s.closePath();
    const g = new THREE.ExtrudeGeometry(s, { depth: D, bevelEnabled: false });
    g.deleteAttribute('uv');
    g.translate(0, 0, -D / 2);
    this.add(g, new THREE.Matrix4().makeTranslation(ox, oy, oz));
  }
}

/** Two modern homes, built once and shared by every scene. */
function buildHouse(variant) {
  const k = new HouseKit();
  if (variant === 0) {
    // two-volume modern: glass-walled ground floor, cantilevered upper box, flat roofs
    k.box(9.2, 0.16, 6.2, 0.4, -0.08, 0.2);
    k.volume(7, 2.7, 4.6, 0, 0, 0, {
      front: [{ x: -1.7, y: 0.18, w: 2.8, h: 2.2 }, { x: 1.1, y: 0, w: 0.95, h: 2.2 }, { x: 2.65, y: 0.95, w: 0.95, h: 1.15 }],
      left: [{ x: 0, y: 0.9, w: 1.6, h: 1.2 }],
      back: [{ x: -1.5, y: 0.9, w: 1.4, h: 1.2 }, { x: 1.6, y: 0.9, w: 1.4, h: 1.2 }],
      right: [{ x: 0.6, y: 0.9, w: 1.1, h: 1.2 }],
    });
    k.box(7.7, 0.2, 5.3, 0, 2.8, 0);
    k.volume(4.4, 2.5, 3.8, -1.3, 2.9, -0.2, {
      front: [{ x: 0, y: 0.95, w: 3.2, h: 1.05 }],
      right: [{ x: 0, y: 0.3, w: 0.9, h: 1.9 }],
      left: [{ x: 0.4, y: 0.9, w: 1.0, h: 1.1 }],
    });
    k.box(5.0, 0.2, 4.4, -1.3, 5.5, -0.2);
    k.box(2.2, 0.08, 1.4, 1.6, 0.04, 3.1);       // front step
  } else {
    // gabled house with an attached flat-roof garage
    k.box(10.6, 0.16, 6.0, 1.5, -0.08, 0.1);
    k.volume(6, 2.9, 4.4, 0, 0, 0, {
      front: [{ x: 0.5, y: 0, w: 1.0, h: 2.25 }, { x: -1.7, y: 0.95, w: 1.5, h: 1.35 }, { x: 2.1, y: 0.95, w: 1.0, h: 1.35 }],
      left: [{ x: 0, y: 0.95, w: 1.3, h: 1.3 }],
      back: [{ x: 0, y: 0.95, w: 2.0, h: 1.3 }],
    });
    k.gable(6.5, 2.1, 4.9, 0, 2.9, 0);
    k.volume(3.3, 2.5, 4.2, 4.65, 0, -0.1, {
      front: [{ x: 0, y: 0, w: 2.5, h: 2.05 }],
      right: [{ x: 0, y: 1.0, w: 1.2, h: 0.9 }],
    });
    k.box(3.7, 0.18, 4.6, 4.65, 2.59, -0.1);
    k.box(1.6, 0.08, 1.2, 0.5, 0.04, 2.8);
  }
  const solid = mergeGeometries(k.solids, false);
  // drafting lines: every crease and every window opening
  const lineParts = k.solids.map(g => new THREE.EdgesGeometry(g, 24));
  const lines = mergeGeometries(lineParts, false);
  const panes = mergeGeometries(k.panes, false);
  // center the footprint and order the draw-on: bottom to top, sweeping left to right
  solid.computeBoundingBox();
  const bb = solid.boundingBox;
  const cx = (bb.min.x + bb.max.x) / 2, cz = (bb.min.z + bb.max.z) / 2;
  [solid, lines, panes].forEach(g => g.translate(-cx, 0, -cz));
  const size = new THREE.Vector3(); bb.getSize(size);
  const pos = lines.attributes.position;
  const order = new Float32Array(pos.count);
  for (let i = 0; i < pos.count; i++) {
    const y = (pos.getY(i) - bb.min.y) / size.y;
    const x = (pos.getX(i) + size.x / 2) / size.x;
    order[i] = clamp(y * 0.72 + x * 0.28);
  }
  lines.setAttribute('aOrder', new THREE.BufferAttribute(order, 1));
  solid.computeVertexNormals();
  return { solid, lines, panes, height: size.y, width: size.x, depth: size.z };
}

/** Matte model material that builds from the ground up (uCut, house-local height) with a glowing seam. */
function buildMaterial(color, edgeColor) {
  const m = new THREE.MeshStandardMaterial({ color, roughness: 0.85, metalness: 0, envMapIntensity: 0.6, side: THREE.DoubleSide });
  const u = { uCut: { value: -1 }, uSeam: { value: new THREE.Color(edgeColor) } };
  m.userData.u = u;
  m.onBeforeCompile = sh => {
    Object.assign(sh.uniforms, u);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying float vH;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvH = position.y;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying float vH;\nuniform float uCut;\nuniform vec3 uSeam;')
      .replace('#include <clipping_planes_fragment>', '#include <clipping_planes_fragment>\nif (vH > uCut) discard;')
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance += uSeam * (1.0 - smoothstep(0.0, 0.14, uCut - vH)) * 2.5;');
  };
  m.customProgramCacheKey = () => 'blueprint-build-v1';
  return m;
}

function lineMaterial(color, head, intensity) {
  return new THREE.ShaderMaterial({
    uniforms: {
      uColor: { value: new THREE.Color(color) }, uHead: { value: new THREE.Color(head) },
      uDraw: { value: 0 }, uAlpha: { value: 1 }, uIntensity: { value: intensity },
    },
    vertexShader: /* glsl */`
      attribute float aOrder; varying float vO;
      void main() { vO = aOrder; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */`
      uniform vec3 uColor, uHead; uniform float uDraw, uAlpha, uIntensity; varying float vO;
      void main() {
        if (vO > uDraw) discard;
        float h = smoothstep(uDraw - 0.06, uDraw, vO) * step(uDraw, 0.999);
        vec3 col = mix(uColor * uIntensity, uHead * 4.0, h);
        gl_FragColor = vec4(col, uAlpha);
      }`,
    transparent: true, depthWrite: false,
  });
}

/** Vertical drafting-board grid far behind every scene. */
function boardGridMaterial(color, opacity, major) {
  return new THREE.ShaderMaterial({
    uniforms: { uColor: { value: new THREE.Color(color) }, uA: { value: opacity }, uB: { value: major } },
    vertexShader: /* glsl */`
      varying vec3 vW; varying vec2 vL;
      void main() { vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; vL = position.xy; gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: /* glsl */`
      uniform vec3 uColor; uniform float uA, uB; varying vec3 vW; varying vec2 vL;
      float grid(vec2 p, float s) {
        vec2 g = p / s; vec2 fw = fwidth(g);
        vec2 l = abs(fract(g - 0.5) - 0.5) / max(fw, vec2(1e-4));
        return 1.0 - min(min(l.x, l.y), 1.0);
      }
      void main() {
        vec2 p = vec2(vW.x, vL.y);
        float a = grid(p, 1.0) * uA + grid(p, 5.0) * uB;
        a *= 1.0 - smoothstep(10.0, 34.0, abs(vL.x));
        a *= 1.0 - smoothstep(8.0, 22.0, vL.y);
        gl_FragColor = vec4(uColor, a);
      }`,
    transparent: true, depthWrite: false,
  });
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
function outline(w, h, r, t) {
  const s = rrShape(w, h, r);
  s.holes.push(rrShape(w - t * 2, h - t * 2, Math.max(0.0005, r - t), new THREE.Path()));
  return new THREE.ShapeGeometry(s, 8);
}

class BlueprintWorld extends BaseWorld {
  constructor(ctx, mode) {
    super(ctx);
    this.mode = mode;
    this.style = 'clay';
    this.floorY = -2.6;
    this.baseDark = this.palette.dark;
  }

  materials() {
    const p = this.palette;
    const native = this.mode === 'native';
    return {
      frame: () => M.clay(p.board, { roughness: 0.75, edgeColor: p.house.edge, rim: 0.12 }),
      panel: () => M.clay(p.board, { roughness: 0.78, edgeColor: p.house.edge, rim: 0.1 }),
      accent: () => M.clay(p.accent, { roughness: 0.6, edgeColor: p.house.edge, rim: 0.15 }),
      glyph: () => M.clay(p.accent, { roughness: 0.62, edgeColor: p.house.edge, rim: 0.12 }),
      decor: i => M.clay(p.decor[i % p.decor.length], { roughness: 0.7, edgeColor: p.house.edge }),
      ink: () => M.clay(native ? '#FFFFFF' : BRAND.ink, { roughness: 0.6 }),
      muted: () => M.clay(p.muted, { roughness: 0.72, edgeColor: p.house.edge }),
      glow: () => new THREE.MeshBasicMaterial({ color: native ? '#FFFFFF' : BRAND.ink }),
      line: () => M.flowMaterial({ color: native ? '#FFFFFF' : BRAND.ink, head: native ? '#FFFFFF' : BRAND.red, intensity: native ? 1.4 : 1 }),
    };
  }

  environment() {
    const p = this.palette;
    const native = this.mode === 'native';
    this.dome = new THREE.Mesh(new THREE.SphereGeometry(150, 48, 24), M.domeMaterial({ top: p.bgTop, bottom: p.bgBottom, blobs: p.blobs, noise: native ? 0.018 : 0.014 }));
    this.dome.renderOrder = -10;
    this.stage.scene.add(this.dome);
    this.addLights(native
      ? { hemiSky: '#EAF3FF', hemiGround: '#1C3F70', hemi: 0.5, key: 1.25, keyColor: '#FFFFFF', fill: 0.3, fillColor: '#9CC4FF', shadowRadius: 7 }
      : { hemiSky: '#FFFFFF', hemiGround: '#E6DED3', hemi: 0.65, key: 1.3, keyColor: '#FFF8F0', fill: 0.3, fillColor: '#DCE6F5', shadowRadius: 7 });
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(220, 220), M.shadowFloor(p.shadow));
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = this.floorY;
    floor.receiveShadow = true;
    this.env.add(floor);
    [[0.5, p.gridOpacity, 1], [2.5, p.gridMajor, 1.2]].forEach(([spacing, opacity, width], i) => {
      const g = new THREE.Mesh(new THREE.PlaneGeometry(110, 110), M.lineGridMaterial({ color: p.grid, spacing, width, fade: 42, opacity }));
      g.rotation.x = -Math.PI / 2;
      g.position.y = this.floorY + 0.002 + i * 0.001;
      this.env.add(g);
    });
    const board = new THREE.Mesh(new THREE.PlaneGeometry(90, 30), boardGridMaterial(p.grid, p.gridOpacity * 0.8, p.gridMajor * 0.8));
    board.geometry.translate(0, 15, 0);
    board.position.set(0, this.floorY, -26);
    this.env.add(board);
    this.houses = [buildHouse(0), buildHouse(1)];
  }

  /** Scenes are built right after anchorFor(i). Model-board faces are always drawn light. */
  anchorFor(i) {
    this.palette.dark = false;
    return super.anchorFor(i);
  }

  panel(opts = {}) {
    const pal = this.palette;
    const draw = opts.draw;
    const wrapped = draw ? (c, w, h, ...args) => {
      const prev = pal.dark;
      pal.dark = false;
      try { draw(c, w, h, ...args); } finally { pal.dark = prev; }
    } : null;
    const g = super.panel({ ...opts, draw: wrapped });
    const { w, h } = g.userData;
    return this.drafted(g, w, h, opts.depth ?? 0.1, opts.radius ?? 0.16, Math.min(w, h) > 0.5);
  }

  card(opts = {}) {
    const g = super.card(opts);
    const { w, h } = g.userData;
    return this.drafted(g, w, h, opts.depth ?? 0.12, opts.radius ?? 0.14, true);
  }

  /** Thin drafted border inset on the board, plus corner ticks that overshoot like a drawing. */
  drafted(g, w, h, depth, radius, on) {
    if (!on) return g;
    const p = this.palette;
    const mat = new THREE.MeshBasicMaterial({ color: p.boardLine, transparent: true, opacity: 0.85 });
    const inset = Math.min(0.09, Math.min(w, h) * 0.04);
    const ln = new THREE.Mesh(outline(w - inset * 2, h - inset * 2, Math.max(0.01, radius - inset), 0.012), mat);
    ln.position.z = depth / 2 + 0.01;
    g.add(ln);
    const tick = new THREE.Mesh(new THREE.PlaneGeometry(0.26, 0.012), mat);
    [[-1, 1], [1, 1], [-1, -1], [1, -1]].forEach(([sx, sy]) => {
      const a = tick.clone(); a.position.set(sx * (w / 2 + 0.06), sy * (h / 2 + 0.1), 0); g.add(a);
      const b = tick.clone(); b.rotation.z = Math.PI / 2; b.position.set(sx * (w / 2 + 0.1), sy * (h / 2 + 0.06), 0); g.add(b);
    });
    const base = g.userData.setOpacity;
    g.userData.setOpacity = a => { base(a); mat.opacity = 0.85 * a; };
    return g;
  }

  /** Halos become drafted circles: thin flat lines, no glow. */
  ring(r = 1, tube = 0.04) {
    return new THREE.Mesh(new THREE.TorusGeometry(r, Math.max(0.01, tube * 0.6), 4, 160), this.mats.glow());
  }

  trail(points, opts = {}) {
    const t = super.trail(points, { ...opts, color: this.mode === 'native' ? '#FFFFFF' : BRAND.ink });
    t.mesh.material.uniforms.uIntensity.value = this.mode === 'native' ? 1.4 : 1;
    t.mesh.material.uniforms.uHead.value.set(this.palette.accent);
    return t;
  }

  /** One house per scene, behind and below the content, building over the scene's duration. */
  onTimeline(scenes, duration) {
    this.palette.dark = this.baseDark;
    const p = this.palette;
    const r = rng((this.ctx.seed || 5) + 401);
    const portrait = this.stage.aspect < 0.95;
    this.builds = [];
    scenes.forEach((s, si) => {
      // never behind mid-frame text: the big message, and on vertical the intro lockup and end card
      if (s.type === 'message' || (portrait && (s.type === 'intro' || s.type === 'endcard'))) return;
      const H = this.houses[si % this.houses.length];
      const group = new THREE.Group();
      const solidMat = buildMaterial(p.house.solid, p.house.edge);
      const solid = new THREE.Mesh(H.solid, solidMat);
      solid.castShadow = true;
      solid.receiveShadow = true;
      group.add(solid);
      const lineMat = lineMaterial(p.house.line, p.house.head, p.house.lineGlow);
      const lines = new THREE.LineSegments(H.lines, lineMat);
      lines.renderOrder = 2;
      group.add(lines);
      const glassMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(p.house.glass).multiplyScalar(p.house.glassGlow), transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false });
      const panes = new THREE.Mesh(H.panes, glassMat);
      group.add(panes);
      const layout = s.inst.shot?.layout || 'center';
      const split = !portrait && layout === 'split';
      const side = si % 2 ? -1 : 1;
      const x = portrait ? side * r.range(0.6, 1.4) : split ? r.range(5.8, 6.6) : side * r.range(6.8, 7.6);
      const z = portrait ? -13 : split ? -10.5 : -10;
      group.position.set(s.anchor.x + x, this.floorY, s.anchor.z + z);
      group.rotation.y = (portrait ? -side * 0.5 : -Math.sign(x) * 0.55) + r.range(-0.08, 0.08);
      group.scale.setScalar(portrait ? 0.62 : 0.85);
      this.root.add(group);
      this.builds.push({ group, solidMat, lineMat, glassMat, H, s });
    });
    this.duration = duration;
  }

  update(t) {
    super.update(t);
    for (const b of this.builds || []) {
      const { s, H } = b;
      const live = t > s.start - 1.6 && t < s.end + 1.6;
      b.group.visible = live;
      if (!live) continue;
      const P = (t - s.start) / Math.max(0.5, s.end - s.start);
      const draw = ease.inOutSine(clamp((P + 0.12) / 0.5));
      const fill = ease.inOutCubic(clamp((P - 0.3) / 0.5));
      const lit = ease.outCubic(clamp((P - 0.72) / 0.22));
      b.lineMat.uniforms.uDraw.value = draw * 1.06;
      b.lineMat.uniforms.uAlpha.value = 1 - 0.55 * fill;
      b.solidMat.userData.u.uCut.value = fill <= 0 ? -1 : -0.2 + fill * (H.height + 0.4);
      b.glassMat.opacity = lit * 0.92;
    }
    if (this.keyLight) {
      this.keyLight.target.position.set(0, 0, -4);
      this.keyLight.position.set(7, 14, 8);
    }
  }

  /** Drawing-sheet chrome: a hairline border with crop ticks and, on wide formats, a title block. */
  drawOverlay(o, t, { scenes, current }) {
    const p = this.palette;
    const U = o.U;
    const c = o.ctx;
    const a = clamp(seg(t, 0.4, 0.8)) * (1 - seg(t, this.duration - 0.6, 0.5));
    if (a <= 0) return;
    const m = 16 * U;
    c.save();
    c.globalAlpha = a;
    c.strokeStyle = p.sheet;
    c.lineWidth = 1.2 * U;
    c.strokeRect(m, m, o.W - m * 2, o.H - m * 2);
    const tk = 22 * U;
    c.beginPath();
    [[m, m], [o.W - m, m], [m, o.H - m], [o.W - m, o.H - m]].forEach(([x, y]) => {
      c.moveTo(x - tk, y); c.lineTo(x + tk, y);
      c.moveTo(x, y - tk); c.lineTo(x, y + tk);
    });
    c.stroke();
    c.restore();
    if (o.portrait || !current || this.ctx.project?.captions?.on) return;
    // title block, bottom right inside the margin
    const idx = scenes.indexOf(current);
    const label = String(current.label || current.def?.label || '').toUpperCase();
    const size = 15 * U;
    const bw = 300 * U, bh = 40 * U;
    const x0 = o.W - o.safe.right - bw, y0 = o.H - o.safe.bottom + 22 * U;
    const ka = a * clamp(seg(t - current.start, 0.2, 0.5));
    c.save();
    c.globalAlpha = ka;
    c.strokeStyle = p.sheet;
    c.lineWidth = 1.2 * U;
    c.strokeRect(x0, y0, bw, bh);
    c.beginPath(); c.moveTo(x0 + 86 * U, y0); c.lineTo(x0 + 86 * U, y0 + bh); c.stroke();
    c.restore();
    o.text(`A-${String(idx + 1).padStart(2, '0')}`, x0 + 43 * U, y0 + bh / 2 + size * 0.36, { size, family: 'mono', weight: 700, align: 'center', color: p.text, alpha: ka * 0.85, tracking: 0.08 });
    o.text(label, x0 + 102 * U, y0 + bh / 2 + size * 0.36, { size, family: 'mono', weight: 500, color: p.sub, alpha: ka * 0.85, tracking: 0.1 });
  }
}

export default {
  id: 'architectural',
  name: 'Blueprint',
  family: 'Architectural',
  description: 'A wireframe home drafts itself behind every scene and fills in to a finished model, on blueprint blue.',
  bestFor: 'New construction, listings, renovation stories, process explainers, "how we build your plan"',
  swatch: ['#FBF9F5', '#EDE7DD', '#DE3341', '#22252B'],
  native: 'native',
  post: {
    bloom: { strength: 0.5, radius: 0.5, threshold: 2.0 },
    grain: 0.02, vignette: 0.16, ca: 0.0012, tone: 'neutral', exposure: 1.0, vignetteColor: '#1A2A40', scanlines: 0, band: 0,
  },
  transition: { style: 'glide', duration: 1.0 },
  drift: 0.7,
  palette: mode => blueprintPalette(mode === 'native' ? 'native' : 'brand'),
  overlayTheme: p => ({
    text: p.text, sub: p.sub, accent: p.accent, accentText: '#FFFFFF', scrim: p.scrim, scrimAlpha: p.scrimAlpha,
    chipBg: p.accent, chipText: '#FFFFFF', panel: p.dark ? rgba('#0B2C58', 0.88) : 'rgba(255,255,255,0.92)',
    panelStroke: p.dark ? 'rgba(255,255,255,0.35)' : 'rgba(17,17,17,0.18)', dark: p.dark,
  }),
  create: ctx => new BlueprintWorld(ctx, ctx.project?.brand?.mode === 'native' ? 'native' : 'brand'),
};
