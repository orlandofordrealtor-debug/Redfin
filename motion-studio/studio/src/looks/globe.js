// Holographic Globe: a deep navy void with a star field, and one large rotating globe whose
// continents are ~30,000 glowing dots placed on a Fibonacci sphere wherever a land mask (drawn
// from Natural Earth land-110m) says "land". A scanning sweep reveals the dots, a fresnel ocean
// carries a 15-degree lat/long grid, an additive atmosphere glows around the limb, and router
// rings pulse at network hubs linked by flowing arcs. Cards and panels become dark holographic
// glass with glowing edges; the 2D layer gets corner brackets, a mono timecode rail and a glow
// behind every headline.
import * as THREE from 'three';
import { feature } from 'topojson-client';
import landTopo from 'world-atlas/land-110m.json';
import { BaseWorld } from '../engine/world.js';
import * as M from '../engine/materials.js';
import { BRAND } from '../engine/brand.js';
import { rng, clamp, ease, seg, noise1, lerp } from '../engine/util.js';

const NAVY = '#01040b';
const CYAN = '#3ee8ff';
const AMBER = '#ffb547';
const TAU = Math.PI * 2;
const DEG = Math.PI / 180;

/** r169 ignores envMapIntensity for materials lit by scene.environment; binding the texture makes it count. */
let ENV_TEX = null;
function env(m, intensity) { if (ENV_TEX) { m.envMap = ENV_TEX; m.envMapIntensity = intensity; } return m; }

// ---------------------------------------------------------------------------------------------
// Palettes

function globePalette(mode) {
  const base = {
    dark: true,
    bgTop: '#03101f', bgBottom: NAVY,
    text: '#FFFFFF', accentText: '#FFFFFF',
    shadow: 0, scrim: NAVY, scrimAlpha: 0.5, fade: NAVY, logo: 'taglineReversed',
  };
  if (mode === 'native') {
    return {
      ...base,
      blobs: [
        { dir: [-0.65, 0.45, -0.6], color: '#06223a', size: 0.55 },
        { dir: [0.75, 0.15, -0.65], color: '#081a35', size: 0.6 },
        { dir: [0.1, -0.55, -0.8], color: '#03253a', size: 0.5 },
      ],
      accentText: '#01040B',
      sub: 'rgba(206,240,255,0.80)', accent: AMBER, accent2: CYAN, accent3d: '#EC8E17',
      ink: '#E6F8FF', glassTint: '#0a2236', decor: [AMBER, CYAN, '#E6FBFF', CYAN],
      muted: '#103049', glow: '#38c2dc', line: 'rgba(127,231,255,0.28)', floorLine: CYAN,
      // look-specific keys
      holo: CYAN, hot: '#dcfdff', hub: AMBER, atmo: '#22b8ff', ocean: '#010509', grid: '#3fdcff',
      hud: '#86ecff', hudDim: 'rgba(134,236,255,0.38)', rec: AMBER, textGlow: '#17c8ff', chip: '#46EBFF', chipText: '#01121C',
      edge: CYAN, star: ['#ffffff', '#bff6ff', '#ffe2b0'], dotGain: 0.55,
    };
  }
  // Redfin brand: the same navy void, Redfin red accents with warm-white glow; cyan survives only
  // as a faint secondary in the atmosphere.
  return {
    ...base,
    blobs: [
      { dir: [-0.65, 0.45, -0.6], color: '#0b1a2e', size: 0.55 },
      { dir: [0.75, 0.15, -0.65], color: '#1a0d18', size: 0.55 },
      { dir: [0.1, -0.55, -0.8], color: '#071b2c', size: 0.5 },
    ],
    sub: 'rgba(255,240,234,0.80)', accent: BRAND.red, accent2: '#FFE6DA', accent3d: BRAND.red,
    ink: '#FFF4EE', glassTint: '#0c1828', decor: [BRAND.red, '#FFE6DA', '#FFFFFF', '#CFE0F2'],
    muted: '#1a2a3d', glow: BRAND.redGlow, line: 'rgba(255,230,220,0.26)', floorLine: '#FFE6DA',
    holo: '#eef3fb', hot: '#fff3ec', hub: BRAND.red, atmo: '#6f9fd0', ocean: '#010409', grid: '#a8c0dc',
    hud: '#FFEDE5', hudDim: 'rgba(255,237,229,0.34)', rec: BRAND.red, textGlow: '#ffb4a6', chip: BRAND.red, chipText: '#FFFFFF',
    edge: '#f2f5fb', star: ['#ffffff', '#e8f0ff', '#ffe4d8'], dotGain: 0.78,
  };
}

// ---------------------------------------------------------------------------------------------
// Land dots: a hidden equirectangular land mask, sampled by a Fibonacci sphere. Built once per page.

let LAND_CACHE = null;

