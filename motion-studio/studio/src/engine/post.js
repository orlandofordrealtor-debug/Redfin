// Final pass: chromatic aberration, vignette and film grain on the tone-mapped image,
// then the 2D text layer composited on top so typography stays crisp.
import * as THREE from 'three';

export const FinalShader = {
  uniforms: {
    tDiffuse: { value: null },
    tOverlay: { value: null },
    uOverlayOn: { value: 1 },
    uRes: { value: new THREE.Vector2(1920, 1080) },
    uTime: { value: 0 },
    uGrain: { value: 0.035 },
    uVignette: { value: 0.28 },
    uCA: { value: 0.0025 },
    uVigColor: { value: new THREE.Color(0, 0, 0) },
    uFade: { value: 0 },
    uFadeColor: { value: new THREE.Color(1, 1, 1) },
    uScanlines: { value: 0 },
    uBand: { value: 0 },
  },
  vertexShader: /* glsl */`
    varying vec2 vUv;
    void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
  `,
  fragmentShader: /* glsl */`
    uniform sampler2D tDiffuse;
    uniform sampler2D tOverlay;
    uniform float uOverlayOn;
    uniform vec2 uRes;
    uniform float uTime, uGrain, uVignette, uCA, uFade, uScanlines, uBand;
    uniform vec3 uVigColor, uFadeColor;
    varying vec2 vUv;

    float hash(vec2 p) {
      p = fract(p * vec2(123.34, 456.21));
      p += dot(p, p + 45.32);
      return fract(p.x * p.y);
    }

    void main() {
      vec2 uv = vUv;
      vec2 c = uv - 0.5;
      float aspect = uRes.x / max(uRes.y, 1.0);
      vec2 ca = c * vec2(1.0, 1.0) * uCA * (0.4 + 2.0 * dot(c, c));
      vec3 col;
      col.r = texture2D(tDiffuse, uv + ca).r;
      col.g = texture2D(tDiffuse, uv).g;
      col.b = texture2D(tDiffuse, uv - ca).b;

      // Vignette: 0 at the center, 1 in the corners, for any aspect ratio
      vec2 dims = vec2(aspect, 1.0);
      float d = length(c * dims) / max(length(dims * 0.5), 1e-4);
      float vig = smoothstep(0.45, 1.05, d);
      col = mix(col, uVigColor, clamp(vig * uVignette, 0.0, 1.0));

      // Holographic scan lines and a rolling bright band (globe look only)
      if (uScanlines > 0.0) {
        float line = 0.5 + 0.5 * sin(uv.y * uRes.y * 1.5);
        col *= 1.0 - uScanlines * 0.18 * line;
        float bandPos = fract(uTime * 0.12);
        float band = exp(-pow((uv.y - bandPos) * 9.0, 2.0));
        col += vec3(0.25, 0.85, 1.0) * band * uBand * 0.08;
      }

      float g = hash(uv * uRes + fract(uTime * 7.13) * 91.7) - 0.5;
      col += g * uGrain;

      col = mix(col, uFadeColor, clamp(uFade, 0.0, 1.0));

      vec4 ov = texture2D(tOverlay, uv);
      col = mix(col, ov.rgb, ov.a * uOverlayOn);

      gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
    }
  `,
};
