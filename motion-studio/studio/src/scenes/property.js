// Property: one hero home with its status in big 3D type (SOLD, LISTED, PENDING...),
// price counting up and the key facts as chips.
import * as THREE from 'three';
import { textZone, drawHeader, popIn, pinLabel, worldPos } from './common.js';
import { clamp, ease, seg, parseStat, formatNumber } from '../engine/util.js';

export const STATUS = {
  'just-sold': { word: 'SOLD', chip: 'Just sold' },
  'just-closed': { word: 'CLOSED', chip: 'Just closed' },
  'just-listed': { word: 'LISTED', chip: 'Just listed' },
  'coming-soon': { word: 'SOON', chip: 'Coming soon' },
  'under-contract': { word: 'IN ESCROW', chip: 'Under contract' },
  'pending': { word: 'PENDING', chip: 'Pending' },
  'price-improved': { word: 'NEW PRICE', chip: 'Price improvement' },
  'back-on-market': { word: 'BACK', chip: 'Back on market' },
  'open-house': { word: 'OPEN', chip: 'Open house' },
  'off-market': { word: 'PRIVATE', chip: 'Off-market' },
  'sold-over-asking': { word: 'SOLD', chip: 'Sold over asking' },
  'multiple-offers': { word: 'OFFERS', chip: 'Multiple offers' },
};

export default {
  type: 'property',
  label: 'Property',
  description: 'One home with its status in 3D, price and key facts.',
  defaults: { dur: 5, shot: 'hero' },
  editable: [
    { key: 'eyebrow', label: 'Status label', type: 'text' },
    { key: 'headline', label: 'Address or headline', type: 'text' },
    { key: 'sub', label: 'City or supporting line', type: 'text' },
    { key: 'price', label: 'Price', type: 'text', data: true },
    { key: 'word', label: '3D status word', type: 'text', data: true },
  ],
  build(ctx) {
    const { scene, group, world, stage, assets } = ctx;
    const portrait = stage.aspect < 0.95;
    const d = scene.data || {};
    const img = d.image || assets.photos[d.photoIndex ?? 0]?.img || null;
    const cw = portrait ? 4.2 : 5, ch = cw / 1.5;
    const card = world.card({ w: cw, h: ch, image: img, depth: 0.14, radius: 0.2, bezel: 0.1 });
    group.add(card);
    const word = (d.word || STATUS[d.status]?.word || '').toUpperCase().slice(0, 10);
    let glyph = null, glyphFit = 1;
    if (word) {
      glyph = world.glyphs(word, { size: word.length > 6 ? 0.55 : 0.75, depth: 0.22, bevel: 0.03 });
      // Long words shrink to the card width, and the word never hangs past the card's right edge
      glyphFit = Math.min(1, (cw * 0.88) / glyph.userData.width);
      const gw = glyph.userData.width * glyphFit;
      glyph.position.set(portrait ? 0 : Math.min(cw * 0.12, cw / 2 - 0.35 - gw / 2), ch / 2 + 0.05, 0.6);
      group.add(glyph);
    }
    const mats = [];
    glyph?.traverse(m => { if (m.material?.userData?.u) mats.push(m.material); });
    const price = parseStat(d.price);
    const facts = (d.facts || []).filter(Boolean).slice(0, 4);
    const layout = portrait ? 'stackBottom' : 'split';

    return {
      shot: { frame: { w: cw + 1.4, h: ch + 2.2 }, layout, pitch: 6, fov: portrait ? 40 : 32 },
      cues: [{ t: 0.4, type: 'rise' }, { t: 1.2, type: 'pop' }],
      update(lt, info) {
        const k = popIn(lt, 0.1, 1.0);
        const out = ease.inCubic(seg(lt, info.dur - 0.45, 0.5));
        card.position.y = (1 - k) * -2.5 - out * 0.8;
        card.rotation.y = (1 - k) * -0.6 + Math.sin(lt * 0.45) * 0.06 + (portrait ? 0 : -0.12);
        card.rotation.x = (1 - k) * 0.3;
        card.userData.setOpacity(clamp(seg(lt, 0.05, 0.3)) * (1 - out));
        if (glyph) {
          const gk = ease.outBack(seg(lt, 0.9, 0.8));
          glyph.scale.setScalar(Math.max(0.001, gk * (1 - out)) * glyphFit);
          glyph.rotation.x = (1 - gk) * -1.2;
          glyph.rotation.z = portrait ? 0 : -0.06;
          glyph.position.y = ch / 2 + 0.1 + Math.sin(lt * 1.1) * 0.04;
          mats.forEach(m => { m.userData.u.uDissolve.value = 1 - ease.outCubic(seg(lt, 0.9, 1.0)); });
        }
      },
      draw(o, lt, info) {
        const zone = textZone(o, layout);
        zone.layout = layout;
        const hdr = drawHeader(o, zone, scene.text, lt, { dur: info.dur, inAt: 0.5, size: (portrait ? 70 : 72) * o.U, maxLines: 2 });
        let y = hdr.bottom + 30 * o.U;
        const a = t0 => clamp(ease.outCubic(seg(lt, t0, 0.5))) * (1 - seg(lt, info.dur - 0.45, 0.4));
        if (price) {
          const v = formatNumber(price.value * ease.outExpo(seg(lt, 1.0, 1.4)), { prefix: price.prefix, suffix: price.suffix, decimals: price.decimals });
          o.text(v, zone.x, y + 70 * o.U, { size: 84 * o.U, weight: 800, color: o.theme.accent, align: zone.align, alpha: a(1.0), tracking: -0.02 });
          y += 100 * o.U;
        } else if (d.price) {
          o.text(String(d.price), zone.x, y + 60 * o.U, { size: 64 * o.U, weight: 800, color: o.theme.accent, align: zone.align, alpha: a(1.0) });
          y += 90 * o.U;
        }
        if (facts.length) {
          let x = zone.align === 'center' ? zone.x - totalChipsWidth(o, facts) / 2 : zone.x;
          facts.forEach((f, i) => {
            const { w } = o.chip(f, x, y, { size: 24 * o.U, bg: o.theme.dark ? 'rgba(255,255,255,0.12)' : 'rgba(17,17,17,0.06)', color: o.theme.text, family: 'body', tracking: 0, alpha: a(1.2 + i * 0.1) });
            x += w + 12 * o.U;
          });
        }
        if (d.badge) pinLabel(o, stage, worldPos(card, new THREE.Vector3(-cw / 2 + 0.3, -ch / 2 + 0.25, 0.2)), d.badge, { alpha: a(1.4), size: 22, align: 'left' });
      },
    };
  },
};

function totalChipsWidth(o, facts) {
  return facts.reduce((s, f) => s + o.measure(f, { size: 24 * o.U, weight: 700, family: 'body' }) + 24 * o.U * 1.5 + 12 * o.U, -12 * o.U);
}
