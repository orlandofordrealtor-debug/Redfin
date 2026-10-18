// Celebration: a warm festive night for wins. Wine-red space with golden glow, confetti that never
// stops falling, glints that flash and bloom, gold trophies and stars around every scene, and a
// confetti burst as each scene lands.
import * as THREE from 'three';
import { BaseWorld, setMatOpacity } from '../engine/world.js';
import * as M from '../engine/materials.js';
import { BRAND } from '../engine/brand.js';
import { slab } from '../engine/geo.js';
import { rng, noise1, clamp } from '../engine/util.js';

const GOLD = '#F0B53E';

export function celebrationPalette(mode = 'brand') {
  if (mode === 'native') {
    return {
      dark: true,
      bgTop: '#2C0B42', bgBottom: '#090413',
      blobs: [
        { dir: [-0.75, 0.5, -0.45], color: '#8E1A78', size: 0.42 },
        { dir: [0.8, 0.35, -0.5], color: '#0A6470', size: 0.4 },
        { dir: [0.05, 0.2, -1], color: '#5A2A10', size: 0.34 },
        { dir: [-0.2, 0.85, -0.3], color: '#3A1050', size: 0.5 },
      ],
      text: '#FFFFFF', sub: 'rgba(255,255,255,0.78)', accent: '#E0218A', accent2: '#19C6CC', accentText: '#FFFFFF',
      ink: '#FFFFFF', glassTint: '#ffffff', decor: [GOLD, '#E0218A', '#19C6CC', '#FFFFFF'],
      confetti: [GOLD, '#E0218A', '#19C6CC', '#FFFFFF', '#FF7AC6'],
      body: '#1A0A2A', muted: '#C9BCD6', face: '#FFC54D',
      glow: '#FFC85A', line: 'rgba(255,255,255,0.22)', floorLine: GOLD,
      shadow: 0.42, scrim: '#12061E', scrimAlpha: 0.45, fade: '#090413', logo: 'taglineReversed',
    };
  }
  return {
    dark: true,
    bgTop: '#2A050C', bgBottom: '#080103',
    blobs: [
      { dir: [-0.75, 0.5, -0.45], color: '#6A3A0E', size: 0.32 },
      { dir: [0.78, 0.42, -0.45], color: '#5C320A', size: 0.3 },
      { dir: [0.0, 0.16, -1], color: '#5E0C18', size: 0.42 },
      { dir: [-0.1, 0.9, -0.2], color: '#3A0711', size: 0.45 },
    ],
    text: '#FFFFFF', sub: 'rgba(255,255,255,0.78)', accent: BRAND.red, accent2: GOLD, accentText: '#FFFFFF',
    ink: '#FFFFFF', glassTint: '#ffffff', decor: [BRAND.red, GOLD, '#FFFFFF', BRAND.ink],
    confetti: [BRAND.red, GOLD, '#FFFFFF', '#FF8A7A', '#FFD98A'],
    body: '#22060D', muted: '#CDB9A5', face: '#FFC54D',
    glow: '#FFC85A', line: 'rgba(255,255,255,0.22)', floorLine: GOLD,
    shadow: 0.42, scrim: '#14040A', scrimAlpha: 0.45, fade: '#0C0205', logo: 'taglineReversed',
  };
}

function goldMat(o = {}) {
  return M.satin(o.color || GOLD, { metalness: 1, roughness: o.roughness ?? 0.22, clearcoat: 0.6, env: o.env ?? 1.4, rim: 0.18, rimColor: '#FFE7A8', edgeColor: '#FFE08A' });
}

/** A classic cup trophy: lathe-turned body and base, torus handles. Height ~2.4. */
function trophyGeometry() {
  const pts = [
    [0, 0], [0.62, 0], [0.62, 0.16], [0.52, 0.2], [0.5, 0.34], [0.26, 0.4], [0.14, 0.52],
    [0.1, 0.86], [0.18, 0.96], [0.14, 1.02], [0.3, 1.1], [0.55, 1.3], [0.72, 1.62], [0.8, 2.04],
    [0.84, 2.36], [0.78, 2.38], [0.73, 2.06], [0.64, 1.68], [0.46, 1.42], [0, 1.36],
  ].map(([x, y]) => new THREE.Vector2(x, y));
  return new THREE.LatheGeometry(pts, 56);
}

