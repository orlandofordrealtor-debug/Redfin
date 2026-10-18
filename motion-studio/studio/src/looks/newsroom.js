// Data Newsroom: a broadcast studio. A glowing LED video wall of live charts behind every scene,
// a glossy floor with a line grid, dark high-contrast panels with lit edges, bold saturated color,
// and a scrolling news ticker with a LIVE bug on the 2D layer.
import * as THREE from 'three';
import { BaseWorld } from '../engine/world.js';
import * as M from '../engine/materials.js';
import { BRAND } from '../engine/brand.js';
import { slab } from '../engine/geo.js';
import { rng, clamp, ease, seg, rgba } from '../engine/util.js';

export function newsroomPalette(mode = 'brand') {
  if (mode === 'native') {
    return {
      dark: true,
      bgTop: '#0A1630', bgBottom: '#02060E',
      blobs: [{ dir: [0, 0.2, -1], color: '#0E2C5E', size: 0.5 }, { dir: [-0.8, 0.5, -0.3], color: '#081A3A', size: 0.5 }],
      text: '#FFFFFF', sub: 'rgba(214,228,255,0.78)', accent: '#1F7BFF', accent2: '#FFB020', accentText: '#FFFFFF',
      ink: '#FFFFFF', glassTint: '#ffffff', decor: ['#1F7BFF', '#A9B8D4', '#FFB020', '#16284A'],
      body: '#0B1528', muted: '#3A4357', wall: { base: '#06122A', a: '#1F7BFF', b: '#FFB020', c: '#4FD2FF' },
      glow: '#3D9BFF', line: 'rgba(120,170,255,0.3)', floorLine: '#3D8BFF', tickerBg: '#071126', live: '#FFB020', liveText: '#071126',
      shadow: 0.5, scrim: '#040A18', scrimAlpha: 0.5, fade: '#02060E', logo: 'taglineReversed',
    };
  }
  return {
    dark: true,
    bgTop: '#17181C', bgBottom: '#050506',
    blobs: [{ dir: [0, 0.2, -1], color: '#2A1216', size: 0.45 }, { dir: [-0.8, 0.5, -0.3], color: '#15161A', size: 0.5 }],
    text: '#FFFFFF', sub: 'rgba(255,255,255,0.74)', accent: BRAND.red, accent2: '#FFFFFF', accentText: '#FFFFFF',
    ink: '#FFFFFF', glassTint: '#ffffff', decor: [BRAND.red, '#B9BCC4', '#3A3D45', BRAND.red],
    body: '#121317', muted: '#454952', wall: { base: '#0B0B0D', a: '#DE3341', b: '#F4F1EE', c: '#FF6A74' },
    glow: BRAND.redGlow, line: 'rgba(255,255,255,0.22)', floorLine: '#C9CCD3', tickerBg: '#0E0F12', live: BRAND.red, liveText: '#FFFFFF',
    shadow: 0.5, scrim: '#0B0B0D', scrimAlpha: 0.5, fade: '#050506', logo: 'taglineReversed',
  };
}

