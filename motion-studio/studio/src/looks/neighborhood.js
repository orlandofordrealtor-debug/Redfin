// Neighborhood Map: a stylized architectural-model city seen from an aerial three-quarter angle.
// A procedural street grid of low off-white blocks, parks with model trees, and a coastline sit on
// a map plane tilted toward the camera, below and behind the scene content, so cards and panels
// float above the map like a UI layer. Each scene gets glowing map pins and route lines (tubes
// along street-following curves with the flow material) with small home callouts.
// The geography is invented: no real streets, places or distances are implied.
import * as THREE from 'three';
import { BaseWorld } from '../engine/world.js';
import * as M from '../engine/materials.js';
import { BRAND, FONTS } from '../engine/brand.js';
import { rng, clamp, ease, seg, lerp, rgba } from '../engine/util.js';

const DEG = Math.PI / 180;
const _v = new THREE.Vector3();
const TILT = 24 * DEG;            // map plane tilt toward the camera (aerial 3/4 feel)
const GRID_ROT = 28 * DEG;        // street grid rotation inside the map
const BA = 3.4, BB = 1.9;         // block pitch along the two grid axes
const STREET = 0.42, AVENUE = 0.82;
const V_NEAR = 14, V_FAR = -48;   // map extent toward / away from the camera (map units)
const HAZE = [-11, -34];          // map depth where haze starts / is complete
const CHUNK = 40;

/** Coastline: map v of the shore at map u. Mirrored exactly in the ground shader. */
function coast(u) {
  return -19 + 5 * Math.sin(u * 0.021 + 1.3) + 3 * Math.sin(u * 0.057 + 0.4) + 1.5 * Math.sin(u * 0.13);
}
const COAST_GLSL = /* glsl */`
  float coastV(float u) { return -19.0 + 5.0 * sin(u * 0.021 + 1.3) + 3.0 * sin(u * 0.057 + 0.4) + 1.5 * sin(u * 0.13); }
`;

const COS = Math.cos(GRID_ROT), SIN = Math.sin(GRID_ROT);
const toGrid = (u, v) => [u * COS + v * SIN, -u * SIN + v * COS];
const toMap = (a, b) => [a * COS - b * SIN, a * SIN + b * COS];
const isAvenueA = k => ((k % 5) + 5) % 5 === 0;
const isAvenueB = k => ((k % 4) + 4) % 4 === 0;

// ---------------------------------------------------------------------------------------------
// Palettes

function mapPalette(mode) {
  if (mode === 'native') {
    return {
      dark: false,
      bgTop: '#F3F1EC', bgBottom: '#E9E5DD', blobs: [],
      text: '#14202C', sub: '#47525F', accent: '#0B8A80', accent2: '#F0A23B', accentText: '#FFFFFF',
      ink: '#14202C', glassTint: '#ffffff', decor: ['#0B8A80', '#FFFFFF', '#9CB98A', '#8FB8D6'],
      muted: '#D9D1C4', glow: '#14B3A6', line: 'rgba(20,32,44,0.14)', floorLine: '#B9AFA6', shadow: 0.2,
      scrim: '#FFFFFF', scrimAlpha: 0.55, fade: '#F3F1EC', logo: 'tagline',
      // map colors
      haze: '#ECE9E2', lot: '#DED4C3', street: '#FDFCFA', avenue: '#FFFFFF', lane: '#E6DCCB', curb: '#F1EBE0',
      park: '#BBD2A2', parkPath: '#E3E6D2', plaza: '#E4DED3', water: '#A8CDE4', waterDeep: '#93BEDB', sand: '#EEE3C9', foam: '#F4F8FA',
      building: ['#FBF8F2', '#F6F1E8', '#FDFBF7', '#F2ECE1', '#F8F3EA'], tree: ['#8DAE74', '#9BBB82', '#7FA268'],
      pin: '#0B8A80', pinDeep: '#08706A', route: '#0FA396', chip: '#0B8A80', label: '#14202C',
    };
  }
  return {
    dark: false,
    bgTop: '#F5F3F0', bgBottom: '#ECE8E2', blobs: [],
    text: BRAND.ink, sub: '#4A4E57', accent: BRAND.red, accent2: '#E8A33D', accentText: '#FFFFFF',
    ink: BRAND.ink, glassTint: '#ffffff', decor: [BRAND.red, '#FFFFFF', '#B9C4AE', '#1C1D21'],
    muted: '#DAD3CA', glow: BRAND.redGlow, line: 'rgba(17,17,17,0.14)', floorLine: '#B9AFA6', shadow: 0.2,
    scrim: '#FFFFFF', scrimAlpha: 0.55, fade: '#F5F3F0', logo: 'tagline',
    haze: '#EFECE7', lot: '#DDD4C7', street: '#FDFCFB', avenue: '#FFFFFF', lane: '#E4DCD2', curb: '#F1ECE6',
    park: '#C2CFB3', parkPath: '#E5E6DB', plaza: '#E3DED7', water: '#B7CFDF', waterDeep: '#A6C3D7', sand: '#ECE4D4', foam: '#F6F8F9',
    building: ['#FBFAF7', '#F6F3EE', '#FDFCFA', '#F1EDE7', '#F8F5F0'], tree: ['#98AB85', '#A6B793', '#8A9E77'],
    pin: BRAND.red, pinDeep: BRAND.redDeep, route: BRAND.red, chip: BRAND.red, label: BRAND.ink,
  };
}

// ---------------------------------------------------------------------------------------------
// Shader helpers

const lin = c => new THREE.Color(c);

