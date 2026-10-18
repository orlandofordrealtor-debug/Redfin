// Milestones: glowing markers along a path, each with its year or step label. Good for career
// journeys, transaction timelines (offer -> escrow -> close) and process roadmaps.
import * as THREE from 'three';
import { textZone, drawHeader, worldPos } from './common.js';
import { clamp, ease, seg } from '../engine/util.js';
import * as M from '../engine/materials.js';

export default {
  type: 'timeline',
  label: 'Milestones',
  description: 'Markers along a glowing path: a career journey or a transaction timeline.',
  defaults: { dur: 6, shot: 'dolly' },
  editable: [
    { key: 'eyebrow', label: 'Small label above', type: 'text' },
    { key: 'headline', label: 'Headline', type: 'text' },
    { key: 'sub', label: 'Supporting line', type: 'text' },
  ],
  build(ctx) {
    const { scene, group, world, stage, palette } = ctx;
    const portrait = stage.aspect < 0.95;
    const items = (scene.data?.items || []).filter(i => i && (i.label || i.title)).slice(0, 6);
    const n = Math.max(2, items.length);
    const span = portrait ? 4.2 : 8;
    const pts = [];
    const nodes = items.map((it, i) => {
      const f = items.length === 1 ? 0.5 : i / (items.length - 1);
      const p = portrait
        ? new THREE.Vector3(Math.sin(f * Math.PI * 1.5) * 1.1, (0.5 - f) * span, 0)
        : new THREE.Vector3((f - 0.5) * span, Math.sin(f * Math.PI * 2) * 0.5, 0);
      pts.push(p.clone());
      const node = world.orb(0.22, i, i === items.length - 1 ? world.mats.accent() : world.mats.decor(1));
      node.position.copy(p);
      group.add(node);
      const halo = world.ring(0.38, 0.015, M.glow(palette.accent, 2));
      halo.position.copy(p);
      group.add(halo);
      return { node, halo, it, f };
    });
    if (pts.length < 2) { pts.push(new THREE.Vector3(-1, 0, 0), new THREE.Vector3(1, 0, 0)); }
    const tr = world.trail(pts.map(p => p.clone().add(new THREE.Vector3(0, 0, -0.05))), { radius: 0.03, segments: 160 });
    group.add(tr.mesh);
    const layout = portrait ? 'split' : 'stack';
    const growDur = Math.max(1.2, scene.dur - 2.2);
    return {
      shot: { frame: { w: portrait ? 3.6 : span + 1.6, h: portrait ? span + 1 : 2.6 }, layout: portrait ? 'stackBottom' : 'stack', pitch: 4, fov: portrait ? 40 : 32 },
      cues: nodes.map(nd => ({ t: 0.6 + nd.f * growDur, type: 'pop' })),
      update(lt, info) {
        const k = ease.inOutSine(seg(lt, 0.5, growDur));
        const out = ease.inCubic(seg(lt, info.dur - 0.45, 0.5));
        tr.set(Math.max(0.001, k) * (1 - out), lt);
        nodes.forEach(nd => {
          const nk = ease.outBack(seg(lt, 0.5 + nd.f * growDur, 0.5)) * (1 - out);
          nd.node.scale.setScalar(Math.max(0.001, nk));
          nd.halo.scale.setScalar(Math.max(0.001, nk * (1 + Math.sin(lt * 3 + nd.f * 6) * 0.06)));
        });
      },
      draw(o, lt, info) {
        const zone = textZone(o, portrait ? 'stack' : 'stack');
        zone.layout = 'stack';
        if (!portrait) drawHeader(o, zone, scene.text, lt, { dur: info.dur, size: 64 * o.U, maxLines: 2 });
        else drawHeader(o, { ...textZone(o, 'stackBottom'), layout: 'stackBottom' }, scene.text, lt, { dur: info.dur, size: 64 * o.U, maxLines: 2 });
        nodes.forEach((nd, i) => {
          const a = clamp(ease.outCubic(seg(lt, 0.6 + nd.f * growDur, 0.5))) * (1 - seg(lt, info.dur - 0.45, 0.4));
          if (a <= 0) return;
          const p = stage.project(worldPos(nd.node));
          const above = portrait ? false : i % 2 === 0;
          const tx = portrait ? p.x + 46 * o.U : p.x;
          const ty = portrait ? p.y : p.y + (above ? -60 : 70) * o.U;
          const align = portrait ? 'left' : 'center';
          o.text(String(nd.it.label || ''), tx, ty, { size: 36 * o.U, weight: 800, align, color: i === nodes.length - 1 ? o.theme.accent : o.theme.text, alpha: a });
          if (nd.it.title) o.text(nd.it.title, tx, ty + 36 * o.U, { size: 24 * o.U, weight: 600, family: 'body', align, color: o.theme.sub, alpha: a });
        });
      },
    };
  },
};
