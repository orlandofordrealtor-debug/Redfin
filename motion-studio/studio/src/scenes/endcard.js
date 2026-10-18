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
        const a = t0 => clamp(ease.outCubic(seg(lt, t0, 0.6)));
        const dark = o.theme.dark;
        const ink = o.theme.text, sub = o.theme.sub;
        const contact = [person.phone, person.email, person.dre ? `DRE #${person.dre}` : ''].filter(Boolean);
        const logoImg = logos[dark ? 'taglineReversed' : 'tagline'];
        const logoRatio = (logoImg.naturalHeight / logoImg.naturalWidth) || 0.31;
        const hasPerson = !!(person.name || person.photo);
        // tall = 9:16 (everything stacked), wide = 16:9 (person left, QR right),
        // compact = square and 4:5 (person on top, then QR with its label and contact beside it)
        const mode = o.H / o.W > 1.6 ? 'tall' : o.W / o.H > 1.3 ? 'wide' : 'compact';
        const measure = U => {
          const m = { U, pad: 56 * U };
          m.cardW = mode === 'wide' ? Math.min(o.W * 0.72, 1360 * U) : o.safe.w * (U / o.U);
          m.logoW = m.cardW * (mode === 'tall' ? 0.56 : mode === 'compact' ? 0.46 : 0.34);
          m.logoH = m.logoW * logoRatio;
          m.avatarR = (mode === 'compact' ? 84 : mode === 'tall' ? 92 : 96) * U;
          m.qrSize = mode === 'tall' ? Math.min(m.cardW * 0.4, 400 * U) : (mode === 'compact' ? 280 : 300) * U;
          // Long names and titles shrink to the space beside the photo instead of running into the QR code
          const textW = m.cardW - 2 * m.pad - (person.photo ? 2 * m.avatarR + 34 * U : 0) - (mode === 'wide' && qr ? m.qrSize + 40 * U : 0);
          const shrink = (str, size, opts) => (str ? Math.min(size, size * textW / Math.max(1, o.measure(str, { size, ...opts }))) : size);
          m.nameSize = shrink(person.name, 52 * U, { weight: 800, tracking: -0.01 });
          m.titleSize = shrink(person.title, 29 * U, { weight: 500, family: 'body' });
          m.personH = hasPerson ? (person.photo ? m.avatarR * 2 : 70 * U) : 0;
          m.contactH = contact.length * 48 * U;
          m.ctaSize = 22 * U;
          m.linkSize = 26 * U;
          if (mode === 'compact') {
            m.colW = m.cardW - 2 * m.pad - (qr ? m.qrSize + 36 * U : 0);
            m.ctaLines = qr && d.cta ? o.wrap(d.cta.toUpperCase(), m.colW, { size: m.ctaSize, family: 'mono', weight: 700, tracking: 0.1 }) : [];
            if (link) m.linkSize = Math.min(26 * U, 26 * U * m.colW / Math.max(1, o.measure(link, { size: 26 * U, family: 'body', weight: 600 })));
            m.colH = m.ctaLines.length * 30 * U + (qr && link ? 44 * U : 0) + (contact.length ? (qr ? 24 * U : 0) + m.contactH : 0);
            m.rowH = qr ? Math.max(m.qrSize, m.colH) : m.contactH;
            m.bodyH = m.personH + (m.rowH ? 36 * U + m.rowH : 0);
          } else if (mode === 'tall') {
            m.qrBlockH = qr ? m.qrSize + (d.cta ? 50 * U : 0) + (link ? 40 * U : 0) : 0;
            m.bodyH = m.personH + (contact.length ? 30 * U + m.contactH : 0) + (qr ? 44 * U + m.qrBlockH : 0);
          } else {
            m.qrBlockH = qr ? m.qrSize + (d.cta ? 50 * U : 0) + (link ? 40 * U : 0) : 0;
            m.bodyH = Math.max(m.personH + (contact.length ? 26 * U + m.contactH : 0), m.qrBlockH);
          }
          m.footH = showEho || brokerage ? 70 * U : 0;
          m.cardH = m.pad + m.logoH + 70 * U + m.bodyH + (m.footH ? 40 * U + m.footH : m.pad * 0.6);
          m.headH = scene.text?.headline ? (mode === 'tall' ? 230 : 170) * U : 0;
          m.totalH = m.headH + m.cardH;
          return m;
        };
        let m = measure(o.U);
        if (m.totalH > o.safe.h) m = measure(o.U * o.safe.h / m.totalH);   // scale everything down to fit
        const { U, pad, cardW, cardH, logoW, logoH, avatarR, qrSize } = m;
        const spare = o.safe.h - m.totalH;
        const top = o.safe.top + clamp(Math.max(mode === 'tall' ? 90 * U : 40 * U, spare / 2), 0, Math.max(0, spare));
        const cx = o.W / 2 - cardW / 2;
        const cy = top + m.headH;

        if (scene.text?.headline) {
          const zone = { x: o.W / 2, y: top, w: o.safe.w * 0.95, h: m.headH - 20 * U, align: 'center', vcenter: true, layout: 'center' };
          drawHeader(o, zone, { headline: scene.text.headline, sub: scene.text.sub }, lt, { dur: info.dur + 10, size: (mode === 'tall' ? 66 : 58) * U, maxLines: 2, inAt: 0.15, subSize: (mode === 'tall' ? 34 : 30) * U });
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
            o.text(person.name, tx, yy + avatarR + (person.title ? -6 : 18) * U, { size: m.nameSize, weight: 800, alpha: a(0.55), color: ink, tracking: -0.01 });
            if (person.title) o.text(person.title, tx, yy + avatarR + 42 * U, { size: m.titleSize, weight: 500, family: 'body', alpha: a(0.65), color: sub });
            return avatarR * 2;
          }
          o.text(person.name, x, yy + 50 * U, { size: m.nameSize * 56 / 52, weight: 800, alpha: a(0.55), color: ink });
          return 70 * U;
        };
        const drawContact = (x, yy) => contact.forEach((line, i) => o.text(line, x, yy + 34 * U + i * 48 * U, { size: 31 * U, weight: 600, family: 'body', color: ink, alpha: a(0.7 + i * 0.08) }));
        const drawCode = (x, yy) => o.qr(qr, x, yy, qrSize, { k: ease.outCubic(seg(lt, 0.8, 1.0)), alpha: a(0.7), dark: '#111111', light: '#FFFFFF', r: 22 * U });
        const drawQR = (x, yy) => {
          drawCode(x, yy);
          let ly = yy + qrSize;
          // Labels center under the code but stay inside the card when they are wider than it
          const under = (str, opts) => {
            const half = o.measure(str, opts) / 2;
            return clamp(x + qrSize / 2, cx + pad + half, Math.max(cx + pad + half, cx + cardW - pad - half));
          };
          if (d.cta) {
            const opts = { size: m.ctaSize, family: 'mono', weight: 700, tracking: 0.1 };
            ly += 44 * U; o.text(d.cta.toUpperCase(), under(d.cta.toUpperCase(), opts), ly, { ...opts, align: 'center', color: palette.accent, alpha: a(1.0) });
          }
          if (link) {
            const opts = { size: m.linkSize, family: 'body', weight: 600 };
            ly += 40 * U; o.text(link, under(link, opts), ly, { ...opts, align: 'center', color: ink, alpha: a(1.05) });
          }
        };

        if (mode === 'tall') {
          y += drawPerson(cx + pad, y);
          if (contact.length) { y += 20 * U; drawContact(cx + pad, y); y += m.contactH + 10 * U; }
          if (qr) { y += 34 * U; drawQR(o.W / 2 - qrSize / 2, y); }
        } else if (mode === 'compact') {
          y += drawPerson(cx + pad, y);
          if (m.rowH) {
            y += 36 * U;
            let tx = cx + pad;
            let ty = y + (m.rowH - m.colH) / 2;
            if (qr) { drawCode(cx + pad, y + (m.rowH - qrSize) / 2); tx += qrSize + 36 * U; }
            m.ctaLines.forEach(line => { o.text(line, tx, ty + 24 * U, { size: m.ctaSize, family: 'mono', weight: 700, color: palette.accent, tracking: 0.1, alpha: a(1.0) }); ty += 30 * U; });
            if (qr && link) { o.text(link, tx, ty + 36 * U, { size: m.linkSize, family: 'body', weight: 600, color: ink, alpha: a(1.05) }); ty += 44 * U; }
            if (contact.length) drawContact(tx, ty + (qr ? 24 * U : 0) - 6 * U);
          }
        } else {
          const ph = drawPerson(cx + pad, y);
          if (contact.length) drawContact(cx + pad, y + ph + 16 * U);
          if (qr) drawQR(cx + cardW - pad - qrSize, y);
        }
        if (m.footH) {
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
