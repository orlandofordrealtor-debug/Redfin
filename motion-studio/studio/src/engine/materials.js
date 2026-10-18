// Material recipes shared by every look.
// Note: with three r169, a material without its own envMap uses scene.environmentIntensity and
// ignores envMapIntensity. Looks that need per-material reflection strength bind the stage's
// environment texture onto the material (see bindEnv in looks/clay.js). Clay and satin materials are extended through
// onBeforeCompile with a soft rim light and a noise dissolve whose edge glows (bloom picks it up).
import * as THREE from 'three';

const NOISE_GLSL = /* glsl */`
  vec3 _h3(vec3 p) {
    p = vec3(dot(p, vec3(127.1, 311.7, 74.7)), dot(p, vec3(269.5, 183.3, 246.1)), dot(p, vec3(113.5, 271.9, 124.6)));
    return -1.0 + 2.0 * fract(sin(p) * 43758.5453123);
  }
  float _n3(vec3 p) {
    vec3 i = floor(p), f = fract(p);
    vec3 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(mix(dot(_h3(i + vec3(0,0,0)), f - vec3(0,0,0)), dot(_h3(i + vec3(1,0,0)), f - vec3(1,0,0)), u.x),
                   mix(dot(_h3(i + vec3(0,1,0)), f - vec3(0,1,0)), dot(_h3(i + vec3(1,1,0)), f - vec3(1,1,0)), u.x), u.y),
               mix(mix(dot(_h3(i + vec3(0,0,1)), f - vec3(0,0,1)), dot(_h3(i + vec3(1,0,1)), f - vec3(1,0,1)), u.x),
                   mix(dot(_h3(i + vec3(0,1,1)), f - vec3(0,1,1)), dot(_h3(i + vec3(1,1,1)), f - vec3(1,1,1)), u.x), u.y), u.z);
  }
  float _fbm(vec3 p) { float v = 0.0, a = 0.5; for (int i = 0; i < 4; i++) { v += a * _n3(p); p *= 2.03; a *= 0.5; } return v; }
`;

/**
 * Adds rim light + dissolve to a MeshStandard/Physical material.
 * Control with mat.userData.u.uDissolve (0 = solid, 1 = gone).
 */
export function enhance(mat, { rim = 0.35, rimColor = '#ffffff', rimPower = 2.6, edgeColor = '#DE3341', edgeWidth = 0.08, noiseScale = 2.2, edgeIntensity = 6 } = {}) {
  const u = {
    uDissolve: { value: 0 },
    uEdgeColor: { value: new THREE.Color(edgeColor) },
    uEdgeWidth: { value: edgeWidth },
    uEdgeIntensity: { value: edgeIntensity },
    uNoiseScale: { value: noiseScale },
    uRim: { value: rim },
    uRimColor: { value: new THREE.Color(rimColor) },
    uRimPower: { value: rimPower },
  };
  mat.userData.u = u;
  mat.onBeforeCompile = shader => {
    Object.assign(shader.uniforms, u);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vDisPos;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvDisPos = position;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>
        varying vec3 vDisPos;
        uniform float uDissolve, uEdgeWidth, uEdgeIntensity, uNoiseScale, uRim, uRimPower;
        uniform vec3 uEdgeColor, uRimColor;
        ${NOISE_GLSL}`)
      .replace('#include <clipping_planes_fragment>', `#include <clipping_planes_fragment>
        float disN = _fbm(vDisPos * uNoiseScale) * 0.5 + 0.5;
        float disT = uDissolve * 1.15 - 0.075;
        if (uDissolve > 0.0005 && disN < disT) discard;`)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        if (uDissolve > 0.0005 && uDissolve < 0.9995) {
          float disEdge = 1.0 - smoothstep(0.0, max(uEdgeWidth, 1e-4), disN - disT);
          totalEmissiveRadiance += uEdgeColor * disEdge * uEdgeIntensity;
        }`)
      .replace('#include <opaque_fragment>', `
        float rimDot = clamp(dot(normalize(normal), normalize(vViewPosition)), 0.0, 1.0);
        outgoingLight += uRimColor * pow(clamp(1.0 - rimDot, 0.0, 1.0), max(uRimPower, 0.01)) * uRim;
        #include <opaque_fragment>`);
  };
  mat.customProgramCacheKey = () => 'enhanced-v1';
  return mat;
}

export function clay(color, o = {}) {
  const c = new THREE.Color(color);
  const sheen = c.clone().lerp(new THREE.Color('#ffffff'), 0.55);
  const m = new THREE.MeshPhysicalMaterial({
    color: c, roughness: o.roughness ?? 0.6, metalness: 0,
    sheen: 1, sheenRoughness: 0.55, sheenColor: sheen,
    clearcoat: o.clearcoat ?? 0.08, clearcoatRoughness: 0.6,
    envMapIntensity: o.env ?? 0.75,
  });
  return enhance(m, { rim: o.rim ?? 0.28, rimColor: o.rimColor || '#ffffff', edgeColor: o.edgeColor || '#4f46e5' });
}