function starShape(outer = 0.5, inner = 0.22, points = 5) {
  const s = new THREE.Shape();
  for (let i = 0; i < points * 2; i++) {
    const r = i % 2 ? inner : outer;
    const a = Math.PI / 2 + (i * Math.PI) / points;
    if (i === 0) s.moveTo(Math.cos(a) * r, Math.sin(a) * r); else s.lineTo(Math.cos(a) * r, Math.sin(a) * r);
  }
  s.closePath();
  return s;
}

class CelebrationWorld extends BaseWorld {
  constructor(ctx, mode) {
    super(ctx);
    this.mode = mode;
    this.style = 'glass';
    this.floorY = -2.6;
  }

  materials() {
    const p = this.palette;
    return {
      frame: () => goldMat({ roughness: 0.26 }),
      panel: () => M.satin(p.body, { roughness: 0.22, clearcoat: 1, env: 0.9, rim: 0.2, rimColor: '#FFD9A0' }),
      accent: () => M.satin(p.accent, { clearcoat: 1, roughness: 0.18, rim: 0.2, edgeColor: '#FFE08A' }),
      glyph: () => goldMat({ roughness: 0.18 }),
      decor: i => {
        const c = p.decor[i % p.decor.length];
        return c === GOLD ? goldMat({ roughness: 0.16 }) : M.satin(c, { clearcoat: 1, roughness: 0.14, rim: 0.2, edgeColor: '#FFE08A' });
      },
      ink: () => M.satin('#FFFFFF', { roughness: 0.25, clearcoat: 1 }),
      muted: () => M.satin(p.muted, { roughness: 0.28, clearcoat: 1, rim: 0.15 }),
      glow: () => M.glow(p.glow, 2.6),
      line: () => M.flowMaterial({ color: GOLD, head: '#FFFFFF' }),
    };
  }

  environment() {
    const p = this.palette;
    this.dome = new THREE.Mesh(new THREE.SphereGeometry(150, 48, 24), M.domeMaterial({ top: p.bgTop, bottom: p.bgBottom, blobs: p.blobs, noise: 0.012 }));
    this.dome.renderOrder = -10;
    this.stage.scene.add(this.dome);
    this.addLights({ hemiSky: '#FFF1DE', hemiGround: '#2A0A12', hemi: 0.4, key: 1.7, keyColor: '#FFF0D8', fill: 0.75, fillColor: this.mode === 'native' ? '#FF6FD0' : '#FF7A6A', shadowRadius: 9 });
    const rim = new THREE.DirectionalLight(this.mode === 'native' ? '#5FF0F0' : '#FFC46A', 1.1);
    rim.position.set(2, 5, -10);
    this.env.add(rim);

    const floor = new THREE.Mesh(new THREE.PlaneGeometry(220, 220), M.shadowFloor(p.shadow));
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = this.floorY;
    floor.receiveShadow = true;
    this.env.add(floor);
    // a sparkling party floor: fine gold dots
    const dots = new THREE.Mesh(new THREE.PlaneGeometry(80, 80), M.dotFloorMaterial({ color: GOLD, spacing: 0.55, dot: 0.06, fade: 30, opacity: 0.32 }));
    dots.rotation.x = -Math.PI / 2;
    dots.position.y = this.floorY + 0.002;
    this.env.add(dots);

    this.buildConfettiRain();
    this.buildGlints();
  }

