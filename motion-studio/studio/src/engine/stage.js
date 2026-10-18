// The stage owns the WebGL renderer, the post-processing chain and the 2D text layer.
// Pipeline: scene -> half-float HDR target (4x MSAA) -> bloom -> tone mapping -> final pass
// (grain, vignette, chromatic aberration) -> 2D overlay composited after tone mapping.
import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { FinalShader } from './post.js';

export const FORMATS = {
  '16x9': { id: '16x9', label: '16:9 wide', w: 1920, h: 1080, use: 'YouTube, meetings, Slack, presentations' },
  '9x16': { id: '9x16', label: '9:16 vertical', w: 1080, h: 1920, use: 'Reels, TikTok, Stories, Shorts' },
  '1x1': { id: '1x1', label: '1:1 square', w: 1080, h: 1080, use: 'Feed posts, LinkedIn' },
  '4x5': { id: '4x5', label: '4:5 portrait', w: 1080, h: 1350, use: 'Instagram feed' },
};

const TONE = {
  neutral: THREE.NeutralToneMapping,
  aces: THREE.ACESFilmicToneMapping,
  agx: THREE.AgXToneMapping,
};

export class Stage {
  constructor({ canvas, format = '16x9', scale = 1, quality = 'final' } = {}) {
    this.canvas = canvas || document.createElement('canvas');
    this.quality = quality;
    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: false,
      alpha: false,
      preserveDrawingBuffer: true,
      powerPreference: 'high-performance',
    });
    this.renderer.setPixelRatio(1);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.NeutralToneMapping;
    this.renderer.toneMappingExposure = 1;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.VSMShadowMap;

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(35, 16 / 9, 0.1, 400);

    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.envTexture = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    pmrem.dispose();
    this.scene.environment = this.envTexture;

    this.overlay = document.createElement('canvas');
    this.ctx = this.overlay.getContext('2d');
    this.overlayTex = new THREE.CanvasTexture(this.overlay);
    this.overlayTex.colorSpace = THREE.NoColorSpace;
    this.overlayTex.minFilter = THREE.LinearFilter;
    this.overlayTex.magFilter = THREE.LinearFilter;
    this.overlayTex.generateMipmaps = false;

    this.post = { bloom: { strength: 0.35, radius: 0.55, threshold: 0.9 }, grain: 0.03, vignette: 0.25, ca: 0.002, tone: 'neutral', exposure: 1, scanlines: 0, band: 0, vignetteColor: '#000000' };
    this.setFormat(format, scale);
  }

  setFormat(format, scale = this.scale || 1) {
    const f = typeof format === 'string' ? FORMATS[format] : format;
    this.format = f;
    this.scale = scale;
    this.width = f.w;            // design size: scenes and overlay always work in these units
    this.height = f.h;
    this.aspect = f.w / f.h;
    this.pw = Math.max(2, Math.round(f.w * scale));   // pixel size actually rendered
    this.ph = Math.max(2, Math.round(f.h * scale));
    this.renderer.setSize(this.pw, this.ph, false);
    this.camera.aspect = this.aspect;
    this.camera.updateProjectionMatrix();
    this.overlay.width = this.pw;
    this.overlay.height = this.ph;
    this.buildComposer();
  }

  buildComposer() {
    if (this.composer) this.composer.dispose?.();
    const final = this.quality === 'final';
    const rt = new THREE.WebGLRenderTarget(this.pw, this.ph, {
      type: THREE.HalfFloatType,
      samples: final ? 4 : 0,
    });
    this.composer = new EffectComposer(this.renderer, rt);
    this.composer.setPixelRatio(1);
    this.composer.setSize(this.pw, this.ph);
    this.renderPass = new RenderPass(this.scene, this.camera);
    this.composer.addPass(this.renderPass);
    const bloomScale = final ? 0.5 : 0.35;
    this.bloomPass = new UnrealBloomPass(new THREE.Vector2(this.pw * bloomScale, this.ph * bloomScale), 0.35, 0.55, 0.9);
    this.composer.addPass(this.bloomPass);
    this.outputPass = new OutputPass();
    this.composer.addPass(this.outputPass);
    this.finalPass = new ShaderPass(FinalShader);
    this.finalPass.uniforms.tOverlay.value = this.overlayTex;
    this.composer.addPass(this.finalPass);
    this.applyPost(this.post);
  }

  applyPost(post = {}) {
    this.post = { ...this.post, ...post, bloom: { ...this.post.bloom, ...(post.bloom || {}) } };
    const p = this.post;
    this.renderer.toneMapping = TONE[p.tone] ?? THREE.NeutralToneMapping;
    this.renderer.toneMappingExposure = p.exposure;
    if (this.bloomPass) {
      this.bloomPass.strength = p.bloom.strength;
      this.bloomPass.radius = p.bloom.radius;
      this.bloomPass.threshold = p.bloom.threshold;
      this.bloomPass.enabled = p.bloom.strength > 0;
    }
    if (this.finalPass) {
      const u = this.finalPass.uniforms;
      u.uGrain.value = p.grain;
      u.uVignette.value = p.vignette;
      u.uCA.value = p.ca;
      u.uScanlines.value = p.scanlines;
      u.uBand.value = p.band;
      u.uVigColor.value.set(p.vignetteColor);
      u.uRes.value.set(this.pw, this.ph);
    }
  }

  /** Begins a 2D overlay frame. Scenes draw in design units (e.g. 1080x1920). */
  beginOverlay() {
    const c = this.ctx;
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.clearRect(0, 0, this.pw, this.ph);
    c.setTransform(this.pw / this.width, 0, 0, this.ph / this.height, 0, 0);
    return c;
  }

  /** Projects a world position to design-unit screen coordinates. */
  project(v3, out = { x: 0, y: 0, visible: false, depth: 0 }) {
    const v = _v.copy(v3).project(this.camera);
    out.x = (v.x * 0.5 + 0.5) * this.width;
    out.y = (-v.y * 0.5 + 0.5) * this.height;
    out.depth = v.z;
    out.visible = v.z > -1 && v.z < 1;
    return out;
  }

  /** World-units per pixel at a given distance in front of the camera. */
  unitsPerPixel(distance) {
    const vh = 2 * Math.tan(THREE.MathUtils.degToRad(this.camera.fov) / 2) * distance;
    return vh / this.height;
  }

  render(time, { fade = 0, fadeColor = '#ffffff', overlayOn = true } = {}) {
    this.overlayTex.needsUpdate = true;
    const u = this.finalPass.uniforms;
    u.uTime.value = time;
    u.uFade.value = fade;
    u.uFadeColor.value.set(fadeColor);
    u.uOverlayOn.value = overlayOn ? 1 : 0;
    this.composer.render();
  }

  dispose() {
    this.composer?.dispose?.();
    this.renderer.dispose();
    this.envTexture.dispose();
    this.overlayTex.dispose();
  }
}

const _v = new THREE.Vector3();
