// Big message: kinetic typography front and center, words landing one by one, over a slowly
// turning glass object so the frame never sits still.
import * as THREE from 'three';
import { textZone, drawHeader, popIn } from './common.js';
import { clamp, ease, seg } from '../engine/util.js';
import * as M from '../engine/materials.js';

export default {
  type: 'message',
  label: 'Big message',
  description: 'A bold statement that lands word by word.',
  defaults: { dur: 3.6, shot: 'static' },
  editable: [
    { key: 'eyebrow', label: 'Small label above', type: 'text' },
    { key: 'headline', label: 'Message', type: 'text' },
    { key: 'sub', label: 'Supporting line', type: 'text' },
    { key: 'accentWord', label: 'Word to underline in red', type: 'text', data: true },
  ],
  build(ctx) {
    const { scene, group, world, stage } = ctx;
    const portrait = stage.aspect < 0.95;
    const knot = new THREE.Mesh(new THREE.TorusKnotGeometry(1.15, 0.36, 220, 32, 2, 3), world.mats.frame());
    knot.castShadow = true;
    knot.position.set(0, -0.2, -3.2);
    group.add(knot);
    const core = world.orb(0.55, 0, world.mats.accent());
    core.position.copy(knot.position);
    group.add(core);
    return {
      shot: { frame: { w: 7, h: 6 }, layout: 'center', pitch: 3, fov: portrait ? 42 : 34 },
      decorCount: 6,
      update(lt, info) {
        const k = popIn(lt, 0, 1.2);
        const out = ease.inCubic(seg(lt, info.dur - 0.5, 0.55));
        knot.rotation.set(lt * 0.25, lt * 0.35, 0);
        knot.scale.setScalar(Math.max(0.001, k * (1 - out)));
        core.scale.setScalar(Math.max(0.001, k * (1 - out)));
      },
      draw(o, lt, info) {
        const zone = textZone(o, 'center');
        zone.layout = 'center';
        o.scrim(zone.x - zone.w / 2, zone.y, zone.w, zone.h, { alpha: o.theme.scrimAlpha * 0.9 * clamp(seg(lt, 0, 0.5)) * (1 - seg(lt, info.dur - 0.4, 0.4)) });
        drawHeader(o, zone, scene.text, lt, { dur: info.dur, size: (portrait ? 104 : 96) * o.U, maxLines: 4, mode: 'words', inAt: 0.1, accentWord: scene.data?.accentWord });
      },
    };
  },
};