  /** Continuous confetti, falling behind and beside the action. Every piece is a pure function of t. */
  buildConfettiRain() {
    const N = 560;
    const r = rng((this.ctx.seed || 9) + 33);
    const geo = new THREE.PlaneGeometry(0.15, 0.085);
    const mat = new THREE.MeshStandardMaterial({ side: THREE.DoubleSide, roughness: 0.4, metalness: 0.35, envMapIntensity: 1.1 });
    const mesh = new THREE.InstancedMesh(geo, mat, N);
    mesh.frustumCulled = false;
    const cols = this.palette.confetti;
    const c = new THREE.Color();
    const parts = [];
    for (let i = 0; i < N; i++) {
      mesh.setColorAt(i, c.set(cols[i % cols.length]));
      const wide = i % 4 === 0;                 // a quarter falls wide of the content, nearer the lens
      const side = r() < 0.5 ? -1 : 1;
      parts.push({
        x: wide ? side * r.range(5.6, 13) : r.range(-16, 16),
        z: wide ? r.range(-2.5, 2.5) : r.range(-15, -2.2),
        ph: r(), sp: r.range(0.45, 0.95), fl: r.range(0.6, 1.6), amp: r.range(0.15, 0.5),
        spin: [r.range(-4, 4), r.range(-5, 5), r.range(-3, 3)], s: r.range(0.75, 1.3),
      });
    }
    mesh.instanceColor.needsUpdate = true;
    this.env.add(mesh);
    this.rain = { mesh, parts, H: 13 };
  }

