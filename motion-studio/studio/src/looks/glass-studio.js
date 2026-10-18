// Glass Studio: a bright, airy light-grey studio with a faint square grid on the floor and back wall.
// Frosted glass panes float over glossy spheres that blur behind them, with soft contact shadows on
// the floor. Lots of white space; violet and magenta natively, Redfin red and ink in brand mode.
import * as THREE from 'three';
import { BaseWorld } from '../engine/world.js';
import * as M from '../engine/materials.js';
import { BRAND } from '../engine/brand.js';
import { rng, clamp, ease, seg } from '../engine/util.js';
import { sceneView, propClear, bindEnv, roundBody, roundedSlab } from './clay.js';

const WALL_BACK = 13;     // distance of the virtual back wall behind the focus point
// scenes whose main object is a pane or card: spheres can hide behind its corners
const TUCK = new Set(['hero', 'portrait', 'property', 'leaderboard', 'list', 'quote', 'screenshot']);

export function studioPalette(mode = 'brand') {
  const base = {
    dark: false,
    bgTop: '#F4F4F7', bgBottom: '#E7E7EC',
    accentText: '#FFFFFF', glassTint: '#ffffff', shadow: 0.17,
    scrim: '#F7F7F9', scrimAlpha: 0.6, fade: '#F2F2F5', logo: 'tagline',
  };
  if (mode === 'native') {
    return {
      ...base,
      studio: { sky: '#F5F5F8', wall: '#ECECF1', wallLight: '#FAFAFC', floor: '#E6E6EC', floorFar: '#EEEEF2', grid: '#8C88A3', gridAlpha: 0.17 },
      blobs: [],
      text: '#16141F', sub: '#545266', accent: '#7C3AED', accent2: '#D946EF',
      ink: '#1B1830', glow: '#A78BFA', panelTint: '#F8F7FC',
      decor: ['#7C3AED', '#D946EF', '#C4B5FD', '#6D28D9', '#FFFFFF'],
      hero: ['#7C3AED', '#D946EF', '#C4B5FD', '#A78BFA'],
      muted: '#DCD3FB', line: 'rgba(22,20,31,0.14)', floorLine: '#8C88A3', shadowColor: '#2A2040',
    };
  }
  return {
    ...base,
    studio: { sky: '#F6F5F4', wall: '#EDECEA', wallLight: '#FBFAF9', floor: '#E8E6E3', floorFar: '#EFEEEC', grid: '#968E88', gridAlpha: 0.17 },
    blobs: [],
    text: BRAND.ink, sub: '#4A4E57', accent: BRAND.red, accent2: '#E8A33D',
    ink: '#16171A', glow: BRAND.redGlow, panelTint: '#FBF9F8',
    decor: [BRAND.red, '#16171A', '#E6D8C8', '#FFFFFF', '#B3202E'],
    hero: [BRAND.red, '#E6D8C8', BRAND.red, '#F2B8B2'],
    muted: '#F0E3E1', line: 'rgba(17,17,17,0.14)', floorLine: '#968E88', shadowColor: '#2B2220',
  };
}

/**
 * Studio backdrop painted on the camera-following dome: rays from the real camera position hit a
 * virtual floor and back wall, which carry a faint square grid and meet in a seamless cove.
 */
