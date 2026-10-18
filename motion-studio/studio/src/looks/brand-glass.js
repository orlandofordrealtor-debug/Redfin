// Redfin Glass: the house look. Glass Studio's bright, frosted panes and glossy spheres meet
// Glass Explainer's flying camera and connecting light trail, in Redfin red, ink and warm white.
import * as THREE from 'three';
import { BaseWorld } from '../engine/world.js';
import * as M from '../engine/materials.js';
import { BRAND } from '../engine/brand.js';
import { rng, noise1, clamp, ease } from '../engine/util.js';

export function brandGlassPalette(variant = 'light') {
  if (variant === 'night') {
    return {
      dark: true,
      bgTop: '#17161B', bgBottom: '#070709',
      blobs: [
        { dir: [-0.7, 0.45, -0.6], color: '#7A1220', size: 0.55 },
        { dir: [0.75, 0.3, -0.5], color: '#5A2A2E', size: 0.5 },
        { dir: [0.0, -0.2, -1], color: '#2A2730', size: 0.6 },
        { dir: [-0.3, 0.9, 0.2], color: '#3B1218', size: 0.5 },
      ],
      text: '#FFFFFF', sub: 'rgba(255,255,255,0.72)', accent: BRAND.red, accent2: '#FF8A7A', accentText: '#FFFFFF',
      ink: '#F4F1EE', glassTint: '#ffffff', decor: [BRAND.red, '#F4F1EE', '#2A2A30', '#FF8A7A'],
      glow: BRAND.redGlow, line: 'rgba(255,255,255,0.25)', floorLine: '#ffffff', shadow: 0.4,
      scrim: '#0B0B0D', scrimAlpha: 0.45, fade: '#070709', logo: 'taglineReversed',
    };
  }
  return {
    dark: false,
    bgTop: '#FFFFFF', bgBottom: '#ECE7E1',
    blobs: [
      { dir: [-0.8, 0.35, -0.5], color: '#F6C9C9', size: 0.5 },
      { dir: [0.8, 0.5, -0.4], color: '#F3DCCF', size: 0.55 },
      { dir: [0.1, -0.1, -1], color: '#E9E4F0', size: 0.5 },
    ],
    text: BRAND.ink, sub: '#4A4E57', accent: BRAND.red, accent2: '#E8A33D', accentText: '#FFFFFF',
    ink: BRAND.ink, glassTint: '#ffffff', decor: [BRAND.red, '#FFFFFF', '#D9D3CC', '#1C1D21'],
    glow: BRAND.redGlow, line: 'rgba(17,17,17,0.14)', floorLine: '#B9AFA6', shadow: 0.16,
    scrim: '#FFFFFF', scrimAlpha: 0.55, fade: '#F7F5F2', logo: 'tagline',
  };
}

export class GlassWorld extends BaseWorld {
  constructor(ctx, variant = 'light') {
    super(ctx);
    this.variant = variant;
    this.style = 'glass';
    this.floorY = -2.6;
  }

  materials() {
    const p = this.palette;
    const night = this.variant === 'night';
    return {
      frame: () => M.glass({ tint: night ? '#ffffff' : '#F3EFEC', roughness: night ? 0.22 : 0.26, thickness: 0.6, transmission: night ? 1 : 0.94, env: night ? 0.9 : 1.0 }),
      panel: () => M.glass({ tint: night ? '#ffffff' : '#F1EDEA', roughness: night ? 0.3 : 0.34, thickness: 0.5, transmission: night ? 1 : 0.93, env: night ? 0.8 : 0.95 }),
      accent: () => M.satin(p.accent, { clearcoat: 1, roughness: 0.22, edgeColor: '#ffffff' }),
      glyph: () => M.satin(p.accent, { clearcoat: 1, roughness: 0.18, edgeColor: '#ffffff', rim: 0.25 }),
      decor: i => {
        const cols = p.decor;
        const c = cols[i % cols.length];
        if (i % 4 === 2) return M.glass({ tint: '#ffffff', roughness: 0.08, thickness: 1.2, ior: 1.5, env: 1.2, dispersion: 0.2 });
        return M.satin(c, { clearcoat: 1, roughness: c === '#FFFFFF' ? 0.2 : 0.16 });
      },
      ink: () => M.satin(night ? '#F4F1EE' : BRAND.ink, { roughness: 0.3, clearcoat: 0.8 }),
      muted: () => M.satin(night ? '#3A3940' : '#D6CFC8', { roughness: 0.32, clearcoat: 0.7 }),
      glow: () => M.glow(p.glow, 2.6),
      line: () => M.flowMaterial({ color: p.accent, head: '#ffffff' }),
    };
  }

