// Brand intro: the Redfin mark materializes in 3D through a glowing dissolve, then the official
// Redfin Powered by Rocket lockup and the title land.
import * as THREE from 'three';
import { drawHeader } from './common.js';
import { clamp, ease, seg } from '../engine/util.js';
import * as M from '../engine/materials.js';

export default {
  type: 'intro',
  label: 'Brand intro',
  description: 'The Redfin mark builds in 3D, then the lockup and your title.',
  defaults: { dur: 3.6, shot: 'push' },
  editable: [
    { key: 'eyebrow', label: 'Small label above', type: 'text' },
    { key: 'headline', label: 'Title', type: 'text' },
    { key: 'sub', label: 'Supporting line', type: 'text' },
  ],
  build(ctx) {
    const { scene, group, world, stage, logos, palette } = ctx;
    const portrait = stage.aspect < 0.95;
    const mark = world.logo3d('redfin', { height: portrait ? 1.9 : 2.1, depth: 0.5, symbolOnly: true });
    group.add(mark);
    const mats = [];
    mark.traverse(m => { if (m.material?.userData?.u) mats.push(m.material); });
    const ring = world.ring(mark.userData.height * 0.85, 0.022, M.glow(palette.glow || palette.accent, 2.6));
    ring.rotation.x = Math.PI / 2.2;
    group.add(ring);
    const W = mark.userData.width;
    return {
      shot: { frame: { w: Math.max(W, 4) + 1.5, h: 5 }, layout: 'low', pitch: 4, fov: portrait ? 42 : 32, center: new THREE.Vector3(0, -0.5, 0) },
      cues: [{ t: 0.2, type: 'rise' }],
      noDecor: false,
      update(lt, info) {
        const d = 1 - ease.outCubic(seg(lt, 0.1, 1.5));
        const out = ease.inCubic(seg(lt, info.dur - 0.5, 0.55));
        mats.forEach(m => { m.userData.u.uDissolve.value = Math.max(d, out); });
        mark.rotation.y = (1 - ease.outCubic(seg(lt, 0, 1.6))) * 0.8 + Math.sin(lt * 0.5) * 0.05;
        mark.position.y = 0.9 + Math.sin(lt * 0.8) * 0.05;
        ring.scale.setScalar(Math.max(0.001, ease.outCubic(seg(lt, 0.4, 1.2)) * (1 - out)));
        ring.rotation.z = lt * 0.3;
      },
      draw(o, lt, info) {
        const a = clamp(ease.outCubic(seg(lt, 1.1, 0.7))) * (1 - seg(lt, info.dur - 0.45, 0.4));
        const logo = logos[o.theme.dark ? 'taglineReversed' : 'tagline'];
        const lw = (portrait ? 520 : 480) * o.U;
        const top = o.H * (portrait ? 0.58 : 0.6);
        const lh = o.logo(logo, o.W / 2, top, lw, { align: 'center', alpha: a });
        const zone = { x: o.W / 2, y: top + lh + 40 * o.U, w: o.safe.w * 0.9, h: o.H * 0.2, align: 'center', layout: 'center' };
        if (scene.text?.headline || scene.text?.eyebrow) drawHeader(o, zone, scene.text, lt, { dur: info.dur, inAt: 1.4, size: (portrait ? 64 : 58) * o.U, maxLines: 2 });
      },
    };
  },
};