export function satin(color, o = {}) {
  const m = new THREE.MeshPhysicalMaterial({
    color, roughness: o.roughness ?? 0.32, metalness: o.metalness ?? 0,
    clearcoat: o.clearcoat ?? 0.7, clearcoatRoughness: 0.18, envMapIntensity: o.env ?? 0.75,
    emissive: o.emissive || '#000000', emissiveIntensity: o.emissiveIntensity ?? 0,
  });
  return enhance(m, { rim: o.rim ?? 0.18, rimColor: o.rimColor || '#ffffff', edgeColor: o.edgeColor || '#DE3341' });
}

/** Frosted or clear glass. Transmission blurs whatever sits behind it. */
export function glass(o = {}) {
  const m = new THREE.MeshPhysicalMaterial({
    color: o.tint || '#ffffff',
    roughness: o.roughness ?? 0.32,
    metalness: 0,
    transmission: o.transmission ?? 1,
    thickness: o.thickness ?? 0.6,
    ior: o.ior ?? 1.45,
    attenuationColor: new THREE.Color(o.attenuation || o.tint || '#ffffff'),
    attenuationDistance: o.attenuationDistance ?? 3,
    clearcoat: 1, clearcoatRoughness: 0.1,
    specularIntensity: 1,
    envMapIntensity: o.env ?? 1.1,
    transparent: false,
  });
  if ('dispersion' in m && o.dispersion) m.dispersion = o.dispersion;
  return m;
}

export function metal(color = '#d9d9de', o = {}) {
  return new THREE.MeshPhysicalMaterial({ color, metalness: 1, roughness: o.roughness ?? 0.16, envMapIntensity: o.env ?? 1.2, clearcoat: o.clearcoat ?? 0.3 });
}

export function gold(o = {}) {
  return new THREE.MeshPhysicalMaterial({ color: o.color || '#E2B25C', metalness: 1, roughness: o.roughness ?? 0.24, envMapIntensity: o.env ?? 1.3, clearcoat: 0.4, clearcoatRoughness: 0.2 });
}

/** Unlit HDR color; values above 1 bloom. */
export function glow(color, intensity = 3) {
  const c = new THREE.Color(color).multiplyScalar(intensity);
  return new THREE.MeshBasicMaterial({ color: c, toneMapped: true });
}