  environment() {
    const p = this.palette;
    const night = this.variant === 'night';
    this.dome = new THREE.Mesh(new THREE.SphereGeometry(150, 48, 24), M.domeMaterial({ top: p.bgTop, bottom: p.bgBottom, blobs: p.blobs, noise: 0.012 }));
    this.dome.renderOrder = -10;
    this.stage.scene.add(this.dome);
    this.addLights(night
      ? { hemiSky: '#ffffff', hemiGround: '#2a2228', hemi: 0.3, key: 1.9, fill: 0.8, fillColor: '#ff9a9a' }
      : { hemiSky: '#ffffff', hemiGround: '#d8cec6', hemi: 0.55, key: 1.7, fill: 0.35, fillColor: '#dbe6ff' });
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(220, 220), M.shadowFloor(p.shadow));
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = this.floorY;
    floor.receiveShadow = true;
    this.env.add(floor);
    const grid = new THREE.Mesh(new THREE.PlaneGeometry(90, 90), M.lineGridMaterial({ color: p.floorLine, spacing: 1.6, width: 1, fade: 38, opacity: night ? 0.16 : 0.22 }));
    grid.rotation.x = -Math.PI / 2;
    grid.position.y = this.floorY + 0.002;
    this.env.add(grid);
  }

  /** Floating spheres around every scene anchor plus one light trail threading all scenes. */
  onTimeline(scenes, duration) {
    const r = rng(this.ctx.seed || 5);
    this.decor = [];
    const wide = this.ctx.stage.aspect >= 0.95;
    scenes.forEach((s, si) => {
      if (s.inst.noDecor) return;
      const n = s.inst.decorCount ?? 5;
      // Split layouts keep text on the left, so their orbs gather on the content side and behind it
      const split = wide && s.inst.shot?.layout === 'split';
      for (let i = 0; i < n; i++) {
        const side = i % 2 ? 1 : -1;
        const rad = r.range(0.28, 0.75) * (i === 0 ? 1.5 : 1);
        const mesh = this.orb(rad, i + si);
        const x = r.range(4.2, 8.5), y = r.range(-1.6, 3.4), z = r.range(-7, -1.5);
        const base = (split
          ? new THREE.Vector3(side > 0 ? x - 1 : (x - 4.2) * 0.9, y, side > 0 ? z : z - 3)
          : new THREE.Vector3(side * x, y, z)).add(s.anchor);
        mesh.position.copy(base);
        this.root.add(mesh);
        this.decor.push({ mesh, base, phase: r() * 10, amp: r.range(0.15, 0.4), scene: s });
      }
    });
    // light trail: below and behind content, through every anchor
    if (scenes.length > 1) {
      const pts = [];
      // a glowing path that snakes along the floor behind every scene
      scenes.forEach((s, i) => {
        const a = s.anchor;
        const y = this.floorY + 0.06;
        pts.push(new THREE.Vector3(a.x - this.spacing * 0.36, y, a.z - 1.5));
        pts.push(new THREE.Vector3(a.x - 3, y, a.z - 4.5 - (i % 2) * 1.5));
        pts.push(new THREE.Vector3(a.x + 3, y, a.z - 5.5 + (i % 2) * 1.5));
        pts.push(new THREE.Vector3(a.x + this.spacing * 0.36, y, a.z - 1.5));
      });
      this.trailObj = this.trail(pts, { radius: 0.04, segments: 80 * scenes.length });
      this.root.add(this.trailObj.mesh);
    }
    this.duration = duration;
  }

  update(t) {
    super.update(t);
    for (const d of this.decor || []) {
      d.mesh.position.y = d.base.y + Math.sin(t * 0.7 + d.phase) * d.amp;
      d.mesh.position.x = d.base.x + noise1(t * 0.25 + d.phase, 3) * 0.25;
    }
    if (this.trailObj) this.trailObj.set(clamp(0.04 + (t / Math.max(1, this.duration)) * 0.98), t);
    // Keep the shadow camera on the action
    if (this.keyLight) {
      this.keyLight.target.position.set(0, 0, 0);
      this.keyLight.position.set(6, 12, 9);
    }
  }
}

const post = {
  bloom: { strength: 0.45, radius: 0.55, threshold: 1.3 },
  grain: 0.022, vignette: 0.18, ca: 0.0018, tone: 'neutral', exposure: 0.96, vignetteColor: '#3a3330',
};

export default {
  id: 'brand-glass',
  name: 'Redfin Glass',
  family: 'Signature',
  description: 'The house look. Bright studio, frosted glass, glossy Redfin red, and a light trail that threads every scene.',
  bestFor: 'Celebrations, listings, team wins, anything client-facing',
  swatch: ['#FFFFFF', '#ECE7E1', '#DE3341', '#111111'],
  native: 'brand',
  post,
  transition: { style: 'whip', duration: 0.9 },
  drift: 1,
  palette: () => brandGlassPalette('light'),
  overlayTheme: p => ({
    text: p.text, sub: p.sub, accent: p.accent, accentText: '#ffffff', scrim: p.scrim, scrimAlpha: p.scrimAlpha,
    chipBg: p.accent, chipText: '#ffffff', panel: 'rgba(255,255,255,0.84)', panelStroke: 'rgba(255,255,255,0.95)', dark: false,
  }),
  create: ctx => new GlassWorld(ctx, 'light'),
};

export const brandGlassNight = {
  id: 'brand-night',
  name: 'Redfin Night',
  family: 'Signature',
  description: 'The house look after dark. Charcoal space, warm red glow, frosted glass and a glowing trail.',
  bestFor: 'Meeting openers, recruiting, big announcements, evening events',
  swatch: ['#17161B', '#070709', '#DE3341', '#F4F1EE'],
  native: 'brand',
  post: { ...post, bloom: { strength: 0.6, radius: 0.6, threshold: 0.95 }, vignette: 0.32, grain: 0.03, ca: 0.0024, exposure: 1.0, vignetteColor: '#000000' },
  transition: { style: 'whip', duration: 0.9 },
  drift: 1,
  palette: () => brandGlassPalette('night'),
  overlayTheme: p => ({
    text: p.text, sub: p.sub, accent: p.accent, accentText: '#ffffff', scrim: p.scrim, scrimAlpha: p.scrimAlpha,
    chipBg: p.accent, chipText: '#ffffff', panel: 'rgba(24,23,28,0.78)', panelStroke: 'rgba(255,255,255,0.18)', dark: true,
  }),
  create: ctx => new GlassWorld(ctx, 'night'),
};
