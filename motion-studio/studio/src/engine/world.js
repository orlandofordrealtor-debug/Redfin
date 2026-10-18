// BaseWorld: the shared 3D vocabulary every look builds on. Scenes only talk to these
// factories, so any story renders in any look (glass cards in Brand Glass, clay cards in Clay...).
import * as THREE from 'three';
import { slab, roundedPlane, textGeometry, logoMesh } from './geo.js';
import * as M from './materials.js';
import { rng, ease, clamp, seg, lerp } from './util.js';

const _c = new THREE.Color();

export class BaseWorld {
  constructor(ctx) {
    this.ctx = ctx;
    this.stage = ctx.stage;
    this.palette = ctx.palette;
    this.rand = rng(ctx.seed || 7);
    this.root = new THREE.Group();
    this.stage.scene.add(this.root);
    this.env = new THREE.Group();          // backdrop, floor and lights follow the focus point
    this.root.add(this.env);
    this.focusPoint = new THREE.Vector3();
    this.disposables = [];
    this.updaters = [];
    this.spacing = 60;
    this.style = 'glass';                   // material family: glass | clay | holo | luxe | paper
  }

  /** Called once after construction. Looks override environment() and materials(). */
  init() {
    this.mats = this.materials();
    this.environment();
    return this;
  }

  // ---------- defaults (looks override) ----------
  materials() {
    const p = this.palette;
    return {
      frame: () => M.glass({ tint: p.glassTint || '#ffffff', roughness: 0.3, thickness: 0.5 }),
      panel: () => M.glass({ tint: p.glassTint || '#ffffff', roughness: 0.38, thickness: 0.4 }),
      accent: () => M.satin(p.accent),
      glyph: () => M.satin(p.accent, { clearcoat: 1, roughness: 0.25 }),
      decor: i => M.satin((p.decor || [p.accent])[i % (p.decor || [p.accent]).length], { roughness: 0.3 }),
      muted: () => M.satin(p.muted || '#CFC8C1', { roughness: 0.35 }),
      ink: () => M.satin(p.ink || '#111111', { roughness: 0.4 }),
      glow: () => M.glow(p.glow || p.accent, 3),
      line: () => M.flowMaterial({ color: p.accent, head: '#ffffff' }),
    };
  }

