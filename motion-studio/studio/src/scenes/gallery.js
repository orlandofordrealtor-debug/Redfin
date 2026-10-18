// Gallery: photos fly in along Bezier arcs, then a cover-flow steps through them so every home
// gets its moment front and center. Captions pin to the featured photo.
import * as THREE from 'three';
import { textZone, drawHeader, bezier, pinLabel, worldPos } from './common.js';
import { clamp, ease, seg, lerp } from '../engine/util.js';

export default {
  type: 'gallery',
  label: 'Photo gallery',
  description: 'Photos fly in, then step through one by one with captions.',
  defaults: { dur: 6, shot: 'push' },
  editable: [
    { key: 'eyebrow', label: 'Small label above', type: 'text' },
    { key: 'headline', label: 'Headline', type: 'text' },
    { key: 'sub', label: 'Supporting line', type: 'text' },
  ],
  build(ctx) {
    const { scene, group, world, stage, assets } = ctx;
    const portrait = stage.aspect < 0.95;
    const layout = 'stack';
    const from = scene.data?.from ?? 0;
    const count = scene.data?.count ?? assets.photos.length;
    const photos = assets.photos.slice(from, from + count);
    const n = Math.max(1, photos.length);
    // Tall images (posters, graphics, phone shots) get portrait cards at their own aspect ratio
    const ratios = photos.map(p => (p.img?.height || 2) / (p.img?.width || 3)).sort((a, b) => a - b);
    const median = ratios.length ? ratios[Math.floor(ratios.length / 2)] : 0.66;
    const tall = median > 1.15;
    const cw = tall ? (portrait ? 3.0 : 2.5) : (portrait ? 3.6 : 3.8);
    const ch = tall ? cw * Math.min(1.85, median) : cw / 1.5;
    const flow = n > 3 || (portrait && n > 1);
    const cards = photos.map(p => {
      const c = world.card({ w: cw, h: ch, image: p.img, depth: 0.1, radius: 0.16, bezel: 0.08, focusY: tall ? 0.3 : 0.45 });
      c.userData.caption = p.caption;
      c.userData.sub = p.sub;
      group.add(c);
      return c;
    });

    // Focus index over time: hold on each photo, then glide to the next
    const focusAt = (lt, dur) => {
      if (n <= 1) return 0;
      const start = 1.1, end = dur - 0.7;
      const span = Math.max(0.1, end - start);
      const x = clamp((lt - start) / span) * (n - 1);
      const i = Math.floor(x), f = x - i;
      const moveShare = 0.42;  // fraction of each step spent moving
      const m = f < 1 - moveShare ? 0 : ease.inOutCubic((f - (1 - moveShare)) / moveShare);
      return Math.min(n - 1, i + m);
    };

    const slot = (i, f) => {
      if (!flow) {
        const spread = cw + 0.45;
        return { pos: new THREE.Vector3((i - (n - 1) / 2) * spread, 0, -Math.abs(i - (n - 1) / 2) * 0.35), rotY: (i - (n - 1) / 2) * -0.1, weight: 1 };
      }
      const d = i - f;
      const ad = Math.abs(d), sd = Math.sign(d);
      const near = cw * (portrait ? 0.62 : tall ? 0.95 : 0.72);
      const x = ad < 1 ? d * near : sd * (near + (ad - 1) * cw * 0.3);
      const z = -Math.min(ad, 2.4) * 1.25;
      const rotY = -clamp(d, -1, 1) * 0.85;
      return { pos: new THREE.Vector3(x, 0, z), rotY, weight: clamp(1 - (ad - 2) * 0.8) };
    };

    const frameW = flow ? (portrait ? cw * 1.18 : cw * (tall ? 3.2 : 2.5)) : n * (cw + 0.45);
    const frameH = ch + (portrait ? 0.7 : tall ? 0.5 : 1.1);
    const tmp = new THREE.Vector3();
    let featured = 0;

    return {
      shot: { frame: { w: frameW, h: frameH }, layout, pitch: 4, fov: portrait ? 40 : 32 },
      cues: cards.map((_, i) => ({ t: 0.2 + i * 0.1, type: 'tick' })),
      update(lt, info) {
        const out = ease.inCubic(seg(lt, info.dur - 0.5, 0.55));
        const f = focusAt(lt, info.dur);
        featured = Math.round(f);
        cards.forEach((c, i) => {
          const s = slot(i, f);
          const k = ease.outCubic(seg(lt, 0.1 + i * 0.09, 0.95));
          const start = new THREE.Vector3(s.pos.x * 0.4 + (i % 2 ? 5 : -5), -6, 5);
          const ctrl = new THREE.Vector3(s.pos.x * 0.7, 3.4, 2.5);
          bezier(start, ctrl, s.pos, k, tmp);
          c.position.copy(tmp);
          c.position.y += Math.sin(lt * 0.9 + i) * 0.04 - out * 1.2;
          c.rotation.y = lerp(i % 2 ? -1.2 : 1.2, s.rotY, k);
          c.rotation.x = (1 - k) * 0.6;
          const vis = clamp(seg(lt, 0.1 + i * 0.09, 0.25)) * (1 - out) * s.weight;
          c.userData.setOpacity(vis);
          c.visible = vis > 0.01;
        });
      },
      draw(o, lt, info) {
        const zone = textZone(o, layout);
        zone.layout = layout;
        drawHeader(o, zone, scene.text, lt, { dur: info.dur, size: portrait ? 80 * o.U : 72 * o.U, maxLines: 2 });
        const c = cards[featured];
        if (c && (c.userData.caption || c.userData.sub)) {
          const f = focusAt(lt, info.dur);
          const settle = 1 - clamp(Math.abs(f - featured) * 3);
          const a = clamp(seg(lt, 1.0, 0.4)) * (1 - seg(lt, info.dur - 0.6, 0.4)) * settle;
          const p = worldPos(c, new THREE.Vector3(0, -ch / 2 - 0.1, 0.3));
          pinLabel(o, stage, p, c.userData.caption, { alpha: a, size: 24, dy: 14 });
          if (c.userData.sub) pinLabel(o, stage, p, c.userData.sub, { alpha: a, size: 20, dy: 72, bg: 'rgba(255,255,255,0.94)', color: '#111111' });
        }
        if (n > 1) {
          // progress dots
          const y = o.H - o.safe.bottom - 10 * o.U;
          const gap = 26 * o.U;
          const x0 = o.W / 2 - ((n - 1) * gap) / 2;
          const a = clamp(seg(lt, 0.8, 0.4)) * (1 - seg(lt, info.dur - 0.5, 0.4));
          for (let i = 0; i < n; i++) {
            o.ctx.save();
            o.ctx.globalAlpha = a * (i === featured ? 1 : 0.35);
            o.ctx.fillStyle = i === featured ? o.theme.accent : o.theme.text;
            o.ctx.beginPath();
            o.ctx.arc(x0 + i * gap, y, (i === featured ? 7 : 5) * o.U, 0, Math.PI * 2);
            o.ctx.fill();
            o.ctx.restore();
          }
        }
      },
    };
  },
};
