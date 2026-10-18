// End card: the official Redfin Powered by Rocket lockup, the person, contact details,
// a QR code and the compliance line. The card sizes itself to what was provided; nothing is invented.
import { drawHeader } from './common.js';
import { clamp, ease, seg } from '../engine/util.js';
import * as M from '../engine/materials.js';

export default {
  type: 'endcard',
  label: 'End card',
  description: 'Brand lockup, person, contact details, QR code and compliance line.',
  defaults: { dur: 5, shot: 'static' },
  editable: [
    { key: 'headline', label: 'Closing headline', type: 'text' },
    { key: 'sub', label: 'Closing line', type: 'text' },
    { key: 'cta', label: 'QR label (e.g. Scan to connect)', type: 'text', data: true },
  ],
  build(ctx) {
    const { scene, group, world, stage, assets, fields, logos, palette } = ctx;
    const portrait = stage.aspect < 0.95;
    const rings = [0, 1, 2].map(i => {
      const r = world.ring(3.2 + i * 0.7, 0.018 - i * 0.004, M.glow(palette.glow || palette.accent, 2 - i * 0.4));
      r.position.set(0, 0, -5 - i);
      group.add(r);
      return r;
    });
    const d = scene.data || {};
    const person = {
      name: d.name ?? fields.agentName ?? '',
      title: d.title ?? fields.agentTitle ?? '',
      dre: d.dre ?? fields.dre ?? '',
      phone: d.phone ?? fields.phone ?? '',
      email: d.email ?? fields.email ?? '',
      photo: d.showPhoto === false ? null : assets.headshot,
    };
    const qr = d.qr === false ? null : assets.qr;
    const showEho = d.eho ?? fields.eho ?? true;
    const brokerage = d.brokerage ?? fields.brokerage ?? 'Redfin';
    const link = shortLink(d.linkText);

    return {
      shot: { frame: { w: 9, h: 6 }, layout: 'center', pitch: 2, fov: portrait ? 42 : 34 },
      decorCount: 6,
      update(lt) {
        rings.forEach((r, i) => {
          r.rotation.z = lt * (0.15 + i * 0.05) * (i % 2 ? -1 : 1);
          r.rotation.x = Math.sin(lt * 0.3 + i) * 0.25;
          r.scale.setScalar(Math.max(0.001, ease.outCubic(seg(lt, 0.2 + i * 0.15, 1.2))));
        });
      },
      draw(o, lt, info) {
        const U = o.U;
        const a = t0 => clamp(ease.outCubic(seg(lt, t0, 0.6)));
        const dark = o.theme.dark;
        const ink = o.theme.text, sub = o.theme.sub;
        const pad = 56 * U;
        const cardW = portrait ? o.safe.w : Math.min(o.W * 0.72, 1360 * U);
        const contact = [person.phone, person.email, person.dre ? `DRE #${person.dre}` : ''].filter(Boolean);
        const logoKey = dark ? 'taglineReversed' : 'tagline';
        const logoImg = logos[logoKey];
        const logoW = portrait ? cardW * 0.56 : cardW * 0.34;
        const logoH = logoW * ((logoImg.naturalHeight / logoImg.naturalWidth) || 0.31);
        const avatarR = (portrait ? 92 : 96) * U;
        const hasPerson = !!(person.name || person.photo);
        const qrSize = portrait ? Math.min(cardW * 0.4, 400 * U) : 300 * U;

        // Measure blocks so the card fits its content
        const personH = hasPerson ? (person.photo ? avatarR * 2 : 70 * U) : 0;
        const contactH = contact.length * 48 * U;
        const qrBlockH = qr ? qrSize + (d.cta ? 50 * U : 0) + (link ? 40 * U : 0) : 0;
        const footH = showEho || brokerage ? 70 * U : 0;
        const bodyH = portrait
          ? personH + (contact.length ? 30 * U + contactH : 0) + (qr ? 44 * U + qrBlockH : 0)
          : Math.max(personH + (contact.length ? 26 * U + contactH : 0), qrBlockH);
        const cardH = pad + logoH + 70 * U + bodyH + (footH ? 40 * U + footH : pad * 0.6);
        const headH = scene.text?.headline ? (portrait ? 230 : 170) * U : 0;
        const totalH = headH + cardH;
        const top = o.safe.top + Math.max(o.portrait ? 90 * U : 40 * U, (o.safe.h - totalH) / 2);
        const cx = o.W / 2 - cardW / 2;
        const cy = top + headH;

        if (scene.text?.headline) {
          const zone = { x: o.W / 2, y: top, w: o.safe.w * 0.95, h: headH - 20 * U, align: 'center', vcenter: true, layout: 'center' };
          drawHeader(o, zone, { headline: scene.text.headline, sub: scene.text.sub }, lt, { dur: info.dur + 10, size: (portrait ? 66 : 58) * U, maxLines: 2, inAt: 0.15, subSize: (portrait ? 34 : 30) * U });
        }

        const ck = ease.outCubic(seg(lt, 0, 0.8));
        o.panel(cx, cy + (1 - ck) * 60 * U, cardW, cardH, {
          alpha: ck, r: 40 * U,
          fill: dark ? 'rgba(20,19,24,0.84)' : 'rgba(255,255,255,0.9)',
          stroke: dark ? 'rgba(255,255,255,0.14)' : 'rgba(255,255,255,1)',
          shadowColor: dark ? 'rgba(0,0,0,0.5)' : 'rgba(60,40,30,0.16)',
        });
        let y = cy + pad;
        o.logo(logoImg, o.W / 2, y, logoW, { align: 'center', alpha: a(0.3) });
        y += logoH + 34 * U;
        o.line(cx + pad, y, cx + cardW - pad, y, { color: dark ? 'rgba(255,255,255,0.15)' : 'rgba(17,17,17,0.1)', width: 2 * U, k: ease.outCubic(seg(lt, 0.4, 0.8)), alpha: a(0.4) });
        y += 36 * U;

        const drawPerson = (x, yy) => {
          if (!hasPerson) return 0;
          if (person.photo) {
            o.avatar(person.photo, x + avatarR, yy + avatarR, avatarR, { alpha: a(0.5), ring: palette.accent, ringWidth: 6 * U, ringGap: 6 * U });
            const tx = x + avatarR * 2 + 34 * U;
            o.text(person.name, tx, yy + avatarR + (person.title ? -6 : 18) * U, { size: 52 * U, weight: 800, alpha: a(0.55), color: ink, tracking: -0.01 });
            if (person.title) o.text(person.title, tx, yy + avatarR + 42 * U, { size: 29 * U, weight: 500, family: 'body', alpha: a(0.65), color: sub });
            return avatarR * 2;
          }
          o.text(person.name, x, yy + 50 * U, { size: 56 * U, weight: 800, alpha: a(0.55), color: ink });
          return 70 * U;
        };
        const drawContact = (x, yy) => contact.forEach((line, i) => o.text(line, x, yy + 34 * U + i * 48 * U, { size: 31 * U, weight: 600, family: 'body', color: ink, alpha: a(0.7 + i * 0.08) }));
        const drawQR = (x, yy) => {
          o.qr(qr, x, yy, qrSize, { k: ease.outCubic(seg(lt, 0.8, 1.0)), alpha: a(0.7), dark: '#111111', light: '#FFFFFF', r: 22 * U });
          let ly = yy + qrSize;
          if (d.cta) { ly += 44 * U; o.text(d.cta.toUpperCase(), x + qrSize / 2, ly, { size: 22 * U, family: 'mono', weight: 700, align: 'center', color: palette.accent, tracking: 0.1, alpha: a(1.0) }); }
          if (link) { ly += 40 * U; o.text(link, x + qrSize / 2, ly, { size: 26 * U, family: 'body', weight: 600, align: 'center', color: ink, alpha: a(1.05) }); }
        };

        if (portrait) {
          y += drawPerson(cx + pad, y);
          if (contact.length) { y += 20 * U; drawContact(cx + pad, y); y += contactH + 10 * U; }
          if (qr) { y += 34 * U; drawQR(o.W / 2 - qrSize / 2, y); y += qrBlockH; }
        } else {
          const ph = drawPerson(cx + pad, y);
          if (contact.length) drawContact(cx + pad, y + ph + 16 * U);
          if (qr) drawQR(cx + cardW - pad - qrSize, y);
          y += bodyH;
        }
        if (footH) {
          const fy = cy + cardH - pad * 0.7 - 50 * U;
          if (showEho) o.eho(cx + pad, fy, 50 * U, { color: sub, alpha: a(1.1) });
          if (brokerage) o.text(brokerage, cx + cardW - pad, fy + 38 * U, { size: 26 * U, weight: 700, family: 'body', align: 'right', color: sub, alpha: a(1.1) });
        }
      },
    };
  },
};

function shortLink(url) {
  if (!url) return '';
  const s = String(url).replace(/^https?:\/\//i, '').replace(/\/$/, '');
  return s.length > 40 ? s.slice(0, 38) + '…' : s;
}
