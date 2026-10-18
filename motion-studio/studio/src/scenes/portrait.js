// Spotlight: the person front and center on a glass-framed card, haloed by a glowing ring,
// with name, role and a badge in the type layer.
import * as THREE from 'three';
import { textZone, drawHeader, popIn, pinLabel, worldPos } from './common.js';
import { clamp, ease, seg } from '../engine/util.js';
import * as M from '../engine/materials.js';

export default {
  type: 'portrait',
  label: 'Spotlight',
  description: 'A person front and center with name, role and a badge.',
  defaults: { dur: 4.2, shot: 'orbit' },
  editable: [
    { key: 'eyebrow', label: 'Small label above', type: 'text' },
    { key: 'headline', label: 'Name or headline', type: 'text' },
    { key: 'sub', label: 'Role or supporting line', type: 'text' },
    { key: 'badge', label: 'Badge on the photo', type: 'text', data: true },
  ],
  build(ctx) {
    const { scene, group, world, stage, assets } = ctx;
    const portrait = stage.aspect < 0.95;
    const layout = portrait ? 'stackBottom' : 'split';
    const img = scene.data?.image || assets.headshot;
    const w = 3.2, h = 4;
    const card = world.card({ w, h, image: img, depth: 0.16, radius: 0.24, bezel: 0.12, focusY: 0.25 });
    group.add(card);
    const halo = world.ring(2.85, 0.03, M.glow(ctx.palette.glow || ctx.palette.accent, 2.2));
    halo.position.z = -0.6;
    group.add(halo);
    const halo2 = world.ring(3.25, 0.012, M.glow(ctx.palette.accent, 1.6));
    halo2.position.z = -0.9;
    group.add(halo2);

    return {
      shot: { frame: { w: w + 2.4, h: h + 1.6 }, layout: portrait ? 'stackBottom' : 'split', pitch: 4, fov: portrait ? 40 : 32 },
      cues: [{ t: 0.3, type: 'rise' }],
      update(lt, info) {
        const k = popIn(lt, 0.1, 1.0);
        const out = ease.inCubic(seg(lt, info.dur - 0.45, 0.5));
        card.position.y = (1 - k) * -3 + Math.sin(lt * 0.8) * 0.06 - out * 0.6;
        card.rotation.y = (1 - k) * 0.7 + Math.sin(lt * 0.5) * 0.08;
        card.rotation.z = (1 - k) * -0.12;
        card.userData.setOpacity(clamp(seg(lt, 0, 0.35)) * (1 - out));
        const hk = ease.outCubic(seg(lt, 0.4, 1.2)) * (1 - out);
        halo.scale.setScalar(Math.max(0.001, hk));
        halo2.scale.setScalar(Math.max(0.001, ease.outCubic(seg(lt, 0.6, 1.3)) * (1 - out)));
        halo.rotation.z = lt * 0.2;
      },
      draw(o, lt, info) {
        const zone = textZone(o, layout);
        zone.layout = layout;
        drawHeader(o, zone, scene.text, lt, { dur: info.dur, inAt: 0.45, size: portrait ? 84 * o.U : 88 * o.U, maxLines: 2 });
        if (scene.data?.badge) {
          const a = clamp(seg(lt, 1.1, 0.5)) * (1 - seg(lt, info.dur - 0.5, 0.4));
          pinLabel(o, stage, worldPos(card, new THREE.Vector3(0, h / 2 + 0.05, 0.2)), scene.data.badge.toUpperCase(), { alpha: a, size: 24 });
        }
      },
    };
  },
};
