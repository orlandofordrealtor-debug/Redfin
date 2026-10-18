// Hero title: big headline plus a 3D hero object (extruded number/word or the Redfin mark)
// that materializes through a glowing dissolve, ringed by orbiting halos.
import * as THREE from 'three';
import { textZone, drawHeader, popIn, layoutFor, pinLabel, worldPos } from './common.js';
import { clamp, ease, seg } from '../engine/util.js';
import * as M from '../engine/materials.js';

export default {
  type: 'hero',
  label: 'Title',
  description: 'Big headline with a 3D hero number, word or the Redfin mark.',
  defaults: { dur: 4, shot: 'push' },
  editable: [
    { key: 'eyebrow', label: 'Small label above', type: 'text' },
    { key: 'headline', label: 'Headline', type: 'text' },
    { key: 'sub', label: 'Supporting line', type: 'text' },
    { key: 'glyph', label: '3D number or short word (max 8 characters)', type: 'text', data: true },
    { key: 'glyphLabel', label: 'Label under the 3D object', type: 'text', data: true },
  ],
  build(ctx) {
    const { scene, group, world, stage } = ctx;
    const portrait = stage.aspect < 0.95;
    const layout = scene.data?.layout || layoutFor(stage.aspect, 'split');
    const glyphText = String(scene.data?.glyph ?? '').slice(0, 8).trim();
    const hero = new THREE.Group();
    group.add(hero);

    let obj, objW = 4, objH = 3;
    if (glyphText) {
      const size = glyphText.length <= 2 ? 3.2 : glyphText.length <= 4 ? 2.2 : 1.5;
      obj = world.glyphs(glyphText, { size, depth: size * 0.28, bevel: size * 0.03 });
      objW = obj.userData.width; objH = size;
    } else {
      obj = world.logo3d('redfin', { height: 1.6, depth: 0.3 });
      objW = obj.userData.width; objH = 1.6;
    }
    hero.add(obj);

    // Frosted slab behind the hero object for depth
    const slabMesh = world.panel({ w: objW + 1.6, h: objH + 1.6, depth: 0.12, radius: 0.35, draw: null });
    slabMesh.position.z = -1.1;
    hero.add(slabMesh);

    const ringMat = M.glow(ctx.palette.glow || ctx.palette.accent, 2.4);
    const rings = [0, 1].map(i => {
      const r = world.ring(Math.max(objW, objH) * (0.62 + i * 0.12), 0.022 - i * 0.006, ringMat);
      r.rotation.x = Math.PI / 2 + (i ? 0.35 : -0.25);
      hero.add(r);
      return r;
    });
    const mats = [];
    obj.traverse(m => { if (m.material?.userData?.u) mats.push(m.material); });

    return {
      shot: { frame: { w: objW + 2.2, h: objH + 2.2 }, layout, pitch: 5, fov: portrait ? 40 : 32 },
      cues: [{ t: 0.35, type: 'rise' }],
      update(lt, info) {
        const k = popIn(lt, 0.15, 1.1);
        const d = 1 - ease.outCubic(seg(lt, 0.1, 1.4));
        const out = ease.inCubic(seg(lt, info.dur - 0.5, 0.6));
        mats.forEach(m => { m.userData.u.uDissolve.value = Math.max(d, out); });
        obj.rotation.y = (1 - k) * -0.9 + Math.sin(lt * 0.6) * 0.12;
        obj.rotation.x = Math.sin(lt * 0.45) * 0.05;
        obj.position.y = (1 - k) * -1.2 + Math.sin(lt * 0.9) * 0.08;
        slabMesh.scale.setScalar(Math.max(0.001, ease.outCubic(seg(lt, 0, 0.8)) * (1 - out)));
        rings.forEach((r, i) => {
          const rk = ease.outCubic(seg(lt, 0.3 + i * 0.15, 1.2)) * (1 - out);
          r.scale.setScalar(Math.max(0.001, rk));
          r.rotation.z = lt * (i ? -0.35 : 0.25);
        });
      },
      draw(o, lt, info) {
        const zone = textZone(o, layout);
        zone.layout = layout;
        drawHeader(o, zone, scene.text, lt, { dur: info.dur, accentWord: scene.data?.accentWord });
        if (scene.data?.glyphLabel) {
          const a = clamp(seg(lt, 1.0, 0.5)) * (1 - seg(lt, info.dur - 0.5, 0.4));
          pinLabel(o, stage, worldPos(hero, new THREE.Vector3(0, -objH * 0.5 - 0.75, 0.6)), scene.data.glyphLabel.toUpperCase(), { alpha: a, size: 26 });
        }
      },
    };
  },
};