  /** Four-point glints that flash and bloom. */
  buildGlints() {
    const N = 64;
    const r = rng((this.ctx.seed || 9) + 71);
    const s = new THREE.Shape();
    const k = 0.13;
    s.moveTo(0, 1); s.quadraticCurveTo(k, k, 1, 0); s.quadraticCurveTo(k, -k, 0, -1); s.quadraticCurveTo(-k, -k, -1, 0); s.quadraticCurveTo(-k, k, 0, 1);
    const geo = new THREE.ShapeGeometry(s, 6);
    const mat = new THREE.MeshBasicMaterial({ color: new THREE.Color('#FFE3A0').multiplyScalar(3.2), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
    const mesh = new THREE.InstancedMesh(geo, mat, N);
    mesh.frustumCulled = false;
    const parts = [];
    for (let i = 0; i < N; i++) {
      const wide = i % 3 === 0;
      const side = r() < 0.5 ? -1 : 1;
      parts.push({
        p: new THREE.Vector3(wide ? side * r.range(5.2, 11) : r.range(-12, 12), r.range(-1.8, 7.5), wide ? r.range(-3, 1.5) : r.range(-13, -2.5)),
        f: r.range(0.5, 1.3), ph: r() * 20, s: r.range(0.12, 0.32),
      });
    }
    this.env.add(mesh);
    this.glints = { mesh, parts };
  }

  /** Panel: colored lacquer with a gold rim; canvas faces print their highlights in gold. */
  panel(opts = {}) {
    const pal = this.palette;
    const draw = opts.draw;
    const wrapped = draw ? (c, w, h, ...args) => {
      const prev = pal.accent;
      pal.accent = pal.face;
      try { draw(c, w, h, ...args); } finally { pal.accent = prev; }
    } : null;
    const g = super.panel({ ...opts, draw: wrapped });
    const { w, h } = g.userData;
    const depth = opts.depth ?? 0.1, radius = opts.radius ?? 0.16;
    const gm = goldMat({ roughness: 0.2 });
    const rim = new THREE.Mesh(slab(w + 0.07, h + 0.07, depth * 0.5, radius + 0.035), gm);
    rim.position.z = -depth * 0.12;
    g.add(rim);
    const base = g.userData.setOpacity;
    g.userData.setOpacity = a => { base(a); setMatOpacity(gm, a); };
    return g;
  }

  trail(points, opts = {}) {
    return super.trail(points, { ...opts, color: GOLD });
  }

  /** Trophies, floating stars and a confetti burst for every scene. */
  onTimeline(scenes, duration) {
    const p = this.palette;
    const r = rng((this.ctx.seed || 5) + 211);
    const portrait = this.stage.aspect < 0.95;
    this.props = [];
    this.bursts = [];
    const trophyGeo = trophyGeometry();
    const handleGeo = new THREE.TorusGeometry(0.3, 0.055, 12, 40, Math.PI * 1.1);
    const plinthGeo = slab(1.5, 0.5, 1.5, 0.05);
    const starGeo = new THREE.ExtrudeGeometry(starShape(0.5, 0.21), { depth: 0.16, bevelEnabled: true, bevelThickness: 0.06, bevelSize: 0.05, bevelSegments: 3, curveSegments: 4 });
    starGeo.center();
    const starMats = [goldMat({ roughness: 0.16 }), M.satin(p.accent, { clearcoat: 1, roughness: 0.15, rim: 0.25 }), goldMat({ roughness: 0.16 }), M.satin(p.accent2, { clearcoat: 1, roughness: 0.15, rim: 0.25 })];

    scenes.forEach((s, si) => {
      const a = s.anchor;
      const layout = s.inst.shot?.layout || 'center';
      const split = !portrait && layout === 'split';
      // trophy on a plinth, wide of the content (right of the subject on split layouts)
      if (!portrait && !s.inst.noDecor) {
        const side = split ? 1 : (si % 2 ? -1 : 1);
        const tr = new THREE.Group();
        const plinth = new THREE.Mesh(plinthGeo, M.satin(p.body, { roughness: 0.2, clearcoat: 1 }));
        plinth.position.y = 0.25;
        plinth.castShadow = true;
        tr.add(plinth);
        const cupMat = goldMat({ roughness: 0.14 });
        const cup = new THREE.Mesh(trophyGeo, cupMat);
        cup.position.y = 0.5;
        cup.castShadow = true;
        tr.add(cup);
        [-1, 1].forEach(sd => {
          const hnd = new THREE.Mesh(handleGeo, cupMat);
          hnd.position.set(sd * 0.78, 2.4, 0);
          hnd.rotation.z = sd > 0 ? -Math.PI * 0.55 : Math.PI * 1.55;
          tr.add(hnd);
        });
        tr.scale.setScalar(1.05);
        const x = split ? r.range(5.6, 6.3) : side * r.range(6.4, 7.4);
        tr.position.set(a.x + x, this.floorY, a.z + (split ? r.range(-5.2, -4.2) : r.range(-4.4, -3)));
        this.root.add(tr);
        this.props.push({ mesh: tr, base: tr.position.clone(), kind: 'trophy', phase: r() * 10 });
      }
      // floating stars
      const n = s.inst.noDecor ? 0 : 3;
      for (let i = 0; i < n; i++) {
        const side = split ? 1 : (i % 2 ? 1 : -1);
        const st = new THREE.Mesh(starGeo, starMats[(si + i) % starMats.length]);
        st.castShadow = true;
        st.scale.setScalar(r.range(0.55, 1.0) * (i === 0 ? 1.3 : 1));
        const base = portrait
          ? new THREE.Vector3(side * r.range(2.2, 3.6), r.range(-1.8, 1.2), r.range(-7, -3.2))
          : split
            ? new THREE.Vector3(r.range(3.6, 6.8), r.range(1.6, 3.8), r.range(-7.5, -3.5))
            : new THREE.Vector3(side * r.range(5.0, 7.4), r.range(0.4, 3.6), r.range(-6.5, -2.5));
        base.add(a);
        st.position.copy(base);
        this.root.add(st);
        this.props.push({ mesh: st, base, kind: 'star', phase: r() * 10, spin: r.range(0.4, 0.9) * (r() < 0.5 ? -1 : 1) });
      }
      // the burst that greets every scene, launched from behind the content
      const burst = this.confetti({
        count: 150, colors: p.confetti, seed: 500 + si * 13, spread: portrait ? 5 : 8, size: 0.14,
        origin: new THREE.Vector3(a.x, a.y + 3.4, a.z - 3.6),
      });
      burst.mesh.visible = false;
      this.root.add(burst.mesh);
      this.bursts.push({ ...burst, t0: s.start + (si === 0 ? 0.6 : 0.05) });
    });
    this.duration = duration;
  }

  update(t) {
    super.update(t);
    const cam = this.stage.camera;
    for (const d of this.props || []) {
      if (d.kind === 'trophy') {
        d.mesh.rotation.y = Math.sin(t * 0.35 + d.phase) * 0.5;
      } else {
        d.mesh.position.y = d.base.y + Math.sin(t * 0.8 + d.phase) * 0.22;
        d.mesh.position.x = d.base.x + noise1(t * 0.3 + d.phase, 2) * 0.2;
        d.mesh.rotation.set(Math.sin(t * 0.5 + d.phase) * 0.35, t * d.spin + d.phase, Math.sin(t * 0.4 + d.phase) * 0.2);
      }
    }
    for (const b of this.bursts || []) {
      const live = t > b.t0 - 0.05 && t < b.t0 + 4.6;
      b.mesh.visible = live;
      if (live) b.update(t, b.t0);
    }
    if (this.rain) {
      const { mesh, parts, H } = this.rain;
      for (let i = 0; i < parts.length; i++) {
        const P = parts[i];
        const y = 9.5 - (((t * P.sp + P.ph * H) % H) + H) % H;
        _p.set(P.x + Math.sin(t * P.fl + P.ph * 20) * P.amp, y, P.z + Math.cos(t * P.fl * 0.7 + P.ph * 9) * 0.2);
        _e.set(t * P.spin[0] + P.ph * 9, t * P.spin[1] + P.ph * 5, t * P.spin[2]);
        _q.setFromEuler(_e);
        _s.setScalar(P.s * clamp((y - this.floorY) * 2));
        _m4.compose(_p, _q, _s);
        mesh.setMatrixAt(i, _m4);
      }
      mesh.instanceMatrix.needsUpdate = true;
    }
    if (this.glints) {
      const { mesh, parts } = this.glints;
      for (let i = 0; i < parts.length; i++) {
        const P = parts[i];
        const flash = Math.pow(Math.max(0, Math.sin(t * P.f * 2.2 + P.ph)), 6);
        _q.copy(cam.quaternion);
        _e.set(0, 0, t * 0.6 + P.ph);
        _q2.setFromEuler(_e);
        _q.multiply(_q2);
        _s.setScalar(Math.max(0.0001, P.s * flash));
        _m4.compose(P.p, _q, _s);
        mesh.setMatrixAt(i, _m4);
      }
      mesh.instanceMatrix.needsUpdate = true;
    }
    if (this.keyLight) {
      this.keyLight.target.position.set(0, 0, 0);
      this.keyLight.position.set(6, 12, 9);
    }
  }
}

const _m4 = new THREE.Matrix4(), _q = new THREE.Quaternion(), _q2 = new THREE.Quaternion(), _e = new THREE.Euler();
const _p = new THREE.Vector3(), _s = new THREE.Vector3();

export default {
  id: 'celebration',
  name: 'Celebration',
  family: 'Celebration',
  description: 'A festive night for wins: confetti that keeps falling, gold trophies and stars, flashes of light.',
  bestFor: 'Closings, team wins, awards, anniversaries, milestones',
  swatch: ['#3E0812', '#0C0205', '#F0B53E', '#DE3341'],
  native: 'native',
  post: {
    bloom: { strength: 0.75, radius: 0.65, threshold: 1.15 },
    grain: 0.024, vignette: 0.38, ca: 0.002, tone: 'neutral', exposure: 1.0, vignetteColor: '#100208',
  },
  transition: { style: 'whip', duration: 0.85 },
  drift: 1.15,
  palette: mode => celebrationPalette(mode === 'native' ? 'native' : 'brand'),
  overlayTheme: p => ({
    text: p.text, sub: p.sub, accent: p.accent, accentText: '#FFFFFF', scrim: p.scrim, scrimAlpha: p.scrimAlpha,
    chipBg: p.accent, chipText: '#FFFFFF', panel: 'rgba(30,8,16,0.82)', panelStroke: 'rgba(240,181,62,0.4)', dark: true,
  }),
  create: ctx => new CelebrationWorld(ctx, ctx.project?.brand?.mode === 'native' ? 'native' : 'brand'),
};
