/* Redfin Spotlight Studio — graphics engine.
   Draws 15 layout archetypes in 4 social formats on a 2D canvas.
   Everything is measured and fitted at draw time so no copy overflows its frame.
   Depends on: window.STUDIO_LOGOS (logos.js) and, for QR codes, window.qrcode (qrcode-generator). */
(function () {
  'use strict';
  const TAU = Math.PI * 2;

  /* ------------------------------------------------------------------ formats */
  const FORMATS = {
    story: { key: 'story', w: 1080, h: 1920, ratio: '9:16', name: 'Story / Reel' },
    feed: { key: 'feed', w: 1080, h: 1350, ratio: '4:5', name: 'Instagram feed' },
    square: { key: 'square', w: 1080, h: 1080, ratio: '1:1', name: 'Square' },
    wide: { key: 'wide', w: 1200, h: 628, ratio: '1.91:1', name: 'LinkedIn / Facebook' },
  };

  /* ------------------------------------------------------------------ fonts */
  const FAM = {
    pinyon: '"Pinyon Script", "Great Vibes", cursive',
    vibes: '"Great Vibes", "Pinyon Script", cursive',
    italianno: '"Italianno", "Great Vibes", cursive',
    brush: '"Alex Brush", "Great Vibes", cursive',
    monsieur: '"Monsieur La Doulaise", "Pinyon Script", cursive',
    playfair: '"Playfair Display", Georgia, "Times New Roman", serif',
    cormorant: '"Cormorant Garamond", Georgia, "Times New Roman", serif',
    cinzel: '"Cinzel", "Playfair Display", Georgia, serif',
    sans: '"Montserrat", "Helvetica Neue", Arial, sans-serif',
    jost: '"Jost", "Montserrat", "Helvetica Neue", Arial, sans-serif',
  };
  const SCRIPTS = ['pinyon', 'vibes', 'italianno', 'brush', 'monsieur'];
  // Script faces render at different optical sizes; normalize so a given size reads about the same.
  const SCRIPT_SCALE = { pinyon: 1, vibes: 1.04, italianno: 1.32, brush: 0.98, monsieur: 1.12 };
  const FONT_LOADS = [
    '400 64px "Pinyon Script"', '400 64px "Great Vibes"', '400 64px "Italianno"', '400 64px "Alex Brush"', '400 64px "Monsieur La Doulaise"',
    '400 64px "Playfair Display"', '600 64px "Playfair Display"', '700 64px "Playfair Display"', '900 64px "Playfair Display"', 'italic 400 64px "Playfair Display"', 'italic 600 64px "Playfair Display"',
    '500 64px "Cormorant Garamond"', '600 64px "Cormorant Garamond"', '700 64px "Cormorant Garamond"', 'italic 500 64px "Cormorant Garamond"', 'italic 600 64px "Cormorant Garamond"',
    '500 64px "Cinzel"', '600 64px "Cinzel"', '700 64px "Cinzel"',
    '300 64px "Montserrat"', '400 64px "Montserrat"', '500 64px "Montserrat"', '600 64px "Montserrat"', '700 64px "Montserrat"', '800 64px "Montserrat"',
    '300 64px "Jost"', '400 64px "Jost"', '500 64px "Jost"',
  ];
  let fontsReady = null;
  function ensureFonts() {
    if (!fontsReady) {
      fontsReady = (document.fonts && document.fonts.load)
        ? Promise.all(FONT_LOADS.map((f) => document.fonts.load(f, 'AaJjSs$1').catch(() => null))).then(() => document.fonts.ready)
        : Promise.resolve();
    }
    return fontsReady;
  }

  /* ------------------------------------------------------------------ palettes */
  const GOLD = [[0, '#8A6A30'], [0.2, '#E8D195'], [0.42, '#B68F42'], [0.6, '#F5E6B8'], [0.8, '#A47D36'], [1, '#D8BA72']];
  const DEEP_GOLD = [[0, '#7A5920'], [0.45, '#A8823C'], [0.7, '#86662B'], [1, '#6C4F1E']];
  const DEEP_CHAMPAGNE = [[0, '#6A5134'], [0.5, '#957650'], [1, '#664E33']];
  const CHAMPAGNE = [[0, '#9C7F55'], [0.28, '#EADBBB'], [0.52, '#B89A6A'], [0.74, '#F4EAD3'], [1, '#A88A5E']];
  const PAL = {
    ivory: { name: 'Champagne ivory', dark: false, bg: '#F8F4EC', bg2: '#EFE6D6', band: '#2A231E', ink: '#1F1C19', muted: '#6E655B', line: '#D8CBB4', card: '#FFFDF8', accent: '#A9843F', script: '#1F1C19', logo: 'color', gold: GOLD },
    marble: { name: 'White marble', dark: false, bg: '#F7F6F3', bg2: '#E9E7E2', band: '#151515', ink: '#111111', muted: '#5A5955', line: '#D7D3CB', card: '#FFFFFF', accent: '#A47F3E', script: '#111111', logo: 'color', gold: GOLD },
    coastal: { name: 'Coastal sand', dark: false, bg: '#F3EEE5', bg2: '#E2D8C6', band: '#27333B', ink: '#25313A', muted: '#5D707D', line: '#CFC2AB', card: '#FFFDF9', accent: '#AD8C52', script: '#25313A', logo: 'color', gold: GOLD },
    sage: { name: 'Editorial sage', dark: false, bg: '#F2EFE6', bg2: '#DADFD0', band: '#2D3329', ink: '#22261F', muted: '#646F5D', line: '#C8CCBA', card: '#FFFEF9', accent: '#A4874A', script: '#22261F', logo: 'color', gold: GOLD },
    parchment: { name: 'Parchment', dark: false, bg: '#F1E8D8', bg2: '#E3D5BC', band: '#241D16', ink: '#1A1612', muted: '#6A5D4B', line: '#CBB690', card: '#FBF6EC', accent: '#9E7A3A', script: '#15120F', logo: 'color', gold: GOLD },
    bronze: { name: 'Soft beige & bronze', dark: false, bg: '#EEE4D7', bg2: '#E0D2C0', band: '#3A2A1E', ink: '#33251B', muted: '#755E4A', line: '#CDB79C', card: '#FAF5EE', accent: '#93663A', script: '#33251B', logo: 'color', gold: GOLD },
    redfin: { name: 'Redfin accent', dark: false, bg: '#FFFFFF', bg2: '#F6F1F1', band: '#151417', ink: '#151417', muted: '#5F5E66', line: '#E7E3E5', card: '#FFFFFF', accent: '#DE3341', script: '#151417', logo: 'color', gold: GOLD, red: true },
    espresso: { name: 'Espresso & gold', dark: true, bg: '#2A211C', bg2: '#1B1512', band: '#1B1512', ink: '#F4ECDF', muted: '#BFAE97', line: '#5A4A3C', card: '#342A22', accent: '#CBA65E', script: 'gold', logo: 'white', gold: GOLD },
    noir: { name: 'Luxe noir', dark: true, bg: '#121110', bg2: '#080707', band: '#080707', ink: '#F5F0E6', muted: '#A69E91', line: '#3A352E', card: '#1D1B19', accent: '#D4B26A', script: 'gold', logo: 'white', gold: GOLD },
    slate: { name: 'Slate & gold', dark: true, bg: '#1D1F22', bg2: '#131416', band: '#131416', ink: '#F2F1EE', muted: '#9DA2A7', line: '#3A3E44', card: '#26292D', accent: '#CFAE6B', script: 'gold', logo: 'white', gold: GOLD },
    midnight: { name: 'Midnight tech', dark: true, bg: '#0D1117', bg2: '#151B25', band: '#0A0D12', ink: '#F4F6F8', muted: '#9AA4B2', line: '#283141', card: '#161D28', accent: '#FF4F5E', glow: '#DE3341', script: '#FFFFFF', logo: 'white', gold: GOLD, red: true },
    redbold: { name: 'Redfin bold', dark: true, bg: '#DE3341', bg2: '#B9232F', band: '#9E1C27', ink: '#FFFFFF', muted: '#FFE1E4', line: 'rgba(255,255,255,.38)', card: '#FFFFFF', accent: '#FFFFFF', script: '#FFFFFF', logo: 'white', gold: GOLD, red: true },
    // Premier By Redfin — Mushroom #463C33 and Putty #F3EEE7 from the Premier brand kit.
    putty: { name: 'Premier putty', premier: true, dark: false, bg: '#F3EEE7', bg2: '#E7DFD3', band: '#463C33', ink: '#463C33', muted: '#7C6F62', line: '#D2C6B6', card: '#FBF8F3', accent: '#A4875C', script: '#463C33', logo: 'mushroom', gold: CHAMPAGNE },
    stone: { name: 'Premier stone', premier: true, dark: false, bg: '#E6DED3', bg2: '#D7CCBD', band: '#3B322A', ink: '#3B322A', muted: '#72655A', line: '#C3B5A3', card: '#F3EEE7', accent: '#987C52', script: '#463C33', logo: 'mushroom', gold: CHAMPAGNE },
    mushroom: { name: 'Premier mushroom', premier: true, dark: true, bg: '#463C33', bg2: '#372F28', band: '#2A231E', ink: '#F3EEE7', muted: '#CFC2B2', line: '#6C5F53', card: '#524639', accent: '#D8C098', script: 'gold', logo: 'putty', gold: CHAMPAGNE },
    umber: { name: 'Premier umber', premier: true, dark: true, bg: '#211B17', bg2: '#15110E', band: '#15110E', ink: '#F3EEE7', muted: '#B8AB9B', line: '#4A3F36', card: '#2B241F', accent: '#CDB07C', script: 'gold', logo: 'putty', gold: CHAMPAGNE },
  };

  /* ------------------------------------------------------------------ transaction types */
  const TYPES = {
    closed_buy: { stamp: 'CLOSED', group: 'closed', tier: 'standard', label: 'Closed · Buy Side', short: 'Buy side', eyebrow: 'Buyer Represented', scripts: ['Just Closed', 'Welcome Home', 'Just Closed', 'Congratulations', 'Keys Delivered', 'Just Closed', 'Home Sweet Home'], priceLabel: 'Purchased for', dateVerb: 'Closed', taglines: ['New beginnings start here', 'Your journey, our priority', 'Buyer success starts with strategy', 'Another family, home'], ctas: ['Ready to buy? Scan to connect', 'Start your search with a local expert', 'Scan to connect with {first}', 'Find your next home with {first}'] },
    closed_sell: { stamp: 'SOLD', group: 'closed', tier: 'standard', label: 'Closed · Sell Side', short: 'Sell side', eyebrow: 'Seller Represented', scripts: ['Just Sold', 'Sold', 'Just Sold', 'Successfully Sold', 'Just Sold', 'Another One Sold', 'Sold'], priceLabel: 'Sold for', dateVerb: 'Sold', taglines: ['Strategy. Negotiation. Results.', 'Elevated service. Exceptional results.', 'Sold with expert guidance', 'Another chapter, beautifully closed'], ctas: ['Thinking of selling? Scan to connect', 'See what your home could sell for today', 'Scan to connect with {first}', 'Work with a local expert'] },
    premier_buy: { stamp: 'CLOSED', group: 'closed', tier: 'premier', label: 'Premier · Buy Side', short: 'Premier buy', eyebrow: 'Premier Buyer Representation', scripts: ['Just Closed', 'Welcome Home', 'Just Closed', 'Congratulations', 'Just Closed', 'Home at Last'], priceLabel: 'Purchased for', dateVerb: 'Closed', taglines: ['Premier service. Exceptional results.', 'Luxury. Strategy. Results.', 'A premier experience, start to close', 'Expertly guided, beautifully home'], ctas: ['Scan to connect with {first}', 'Experience Premier representation', 'Begin your next move with {first}'] },
    premier_sell: { stamp: 'SOLD', group: 'closed', tier: 'premier', label: 'Premier · Sell Side', short: 'Premier sell', eyebrow: 'Premier Seller Representation', scripts: ['Just Sold', 'Sold', 'Just Sold', 'Successfully Sold', 'Just Sold'], priceLabel: 'Sold for', dateVerb: 'Sold', taglines: ['Premier service. Exceptional results.', 'Luxury. Strategy. Results.', 'Elevated marketing. Exceptional outcome.', 'Sold with Premier precision'], ctas: ['Scan to connect with {first}', 'Experience Premier representation', 'See what your home could sell for today'] },
    just_listed: { stamp: 'LISTED', group: 'listing', tier: 'standard', label: 'Just Listed', short: 'Just listed', eyebrow: 'New to Market', scripts: ['Just Listed', 'Just Listed', 'New Listing', 'Now Available', 'Just Listed'], priceLabel: 'Offered at', taglines: ['Your next chapter starts here', 'Tour it before it is gone', 'Thoughtfully presented by {first}'], ctas: ['Scan for details and tours', 'Scan to schedule a private tour', 'Scan to connect with {first}'] },
    coming_soon: { stamp: 'SOON', group: 'listing', tier: 'standard', label: 'Coming Soon', short: 'Coming soon', eyebrow: 'Coming to Market', scripts: ['Coming Soon', 'Coming Soon', 'Sneak Peek', 'Coming Soon'], priceLabel: 'Expected at', taglines: ['Be the first to know', 'Something special is on the way', 'Get on the list before it launches'], ctas: ['Scan to get details first', 'Scan to connect with {first}', 'Ask {first} for an early look'] },
    open_house: { stamp: 'OPEN', group: 'listing', tier: 'standard', label: 'Open House', short: 'Open house', eyebrow: 'Open House', scripts: ['Open House', 'Join Us', 'Open House', "You're Invited", 'Open House'], priceLabel: 'Offered at', taglines: ['Come see it in person', 'We would love to show you around', 'Bring your questions, and your wish list'], ctas: ['Scan for directions and details', 'Scan to RSVP with {first}', 'Can’t make it? Scan for a private tour'] },
    under_contract: { stamp: 'PENDING', group: 'listing', tier: 'standard', label: 'Under Contract', short: 'Under contract', eyebrow: 'Offer Accepted', scripts: ['Under Contract', 'Under Contract', 'Offer Accepted', 'Under Contract'], priceLabel: 'Listed at', taglines: ['Strong strategy, strong result', 'Another happy client on the way home', 'Momentum matters'], ctas: ['Thinking of selling? Scan to connect', 'Scan to connect with {first}', 'See what your home could sell for today'] },
    in_escrow: { stamp: 'ESCROW', group: 'listing', tier: 'standard', label: 'In Escrow', short: 'In escrow', eyebrow: 'In Escrow', scripts: ['In Escrow', 'In Escrow', 'Almost Home', 'In Escrow'], priceLabel: 'Listed at', taglines: ['The finish line is in sight', 'Another client almost home', 'Guided every step of the way'], ctas: ['Scan to connect with {first}', 'Ready for your move? Scan to connect', 'Work with a local expert'] },
    price_improvement: { stamp: 'NEW PRICE', group: 'listing', tier: 'standard', label: 'Price Improvement', short: 'Price improved', eyebrow: 'Price Improvement', scripts: ['New Price', 'Price Improvement', 'New Price', 'Price Improved'], priceLabel: 'Now offered at', taglines: ['A fresh opportunity', 'Now is the moment', 'Tour it this week'], ctas: ['Scan for details and tours', 'Scan to connect with {first}', 'Scan to schedule a private tour'] },
    back_on_market: { stamp: 'BACK', group: 'listing', tier: 'standard', label: 'Back on Market', short: 'Back on market', eyebrow: 'Back on Market', scripts: ['Back on Market', 'Available Again', 'Back on Market', 'Second Chance'], priceLabel: 'Offered at', taglines: ['Your second chance is here', 'Available again, act fast', 'Missed it the first time?'], ctas: ['Scan for details and tours', 'Scan to connect with {first}', 'Scan to schedule a private tour'] },
    client_review: { stamp: '5 STARS', group: 'brand', tier: 'standard', label: '5-Star Review', short: 'Client review', eyebrow: 'Client Review', scripts: ['Client Love', 'Kind Words', 'Thank You', '5-Star Review', 'Client Love'], priceLabel: '', taglines: ['Service that speaks for itself', 'Every client, every detail', 'Grateful for every client'], ctas: ['Scan to connect with {first}', 'Work with a local expert', 'Start your move with {first}'] },
  };

  /* ------------------------------------------------------------------ helpers */
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  function hash(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
  function rr(ctx, x, y, w, h, r) {
    r = Math.max(0, Math.min(r, w / 2, h / 2));
    ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
  }
  function arch(ctx, x, y, w, h) { const r = w / 2; ctx.beginPath(); ctx.moveTo(x, y + h); ctx.lineTo(x, y + r); ctx.arc(x + r, y + r, r, Math.PI, 0); ctx.lineTo(x + w, y + h); ctx.closePath(); }
  function circle(ctx, cx, cy, r) { ctx.beginPath(); ctx.arc(cx, cy, r, 0, TAU); ctx.closePath(); }
  function imgSize(img) { return { w: img.naturalWidth || img.videoWidth || img.width, h: img.naturalHeight || img.videoHeight || img.height }; }
  function cover(ctx, img, x, y, w, h, fx = 0.5, fy = 0.5, zoom = 1) {
    const s0 = imgSize(img); if (!s0.w || !s0.h) return;
    const s = Math.max(w / s0.w, h / s0.h) * zoom; const dw = s0.w * s, dh = s0.h * s;
    ctx.drawImage(img, x + (w - dw) * fx, y + (h - dh) * fy, dw, dh);
  }
  function setFont(ctx, fam, size, weight = 400, style = 'normal') { ctx.font = `${style} ${weight} ${Math.max(1, Math.round(size))}px ${FAM[fam] || fam}`; }
  function trackW(ctx, text, track) { let w = 0; for (const ch of text) w += ctx.measureText(ch).width; return w + track * Math.max(0, [...text].length - 1); }
  function textW(ctx, text, track = 0) { return track ? trackW(ctx, text, track) : ctx.measureText(text).width; }
  // Draws text with manual letter-spacing; align is relative to x.
  function drawText(ctx, text, x, y, { track = 0, align = 'left', stroke = false } = {}) {
    const w = textW(ctx, text, track);
    let sx = align === 'center' ? x - w / 2 : align === 'right' ? x - w : x;
    const prev = ctx.textAlign; ctx.textAlign = 'left';
    if (!track) { stroke ? ctx.strokeText(text, sx, y) : ctx.fillText(text, sx, y); }
    else { for (const ch of text) { stroke ? ctx.strokeText(ch, sx, y) : ctx.fillText(ch, sx, y); sx += ctx.measureText(ch).width + track; } }
    ctx.textAlign = prev; return w;
  }
  // Largest size <= max whose rendered width fits maxW.
  function fit(ctx, text, fam, max, maxW, { weight = 400, style = 'normal', trackEm = 0, min = 6 } = {}) {
    let size = max;
    setFont(ctx, fam, size, weight, style);
    let w = textW(ctx, text, trackEm * size);
    if (w > maxW) { size = Math.max(min, size * maxW / w); setFont(ctx, fam, size, weight, style); w = textW(ctx, text, trackEm * size); if (w > maxW) { size = Math.max(min, size * maxW / w * 0.98); } }
    return Math.floor(size);
  }
  function wrap(ctx, text, maxW) {
    const words = String(text).split(/\s+/).filter(Boolean); const lines = []; let line = '';
    for (const w of words) { const t = line ? line + ' ' + w : w; if (ctx.measureText(t).width <= maxW || !line) line = t; else { lines.push(line); line = w; } }
    if (line) lines.push(line); return lines;
  }
  function grad(ctx, stops, x0, y0, x1, y1) { const g = ctx.createLinearGradient(x0, y0, x1, y1); stops.forEach(([o, c]) => g.addColorStop(o, c)); return g; }
  function goldFill(D, x0, y0, x1, y1) { return grad(D.ctx, D.P.gold || GOLD, x0, y0, x1, y1); }
  // Gold for TEXT: bright foil on dark grounds, a deeper burnished gold on light grounds so it stays legible.
  function textGold(D, x0, y0, x1, y1) { return D.P.dark ? goldFill(D, x0, y0, x1, y1) : grad(D.ctx, D.P.premier ? DEEP_CHAMPAGNE : DEEP_GOLD, x0, y0, x1, y1); }
  function withShadow(ctx, c, blur, oy, fn) { ctx.save(); ctx.shadowColor = c; ctx.shadowBlur = blur; ctx.shadowOffsetY = oy; fn(); ctx.restore(); }
  function alpha(hex, a) {
    if (!hex || hex[0] !== '#') return hex;
    let h = hex.slice(1); if (h.length === 3) h = h.split('').map((c) => c + c).join('');
    const n = parseInt(h, 16); return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
  }
  function initials(name) { return String(name || '').replace(/\b(Jr|Sr|II|III)\.?$/i, '').trim().split(/\s+/).map((p) => p[0] || '').slice(0, 2).join('').toUpperCase(); }
  function firstName(name) { return String(name || '').trim().split(/\s+/)[0] || ''; }

  let noiseCanvas = null;
  function noise() {
    if (noiseCanvas) return noiseCanvas;
    const c = document.createElement('canvas'); c.width = c.height = 220; const x = c.getContext('2d');
    const d = x.createImageData(220, 220);
    for (let i = 0; i < d.data.length; i += 4) { const v = Math.random() * 255; d.data[i] = d.data[i + 1] = d.data[i + 2] = v; d.data[i + 3] = 255; }
    x.putImageData(d, 0, 0); noiseCanvas = c; return c;
  }
  function texture(D, a = 0.045) {
    const { ctx, W, H } = D; ctx.save(); ctx.globalAlpha = a; ctx.globalCompositeOperation = D.P.dark ? 'screen' : 'multiply';
    ctx.fillStyle = ctx.createPattern(noise(), 'repeat'); ctx.fillRect(0, 0, W, H); ctx.restore();
  }
  function vignette(D, a = 0.35) {
    const { ctx, W, H } = D; const g = ctx.createRadialGradient(W / 2, H * 0.45, Math.min(W, H) * 0.2, W / 2, H / 2, Math.max(W, H) * 0.8);
    g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, `rgba(0,0,0,${a})`); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  }
  function fillBg(D, c1, c2) {
    const { ctx, W, H } = D; ctx.fillStyle = c2 ? grad(ctx, [[0, c1], [1, c2]], 0, 0, W * 0.3, H) : c1; ctx.fillRect(0, 0, W, H);
  }

  /* ------------------------------------------------------------------ logos */
  const pathCache = {};
  function logoPaths(key) {
    if (pathCache[key]) return pathCache[key];
    const L = window.STUDIO_LOGOS && window.STUDIO_LOGOS[key]; if (!L) return null;
    pathCache[key] = { w: L.w, h: L.h, ox: L.ox || 0, oy: L.oy || 0, items: L.items.map((it) => ({ p: new Path2D(it.d), c: it.c })), styles: L.styles }; return pathCache[key];
  }
  const LOGO_COLORS = {
    color: (c, st) => st[c] || '#111', black: () => '#111111', white: () => '#FFFFFF',
    mushroom: () => '#463C33', putty: () => '#F3EEE7',
  };
  // Draws a logo with its height = h; returns drawn width.
  function logo(D, key, x, y, h, variant, align = 'left') {
    const L = logoPaths(key); if (!L) return 0; const s = h / L.h; const w = L.w * s;
    const ox = align === 'center' ? x - w / 2 : align === 'right' ? x - w : x;
    const ctx = D.ctx; ctx.save(); ctx.translate(ox, y); ctx.scale(s, s); ctx.translate(-L.ox, -L.oy);
    const pick = LOGO_COLORS[variant] || LOGO_COLORS.color;
    for (const it of L.items) { ctx.fillStyle = pick(it.c, L.styles); ctx.fill(it.p); }
    ctx.restore(); return w;
  }
  const PREMIER_K = 1.45; // the Premier logotype is a stacked mark; draw it taller than the one-line lockup
  function brandMark(D, x, y, h, align = 'center', onDark = D.P.dark) {
    if (D.premier) return logo(D, 'premier', x, y, h * PREMIER_K, onDark ? (D.P.logo === 'putty' ? 'putty' : 'white') : 'mushroom', align);
    let v = onDark ? 'white' : (D.P.logo === 'black' ? 'black' : 'color');
    return logo(D, 'lockupH', x, y, h, v, align);
  }

  /* ------------------------------------------------------------------ data → copy */
  function fmtMoney(v, short = false) {
    const n = Number(String(v || '').replace(/[^0-9.]/g, '')); if (!n) return String(v || '').trim();
    if (short) { if (n >= 1e6) return '$' + (n / 1e6).toFixed(n >= 1e7 ? 1 : 2).replace(/\.?0+$/, '') + 'M'; if (n >= 1e3) return '$' + Math.round(n / 1e3) + 'K'; }
    return '$' + Math.round(n).toLocaleString('en-US');
  }
  const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  function fmtMonth(iso) { const m = /^(\d{4})-(\d{2})/.exec(iso || ''); return m ? `${MONTHS[+m[2] - 1]} ${m[1]}` : String(iso || ''); }
  function buildCopy(spec) {
    const T = TYPES[spec.type] || TYPES.closed_sell; const d = spec.data || {}; const a = spec.agent || {};
    const k = (spec.layoutIndex || 0) + (spec.seed || 0) * 3;
    const pickL = (arr) => arr[((k % arr.length) + arr.length) % arr.length];
    const fill = (s) => String(s || '').replace(/\{first\}/g, firstName(a.name));
    const city = [d.city, d.state].filter(Boolean).join(', ');
    const price = d.showPrice === false ? '' : fmtMoney(d.price);
    let dateText = '';
    if (d.showDate !== false && d.date) dateText = (T.dateVerb ? T.dateVerb + ' ' : '') + fmtMonth(d.date);
    const facts = [d.beds && `${d.beds} BD`, d.baths && `${d.baths} BA`, d.sqft && `${Number(String(d.sqft).replace(/\D/g, '')).toLocaleString('en-US')} SQ FT`].filter(Boolean).join('  ·  ');
    let oh = '';
    if (spec.type === 'open_house') oh = [d.ohDate1, d.ohTime1].filter(Boolean).join(' · ') + (d.ohDate2 ? `   &   ${[d.ohDate2, d.ohTime2].filter(Boolean).join(' · ')}` : '');
    return {
      T, script: d.headline || pickL(T.scripts), eyebrow: (d.eyebrow || T.eyebrow).toUpperCase(), city, cityOnly: d.city || '', state: d.state || '',
      priceLabel: (d.priceLabel || T.priceLabel || '').toUpperCase(), price, prevPrice: spec.type === 'price_improvement' && d.prevPrice ? fmtMoney(d.prevPrice) : '',
      date: dateText.toUpperCase(), facts, oh: oh.toUpperCase(), tagline: fill(d.tagline || pickL(T.taglines)), cta: fill(d.cta || pickL(T.ctas)).toUpperCase(),
      review: spec.type === 'client_review' ? (d.review || '') : '', reviewer: d.reviewer || '', reviewRole: d.reviewRole || '',
    };
  }
  function statsList(a) {
    const s = a.stats || {}; const out = [];
    if (s.deals) out.push([String(s.deals), 'DEALS']);
    if (s.volume) out.push([String(s.volume), 'VOLUME']);
    if (s.highest) out.push([String(s.highest), 'HIGHEST SALE']);
    return out;
  }

  /* ------------------------------------------------------------------ components */
  function photo(D, i = 0) { return (D.imgs && D.imgs[i]) || D.img; }
  function framePhoto(D, pathFn, box, opts = {}) {
    const { ctx } = D; const img = opts.img || D.img;
    if (opts.shadow !== false) withShadow(ctx, 'rgba(0,0,0,' + (D.P.dark ? 0.55 : 0.28) + ')', opts.blur || 40, opts.oy || 18, () => { pathFn(); ctx.fillStyle = D.P.card; ctx.fill(); });
    ctx.save(); pathFn(); ctx.clip();
    if (img) {
      if (D.grade) ctx.filter = D.grade;
      cover(ctx, img, box.x, box.y, box.w, box.h, opts.fx ?? D.focus.x, opts.fy ?? D.focus.y, opts.zoom || 1);
      ctx.filter = 'none';
    } else { ctx.fillStyle = D.P.bg2; ctx.fillRect(box.x, box.y, box.w, box.h); }
    if (opts.tint) { ctx.fillStyle = opts.tint; ctx.fillRect(box.x, box.y, box.w, box.h); }
    ctx.restore();
    if (opts.stroke !== false) {
      ctx.save(); pathFn(); ctx.lineWidth = opts.strokeW || 3 * D.u; ctx.strokeStyle = opts.strokeColor || goldFill(D, box.x, box.y, box.x + box.w, box.y + box.h); ctx.stroke(); ctx.restore();
    }
  }
  function headshot(D, cx, cy, r, opts = {}) {
    const { ctx } = D; const ring = opts.ring !== false;
    if (ring) {
      withShadow(ctx, 'rgba(0,0,0,.35)', r * 0.35, r * 0.08, () => { circle(ctx, cx, cy, r + r * 0.085); ctx.fillStyle = goldFill(D, cx - r, cy - r, cx + r, cy + r); ctx.fill(); });
      circle(ctx, cx, cy, r + r * 0.035); ctx.fillStyle = opts.gap || D.P.card; ctx.fill();
    }
    ctx.save(); circle(ctx, cx, cy, r); ctx.clip();
    if (D.head) { cover(ctx, D.head, cx - r, cy - r, r * 2, r * 2, D.headFocus.x, D.headFocus.y, 1); }
    else { monogramFill(D, cx, cy, r); }
    ctx.restore();
    if (ring) { circle(ctx, cx, cy, r); ctx.lineWidth = Math.max(1, r * 0.012); ctx.strokeStyle = alpha('#FFFFFF', 0.6); ctx.stroke(); }
  }
  function monogramFill(D, cx, cy, r) {
    const { ctx } = D; ctx.fillStyle = D.P.dark ? D.P.card : D.P.band; ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
    setFont(ctx, 'cinzel', r * 0.8, 600); ctx.textBaseline = 'middle'; ctx.fillStyle = goldFill(D, cx - r, cy - r, cx + r, cy + r);
    drawText(ctx, initials(D.agent.name), cx, cy + r * 0.04, { align: 'center', track: r * 0.04 }); ctx.textBaseline = 'alphabetic';
  }
  function monogramCrest(D, cx, cy, r, a = 1) {
    const { ctx } = D; ctx.save(); ctx.globalAlpha = a;
    circle(ctx, cx, cy, r); ctx.lineWidth = r * 0.03; ctx.strokeStyle = goldFill(D, cx - r, cy - r, cx + r, cy + r); ctx.stroke();
    circle(ctx, cx, cy, r * 0.9); ctx.lineWidth = r * 0.008; ctx.stroke();
    setFont(ctx, 'cinzel', r * 0.78, 500); ctx.textBaseline = 'middle'; ctx.fillStyle = goldFill(D, cx - r, cy - r, cx + r, cy + r);
    drawText(ctx, initials(D.agent.name), cx, cy + r * 0.05, { align: 'center', track: r * 0.05 }); ctx.textBaseline = 'alphabetic'; ctx.restore();
  }
  function qrMatrix(text) {
    if (!text || !window.qrcode) return null;
    try { const q = window.qrcode(0, 'M'); q.addData(String(text)); q.make(); const n = q.getModuleCount(); return { n, dark: (r, c) => q.isDark(r, c) }; } catch (e) { return null; }
  }
  // QR on a light card. size = card edge. Returns card height including label.
  function qr(D, x, y, size, opts = {}) {
    const { ctx } = D; const label = opts.label === undefined ? 'SCAN TO CONNECT' : opts.label;
    const pad = size * 0.075; const labelH = label ? size * 0.15 : 0; const cardH = size + labelH;
    const cardFill = opts.cardFill || (D.P.premier ? '#FBF8F3' : '#FFFFFF');
    withShadow(ctx, 'rgba(0,0,0,.25)', size * 0.12, size * 0.04, () => { rr(ctx, x, y, size, cardH, size * 0.07); ctx.fillStyle = cardFill; ctx.fill(); });
    if (opts.goldEdge !== false) { rr(ctx, x, y, size, cardH, size * 0.07); ctx.lineWidth = Math.max(1.5, size * 0.012); ctx.strokeStyle = goldFill(D, x, y, x + size, y + cardH); ctx.stroke(); }
    const inner = size - pad * 2; const ink = D.P.premier ? '#2E2620' : '#111111';
    if (D.qrImg) { ctx.save(); rr(ctx, x + pad, y + pad, inner, inner, 4); ctx.clip(); cover(ctx, D.qrImg, x + pad, y + pad, inner, inner); ctx.restore(); }
    else if (D.qr) {
      const n = D.qr.n; const m = inner / n; ctx.fillStyle = ink;
      for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (D.qr.dark(r, c)) ctx.fillRect(x + pad + c * m, y + pad + r * m, Math.ceil(m), Math.ceil(m));
    } else {
      ctx.fillStyle = alpha(ink, 0.08); rr(ctx, x + pad, y + pad, inner, inner, 6); ctx.fill();
      setFont(ctx, 'sans', inner * 0.09, 600); ctx.fillStyle = alpha(ink, 0.5); ctx.textBaseline = 'middle';
      drawText(ctx, 'ADD LINK', x + size / 2, y + pad + inner / 2, { align: 'center', track: inner * 0.01 }); ctx.textBaseline = 'alphabetic';
    }
    if (label) {
      const s = fit(ctx, label, 'sans', size * 0.075, size - pad * 2, { weight: 700, trackEm: 0.18 });
      setFont(ctx, 'sans', s, 700); ctx.fillStyle = D.P.premier ? '#463C33' : (D.P.red ? '#DE3341' : '#1A1714');
      drawText(ctx, label, x + size / 2, y + size + labelH * 0.32, { align: 'center', track: s * 0.18 });
    }
    return cardH;
  }
  function diamond(ctx, x, y, s) { ctx.beginPath(); ctx.moveTo(x, y - s); ctx.lineTo(x + s, y); ctx.lineTo(x, y + s); ctx.lineTo(x - s, y); ctx.closePath(); ctx.fill(); }
  function ruleOrn(D, cx, y, w, color) {
    const { ctx } = D; ctx.save(); ctx.strokeStyle = color || goldFill(D, cx - w / 2, y, cx + w / 2, y); ctx.fillStyle = ctx.strokeStyle; ctx.lineWidth = Math.max(1, 1.6 * D.u);
    const gap = 16 * D.u; ctx.beginPath(); ctx.moveTo(cx - w / 2, y); ctx.lineTo(cx - gap, y); ctx.moveTo(cx + gap, y); ctx.lineTo(cx + w / 2, y); ctx.stroke(); diamond(ctx, cx, y, 6 * D.u); ctx.restore();
  }
  function corners(D, x, y, w, h, len, color) {
    const { ctx } = D; ctx.save(); ctx.strokeStyle = color || goldFill(D, x, y, x + w, y + h); ctx.lineWidth = 2.2 * D.u;
    const L = len; const pts = [[x, y, 1, 1], [x + w, y, -1, 1], [x, y + h, 1, -1], [x + w, y + h, -1, -1]];
    for (const [px, py, sx, sy] of pts) { ctx.beginPath(); ctx.moveTo(px, py + sy * L); ctx.lineTo(px, py); ctx.lineTo(px + sx * L, py); ctx.stroke(); ctx.beginPath(); ctx.arc(px + sx * 10 * D.u, py + sy * 10 * D.u, 2.6 * D.u, 0, TAU); ctx.fillStyle = ctx.strokeStyle; ctx.fill(); }
    ctx.restore();
  }
  function frameBorder(D, inset, color, w = 2) {
    const { ctx, W, H } = D; ctx.save(); ctx.strokeStyle = color || goldFill(D, 0, 0, W, H); ctx.lineWidth = w * D.u; ctx.strokeRect(inset, inset, W - inset * 2, H - inset * 2); ctx.restore();
  }

  /* ---------- text stack: measured, then scaled to fit its box ---------- */
  const ITEM = {
    eyebrow(D, it, k, maxW) {
      const { ctx } = D; const txt = it.text || D.copy.eyebrow; if (!txt) return null;
      const flank = it.flank !== false; const avail = flank ? maxW * 0.78 : maxW;
      const s = fit(ctx, txt, it.fam || (D.premier ? 'jost' : 'sans'), (it.size || 26) * k, avail, { weight: it.weight || 600, trackEm: it.track ?? 0.3 });
      return { h: s * 1.1, draw(x, y, align) {
        setFont(ctx, it.fam || (D.premier ? 'jost' : 'sans'), s, it.weight || 600); ctx.fillStyle = it.color || D.P.accent;
        const w = drawText(ctx, txt, x, y + s * 0.92, { track: s * (it.track ?? 0.3), align });
        if (flank) {
          const cy = y + s * 0.55; const gap = s * 1.5; const len = Math.min(s * 3.2, (maxW - w) / 2 - gap); if (len < s * 0.8) return;
          ctx.fillStyle = it.color || D.P.accent; ctx.strokeStyle = ctx.fillStyle; ctx.lineWidth = Math.max(1, s * 0.07);
          const L = align === 'center' ? x - w / 2 : align === 'right' ? x - w : x; const Rr = L + w;
          if (align !== 'left') { ctx.beginPath(); ctx.moveTo(L - gap - len, cy); ctx.lineTo(L - gap, cy); ctx.stroke(); diamond(ctx, L - gap * 0.55, cy, s * 0.17); }
          if (align !== 'right') { ctx.beginPath(); ctx.moveTo(Rr + gap, cy); ctx.lineTo(Rr + gap + len, cy); ctx.stroke(); diamond(ctx, Rr + gap * 0.55, cy, s * 0.17); }
        }
      } };
    },
    script(D, it, k, maxW) {
      const { ctx } = D; const txt = it.text || D.copy.script; const fam = it.fam || D.scriptFam; const sc = SCRIPT_SCALE[fam] || 1;
      const s = fit(ctx, txt, fam, (it.size || 170) * k * sc, maxW * (it.widthFrac || 0.96));
      setFont(ctx, fam, s); const mm = ctx.measureText(txt);
      const asc = mm.actualBoundingBoxAscent || s * 0.7; const desc = mm.actualBoundingBoxDescent || s * 0.18;
      const h = asc + desc * 0.9;
      return { h, draw(x, y, align) {
        setFont(ctx, fam, s); const base = y + asc; const w = textW(ctx, txt);
        const x0 = align === 'center' ? x - w / 2 : align === 'right' ? x - w : x;
        const color = it.color || D.P.script;
        ctx.save();
        if (it.halo) { ctx.lineJoin = 'round'; ctx.lineWidth = s * 0.07; ctx.strokeStyle = it.halo; drawText(ctx, txt, x, base, { align, stroke: true }); }
        if (color === 'gold') { if (D.P.dark || it.onDark) { ctx.shadowColor = 'rgba(0,0,0,.45)'; ctx.shadowBlur = s * 0.08; ctx.shadowOffsetY = s * 0.025; ctx.fillStyle = goldFill(D, x0, base - s * 0.7, x0 + w, base + s * 0.2); } else ctx.fillStyle = textGold(D, x0, base - s * 0.7, x0 + w, base + s * 0.2); }
        else { if (it.shadow) { ctx.shadowColor = it.shadow; ctx.shadowBlur = s * 0.1; ctx.shadowOffsetY = s * 0.03; } ctx.fillStyle = color; }
        drawText(ctx, txt, x, base, { align }); ctx.restore();
      } };
    },
    city(D, it, k, maxW) {
      const { ctx } = D; let txt = it.text || (it.cityOnly ? D.copy.cityOnly : D.copy.city); if (!txt) return null;
      const style = it.style || 'caps'; if (style === 'caps') txt = txt.toUpperCase();
      const fam = style === 'caps' ? (D.premier ? 'jost' : 'cinzel') : style === 'italic' ? 'cormorant' : 'playfair';
      const weight = style === 'caps' ? (D.premier ? 400 : 600) : style === 'italic' ? 500 : 600;
      const fst = style === 'italic' ? 'italic' : 'normal'; const tr = style === 'caps' ? (it.track ?? 0.16) : 0;
      const s = fit(ctx, txt, fam, (it.size || 58) * k, maxW, { weight, style: fst, trackEm: tr });
      return { h: s * 1.08, draw(x, y, align) { setFont(ctx, fam, s, weight, fst); ctx.fillStyle = it.color || D.P.ink; drawText(ctx, txt, x, y + s * 0.86, { align, track: s * tr }); } };
    },
    price(D, it, k, maxW) {
      const { ctx } = D; if (!D.copy.price) return null; const label = it.label === false ? '' : D.copy.priceLabel;
      const ps = fit(ctx, D.copy.price, it.fam || 'playfair', (it.size || 76) * k, maxW, { weight: it.weight || 600 });
      const ls = label ? fit(ctx, label, 'sans', Math.max(14, ps * 0.24), maxW, { weight: 600, trackEm: 0.3 }) : 0;
      const prev = D.copy.prevPrice; const pvs = prev ? Math.max(14, ps * 0.32) : 0;
      return { h: (label ? ls * 1.6 : 0) + ps * 1.02 + (prev ? pvs * 1.5 : 0), draw(x, y, align) {
        let yy = y;
        if (label) { setFont(ctx, 'sans', ls, 600); ctx.fillStyle = it.labelColor || D.P.muted; drawText(ctx, label, x, yy + ls, { align, track: ls * 0.3 }); yy += ls * 1.6; }
        setFont(ctx, it.fam || 'playfair', ps, it.weight || 600); const w = textW(ctx, D.copy.price);
        const x0 = align === 'center' ? x - w / 2 : align === 'right' ? x - w : x;
        ctx.fillStyle = it.gold ? (it.onDark ? goldFill(D, x0, yy, x0 + w, yy + ps) : textGold(D, x0, yy, x0 + w, yy + ps)) : (it.color || D.P.ink); drawText(ctx, D.copy.price, x, yy + ps * 0.82, { align }); yy += ps * 1.02;
        if (prev) { setFont(ctx, 'sans', pvs, 500); ctx.fillStyle = D.P.muted; const t = 'WAS ' + prev; const pw = drawText(ctx, t, x, yy + pvs * 1.15, { align, track: pvs * 0.12 });
          const px0 = align === 'center' ? x - pw / 2 : align === 'right' ? x - pw : x; ctx.fillRect(px0 + pvs * 2.3, yy + pvs * 0.78, pw - pvs * 2.3, Math.max(1, pvs * 0.08)); }
      } };
    },
    line(D, it, k, maxW) { // generic small tracked line: date, facts, oh, cta
      const { ctx } = D; const txt = it.text != null ? it.text : D.copy[it.key]; if (!txt) return null;
      const fam = it.fam || (D.premier ? 'jost' : 'sans'); const tr = it.track ?? 0.22;
      const s = fit(ctx, txt, fam, (it.size || 24) * k, maxW, { weight: it.weight || 600, trackEm: tr });
      return { h: s * 1.25, draw(x, y, align) { setFont(ctx, fam, s, it.weight || 600); ctx.fillStyle = it.color || D.P.muted; drawText(ctx, txt, x, y + s, { align, track: s * tr }); } };
    },
    tagline(D, it, k, maxW) {
      const { ctx } = D; const txt = it.text || D.copy.tagline; if (!txt) return null;
      const s = fit(ctx, txt, 'cormorant', (it.size || 40) * k, maxW, { weight: 500, style: 'italic' });
      return { h: s * 1.15, draw(x, y, align) { setFont(ctx, 'cormorant', s, 500, 'italic'); ctx.fillStyle = it.color || D.P.muted; drawText(ctx, txt, x, y + s * 0.85, { align }); } };
    },
    stats(D, it, k, maxW) {
      const { ctx } = D; const list = statsList(D.agent); if (!list.length) return null;
      const sep = '   ◆   '; let ns = (it.size || 30) * k;
      const measure = (n) => { setFont(ctx, 'playfair', n, 600); let w = 0; list.forEach(([v], i) => { w += ctx.measureText(v).width; setFont(ctx, 'sans', n * 0.5, 600); w += trackW(ctx, ' ' + list[i][1], n * 0.06); if (i < list.length - 1) w += ctx.measureText(sep).width; setFont(ctx, 'playfair', n, 600); }); return w; };
      let w = measure(ns); if (w > maxW) { ns *= maxW / w * 0.98; w = measure(ns); }
      return { h: ns * 1.2, draw(x, y, align) {
        let cx = align === 'center' ? x - w / 2 : align === 'right' ? x - w : x; const base = y + ns * 0.95;
        list.forEach(([v, l], i) => {
          setFont(ctx, 'playfair', ns, 600); ctx.fillStyle = it.gold === false ? (it.color || D.P.ink) : (it.onDark ? goldFill(D, cx, base - ns, cx + ns * 3, base) : textGold(D, cx, base - ns, cx + ns * 3, base)); cx += drawText(ctx, v, cx, base);
          setFont(ctx, 'sans', ns * 0.5, 600); ctx.fillStyle = it.labelColor || D.P.muted; cx += drawText(ctx, ' ' + l, cx, base, { track: ns * 0.06 });
          if (i < list.length - 1) { ctx.fillStyle = D.P.accent; cx += drawText(ctx, sep, cx, base - ns * 0.12); }
        });
      } };
    },
    rule(D, it, k, maxW) { const w = Math.min(maxW, (it.w || 360) * k); return { h: 14 * k, draw(x, y, align) { const cx = align === 'center' ? x : align === 'right' ? x - w / 2 : x + w / 2; ruleOrn(D, cx, y + 7 * k, w, it.color); } }; },
    gap(D, it, k) { return { h: (it.h || 20) * k, draw() {} }; },
    stars(D, it, k, maxW) {
      const { ctx } = D; const s = Math.min((it.size || 40) * k, maxW / 6);
      return { h: s * 1.1, draw(x, y, align) { const w = s * 5.4; let sx = align === 'center' ? x - w / 2 : align === 'right' ? x - w : x; ctx.fillStyle = goldFill(D, sx, y, sx + w, y + s); for (let i = 0; i < 5; i++) { star(ctx, sx + s * 0.5 + i * s * 1.1, y + s * 0.55, s * 0.5); } } };
    },
    review(D, it, k, maxW) {
      const { ctx } = D; const txt = D.copy.review; if (!txt) return null; let s = (it.size || 40) * k;
      setFont(ctx, 'cormorant', s, 500, 'italic'); let lines = wrap(ctx, '“' + txt + '”', maxW);
      while (lines.length > (it.maxLines || 7) && s > 16) { s *= 0.92; setFont(ctx, 'cormorant', s, 500, 'italic'); lines = wrap(ctx, '“' + txt + '”', maxW); }
      const by = D.copy.reviewer ? '— ' + D.copy.reviewer + (D.copy.reviewRole ? ', ' + D.copy.reviewRole : '') : '';
      const bs = s * 0.5;
      return { h: lines.length * s * 1.18 + (by ? bs * 2.2 : 0), draw(x, y, align) {
        setFont(ctx, 'cormorant', s, 500, 'italic'); ctx.fillStyle = it.color || D.P.ink;
        lines.forEach((l, i) => drawText(ctx, l, x, y + s * 0.9 + i * s * 1.18, { align }));
        if (by) { setFont(ctx, 'sans', bs, 600); ctx.fillStyle = D.P.accent; drawText(ctx, by.toUpperCase(), x, y + lines.length * s * 1.18 + bs * 1.6, { align, track: bs * 0.2 }); }
      } };
    },
  };
  function star(ctx, cx, cy, r) { ctx.beginPath(); for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5; const rr2 = i % 2 ? r * 0.45 : r; ctx.lineTo(cx + Math.cos(a) * rr2, cy + Math.sin(a) * rr2); } ctx.closePath(); ctx.fill(); }

  // items: array of {t, ...}; box: {x,y,w,h}; align: left|center|right; valign: 0..1
  function stack(D, box, items, { align = 'center', valign = 0.5, gap = 18, k0 = 1 } = {}) {
    const run = (k) => items.map((it) => { const f = ITEM[it.t]; const m = f ? f(D, it, k, box.w) : null; return m ? { m, gap: (it.gapAfter ?? gap) * k } : null; }).filter(Boolean);
    let k = k0; let ms = run(k); const total = (arr) => arr.reduce((s, a, i) => s + a.m.h + (i < arr.length - 1 ? a.gap : 0), 0);
    let t = total(ms);
    for (let i = 0; i < 3 && t > box.h; i++) { k *= Math.max(0.3, box.h / t) * 0.99; ms = run(k); t = total(ms); }
    let y = box.y + (box.h - t) * valign; const x = align === 'center' ? box.x + box.w / 2 : align === 'right' ? box.x + box.w : box.x;
    ms.forEach((a) => { a.m.draw(x, y, align); y += a.m.h + a.gap; });
    return { k, h: t };
  }

  // Agent identity in a row: [headshot] name/title/contact [QR]
  function identityRow(D, box, o = {}) {
    const { ctx } = D; const a = D.agent; const h = box.h; const showQR = o.qr !== false; const showHead = o.head !== false;
    const r = showHead ? Math.min(h * 0.46, 130 * D.u) : 0; const qs = showQR ? Math.min(h, (o.qrMax || 230) * D.u) : 0;
    let x = box.x; const cy = box.y + h / 2; const right = box.x + box.w;
    const flip = o.qrLeft;
    if (showHead) { const hx = flip ? right - r - 6 * D.u : x + r + 6 * D.u; headshot(D, hx, cy, r, { gap: o.gap }); }
    if (showQR) { const qx = flip ? box.x : right - qs; qr(D, qx, box.y + (h - qs * 1.15) / 2, qs, { label: o.qrLabel }); }
    const tx0 = flip ? box.x + qs + 28 * D.u : x + (showHead ? r * 2 + 34 * D.u : 0);
    const tx1 = flip ? right - (showHead ? r * 2 + 34 * D.u : 0) : right - (showQR ? qs + 28 * D.u : 0);
    const tw = tx1 - tx0; const lines = [];
    lines.push({ t: 'line', text: a.name || '', fam: 'playfair', weight: 600, track: 0, size: o.nameSize || 46, color: o.nameColor || D.P.ink, gapAfter: 6 });
    if (a.title) lines.push({ t: 'line', text: a.title.toUpperCase(), size: 19, track: 0.2, color: D.P.accent, weight: 600, gapAfter: 10 });
    const contact = [a.phone, a.license ? 'DRE #' + a.license : ''].filter(Boolean).join('   |   ');
    if (contact) lines.push({ t: 'line', text: contact, size: 21, track: 0.08, color: o.mutedColor || D.P.muted, weight: 500, gapAfter: 8 });
    if (o.stats) lines.push({ t: 'stats', size: 26 });
    if (o.tagline && a.tagline) lines.push({ t: 'tagline', text: a.tagline, size: 30 });
    stack(D, { x: tx0, y: box.y, w: tw, h }, lines, { align: o.align || (flip ? 'right' : 'left'), gap: 8 });
  }
  // Agent identity stacked & centered: headshot on top, then name/title/contact
  function identityCenter(D, box, o = {}) {
    const a = D.agent; const r = Math.min(box.w * 0.2, box.h * 0.27, (o.rMax || 120) * D.u);
    const showHead = o.head !== false;
    let y = box.y;
    if (showHead) { headshot(D, box.x + box.w / 2, y + r * 1.09, r, { gap: o.gap }); y += r * 2.25 + 14 * D.u; }
    const items = [{ t: 'line', text: a.name || '', fam: 'playfair', weight: 600, track: 0, size: o.nameSize || 46, color: D.P.ink, gapAfter: 6 }];
    if (a.title) items.push({ t: 'line', text: a.title.toUpperCase(), size: 19, track: 0.22, color: D.P.accent, gapAfter: 10 });
    const contact = [a.phone, a.license ? 'DRE #' + a.license : ''].filter(Boolean).join('   |   ');
    if (contact) items.push({ t: 'line', text: contact, size: 21, track: 0.08, weight: 500 });
    if (o.stats) items.push({ t: 'stats', size: 26 });
    stack(D, { x: box.x, y, w: box.w, h: box.y + box.h - y }, items, { align: 'center', valign: 0, gap: 8 });
  }
  function finePrint(D) {
    const b = D.brand || {}; const a = D.agent;
    const tpl = b.finePrint || '{agent} · DRE #{license} | Redfin · DRE #01521930';
    return tpl.replace('{agent}', a.name || '').replace('{license}', a.license || '').replace(/ ?· DRE #(\s|\||$)/, '$1').trim();
  }
  // Brand footer: logo + fine print. box gives the band; align center|left|right.
  function footer(D, box, o = {}) {
    const { ctx } = D; const onDark = o.onDark ?? D.P.dark; const fp = o.finePrint === false ? '' : finePrint(D);
    const k = D.premier ? PREMIER_K : 1;
    const lh = o.logo === false ? 0 : Math.min(box.h * (fp ? 0.52 : 0.8) / k, (o.logoMax || 46) * D.u);
    const x = o.align === 'left' ? box.x : o.align === 'right' ? box.x + box.w : box.x + box.w / 2;
    const fpS = fp ? fit(ctx, fp, 'sans', 15 * D.u, box.w, { weight: 500, trackEm: 0.06 }) : 0;
    const mh = lh * k; const total = mh + (fp ? fpS * 2.1 : 0); const y0 = box.y + (box.h - total) / 2;
    if (lh) brandMark(D, x, y0, lh, o.align || 'center', onDark);
    if (fp) { setFont(ctx, 'sans', fpS, 500); ctx.fillStyle = o.fpColor || alpha(onDark ? '#FFFFFF' : D.P.ink, onDark ? 0.62 : 0.55); drawText(ctx, fp, x, y0 + mh + fpS * 1.75, { align: o.align || 'center', track: fpS * 0.06 }); }
  }

  /* ------------------------------------------------------------------ layout kit */
  // Region math for the three vertical formats; wide gets its own branch in each layout.
  function V(D, story, feed, square) { return D.fmt === 'story' ? story : D.fmt === 'feed' ? feed : square; }
  // A wide (1.91:1) composition shared by several layouts: photo frame on one side, info on the other.
  function wideComposer(D, o = {}) {
    const { ctx, W, H } = D; const m = 36; const photoW = W * (o.photoFrac || 0.5); const left = o.photoRight ? W - m - photoW : m;
    const box = { x: left, y: m, w: photoW, h: H - m * 2 };
    const shape = o.shape || 'rect';
    const pf = () => { if (shape === 'arch') arch(ctx, box.x, box.y, box.w, box.h); else if (shape === 'capsule') rr(ctx, box.x, box.y, box.w, box.h, box.w / 2); else rr(ctx, box.x, box.y, box.w, box.h, o.radius ?? 18); };
    framePhoto(D, pf, box, { blur: 30, oy: 12 });
    const tx = o.photoRight ? m + 12 : left + photoW + 40; const tw = W - photoW - m * 2 - 52;
    const items = o.items || defaultItems(D, { script: 120, city: 40, price: 54, compact: true });
    stack(D, { x: tx, y: m + 4, w: tw, h: H * 0.56 }, items, { align: o.align || 'center', gap: 10 });
    identityRow(D, { x: tx, y: H * 0.6, w: tw, h: H * 0.22 }, { qrMax: 140, nameSize: 34 });
    footer(D, { x: tx, y: H * 0.84, w: tw, h: H * 0.13 }, { logoMax: 40, align: o.align === 'left' ? 'left' : 'center' });
  }
  function defaultItems(D, o = {}) {
    const items = [{ t: 'eyebrow', size: o.eyebrow || 24 }];
    items.push({ t: 'script', size: o.script || 170, color: o.scriptColor, halo: o.halo });
    if (D.type === 'client_review') { items.push({ t: 'stars', size: o.compact ? 26 : 38 }); items.push({ t: 'review', size: o.compact ? 26 : 38, maxLines: o.compact ? 4 : 7 }); return items; }
    items.push({ t: 'city', size: o.city || 56, style: o.cityStyle || 'caps' });
    if (D.copy.oh) items.push({ t: 'line', key: 'oh', size: o.compact ? 22 : 30, color: D.P.ink, weight: 700 });
    if (D.copy.facts) items.push({ t: 'line', key: 'facts', size: o.compact ? 18 : 22 });
    items.push({ t: 'price', size: o.price || 74, gold: o.priceGold });
    if (D.copy.date && !o.noDate) items.push({ t: 'line', key: 'date', size: o.compact ? 17 : 21 });
    return items;
  }

  /* ------------------------------------------------------------------ the 15 layouts */
  const LAYOUTS = [];
  function def(id, name, blurb, palettes, premierPalettes, fn) { LAYOUTS.push({ id, name, blurb, palettes, premierPalettes, fn }); }

  // 1 — Magazine Cover
  def('magazine', 'Magazine Cover', 'Full-bleed cover photo, masthead city, editorial columns.', ['ivory', 'marble', 'coastal'], ['putty', 'stone'], (D) => {
    const { ctx, W, H, u } = D; fillBg(D, D.P.bg); texture(D, 0.04);
    if (D.fmt === 'wide') {
      const pw = W * 0.56; framePhoto(D, () => { ctx.beginPath(); ctx.rect(W - pw, 0, pw, H); }, { x: W - pw, y: 0, w: pw, h: H }, { shadow: false, stroke: false });
      setFont(ctx, 'cinzel', 20, 600); ctx.fillStyle = alpha('#FFFFFF', 0.9); drawText(ctx, (D.copy.cityOnly + ' LIVING').toUpperCase(), W - pw / 2, 48, { align: 'center', track: 8 });
      const tw = W - pw - 70; stack(D, { x: 36, y: 34, w: tw, h: H * 0.58 }, defaultItems(D, { script: 110, city: 36, price: 52, compact: true }), { gap: 10 });
      identityRow(D, { x: 36, y: H * 0.62, w: tw, h: H * 0.2 }, { qrMax: 125, nameSize: 30 });
      footer(D, { x: 36, y: H * 0.85, w: tw, h: H * 0.12 }, { logoMax: 38 }); frameBorder(D, 14, null, 1.5); return;
    }
    const ph = H * V(D, 0.6, 0.52, 0.47);
    framePhoto(D, () => { ctx.beginPath(); ctx.rect(0, 0, W, ph); }, { x: 0, y: 0, w: W, h: ph }, { shadow: false, stroke: false });
    const g = ctx.createLinearGradient(0, 0, 0, ph * 0.3); g.addColorStop(0, 'rgba(0,0,0,.42)'); g.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = g; ctx.fillRect(0, 0, W, ph * 0.3);
    const mast = (D.copy.cityOnly || 'Southern California').toUpperCase();
    const ms = fit(ctx, mast, 'cinzel', 92 * u, W - 140 * u, { weight: 600, trackEm: 0.14 }); setFont(ctx, 'cinzel', ms, 600); ctx.fillStyle = alpha('#FFFFFF', 0.92);
    drawText(ctx, mast, W / 2, 56 * u + ms, { align: 'center', track: ms * 0.14 });
    setFont(ctx, 'sans', 17 * u, 600); ctx.fillStyle = alpha('#FFFFFF', 0.85); drawText(ctx, 'LIVING  ·  ' + D.monthLine, W / 2, 56 * u + ms + 38 * u, { align: 'center', track: 6 * u });
    // script straddling the photo edge
    const sItem = ITEM.script(D, { size: V(D, 200, 170, 150), halo: D.P.bg }, 1, W - 120 * u); sItem.draw(W / 2, ph - sItem.h * 0.62, 'center');
    const top = ph + sItem.h * 0.42; const idH = V(D, 190, 150, 130) * u; const footH = V(D, 120, 96, 90) * u;
    const items = [{ t: 'eyebrow', size: 24 }, { t: 'city', size: 50 }];
    if (D.type === 'client_review') items.push({ t: 'stars', size: 32 }, { t: 'review', size: 34, maxLines: D.fmt === 'story' ? 7 : 4 });
    else { if (D.copy.oh) items.push({ t: 'line', key: 'oh', size: 28, color: D.P.ink, weight: 700 }); if (D.copy.facts) items.push({ t: 'line', key: 'facts', size: 20 }); items.push({ t: 'price', size: 70 }); if (D.copy.date) items.push({ t: 'line', key: 'date', size: 20 }); }
    if (D.fmt === 'story') items.push({ t: 'rule', w: 300 }, { t: 'stats', size: 28 });
    stack(D, { x: 80 * u, y: top, w: W - 160 * u, h: H - top - idH - footH - 30 * u }, items, { gap: 14 });
    identityRow(D, { x: 70 * u, y: H - idH - footH - 14 * u, w: W - 140 * u, h: idH }, { stats: D.fmt !== 'story' && D.fmt !== 'square' });
    footer(D, { x: 0, y: H - footH, w: W, h: footH - 18 * u });
    frameBorder(D, 22 * u, null, 1.5);
  });

  // 2 — Cinematic Split
  def('cinematic', 'Cinematic Split', 'Dark cinematic band, panoramic photo on the seam, cream details.', ['ivory', 'coastal', 'bronze'], ['putty', 'stone'], (D) => {
    const { ctx, W, H, u } = D; const band = D.P.band;
    if (D.fmt === 'wide') {
      fillBg(D, D.P.bg); ctx.fillStyle = band; ctx.fillRect(0, 0, W * 0.42, H); texture(D, 0.05);
      const dk = Object.assign({}, D, { P: Object.assign({}, D.P, { dark: true, ink: '#F5EFE3', muted: alpha('#F5EFE3', 0.72), script: 'gold', card: band }) });
      const pb = { x: W * 0.46, y: 34, w: W * 0.5, h: H * 0.56 }; framePhoto(D, () => rr(ctx, pb.x, pb.y, pb.w, pb.h, 14), pb);
      stack(dk, { x: 34, y: 28, w: W * 0.42 - 68, h: H * 0.5 }, [{ t: 'eyebrow', size: 17, flank: false }, { t: 'script', size: 120, color: 'gold' }, { t: 'tagline', size: 26 }], { align: 'left', gap: 8 });
      identityRow(dk, { x: 34, y: H * 0.6, w: W * 0.42 - 60, h: H * 0.2 }, { qr: false, nameSize: 30, gap: band });
      footer(dk, { x: 34, y: H * 0.84, w: W * 0.42 - 60, h: H * 0.13 }, { align: 'left', onDark: true, logoMax: 34, finePrint: false });
      stack(D, { x: pb.x, y: pb.y + pb.h + 16, w: pb.w - 150, h: H - pb.y - pb.h - 34 }, [{ t: 'city', size: 32, style: 'serif' }, { t: 'price', size: 44, gold: true }, { t: 'line', key: 'date', size: 14 }], { align: 'left', gap: 6 });
      qr(D, W - 34 - 120, pb.y + pb.h + 16, 120, { label: 'SCAN' });
      return;
    }
    const bandH = H * V(D, 0.4, 0.4, 0.42); fillBg(D, D.P.bg); texture(D, 0.04);
    ctx.fillStyle = band; ctx.fillRect(0, 0, W, bandH);
    const g = ctx.createLinearGradient(0, 0, 0, bandH); g.addColorStop(0, 'rgba(255,255,255,.05)'); g.addColorStop(1, 'rgba(0,0,0,.25)'); ctx.fillStyle = g; ctx.fillRect(0, 0, W, bandH);
    const dk = Object.assign({}, D, { P: Object.assign({}, D.P, { dark: true, ink: '#F5EFE3', muted: alpha('#F5EFE3', 0.7), script: 'gold' }) });
    const ph = H * V(D, 0.3, 0.3, 0.29); const pb = { x: 70 * u, y: bandH - ph * 0.55, w: W - 140 * u, h: ph };
    stack(dk, { x: 60 * u, y: 40 * u, w: W - 120 * u, h: pb.y - 50 * u }, [{ t: 'eyebrow', size: 24 }, { t: 'script', size: V(D, 210, 170, 150), color: 'gold' }, ...(D.fmt === 'story' ? [{ t: 'tagline', size: 34, color: alpha('#F5EFE3', 0.75) }] : [])], { gap: 10 });
    framePhoto(D, () => rr(ctx, pb.x, pb.y, pb.w, pb.h, 20 * u), pb);
    const footH = V(D, 120, 96, 86) * u; const idH = V(D, 190, 150, 128) * u;
    const top = pb.y + pb.h + 30 * u;
    const items = [];
    if (D.type === 'client_review') items.push({ t: 'stars', size: 32 }, { t: 'review', size: 34, maxLines: D.fmt === 'story' ? 7 : 4 });
    else { items.push({ t: 'city', size: 54, style: 'serif' }); if (D.copy.oh) items.push({ t: 'line', key: 'oh', size: 28, color: D.P.ink, weight: 700 }); if (D.copy.facts) items.push({ t: 'line', key: 'facts', size: 20 }); items.push({ t: 'price', size: 66, gold: true }); if (D.copy.date) items.push({ t: 'line', key: 'date', size: 20 }); }
    if (D.fmt === 'story') items.push({ t: 'gap', h: 6 }, { t: 'stats', size: 28 });
    stack(D, { x: 80 * u, y: top, w: W - 160 * u, h: H - top - idH - footH - 20 * u }, items, { gap: 12 });
    identityRow(D, { x: 70 * u, y: H - idH - footH - 10 * u, w: W - 140 * u, h: idH }, {});
    ctx.fillStyle = D.P.line; ctx.fillRect(70 * u, H - footH - 4 * u, W - 140 * u, 1.5 * u);
    footer(D, { x: 0, y: H - footH, w: W, h: footH - 12 * u });
  });

  // 3 — Cathedral Arch
  def('arch', 'Cathedral Arch', 'Tall arched window frame, symmetrical and stately.', ['parchment', 'ivory', 'sage'], ['putty', 'stone'], (D) => {
    const { ctx, W, H, u } = D; fillBg(D, D.P.bg, D.P.bg2); texture(D, 0.05);
    if (D.fmt === 'wide') { wideComposer(D, { shape: 'arch', photoFrac: 0.34 }); return; }
    const aw = W * V(D, 0.68, 0.5, 0.42); const ah = H * V(D, 0.46, 0.46, 0.46); const ax = (W - aw) / 2; const ay = V(D, 150, 112, 96) * u;
    stack(D, { x: 60 * u, y: 36 * u, w: W - 120 * u, h: ay - 50 * u }, [{ t: 'eyebrow', size: 24 }], {});
    // outer gold arch line
    ctx.save(); arch(ctx, ax - 16 * u, ay - 16 * u, aw + 32 * u, ah + 32 * u); ctx.strokeStyle = goldFill(D, ax, ay, ax + aw, ay + ah); ctx.lineWidth = 2 * u; ctx.stroke(); ctx.restore();
    framePhoto(D, () => arch(ctx, ax, ay, aw, ah), { x: ax, y: ay, w: aw, h: ah });
    const si = ITEM.script(D, { size: V(D, 200, 160, 140), halo: D.P.bg }, 1, W - 100 * u); si.draw(W / 2, ay + ah - si.h * 0.55, 'center');
    const footH = V(D, 110, 92, 84) * u; const idH = V(D, 250, 150, 130) * u;
    const top = ay + ah + si.h * 0.5;
    const items = D.type === 'client_review' ? [{ t: 'stars', size: 30 }, { t: 'review', size: 32, maxLines: D.fmt === 'story' ? 7 : 4 }] : [{ t: 'city', size: 46 }, ...(D.copy.oh ? [{ t: 'line', key: 'oh', size: 26, color: D.P.ink, weight: 700 }] : []), ...(D.copy.facts ? [{ t: 'line', key: 'facts', size: 19 }] : []), { t: 'price', size: 60 }, ...(D.copy.date ? [{ t: 'line', key: 'date', size: 19 }] : [])];
    stack(D, { x: 90 * u, y: top, w: W - 180 * u, h: H - top - idH - footH - 10 * u }, items, { gap: 10 });
    if (D.fmt !== 'story') { identityRow(D, { x: 70 * u, y: H - idH - footH + 10 * u, w: W - 140 * u, h: idH - 20 * u }, {}); }
    else {
    // symmetrical identity: stats left, headshot centre, QR right
      const iy = H - idH - footH; const r = Math.min(idH * 0.36, 100 * u);
      headshot(D, W / 2, iy + r + 8 * u, r);
      stack(D, { x: W / 2 - 230 * u, y: iy + r * 2 + 22 * u, w: 460 * u, h: idH - r * 2 - 24 * u }, [{ t: 'line', text: D.agent.name, fam: 'playfair', track: 0, size: 40, color: D.P.ink, weight: 600, gapAfter: 4 }, { t: 'line', text: (D.agent.title || '').toUpperCase(), size: 17, color: D.P.accent }], { gap: 4, valign: 0 });
      const sideW = W / 2 - r - 90 * u;
      const st = statsList(D.agent);
      if (st.length) stack(D, { x: 60 * u, y: iy, w: sideW, h: idH * 0.8 }, st.flatMap(([v, l]) => [{ t: 'line', text: v, fam: 'playfair', track: 0, size: 40, color: D.P.ink, weight: 600, gapAfter: 0 }, { t: 'line', text: l, size: 14, gapAfter: 10 }]), { align: 'left', gap: 2 });
      else stack(D, { x: 60 * u, y: iy, w: sideW, h: idH * 0.8 }, [{ t: 'line', text: D.agent.phone || '', size: 22, color: D.P.ink }], { align: 'left' });
      const qs = Math.min(sideW * 0.8, idH * 0.72); qr(D, W - 60 * u - qs, iy + (idH * 0.85 - qs * 1.15) / 2, qs);
    }
    footer(D, { x: 0, y: H - footH, w: W, h: footH - 14 * u });
  });

  // 4 — Certificate of Success
  def('certificate', 'Certificate of Success', 'Ornate certificate border, monogram crest, panoramic photo.', ['coastal', 'parchment', 'marble'], ['stone', 'putty'], (D) => {
    const { ctx, W, H, u } = D; fillBg(D, D.P.bg); texture(D, 0.05);
    const ins = 26 * u; frameBorder(D, ins, null, 2.5); frameBorder(D, ins + 12 * u, null, 1); corners(D, ins + 24 * u, ins + 24 * u, W - (ins + 24 * u) * 2, H - (ins + 24 * u) * 2, 48 * u);
    if (D.fmt === 'wide') { monogramCrest(D, W * 0.73, 120, 70, 0.16); wideComposer(D, { photoFrac: 0.46, radius: 6 }); return; }
    const crestR = V(D, 120, 84, 72) * u; const cy = V(D, 120, 92, 84) * u + crestR * 0.6;
    monogramCrest(D, W / 2, cy + crestR * 0.4, crestR * 1.6, 0.12);
    const head = [{ t: 'line', text: 'CERTIFICATE OF SUCCESS', fam: 'cinzel', size: 22, track: 0.3, color: D.P.accent, gapAfter: 10 }, { t: 'script', size: V(D, 190, 150, 130) }, { t: 'eyebrow', size: 22 }];
    const r1 = stack(D, { x: 90 * u, y: V(D, 100, 76, 70) * u, w: W - 180 * u, h: H * V(D, 0.24, 0.27, 0.29) }, head, { gap: 8 });
    const py = V(D, 100, 76, 70) * u + H * V(D, 0.24, 0.27, 0.29) + 16 * u; const ph = H * V(D, 0.28, 0.26, 0.25);
    const pb = { x: 96 * u, y: py, w: W - 192 * u, h: ph };
    framePhoto(D, () => rr(ctx, pb.x, pb.y, pb.w, pb.h, 6 * u), pb, { strokeW: 4 * u });
    const footH = V(D, 110, 90, 84) * u; const idH = V(D, 180, 140, 120) * u;
    const top = py + ph + 26 * u;
    const items = D.type === 'client_review' ? [{ t: 'stars', size: 30 }, { t: 'review', size: 32, maxLines: D.fmt === 'story' ? 7 : 4 }] : [{ t: 'city', size: 46 }, ...(D.copy.oh ? [{ t: 'line', key: 'oh', size: 26, color: D.P.ink, weight: 700 }] : []), ...(D.copy.facts ? [{ t: 'line', key: 'facts', size: 19 }] : []), { t: 'price', size: 58 }, ...(D.copy.date ? [{ t: 'line', key: 'date', size: 19 }] : [])];
    if (D.fmt === 'story') items.push({ t: 'rule', w: 260 }, { t: 'stats', size: 26 });
    stack(D, { x: 100 * u, y: top, w: W - 200 * u, h: H - top - idH - footH - 16 * u }, items, { gap: 10 });
    identityRow(D, { x: 96 * u, y: H - idH - footH - 6 * u, w: W - 192 * u, h: idH }, { stats: D.fmt === 'feed' });
    footer(D, { x: 0, y: H - footH - 8 * u, w: W, h: footH - 10 * u });
  });

  // 5 — Full-Bleed Story
  def('fullbleed', 'Full-Bleed Story', 'Photo fills the frame; gold script and glass details over a dusk gradient.', ['noir', 'espresso', 'slate'], ['umber', 'mushroom'], (D) => {
    const { ctx, W, H, u } = D;
    framePhoto(D, () => { ctx.beginPath(); ctx.rect(0, 0, W, H); }, { x: 0, y: 0, w: W, h: H }, { shadow: false, stroke: false });
    const base = D.P.bg2;
    if (D.fmt === 'wide') {
      const g = ctx.createLinearGradient(0, 0, W * 0.75, 0); g.addColorStop(0, alpha(base, 0.94)); g.addColorStop(0.55, alpha(base, 0.75)); g.addColorStop(1, alpha(base, 0)); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      stack(D, { x: 40, y: 30, w: W * 0.46, h: H * 0.58 }, defaultItems(D, { script: 120, city: 36, price: 50, compact: true, scriptColor: 'gold', priceGold: true }), { align: 'left', gap: 10 });
      identityRow(D, { x: 40, y: H * 0.62, w: W * 0.5, h: H * 0.21 }, { qrMax: 120, nameSize: 30, gap: D.P.bg2 });
      footer(D, { x: 40, y: H * 0.86, w: W * 0.5, h: H * 0.11 }, { align: 'left', logoMax: 36, onDark: true }); return;
    }
    const g = ctx.createLinearGradient(0, H * 0.32, 0, H); g.addColorStop(0, alpha(base, 0)); g.addColorStop(0.38, alpha(base, 0.86)); g.addColorStop(1, alpha(base, 0.98)); ctx.fillStyle = g; ctx.fillRect(0, H * 0.32, W, H * 0.68);
    const g2 = ctx.createLinearGradient(0, 0, 0, H * 0.18); g2.addColorStop(0, 'rgba(0,0,0,.5)'); g2.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = g2; ctx.fillRect(0, 0, W, H * 0.18);
    brandMark(D, 60 * u, 52 * u, 40 * u, 'left', true);
    // eyebrow pill top-right
    setFont(ctx, D.premier ? 'jost' : 'sans', 19 * u, 600); const ew = textW(ctx, D.copy.eyebrow, 19 * u * 0.22) + 48 * u; const ex = W - 60 * u - ew;
    rr(ctx, ex, 46 * u, ew, 50 * u, 25 * u); ctx.fillStyle = 'rgba(255,255,255,.14)'; ctx.fill(); ctx.strokeStyle = 'rgba(255,255,255,.45)'; ctx.lineWidth = 1.5 * u; ctx.stroke();
    ctx.fillStyle = '#FFFFFF'; drawText(ctx, D.copy.eyebrow, ex + ew / 2, 46 * u + 32 * u, { align: 'center', track: 19 * u * 0.22 });
    const footH = V(D, 110, 92, 84) * u; const idH = V(D, 200, 160, 140) * u;
    const items = [{ t: 'script', size: V(D, 230, 190, 160), color: 'gold' }];
    if (D.type === 'client_review') items.push({ t: 'stars', size: 32 }, { t: 'review', size: 34, maxLines: 4, color: '#FFFFFF' });
    else { items.push({ t: 'city', size: 52, color: '#FFFFFF' }); if (D.copy.oh) items.push({ t: 'line', key: 'oh', size: 28, color: '#FFFFFF', weight: 700 }); if (D.copy.facts) items.push({ t: 'line', key: 'facts', size: 20, color: alpha('#FFFFFF', 0.8) }); items.push({ t: 'price', size: 76, gold: true, labelColor: alpha('#FFFFFF', 0.75) }); if (D.copy.date) items.push({ t: 'line', key: 'date', size: 20, color: alpha('#FFFFFF', 0.75) }); }
    if (D.fmt === 'story') items.push({ t: 'stats', size: 28, labelColor: alpha('#FFFFFF', 0.75) });
    const top = H * V(D, 0.44, 0.36, 0.3);
    stack(D, { x: 70 * u, y: top, w: W - 140 * u, h: H - top - idH - footH - 24 * u }, items, { gap: 14, valign: 1 });
    // glass identity card
    const cb = { x: 50 * u, y: H - idH - footH - 6 * u, w: W - 100 * u, h: idH };
    rr(ctx, cb.x, cb.y, cb.w, cb.h, 28 * u); ctx.fillStyle = 'rgba(255,255,255,.10)'; ctx.fill(); ctx.strokeStyle = 'rgba(255,255,255,.3)'; ctx.lineWidth = 1.5 * u; ctx.stroke();
    const glass = Object.assign({}, D, { P: Object.assign({}, D.P, { ink: '#FFFFFF', muted: alpha('#FFFFFF', 0.78) }) });
    identityRow(glass, { x: cb.x + 22 * u, y: cb.y + 18 * u, w: cb.w - 44 * u, h: cb.h - 36 * u }, { gap: D.P.bg2 });
    footer(D, { x: 0, y: H - footH, w: W, h: footH - 14 * u }, { onDark: true, logo: false, fpColor: alpha('#FFFFFF', 0.6) });
  });

  // 6 — Polaroid Prestige
  def('polaroid', 'Polaroid Prestige', 'Property and agent as tilted instant prints with handwritten script.', ['slate', 'noir', 'espresso'], ['mushroom', 'umber'], (D) => {
    const { ctx, W, H, u } = D; fillBg(D, D.P.bg, D.P.bg2); texture(D, 0.06); vignette(D, 0.3);
    const pola = (img, cx, cy, w, h, rot, cap, capFam, fx, fy) => {
      ctx.save(); ctx.translate(cx, cy); ctx.rotate(rot * Math.PI / 180);
      const bw = w * 0.055; const bh = h * 0.2; const tw = w + bw * 2, th = h + bw + bh;
      withShadow(ctx, 'rgba(0,0,0,.55)', 40 * u, 18 * u, () => { ctx.fillStyle = '#FBF8F2'; ctx.fillRect(-tw / 2, -th / 2, tw, th); });
      ctx.save(); ctx.beginPath(); ctx.rect(-tw / 2 + bw, -th / 2 + bw, w, h); ctx.clip(); if (D.grade && img === D.img) ctx.filter = D.grade;
      if (img) cover(ctx, img, -tw / 2 + bw, -th / 2 + bw, w, h, fx ?? 0.5, fy ?? 0.5); else { monogramFill(D, -tw / 2 + bw + w / 2, -th / 2 + bw + h / 2, Math.max(w, h) / 2); }
      ctx.filter = 'none'; ctx.restore();
      if (cap) { const s = fit(ctx, cap, capFam, bh * 0.82 * (SCRIPT_SCALE[capFam] || 1), w * 0.92); setFont(ctx, capFam, s); ctx.fillStyle = '#1B1A18'; drawText(ctx, cap, 0, th / 2 - bh * 0.3, { align: 'center' }); }
      ctx.restore();
    };
    if (D.fmt === 'wide') {
      pola(D.img, W * 0.27, H * 0.5, W * 0.36, H * 0.6, -3, D.copy.script, D.scriptFam, D.focus.x, D.focus.y);
      stack(D, { x: W * 0.52, y: 36, w: W * 0.44, h: H * 0.5 }, [{ t: 'eyebrow', size: 18 }, { t: 'city', size: 36 }, { t: 'price', size: 48, gold: true }, { t: 'line', key: 'date', size: 15 }, { t: 'stats', size: 20 }], { gap: 10 });
      identityRow(D, { x: W * 0.52, y: H * 0.6, w: W * 0.44, h: H * 0.22 }, { qrMax: 118, nameSize: 30 });
      footer(D, { x: W * 0.52, y: H * 0.85, w: W * 0.44, h: H * 0.12 }, { logoMax: 36 }); return;
    }
    const top = 40 * u; const pw = W * V(D, 0.7, 0.5, 0.42); const phh = pw * V(D, 1.0, 0.86, 0.84);
    const th = phh * 1.2 + pw * 0.055; const mainX = W * V(D, 0.43, 0.42, 0.4);
    stack(D, { x: 60 * u, y: top, w: W - 120 * u, h: 46 * u }, [{ t: 'eyebrow', size: 22 }], {});
    const pcy = top + 76 * u + th / 2;
    const second = D.imgs && D.imgs[1];
    pola(D.img, mainX, pcy, pw, phh, -3, D.copy.script, D.scriptFam, D.focus.x, D.focus.y);
    const hw = pw * V(D, 0.36, 0.42, 0.44);
    pola(second || D.head, mainX + pw * 0.5 - hw * 0.05, pcy - th * 0.18, hw, hw * (second ? 0.9 : 1.12), 6, second ? '' : firstName(D.agent.name), 'brush', 0.5, second ? 0.5 : D.headFocus.y);
    const footH = V(D, 110, 92, 84) * u; const barH = V(D, 230, 190, 170) * u;
    const y2 = pcy + th / 2 + 36 * u;
    const items = D.type === 'client_review' ? [{ t: 'stars', size: 30 }, { t: 'review', size: 32, maxLines: D.fmt === 'story' ? 7 : 4 }] : [{ t: 'city', size: 50 }, ...(D.copy.oh ? [{ t: 'line', key: 'oh', size: 26, color: D.P.ink, weight: 700 }] : []), ...(D.copy.facts ? [{ t: 'line', key: 'facts', size: 19 }] : []), { t: 'price', size: 66, gold: true }, ...(D.copy.date ? [{ t: 'line', key: 'date', size: 19 }] : [])];
    stack(D, { x: 80 * u, y: y2, w: W - 160 * u, h: H - y2 - barH - footH - 10 * u }, items, { gap: 10 });
    // info bar
    const by = H - barH - footH; ctx.fillStyle = alpha('#000000', 0.25); ctx.fillRect(0, by, W, barH); ctx.fillStyle = goldFill(D, 0, by, W, by); ctx.fillRect(0, by, W, 2 * u);
    identityRow(D, { x: 60 * u, y: by + 24 * u, w: W - 120 * u, h: barH - 48 * u }, { head: false, stats: true, qrMax: 170 });
    footer(D, { x: 0, y: H - footH, w: W, h: footH - 10 * u });
  });

  // 7 — Power Pairing
  def('pairing', 'Power Pairing', 'Property and agent portrait presented side by side as a team.', ['marble', 'noir', 'redfin'], ['putty', 'mushroom'], (D) => {
    const { ctx, W, H, u } = D; fillBg(D, D.P.bg); texture(D, 0.035);
    const portrait = (x, y, w, h) => {
      withShadow(ctx, 'rgba(0,0,0,.3)', 30 * u, 12 * u, () => { ctx.fillStyle = D.P.card; ctx.fillRect(x, y, w, h); });
      ctx.save(); ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip(); if (D.head) cover(ctx, D.head, x, y, w, h, D.headFocus.x, 0.2); else monogramFill(D, x + w / 2, y + h / 2, Math.max(w, h) / 2); ctx.restore();
      ctx.strokeStyle = goldFill(D, x, y, x + w, y + h); ctx.lineWidth = 3 * u; ctx.strokeRect(x, y, w, h);
    };
    if (D.fmt === 'wide') {
      framePhoto(D, () => { ctx.beginPath(); ctx.rect(0, 0, W * 0.5, H); }, { x: 0, y: 0, w: W * 0.5, h: H }, { shadow: false, stroke: false });
      portrait(W * 0.5 - 70, H * 0.18, 220, 280);
      const tx = W * 0.5 + 180; const tw = W - tx - 34;
      stack(D, { x: tx, y: 28, w: tw, h: H * 0.62 }, defaultItems(D, { script: 100, city: 30, price: 44, compact: true }), { align: 'left', gap: 8 });
      stack(D, { x: W * 0.5 - 70, y: H * 0.18 + 296, w: 220, h: 70 }, [{ t: 'line', text: D.agent.name, fam: 'playfair', track: 0, size: 24, color: D.P.ink, weight: 600 }, { t: 'line', text: D.agent.phone || '', size: 14 }], { gap: 2, valign: 0 });
      qr(D, W - 34 - 110, H - 34 - 126, 110, { label: 'SCAN' });
      footer(D, { x: tx, y: H * 0.74, w: tw - 130, h: H * 0.2 }, { align: 'left', logoMax: 34 }); return;
    }
    const ph = H * V(D, 0.47, 0.44, 0.42);
    framePhoto(D, () => { ctx.beginPath(); ctx.rect(0, 0, W, ph); }, { x: 0, y: 0, w: W, h: ph }, { shadow: false, stroke: false });
    ctx.fillStyle = goldFill(D, 0, ph, W, ph); ctx.fillRect(0, ph - 3 * u, W, 6 * u);
    const footH = V(D, 110, 92, 84) * u;
    const pw = W * V(D, 0.38, 0.33, 0.3); const pH = pw * 1.28; const px = 60 * u; const py = ph - pH * 0.28;
    portrait(px, py, pw, pH);
    stack(D, { x: px, y: py + pH + 16 * u, w: pw, h: H - footH - py - pH - 30 * u }, [{ t: 'line', text: D.agent.name, fam: 'playfair', track: 0, size: 40, color: D.P.ink, weight: 600, gapAfter: 4 }, { t: 'line', text: (D.agent.title || '').toUpperCase(), size: 16, color: D.P.accent, gapAfter: 6 }, { t: 'line', text: D.agent.phone || '', size: 19, weight: 500 }, { t: 'line', text: D.agent.license ? 'DRE #' + D.agent.license : '', size: 15, weight: 500 }], { valign: 0, gap: 4, align: 'left' });
    const tx = px + pw + 50 * u; const tw = W - tx - 60 * u; const ty = ph + 34 * u;
    const qs = Math.min(tw * 0.5, V(D, 230, 170, 150) * u);
    const items = defaultItems(D, { script: V(D, 160, 130, 110), city: 44, price: 60, compact: D.fmt !== 'story' });
    if (D.fmt === 'story') items.push({ t: 'gap', h: 8 }, { t: 'stats', size: 24 }, { t: 'tagline', size: 30 });
    stack(D, { x: tx, y: ty, w: tw, h: H - ty - footH - qs * 1.2 - 40 * u }, items, { align: 'left', gap: 10, valign: 0.2 });
    qr(D, tx, H - footH - qs * 1.15 - 22 * u, qs);
    footer(D, { x: 0, y: H - footH, w: W, h: footH - 12 * u });
  });

  // 8 — Production Scoreboard
  def('scoreboard', 'Production Scoreboard', 'Career numbers front and centre, celebrating the agent’s track record.', ['noir', 'espresso', 'slate'], ['umber', 'mushroom'], (D) => {
    const { ctx, W, H, u } = D; fillBg(D, D.P.bg, D.P.bg2); texture(D, 0.05);
    const st = statsList(D.agent);
    const tilesList = () => {
      if (st.length) return st;
      const d = D.data || {}; const out = [];
      if (D.type === 'client_review') return [['5.0', 'CLIENT RATING'], ['★★★★★', 'VERIFIED REVIEW']].slice(0, 1);
      if (D.copy.price) out.push([fmtMoney(d.price, true), (D.copy.priceLabel || 'PRICE')]);
      if (d.beds) out.push([String(d.beds), 'BEDROOMS']); if (d.baths) out.push([String(d.baths), 'BATHROOMS']);
      if (d.sqft && out.length < 3) out.push([Number(String(d.sqft).replace(/\D/g, '')).toLocaleString('en-US'), 'SQ FT']);
      return out.slice(0, 3);
    };
    const boardLabel = st.length ? 'CAREER PRODUCTION' : D.type === 'client_review' ? 'CLIENT EXPERIENCE' : 'PROPERTY HIGHLIGHTS';
    const tiles = (box) => {
      const list = tilesList(); if (!list.length) return; const n = list.length; const gap = 18 * u * (box.w / W + 0.4); const tw = (box.w - gap * (n - 1)) / n;
      list.forEach(([v, l], i) => {
        const x = box.x + i * (tw + gap); rr(ctx, x, box.y, tw, box.h, 18 * u); ctx.fillStyle = alpha('#FFFFFF', D.P.dark ? 0.05 : 0.6); ctx.fill(); ctx.strokeStyle = goldFill(D, x, box.y, x + tw, box.y + box.h); ctx.lineWidth = 1.5 * u; ctx.stroke();
        const vs = fit(ctx, v, 'playfair', box.h * 0.46, tw * 0.84, { weight: 700 }); setFont(ctx, 'playfair', vs, 700); ctx.fillStyle = goldFill(D, x, box.y, x + tw, box.y + box.h); drawText(ctx, v, x + tw / 2, box.y + box.h * 0.56, { align: 'center' });
        const ls = fit(ctx, l, 'sans', box.h * 0.12, tw * 0.84, { weight: 600, trackEm: 0.25 }); setFont(ctx, 'sans', ls, 600); ctx.fillStyle = D.P.muted; drawText(ctx, l, x + tw / 2, box.y + box.h * 0.8, { align: 'center', track: ls * 0.25 });
      });
    };
    if (D.fmt === 'wide') {
      framePhoto(D, () => rr(ctx, 30, 30, W * 0.4, H - 60, 16), { x: 30, y: 30, w: W * 0.4, h: H - 60 });
      const tx = W * 0.4 + 60; const tw = W - tx - 30;
      stack(D, { x: tx, y: 26, w: tw, h: H * 0.34 }, [{ t: 'eyebrow', size: 18 }, { t: 'script', size: 100, color: 'gold' }, { t: 'line', text: [D.copy.city, D.copy.price].filter(Boolean).join('   ·   ').toUpperCase(), size: 18, color: D.P.ink }], { gap: 6 });
      tiles({ x: tx, y: H * 0.42, w: tw, h: H * 0.22 });
      identityRow(D, { x: tx, y: H * 0.68, w: tw, h: H * 0.18 }, { qrMax: 104, nameSize: 28 });
      footer(D, { x: tx, y: H * 0.88, w: tw, h: H * 0.1 }, { logoMax: 32, finePrint: false }); return;
    }
    const footH = V(D, 110, 92, 84) * u; const idH = V(D, 190, 150, 130) * u;
    stack(D, { x: 60 * u, y: 46 * u, w: W - 120 * u, h: H * V(D, 0.17, 0.18, 0.19) }, [{ t: 'eyebrow', size: 24 }, { t: 'script', size: V(D, 190, 150, 130), color: 'gold' }], { gap: 8 });
    const py = 46 * u + H * V(D, 0.17, 0.18, 0.19) + 18 * u; const ph = H * V(D, 0.3, 0.27, 0.24);
    const pb = { x: 60 * u, y: py, w: W - 120 * u, h: ph }; framePhoto(D, () => rr(ctx, pb.x, pb.y, pb.w, pb.h, 22 * u), pb);
    // floating price tag on photo
    if (D.copy.price || D.copy.city) {
      const tag = [D.copy.city.toUpperCase(), D.copy.price].filter(Boolean).join('   ·   '); setFont(ctx, 'sans', 22 * u, 700); const tw2 = Math.min(pb.w - 40 * u, textW(ctx, tag, 22 * u * 0.14) + 56 * u);
      const ts = fit(ctx, tag, 'sans', 22 * u, tw2 - 56 * u, { weight: 700, trackEm: 0.14 });
      rr(ctx, pb.x + (pb.w - tw2) / 2, pb.y + pb.h - 34 * u, tw2, 68 * u, 34 * u); ctx.fillStyle = D.P.bg; ctx.fill(); ctx.strokeStyle = goldFill(D, pb.x, 0, pb.x + pb.w, 0); ctx.lineWidth = 2 * u; ctx.stroke();
      setFont(ctx, 'sans', ts, 700); ctx.fillStyle = D.P.ink; drawText(ctx, tag, W / 2, pb.y + pb.h + ts * 0.36, { align: 'center', track: ts * 0.14 });
    }
    const ty = py + ph + 64 * u;
    const labelH = 40 * u; setFont(ctx, 'cinzel', 22 * u, 600); ctx.fillStyle = D.P.accent; if (tilesList().length) drawText(ctx, boardLabel, W / 2, ty + 22 * u, { align: 'center', track: 22 * u * 0.3 });
    const tileH = Math.min(V(D, 260, 190, 150) * u, H - ty - labelH - idH - footH - 40 * u);
    tiles({ x: 60 * u, y: ty + labelH, w: W - 120 * u, h: tileH });
    const y3 = ty + labelH + tileH + 20 * u;
    if (D.fmt === 'story') stack(D, { x: 80 * u, y: y3, w: W - 160 * u, h: H - y3 - idH - footH - 20 * u }, D.type === 'client_review' ? [{ t: 'stars', size: 28 }, { t: 'review', size: 30, maxLines: D.fmt === 'story' ? 7 : 4 }] : [{ t: 'tagline', size: 40 }, ...(D.copy.date ? [{ t: 'line', key: 'date', size: 20 }] : [])], { gap: 10 });
    identityRow(D, { x: 60 * u, y: H - idH - footH - 10 * u, w: W - 120 * u, h: idH }, {});
    footer(D, { x: 0, y: H - footH, w: W, h: footH - 12 * u });
  });

  // 9 — Tech Glass
  def('tech', 'Tech Glass', 'Interface-inspired glass panels with a glowing scan-to-connect QR.', ['midnight', 'slate', 'noir'], ['umber', 'mushroom'], (D) => {
    const { ctx, W, H, u } = D; fillBg(D, D.P.bg, D.P.bg2);
    const glow = D.P.glow || D.P.accent;
    // grid
    ctx.save(); ctx.strokeStyle = alpha('#FFFFFF', 0.045); ctx.lineWidth = 1; const gs = 54 * u; for (let x = 0; x < W; x += gs) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); } for (let y = 0; y < H; y += gs) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); } ctx.restore();
    const orb = ctx.createRadialGradient(W * 0.85, H * 0.1, 0, W * 0.85, H * 0.1, W * 0.7); orb.addColorStop(0, alpha(glow, 0.35)); orb.addColorStop(1, alpha(glow, 0)); ctx.fillStyle = orb; ctx.fillRect(0, 0, W, H);
    const panel = (x, y, w, h, r = 24 * u) => { rr(ctx, x, y, w, h, r); ctx.fillStyle = 'rgba(255,255,255,.055)'; ctx.fill(); ctx.strokeStyle = 'rgba(255,255,255,.16)'; ctx.lineWidth = 1.5 * u; ctx.stroke(); };
    const glowFrame = (x, y, w, h, r) => { ctx.save(); ctx.shadowColor = alpha(glow, 0.9); ctx.shadowBlur = 40 * u; rr(ctx, x, y, w, h, r); ctx.strokeStyle = alpha(glow, 0.95); ctx.lineWidth = 3 * u; ctx.stroke(); ctx.restore(); };
    const chip = (x, y, text) => { setFont(ctx, 'sans', 18 * u, 700); const w = textW(ctx, text, 18 * u * 0.2) + 70 * u; rr(ctx, x, y, w, 46 * u, 23 * u); ctx.fillStyle = alpha(glow, 0.16); ctx.fill(); ctx.strokeStyle = alpha(glow, 0.7); ctx.lineWidth = 1.5 * u; ctx.stroke(); circle(ctx, x + 26 * u, y + 23 * u, 7 * u); ctx.fillStyle = glow; ctx.fill(); ctx.fillStyle = '#FFFFFF'; drawText(ctx, text, x + 44 * u, y + 30 * u, { track: 18 * u * 0.2 }); return w; };
    const light = Object.assign({}, D, { P: Object.assign({}, D.P, { ink: '#FFFFFF', muted: alpha('#FFFFFF', 0.7), accent: D.P.premier ? D.P.accent : '#FFFFFF' }) });
    if (D.fmt === 'wide') {
      const pb = { x: 30, y: 30, w: W * 0.5, h: H - 60 }; framePhoto(D, () => rr(ctx, pb.x, pb.y, pb.w, pb.h, 20), pb, { stroke: false }); glowFrame(pb.x, pb.y, pb.w, pb.h, 20);
      chip(pb.x + 20, pb.y + 20, D.copy.eyebrow);
      const tx = W * 0.5 + 60; const tw = W - tx - 30;
      stack(light, { x: tx, y: 24, w: tw - 150, h: H * 0.5 }, [{ t: 'script', size: 100, color: '#FFFFFF' }, { t: 'city', size: 28 }, { t: 'price', size: 40 }, { t: 'line', key: 'date', size: 14 }], { align: 'left', gap: 6 });
      qr(D, W - 30 - 136, 34, 136, { label: 'SCAN ME', goldEdge: false });
      panel(tx - 14, H * 0.58, tw + 14, H * 0.24); identityRow(light, { x: tx, y: H * 0.6, w: tw - 10, h: H * 0.2 }, { qr: false, nameSize: 30, gap: D.P.bg });
      footer(D, { x: tx, y: H * 0.85, w: tw, h: H * 0.12 }, { align: 'left', logoMax: 34, onDark: true }); return;
    }
    const footH = V(D, 100, 86, 80) * u;
    brandMark(D, 60 * u, 50 * u, 38 * u, 'left', true);
    const qs0 = V(D, 300, 220, 190) * u; const idFix = V(D, 230, 190, 170) * u;
    const ph = H - 120 * u - 30 * u - (qs0 * 1.15 + 40 * u) - 24 * u - idFix - footH - 24 * u; const pb = { x: 60 * u, y: 120 * u, w: W - 120 * u, h: ph };
    framePhoto(D, () => rr(ctx, pb.x, pb.y, pb.w, pb.h, 30 * u), pb, { stroke: false }); glowFrame(pb.x, pb.y, pb.w, pb.h, 30 * u);
    chip(pb.x + 26 * u, pb.y + 26 * u, D.copy.eyebrow);
    const y2 = pb.y + ph + 30 * u;
    const qs = V(D, 300, 220, 190) * u; const leftW = W - 120 * u - qs - 30 * u;
    const blockH = qs * 1.15 + 40 * u;
    panel(60 * u, y2, leftW, blockH);
    const items = [{ t: 'script', size: V(D, 150, 120, 104), color: '#FFFFFF', shadow: alpha(glow, 0.8) }];
    if (D.type === 'client_review') items.push({ t: 'stars', size: 26 }, { t: 'review', size: 26, maxLines: D.fmt === 'story' ? 7 : 4 });
    else { items.push({ t: 'city', size: 40 }); if (D.copy.oh) items.push({ t: 'line', key: 'oh', size: 22, color: '#FFFFFF', weight: 700 }); if (D.copy.facts) items.push({ t: 'line', key: 'facts', size: 17 }); items.push({ t: 'price', size: 54 }); if (D.copy.date) items.push({ t: 'line', key: 'date', size: 17 }); }
    stack(light, { x: 90 * u, y: y2 + 20 * u, w: leftW - 60 * u, h: blockH - 40 * u }, items, { align: 'left', gap: 8 });
    const qx = W - 60 * u - qs; ctx.save(); ctx.shadowColor = alpha(glow, 0.9); ctx.shadowBlur = 50 * u; rr(ctx, qx, y2 + 20 * u, qs, qs * 1.15, qs * 0.07); ctx.fillStyle = '#FFFFFF'; ctx.fill(); ctx.restore();
    qr(D, qx, y2 + 20 * u, qs, { label: 'SCAN TO CONNECT', goldEdge: false });
    const y3 = y2 + blockH + 24 * u; const idH = H - y3 - footH - 24 * u;
    panel(60 * u, y3, W - 120 * u, idH);
    identityRow(light, { x: 86 * u, y: y3 + 20 * u, w: W - 172 * u, h: idH - 40 * u }, { qr: false, stats: D.fmt !== 'square', gap: D.P.bg });
    footer(D, { x: 0, y: H - footH, w: W, h: footH - 10 * u }, { onDark: true, logo: false });
  });

  // 10 — Circle Spotlight
  def('circle', 'Circle Spotlight', 'Property in a gold-ringed circle with the agent portrait orbiting it.', ['coastal', 'ivory', 'sage'], ['putty', 'stone'], (D) => {
    const { ctx, W, H, u } = D; fillBg(D, D.P.bg, D.P.bg2); texture(D, 0.04);
    if (D.fmt === 'wide') {
      const r = H * 0.4; const cx = 40 + r, cy = H / 2; circle(ctx, cx, cy, r + 14); ctx.strokeStyle = goldFill(D, cx - r, cy - r, cx + r, cy + r); ctx.lineWidth = 2; ctx.stroke();
      framePhoto(D, () => circle(ctx, cx, cy, r), { x: cx - r, y: cy - r, w: r * 2, h: r * 2 }, { strokeW: 5 });
      headshot(D, cx + r * 0.78, cy + r * 0.7, r * 0.3);
      const tx = cx + r + 60; const tw = W - tx - 30;
      stack(D, { x: tx, y: 26, w: tw, h: H * 0.6 }, defaultItems(D, { script: 110, city: 34, price: 48, compact: true }), { gap: 8 });
      identityRow(D, { x: tx, y: H * 0.64, w: tw, h: H * 0.2 }, { head: false, qrMax: 112, nameSize: 30 });
      footer(D, { x: tx, y: H * 0.86, w: tw, h: H * 0.12 }, { logoMax: 34, finePrint: false }); return;
    }
    stack(D, { x: 60 * u, y: 40 * u, w: W - 120 * u, h: 50 * u }, [{ t: 'eyebrow', size: 23 }], {});
    const r = W * V(D, 0.36, 0.27, 0.23); const cx = W / 2; const cy = 110 * u + r;
    for (let i = 0; i < 2; i++) { circle(ctx, cx, cy, r + (18 + i * 14) * u); ctx.strokeStyle = goldFill(D, cx - r, cy - r, cx + r, cy + r); ctx.lineWidth = (i ? 1 : 2) * u; ctx.stroke(); }
    framePhoto(D, () => circle(ctx, cx, cy, r), { x: cx - r, y: cy - r, w: r * 2, h: r * 2 }, { strokeW: 6 * u });
    const hr = r * 0.3; headshot(D, cx + r * 0.74, cy + r * 0.68, hr);
    const si = ITEM.script(D, { size: V(D, 200, 160, 140), halo: D.P.bg }, 1, W - 100 * u); si.draw(W / 2, cy + r - si.h * 0.32, 'center');
    const footH = V(D, 110, 92, 84) * u; const idH = V(D, 180, 140, 120) * u;
    const top = cy + r + si.h * 0.75;
    const items = D.type === 'client_review' ? [{ t: 'stars', size: 30 }, { t: 'review', size: 32, maxLines: D.fmt === 'story' ? 7 : 4 }] : [{ t: 'city', size: 48, style: 'italic' }, ...(D.copy.oh ? [{ t: 'line', key: 'oh', size: 26, color: D.P.ink, weight: 700 }] : []), ...(D.copy.facts ? [{ t: 'line', key: 'facts', size: 19 }] : []), { t: 'price', size: 62 }, ...(D.copy.date ? [{ t: 'line', key: 'date', size: 19 }] : [])];
    if (D.fmt === 'story') items.push({ t: 'rule', w: 280 }, { t: 'stats', size: 26 });
    stack(D, { x: 90 * u, y: top, w: W - 180 * u, h: H - top - idH - footH - 10 * u }, items, { gap: 10 });
    identityRow(D, { x: 80 * u, y: H - idH - footH - 6 * u, w: W - 160 * u, h: idH }, { head: false, stats: D.fmt === 'feed', align: 'left' });
    footer(D, { x: 0, y: H - footH, w: W, h: footH - 12 * u });
  });

  // 11 — City Type Poster
  def('citytype', 'City Type Poster', 'The city name set huge, filled with the property photo.', ['ivory', 'noir', 'redfin'], ['putty', 'umber'], (D) => {
    const { ctx, W, H, u } = D; fillBg(D, D.P.bg); texture(D, 0.04);
    const words = (D.copy.cityOnly || 'Home').toUpperCase().split(/\s+/);
    const typeBlock = (box) => {
      // pick the size that fits each line; stack lines
      const c = document.createElement('canvas'); c.width = Math.ceil(box.w); c.height = Math.ceil(box.h); const x = c.getContext('2d');
      const lines = words.length > 3 ? [words.slice(0, Math.ceil(words.length / 2)).join(' '), words.slice(Math.ceil(words.length / 2)).join(' ')] : words;
      const fam = D.premier ? 'jost' : 'playfair'; const wt = D.premier ? 500 : 900;
      let sizes = lines.map((l) => fit(x, l, fam, box.h / lines.length * 1.05, box.w, { weight: wt, trackEm: D.premier ? 0.06 : 0.01 }));
      let tot = sizes.reduce((s, v) => s + v * 0.86, 0); if (tot > box.h) sizes = sizes.map((s) => s * box.h / tot); tot = sizes.reduce((s, v) => s + v * 0.86, 0);
      let y = 0; x.fillStyle = '#000';
      lines.forEach((l, i) => { setFont(x, fam, sizes[i], wt); y += sizes[i] * 0.86; drawText(x, l, box.w / 2, y - sizes[i] * 0.08, { align: 'center', track: sizes[i] * (D.premier ? 0.06 : 0.01) }); });
      x.globalCompositeOperation = 'source-in'; if (D.img) { if (D.grade) x.filter = D.grade; cover(x, D.img, 0, 0, box.w, box.h, D.focus.x, D.focus.y); } else { x.fillStyle = D.P.accent; x.fillRect(0, 0, box.w, box.h); }
      withShadow(ctx, 'rgba(0,0,0,.25)', 20 * u, 8 * u, () => ctx.drawImage(c, box.x, box.y));
      return tot;
    };
    if (D.fmt === 'wide') {
      typeBlock({ x: 30, y: 60, w: W * 0.56, h: H - 160 });
      stack(D, { x: 30, y: 18, w: W * 0.56, h: 40 }, [{ t: 'eyebrow', size: 18 }], {});
      const tx = W * 0.6 + 10; const tw = W - tx - 30;
      stack(D, { x: tx, y: 30, w: tw, h: H * 0.5 }, [{ t: 'script', size: 110 }, { t: 'price', size: 46 }, { t: 'line', key: 'date', size: 15 }], { gap: 8 });
      identityRow(D, { x: tx, y: H * 0.58, w: tw, h: H * 0.22 }, { qrMax: 118, nameSize: 28 });
      footer(D, { x: 30, y: H - 90, w: W * 0.56, h: 76 }, { logoMax: 38 }); return;
    }
    const footH = V(D, 110, 92, 84) * u; const idH = V(D, 190, 150, 130) * u;
    if (D.copy.state) stack(D, { x: 60 * u, y: 44 * u, w: W - 120 * u, h: 50 * u }, [{ t: 'eyebrow', text: [D.copy.state, D.monthLine].filter(Boolean).join('  ·  ').toUpperCase(), size: 22 }], {});
    const si = ITEM.script(D, { size: V(D, 190, 150, 120), color: D.P.red ? D.P.accent : D.P.script === 'gold' ? 'gold' : D.P.script }, 1, W - 120 * u);
    si.draw(W / 2, 110 * u, 'center');
    const tb = { x: 40 * u, y: 110 * u + si.h + 10 * u, w: W - 80 * u, h: H * V(D, 0.42, 0.34, 0.3) };
    const used = typeBlock(tb);
    const top = tb.y + used + 30 * u;
    const items = D.type === 'client_review' ? [{ t: 'stars', size: 30 }, { t: 'review', size: 32, maxLines: D.fmt === 'story' ? 7 : 4 }] : [{ t: 'line', text: D.copy.eyebrow, size: 20, track: 0.3, color: D.P.accent }, ...(D.copy.oh ? [{ t: 'line', key: 'oh', size: 26, color: D.P.ink, weight: 700 }] : []), ...(D.copy.facts ? [{ t: 'line', key: 'facts', size: 19 }] : []), { t: 'price', size: 64, gold: D.P.dark }, ...(D.copy.date ? [{ t: 'line', key: 'date', size: 19 }] : [])];
    if (D.fmt === 'story') items.push({ t: 'tagline', size: 36 }, { t: 'stats', size: 26 });
    stack(D, { x: 90 * u, y: top, w: W - 180 * u, h: H - top - idH - footH - 16 * u }, items, { gap: 12 });
    identityRow(D, { x: 70 * u, y: H - idH - footH - 6 * u, w: W - 140 * u, h: idH }, {});
    footer(D, { x: 0, y: H - footH, w: W, h: footH - 12 * u });
  });

  // 12 — Triptych
  def('triptych', 'Gallery Triptych', 'The photo split into three gallery panels with gold hairlines.', ['marble', 'sage', 'espresso'], ['stone', 'mushroom'], (D) => {
    const { ctx, W, H, u } = D; fillBg(D, D.P.bg, D.P.bg2); texture(D, 0.04);
    const panels = (box, tall) => {
      const gap = 16 * u; const pw = (box.w - gap * 2) / 3; const many = D.imgs && D.imgs.length >= 3;
      for (let i = 0; i < 3; i++) {
        const x = box.x + i * (pw + gap); const off = i === 1 ? 0 : tall * 0.08; const h = box.h - off * 2; const y = box.y + off;
        const p = { x, y, w: pw, h };
        if (many) framePhoto(D, () => rr(ctx, x, y, pw, h, 10 * u), p, { img: D.imgs[i], fx: 0.5, fy: 0.5, strokeW: 2 * u });
        else {
          withShadow(ctx, 'rgba(0,0,0,.3)', 30 * u, 12 * u, () => { rr(ctx, x, y, pw, h, 10 * u); ctx.fillStyle = D.P.card; ctx.fill(); });
          ctx.save(); rr(ctx, x, y, pw, h, 10 * u); ctx.clip(); if (D.grade) ctx.filter = D.grade;
          if (D.img) cover(ctx, D.img, box.x, box.y, box.w, box.h, D.focus.x, D.focus.y); ctx.filter = 'none'; ctx.restore();
          rr(ctx, x, y, pw, h, 10 * u); ctx.strokeStyle = goldFill(D, x, y, x + pw, y + h); ctx.lineWidth = 2 * u; ctx.stroke();
        }
      }
    };
    if (D.fmt === 'wide') {
      panels({ x: 30, y: 40, w: W * 0.56, h: H - 80 }, H - 80);
      const tx = W * 0.6 + 6; const tw = W - tx - 30;
      stack(D, { x: tx, y: 26, w: tw, h: H * 0.58 }, defaultItems(D, { script: 110, city: 32, price: 46, compact: true }), { gap: 8 });
      identityRow(D, { x: tx, y: H * 0.62, w: tw, h: H * 0.2 }, { qrMax: 112, nameSize: 28 });
      footer(D, { x: tx, y: H * 0.85, w: tw, h: H * 0.12 }, { logoMax: 34, finePrint: false }); return;
    }
    const footH = V(D, 110, 92, 84) * u; const idH = V(D, 180, 140, 120) * u;
    const headH = H * V(D, 0.16, 0.17, 0.19);
    stack(D, { x: 60 * u, y: 40 * u, w: W - 120 * u, h: headH }, [{ t: 'eyebrow', size: 23 }, { t: 'script', size: V(D, 190, 150, 130) }], { gap: 6 });
    const ph = H * V(D, 0.4, 0.34, 0.3); const pb = { x: 56 * u, y: 40 * u + headH + 10 * u, w: W - 112 * u, h: ph };
    panels(pb, ph);
    const top = pb.y + ph + 30 * u;
    const items = D.type === 'client_review' ? [{ t: 'stars', size: 30 }, { t: 'review', size: 32, maxLines: D.fmt === 'story' ? 7 : 4 }] : [{ t: 'city', size: 46 }, ...(D.copy.oh ? [{ t: 'line', key: 'oh', size: 26, color: D.P.ink, weight: 700 }] : []), ...(D.copy.facts ? [{ t: 'line', key: 'facts', size: 19 }] : []), { t: 'price', size: 60, gold: D.P.dark }, ...(D.copy.date ? [{ t: 'line', key: 'date', size: 19 }] : [])];
    if (D.fmt === 'story') items.push({ t: 'rule', w: 260 }, { t: 'stats', size: 26 }, { t: 'tagline', size: 32 });
    stack(D, { x: 90 * u, y: top, w: W - 180 * u, h: H - top - idH - footH - 10 * u }, items, { gap: 10 });
    identityRow(D, { x: 70 * u, y: H - idH - footH - 6 * u, w: W - 140 * u, h: idH }, {});
    footer(D, { x: 0, y: H - footH, w: W, h: footH - 12 * u });
  });

  // 13 — Capsule Minimal
  def('capsule', 'Capsule Minimal', 'Asymmetric pill-shaped photo, generous white space, quiet luxury.', ['ivory', 'coastal', 'marble'], ['putty', 'stone'], (D) => {
    const { ctx, W, H, u } = D; fillBg(D, D.P.bg); texture(D, 0.035);
    if (D.fmt === 'wide') { wideComposer(D, { shape: 'capsule', photoFrac: 0.3, align: 'left' }); return; }
    const footH = V(D, 110, 92, 84) * u;
    const cw = W * V(D, 0.46, 0.42, 0.4); const ch = H * V(D, 0.66, 0.64, 0.64); const cx = 60 * u; const cy = 60 * u;
    framePhoto(D, () => rr(ctx, cx, cy, cw, ch, cw / 2), { x: cx, y: cy, w: cw, h: ch });
    ctx.save(); rr(ctx, cx + 22 * u, cy + 22 * u, cw, ch, cw / 2); ctx.strokeStyle = goldFill(D, cx, cy, cx + cw, cy + ch); ctx.lineWidth = 1.5 * u; ctx.globalCompositeOperation = 'destination-over'; ctx.stroke(); ctx.restore();
    const tx = cx + cw + 50 * u; const tw = W - tx - 56 * u;
    // script stacked word per line
    const words = D.copy.script.split(' ');
    const sitems = [{ t: 'eyebrow', size: 20, flank: false, gapAfter: 22 }, ...words.map((w2, i) => ({ t: 'script', text: w2, size: V(D, 190, 160, 140), gapAfter: i < words.length - 1 ? -10 : 20 }))];
    const items = D.type === 'client_review' ? [...sitems, { t: 'stars', size: 26 }, { t: 'review', size: 28, maxLines: 6 }] : [...sitems, { t: 'rule', w: 120 }, { t: 'city', size: 38, style: 'italic' }, ...(D.copy.oh ? [{ t: 'line', key: 'oh', size: 22, color: D.P.ink, weight: 700 }] : []), ...(D.copy.facts ? [{ t: 'line', key: 'facts', size: 16 }] : []), { t: 'price', size: 54 }, ...(D.copy.date ? [{ t: 'line', key: 'date', size: 17 }] : [])];
    if (D.fmt === 'story') items.push({ t: 'gap', h: 10 }, { t: 'tagline', size: 32 });
    stack(D, { x: tx, y: cy, w: tw, h: ch * 0.98 }, items, { align: 'left', gap: 12, valign: 0.35 });
    const y2 = cy + ch + 40 * u; const idH = H - y2 - footH - 20 * u;
    identityRow(D, { x: 60 * u, y: y2, w: W - 120 * u, h: idH }, { stats: D.fmt === 'story' });
    ctx.fillStyle = D.P.line; ctx.fillRect(60 * u, H - footH - 6 * u, W - 120 * u, 1.5 * u);
    footer(D, { x: 60 * u, y: H - footH, w: W - 120 * u, h: footH - 12 * u }, { align: 'left' });
  });

  // 14 — Postcard
  def('postcard', 'Greetings Postcard', 'Vintage postcard: “Greetings from” the city, stamp portrait and postmark.', ['parchment', 'coastal', 'redfin'], ['putty', 'stone'], (D) => {
    const { ctx, W, H, u } = D; fillBg(D, D.P.bg2, D.P.bg); texture(D, 0.07);
    const stamp = (x, y, w, h) => {
      ctx.save(); withShadow(ctx, 'rgba(0,0,0,.25)', 12 * u, 5 * u, () => { ctx.fillStyle = '#FFFFFF'; ctx.fillRect(x, y, w, h); });
      ctx.globalCompositeOperation = 'destination-out'; const rP = 6 * u; for (let i = 0; i <= w / (rP * 3); i++) { circle(ctx, x + i * rP * 3, y, rP); ctx.fill(); circle(ctx, x + i * rP * 3, y + h, rP); ctx.fill(); } for (let i = 0; i <= h / (rP * 3); i++) { circle(ctx, x, y + i * rP * 3, rP); ctx.fill(); circle(ctx, x + w, y + i * rP * 3, rP); ctx.fill(); }
      ctx.restore(); ctx.save(); ctx.beginPath(); ctx.rect(x + 12 * u, y + 12 * u, w - 24 * u, h - 24 * u); ctx.clip(); if (D.head) cover(ctx, D.head, x + 12 * u, y + 12 * u, w - 24 * u, h - 24 * u, D.headFocus.x, 0.25); else monogramFill(D, x + w / 2, y + h / 2, w); ctx.restore();
    };
    const postmark = (cx, cy, r) => {
      ctx.save(); ctx.globalAlpha = 0.75; ctx.strokeStyle = D.P.red ? '#DE3341' : D.P.accent; ctx.fillStyle = ctx.strokeStyle; ctx.lineWidth = 3 * u; circle(ctx, cx, cy, r); ctx.stroke(); circle(ctx, cx, cy, r * 0.8); ctx.lineWidth = 1.5 * u; ctx.stroke();
      const t1 = D.copy.T.stamp || 'SOLD'; const ps = fit(ctx, t1, 'sans', r * 0.3, r * 1.4, { weight: 800, trackEm: 0.04 }); setFont(ctx, 'sans', ps, 800); drawText(ctx, t1, cx, cy + ps * 0.33, { align: 'center', track: ps * 0.04 });
      setFont(ctx, 'sans', r * 0.13, 700); drawText(ctx, (D.monthLine || '').toUpperCase(), cx, cy + r * 0.42, { align: 'center', track: r * 0.02 });
      for (let i = 0; i < 4; i++) { ctx.beginPath(); const yy = cy - r * 0.45 + i * r * 0.3; ctx.moveTo(cx + r * 1.1, yy); for (let x = 0; x < r * 2.4; x += r * 0.2) ctx.lineTo(cx + r * 1.1 + x, yy + Math.sin(x / r * 6) * r * 0.06); ctx.stroke(); }
      ctx.restore();
    };
    const card = (x, y, w, h) => { withShadow(ctx, 'rgba(0,0,0,.35)', 40 * u, 16 * u, () => { ctx.fillStyle = '#FFFDF8'; ctx.fillRect(x, y, w, h); }); };
    const greet = (box) => {
      ctx.save(); ctx.beginPath(); ctx.rect(box.x, box.y, box.w, box.h); ctx.clip(); if (D.grade) ctx.filter = D.grade; if (D.img) cover(ctx, D.img, box.x, box.y, box.w, box.h, D.focus.x, D.focus.y); ctx.filter = 'none';
      const g = ctx.createLinearGradient(0, box.y, 0, box.y + box.h); g.addColorStop(0, 'rgba(0,0,0,.05)'); g.addColorStop(1, 'rgba(0,0,0,.45)'); ctx.fillStyle = g; ctx.fillRect(box.x, box.y, box.w, box.h); ctx.restore();
      const gs = fit(ctx, 'Greetings from', 'brush', box.h * 0.17, box.w * 0.7); setFont(ctx, 'brush', gs); ctx.fillStyle = '#FFFFFF'; ctx.save(); ctx.shadowColor = 'rgba(0,0,0,.5)'; ctx.shadowBlur = 12; drawText(ctx, 'Greetings from', box.x + box.w / 2, box.y + box.h * 0.5, { align: 'center' }); ctx.restore();
      const cityU = (D.copy.cityOnly || 'Home').toUpperCase(); const cs = fit(ctx, cityU, 'playfair', box.h * 0.3, box.w * 0.9, { weight: 900, trackEm: 0.02 }); setFont(ctx, 'playfair', cs, 900);
      ctx.save(); ctx.lineJoin = 'round'; ctx.lineWidth = cs * 0.1; ctx.strokeStyle = D.P.red ? '#DE3341' : '#1D1A16'; drawText(ctx, cityU, box.x + box.w / 2, box.y + box.h * 0.5 + cs * 0.95, { align: 'center', track: cs * 0.02, stroke: true });
      ctx.fillStyle = goldFill(D, box.x, box.y + box.h * 0.5, box.x + box.w, box.y + box.h); drawText(ctx, cityU, box.x + box.w / 2, box.y + box.h * 0.5 + cs * 0.95, { align: 'center', track: cs * 0.02 }); ctx.restore();
    };
    const back = (box, compact) => {
      const lx = box.x + box.w * 0.5; ctx.fillStyle = D.P.line; ctx.fillRect(lx, box.y + 20 * u, 1.5 * u, box.h - 40 * u);
      const left = { x: box.x + 26 * u, y: box.y + 20 * u, w: box.w * 0.5 - 52 * u, h: box.h - 40 * u };
      const ink = Object.assign({}, D, { P: Object.assign({}, D.P, { ink: '#1D1A16', muted: '#6C6257', script: D.P.red ? '#DE3341' : '#1D1A16' }) });
      const items = [{ t: 'eyebrow', size: 18, flank: false }, { t: 'script', size: compact ? 110 : 140 }];
      if (D.type === 'client_review') items.push({ t: 'stars', size: 22 }, { t: 'review', size: 22, maxLines: 5 });
      else { if (D.copy.oh) items.push({ t: 'line', key: 'oh', size: 18, color: '#1D1A16', weight: 700 }); if (D.copy.facts) items.push({ t: 'line', key: 'facts', size: 15 }); items.push({ t: 'price', size: 44 }); if (D.copy.date) items.push({ t: 'line', key: 'date', size: 15 }); }
      stack(ink, left, items, { align: 'left', gap: 8 });
      const sw = Math.min(box.w * 0.16, box.h * 0.36); const sh = sw * 1.2; stamp(box.x + box.w - sw - 26 * u, box.y + 24 * u, sw, sh);
      postmark(box.x + box.w - sw - 26 * u - sw * 0.55, box.y + 24 * u + sh * 0.8, sw * 0.42);
      // address lines
      const ax = lx + 30 * u; const aw = box.x + box.w - ax - 26 * u; const ay = box.y + 24 * u + sh + 30 * u; const ah = box.y + box.h - 20 * u - ay;
      const lines = [D.agent.name, (D.agent.title || ''), [D.agent.phone, D.agent.license ? 'DRE #' + D.agent.license : ''].filter(Boolean).join('  ·  ')].filter(Boolean);
      const lh = ah / (lines.length + 1.2);
      lines.forEach((t, i) => { const yy = ay + lh * (i + 1); ctx.fillStyle = D.P.line; ctx.fillRect(ax, yy + 6 * u, aw - (i === 0 ? 0 : 0), 1.2 * u); const s = fit(ctx, i === 0 ? t : t.toUpperCase(), i === 0 ? 'brush' : 'sans', i === 0 ? lh * 0.9 : lh * 0.34, aw - Math.min(aw * 0.36, lh * 1.6) * (i === lines.length - 1 ? 1 : 0), { weight: i === 0 ? 400 : 600, trackEm: i === 0 ? 0 : 0.12 }); setFont(ctx, i === 0 ? 'brush' : 'sans', s, i === 0 ? 400 : 600); ctx.fillStyle = i === 0 ? '#1D1A16' : '#6C6257'; drawText(ctx, i === 0 ? t : t.toUpperCase(), ax, yy, { track: i === 0 ? 0 : s * 0.12 }); });
      const qs = Math.min(aw * 0.36, lh * 1.6); qr(D, box.x + box.w - 26 * u - qs, box.y + box.h - 20 * u - qs * 1.15, qs, { label: 'SCAN', cardFill: '#FFFFFF' });
    };
    if (D.fmt === 'wide') {
      const cb = { x: 40, y: 34, w: W - 80, h: H - 110 }; card(cb.x, cb.y, cb.w, cb.h);
      greet({ x: cb.x + 14, y: cb.y + 14, w: cb.w * 0.48, h: cb.h - 28 }); back({ x: cb.x + cb.w * 0.48 + 14, y: cb.y, w: cb.w * 0.52 - 14, h: cb.h }, true);
      footer(D, { x: 0, y: H - 70, w: W, h: 64 }, { onDark: false, logoMax: 36 }); return;
    }
    const footH = V(D, 120, 96, 86) * u;
    const cb = { x: 50 * u, y: 50 * u, w: W - 100 * u, h: H - footH - 80 * u }; ctx.save(); ctx.translate(W / 2, H / 2); ctx.rotate(-0.6 * Math.PI / 180); ctx.translate(-W / 2, -H / 2);
    card(cb.x, cb.y, cb.w, cb.h);
    const gh = cb.h * V(D, 0.52, 0.5, 0.48); greet({ x: cb.x + 18 * u, y: cb.y + 18 * u, w: cb.w - 36 * u, h: gh });
    back({ x: cb.x, y: cb.y + 18 * u + gh, w: cb.w, h: cb.h - gh - 18 * u }, D.fmt !== 'story');
    ctx.restore();
    footer(D, { x: 0, y: H - footH, w: W, h: footH - 14 * u }, { onDark: false });
  });

  // 15 — Gallery Plaque
  def('plaque', 'Gallery Plaque', 'Framed like a museum piece under a spotlight, with an engraved brass plaque.', ['sage', 'slate', 'espresso'], ['mushroom', 'stone'], (D) => {
    const { ctx, W, H, u } = D; fillBg(D, D.P.bg, D.P.bg2); texture(D, 0.06);
    const spot = (cx, top, w, h) => { const g = ctx.createRadialGradient(cx, top, 0, cx, top + h * 0.4, Math.max(w, h)); g.addColorStop(0, 'rgba(255,248,230,.32)'); g.addColorStop(1, 'rgba(255,248,230,0)'); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H); };
    const frame = (x, y, w, h) => {
      const fw = Math.min(w, h) * 0.075;
      withShadow(ctx, 'rgba(0,0,0,.5)', 50 * u, 24 * u, () => { ctx.fillStyle = '#8A6A30'; ctx.fillRect(x - fw, y - fw, w + fw * 2, h + fw * 2); });
      const bands = [[0, 1], [0.25, 0.7], [0.5, 0.85], [0.75, 0.6]];
      bands.forEach(([o], i) => { const ins = fw * o; ctx.fillStyle = grad(ctx, (i % 2 ? [[0, '#6E5224'], [0.5, '#E9D39A'], [1, '#7A5B26']] : D.P.gold), x - fw + ins, y - fw + ins, x + w + fw - ins, y + h + fw - ins); ctx.fillRect(x - fw + ins, y - fw + ins, w + (fw - ins) * 2, h + (fw - ins) * 2); });
      const mat = fw * 0.55; ctx.fillStyle = '#F6F1E7'; ctx.fillRect(x, y, w, h);
      const ib = { x: x + mat, y: y + mat, w: w - mat * 2, h: h - mat * 2 };
      ctx.save(); ctx.beginPath(); ctx.rect(ib.x, ib.y, ib.w, ib.h); ctx.clip(); if (D.grade) ctx.filter = D.grade; if (D.img) cover(ctx, D.img, ib.x, ib.y, ib.w, ib.h, D.focus.x, D.focus.y); ctx.filter = 'none'; ctx.restore();
      ctx.strokeStyle = 'rgba(0,0,0,.25)'; ctx.lineWidth = 1; ctx.strokeRect(ib.x, ib.y, ib.w, ib.h);
    };
    const plaque = (x, y, w, h) => {
      withShadow(ctx, 'rgba(0,0,0,.45)', 20 * u, 8 * u, () => { rr(ctx, x, y, w, h, 10 * u); ctx.fillStyle = goldFill(D, x, y, x + w, y + h); ctx.fill(); });
      rr(ctx, x + 8 * u, y + 8 * u, w - 16 * u, h - 16 * u, 6 * u); ctx.strokeStyle = 'rgba(60,40,10,.45)'; ctx.lineWidth = 1.5 * u; ctx.stroke();
      [[x + 20 * u, y + 20 * u], [x + w - 20 * u, y + 20 * u], [x + 20 * u, y + h - 20 * u], [x + w - 20 * u, y + h - 20 * u]].forEach(([a, b]) => { circle(ctx, a, b, 5 * u); ctx.fillStyle = 'rgba(60,40,10,.5)'; ctx.fill(); });
      const eng = Object.assign({}, D, { P: Object.assign({}, D.P, { ink: '#2E2310', muted: 'rgba(46,35,16,.78)', accent: '#2E2310' }) });
      const items = [{ t: 'line', text: (D.copy.city || '').toUpperCase(), fam: 'cinzel', size: 34, track: 0.14, color: '#2E2310', weight: 700 }];
      if (D.type === 'client_review') items.push({ t: 'line', text: '★★★★★  ' + (D.copy.reviewer ? D.copy.reviewer.toUpperCase() : 'CLIENT REVIEW'), size: 18, color: '#2E2310' });
      else items.push({ t: 'line', text: [D.copy.price ? D.copy.priceLabel + ' ' + D.copy.price : '', D.copy.date].filter(Boolean).join('   ·   '), size: 19, color: '#2E2310', weight: 700 });
      items.push({ t: 'line', text: ('Represented by ' + (D.agent.name || '')).toUpperCase(), size: 15, color: 'rgba(46,35,16,.78)', weight: 600 });
      stack(eng, { x: x + 30 * u, y: y + 18 * u, w: w - 60 * u, h: h - 36 * u }, items, { gap: 8 });
    };
    if (D.fmt === 'wide') {
      spot(W * 0.3, 0, W * 0.6, H); frame(70, 70, W * 0.44, H - 150);
      const tx = W * 0.6; const tw = W - tx - 30;
      stack(D, { x: tx, y: 24, w: tw, h: H * 0.34 }, [{ t: 'eyebrow', size: 17 }, { t: 'script', size: 100, color: D.P.dark ? 'gold' : D.P.script }], { gap: 6 });
      plaque(tx, H * 0.38, tw, H * 0.26);
      identityRow(D, { x: tx, y: H * 0.68, w: tw, h: H * 0.18 }, { qrMax: 100, nameSize: 26 });
      footer(D, { x: tx, y: H * 0.88, w: tw, h: H * 0.1 }, { logoMax: 30, finePrint: false }); return;
    }
    const footH = V(D, 110, 92, 84) * u; const idH = V(D, 180, 140, 120) * u;
    stack(D, { x: 60 * u, y: 40 * u, w: W - 120 * u, h: H * V(D, 0.14, 0.16, 0.17) }, [{ t: 'eyebrow', size: 23 }, { t: 'script', size: V(D, 180, 140, 120), color: D.P.dark ? 'gold' : D.P.script }], { gap: 6 });
    const fy = 40 * u + H * V(D, 0.14, 0.16, 0.17) + 50 * u; const fwid = W * V(D, 0.74, 0.62, 0.56); const fh = H * V(D, 0.38, 0.36, 0.32);
    spot(W / 2, fy - 80 * u, W * 0.7, fh * 1.6); frame((W - fwid) / 2, fy, fwid, fh);
    const py = fy + fh + 70 * u; const ph = V(D, 190, 150, 124) * u; const pw = W * V(D, 0.62, 0.62, 0.66);
    plaque((W - pw) / 2, py, pw, ph);
    const y4 = py + ph + 20 * u;
    if (D.fmt === 'story') stack(D, { x: 80 * u, y: y4, w: W - 160 * u, h: H - y4 - idH - footH - 20 * u }, D.type === 'client_review' ? [{ t: 'review', size: 30, maxLines: D.fmt === 'story' ? 7 : 4 }] : [{ t: 'stats', size: 28 }, { t: 'tagline', size: 34 }], { gap: 12 });
    identityRow(D, { x: 70 * u, y: H - idH - footH - 6 * u, w: W - 140 * u, h: idH }, { stats: false });
    footer(D, { x: 0, y: H - footH, w: W, h: footH - 12 * u });
  });

  /* ------------------------------------------------------------------ render */
  function paletteFor(layout, spec) {
    const tier = (TYPES[spec.type] || {}).tier; const list = tier === 'premier' ? layout.premierPalettes : layout.palettes;
    const key = spec.palette && PAL[spec.palette] ? spec.palette : list[((spec.seed || 0) % list.length + list.length) % list.length];
    return { key, P: PAL[key] };
  }
  /* spec: {format, layout (id or index), type, seed, palette?, data, agent, photos:[img], headshot, qrText, qrImage, brand, grade, focus} */
  function render(canvas, spec, scale = 1) {
    const F = FORMATS[spec.format] || FORMATS.story; const li = typeof spec.layout === 'number' ? spec.layout : LAYOUTS.findIndex((l) => l.id === spec.layout);
    const layout = LAYOUTS[Math.max(0, li)];
    canvas.width = Math.round(F.w * scale); canvas.height = Math.round(F.h * scale);
    const ctx = canvas.getContext('2d'); ctx.setTransform(scale, 0, 0, scale, 0, 0); ctx.imageSmoothingQuality = 'high';
    const { key, P } = paletteFor(layout, spec);
    const T = TYPES[spec.type] || TYPES.closed_sell;
    const scriptFam = SCRIPTS[((li + (spec.seed || 0) * 2) % SCRIPTS.length + SCRIPTS.length) % SCRIPTS.length];
    const imgs = (spec.photos || []).filter(Boolean);
    const D = {
      ctx, W: F.w, H: F.h, fmt: F.key, u: F.key === 'wide' ? 1 : F.w / 1080, P, paletteKey: key, premier: T.tier === 'premier', type: spec.type,
      data: spec.data || {}, agent: spec.agent || {}, img: imgs[0] || null, imgs, head: spec.headshot || null, qrImg: spec.qrImage || null,
      qr: spec.qrImage ? null : qrMatrix(spec.qrText), brand: spec.brand || {}, scriptFam: spec.scriptFam || scriptFam,
      grade: spec.grade === false ? '' : 'contrast(1.05) saturate(1.07) brightness(1.02)',
      focus: spec.focus || { x: 0.5, y: 0.5 }, headFocus: spec.headFocus || { x: 0.5, y: 0.3 },
      copy: buildCopy(Object.assign({}, spec, { layoutIndex: li })),
    };
    D.monthLine = fmtMonth((spec.data || {}).date) || '';
    ctx.save(); ctx.textBaseline = 'alphabetic';
    try { layout.fn(D); } catch (e) { console.error('layout failed', layout.id, e); ctx.fillStyle = '#C4202E'; ctx.font = '600 28px sans-serif'; ctx.fillText('Layout error: ' + layout.id, 40, 60); }
    ctx.restore();
    return { layout: layout.id, layoutName: layout.name, palette: key, paletteName: P.name, script: D.scriptFam, copy: D.copy };
  }

  window.StudioEngine = { FORMATS, TYPES, LAYOUTS, PALETTES: PAL, SCRIPTS, render, ensureFonts, fmtMoney, fmtMonth, buildCopy, initials, firstName };
})();