/** r169 ignores envMapIntensity for materials lit by scene.environment; binding the texture makes it count. */
let ENV_TEX = null;
function env(m, intensity) { if (ENV_TEX) { m.envMap = ENV_TEX; m.envMapIntensity = intensity; } return m; }

/** Adds map-depth haze (and a horizon fade) to a standard material; vMapV is map depth. */
function addHaze(shader, u) {
  Object.assign(shader.uniforms, u);
  shader.vertexShader = shader.vertexShader
    .replace('#include <common>', '#include <common>\nvarying vec3 vMapP;')
    .replace('#include <begin_vertex>', `#include <begin_vertex>
      vec4 mapP4 = vec4(transformed, 1.0);
      #ifdef USE_INSTANCING
        mapP4 = instanceMatrix * mapP4;
      #endif
      vMapP = mapP4.xyz;`);
  shader.fragmentShader = shader.fragmentShader
    .replace('#include <common>', `#include <common>
      varying vec3 vMapP;
      uniform vec3 uHaze; uniform vec2 uHazeRange;`)
    .replace('#include <fog_fragment>', `#include <fog_fragment>
      float hz = smoothstep(uHazeRange.x, uHazeRange.y, -vMapP.z);
      gl_FragColor.rgb = mix(gl_FragColor.rgb, uHaze, hz * 0.96);`);
}

function hazeUniforms(p) {
  return { uHaze: { value: lin(p.haze) }, uHazeRange: { value: new THREE.Vector2(-HAZE[0], -HAZE[1]) } };
}

function groundMaterial(p, blocks) {
  const m = env(new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.95, metalness: 0 }), 0.42);
  const u = {
    ...hazeUniforms(p),
    uBlocks: { value: blocks.tex }, uBlockMin: { value: new THREE.Vector2(blocks.iaMin, blocks.ibMin) },
    uGrid: { value: new THREE.Vector2(BA, BB) }, uRot: { value: new THREE.Vector2(COS, SIN) },
    uStreet: { value: STREET }, uAvenue: { value: AVENUE }, uTime: { value: 0 },
    cLot: { value: lin(p.lot) }, cStreet: { value: lin(p.street) }, cAvenue: { value: lin(p.avenue) }, cLane: { value: lin(p.lane) },
    cCurb: { value: lin(p.curb) }, cPark: { value: lin(p.park) }, cParkPath: { value: lin(p.parkPath) }, cPlaza: { value: lin(p.plaza) },
    cWater: { value: lin(p.water) }, cWaterDeep: { value: lin(p.waterDeep) }, cSand: { value: lin(p.sand) }, cFoam: { value: lin(p.foam) },
  };
  m.userData.u = u;
  m.onBeforeCompile = shader => {
    addHaze(shader, u);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>
        uniform sampler2D uBlocks; uniform vec2 uBlockMin, uGrid, uRot; uniform float uStreet, uAvenue, uTime;
        uniform vec3 cLot, cStreet, cAvenue, cLane, cCurb, cPark, cParkPath, cPlaza, cWater, cWaterDeep, cSand, cFoam;
        float groundRough = 0.95;
        ${COAST_GLSL}
        float hash12(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
        float aa(float d, float w) { float fw = max(fwidth(d), 1e-4); return 1.0 - smoothstep(w - fw, w + fw, d); }
        vec3 groundColor(vec2 m) {
          vec2 g = vec2(m.x * uRot.x + m.y * uRot.y, -m.x * uRot.y + m.y * uRot.x);
          vec2 cell = floor(g / uGrid);
          // nearest street line on each axis and its width (avenues every 5th / 4th line)
          vec2 k = floor(g / uGrid + 0.5);
          vec2 d = abs(g - k * uGrid);
          float wA = (mod(k.x, 5.0) == 0.0 ? uAvenue : uStreet) * 0.5;
          float wB = (mod(k.y, 4.0) == 0.0 ? uAvenue : uStreet) * 0.5;
          float sA = aa(d.x, wA), sB = aa(d.y, wB);
          float street = max(sA, sB);
          float curb = max(aa(d.x, wA + 0.07), aa(d.y, wB + 0.07));
          float type = texelFetch(uBlocks, ivec2(cell - uBlockMin), 0).r * 255.0;
          float h = hash12(cell);
          vec3 col = cLot * (0.985 + 0.03 * h);
          if (type > 0.5 && type < 1.5) {
            // park with a soft inner path loop
            vec2 f = g - cell * uGrid; vec2 c = min(f, uGrid - f);
            float path = aa(abs(min(c.x, c.y) - 0.42), 0.035);
            col = mix(cPark * (0.97 + 0.05 * hash12(floor(g * 3.0))), cParkPath, path * 0.8);
          } else if (type > 1.5 && type < 2.5) {
            col = cPlaza;
          }
          col = mix(col, cCurb, curb);
          // avenue lane markings
          float laneA = mod(k.x, 5.0) == 0.0 ? aa(d.x, 0.022) * step(0.45, fract(g.y * 0.7)) : 0.0;
          float laneB = mod(k.y, 4.0) == 0.0 ? aa(d.y, 0.022) * step(0.45, fract(g.x * 0.7)) : 0.0;
          vec3 road = mix(cStreet, cAvenue, max(step(uStreet * 0.5 + 0.01, wA) * sA, step(uStreet * 0.5 + 0.01, wB) * sB));
          road = mix(road, cLane, max(laneA * sA, laneB * sB));
          col = mix(col, road, street);
          // coastline: beach, foam line, water deepening offshore with slow swell lines
          float dv = m.y - coastV(m.x);
          float fwv = max(fwidth(dv), 1e-4);
          float beach = 1.0 - smoothstep(0.75 - fwv, 0.75 + fwv, dv);
          col = mix(col, cSand, beach);
          float water = 1.0 - smoothstep(-fwv, fwv, dv);
          vec3 wc = mix(cWater, cWaterDeep, smoothstep(0.0, -9.0, dv));
          float swell = smoothstep(0.82, 1.0, sin(dv * 5.0 + uTime * 0.9 + sin(m.x * 0.35) * 0.6)) * smoothstep(-6.0, -0.5, dv);
          wc = mix(wc, cFoam, swell * 0.22);
          wc = mix(wc, cFoam, aa(abs(dv + 0.12), 0.06) * 0.85);
          col = mix(col, wc, water);
          groundRough = mix(0.95, 0.28, water);
          return col;
        }`)
      .replace('#include <color_fragment>', `#include <color_fragment>
        diffuseColor.rgb = groundColor(vMapP.xz);`)
      .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
        roughnessFactor = groundRough;`);
  };
  m.customProgramCacheKey = () => 'nbhd-ground-v1';
  return m;
}

