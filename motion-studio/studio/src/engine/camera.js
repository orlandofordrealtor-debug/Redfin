// Camera choreography: every scene owns a "shot" (a function of scene progress),
// and the rig blends shot to shot with an eased, slightly arcing move plus a gentle drift.
import * as THREE from 'three';
import { ease, lerp, noise1, clamp } from './util.js';

const DEG = Math.PI / 180;

/** Distance at which a w x h box fills the frame for this fov/aspect. */
export function fitDistance(w, h, fovDeg, aspect, margin = 1.08) {
  const t = Math.tan((fovDeg * DEG) / 2);
  return Math.max(h / (2 * t), w / (2 * t * aspect)) * margin;
}

export const SHOT_PRESETS = {
  push: { label: 'Push in', help: 'Slowly moves toward the subject. Calm and confident.' },
  pull: { label: 'Pull back', help: 'Starts close and reveals the whole scene.' },
  orbit: { label: 'Orbit', help: 'Circles the subject to show depth.' },
  dolly: { label: 'Dolly', help: 'Glides sideways past the subject.' },
  rise: { label: 'Rise', help: 'Lifts from a low angle up to eye level.' },
  hero: { label: 'Hero', help: 'Low, dramatic angle that slowly pushes in.' },
  static: { label: 'Still', help: 'Holds steady with only a slight breathing motion.' },
};

/**
 * Builds a shot function. anchor is the subject center; dist the base framing distance.
 * Returns k -> { pos, target, fov } for k in 0..1 across the scene.
 */
export function makeShot(preset = 'push', { anchor = new THREE.Vector3(), dist = 10, yaw = 0, pitch = 4, fov = 35, amount = 1, targetOffset = new THREE.Vector3() } = {}) {
  const a = anchor.clone();
  const tgt = a.clone().add(targetOffset);
  return k => {
    const e = ease.inOutSine(clamp(k));
    let d = dist, y = yaw, p = pitch, side = 0, lift = 0;
    switch (preset) {
      case 'push': d = dist * lerp(1.1, 0.96, e); y = yaw + lerp(-2, 2, e) * amount; break;
      case 'pull': d = dist * lerp(0.86, 1.06, e); p = pitch + lerp(2, -1, e) * amount; break;
      case 'orbit': y = yaw + lerp(-16, 16, e) * amount; d = dist * lerp(1.02, 0.98, e); break;
      case 'dolly': side = lerp(-0.05, 0.05, e) * dist * amount; y = yaw + lerp(5, -5, e) * amount; break;
      case 'rise': p = pitch + lerp(-8, 3, e) * amount; d = dist * lerp(1.04, 0.98, e); break;
      case 'hero': p = pitch + lerp(-10, -6, e) * amount; d = dist * lerp(1.0, 0.9, e); y = yaw + lerp(-6, 0, e) * amount; break;
      case 'static': default: d = dist * lerp(1.0, 0.985, e); break;
    }
    const pos = new THREE.Vector3(
      Math.sin(y * DEG) * Math.cos(p * DEG) * d,
      Math.sin(p * DEG) * d + lift,
      Math.cos(y * DEG) * Math.cos(p * DEG) * d,
    ).add(tgt);
    pos.x += side;
    const target = tgt.clone();
    target.x += side * 0.85;
    return { pos, target, fov };
  };
}

/** Blends between scene shots and applies drift. */
export class CameraRig {
  constructor(camera) {
    this.camera = camera;
    this.drift = 1;
    this.seed = 1;
  }

  /**
   * tracks: [{ start, end, shot }] sorted by start. transition: seconds spent moving between shots.
   * style: 'glide' (cubic) or 'whip' (expo, fast in the middle).
   */
  configure(tracks, { transition = 0.9, style = 'glide', drift = 1, seed = 1, arc = 0.12 } = {}) {
    this.tracks = tracks;
    this.transition = transition;
    this.style = style;
    this.drift = drift;
    this.seed = seed;
    this.arc = arc;
  }

  sample(track, t) {
    const k = (t - track.start) / Math.max(0.001, track.end - track.start);
    return track.shot(clamp(k, -0.15, 1.15));
  }

  update(t) {
    const tracks = this.tracks || [];
    if (!tracks.length) return;
    let i = tracks.findIndex(tr => t < tr.end);
    if (i < 0) i = tracks.length - 1;
    const cur = tracks[i];
    let s = this.sample(cur, t);
    const half = this.transition / 2;

    // Blend from the previous shot at the start of this one
    if (i > 0 && t < cur.start + half) {
      const prev = tracks[i - 1];
      const k = clamp((t - (cur.start - half)) / this.transition);
      s = this.blend(this.sample(prev, t), s, k);
    } else if (i < tracks.length - 1 && t > cur.end - half) {
      const next = tracks[i + 1];
      const k = clamp((t - (cur.end - half)) / this.transition);
      s = this.blend(s, this.sample(next, t), k);
    }

    const amp = this.drift;
    if (amp > 0) {
      const n = (o, f) => noise1(t * f + o, this.seed);
      s.pos.x += n(0, 0.23) * 0.06 * amp;
      s.pos.y += n(11, 0.19) * 0.05 * amp;
      s.target.x += n(23, 0.17) * 0.03 * amp;
      s.target.y += n(31, 0.21) * 0.03 * amp;
    }

    this.camera.position.copy(s.pos);
    if (this.camera.fov !== s.fov) { this.camera.fov = s.fov; this.camera.updateProjectionMatrix(); }
    this.camera.lookAt(s.target);
  }

  blend(a, b, k) {
    const e = this.style === 'whip' ? ease.inOutExpo(k) : ease.inOutCubic(k);
    const pos = a.pos.clone().lerp(b.pos, e);
    const dist = a.pos.distanceTo(b.pos);
    pos.z += Math.sin(Math.PI * e) * dist * this.arc;   // arc outward so moves never clip through props
    pos.y += Math.sin(Math.PI * e) * dist * this.arc * 0.35;
    return { pos, target: a.target.clone().lerp(b.target, e), fov: lerp(a.fov, b.fov, e) };
  }
}