function landDots(target = 104000) {
  if (LAND_CACHE) return LAND_CACHE;
  const W = 2048, H = 1024;
  const cv = document.createElement('canvas');
  cv.width = W; cv.height = H;
  const x = cv.getContext('2d', { willReadFrequently: true });
  x.fillStyle = '#000';
  x.fillRect(0, 0, W, H);
  x.fillStyle = '#fff';
  const fc = feature(landTopo, landTopo.objects.land);
  const geoms = fc.features ? fc.features.map(f => f.geometry) : [fc.geometry];
  const px = lon => ((lon + 180) / 360) * W;
  const py = lat => ((90 - lat) / 180) * H;
  // Unwrap each ring so antimeridian crossings stay continuous; rings that circle a pole
  // (Antarctica) are closed through the pole. Each ring is drawn at -360/0/+360 so wraps fill.
  const rings = [];
  for (const g of geoms) {
    const polys = g.type === 'Polygon' ? [g.coordinates] : g.type === 'MultiPolygon' ? g.coordinates : [];
    for (const poly of polys) {
      const out = [];
      for (const ring of poly) {
        let prev = ring[0][0], acc = 0;
        const pts = ring.map(([lon, lat]) => {
          let L = lon + acc;
          if (L - prev > 180) { acc -= 360; L -= 360; } else if (L - prev < -180) { acc += 360; L += 360; }
          prev = L;
          return [L, lat];
        });
        const span = pts[pts.length - 1][0] - pts[0][0];
        if (Math.abs(span) > 300) {
          const pole = pts.reduce((s, p) => s + p[1], 0) < 0 ? -90 : 90;
          pts.push([pts[pts.length - 1][0], pole], [pts[0][0], pole]);
        }
        out.push(pts);
      }
      rings.push(out);
    }
  }
  for (const off of [-W, 0, W]) {
    for (const poly of rings) {
      x.beginPath();
      for (const pts of poly) {
        pts.forEach(([L, lat], i) => (i ? x.lineTo(px(L) + off, py(lat)) : x.moveTo(px(L) + off, py(lat))));
        x.closePath();
      }
      x.fill('evenodd');
    }
  }
  const data = x.getImageData(0, 0, W, H).data;
  const pos = [];
  const rnd = [];
  const r = rng(2024);
  const ga = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < target; i++) {
    const y = 1 - (2 * (i + 0.5)) / target;
    const rr = Math.sqrt(1 - y * y);
    const th = ga * i;
    const X = Math.cos(th) * rr, Z = Math.sin(th) * rr;
    const lat = Math.asin(y) / DEG;
    const lon = Math.atan2(-Z, X) / DEG;
    const u = Math.min(W - 1, Math.floor(((lon + 180) / 360) * W));
    const v = Math.min(H - 1, Math.floor(((90 - lat) / 180) * H));
    if (data[(v * W + u) * 4] > 127) { pos.push(X, y, Z); rnd.push(r()); }
  }
  LAND_CACHE = { pos: new Float32Array(pos), rnd: new Float32Array(rnd), count: rnd.length };
  return LAND_CACHE;
}

/** Unit vector for a latitude/longitude (degrees), matching the land-dot convention. */
function ll(lat, lon, rad = 1) {
  const a = lat * DEG, b = lon * DEG;
  return new THREE.Vector3(Math.cos(a) * Math.cos(b) * rad, Math.sin(a) * rad, -Math.cos(a) * Math.sin(b) * rad);
}

// Network hubs (no labels are ever drawn; these just give the arcs believable anchors)
const HUBS = [
  [37.8, -122.4], [34.0, -118.2], [47.6, -122.3], [40.7, -74.0], [41.9, -87.6], [29.8, -95.4],
  [33.7, -84.4], [25.8, -80.2], [39.7, -105.0], [32.8, -96.8], [42.4, -71.1], [33.4, -112.1],
  [45.5, -122.7], [36.2, -86.8], [51.5, -0.1], [35.7, 139.7], [19.4, -99.1], [-23.5, -46.6],
  [43.7, -79.4], [30.3, -97.7],
];
const ARCS = [[0, 3], [1, 4], [2, 8], [9, 6], [7, 10], [5, 1], [4, 3], [3, 14], [1, 15], [8, 7], [11, 13], [12, 19], [16, 5], [18, 4], [17, 7]];

// ---------------------------------------------------------------------------------------------
// Shaders