  environment() {
    const p = this.palette;
    const dome = new THREE.Mesh(new THREE.SphereGeometry(150, 48, 24), M.domeMaterial({ top: p.bgTop || '#ffffff', bottom: p.bgBottom || '#ecebe8', blobs: p.blobs || [] }));
    dome.renderOrder = -10;
    this.dome = dome;
    this.stage.scene.add(dome);               // the dome follows the camera, so it is not under env
    this.addLights();
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(200, 200), M.shadowFloor(p.shadow ?? 0.16));
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = this.floorY ?? -3.2;
    floor.receiveShadow = true;
    this.env.add(floor);
    this.floor = floor;
  }

  addLights({ hemiSky = '#ffffff', hemiGround = '#d9d3cc', hemi = 0.9, key = 2.4, keyColor = '#ffffff', fill = 0.6, fillColor = '#cfe0ff', shadowRadius = 8 } = {}) {
    const hemiL = new THREE.HemisphereLight(hemiSky, hemiGround, hemi);
    this.env.add(hemiL);
    const keyL = new THREE.DirectionalLight(keyColor, key);
    keyL.position.set(6, 12, 9);
    keyL.castShadow = true;
    keyL.shadow.mapSize.set(2048, 2048);
    keyL.shadow.radius = shadowRadius;
    keyL.shadow.blurSamples = 16;
    keyL.shadow.bias = -0.0004;
    const sc = keyL.shadow.camera;
    sc.left = -16; sc.right = 16; sc.top = 16; sc.bottom = -16; sc.near = 0.5; sc.far = 60;
    this.env.add(keyL);
    this.env.add(keyL.target);
    const fillL = new THREE.DirectionalLight(fillColor, fill);
    fillL.position.set(-8, 4, 6);
    this.env.add(fillL);
    this.keyLight = keyL;
    this.lights = { hemi: hemiL, key: keyL, fill: fillL };
  }

  /** Where scene i lives in the world. */
  anchorFor(i) {
    return new THREE.Vector3(i * this.spacing, 0, (i % 2 ? -1 : 1) * 4);
  }

  /** Keeps environment centred on the active scene. */
  focus(point) {
    this.focusPoint.copy(point);
    this.env.position.set(point.x, 0, point.z);
  }

  update(t) {
    if (this.dome) this.dome.position.copy(this.stage.camera.position);
    for (const fn of this.updaters) fn(t);
  }

  track(obj) { this.disposables.push(obj); return obj; }

  // ---------- factories used by scenes ----------

  /** Image texture cover-cropped to the card's aspect ratio. */
  imageTexture(img, aspect = 1, { maxSide = 1280, focusY = 0.45 } = {}) {
    const c = document.createElement('canvas');
    const w = aspect >= 1 ? maxSide : Math.round(maxSide * aspect);
    const h = aspect >= 1 ? Math.round(maxSide / aspect) : maxSide;
    c.width = w; c.height = h;
    const x = c.getContext('2d');
    if (img) {
      const iw = img.naturalWidth || img.width, ih = img.naturalHeight || img.height;
      const s = Math.max(w / iw, h / ih);
      x.drawImage(img, (w - iw * s) / 2, (h - ih * s) * focusY, iw * s, ih * s);
    } else { x.fillStyle = '#ddd'; x.fillRect(0, 0, w, h); }
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 4;
    this.track(tex);
    return tex;
  }

  /** A photo card: a slab in the look's frame material with the image on its face. */
  card({ w = 3, h = 2, image = null, depth = 0.12, radius = 0.14, bezel = 0.09, focusY = 0.45 } = {}) {
    const g = new THREE.Group();
    const frameMat = this.mats.frame();
    const body = new THREE.Mesh(slab(w, h, depth, radius), frameMat);
    body.castShadow = true;
    g.add(body);
    const tex = this.imageTexture(image, (w - bezel * 2) / (h - bezel * 2), { focusY });
    // Photos stay unlit so their colors read true; the glass frame carries the lighting
    const faceMat = new THREE.MeshBasicMaterial({ map: tex, color: new THREE.Color(0.94, 0.94, 0.94), transparent: true });
    const face = new THREE.Mesh(roundedPlane(w - bezel * 2, h - bezel * 2, Math.max(0.02, radius - bezel * 0.6)), faceMat);
    face.position.z = depth / 2 + 0.004;
    g.add(face);
    g.userData = { body, face, w, h, frameMat, faceMat };
    g.userData.setOpacity = a => { faceMat.opacity = a; setMatOpacity(frameMat, a); };
    g.userData.setDissolve = d => { if (frameMat.userData.u) frameMat.userData.u.uDissolve.value = d; faceMat.opacity = 1 - ease.inCubic(clamp(d * 1.3)); };
    return g;
  }

  /**
   * A panel with a live 2D canvas face. draw(ctx, w, h) paints the face; call redraw() when it changes.
   */
  panel({ w = 4, h = 2.4, depth = 0.1, radius = 0.16, res = 900, draw = null, bezel = 0.0, faceOpacity = 1 } = {}) {
    const g = new THREE.Group();
    const bodyMat = this.mats.panel();
    const body = new THREE.Mesh(slab(w, h, depth, radius), bodyMat);
    body.castShadow = true;
    g.add(body);
    const cw = Math.round(res), ch = Math.round(res * (h / w));
    const canvas = document.createElement('canvas');
    canvas.width = cw; canvas.height = ch;
    const cx = canvas.getContext('2d');
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 4;
    this.track(tex);
    const faceMat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, opacity: faceOpacity, depthWrite: false });
    const face = new THREE.Mesh(roundedPlane(w - bezel * 2, h - bezel * 2, radius), faceMat);
    face.position.z = depth / 2 + 0.006;
    g.add(face);
    const redraw = (...args) => { cx.clearRect(0, 0, cw, ch); if (draw) draw(cx, cw, ch, ...args); tex.needsUpdate = true; };
    redraw();
    g.userData = { body, face, bodyMat, faceMat, redraw, canvas, ctx: cx, w, h };
    g.userData.setOpacity = a => { faceMat.opacity = a * faceOpacity; setMatOpacity(bodyMat, a); };
    return g;
  }

  /** Extruded display type, e.g. "11" or "SOLD". */
  glyphs(text, { size = 2, depth = 0.5, bevel = 0.05, material = null } = {}) {
    const { geometry, width } = textGeometry(text, { size, depth, bevel });
    const mesh = new THREE.Mesh(geometry, material || this.mats.glyph());
    mesh.castShadow = true;
    mesh.userData.width = width;
    return mesh;
  }

  /** The official Redfin mark extruded in 3D. key: 'redfin' (red wordmark) or 'tagline'. */
  logo3d(key = 'redfin', { height = 1, depth = 0.14, material = null, symbolOnly = false } = {}) {
    const red = material || this.mats.accent();
    const ink = this.mats.ink();
    return logoMesh(key, { height, depth, paths: symbolOnly ? [0] : null, maxX: symbolOnly ? 400 : null, materials: { '#de3341': red, '#111111': ink, '#ffffff': M.satin('#ffffff'), default: red } });
  }

  orb(r = 0.5, colorIndex = 0, material = null) {
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(r, 48, 32), material || this.mats.decor(colorIndex));
    mesh.castShadow = true;
    return mesh;
  }

  ring(r = 1, tube = 0.04, material = null) {
    const mesh = new THREE.Mesh(new THREE.TorusGeometry(r, tube, 24, 128), material || this.mats.glow());
    return mesh;
  }

  /** Instanced confetti that bursts at t0 and falls under gravity. */
  confetti({ count = 260, colors = null, origin = new THREE.Vector3(0, 2, 0), spread = 6, seed = 3, size = 0.12 } = {}) {
    const r = rng(seed);
    const geo = new THREE.PlaneGeometry(size, size * 0.55);
    const mat = new THREE.MeshStandardMaterial({ side: THREE.DoubleSide, roughness: 0.45, metalness: 0.2, vertexColors: false });
    const mesh = new THREE.InstancedMesh(geo, mat, count);
    const cols = colors || [this.palette.accent, '#ffffff', this.palette.accent2 || '#E8A33D', '#111111'];
    const parts = [];
    for (let i = 0; i < count; i++) {
      mesh.setColorAt(i, _c.set(cols[i % cols.length]));
      const a = r() * Math.PI * 2, el = r() * 0.9 + 0.3;
      const speed = r.range(4, 9);
      parts.push({
        v: new THREE.Vector3(Math.cos(a) * Math.cos(el) * speed * (spread / 6), Math.sin(el) * speed * 1.2, Math.sin(a) * Math.cos(el) * speed * 0.6),
        spin: new THREE.Vector3(r.range(-8, 8), r.range(-8, 8), r.range(-8, 8)),
        delay: r() * 0.25,
        flutter: r.range(0.5, 1.5),
      });
    }
    mesh.instanceColor.needsUpdate = true;
    mesh.frustumCulled = false;
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), p = new THREE.Vector3(), s = new THREE.Vector3();
    const update = (t, t0) => {
      for (let i = 0; i < count; i++) {
        const P = parts[i];
        const tt = Math.max(0, t - t0 - P.delay);
        const drag = 1 - Math.exp(-tt * 1.6);
        p.set(
          origin.x + P.v.x * drag / 1.6 + Math.sin(tt * 3 * P.flutter + i) * 0.15 * tt,
          origin.y + P.v.y * drag / 1.6 - 1.4 * tt * tt * 0.5 * 1.6,
          origin.z + P.v.z * drag / 1.6,
        );
        const vis = tt > 0 ? 1 : 0;
        e.set(P.spin.x * tt, P.spin.y * tt, P.spin.z * tt);
        q.setFromEuler(e);
        s.setScalar(vis * (1 - seg(tt, 3.2, 1.2)));
        m4.compose(p, q, s);
        mesh.setMatrixAt(i, m4);
      }
      mesh.instanceMatrix.needsUpdate = true;
    };
    update(-1, 0);
    return { mesh, update };
  }

  /** A glowing tube that draws on along a curve. */
  trail(points, { radius = 0.035, color = null, segments = 200 } = {}) {
    const curve = new THREE.CatmullRomCurve3(points, false, 'catmullrom', 0.4);
    const geo = new THREE.TubeGeometry(curve, segments, radius, 10, false);
    const mat = M.flowMaterial({ color: color || this.palette.accent, head: '#ffffff' });
    const mesh = new THREE.Mesh(geo, mat);
    return { mesh, curve, set: (progress, t) => { mat.uniforms.uProgress.value = progress; mat.uniforms.uTime.value = t; } };
  }

  /** 3D bars (or pillars) that grow to their values. */
  bars(values, { width = 0.6, gap = 0.35, maxHeight = 3, depth = 0.6, material = null, highlight = -1 } = {}) {
    const g = new THREE.Group();
    const max = Math.max(...values.map(v => Math.abs(v)), 1e-6);
    const n = values.length;
    const total = n * width + (n - 1) * gap;
    const meshes = values.map((v, i) => {
      const mat = material ? material(i) : (i === highlight ? this.mats.accent() : (this.mats.muted ? this.mats.muted() : this.mats.decor(i)));
      const m = new THREE.Mesh(slab(width, 1, depth, Math.min(0.08, width * 0.2)), mat);
      m.castShadow = true;
      m.position.x = -total / 2 + width / 2 + i * (width + gap);
      m.userData.target = (Math.abs(v) / max) * maxHeight;
      g.add(m);
      return m;
    });
    const set = (k, stagger = 0.12) => {
      meshes.forEach((m, i) => {
        const kk = ease.outBackSoft(clamp((k - i * stagger) / Math.max(0.2, 1 - stagger * (n - 1))));
        const hgt = Math.max(0.001, m.userData.target * kk);
        m.scale.y = hgt;
        m.position.y = hgt / 2;
      });
    };
    set(0);
    g.userData = { meshes, set, width: total };
    return g;
  }

  dispose() {
    this.stage.scene.remove(this.root);
    if (this.dome) this.stage.scene.remove(this.dome);
    this.root.traverse(o => {
      if (o.geometry) o.geometry.dispose();
      if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => m.dispose());
    });
    this.disposables.forEach(d => d.dispose?.());
  }
}

/** Fades any material: transmission glass fades by thinning, others by opacity. */
export function setMatOpacity(mat, a) {
  if (!mat) return;
  if (mat.transmission > 0) {
    mat.userData.baseTransmission ??= mat.transmission;
    mat.transparent = a < 0.999;
    mat.opacity = a;
    return;
  }
  mat.transparent = a < 0.999 || mat.userData.alwaysTransparent;
  mat.opacity = a;
}

export function setGroupOpacity(group, a) {
  group.traverse(o => {
    if (!o.material) return;
    (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => {
      if (m.uniforms?.uOpacity) m.uniforms.uOpacity.value = a;
      else setMatOpacity(m, a);
    });
  });
  group.visible = a > 0.002;
}