function hazyStandard(p, o = {}) {
  const m = env(new THREE.MeshStandardMaterial({ color: o.color || '#ffffff', roughness: o.roughness ?? 0.82, metalness: 0 }), o.env ?? 0.42);
  const u = hazeUniforms(p);
  m.onBeforeCompile = shader => addHaze(shader, u);
  m.customProgramCacheKey = () => 'nbhd-haze-v1';
  return m;
}

function pinRingMaterial(color) {
  return new THREE.ShaderMaterial({
    uniforms: { uColor: { value: lin(color) }, uTime: { value: 0 }, uOpacity: { value: 0 }, uPhase: { value: 0 } },
    vertexShader: /* glsl */`
      varying vec2 vUv;
      void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */`
      uniform vec3 uColor; uniform float uTime, uOpacity, uPhase;
      varying vec2 vUv;
      float ring(float r, float k) { float x = (r - k) * 11.0; return exp(-x * x) * (1.0 - k); }
      void main() {
        float r = length(vUv - 0.5) * 2.0;
        if (r > 1.0) discard;
        float k1 = fract(uTime * 0.5 + uPhase), k2 = fract(uTime * 0.5 + uPhase + 0.5);
        float a = ring(r, k1) + ring(r, k2);
        float disc = (1.0 - smoothstep(0.16, 0.2, r)) * 0.35;
        gl_FragColor = vec4(uColor, clamp((a * 0.85 + disc) * uOpacity, 0.0, 1.0));
      }`,
    transparent: true, depthWrite: false,
  });
}

// Callout bubble with a home glyph. Deliberately carries no numbers: the city is invented,
// so drive times or distances would read as facts that are not true.
function labelTexture(p) {
  const c = document.createElement('canvas');
  c.width = 128; c.height = 128;
  const x = c.getContext('2d');
  x.shadowColor = 'rgba(30,25,20,0.22)'; x.shadowBlur = 14; x.shadowOffsetY = 5;
  x.fillStyle = '#FFFFFF';
  x.beginPath(); x.arc(64, 60, 46, 0, Math.PI * 2); x.fill();
  x.shadowColor = 'transparent';
  x.fillStyle = p.pin;
  x.beginPath();
  x.moveTo(64, 34); x.lineTo(90, 56); x.lineTo(84, 56); x.lineTo(84, 82); x.lineTo(44, 82); x.lineTo(44, 56); x.lineTo(38, 56);
  x.closePath(); x.fill();
  x.fillStyle = '#FFFFFF';
  x.beginPath(); x.roundRect(58, 64, 12, 18, 3); x.fill();
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

/** Soft rounded-rect drop shadow (signed distance), so floating cards separate from the map. */
function dropShadowMaterial(w, h, r, blur, color) {
  return new THREE.ShaderMaterial({
    uniforms: { uHalf: { value: new THREE.Vector2(w / 2, h / 2) }, uR: { value: r }, uBlur: { value: blur }, uColor: { value: lin(color) }, uOpacity: { value: 0.22 } },
    vertexShader: /* glsl */`
      varying vec2 vP;
      void main() { vP = position.xy; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */`
      uniform vec2 uHalf; uniform float uR, uBlur, uOpacity; uniform vec3 uColor;
      varying vec2 vP;
      void main() {
        vec2 q = abs(vP) - uHalf + uR;
        float d = length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - uR;
        float a = 1.0 - smoothstep(-uBlur * 0.6, uBlur, d);
        gl_FragColor = vec4(uColor, a * a * uOpacity);
      }`,
    transparent: true, depthWrite: false,
  });
}

// ---------------------------------------------------------------------------------------------

class MapWorld extends BaseWorld {
  constructor(ctx) {
    super(ctx);
    this.style = 'paper';
    this.floorY = -3.0;
    this.scenes = [];
    this.routes = [];
  }

  materials() {
    const p = this.palette;
    ENV_TEX = this.stage.envTexture;
    const card = () => env(M.satin('#F4F1EC', { roughness: 0.36, clearcoat: 0.5, rim: 0.1 }), 0.6);
    return {
      frame: card,
      panel: () => env(M.satin('#FFFFFF', { roughness: 0.5, clearcoat: 0.25, rim: 0.06 }), 0.62),
      accent: () => env(M.satin(p.accent, { clearcoat: 1, roughness: 0.25, edgeColor: '#ffffff' }), 0.55),
      glyph: () => env(M.satin(p.accent, { clearcoat: 1, roughness: 0.2, edgeColor: '#ffffff', rim: 0.2 }), 0.55),
      decor: i => {
        const c = p.decor[i % p.decor.length];
        return env(M.satin(c, { clearcoat: 0.8, roughness: 0.3 }), 0.55);
      },
      ink: () => env(M.satin(p.ink, { roughness: 0.35, clearcoat: 0.7 }), 0.5),
      muted: () => env(M.satin(p.muted, { roughness: 0.55, clearcoat: 0.3 }), 0.5),
      glow: () => M.glow(p.glow, 2.2),
      line: () => M.flowMaterial({ color: p.route, head: '#ffffff' }),
    };
  }

  environment() {
    const p = this.palette;
    this.dome = new THREE.Mesh(new THREE.SphereGeometry(150, 48, 24), M.domeMaterial({ top: p.bgTop, bottom: p.bgBottom, horizon: p.haze, blobs: [], noise: 0.006 }));
    this.dome.renderOrder = -10;
    this.stage.scene.add(this.dome);

    // Soft daylight: a warm sun raking across the map from the upper left, cool sky fill
    const hemi = new THREE.HemisphereLight('#fffaf2', '#d6cbbb', 0.85);
    const key = new THREE.DirectionalLight('#fff1e0', 1.45);
    key.position.set(-22.5, 16.5, 10.8);
    key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048);
    key.shadow.radius = 6;
    key.shadow.blurSamples = 12;
    key.shadow.bias = -0.0005;
    const sc = key.shadow.camera;
    sc.left = -24; sc.right = 24; sc.top = 24; sc.bottom = -24; sc.near = 1; sc.far = 90;
    const fill = new THREE.DirectionalLight('#dfe9ff', 0.15);
    fill.position.set(10, 6, 8);
    this.env.add(hemi, key, key.target, fill);
    key.target.position.set(0, -1.5, -6);
    this.keyLight = key;
    this.lights = { hemi, key, fill };

    // The map: a pivot tilted toward the camera, with a scroller that keeps it fixed in world x
    this.mapPivot = new THREE.Group();
    this.mapPivot.position.set(0, -3.0, -1.6);
    this.mapPivot.rotation.x = TILT;
    this.mapScroll = new THREE.Group();
    this.mapPivot.add(this.mapScroll);
    this.env.add(this.mapPivot);
  }

  /** Cards and panels float above the map like UI sheets: a soft drop shadow rides behind each. */
  attachShadow(g, w, h, depth, radius) {
    const blur = 0.32;
    const mat = dropShadowMaterial(w, h, radius, blur, '#3a2f25');
    const pad = blur * 2.2;
    const sh = new THREE.Mesh(new THREE.PlaneGeometry(w + pad * 2, h + pad * 2), mat);
    sh.position.set(0.1, -0.16, -depth / 2 - 0.05);
    sh.renderOrder = -1;
    g.add(sh);
    const setOpacity = g.userData.setOpacity;
    g.userData.setOpacity = a => { setOpacity(a); mat.uniforms.uOpacity.value = 0.22 * a; sh.visible = a > 0.01; };
    if (g.userData.setDissolve) {
      const setDissolve = g.userData.setDissolve;
      g.userData.setDissolve = d => { setDissolve(d); mat.uniforms.uOpacity.value = 0.22 * (1 - clamp(d * 1.5)); };
    }
    return g;
  }

  card(opts = {}) {
    const g = super.card(opts);
    const { w = 3, h = 2, depth = 0.12, radius = 0.14 } = opts;
    return this.attachShadow(g, w, h, depth, radius);
  }

  panel(opts = {}) {
    const g = super.panel(opts);
    const { w = 4, h = 2.4, depth = 0.1, radius = 0.16 } = opts;
    return this.attachShadow(g, w, h, depth, radius);
  }

  focus(point) {
    super.focus(point);
    if (this.mapScroll) this.mapScroll.position.x = -point.x;
  }

  onTimeline(scenes, duration) {
    ENV_TEX = this.stage.envTexture;
    this.scenes = scenes;
    this.duration = duration;
    const xs = scenes.map(s => s.anchor.x);
    const u0 = Math.min(...xs, 0) - 46, u1 = Math.max(...xs, 0) + 46;
    this.buildCity(u0, u1, scenes);
    this.buildPins(scenes);
  }

  buildCity(u0, u1, scenes) {
    const p = this.palette;
    const r = rng((this.ctx.seed || 11) + 7);
    // grid range covering the map rectangle
    const corners = [[u0, V_NEAR], [u1, V_NEAR], [u0, V_FAR], [u1, V_FAR]].map(([u, v]) => toGrid(u, v));
    const iaMin = Math.floor(Math.min(...corners.map(c => c[0])) / BA) - 1, iaMax = Math.ceil(Math.max(...corners.map(c => c[0])) / BA) + 1;
    const ibMin = Math.floor(Math.min(...corners.map(c => c[1])) / BB) - 1, ibMax = Math.ceil(Math.max(...corners.map(c => c[1])) / BB) + 1;
    const W = iaMax - iaMin + 1, H = ibMax - ibMin + 1;
    const types = new Uint8Array(W * H * 4);
    const anchorsU = scenes.map(s => s.anchor.x);
    // a few "downtown" clusters far behind some anchors give the skyline a little rhythm
    const towns = anchorsU.filter((_, i) => i % 3 === 1).map(u => ({ u: u + r.range(-14, 14), v: r.range(-24, -15) }));

    const chunks = new Map();
    const trees = [];
    const add = (map, key, item) => { if (!map.has(key)) map.set(key, []); map.get(key).push(item); };

    for (let ia = iaMin; ia <= iaMax; ia++) {
      for (let ib = ibMin; ib <= ibMax; ib++) {
        const idx = ((ib - ibMin) * W + (ia - iaMin)) * 4;
        // block interior corners in map space
        const a0 = ia * BA, b0 = ib * BB;
        const cornersM = [[a0, b0], [a0 + BA, b0], [a0, b0 + BB], [a0 + BA, b0 + BB]].map(([a, b]) => toMap(a, b));
        const [cu, cv] = toMap(a0 + BA / 2, b0 + BB / 2);
        if (cu < u0 - 4 || cu > u1 + 4 || cv > V_NEAR + 2 || cv < V_FAR - 2) continue;
        const wet = cornersM.some(([u, v]) => v < coast(u) + 1.4);
        if (wet) continue;
        const h = r();
        let type = 0;
        if (h < 0.11) type = 1;                  // park
        else if (h < 0.135) type = 2;            // plaza
        types[idx] = type;
        types[idx + 3] = 255;
        if (cv < V_FAR + 3) continue;            // far edge stays empty, it is all haze
        const chunk = Math.floor((cu - u0) / CHUNK);
        if (type === 1) {
          const n = 10 + Math.floor(r() * 8);
          for (let i = 0; i < n; i++) {
            const a = a0 + r.range(0.55, BA - 0.55), b = b0 + r.range(0.5, BB - 0.5);
            const [u, v] = toMap(a, b);
            trees.push({ chunk, u, v, s: r.range(0.13, 0.24), c: r.pick(p.tree) });
          }
          continue;
        }
        if (type === 2) continue;
        // subdivide the block into lots with set-back buildings
        const inA = BA - (isAvenueA(ia) || isAvenueA(ia + 1) ? AVENUE : STREET);
        const inB = BB - (isAvenueB(ib) || isAvenueB(ib + 1) ? AVENUE : STREET);
        const na = r() < 0.5 ? 3 : 4, nb = 2;
        const la = inA / na, lb = inB / nb;
        const startA = a0 + (BA - inA) / 2, startB = b0 + (BB - inB) / 2;
        for (let i = 0; i < na; i++) {
          for (let j = 0; j < nb; j++) {
            if (r() < 0.1) continue;               // an empty lot here and there
            let wide = 1;
            if (i < na - 1 && r() < 0.18) wide = 2; // occasional wider building
            const set = r.range(0.06, 0.13);
            const ba = startA + i * la + set, bb = startB + j * lb + set;
            const fa = la * wide - set * 2, fb = lb - set * 2;
            if (wide === 2) i++;
            const [u, v] = toMap(ba + fa / 2, bb + fb / 2);
            let ht = 0.16 + 0.3 * Math.pow(r(), 2.2);
            const roll = r();
            if (roll < 0.08) ht = r.range(0.6, 1.05);
            else if (roll < 0.22) ht = r.range(0.4, 0.6);
            for (const tw of towns) {
              const d = Math.hypot(u - tw.u, (v - tw.v) * 1.4);
              if (d < 9) ht = Math.max(ht, (1 - d / 9) * r.range(1.1, 2.4));
            }
            // keep everything near the content band low so it stays under the scene
            const nearU = Math.min(...anchorsU.map(x => Math.abs(u - x)));
            if (v > -3.5 && nearU < 9) ht = Math.min(ht, 0.24);
            add(chunks, chunk, { u, v, w: fa, d: fb, h: ht, c: r.pick(p.building) });
          }
        }
      }
    }

    const tex = new THREE.DataTexture(types, W, H, THREE.RGBAFormat);
    tex.magFilter = THREE.NearestFilter;
    tex.minFilter = THREE.NearestFilter;
    tex.needsUpdate = true;
    this.track(tex);
    this.blocks = { tex, iaMin, ibMin };

    // ground: one plane under the whole strip, colored procedurally in the shader
    const gw = u1 - u0 + 40, gd = V_NEAR - V_FAR;
    const gg = new THREE.PlaneGeometry(gw, gd, 1, 1);
    gg.rotateX(-Math.PI / 2);
    gg.translate((u0 + u1) / 2, 0, (V_NEAR + V_FAR) / 2);
    this.groundMat = groundMaterial(p, this.blocks);
    const ground = new THREE.Mesh(gg, this.groundMat);
    ground.receiveShadow = true;
    ground.frustumCulled = false;
    this.mapScroll.add(ground);

    // buildings: one instanced mesh per chunk so off-screen chunks are culled
    const box = new THREE.BoxGeometry(1, 1, 1);
    box.translate(0, 0.5, 0);
    const bmat = hazyStandard(p, { roughness: 0.86 });
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), -GRID_ROT);
    const pos = new THREE.Vector3(), scl = new THREE.Vector3(), col = new THREE.Color();
    this.buildingCount = 0;
    for (const [, list] of chunks) {
      const mesh = new THREE.InstancedMesh(box, bmat, list.length);
      list.forEach((b, i) => {
        m4.compose(pos.set(b.u, 0, b.v), q, scl.set(b.w, b.h, b.d));
        mesh.setMatrixAt(i, m4);
        mesh.setColorAt(i, col.set(b.c));
      });
      mesh.instanceMatrix.needsUpdate = true;
      mesh.instanceColor.needsUpdate = true;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.computeBoundingSphere();
      this.mapScroll.add(mesh);
      this.buildingCount += list.length;
    }

    // model trees: low-poly foam balls
    if (trees.length) {
      const tg = new THREE.IcosahedronGeometry(1, 1);
      const tmat = hazyStandard(p, { roughness: 0.9, env: 0.28 });
      const byChunk = new Map();
      trees.forEach(t => add(byChunk, t.chunk, t));
      for (const [, list] of byChunk) {
        const mesh = new THREE.InstancedMesh(tg, tmat, list.length);
        list.forEach((t, i) => {
          m4.compose(pos.set(t.u, t.s * 0.95, t.v), new THREE.Quaternion(), scl.setScalar(t.s));
          mesh.setMatrixAt(i, m4);
          mesh.setColorAt(i, col.set(t.c));
        });
        mesh.instanceMatrix.needsUpdate = true;
        mesh.instanceColor.needsUpdate = true;
        mesh.castShadow = true;
        mesh.computeBoundingSphere();
        this.mapScroll.add(mesh);
      }
    }
  }

  /** Street-following route between two grid intersections, as map-space points. */
  routePoints(k1, m1, k2, m2, jog) {
    const P = (k, m) => { const [u, v] = toMap(k * BA, m * BB); return new THREE.Vector2(u, v); };
    const corners = [P(k1, m1), P(k1, jog), P(k2, jog), P(k2, m2)];
    const pts = [];
    const R = 0.45;
    for (let i = 0; i < corners.length; i++) {
      const c = corners[i];
      if (i === 0 || i === corners.length - 1) { pts.push(c); continue; }
      const a = corners[i - 1], b = corners[i + 1];
      const da = c.clone().sub(a), db = b.clone().sub(c);
      if (da.length() < 1e-3 || db.length() < 1e-3) continue;
      const r1 = Math.min(R, da.length() / 2), r2 = Math.min(R, db.length() / 2);
      pts.push(c.clone().sub(da.normalize().multiplyScalar(r1)));
      pts.push(c.clone().add(db.normalize().multiplyScalar(r2)));
    }
    // densify straight runs so the spline hugs the streets
    const out = [];
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i], b = pts[i + 1];
      const n = Math.max(1, Math.round(a.distanceTo(b) / 0.8));
      for (let k = 0; k < n; k++) out.push(a.clone().lerp(b, k / n));
    }
    out.push(pts[pts.length - 1]);
    return out;
  }

  buildPins(scenes) {
    const p = this.palette;
    const r = rng((this.ctx.seed || 3) + 101);
    const portrait = this.stage.aspect < 0.95;
    const headGeo = new THREE.SphereGeometry(0.44, 36, 24);
    const tipGeo = new THREE.ConeGeometry(0.34, 0.8, 36, 1);
    tipGeo.rotateX(Math.PI);
    tipGeo.translate(0, -0.34, 0);
    const dotGeo = new THREE.SphereGeometry(0.17, 24, 14);
    const ringGeo = new THREE.PlaneGeometry(1, 1);
    ringGeo.rotateX(-Math.PI / 2);
    const pinMat = env(M.satin(p.pin, { clearcoat: 1, roughness: 0.22, emissive: p.pin, emissiveIntensity: 0.18 }), 0.6);
    const whiteMat = env(M.satin('#ffffff', { roughness: 0.3, clearcoat: 0.6 }), 0.5);
    const originMat = env(M.satin('#ffffff', { roughness: 0.3, clearcoat: 0.8, emissive: '#ffffff', emissiveIntensity: 0.1 }), 0.5);

    scenes.forEach((s, si) => {
      // the timeline scene draws its own route, so the map stays quiet there
      if (s.inst.noDecor || s.type === 'timeline') return;
      // vertical frames are narrow: keep the brand intro and the big message clean
      if (portrait && (s.type === 'intro' || s.type === 'message')) return;
      const au = s.anchor.x;
      const busy = ['chart', 'endcard', 'intro', 'quote', 'message'].includes(s.type);
      const nRoutes = busy ? 1 : 2;
      const solo = busy;   // busy scenes keep the whole route out to one side
      const split = !portrait && s.inst.shot?.layout === 'split';
      for (let ri = 0; ri < nRoutes; ri++) {
        // destinations sit wide of the content (right side only when text owns the left);
        // origins start behind the content so routes emerge from under the scene
        const side = split ? 1 : (ri + si) % 2 ? 1 : -1;
        const wideU = portrait ? r.range(1.9, 2.6) : split ? r.range(4.4, 5.6) : r.range(6.0, 7.6);
        const back = 0;
        // in split layouts the 3D sits right of center, so pins go deeper and peek out above it
        const depth = split ? (ri ? r.range(-12.5, -10.5) : r.range(-9.5, -7.8)) : ri ? r.range(-10.5, -8.5) : r.range(-6.5, -4.2);
        const toUV = [au + side * wideU, depth - back];
        let fromUV = split ? [au + r.range(-0.5, 2.5), r.range(-4.2, -2.6) - back] : [au - side * r.range(0.5, 2.5), r.range(-4.5, -2.6) - back];
        if (solo) fromUV = [au + side * (wideU + (portrait ? 1.2 : 3.0)), toUV[1] + r.range(2.0, 3.0)];
        // keep the destination on dry land
        toUV[1] = Math.max(toUV[1], coast(toUV[0]) + 3);
        fromUV[1] = Math.max(fromUV[1], coast(fromUV[0]) + 3);
        const g1 = toGrid(...fromUV), g2 = toGrid(...toUV);
        const k1 = Math.round(g1[0] / BA), m1 = Math.round(g1[1] / BB);
        const k2 = Math.round(g2[0] / BA), m2 = Math.round(g2[1] / BB);
        const jog = Math.round(lerp(m1, m2, r.range(0.3, 0.7)));
        const pts2 = this.routePoints(k1, m1, k2, m2, jog);
        const pts = pts2.map(v => new THREE.Vector3(v.x, 0.1, v.y));
        const curve = new THREE.CatmullRomCurve3(pts, false, 'centripetal');
        const len = curve.getLength();
        const mat = M.flowMaterial({ color: p.route, head: '#ffffff', dash: Math.max(6, len * 1.4), speed: 0.8, intensity: 1.0 });
        mat.transparent = true;
        const tube = new THREE.Mesh(new THREE.TubeGeometry(curve, Math.max(40, Math.round(len * 10)), 0.08, 8, false), mat);
        tube.renderOrder = 3;
        this.mapScroll.add(tube);
        // casing under the route line, like a map app
        const casing = new THREE.Mesh(new THREE.TubeGeometry(curve, Math.max(40, Math.round(len * 10)), 0.15, 8, false),
          new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0, depthWrite: false }));
        casing.scale.y = 0.4;
        casing.renderOrder = 2;
        this.mapScroll.add(casing);

        const end = pts[pts.length - 1], start = pts[0];
        // destination pin
        const pin = new THREE.Group();
        const head = new THREE.Mesh(headGeo, pinMat);
        head.position.y = 1.22;
        const tip = new THREE.Mesh(tipGeo, pinMat);
        tip.position.y = 1.22;
        const dot = new THREE.Mesh(dotGeo, whiteMat);
        dot.position.set(0, 1.25, 0.34);
        pin.add(head, tip, dot);
        pin.traverse(o => { o.castShadow = true; });
        pin.position.copy(end);
        this.mapScroll.add(pin);
        const ringMat = pinRingMaterial(p.pin);
        ringMat.uniforms.uPhase.value = r();
        const ring = new THREE.Mesh(ringGeo, ringMat);
        ring.scale.setScalar(2.6);
        ring.position.copy(end).setY(0.02);
        this.mapScroll.add(ring);
        // origin: a white puck with an accent ring
        const origin = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.26, 0.1, 32), originMat);
        origin.position.copy(start).setY(0.06);
        origin.castShadow = true;
        this.mapScroll.add(origin);
        const oRingMat = pinRingMaterial(p.route);
        oRingMat.uniforms.uPhase.value = r();
        const oRing = new THREE.Mesh(ringGeo, oRingMat);
        oRing.scale.setScalar(1.7);
        oRing.position.copy(start).setY(0.025);
        this.mapScroll.add(oRing);
        // home callout above the destination
        const labelTex = labelTexture(p);
        this.track(labelTex);
        const label = new THREE.Sprite(new THREE.SpriteMaterial({ map: labelTex, transparent: true, depthWrite: false, opacity: 0 }));
        // callout bubble riding just above the destination pin
        label.position.set(end.x, 2.0, end.z);
        label.scale.set(0.95, 0.95, 1);
        label.center.set(0.5, 0);
        this.mapScroll.add(label);

        const t0 = s.start - 0.3 + ri * 0.45;
        this.routes.push({ mat, casing, t0, dur: 1.2 + len * 0.05, label, labelMat: label.material, ring: ringMat, oRing: oRingMat, pin, origin, end: s.end, side, wash: this.washOf(s, portrait) });
      }
    });
  }

  /**
   * 1 when a callout bubble sits fully inside the frame and clear of the scene's text zone,
   * fading to 0 as it would be clipped or crowd the type.
   */
  inFrame(R) {
    const v = _v.setFromMatrixPosition(R.label.matrixWorld);
    v.project(this.stage.camera);
    if (v.z > 1 || v.z < -1) return 0;
    // the bubble extends mostly toward the frame center; allow for its width in NDC
    const half = 0.2 * (this.stage.aspect < 0.95 ? 1.8 : 1);
    const outer = R.side > 0 ? v.x + half * 0.45 : -v.x + half * 0.45;
    let k = 1 - clamp((outer - 0.9) / 0.08);
    const top = v.y + 0.12;   // the bubble sits above its anchor point
    if (R.wash.top) k *= 1 - clamp((top - 0.3) / 0.1);
    if (R.wash.bottom) k *= 1 - clamp((-0.3 - v.y) / 0.1);
    if (R.wash.left) k *= 1 - clamp((-0.05 - v.x) / 0.1);
    return k;
  }

  update(t) {
    super.update(t);
    this.env.updateMatrixWorld(true);   // labels are projected below, after focus() moved the map
    if (this.groundMat?.userData.u) this.groundMat.userData.u.uTime.value = t;
    for (const R of this.routes) {
      const k = ease.inOutCubic(seg(t, R.t0, R.dur));
      R.mat.uniforms.uProgress.value = Math.max(0.0001, k);
      R.mat.uniforms.uTime.value = t;
      R.mat.uniforms.uOpacity.value = k > 0 ? 1 : 0;
      R.casing.material.opacity = 0.9 * clamp(k * 4);
      const pk = ease.outBack(seg(t, R.t0 + R.dur - 0.25, 0.6));
      R.pin.scale.setScalar(Math.max(0.001, pk));
      R.pin.position.y = 0.0 + Math.sin(t * 2.0 + R.t0) * 0.05 * pk;
      R.pin.rotation.y = Math.sin(t * 0.8 + R.t0) * 0.25;
      R.origin.scale.setScalar(Math.max(0.001, ease.outBack(seg(t, R.t0 - 0.1, 0.5))));
      R.ring.uniforms.uTime.value = t;
      R.ring.uniforms.uOpacity.value = clamp(seg(t, R.t0 + R.dur, 0.4));
      R.oRing.uniforms.uTime.value = t + 0.3;
      R.oRing.uniforms.uOpacity.value = 0.7 * clamp(seg(t, R.t0, 0.4));
      R.labelMat.opacity = clamp(seg(t, R.t0 + R.dur * 0.6, 0.5)) * this.inFrame(R);
    }
  }

  drawOverlay(o, t, { scenes }) {
    // Map-label halos: a soft white glow behind every line of scene type keeps it readable on the map
    this.haloLayer(o, '#FFFFFF', 11, 0.95);
    // ...and a soft wash behind the scene's text zone, like a map app's sidebar
    this.textWash(o, t, scenes);
  }

  /** Which side of the frame carries the scene's text: left (split), top (stack) or bottom. */
  washOf(s, portrait) {
    const layout = s.inst.shot?.layout;
    if (s.type === 'endcard' || s.type === 'quote') return { left: 0, top: 0, bottom: 0 };
    if (s.type === 'timeline' && portrait) return { left: 0, top: 0, bottom: 1 };
    if (layout === 'split' && !portrait) return { left: 1, top: 0, bottom: 0 };
    if (layout === 'stackBottom') return { left: 0, top: 0, bottom: 1 };
    if (layout === 'stack' || (layout === 'split' && portrait)) return { left: 0, top: 1, bottom: 0 };
    return { left: 0, top: 0, bottom: 0 };
  }

  textWash(o, t, scenes) {
    if (!scenes?.length) return;
    let i = scenes.findIndex(s => t < s.end);
    if (i < 0) i = scenes.length - 1;
    const s = scenes[i];
    let w = this.washOf(s, o.portrait);
    const mix = (a, b, k) => ({ left: lerp(a.left, b.left, k), top: lerp(a.top, b.top, k), bottom: lerp(a.bottom, b.bottom, k) });
    if (i > 0 && t < s.start + 0.4) w = mix(this.washOf(scenes[i - 1], o.portrait), w, clamp((t - s.start + 0.4) / 0.8));
    else if (i < scenes.length - 1 && t > s.end - 0.4) w = mix(w, this.washOf(scenes[i + 1], o.portrait), clamp((t - s.end + 0.4) / 0.8));
    const col = this.palette.scrim || '#FFFFFF';
    const c = o.ctx;
    c.save();
    c.globalCompositeOperation = 'destination-over';
    if (w.left > 0.01) {
      const g = c.createLinearGradient(0, 0, o.W * 0.6, 0);
      g.addColorStop(0, rgba(col, 0.72 * w.left));
      g.addColorStop(0.5, rgba(col, 0.5 * w.left));
      g.addColorStop(1, rgba(col, 0));
      c.fillStyle = g;
      c.fillRect(0, 0, o.W * 0.6, o.H);
    }
    if (w.top > 0.01) {
      const h = o.H * (o.portrait ? 0.34 : 0.42);
      const g = c.createLinearGradient(0, 0, 0, h);
      g.addColorStop(0, rgba(col, 0.62 * w.top));
      g.addColorStop(0.55, rgba(col, 0.42 * w.top));
      g.addColorStop(1, rgba(col, 0));
      c.fillStyle = g;
      c.fillRect(0, 0, o.W, h);
    }
    if (w.bottom > 0.01) {
      const h = o.H * 0.42;
      const g = c.createLinearGradient(0, o.H, 0, o.H - h);
      g.addColorStop(0, rgba(col, 0.66 * w.bottom));
      g.addColorStop(0.55, rgba(col, 0.45 * w.bottom));
      g.addColorStop(1, rgba(col, 0));
      c.fillStyle = g;
      c.fillRect(0, o.H - h, o.W, h);
    }
    c.restore();
  }

  haloLayer(o, color, blur, alpha) {
    const src = this.stage.overlay;
    const W = src.width, H = src.height;
    if (!this.haloCanvas) {
      this.haloCanvas = document.createElement('canvas');
      this.haloCtx = this.haloCanvas.getContext('2d');
    }
    if (this.haloCanvas.width !== W || this.haloCanvas.height !== H) { this.haloCanvas.width = W; this.haloCanvas.height = H; }
    const g = this.haloCtx;
    g.save();
    g.globalCompositeOperation = 'copy';
    g.drawImage(src, 0, 0);
    g.globalCompositeOperation = 'destination-in';
    for (let i = 0; i < 3; i++) g.drawImage(this.haloCanvas, 0, 0);
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
    c.drawImage(this.haloCanvas, 0, 0);
    c.drawImage(this.haloCanvas, 0, 0);
    c.restore();
  }
}

export default {
  id: 'neighborhood',
  name: 'Neighborhood Map',
  family: 'Map',
  description: 'An aerial architectural-model city with pins and routes. Your story floats above the map.',
  bestFor: 'Listings, neighborhood guides, relocation, open houses, market areas',
  swatch: ['#F3F1EC', '#C3D5AF', '#0B8A80', '#14202C'],
  native: 'native',
  post: {
    bloom: { strength: 0.22, radius: 0.3, threshold: 2.4 },
    grain: 0.016, vignette: 0.2, ca: 0.0007, tone: 'neutral', exposure: 1.0, vignetteColor: '#CDC4B7',
  },
  transition: { style: 'glide', duration: 1.1 },
  drift: 0.8,
  palette: mode => mapPalette(mode === 'native' ? 'native' : 'brand'),
  overlayTheme: p => ({
    text: p.text, sub: p.sub, accent: p.chip, accentText: '#FFFFFF', scrim: p.scrim, scrimAlpha: p.scrimAlpha,
    chipBg: p.chip, chipText: '#FFFFFF', panel: 'rgba(255,255,255,0.9)', panelStroke: 'rgba(255,255,255,1)', dark: false,
  }),
  create: ctx => new MapWorld(ctx),
};