function dotsMaterial(p) {
  return new THREE.ShaderMaterial({
    uniforms: {
      uColor: { value: new THREE.Color(p.holo) }, uHot: { value: new THREE.Color(p.hot) }, uAccent: { value: new THREE.Color(p.hub) },
      uSize: { value: 0.07 }, uScale: { value: 500 }, uTime: { value: 0 }, uFront: { value: 0 }, uStart: { value: 0 },
      uReveal: { value: 0 }, uIntensity: { value: 0.55 }, uOpacity: { value: 1 },
    },
    vertexShader: /* glsl */`
      attribute float aRand;
      uniform float uSize, uScale, uTime, uFront, uStart, uReveal;
      varying float vAlpha; varying float vBand; varying float vRand;
      const float TAU = 6.28318530718;
      void main() {
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vec3 n = normalize(normalMatrix * normalize(position));
        float facing = dot(n, normalize(-mv.xyz));
        // fade toward the limb and away on the far side
        float front = smoothstep(-0.05, 0.45, facing);
        float lon = atan(-position.z, position.x);
        float sinceStart = mod(lon - uStart, TAU);
        float revealed = smoothstep(0.0, 0.35, uReveal - sinceStart);
        float behind = mod(uFront - lon, TAU);
        float ahead = (TAU - behind) * 9.0;
        float band = exp(-behind * 2.4) + 0.65 * exp(-ahead * ahead);
        float tw = 0.82 + 0.18 * sin(uTime * (1.2 + aRand * 2.6) + aRand * 40.0);
        vAlpha = front * revealed * tw;
        vBand = band * revealed;
        vRand = aRand;
        float sz = uSize * (0.75 + 0.5 * aRand) * (1.0 + band * 0.55);
        gl_PointSize = max(1.2, sz * uScale / max(0.1, -mv.z));
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */`
      uniform vec3 uColor, uHot, uAccent; uniform float uIntensity, uOpacity;
      varying float vAlpha; varying float vBand; varying float vRand;
      void main() {
        vec2 c = gl_PointCoord - 0.5;
        float r = length(c) * 2.0;
        if (r > 1.0) discard;
        float disc = 1.0 - smoothstep(0.55, 1.0, r);
        float core = 1.0 - smoothstep(0.0, 0.45, r);
        vec3 col = mix(uColor, uHot, clamp(vBand, 0.0, 1.0));
        // a few warm "city light" dots
        col = mix(col, uAccent, step(0.965, vRand) * 0.85);
        float a = vAlpha * uOpacity;
        gl_FragColor = vec4(col * (disc * 0.75 + core * 0.55) * uIntensity * (1.0 + vBand * 1.6) * a, 1.0);
      }`,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  });
}

function oceanMaterial(p) {
  return new THREE.ShaderMaterial({
    uniforms: {
      uCore: { value: new THREE.Color(p.ocean) }, uRim: { value: new THREE.Color(p.atmo) }, uGrid: { value: new THREE.Color(p.grid) },
      uHot: { value: new THREE.Color(p.hot) }, uFront: { value: 0 }, uReveal: { value: 0 }, uStart: { value: 0 }, uOpacity: { value: 1 },
    },
    vertexShader: /* glsl */`
      varying vec3 vN; varying vec3 vV; varying vec3 vP;
      void main() {
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); vP = position;
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */`
      uniform vec3 uCore, uRim, uGrid, uHot; uniform float uFront, uReveal, uStart, uOpacity;
      varying vec3 vN; varying vec3 vV; varying vec3 vP;
      const float TAU = 6.28318530718;
      float gridLine(float v, float w) {
        float fw = max(fwidth(v), 1e-4);
        float d = abs(fract(v - 0.5) - 0.5) / fw;
        return 1.0 - min(d / w, 1.0);
      }
      void main() {
        vec3 p = normalize(vP);
        float ndv = clamp(dot(normalize(vN), normalize(vV)), 0.0, 1.0);
        float fres = pow(clamp(1.0 - ndv, 0.0, 1.0), 2.6);
        float lat = asin(clamp(p.y, -1.0, 1.0)) * 57.29578;
        float lon = atan(-p.z, p.x);
        // longitude lines from an angle that never wraps inside a cell, so fwidth stays smooth
        float lonDeg = lon * 57.29578;
        float lonA = gridLine(lonDeg / 15.0, 1.1);
        float lonB = gridLine((lonDeg + 360.0) / 15.0, 1.1);
        float lonLine = abs(lonDeg) > 170.0 ? lonB : lonA;
        float latLine = gridLine(lat / 15.0, 1.1) * (1.0 - smoothstep(75.0, 88.0, abs(lat)));
        float grid = max(lonLine * (1.0 - smoothstep(70.0, 89.0, abs(lat))), latLine);
        float revealed = smoothstep(0.0, 0.35, uReveal - mod(lon - uStart, TAU));
        float behind = mod(uFront - lon, TAU);
        float bx = min(behind, TAU - behind) * 160.0;
        float beam = exp(-bx * bx);
        float trail = exp(-behind * 2.6);
        vec3 col = uCore * (0.6 + 0.4 * ndv);
        float rim = pow(clamp(1.0 - ndv, 0.0, 1.0), 4.5);
        col += uGrid * grid * (0.035 + 0.14 * fres + 0.22 * trail) * revealed;
        col += uHot * beam * 0.12 * ndv * ndv * revealed;
        col += uRim * rim * 0.9;
        gl_FragColor = vec4(col * uOpacity, 1.0);
      }`,
  });
}