/** The LED video wall: 16:9 tiles of live bar charts, sparklines and data rows on a pixel grid. */
function ledWallMaterial({ base, a, b, c }) {
  return new THREE.ShaderMaterial({
    uniforms: {
      uBase: { value: new THREE.Color(base) }, uA: { value: new THREE.Color(a) }, uB: { value: new THREE.Color(b) },
      uC: { value: new THREE.Color(c) }, uTime: { value: 0 },
    },
    vertexShader: /* glsl */`
      varying vec3 vW; varying vec2 vL;
      void main() { vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; vL = position.xy; gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: /* glsl */`
      uniform vec3 uBase, uA, uB, uC; uniform float uTime;
      varying vec3 vW; varying vec2 vL;
      float h1(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      void main() {
        vec2 tile = vec2(2.4, 1.35);
        vec2 q = vec2(vW.x, vL.y) / tile;
        vec2 id = floor(q);
        vec2 f = fract(q);
        float r = h1(id);
        float r2 = h1(id + 17.3);
        // seams between cabinets
        vec2 fw = fwidth(q);
        vec2 e = smoothstep(vec2(0.0), fw * 1.5 + 0.012, f) * smoothstep(vec2(0.0), fw * 1.5 + 0.012, 1.0 - f);
        float seam = e.x * e.y;
        vec3 col = uBase * (0.75 + 0.5 * f.y);
        vec3 ink = r2 < 0.18 ? uB : (r2 < 0.3 ? uC : uA);
        float lit = 0.0;
        if (r < 0.34) {
          // bar chart
          float n = 6.0;
          float bi = floor(f.x * n);
          float bx = fract(f.x * n);
          float hgt = 0.15 + 0.7 * (0.5 + 0.5 * sin(uTime * (0.6 + r2) + bi * 1.7 + r * 30.0));
          float bar = step(0.18, bx) * step(bx, 0.82) * step(0.12, f.y) * step(f.y, 0.12 + hgt * 0.76);
          lit = bar * (0.55 + 0.45 * step(5.0, bi));
        } else if (r < 0.58) {
          // sparkline with area fill
          float x = f.x * 6.0 + uTime * 0.35 + r * 20.0;
          float y = 0.5 + 0.22 * sin(x * 1.3) + 0.12 * sin(x * 3.1 + r * 9.0);
          float d = abs(f.y - y);
          lit = (1.0 - smoothstep(0.012, 0.03, d)) + 0.18 * step(f.y, y) * step(0.1, f.y);
        } else if (r < 0.8) {
          // data rows scrolling up
          float rows = 7.0;
          float ry = f.y * rows + uTime * 0.5 * (0.5 + r2);
          float ri = floor(ry);
          float rf = fract(ry);
          float len = 0.25 + 0.6 * h1(vec2(ri, id.x * 3.0 + id.y));
          lit = step(0.3, rf) * step(rf, 0.65) * step(0.1, f.x) * step(f.x, 0.1 + len * 0.8) * 0.6;
        } else {
          // soft brand glow tile, breathing
          lit = 0.22 + 0.18 * sin(uTime * 0.8 + r * 40.0);
          lit *= 1.0 - length(f - 0.5) * 1.2;
        }
        // LED pixel pitch, faded out where it would alias
        vec2 px = fract(vec2(vW.x, vL.y) * 9.0) - 0.5;
        float pw = fwidth(vW.x * 9.0);
        float dotm = mix(1.0 - smoothstep(0.32, 0.46, length(px)), 0.72, smoothstep(0.25, 0.6, pw));
        col += ink * lit * dotm * 0.8;
        // keep it dim at the edges and toward the top so it never fights the headline
        float glow = exp(-pow(vL.x / 16.0, 2.0)) * (1.0 - 0.85 * smoothstep(3.0, 11.0, vL.y));
        col *= seam * (0.25 + 0.75 * glow);
        gl_FragColor = vec4(col, 1.0);
      }`,
  });
}

class NewsroomWorld extends BaseWorld {
  constructor(ctx, mode) {
    super(ctx);
    this.mode = mode;
    this.style = 'glass';
    this.floorY = -2.6;
  }

  materials() {
    const p = this.palette;
    return {
      frame: () => M.satin(p.body, { roughness: 0.18, clearcoat: 1, env: 0.9, rim: 0.15, edgeColor: p.accent }),
      panel: () => M.satin(p.body, { roughness: 0.2, clearcoat: 1, env: 0.85, rim: 0.12, edgeColor: p.accent }),
      accent: () => M.satin(p.accent, { clearcoat: 1, roughness: 0.16, emissive: p.accent, emissiveIntensity: 0.06, rim: 0.2, edgeColor: '#FFFFFF' }),
      glyph: () => M.satin(p.accent, { clearcoat: 1, roughness: 0.14, emissive: p.accent, emissiveIntensity: 0.05, rim: 0.3, edgeColor: '#FFFFFF' }),
      decor: i => M.satin(p.decor[i % p.decor.length], { clearcoat: 1, roughness: 0.18, rim: 0.2 }),
      ink: () => M.satin('#FFFFFF', { roughness: 0.25, clearcoat: 1 }),
      muted: () => M.satin(p.muted, { roughness: 0.22, clearcoat: 1, rim: 0.15 }),
      glow: () => M.glow(p.glow, 2.6),
      line: () => M.flowMaterial({ color: p.accent, head: '#FFFFFF' }),
    };
  }

  environment() {
    const p = this.palette;
    this.dome = new THREE.Mesh(new THREE.SphereGeometry(150, 48, 24), M.domeMaterial({ top: p.bgTop, bottom: p.bgBottom, blobs: p.blobs, noise: 0.01 }));
    this.dome.renderOrder = -10;
    this.stage.scene.add(this.dome);
    this.addLights({ hemiSky: '#E8F0FF', hemiGround: '#0A0C12', hemi: 0.4, key: 1.65, keyColor: '#FFFFFF', fill: 0.6, fillColor: this.mode === 'native' ? '#4F8DFF' : '#FF8A90', shadowRadius: 6 });
    const back = new THREE.DirectionalLight(p.wall.a, 1.4);   // the wall spills its color onto edges
    back.position.set(0, 4, -12);
    this.env.add(back);

    // glossy studio floor: shadows, a fine line grid and a soft reflection of the wall
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(220, 220), M.shadowFloor(p.shadow));
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = this.floorY;
    floor.receiveShadow = true;
    this.env.add(floor);
    const grid = new THREE.Mesh(new THREE.PlaneGeometry(90, 90), M.lineGridMaterial({ color: p.floorLine, spacing: 1.35, width: 1.1, fade: 34, opacity: 0.3 }));
    grid.rotation.x = -Math.PI / 2;
    grid.position.y = this.floorY + 0.002;
    this.env.add(grid);
    const sheen = new THREE.Mesh(new THREE.PlaneGeometry(60, 14), new THREE.ShaderMaterial({
      uniforms: { uCol: { value: new THREE.Color(p.wall.a) } },
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
      fragmentShader: 'uniform vec3 uCol; varying vec2 vUv; void main(){ float a = pow(clamp(vUv.y, 0.0, 1.0), 3.0) * (1.0 - pow(abs(vUv.x - 0.5) * 2.0, 2.0)); gl_FragColor = vec4(uCol * 0.35, a * 0.55); }',
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    }));
    sheen.rotation.x = -Math.PI / 2;
    sheen.position.set(0, this.floorY + 0.004, -5);
    this.env.add(sheen);

    // the LED wall, and a light strip where it meets the floor
    this.wallMat = ledWallMaterial(p.wall);
    const wall = new THREE.Mesh(new THREE.PlaneGeometry(96, 30), this.wallMat);
    wall.geometry.translate(0, 15, 0);
    wall.position.set(0, this.floorY, -12);
    this.env.add(wall);
    const strip = new THREE.Mesh(new THREE.BoxGeometry(96, 0.06, 0.06), M.glow(p.accent, 2.2));
    strip.position.set(0, this.floorY + 0.03, -11.9);
    this.env.add(strip);
  }

  /** Panels: dark, glossy, with a lit accent bar along the top edge, like on-air graphics. */
  panel(opts = {}) {
    const g = super.panel(opts);
    const { w, h } = g.userData;
    const depth = opts.depth ?? 0.1;
    if (w > 1 && h > 0.6) {
      const barMat = M.glow(this.palette.accent, 1.6);
      barMat.transparent = true;
      const bar = new THREE.Mesh(new THREE.BoxGeometry(w * 0.86, 0.045, depth * 0.6), barMat);
      bar.position.set(0, h / 2 + 0.03, 0);
      g.add(bar);
      const base = g.userData.setOpacity;
      g.userData.setOpacity = a => { base(a); barMat.opacity = a; };
    }
    return g;
  }

  /** Cards: dark bezel with a lit accent bar underneath. */
  card(opts = {}) {
    const g = super.card(opts);
    const { w, h } = g.userData;
    const barMat = M.glow(this.palette.accent, 1.6);
    barMat.transparent = true;
    const bar = new THREE.Mesh(new THREE.BoxGeometry(w * 0.9, 0.04, 0.05), barMat);
    bar.position.set(0, -h / 2 - 0.03, 0);
    g.add(bar);
    const base = g.userData.setOpacity;
    g.userData.setOpacity = a => { base(a); barMat.opacity = a; };
    return g;
  }

  /** Slim LED pillars frame each scene (wide of the text side on split layouts). */
  onTimeline(scenes, duration) {
    const p = this.palette;
    const r = rng((this.ctx.seed || 5) + 307);
    const portrait = this.stage.aspect < 0.95;
    const pillarGeo = slab(0.7, 6.4, 0.7, 0.05);
    const stripGeo = new THREE.BoxGeometry(0.08, 5.8, 0.04);
    const bodyMat = M.satin('#0C0E14', { roughness: 0.2, clearcoat: 1 });
    this.pillars = [];
    scenes.forEach((s, si) => {
      if (portrait) return;
      const a = s.anchor;
      const split = (s.inst.shot?.layout || 'center') === 'split';
      const xs = split ? [r.range(6.0, 6.6)] : [-r.range(7.2, 8.2), r.range(7.2, 8.2)];
      xs.forEach((x, k) => {
        const g = new THREE.Group();
        const body = new THREE.Mesh(pillarGeo, bodyMat);
        body.position.y = 3.2;
        body.castShadow = true;
        g.add(body);
        const sm = M.glow((si + k) % 3 === 2 ? p.accent2 : p.accent, 1.9);
        const strip = new THREE.Mesh(stripGeo, sm);
        strip.position.set(0, 3.2, 0.36);
        g.add(strip);
        g.position.set(a.x + x, this.floorY, a.z + (split ? -6 : r.range(-6, -4.5)));
        g.rotation.y = -Math.sign(x) * 0.4;
        this.root.add(g);
        this.pillars.push({ strip: sm, phase: r() * 10, base: sm.color.clone() });
      });
    });
    this.duration = duration;
    this.tickerItems = null;
  }

  update(t) {
    super.update(t);
    if (this.wallMat) this.wallMat.uniforms.uTime.value = t;
    for (const pl of this.pillars || []) pl.strip.color.copy(pl.base).multiplyScalar(0.75 + 0.25 * Math.sin(t * 2 + pl.phase));
    if (this.keyLight) {
      this.keyLight.target.position.set(0, 0, 0);
      this.keyLight.position.set(5, 12, 9);
    }
  }

  /** Bottom news ticker with a LIVE bug, built from the scenes' headlines. */
  drawOverlay(o, t, { scenes }) {
    const pr = this.ctx.project;
    if (pr.captions?.on || !scenes?.length) return;
    const p = this.palette;
    const U = o.U;
    const first = scenes[0], last = scenes[scenes.length - 1];
    const tIn = first.type === 'intro' ? first.end - 0.4 : 0.6;
    const tOut = last.type === 'endcard' ? last.start - 0.2 : this.duration + 1;
    const k = ease.outCubic(seg(t, tIn, 0.7));
    const alpha = clamp(k * (1 - seg(t, tOut, 0.5)));
    if (alpha <= 0.001) return;
    const c = o.ctx;
    const h = (o.portrait ? 52 : 44) * U;
    // wide: just inside the bottom margin; vertical: on the bottom edge, below anything scenes draw
    const y0 = o.portrait ? o.H - h - 30 * U : o.H - o.safe.bottom + 22 * U;
    const slide = (1 - k) * h * 1.4;
    const size = (o.portrait ? 25 : 21) * U;
    const ty = y0 + slide + h / 2 + size * 0.36;

    c.save();
    c.globalAlpha = alpha;
    // band
    c.fillStyle = rgba(p.tickerBg, 0.9);
    c.fillRect(0, y0 + slide, o.W, h);
    c.fillStyle = p.accent;
    c.fillRect(0, y0 + slide, o.W * k, 3 * U);
    c.restore();

    // LIVE bug
    const label = 'LIVE';
    const lx = o.safe.left * (o.portrait ? 0.5 : 0.6);
    const lw = o.measure(label, { size, weight: 800, family: 'mono', tracking: 0.12 }) + size * 2.4;
    c.save();
    c.globalAlpha = alpha;
    c.fillStyle = p.live;
    c.fillRect(lx, y0 + slide - 6 * U, lw, h + 12 * U);
    const pulse = 0.35 + 0.65 * (0.5 + 0.5 * Math.cos(t * Math.PI * 2 * 0.8));
    c.globalAlpha = alpha * pulse;
    c.fillStyle = p.liveText;
    c.beginPath();
    c.arc(lx + size * 0.85, y0 + slide + h / 2, size * 0.26, 0, Math.PI * 2);
    c.fill();
    c.restore();
    o.text(label, lx + size * 1.5, ty, { size, weight: 800, family: 'mono', color: p.liveText, tracking: 0.12, alpha });

    // scrolling headlines
    if (!this.tickerItems) {
      const seen = new Set();
      this.tickerItems = scenes.map(s => s.text?.headline).filter(Boolean).map(s => String(s).toUpperCase().trim())
        .filter(s => (seen.has(s) ? false : (seen.add(s), true)));
    }
    const items = this.tickerItems;
    if (!items.length) return;
    const x0 = lx + lw + 18 * U;
    const x1 = o.W;
    const gap = size * 1.6;
    const opts = { size, weight: 700, family: 'mono', tracking: 0.04 };
    const widths = items.map(s => o.measure(s, opts));
    const total = widths.reduce((a, w) => a + w + gap * 2, 0);
    const speed = 110 * U;
    let x = x0 - ((t * speed) % total);
    c.save();
    c.beginPath();
    c.rect(x0, y0 + slide, x1 - x0, h);
    c.clip();
    while (x < x1) {
      for (let i = 0; i < items.length && x < x1; i++) {
        if (x + widths[i] > x0) o.text(items[i], x, ty, { ...opts, color: '#FFFFFF', alpha });
        const cx = x + widths[i] + gap, cy = ty - size * 0.34, d = size * 0.26;
        c.save();
        c.globalAlpha = alpha;
        c.fillStyle = p.accent;
        c.beginPath(); c.moveTo(cx, cy - d); c.lineTo(cx + d, cy); c.lineTo(cx, cy + d); c.lineTo(cx - d, cy); c.closePath(); c.fill();
        c.restore();
        x += widths[i] + gap * 2;
      }
    }
    // soft fade where text enters behind the LIVE bug
    const fg = c.createLinearGradient(x0, 0, x0 + 40 * U, 0);
    fg.addColorStop(0, rgba(p.tickerBg, 0.95 * alpha));
    fg.addColorStop(1, rgba(p.tickerBg, 0));
    c.fillStyle = fg;
    c.fillRect(x0, y0 + slide, 40 * U, h);
    c.restore();
  }
}

export default {
  id: 'newsroom',
  name: 'Data Newsroom',
  family: 'Data',
  description: 'A broadcast studio: a glowing LED wall of live charts, bold panels and a scrolling news ticker.',
  bestFor: 'Market updates, monthly numbers, leaderboards, team results and recaps',
  swatch: ['#17181C', '#050506', '#DE3341', '#FFFFFF'],
  native: 'native',
  post: {
    bloom: { strength: 0.7, radius: 0.5, threshold: 1.2 },
    grain: 0.02, vignette: 0.34, ca: 0.0022, tone: 'neutral', exposure: 1.0, vignetteColor: '#000000', scanlines: 0.22, band: 0,
  },
  transition: { style: 'whip', duration: 0.75 },
  drift: 0.8,
  palette: mode => newsroomPalette(mode === 'native' ? 'native' : 'brand'),
  overlayTheme: p => ({
    text: p.text, sub: p.sub, accent: p.accent, accentText: '#FFFFFF', scrim: p.scrim, scrimAlpha: p.scrimAlpha,
    chipBg: p.accent, chipText: '#FFFFFF', panel: rgba(p.body, 0.9), panelStroke: 'rgba(255,255,255,0.16)', dark: true,
    displayFamily: null, displayWeight: null, displayStyle: null,
  }),
  create: ctx => new NewsroomWorld(ctx, ctx.project?.brand?.mode === 'native' ? 'native' : 'brand'),
};
