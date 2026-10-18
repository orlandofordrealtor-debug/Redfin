// Screenshot: a dashboard, report or app screen on a large glass card. The camera pushes in while
// corner brackets and numbered callouts point at what matters.
import * as THREE from 'three';
import { textZone, drawHeader, popIn, worldPos } from './common.js';
import { clamp, ease, seg } from '../engine/util.js';

export default {
  type: 'screenshot',
  label: 'Screenshot',
  description: 'A dashboard or report screenshot with callouts that point at the numbers.',
  defaults: { dur: 6, shot: 'push' },
  editable: [
    { key: 'eyebrow', label: 'Small label above', type: 'text' },
    { key: 'headline', label: 'Headline (the takeaway)', type: 'text' },
    { key: 'sub', label: 'Supporting line or source', type: 'text' },
  ],
  build(ctx) {
    const { scene, group, world, stage, assets } = ctx;
    const portrait = stage.aspect < 0.95;
    const d = scene.data || {};
    const img = d.image || assets.screenshot;
    const iw = img?.naturalWidth || 1600, ih = img?.naturalHeight || 1000;
    const aspect = iw / ih;
    const maxW = portrait ? 4.4 : 6.6, maxH = portrait ? 5.2 : 3.9;
    let w = maxW, h = w / aspect;
    if (h > maxH) { h = maxH; w = h * aspect; }
    const card = world.card({ w: w + 0.2, h: h + 0.2, image: img, depth: 0.1, radius: 0.12, bezel: 0.1, focusY: 0.5 });
    group.add(card);
    const callouts = (d.callouts || []).slice(0, 4);
    const layout = 'stack';
    return {
      shot: { frame: { w: w + 0.8, h: h + 0.8 }, layout, pitch: 3, fov: portrait ? 40 : 32 },
      cues: callouts.map((_, i) => ({ t: 1.4 + i * 0.6, type: 'pop' })),
      update(lt, info) {
        const k = popIn(lt, 0.05, 0.9);
        const out = ease.inCubic(seg(lt, info.dur - 0.45, 0.5));
        card.position.y = (1 - k) * -2 - out;
        card.rotation.x = (1 - k) * 0.5;
        card.rotation.y = Math.sin(lt * 0.35) * 0.04;
        card.userData.setOpacity(clamp(seg(lt, 0, 0.3)) * (1 - out));
      },
      draw(o, lt, info) {
        const zone = textZone(o, layout);
        zone.layout = layout;
        drawHeader(o, zone, scene.text, lt, { dur: info.dur, size: (portrait ? 70 : 62) * o.U, maxLines: 2 });
        const fade = 1 - seg(lt, info.dur - 0.5, 0.4);
        const tl = stage.project(worldPos(card, new THREE.Vector3(-w / 2, h / 2, 0.1)));
        const br = stage.project(worldPos(card, new THREE.Vector3(w / 2, -h / 2, 0.1)));
        o.brackets(tl.x - 10 * o.U, tl.y - 10 * o.U, br.x - tl.x + 20 * o.U, br.y - tl.y + 20 * o.U, { k: seg(lt, 0.8, 0.6), alpha: fade, len: 46 * o.U });
        callouts.forEach((c, i) => {
          const t0 = 1.4 + i * 0.6;
          const a = clamp(ease.outCubic(seg(lt, t0, 0.4))) * fade;
          if (a <= 0) return;
          const p = stage.project(worldPos(card, new THREE.Vector3((c.x - 0.5) * w, (0.5 - c.y) * h, 0.12)));
          const r = 26 * o.U * ease.outBack(seg(lt, t0, 0.5));
          o.ctx.save();
          o.ctx.globalAlpha = a;
          o.ctx.beginPath(); o.ctx.arc(p.x, p.y, r + 10 * o.U * (1 + Math.sin(lt * 4 + i) * 0.3), 0, Math.PI * 2);
          o.ctx.fillStyle = o.theme.accent + '33'; o.ctx.fill();
          o.ctx.beginPath(); o.ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
          o.ctx.fillStyle = o.theme.accent; o.ctx.fill();
          o.ctx.restore();
          o.text(String(i + 1), p.x, p.y + 9 * o.U, { size: 26 * o.U, weight: 800, align: 'center', color: '#ffffff', alpha: a });
          if (c.label) {
            const right = c.x < 0.6;
            o.chip(c.label, p.x + (right ? 1 : -1) * 44 * o.U, p.y - 22 * o.U, { align: right ? 'left' : 'right', size: 24 * o.U, family: 'body', tracking: 0, alpha: a, bg: o.theme.dark ? '#ffffff' : '#111111', color: o.theme.dark ? '#111111' : '#ffffff' });
          }
        });
      },
    };
  },
};