/** Back-facing additive shell: bright just outside the globe's limb, fading to nothing. */
function atmosphereMaterial(p, inner = 0.5) {
  return new THREE.ShaderMaterial({
    uniforms: { uColor: { value: new THREE.Color(p.atmo) }, uInner: { value: inner }, uIntensity: { value: 0.6 }, uOpacity: { value: 1 } },
    vertexShader: /* glsl */`
      varying vec3 vN; varying vec3 vV;
      void main() {
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */`
      uniform vec3 uColor; uniform float uInner, uIntensity, uOpacity;
      varying vec3 vN; varying vec3 vV;
      void main() {
        float d = clamp(-dot(normalize(vN), normalize(vV)), 0.0, 1.0);
        float k = clamp(d / max(uInner, 1e-3), 0.0, 1.0);
        float glow = pow(k, 3.0) * (1.0 - smoothstep(1.0, 1.5, d / max(uInner, 1e-3)) * 0.6);
        gl_FragColor = vec4(uColor * glow * uIntensity * uOpacity, 1.0);
      }`,
    side: THREE.BackSide, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  });
}

function pulseRingMaterial(color) {
  return new THREE.ShaderMaterial({
    uniforms: { uColor: { value: new THREE.Color(color) }, uTime: { value: 0 }, uOpacity: { value: 1 } },
    vertexShader: /* glsl */`
      attribute float aPhase;
      varying vec2 vUv; varying float vPhase;
      void main() {
        vUv = uv; vPhase = aPhase;
        vec4 p = vec4(position, 1.0);
        #ifdef USE_INSTANCING
          p = instanceMatrix * p;
        #endif
        gl_Position = projectionMatrix * modelViewMatrix * p;
      }`,
    fragmentShader: /* glsl */`
      uniform vec3 uColor; uniform float uTime, uOpacity;
      varying vec2 vUv; varying float vPhase;
      float ring(float r, float k) { float x = (r - k) * 16.0; return exp(-x * x) * pow(clamp(1.0 - k, 0.0, 1.0), 1.5); }
      void main() {
        float r = length(vUv - 0.5) * 2.0;
        if (r > 1.0) discard;
        float k1 = fract(uTime * 0.42 + vPhase);
        float k2 = fract(uTime * 0.42 + vPhase + 0.5);
        float rings = ring(r, k1) + ring(r, k2);
        float core = 1.0 - smoothstep(0.05, 0.16, r);
        float halo = (1.0 - smoothstep(0.0, 0.4, r)) * 0.35;
        gl_FragColor = vec4(uColor * (rings * 1.8 + core * 3.0 + halo) * uOpacity, 1.0);
      }`,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
  });
}

function starMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uScale: { value: 1 } },
    vertexShader: /* glsl */`
      attribute float aSize; attribute float aPhase; attribute vec3 aColor;
      uniform float uTime, uScale;
      varying vec3 vColor; varying float vA;
      void main() {
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        float tw = 0.65 + 0.35 * sin(uTime * (0.6 + aPhase * 1.7) + aPhase * 31.0);
        vColor = aColor; vA = tw;
        gl_PointSize = max(1.0, aSize * uScale);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */`
      varying vec3 vColor; varying float vA;
      void main() {
        float r = length(gl_PointCoord - 0.5) * 2.0;
        if (r > 1.0) discard;
        float a = (1.0 - smoothstep(0.0, 1.0, r));
        gl_FragColor = vec4(vColor * a * a * vA, 1.0);
      }`,
    transparent: true, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending,
  });
}

/** Glowing outline for cards and panels, with a highlight that travels around the edge. */
function edgeMaterial(color, hot) {
  return new THREE.ShaderMaterial({
    uniforms: { uColor: { value: new THREE.Color(color) }, uHot: { value: new THREE.Color(hot) }, uTime: { value: 0 }, uOpacity: { value: 1 }, uSeed: { value: 0 }, uAspect: { value: 1 } },
    vertexShader: /* glsl */`
      varying vec2 vP;
      void main() { vP = position.xy; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */`
      uniform vec3 uColor, uHot; uniform float uTime, uOpacity, uSeed, uAspect;
      varying vec2 vP;
      void main() {
        float a = atan(vP.y * uAspect, vP.x);
        float h = uTime * 0.9 + uSeed;
        float d = abs(mod(a - h + 3.14159, 6.28318) - 3.14159);
        float d2 = abs(mod(a - h + 3.14159 + 3.14159, 6.28318) - 3.14159);
        float hl = exp(-d * d * 7.0) + 0.6 * exp(-d2 * d2 * 7.0);
        float corner = smoothstep(0.55, 0.95, abs(sin(a * 2.0)));
        vec3 col = uColor * (0.42 + 0.3 * corner) + uHot * hl * 0.75;
        gl_FragColor = vec4(col * uOpacity, 1.0);
      }`,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  });
}

function roundedRectPath(path, w, h, r) {
  const x = -w / 2, y = -h / 2;
  const rr = Math.min(r, w / 2, h / 2);
  path.moveTo(x + rr, y);
  path.lineTo(x + w - rr, y);
  path.quadraticCurveTo(x + w, y, x + w, y + rr);
  path.lineTo(x + w, y + h - rr);
  path.quadraticCurveTo(x + w, y + h, x + w - rr, y + h);
  path.lineTo(x + rr, y + h);
  path.quadraticCurveTo(x, y + h, x, y + h - rr);
  path.lineTo(x, y + rr);
  path.quadraticCurveTo(x, y, x + rr, y);
  return path;
}

function outlineGeometry(w, h, r, lw) {
  const s = roundedRectPath(new THREE.Shape(), w, h, r);
  s.holes.push(roundedRectPath(new THREE.Path(), w - lw * 2, h - lw * 2, Math.max(0.001, r - lw)));
  return new THREE.ShapeGeometry(s, 10);
}

// ---------------------------------------------------------------------------------------------

class GlobeWorld extends BaseWorld {
  constructor(ctx) {
    super(ctx);
    this.style = 'holo';
    this.edges = [];
    this.R = 6.6;
  }

  holoGlass(opacity) {
    const p = this.palette;
    const m = new THREE.MeshPhysicalMaterial({
      color: p.glassTint, roughness: 0.16, metalness: 0.2, clearcoat: 1, clearcoatRoughness: 0.06,
      transparent: true, opacity, emissive: p.glassTint, emissiveIntensity: 0.35,
    });
    env(m, 0.5);
    M.enhance(m, { rim: 0.9, rimColor: p.edge, rimPower: 2.4, edgeColor: p.hot });
    m.userData.alwaysTransparent = true;
    return m;
  }

  materials() {
    const p = this.palette;
    ENV_TEX = this.stage.envTexture;
    return {
      frame: () => this.holoGlass(0.88),
      panel: () => this.holoGlass(0.74),
      accent: () => env(M.satin(p.accent3d, { emissive: p.accent, emissiveIntensity: 0.14, roughness: 0.24, clearcoat: 1, rim: 0.35, rimColor: p.hot, rimPower: 3, edgeColor: p.hot }), 0.28),
      glyph: () => env(M.satin(p.accent3d, { emissive: p.accent, emissiveIntensity: 0.16, roughness: 0.24, clearcoat: 1, rim: 0.4, rimColor: p.hot, rimPower: 3, edgeColor: '#ffffff' }), 0.28),
      decor: i => {
        const k = i % 4;
        if (k === 1) return M.fresnel({ color: p.holo, power: 2.0, intensity: 1.6, inner: 0.06 });
        if (k === 3) return M.fresnel({ color: p.accent, power: 1.8, intensity: 1.8, inner: 0.1 });
        if (k === 2) return M.fresnel({ color: p.hot, power: 2.4, intensity: 1.2, inner: 0.04 });
        return env(M.satin(p.accent3d, { emissive: p.accent, emissiveIntensity: 0.55, roughness: 0.3, rim: 0.6, rimColor: p.hot }), 0.3);
      },
      ink: () => env(M.satin(p.ink, { roughness: 0.3, clearcoat: 0.8, emissive: p.ink, emissiveIntensity: 0.12 }), 0.5),
      muted: () => env(M.satin(p.muted, { roughness: 0.22, clearcoat: 1, rim: 0.35, rimColor: p.holo, rimPower: 2.6, emissive: p.holo, emissiveIntensity: 0.03 }), 0.35),
      glow: () => M.glow(p.glow, 2.6),
      line: () => M.flowMaterial({ color: p.hub, head: '#ffffff' }),
    };
  }

  environment() {
    const p = this.palette;
    this.dome = new THREE.Mesh(new THREE.SphereGeometry(150, 48, 24), M.domeMaterial({ top: p.bgTop, bottom: p.bgBottom, blobs: p.blobs, noise: 0.006 }));
    this.dome.renderOrder = -10;
    this.stage.scene.add(this.dome);
    this.buildStars();

    // Cool key, holographic rim from behind, warm accent fill. No shadow casters: there is no floor.
    const hemi = new THREE.HemisphereLight(p.holo, '#020611', 0.32);
    const key = new THREE.DirectionalLight('#ffffff', 0.95);
    key.position.set(5, 8, 10);
    const rim = new THREE.DirectionalLight(p.holo, 1.1);
    rim.position.set(-7, 4, -8);
    const fill = new THREE.DirectionalLight(p.accent, 0.3);
    fill.position.set(6, -4, 4);
    this.env.add(hemi, key, rim, fill);
    this.lights = { hemi, key, rim, fill };

    this.buildGlobe();
  }

  buildStars() {
    const p = this.palette;
    const r = rng(77);
    const n = 2600;
    const pos = new Float32Array(n * 3), size = new Float32Array(n), phase = new Float32Array(n), col = new Float32Array(n * 3);
    const cols = p.star.map(c => new THREE.Color(c));
    const c = new THREE.Color();
    for (let i = 0; i < n; i++) {
      const u = r() * 2 - 1, a = r() * TAU, s = Math.sqrt(1 - u * u);
      pos.set([Math.cos(a) * s * 110, u * 110, Math.sin(a) * s * 110], i * 3);
      const big = r();
      size[i] = big > 0.985 ? r.range(3.2, 4.6) : big > 0.9 ? r.range(2.0, 3.0) : r.range(1.0, 1.9);
      phase[i] = r();
      c.copy(cols[i % 7 === 0 ? 2 : i % 3 === 0 ? 1 : 0]).multiplyScalar(big > 0.985 ? 1.6 : r.range(0.35, 0.95));
      col.set([c.r, c.g, c.b], i * 3);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('aSize', new THREE.BufferAttribute(size, 1));
    g.setAttribute('aPhase', new THREE.BufferAttribute(phase, 1));
    g.setAttribute('aColor', new THREE.BufferAttribute(col, 3));
    this.starMat = starMaterial();
    const stars = new THREE.Points(g, this.starMat);
    stars.frustumCulled = false;
    stars.renderOrder = -9;
    this.dome.add(stars);
    this.stars = stars;
  }

  buildGlobe() {
    const p = this.palette;
    const R = this.R;
    // globeRoot follows the focus point (it lives in env); tilt and spin are nested inside
    this.globeRoot = new THREE.Group();
    this.globeTilt = new THREE.Group();
    this.globeSpin = new THREE.Group();
    this.globeRoot.add(this.globeTilt);
    this.globeTilt.add(this.globeSpin);
    this.env.add(this.globeRoot);

    const land = landDots();
    const g = new THREE.BufferGeometry();
    const pos = new Float32Array(land.pos.length);
    for (let i = 0; i < pos.length; i++) pos[i] = land.pos[i] * R * 1.004;
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('aRand', new THREE.BufferAttribute(land.rnd, 1));
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), R * 1.01);
    this.dotMat = dotsMaterial(p);
    this.dotMat.uniforms.uSize.value = R * 0.0068;
    this.dotMat.uniforms.uIntensity.value = p.dotGain;
    const dots = new THREE.Points(g, this.dotMat);
    dots.renderOrder = 2;
    this.globeSpin.add(dots);
    this.dotCount = land.count;

    this.oceanMat = oceanMaterial(p);
    const ocean = new THREE.Mesh(new THREE.SphereGeometry(R * 0.995, 112, 72), this.oceanMat);
    ocean.renderOrder = 1;
    this.globeSpin.add(ocean);

    const shell = 1.13;
    this.atmoMat = atmosphereMaterial(p, Math.sqrt(1 - 1 / (shell * shell)));
    const atmo = new THREE.Mesh(new THREE.SphereGeometry(R * shell, 96, 64), this.atmoMat);
    atmo.renderOrder = 3;
    this.globeTilt.add(atmo);

    // Router rings: one instanced quad per hub, pulsing in the shader
    const hubN = HUBS.map(([la, lo]) => ll(la, lo));
    const ringGeo = new THREE.PlaneGeometry(1, 1);
    const phases = new Float32Array(HUBS.length);
    const rr = rng(9);
    for (let i = 0; i < HUBS.length; i++) phases[i] = rr();
    ringGeo.setAttribute('aPhase', new THREE.InstancedBufferAttribute(phases, 1));
    this.ringMat = pulseRingMaterial(p.hub);
    const rings = new THREE.InstancedMesh(ringGeo, this.ringMat, HUBS.length);
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3();
    hubN.forEach((n, i) => {
      q.setFromUnitVectors(new THREE.Vector3(0, 0, 1), n);
      const s = R * (i < 14 ? 0.095 : 0.075);
      m4.compose(n.clone().multiplyScalar(R * 1.006), q, sc.set(s, s, s));
      rings.setMatrixAt(i, m4);
    });
    rings.instanceMatrix.needsUpdate = true;
    rings.renderOrder = 4;
    rings.frustumCulled = false;
    this.globeSpin.add(rings);

    // Arcs between hubs: raised great circles drawn with the shared flow material
    this.arcs = ARCS.map(([a, b], i) => {
      const A = hubN[a], B = hubN[b];
      const ang = A.angleTo(B);
      const lift = Math.min(0.16, 0.025 + ang * 0.1);
      const pts = [];
      for (let k = 0; k <= 48; k++) {
        const s = k / 48;
        const v = new THREE.Vector3().copy(A).lerp(B, s).normalize();
        // slerp-ish: renormalized lerp is fine for these spans, then lift off the surface
        pts.push(v.multiplyScalar(R * (1.006 + Math.sin(Math.PI * s) * lift)));
      }
      const curve = new THREE.CatmullRomCurve3(pts);
      const mat = M.flowMaterial({ color: p.hub, head: p.hot, dash: 10 + ang * 8, speed: 0.9, intensity: 1.6 });
      mat.blending = THREE.AdditiveBlending;
      const mesh = new THREE.Mesh(new THREE.TubeGeometry(curve, 56, R * 0.0024, 5, false), mat);
      mesh.renderOrder = 4;
      this.globeSpin.add(mesh);
      return { mesh, mat, t0: 1.2 + i * 0.32, dur: 1.1 + ang * 0.9 };
    });
  }

  /** Where the globe sits for a given scene layout, relative to the focus point. */
  globePose(layout, portrait) {
    if (portrait) return { x: 0, y: -this.R - 4.2, z: -12, s: 1.08 };
    if (layout === 'split') return { x: 4.6, y: -this.R - 2.7, z: -13, s: 1 };
    if (layout === 'center' || layout === 'low') return { x: 0, y: -this.R - 3.0, z: -14, s: 1.12 };
    return { x: 2.6, y: -this.R - 3.4, z: -14, s: 1.06 };
  }

  /** Ambient holographic props: small glowing orbs and rings, always behind or wide of content. */
  onTimeline(scenes, duration) {
    const r = rng(this.ctx.seed || 5);
    const p = this.palette;
    this.scenes = scenes;
    this.duration = duration;
    this.decor = [];
    const portrait = this.stage.aspect < 0.95;
    scenes.forEach((s, si) => {
      if (s.inst.noDecor) return;
      const n = portrait ? 2 : Math.min(4, s.inst.decorCount ?? 3);
      for (let i = 0; i < n; i++) {
        const split = !portrait && s.inst.shot?.layout === 'split';
        const side = split ? 1 : (i + si) % 2 ? 1 : -1;
        let mesh;
        if (i % 2 === 1) {
          mesh = this.ring(r.range(0.4, 0.7), 0.01, M.glow(i % 4 === 1 ? p.holo : p.accent, 2.0));
          mesh.rotation.set(r.range(-1.1, 1.1), r.range(-1.1, 1.1), 0);
        } else {
          mesh = this.orb(r.range(0.1, 0.22) * (i === 0 ? 1.4 : 1), i + si);
        }
        const wide = portrait ? r.range(4.6, 6.4) : r.range(7.5, 11);
        // vertical frames keep text up top, so props stay at mid-height in the side margins
        const y = portrait ? r.range(-1.6, 1.2) : r.range(0.4, 3.4);
        const base = new THREE.Vector3(side * wide, y, portrait ? r.range(-17, -11) : r.range(-13, -7)).add(s.anchor);
        mesh.position.copy(base);
        this.root.add(mesh);
        this.decor.push({ mesh, base, phase: r() * 10, amp: r.range(0.12, 0.3), spin: r.range(-0.6, 0.6) });
      }
    });
    this.poses = scenes.map(s => this.globePose(s.inst.shot?.layout, portrait));
  }

  // ---- factories: holographic glass with glowing edges ----

  attachEdge(g, w, h, depth, radius, base) {
    const p = this.palette;
    const lw = Math.max(0.012, Math.min(w, h) * 0.006);
    const mat = edgeMaterial(p.edge, p.hot);
    mat.uniforms.uSeed.value = this.rand() * TAU;
    mat.uniforms.uAspect.value = w / Math.max(0.01, h);
    const edge = new THREE.Mesh(outlineGeometry(w, h, radius, lw), mat);
    edge.position.z = depth / 2 + 0.012;
    edge.renderOrder = 5;
    g.add(edge);
    this.edges.push(mat);
    const body = g.userData.bodyMat || g.userData.frameMat;
    const setOpacity = g.userData.setOpacity;
    g.userData.setOpacity = a => {
      setOpacity(a);
      if (body) { body.opacity = a * base; body.transparent = true; }
      mat.uniforms.uOpacity.value = a;
    };
    if (g.userData.setDissolve) {
      const setDissolve = g.userData.setDissolve;
      g.userData.setDissolve = d => { setDissolve(d); mat.uniforms.uOpacity.value = 1 - clamp(d * 1.4); };
    }
    return g;
  }

  card(opts = {}) {
    const g = super.card(opts);
    const { w = 3, h = 2, depth = 0.12, radius = 0.14 } = opts;
    g.userData.faceMat.color.setScalar(0.9);
    return this.attachEdge(g, w, h, depth, radius, 0.88);
  }

  panel(opts = {}) {
    const g = super.panel(opts);
    const { w = 4, h = 2.4, depth = 0.1, radius = 0.16 } = opts;
    return this.attachEdge(g, w, h, depth, radius, 0.74);
  }

  dispose() {
    // the star field rides on the dome (it follows the camera), outside root
    if (this.stars) { this.stars.geometry.dispose(); this.stars.material.dispose(); }
    super.dispose();
  }

  // ---- motion ----

  update(t) {
    super.update(t);
    const cam = this.stage.camera;
    const portrait = this.stage.aspect < 0.95;
    const pxScale = this.stage.ph / (2 * Math.tan((cam.fov * DEG) / 2));

    // Globe pose follows the active scene's layout, easing across transitions
    if (this.poses?.length) {
      const sc = this.scenes;
      let i = sc.findIndex(s => t < s.end);
      if (i < 0) i = sc.length - 1;
      let pose = this.poses[i];
      const T = 1.1;
      const s = sc[i];
      if (i < sc.length - 1 && t > s.end - T / 2) pose = blendPose(pose, this.poses[i + 1], ease.inOutCubic(clamp((t - (s.end - T / 2)) / T)));
      else if (i > 0 && t < s.start + T / 2) pose = blendPose(this.poses[i - 1], pose, ease.inOutCubic(clamp((t - (s.start - T / 2)) / T)));
      this.globeRoot.position.set(pose.x, pose.y, pose.z);
      this.globeRoot.scale.setScalar(pose.s);
    } else {
      const pose = this.globePose('stack', portrait);
      this.globeRoot.position.set(pose.x, pose.y, pose.z);
    }
    // Tilt the north pole slightly away so North America rides the visible upper limb
    this.globeTilt.rotation.set(-0.42, 0, 0.12);
    // Start with the Americas facing camera, then roll east across the Atlantic toward Europe and
    // Africa so the visible limb stays mostly land for the length of a typical video
    this.globeSpin.rotation.y = (-90 + 98) * DEG - t * 0.042;

    // Sweep: reveal across longitude, then keep scanning
    const start = -178 * DEG; // just past the western limb, so the reveal crosses the visible face left to right
    const reveal = TAU * 1.05 * ease.inOutCubic(seg(t, 0.15, 2.8));
    const front = start + reveal + Math.max(0, t - 2.95) * 0.85;
    for (const m of [this.dotMat, this.oceanMat]) {
      m.uniforms.uStart.value = start;
      m.uniforms.uReveal.value = t > 2.95 ? 99 : reveal;
      m.uniforms.uFront.value = front;
    }
    this.dotMat.uniforms.uTime.value = t;
    this.dotMat.uniforms.uScale.value = pxScale;
    this.ringMat.uniforms.uTime.value = t;
    this.ringMat.uniforms.uOpacity.value = clamp(seg(t, 1.0, 1.0));
    for (const a of this.arcs) {
      const k = ease.inOutCubic(seg(t, a.t0, a.dur));
      a.mat.uniforms.uProgress.value = k;
      a.mat.uniforms.uTime.value = t;
      a.mesh.visible = k > 0.001;
    }
    this.starMat.uniforms.uTime.value = t;
    this.starMat.uniforms.uScale.value = this.stage.ph / 1080;
    for (const e of this.edges) e.uniforms.uTime.value = t;
    for (const d of this.decor || []) {
      d.mesh.position.y = d.base.y + Math.sin(t * 0.7 + d.phase) * d.amp;
      d.mesh.position.x = d.base.x + noise1(t * 0.25 + d.phase, 3) * 0.2;
      d.mesh.rotation.z = t * d.spin;
    }
  }

  // ---- 2D HUD ----

  drawOverlay(o, t, { scenes, duration, current }) {
    const p = this.palette;
    this.glowLayer(o, p.textGlow, 14, 0.7);
    const c = o.ctx, U = o.U, s = o.safe;
    const a = clamp(seg(t, 0.35, 0.8)) * (1 - seg(t, duration - 0.6, 0.5));
    if (a <= 0.001) return;
    c.save();
    c.globalAlpha = a;
    c.strokeStyle = p.hud;
    c.lineWidth = 2 * U;
    c.lineCap = 'square';
    const L = (o.portrait ? 46 : 40) * U;
    const x0 = s.left, x1 = o.W - s.right, y0 = s.top, y1 = o.H - s.bottom;
    const corners = [[x1, y0, -1, 1], [x0, y1, 1, -1], [x1, y1, -1, -1]];
    // wide formats carry the logo in the top-left corner, so that bracket is left out
    if (o.portrait) corners.push([x0, y0, 1, 1]);
    const k = ease.outCubic(seg(t, 0.35, 0.9));
    for (const [cx, cy, sx, sy] of corners) {
      c.beginPath();
      c.moveTo(cx + sx * L * k, cy);
      c.lineTo(cx, cy);
      c.lineTo(cx, cy + sy * L * k);
      c.stroke();
      // small inner tick
      c.globalAlpha = a * 0.6;
      c.fillStyle = p.hud;
      c.fillRect(cx + sx * 8 * U - (sx < 0 ? 4 * U : 0), cy + sy * 8 * U - (sy < 0 ? 4 * U : 0), 4 * U, 4 * U);
      c.globalAlpha = a;
    }
    c.restore();

    // Timecode rail: along the bottom of the safe area on wide formats (the logo owns the top-left);
    // on vertical formats 3D content reaches the bottom, so the rail runs just under the top-center logo.
    const railA = a * this.railVisibility(t, scenes, o.portrait);
    if (railA <= 0.001) return;
    const f = Math.floor(t * 60 + 1e-4);
    const ff = f % 60, ss = Math.floor(f / 60) % 60, mm = Math.floor(f / 3600) % 60, hh = Math.floor(f / 216000);
    const tc = `TC ${pad2(hh)}:${pad2(mm)}:${pad2(ss)}:${pad2(ff)}`;
    const size = (o.portrait ? 21 : 17) * U;
    let y = y1 - 14 * U;
    if (o.portrait) {
      // sit below the top-center logo, measured the way the engine draws it
      const img = this.ctx.logos?.taglineReversed;
      const lw = 250 * U;
      const lh = img?.naturalWidth ? lw * (img.naturalHeight / img.naturalWidth) : lw * 0.31;
      const logoBottom = s.top * 0.55 - 10 * U + lh;
      y = Math.max(y0 + 36 * U, logoBottom + 34 * U);
    }
    const tx = x0 + 22 * U;
    c.save();
    c.globalAlpha = railA;
    // blinking record dot
    const blink = 0.35 + 0.65 * (Math.sin(t * 5.2) > -0.2 ? 1 : 0.15);
    c.fillStyle = p.rec;
    c.globalAlpha = railA * blink;
    c.beginPath(); c.arc(tx + 5 * U, y - size * 0.34, 5 * U, 0, TAU); c.fill();
    c.globalAlpha = railA;
    const halo = { shadow: 'rgba(1,4,11,0.95)', shadowBlur: 10 * U, shadowY: 0 };
    o.text(tc, tx + 20 * U, y, { size, family: 'mono', weight: 700, color: p.hud, tracking: 0.12, alpha: railA, ...halo });
    const tcW = o.measure(tc, { size, family: 'mono', weight: 700, tracking: 0.12 });
    const idx = scenes.indexOf(current) + 1;
    const right = o.portrait ? `${pad2(idx)}/${pad2(scenes.length)}` : `SCN ${pad2(idx)}/${pad2(scenes.length)}  ·  ${String(this.dotCount).replace(/\B(?=(\d{3})+(?!\d))/g, ',')} NODES`;
    const rw = o.measure(right, { size, family: 'mono', weight: 500, tracking: 0.12 });
    o.text(right, x1 - 22 * U, y, { size, family: 'mono', weight: 500, color: p.hudDim, tracking: 0.12, align: 'right', alpha: railA, ...halo });
    // the rail itself: a hairline with ticks and a playhead
    const lx0 = tx + 20 * U + tcW + 24 * U, lx1 = x1 - 22 * U - rw - 24 * U;
    if (lx1 - lx0 > 60 * U) {
      const ly = y - size * 0.34;
      c.strokeStyle = p.hudDim;
      c.lineWidth = 1.2 * U;
      c.beginPath(); c.moveTo(lx0, ly); c.lineTo(lx1, ly); c.stroke();
      const n = Math.floor((lx1 - lx0) / (18 * U));
      c.fillStyle = p.hudDim;
      for (let i = 0; i <= n; i++) {
        const xx = lx0 + ((lx1 - lx0) * i) / n;
        const tall = i % 5 === 0;
        c.fillRect(xx - 0.6 * U, ly - (tall ? 7 : 3.5) * U, 1.2 * U, (tall ? 14 : 7) * U);
      }
      const ph = lx0 + (lx1 - lx0) * clamp(t / Math.max(0.01, duration));
      c.fillStyle = p.hud;
      c.fillRect(ph - 1.2 * U, ly - 10 * U, 2.4 * U, 20 * U);
    }
    c.restore();
  }

  railVisibility(t, scenes, portrait) {
    const vis = s => (s.type === 'endcard' || (!portrait && s.inst.shot?.layout === 'stackBottom') ? 0 : 1);
    let i = scenes.findIndex(s => t < s.end);
    if (i < 0) i = scenes.length - 1;
    const s = scenes[i];
    let v = vis(s);
    if (i > 0 && t < s.start + 0.35) v = lerp(vis(scenes[i - 1]), v, clamp((t - s.start + 0.35) / 0.7));
    if (i < scenes.length - 1 && t > s.end - 0.35) v = lerp(v, vis(scenes[i + 1]), clamp((t - s.end + 0.35) / 0.7));
    return v;
  }

  /** Draws a tinted, blurred copy of everything scenes drew so far *behind* it: headline glow. */
  glowLayer(o, color, blur, alpha) {
    const src = this.stage.overlay;
    const W = src.width, H = src.height;
    if (!this.glowCanvas) {
      this.glowCanvas = document.createElement('canvas');
      this.glowCtx = this.glowCanvas.getContext('2d');
    }
    if (this.glowCanvas.width !== W || this.glowCanvas.height !== H) { this.glowCanvas.width = W; this.glowCanvas.height = H; }
    const g = this.glowCtx;
    g.save();
    g.globalCompositeOperation = 'copy';
    g.drawImage(src, 0, 0);
    // alpha -> alpha^8 so soft scrims and washes do not glow, only solid type and chips
    g.globalCompositeOperation = 'destination-in';
    for (let i = 0; i < 3; i++) g.drawImage(this.glowCanvas, 0, 0);
    g.globalCompositeOperation = 'source-in';
    g.fillStyle = color;
    g.fillRect(0, 0, W, H);
    g.restore();
    const c = o.ctx;
    const px = blur * o.U * (W / o.W);
    c.save();
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.globalCompositeOperation = 'destination-over';
    c.globalAlpha = alpha;
    c.filter = `blur(${px.toFixed(2)}px)`;
    c.drawImage(this.glowCanvas, 0, 0);
    c.globalAlpha = alpha * 0.6;
    c.filter = `blur(${(px * 0.35).toFixed(2)}px)`;
    c.drawImage(this.glowCanvas, 0, 0);
    c.restore();
  }
}

function blendPose(a, b, k) {
  return { x: lerp(a.x, b.x, k), y: lerp(a.y, b.y, k), z: lerp(a.z, b.z, k), s: lerp(a.s, b.s, k) };
}

const pad2 = n => String(n).padStart(2, '0');

export default {
  id: 'globe',
  name: 'Holographic Globe',
  family: 'Holographic',
  description: 'A glowing dot-matrix globe in a navy star field, with scanning sweeps, pulsing network rings, holographic glass and a sci-fi HUD.',
  bestFor: 'Market updates, expansion news, national reach, tech and data stories',
  swatch: [NAVY, '#0a2236', AMBER, CYAN],
  native: 'native',
  post: {
    bloom: { strength: 0.65, radius: 0.36, threshold: 1.02 },
    grain: 0.04, vignette: 0.5, ca: 0.0032, tone: 'aces', exposure: 0.98, vignetteColor: '#000208',
    scanlines: 0.55, band: 1,
  },
  transition: { style: 'glide', duration: 1.0 },
  drift: 0.9,
  palette: mode => globePalette(mode === 'native' ? 'native' : 'brand'),
  overlayTheme: p => ({
    text: p.text, sub: p.sub, accent: p.chip, accentText: p.chipText, scrim: p.scrim, scrimAlpha: p.scrimAlpha,
    chipBg: p.chip, chipText: p.chipText, panel: 'rgba(4,14,28,0.82)', panelStroke: 'rgba(160,230,255,0.28)', mono: p.hud, dark: true,
  }),
  create: ctx => new GlobeWorld(ctx),
};