function studioDomeMaterial(p, floorY) {
  const c = p.studio;
  return new THREE.ShaderMaterial({
    uniforms: {
      uCam: { value: new THREE.Vector3() }, uFocus: { value: new THREE.Vector3() },
      uFloorY: { value: floorY }, uWallZ: { value: -WALL_BACK }, uSpacing: { value: 1.2 }, uGridAlpha: { value: c.gridAlpha },
      uSky: { value: new THREE.Color(c.sky) }, uWall: { value: new THREE.Color(c.wall) }, uWallLight: { value: new THREE.Color(c.wallLight) },
      uFloor: { value: new THREE.Color(c.floor) }, uFloorFar: { value: new THREE.Color(c.floorFar) }, uGrid: { value: new THREE.Color(c.grid) },
    },
    vertexShader: /* glsl */`
      varying vec3 vDir;
      void main() { vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */`
      uniform vec3 uCam, uFocus, uSky, uWall, uWallLight, uFloor, uFloorFar, uGrid;
      uniform float uFloorY, uWallZ, uSpacing, uGridAlpha;
      varying vec3 vDir;
      float hash(vec3 p) { p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
      float gridLine(vec2 g) {
        vec2 fw = fwidth(g);
        vec2 l = abs(fract(g - 0.5) - 0.5) / max(fw, vec2(1e-4));
        float line = 1.0 - min(min(l.x, l.y), 1.0);
        return line * (1.0 - smoothstep(0.25, 0.6, max(fw.x, fw.y)));   // fade lines that get too dense
      }
      void main() {
        vec3 d = normalize(vDir);
        float tW = d.z < -1e-4 ? (uWallZ - uCam.z) / d.z : 1e6;
        float tF = d.y < -1e-4 ? (uFloorY - uCam.y) / d.y : 1e6;
        tW = tW > 0.0 ? tW : 1e6;
        tF = tF > 0.0 ? tF : 1e6;
        vec3 pF = uCam + d * min(tF, 400.0);
        vec3 pW = uCam + d * min(tW, 400.0);
        float gF = gridLine(pF.xz / uSpacing);
        float gW = gridLine(pW.xy / uSpacing);
        vec3 col = uSky;
        if (tF < tW && tF < 1e5) {
          float r = length(pF.xz - uFocus.xz);
          col = mix(uFloor, uFloorFar, smoothstep(8.0, 60.0, r));
          float cove = smoothstep(7.0, 0.0, pF.z - uWallZ);
          col = mix(col, uWall, cove * 0.9);
          float fade = (1.0 - smoothstep(9.0, 30.0, r)) * (1.0 - cove);
          col = mix(col, uGrid, gF * uGridAlpha * fade);
        } else if (tW < 1e5) {
          float h = pW.y - uFloorY;
          col = mix(uWall, uSky, smoothstep(3.0, 30.0, h));
          float pool = exp(-pow((pW.x - uFocus.x) / 15.0, 2.0) - pow((h - 6.0) / 7.0, 2.0));
          col = mix(col, uWallLight, pool * 0.85);
          float cove = smoothstep(5.0, 0.0, h);
          float fade = (1.0 - smoothstep(8.0, 28.0, abs(pW.x - uFocus.x))) * (1.0 - smoothstep(7.0, 20.0, h)) * (1.0 - cove);
          col = mix(col, uGrid, gW * uGridAlpha * 0.8 * fade);
        }
        col += (hash(d * 811.0) - 0.5) * (1.5 / 255.0);
        gl_FragColor = vec4(col, 1.0);
      }`,
    side: THREE.BackSide, depthWrite: false,
  });
}

class StudioWorld extends BaseWorld {
  constructor(ctx) {
    super(ctx);
    this.style = 'glass';
    this.floorY = -2.8;
    this.props = [];
  }

  /** Scenes sit side by side at one depth so the studio wall stays put. */
  anchorFor(i) {
    return new THREE.Vector3(i * this.spacing, 0, 0);
  }

  glassMat(o = {}) { return bindEnv(M.glass(o), this.stage, o.env ?? 1); }

  gloss(color, o = {}) {
    return bindEnv(M.satin(color, { clearcoat: 1, roughness: 0.14, edgeColor: this.palette.glow, rim: 0.12, ...o }), this.stage, o.env ?? 0.85);
  }

  materials() {
    const p = this.palette;
    return {
      frame: () => this.glassMat({ tint: '#FFFFFF', roughness: 0.26, thickness: 0.6, transmission: 0.95, env: 0.9 }),
      panel: () => this.glassMat({ tint: p.panelTint, roughness: 0.3, thickness: 0.6, transmission: 0.96, ior: 1.45, env: 0.9 }),
      accent: () => this.gloss(p.accent),
      glyph: () => this.gloss(p.accent, { roughness: 0.16, rim: 0.2 }),
      decor: i => this.gloss(p.decor[i % p.decor.length], { roughness: p.decor[i % p.decor.length] === '#FFFFFF' ? 0.2 : 0.14 }),
      ink: () => this.gloss(p.ink, { roughness: 0.2 }),
      muted: () => this.glassMat({ tint: p.muted, roughness: 0.3, thickness: 0.9, transmission: 0.92, env: 0.9 }),
      glow: () => M.glow(p.glow, 2.2),
      line: () => M.flowMaterial({ color: p.accent, head: '#ffffff', intensity: 1.8 }),
    };
  }

  environment() {
    const p = this.palette;
    this.dome = new THREE.Mesh(new THREE.SphereGeometry(150, 64, 32), studioDomeMaterial(p, this.floorY));
    this.dome.renderOrder = -10;
    this.stage.scene.add(this.dome);
    this.addLights({ hemiSky: '#FFFFFF', hemiGround: '#D9D7E0', hemi: 0.55, key: 2.1, keyColor: '#FFFFFF', fill: 0.45, fillColor: '#DCE4FF', shadowRadius: 22 });
    const key = this.keyLight;
    key.position.set(-4, 14, 7);
    key.shadow.blurSamples = 24;
    key.shadow.bias = -0.0005;
    key.shadow.normalBias = 0.02;
    this.lights.fill.position.set(9, 4, 6);
    const shadowMat = M.shadowFloor(p.shadow);
    shadowMat.color = new THREE.Color(p.shadowColor);
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(220, 220), shadowMat);
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = this.floorY;
    floor.receiveShadow = true;
    this.env.add(floor);
    this.floor = floor;
  }

  /** Glassmorphic panes: rounded frosted slabs with a hairline white edge on the live face. */
  panel(o = {}) {
    const w = o.w ?? 4, h = o.h ?? 2.4, radius = o.radius ?? 0.16;
    const draw = o.draw;
    const edge = h >= 0.6 && w >= 0.6;
    const wrapped = (c, cw, ch, ...args) => {
      if (draw) draw(c, cw, ch, ...args);
      if (!edge) return;
      const s = cw / w;
      const inset = Math.max(2, cw * 0.006);
      c.save();
      const g = c.createLinearGradient(0, 0, cw, ch);
      g.addColorStop(0, 'rgba(255,255,255,0.22)');
      g.addColorStop(0.5, 'rgba(255,255,255,0)');
      g.addColorStop(1, 'rgba(70,60,100,0.05)');
      c.fillStyle = g;
      roundRectPath(c, 0, 0, cw, ch, radius * s);
      c.fill();
      roundRectPath(c, inset, inset, cw - inset * 2, ch - inset * 2, Math.max(2, radius * s - inset));
      c.lineWidth = Math.max(2, cw * 0.003);
      c.strokeStyle = 'rgba(255,255,255,0.95)';
      c.stroke();
      c.restore();
    };
    return roundBody(super.panel({ ...o, draw: wrapped }), w, h, o.depth ?? 0.1, radius);
  }

  card(o = {}) { return roundBody(super.card(o), o.w ?? 3, o.h ?? 2, o.depth ?? 0.12, o.radius ?? 0.14); }

  /** Keep the official Redfin mark in Redfin red in every palette. */
  logo3d(key = 'redfin', opts = {}) {
    if (opts.material) return super.logo3d(key, opts);
    return super.logo3d(key, { ...opts, material: this.gloss(BRAND.red) });
  }

  /** Per scene: glossy spheres tucked behind the content, a few wide ones, and one pane-over-sphere vignette. */
  onTimeline(scenes, duration) {
    const p = this.palette;
    const r = rng((this.ctx.seed || 9) ^ 0x57d10);
    this.duration = duration;
    scenes.forEach((s, si) => {
      if (s.inst.noDecor) return;
      const view = sceneView(this, s);
      const placed = [];
      const free = (pos, rad) => !placed.some(q => q.p.distanceTo(pos) < q.r + rad + 0.35);
      const tryPlace = (rad, sampler, tries = 70, inside = false, avoidContent = true) => {
        for (let k = 0; k < tries; k++) {
          const rel = sampler();
          if (!propClear(view, s, rel, rad, { inside, avoidContent })) continue;
          const pos = rel.clone().add(s.anchor);
          if (!free(pos, rad)) continue;
          placed.push({ p: pos, r: rad });
          return pos;
        }
        return null;
      };
      const colorAt = k => p.hero[(si + k) % p.hero.length];
      // 1) spheres tucked behind a panel or card corner, peeking out and blurred through the frosted glass
      const shot = s.inst.shot || {};
      const fw = Math.max(1.5, (shot.frame?.w ?? 6) - 0.7), fh = Math.max(1.5, (shot.frame?.h ?? 4) - 0.7);
      const c0 = shot.center || new THREE.Vector3();
      const nBehind = TUCK.has(s.type) ? 2 : 0;
      const corners = [[1, 1], [-1, -1], [-1, 1], [1, -1]];
      const first = Math.floor(r() * 4);
      for (let i = 0; i < nBehind; i++) {
        const rad = r.range(0.55, 0.95) * (i ? 0.75 : 1);
        let pos = null;
        for (let cI = 0; cI < 4 && !pos; cI++) {
          const [sx, sy] = corners[(first + i * 2 + cI) % 4];
          pos = tryPlace(rad, () => new THREE.Vector3(c0.x + sx * fw / 2 * r.range(1.04, 1.18), c0.y + sy * fh / 2 * r.range(0.75, 1.1), r.range(-3.0, -2.0) - rad), 14, false, false);
        }
        if (pos) this.addSphere(pos, rad, colorAt(i), s, i, r);
      }
      // 2) a few wide spheres, some resting on the floor
      const nWide = Math.max(2, (s.inst.decorCount ?? 5) - 2);
      for (let i = 0; i < nWide; i++) {
        const grounded = i === 0 || r() < 0.35;
        const rad = grounded ? r.range(0.4, 0.8) : r.range(0.22, 0.6);
        const side = (i + si) % 2 ? 1 : -1;
        const pos = tryPlace(rad, () => grounded
          ? new THREE.Vector3(side * r.range(4.5, 10), this.floorY + rad, r.range(-8, 0.5))
          : new THREE.Vector3(side * r.range(4.6, 10), r.range(-1.5, 3.8), r.range(-8, 0.5)));
        if (pos) this.addSphere(pos, rad, p.decor[(si * 2 + i) % p.decor.length], s, 2 + i, r, grounded);
      }
      // 3) one ambient frosted pane with a sphere glowing through it
      const pw = r.range(1.5, 2.2), ph = pw * r.range(1.15, 1.45);
      const bound = Math.hypot(pw, ph) / 2;
      const panePos = tryPlace(bound, () => new THREE.Vector3((r() < 0.5 ? -1 : 1) * r.range(5.6, 9.5), r.range(-0.8, 2.6), r.range(-6.5, -1.8)), 60, true);
      if (panePos) {
        const pane = new THREE.Mesh(roundedSlab(pw, ph, 0.08, 0.22), this.glassMat({ tint: '#FFFFFF', roughness: 0.3, thickness: 0.5, transmission: 1, env: 0.9 }));
        pane.castShadow = true;
        pane.position.copy(panePos);
        pane.rotation.y = -Math.sign(panePos.x - view.pos.x) * r.range(0.15, 0.35);
        this.root.add(pane);
        this.props.push(this.prop(pane, s, 1, r, { amp: 0.12 }));
        const sr = Math.min(pw, ph) * r.range(0.32, 0.42);
        const sp = panePos.clone().add(new THREE.Vector3(r.range(-0.4, 0.4) * pw, r.range(-0.2, 0.45) * ph, -0.75 - sr));
        this.addSphere(sp, sr, colorAt(2), s, 5, r, false, 0.12);
      }
    });
  }

  prop(mesh, s, i, r, o = {}) {
    return { mesh, base: mesh.position.clone(), t0: s.start, t1: s.end, delay: 0.1 + i * 0.09, phase: r() * 10, amp: o.amp ?? r.range(0.08, 0.22), freq: r.range(0.45, 0.75), grounded: !!o.grounded, rot0: mesh.rotation.y };
  }

  addSphere(pos, rad, color, s, i, r, grounded = false, amp) {
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(rad, 64, 40), this.gloss(color, { roughness: color === '#FFFFFF' ? 0.2 : 0.12 }));
    mesh.castShadow = true;
    mesh.position.copy(pos);
    this.root.add(mesh);
    this.props.push(this.prop(mesh, s, i, r, { grounded, amp }));
  }

  dispose() {
    super.dispose();
    this.dome?.geometry.dispose();
    this.dome?.material.dispose();
  }

  update(t) {
    super.update(t);
    const u = this.dome?.material.uniforms;
    if (u) {
      u.uCam.value.copy(this.stage.camera.position);
      u.uFocus.value.copy(this.focusPoint);
      u.uWallZ.value = this.focusPoint.z - WALL_BACK;
    }
    for (const d of this.props) {
      const vis = t > d.t0 - 1.3 && t < d.t1 + 1.3;
      d.mesh.visible = vis;
      if (!vis) continue;
      const k = ease.outBackSoft(seg(t, d.t0 - 0.3 + d.delay, 1.0)) * (1 - ease.inCubic(seg(t, d.t1 - 0.35, 0.6)));
      d.mesh.scale.setScalar(Math.max(0.001, k));
      if (!d.grounded) {
        d.mesh.position.y = d.base.y + Math.sin(t * d.freq + d.phase) * d.amp;
        d.mesh.rotation.y = d.rot0 + Math.sin(t * 0.3 + d.phase) * 0.06;
      } else {
        d.mesh.position.y = d.base.y - (1 - k) * d.mesh.geometry.parameters.radius;
      }
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
  id: 'glass-studio',
  name: 'Glass Studio',
  family: 'Glass',
  description: 'A bright, airy grey studio with frosted glass panes floating over glossy spheres.',
  bestFor: 'Market updates, stats, listings, polished client-facing posts',
  swatch: ['#F4F4F7', '#E7E7EC', '#7C3AED', '#16141F'],
  native: 'native',
  post: {
    bloom: { strength: 0.4, radius: 0.5, threshold: 1.3 },
    grain: 0.014, vignette: 0.12, vignetteColor: '#5E5B70', ca: 0.0012, tone: 'neutral', exposure: 1.0,
  },
  transition: { style: 'glide', duration: 1.0 },
  drift: 0.85,
  palette: mode => studioPalette(mode === 'native' ? 'native' : 'brand'),
  overlayTheme: p => ({
    text: p.text, sub: p.sub, accent: p.accent, accentText: '#FFFFFF', scrim: p.scrim, scrimAlpha: p.scrimAlpha,
    chipBg: p.accent, chipText: '#FFFFFF', panel: 'rgba(255,255,255,0.88)', panelStroke: 'rgba(255,255,255,1)', dark: false,
  }),
  create: ctx => new StudioWorld(ctx),
};