/** Additive fresnel shell for bubbles, atmospheres and holographic rings. */
export function fresnel({ color = '#7fe7ff', power = 2.4, intensity = 1.6, opacity = 1, inner = 0.04, side = THREE.FrontSide } = {}) {
  return new THREE.ShaderMaterial({
    uniforms: {
      uColor: { value: new THREE.Color(color) }, uPower: { value: power }, uIntensity: { value: intensity },
      uOpacity: { value: opacity }, uInner: { value: inner },
    },
    vertexShader: /* glsl */`
      varying vec3 vN; varying vec3 vV;
      void main() {
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */`
      uniform vec3 uColor; uniform float uPower, uIntensity, uOpacity, uInner;
      varying vec3 vN; varying vec3 vV;
      void main() {
        float f = pow(clamp(1.0 - abs(dot(normalize(vN), normalize(vV))), 0.0, 1.0), max(uPower, 0.01));
        float a = (f + uInner) * uOpacity;
        gl_FragColor = vec4(uColor * uIntensity * a, a);
      }`,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side,
  });
}

/** Large backdrop dome with a vertical gradient and soft color blobs. */
export function domeMaterial({ top = '#ffffff', bottom = '#e9e6e1', horizon = null, blobs = [], noise = 0.02 } = {}) {
  const B = 6;
  const blobPos = [], blobCol = [], blobSize = [];
  for (let i = 0; i < B; i++) {
    const b = blobs[i];
    blobPos.push(b ? new THREE.Vector3(...b.dir).normalize() : new THREE.Vector3(0, -1, 0));
    blobCol.push(new THREE.Color(b ? b.color : '#000000'));
    blobSize.push(b ? b.size : 0);
  }
  return new THREE.ShaderMaterial({
    uniforms: {
      uTop: { value: new THREE.Color(top) }, uBottom: { value: new THREE.Color(bottom) },
      uHorizon: { value: new THREE.Color(horizon || bottom) }, uHasHorizon: { value: horizon ? 1 : 0 },
      uBlobPos: { value: blobPos }, uBlobCol: { value: blobCol }, uBlobSize: { value: blobSize },
      uNoise: { value: noise }, uTime: { value: 0 },
    },
    vertexShader: /* glsl */`
      varying vec3 vDir;
      void main() { vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */`
      uniform vec3 uTop, uBottom, uHorizon; uniform float uHasHorizon, uNoise, uTime;
      uniform vec3 uBlobPos[${B}]; uniform vec3 uBlobCol[${B}]; uniform float uBlobSize[${B}];
      varying vec3 vDir;
      float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
      void main() {
        float y = vDir.y * 0.5 + 0.5;
        vec3 col = mix(uBottom, uTop, smoothstep(0.0, 1.0, y));
        if (uHasHorizon > 0.5) col = mix(col, uHorizon, exp(-pow((y - 0.5) * 6.0, 2.0)) * 0.6);
        for (int i = 0; i < ${B}; i++) {
          if (uBlobSize[i] <= 0.0) continue;
          float d = distance(vDir, uBlobPos[i]);
          col = mix(col, uBlobCol[i], 0.9 * exp(-pow(d / max(uBlobSize[i], 1e-3), 2.0)));
        }
        col += (hash(vDir.xy * 400.0) - 0.5) * uNoise;
        gl_FragColor = vec4(col, 1.0);
      }`,
    side: THREE.BackSide, depthWrite: false,
  });
}

/** Dotted grid floor that fades with distance (the clay studio floor). */
export function dotFloorMaterial({ color = '#4f46e5', bg = '#f2efe9', spacing = 0.5, dot = 0.045, fade = 18, opacity = 0.35 } = {}) {
  return new THREE.ShaderMaterial({
    uniforms: {
      uColor: { value: new THREE.Color(color) }, uBg: { value: new THREE.Color(bg) }, uSpacing: { value: spacing },
      uDot: { value: dot }, uFade: { value: fade }, uOpacity: { value: opacity },
    },
    vertexShader: /* glsl */`
      varying vec3 vW; varying vec2 vL;
      void main() { vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; vL = position.xy; gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: /* glsl */`
      uniform vec3 uColor, uBg; uniform float uSpacing, uDot, uFade, uOpacity;
      varying vec3 vW; varying vec2 vL;
      void main() {
        vec2 g = vW.xz / uSpacing;
        vec2 f = fract(g) - 0.5;
        float d = length(f);
        float w = fwidth(d);
        float dotMask = 1.0 - smoothstep(uDot - w, uDot + w, d);
        float r = length(vL);
        float fade = 1.0 - smoothstep(uFade * 0.25, uFade, r);
        float a = dotMask * fade * uOpacity;
        gl_FragColor = vec4(uColor, a);
      }`,
    transparent: true, depthWrite: false,
  });
}

/** Fine line grid (lat/long or blueprint) drawn with fract() and fwidth(). */
export function lineGridMaterial({ color = '#7fe7ff', spacing = 1, width = 1, fade = 20, opacity = 0.35 } = {}) {
  return new THREE.ShaderMaterial({
    uniforms: { uColor: { value: new THREE.Color(color) }, uSpacing: { value: spacing }, uWidth: { value: width }, uFade: { value: fade }, uOpacity: { value: opacity } },
    vertexShader: /* glsl */`
      varying vec3 vW; varying vec2 vL;
      void main() { vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; vL = position.xy; gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: /* glsl */`
      uniform vec3 uColor; uniform float uSpacing, uWidth, uFade, uOpacity;
      varying vec3 vW; varying vec2 vL;
      void main() {
        vec2 g = vW.xz / uSpacing;
        vec2 fw = fwidth(g);
        vec2 l = abs(fract(g - 0.5) - 0.5) / max(fw, vec2(1e-4));
        float line = 1.0 - min(min(l.x, l.y) / uWidth, 1.0);
        float fade = 1.0 - smoothstep(uFade * 0.3, uFade, length(vL));
        gl_FragColor = vec4(uColor, line * fade * uOpacity);
      }`,
    transparent: true, depthWrite: false,
  });
}

/** Flowing dashed line along a tube's length (uv.x), with a bright head. */
export function flowMaterial({ color = '#DE3341', head = '#ffffff', dash = 18, speed = 1.2, intensity = 2.5 } = {}) {
  return new THREE.ShaderMaterial({
    uniforms: {
      uColor: { value: new THREE.Color(color) }, uHead: { value: new THREE.Color(head) }, uDash: { value: dash },
      uSpeed: { value: speed }, uTime: { value: 0 }, uProgress: { value: 1 }, uIntensity: { value: intensity }, uOpacity: { value: 1 },
    },
    vertexShader: /* glsl */`
      varying vec2 vUv;
      void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */`
      uniform vec3 uColor, uHead; uniform float uDash, uSpeed, uTime, uProgress, uIntensity, uOpacity;
      varying vec2 vUv;
      void main() {
        if (vUv.x > uProgress) discard;
        float dash = step(0.45, fract(vUv.x * uDash - uTime * uSpeed));
        float head = exp(-pow((uProgress - vUv.x) * 40.0, 2.0));
        vec3 col = uColor * (0.55 + 0.45 * dash) * uIntensity + uHead * head * 4.0;
        gl_FragColor = vec4(col, uOpacity);
      }`,
    transparent: true, depthWrite: false,
  });
}

/** Shadow-only floor. */
export function shadowFloor(opacity = 0.18) {
  return new THREE.ShadowMaterial({ opacity, transparent: true, depthWrite: false });
}
