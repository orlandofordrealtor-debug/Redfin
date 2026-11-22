/* Spotlight Studio — app logic. Runs inside a Claude artifact viewer; degrades gracefully when a capability is absent. */
(() => {
  'use strict';
  const E = window.StudioEngine;

  /* ---------------- utilities ---------------- */
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const slug = (s) => String(s || '').toLowerCase().normalize('NFKD').replace(/[^\w\s-]/g, '').trim().replace(/[\s_]+/g, '-').replace(/-+/g, '-').slice(0, 60) || 'item';
  const initials = (n) => E.initials(n) || '?';
  const debounce = (fn, ms) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };
  const today = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
  const lsGet = (k, d) => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } };
  const lsSet = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* storage unavailable */ } };
  const use = (n) => (window.claude && window.claude.use ? window.claude.use(n).catch(() => null) : Promise.resolve(null));
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  function toast(msg, kind, ms) {
    const el = document.createElement('div'); el.className = 'toast' + (kind === 'err' ? ' err' : kind === 'progress' ? ' progress' : ''); el.textContent = msg;
    $('#toasts').appendChild(el); if (kind !== 'progress') setTimeout(() => el.remove(), ms || (kind === 'err' ? 7000 : 3400)); return el;
  }
  function loadImage(src) { return new Promise((res) => { const i = new Image(); i.decoding = 'async'; i.onload = () => res(i); i.onerror = () => res(null); i.src = src; }); }
  function downscale(img, max = 2400) {
    const w = img.naturalWidth || img.width, h = img.naturalHeight || img.height; const s = Math.min(1, max / Math.max(w, h));
    const c = document.createElement('canvas'); c.width = Math.round(w * s); c.height = Math.round(h * s); const x = c.getContext('2d'); x.imageSmoothingQuality = 'high'; x.drawImage(img, 0, 0, c.width, c.height); return c;
  }
  function blobToDataURL(b) { return new Promise((r) => { const f = new FileReader(); f.onload = () => r(f.result); f.readAsDataURL(b); }); }
  const DRIVE = 'Google Drive';
  const ROOT_FOLDER = '1QECvSvKWApnzq052HLfxs2Q30yLK78O5';
  const CLOSED = ['closed_buy', 'closed_sell', 'premier_buy', 'premier_sell'];
  const MORE = ['just_listed', 'coming_soon', 'open_house', 'under_contract', 'in_escrow', 'price_improvement', 'back_on_market', 'client_review'];
  const FMTS = ['story', 'feed', 'square', 'wide'];
  const TYPE_SUB = {
    closed_buy: ['Buyer represented', 'Just Closed', 'std'], closed_sell: ['Seller represented', 'Just Sold', 'std2'],
    premier_buy: ['Premier buyer representation', 'Welcome Home', 'prem'], premier_sell: ['Premier seller representation', 'Just Sold', 'prem2'],
  };
  const DEFAULT_SETTINGS = { finePrint: '{agent} · DRE #{license} | Redfin · DRE #01521930', fileType: 'png', exportFormats: FMTS.slice(), agentsClosed: true, rootFolderId: ROOT_FOLDER };

  /* ---------------- state ---------------- */
  const DRAFT_KEY = 'spotlight.draft.v2';
  function blankDraft() {
    return { agentId: '', type: 'closed_sell', format: 'story', exportFormats: null, focus: { x: 0.5, y: 0.5 }, qrMode: 'auto', qrCustom: '',
      data: { city: '', state: 'CA', price: '', showPrice: true, date: today(), showDate: true, beds: '', baths: '', sqft: '', ohDate1: '', ohTime1: '', ohDate2: '', ohTime2: '', prevPrice: '', review: '', reviewer: '', reviewRole: '', headline: '', tagline: '', cta: '' } };
  }
  const S = {
    db: null, user: null, assets: null, sample: null, mcp: null, downloads: null, ready: false,
    me: { id: null, name: '', avatarUrl: '', isOwner: false, isMgr: false, canWrite: null },
    agents: [], settings: Object.assign({}, DEFAULT_SETTINGS), campaigns: [], claims: [], myClaim: null, loaded: new Set(),
    tab: 'create', photos: [], shot: null, designs: [], captions: null, capsBusy: false, deliverBusy: false, lastDelivery: null,
    draft: Object.assign(blankDraft(), lsGet(DRAFT_KEY, {})), cache: { heads: {}, qrs: {} }, vaultAgent: '', rosterQ: '', agentQ: '',
  };
  S.draft.data = Object.assign(blankDraft().data, S.draft.data || {});
  S.designs = E.LAYOUTS.map((l, i) => ({ layout: i, seed: 0, fav: false, palette: null, scriptFam: null, copy: {} }));
  const saveDraft = debounce(() => lsSet(DRAFT_KEY, S.draft), 300);
  const agentById = (id) => S.agents.find((a) => a.id === id) || null;
  const curAgent = () => agentById(S.draft.agentId);
  const lockedAgentId = () => (S.me.isMgr ? '' : (S.myClaim || ''));

  /* ---------------- boot ---------------- */
  async function boot() {
    renderAll();
    E.ensureFonts().then(() => refreshGallery());
    const [db, user, sample, mcp, downloads] = await Promise.all([use('db'), use('user'), use('sample'), use('mcp'), use('downloads')]);
    S.db = db; S.user = user; S.sample = sample; S.mcp = mcp; S.downloads = downloads;
    if (user) {
      const me = await user.me(); S.me.id = me.id; S.me.name = me.name; S.me.avatarUrl = me.avatarUrl; S.me.isOwner = me.isOwner; S.me.isMgr = me.isOwner || me.canEdit;
      S.me.canWrite = await user.can('data.write');
    }
    if (S.me.isMgr) S.assets = await use('assets');
    S.ready = true;
    S.myClaim = lsGet('spotlight.claim', null);
    if (!S.me.isMgr && S.myClaim) S.draft.agentId = S.myClaim;
    if (db) subscribe(); else { S.loaded.add('agents'); }
    renderAll();
  }
  function subscribe() {
    const err = (what) => (e) => { console.warn(what, e); if (e && e.code === 'revoked') banner('Your access to this Studio changed. Reload to continue.'); };
    S.db.collection('agents').onSnapshot((snap) => {
      S.agents = snap.docs.map((d) => Object.assign({ id: d.id }, d.data())).filter((a) => a.active !== false).sort((a, b) => String(a.name).localeCompare(String(b.name)));
      S.loaded.add('agents'); preloadAgentAssets(); renderAll(); refreshGallery();
    }, err('agents'));
    S.db.doc('settings/brand').onSnapshot((d) => { S.settings = Object.assign({}, DEFAULT_SETTINGS, d.exists ? d.data() : {}); renderAll(); refreshGallery(); }, err('settings'));
    S.db.collection('campaigns').orderBy('createdAt', 'desc').limit(300).onSnapshot((snap) => { S.campaigns = snap.docs.map((d) => Object.assign({ id: d.id }, d.data())); S.loaded.add('campaigns'); renderTabsCounts(); if (S.tab === 'vault') renderVault(); }, err('campaigns'));
    if (S.me.isMgr) S.db.collection('claims').onSnapshot((snap) => { S.claims = snap.docs.map((d) => Object.assign({ id: d.id }, d.data())); if (S.tab === 'roster') renderRoster(); }, err('claims'));
    else if (S.me.id) S.db.doc('claims/' + S.me.id).onSnapshot((d) => { if (d.exists && d.data().agentId) { S.myClaim = d.data().agentId; lsSet('spotlight.claim', S.myClaim); S.draft.agentId = S.myClaim; renderAll(); refreshGallery(); } }, err('claim'));
  }
  function banner(html) { $('#banner').innerHTML = html ? `<div class="banner">${html}</div>` : ''; }

  /* ---------------- images for agents ---------------- */
  function headSrc(a) { return a && a.headshotAssetId ? '/_blob/' + a.headshotAssetId : ''; }
  function getHead(a) {
    if (!a || !a.headshotAssetId) return Promise.resolve(null);
    const k = a.headshotAssetId; if (!S.cache.heads[k]) S.cache.heads[k] = loadImage('/_blob/' + k); return S.cache.heads[k];
  }
  function getQrImg(a) {
    if (!a || !a.qrAssetId) return Promise.resolve(null);
    const k = a.qrAssetId; if (!S.cache.qrs[k]) S.cache.qrs[k] = loadImage('/_blob/' + k); return S.cache.qrs[k];
  }
  function preloadAgentAssets() { const a = curAgent(); if (a) { getHead(a); getQrImg(a); } }

  /* ---------------- spec building ---------------- */
  function qrInfo(a) {
    const m = S.draft.qrMode;
    if (m === 'custom' && /^https?:\/\//i.test(S.draft.qrCustom || '')) return { text: S.draft.qrCustom, label: 'Custom link' };
    if (a && a.qrAssetId && (m === 'auto' || m === 'image')) return { image: true, label: 'Uploaded QR code' };
    if (a && a.loyaltyUrl && (m === 'auto' || m === 'loyalty')) return { text: a.loyaltyUrl, label: 'Loyalty link' };
    if (a && a.profileUrl) return { text: a.profileUrl, label: 'Redfin profile', fallback: true };
    return { text: '', label: 'No link yet' };
  }
  function engineAgent(a) {
    if (!a) return { name: 'Agent Name', title: 'Redfin Agent', phone: '(000) 000-0000', license: '00000000', stats: {} };
    return { name: a.name, title: a.title || 'Redfin Agent', phone: a.phone || '', license: a.license || '', tagline: a.tagline || '', stats: Object.assign({}, a.stats || {}) };
  }
  function engineData(design) {
    const d = Object.assign({}, S.draft.data);
    if (!d.city) d.city = 'Your City';
    const c = (design && design.copy) || {};
    if (c.headline) d.headline = c.headline; if (c.tagline) d.tagline = c.tagline;
    return d;
  }
  async function specFor(design, format) {
    const a = curAgent(); const qi = qrInfo(a);
    const [head, qrImg] = await Promise.all([getHead(a), qi.image ? getQrImg(a) : Promise.resolve(null)]);
    return { format, layout: design.layout, type: S.draft.type, seed: design.seed, palette: design.palette || undefined, scriptFam: design.scriptFam || undefined,
      data: engineData(design), agent: engineAgent(a), photos: S.photos.map((p) => p.img), headshot: head, qrText: qi.text, qrImage: qrImg,
      brand: { finePrint: S.settings.finePrint }, focus: S.draft.focus };
  }

  /* ---------------- render: tabs & who ---------------- */
  function renderAll() {
    renderWho(); renderTabsCounts();
    $$('.tab[data-mgr]').forEach((t) => { t.hidden = !S.me.isMgr; });
    $$('.tab').forEach((t) => t.classList.toggle('is-active', t.dataset.tab === S.tab));
    $$('.view').forEach((v) => { v.hidden = v.id !== 'view-' + S.tab; });
    if (S.tab === 'create') { renderHero(); renderSteps(); renderGalleryShell(); }
    else if (S.tab === 'vault') renderVault();
    else if (S.tab === 'roster') renderRoster();
    else if (S.tab === 'playbook') renderPlaybook();
    else if (S.tab === 'settings') renderSettings();
  }
  function renderWho() {
    const w = $('#who'); if (!S.ready) { w.innerHTML = '<span class="chip">Connecting…</span>'; return; }
    if (!S.user) { w.innerHTML = '<span class="chip warn">Preview mode</span>'; return; }
    w.innerHTML = `<img src="${esc(S.me.avatarUrl)}" alt=""><span class="nm">${esc(S.me.name || 'You')}</span><span class="role">${S.me.isMgr ? 'Manager' : 'Agent'}</span>`;
  }
  function renderTabsCounts() {
    const mine = vaultList().length; $('#vaultCount').textContent = mine ? mine : '';
    $('#rosterCount').textContent = S.agents.length ? S.agents.length : '';
  }

  /* ---------------- create: hero ---------------- */
  function stepState() {
    const a = curAgent(); const d = S.draft.data;
    return { shot: !!(S.shot && S.shot.status === 'done'), photo: S.photos.length > 0, agent: !!a, type: !!S.draft.type, details: !!(d.city && (d.city !== '')) };
  }
  function renderHero() {
    const st = stepState(); const done = [st.photo, st.agent, st.type, st.details].filter(Boolean).length;
    const a = curAgent();
    $('#heroEyebrow').textContent = S.me.isMgr ? 'Manager studio · Redfin Powered by Rocket' : (a ? `${a.name.split(' ')[0]}’s studio · Redfin Powered by Rocket` : 'Agent studio · Redfin Powered by Rocket');
    $('#progress').innerHTML = `<div class="progress-top"><span>${done} of 4 ready</span><span class="muted">${done === 4 ? 'Ready to deliver' : 'The gallery updates as you go'}</span></div>
      <div class="bar"><i style="width:${done * 25}%"></i></div>
      <div class="chips"><span class="chip ${st.photo ? 'ok' : ''}">Photo</span><span class="chip ${st.agent ? 'ok' : ''}">Agent</span><span class="chip ${st.type ? 'ok' : ''}">Type</span><span class="chip ${st.details ? 'ok' : ''}">Details</span></div>`;
  }

  /* ---------------- create: steps ---------------- */
  function step(n, title, hint, body, done) {
    return `<section class="step ${done ? 'is-done' : ''}"><div class="step-head"><span class="step-num">${done ? '✓' : n}</span><h3>${title}</h3><span class="hint">${hint}</span></div><div class="step-body">${body}</div></section>`;
  }
  function renderSteps() {
    const st = stepState(); const d = S.draft.data; const T = E.TYPES[S.draft.type];
    const html = [];
    // 1 screenshot
    let shotBody = '';
    if (S.shot) {
      const r = S.shot.result;
      shotBody = `<div class="shot"><img src="${esc(S.shot.url)}" alt="Closing screenshot"><div class="extract">
        ${S.shot.status === 'busy' ? '<div class="thinking">Claude is reading the screenshot…</div>' : ''}
        ${S.shot.status === 'done' && r ? `<b>Filled in from the screenshot</b><div class="kv">${[r.agentName && `<span class="chip ok">${esc(r.agentName)}</span>`, r.typeLabel && `<span class="chip ok">${esc(r.typeLabel)}</span>`, r.city && `<span class="chip ok">${esc(r.city)}</span>`, r.price && `<span class="chip ok">${esc(E.fmtMoney(r.price))}</span>`, r.date && `<span class="chip ok">${esc(r.date)}</span>`].filter(Boolean).join('')}</div>${r.notes ? `<small class="muted">${esc(r.notes)}</small>` : ''}` : ''}
        ${S.shot.status === 'error' ? `<span class="chip warn">${esc(S.shot.error)}</span>` : ''}
        <div class="btn-row"><button class="btn btn-xs" data-action="reread" ${S.shot.status === 'busy' ? 'disabled' : ''}>Read again</button><button class="btn btn-xs btn-ghost" data-action="clear-shot">Remove</button></div></div></div>`;
    } else {
      shotBody = `<label class="drop" id="shotDrop"><input type="file" accept="image/*" id="shotInput"><span class="ic">✉</span><b>Drop the closed email screenshot</b><span>Claude reads the agent, side, city, price and date for you.</span></label>
        ${S.sample ? '' : '<small class="muted">Screenshot reading needs Claude in this view. You can fill the details by hand below.</small>'}`;
    }
    html.push(step(1, 'Closing screenshot', 'Optional · auto-fills', shotBody, st.shot));
    // 2 photos
    const phs = S.photos.map((p, i) => `<div class="ph ${i === 0 ? 'is-hero' : ''}" data-photo="${i}">${i === 0 ? '<span class="tag">HERO</span>' : ''}<img src="${esc(p.url)}" alt="Property photo ${i + 1}">${i === 0 ? `<span class="dot" style="left:${S.draft.focus.x * 100}%;top:${S.draft.focus.y * 100}%"></span>` : ''}<button class="x" data-action="rm-photo" data-i="${i}" aria-label="Remove photo">×</button></div>`).join('');
    html.push(step(2, 'Property photo', S.photos.length ? 'Tap the hero to set focus' : 'Exterior works best',
      `${S.photos.length ? `<div class="photos">${phs}</div>` : ''}${S.photos.length < 4 ? `<label class="drop" id="photoDrop"><input type="file" accept="image/*" multiple id="photoInput"><span class="ic">▣</span><b>${S.photos.length ? 'Add more photos' : 'Drop the property photo'}</b><span>Up to 4. The first is the hero. Extras feed the gallery layouts.</span></label>` : ''}`, st.photo));
    // 3 agent
    html.push(step(3, S.me.isMgr ? 'Agent' : 'You', S.me.isMgr ? `${S.agents.length} on roster` : '', agentStepBody(), st.agent));
    // 4 type
    html.push(step(4, 'Transaction type', T ? T.label : '', typeStepBody(), st.type));
    // 5 details
    html.push(step(5, 'Details', 'City only, never the street', detailsBody(d), st.details));
    html.push(`<div class="generate"><button class="btn btn-primary btn-lg" data-action="generate">Generate 15 designs</button><small class="muted" style="text-align:center">Every change updates the gallery live. Star your favorites, then deliver.</small></div>`);
    $('#steps').innerHTML = html.join('');
  }
  function agentStepBody() {
    const a = curAgent();
    if (!S.loaded.has('agents')) return '<div class="thinking">Loading the roster…</div>';
    if (!S.agents.length) return `<div class="empty" style="margin:0"><b>No agents yet</b><span>${S.me.isMgr ? 'Add agents in the Roster tab.' : 'Your manager is setting up the roster.'}</span></div>`;
    const locked = !S.me.isMgr && S.myClaim;
    let card = '';
    if (a) {
      const qi = qrInfo(a); const s = a.stats || {};
      card = `<div class="agent-card">${a.headshotAssetId ? `<img src="${esc(headSrc(a))}" alt="">` : `<span class="ini">${esc(initials(a.name))}</span>`}
        <div style="min-width:0"><b>${esc(a.name)}</b><small>${esc(a.title || 'Redfin Agent')}${a.license ? ' · DRE #' + esc(a.license) : ''}</small>
        <div class="statline">${[s.deals && s.deals + ' deals', s.volume && s.volume + ' volume', s.highest && s.highest + ' highest'].filter(Boolean).join(' · ') || 'Stats not on file'}</div></div>
        ${locked ? '<button class="btn btn-xs btn-ghost" data-action="unclaim">Not you?</button>' : '<button class="btn btn-xs btn-ghost" data-action="pick-agent-again">Change</button>'}</div>
        <div class="chips"><span class="chip ${qi.fallback ? 'warn' : qi.text || qi.image ? 'ok' : 'warn'}">QR → ${esc(qi.label)}</span>${a.driveFolderId ? '<span class="chip ok">Drive vault linked</span>' : '<span class="chip warn">No Drive folder</span>'}${s.updatedAt ? `<span class="chip">Stats ${esc(String(s.updatedAt).slice(0, 10))}</span>` : ''}</div>`;
      if (locked || !S.showAgentGrid) return card + (S.me.isMgr ? '' : '<small class="muted">Your headshot, stats and QR code load automatically.</small>');
    }
    const q = (S.agentQ || '').toLowerCase();
    const list = S.agents.filter((x) => !q || x.name.toLowerCase().includes(q));
    const grid = `<input class="input" id="agentSearch" placeholder="${S.me.isMgr ? 'Search agents' : 'Find your name'}" value="${esc(S.agentQ)}">
      <div class="agent-grid">${list.map((x) => `<button class="ag ${x.id === S.draft.agentId ? 'is-active' : ''}" data-action="pick-agent" data-id="${esc(x.id)}"><span class="av">${x.headshotAssetId ? `<img src="${esc(headSrc(x))}" alt="" loading="lazy">` : esc(initials(x.name))}</span>${esc(x.name)}</button>`).join('')}</div>
      ${S.me.isMgr ? '' : '<small class="muted">Pick yourself once. The Studio remembers you.</small>'}`;
    return (a ? card : '') + grid;
  }
  function typeStepBody() {
    const t = S.draft.type; const allowClosed = S.me.isMgr || S.settings.agentsClosed !== false;
    const cards = CLOSED.map((k) => { const T = E.TYPES[k]; const [sub, word, sw] = TYPE_SUB[k];
      return `<button class="tcard ${t === k ? 'is-active' : ''}" data-action="pick-type" data-type="${k}" ${allowClosed ? '' : 'disabled'}>${T.tier === 'premier' ? '<span class="pm">PREMIER</span>' : ''}<span class="sw ${sw}">${word}</span><span><b>${esc(T.label.replace('Closed · ', 'Closed '))}</b><small>${esc(sub)}</small></span></button>`; }).join('');
    const more = MORE.map((k) => `<button class="mchip ${t === k ? 'is-active' : ''}" data-action="pick-type" data-type="${k}">${esc(E.TYPES[k].label)}</button>`).join('');
    return `<div class="section-label">Closings</div><div class="types">${cards}</div><div class="section-label">Listings and more</div><div class="morechips">${more}</div>`;
  }
  function f(id, label, val, attrs = '') { return `<label class="field"><span>${label}</span><input class="input" id="${id}" data-field="${id.replace(/^d_/, '')}" value="${esc(val)}" ${attrs}></label>`; }
  function detailsBody(d) {
    const t = S.draft.type; const listing = ['just_listed', 'coming_soon', 'open_house', 'under_contract', 'in_escrow', 'price_improvement', 'back_on_market'].includes(t);
    const parts = [];
    parts.push(`<div class="row2">${f('d_city', 'City', d.city, 'placeholder="Manhattan Beach" autocomplete="off"')}${f('d_state', 'State', d.state, 'placeholder="CA" maxlength="20"')}</div>`);
    if (t !== 'client_review') {
      parts.push(`<div class="row2"><label class="field"><span>${esc((E.TYPES[t].priceLabel || 'Price'))}</span><input class="input" id="d_price" data-field="price" inputmode="numeric" placeholder="2,450,000" value="${esc(d.price)}"></label>
        <label class="field"><span>${CLOSED.includes(t) ? 'Close date' : 'Date'}</span><input class="input" type="date" id="d_date" data-field="date" value="${esc(d.date)}"></label></div>
        <div class="row2"><label class="inline-sw"><input type="checkbox" class="switch" id="d_showPrice" data-check="showPrice" ${d.showPrice !== false ? 'checked' : ''}> Show price</label><label class="inline-sw"><input type="checkbox" class="switch" id="d_showDate" data-check="showDate" ${d.showDate !== false ? 'checked' : ''}> Show month</label></div>`);
    }
    if (t === 'price_improvement') parts.push(`<div class="row2">${f('d_prevPrice', 'Previous price', d.prevPrice, 'inputmode="numeric" placeholder="2,595,000"')}</div>`);
    if (listing) parts.push(`<div class="row3">${f('d_beds', 'Beds', d.beds, 'inputmode="numeric"')}${f('d_baths', 'Baths', d.baths, 'inputmode="decimal"')}${f('d_sqft', 'Sq ft', d.sqft, 'inputmode="numeric"')}</div>`);
    if (t === 'open_house') parts.push(`<div class="row2">${f('d_ohDate1', 'Day 1', d.ohDate1, 'placeholder="Sat, Nov 29"')}${f('d_ohTime1', 'Time', d.ohTime1, 'placeholder="1–4 PM"')}</div><div class="row2">${f('d_ohDate2', 'Day 2 (optional)', d.ohDate2, 'placeholder="Sun, Nov 30"')}${f('d_ohTime2', 'Time', d.ohTime2, 'placeholder="12–3 PM"')}</div>`);
    if (t === 'client_review') parts.push(`<label class="field"><span>Review text</span><textarea class="textarea" id="d_review" data-field="review" maxlength="420" placeholder="Paste the client’s words exactly as written">${esc(d.review)}</textarea><small>Use the client’s exact words and get their OK before posting.</small></label><div class="row2">${f('d_reviewer', 'Client first name(s)', d.reviewer, 'placeholder="Jordan & Priya"')}${f('d_reviewRole', 'Context', d.reviewRole, 'placeholder="Buyers in Torrance"')}</div>`);
    const a = curAgent(); const qi = qrInfo(a);
    parts.push(`<details class="more"><summary>Headline, QR and copy overrides</summary><div class="inner">
      ${f('d_headline', 'Script headline (all designs)', d.headline, 'placeholder="Leave blank to rotate: Just Sold, Sold, …"')}
      ${f('d_tagline', 'Tagline', d.tagline, 'placeholder="Leave blank for curated taglines"')}
      ${f('d_cta', 'Call to action', d.cta, 'placeholder="Scan to connect with Heidi"')}
      <label class="field"><span>QR code goes to</span><select class="select" id="qrMode">
        <option value="auto" ${S.draft.qrMode === 'auto' ? 'selected' : ''}>Best available (${esc(qi.label)})</option>
        <option value="loyalty" ${S.draft.qrMode === 'loyalty' ? 'selected' : ''}>Loyalty link</option>
        <option value="profile" ${S.draft.qrMode === 'profile' ? 'selected' : ''}>Redfin agent profile</option>
        <option value="custom" ${S.draft.qrMode === 'custom' ? 'selected' : ''}>Custom link (listing page, open house RSVP)</option></select></label>
      ${S.draft.qrMode === 'custom' ? f('qrCustom', 'Custom QR link', S.draft.qrCustom, 'placeholder="https://www.redfin.com/…"') : ''}
    </div></details>`);
    return parts.join('');
  }

  /* ---------------- gallery ---------------- */
  function renderGalleryShell() {
    const fmt = S.draft.format; const a = curAgent(); const T = E.TYPES[S.draft.type];
    const favs = S.designs.filter((d) => d.fav).length;
    const exp = exportFormats();
    const count = (favs || S.designs.length) * exp.length;
    const note = !S.photos.length ? '<span class="chip warn">Add a property photo to fill the frames</span>' : !a ? '<span class="chip warn">Pick an agent</span>' : '';
    $('#gallery').innerHTML = `
      <div class="gbar"><div class="meta"><b>${esc(T.label)} · ${esc(S.draft.data.city || 'Your City')}</b><span class="muted">${a ? esc(a.name) : 'Preview'} · 15 designs</span></div>
        <div class="seg" id="fmtSeg">${FMTS.map((k) => `<button data-action="fmt" data-fmt="${k}" class="${fmt === k ? 'is-active' : ''}">${E.FORMATS[k].ratio} ${k === 'story' ? 'Story' : k === 'feed' ? 'Feed' : k === 'square' ? 'Square' : 'LinkedIn'}</button>`).join('')}</div>
        <button class="btn btn-sm btn-ghost" data-action="shuffle-all" title="New palettes and scripts">Shuffle all</button>
        <button class="btn btn-sm" data-action="captions" ${S.capsBusy ? 'disabled' : ''}>${S.capsBusy ? 'Writing…' : 'Write captions'}</button></div>
      ${note ? `<div style="padding:12px 16px 0" class="chips">${note}</div>` : ''}
      <div class="grid ${fmt === 'wide' ? 'wide' : ''}" id="grid">${S.designs.map((d, i) => `
        <div class="dcard ${d.fav ? 'is-fav' : ''}" data-card="${i}" style="animation-delay:${i * 0.02}s"><div class="dthumb" data-action="open" data-i="${i}"><canvas aria-label="${esc(E.LAYOUTS[d.layout].name)} design"></canvas><span class="num">${String(i + 1).padStart(2, '0')}</span><button class="fav" data-action="fav" data-i="${i}" aria-label="Favorite">${d.fav ? '★' : '☆'}</button></div>
          <div class="dmeta"><div style="min-width:0"><b>${esc(E.LAYOUTS[d.layout].name)}</b><small data-pal="${i}"></small></div><button class="btn btn-xs btn-ghost" data-action="shuffle" data-i="${i}" title="Try another palette and script">⟳</button></div></div>`).join('')}</div>
      <div id="capsBox">${capsHtml()}</div>
      <div class="deliver">
        <div class="grow"><b>${favs ? favs + ' favorite' + (favs > 1 ? 's' : '') : 'All 15 designs'}</b> × ${exp.length} size${exp.length > 1 ? 's' : ''} = <b>${count} files</b>${favs ? '' : ' <span class="muted">· star favorites to send fewer</span>'}
          <div class="fmtpick" style="margin-top:8px">${FMTS.map((k) => `<label><input type="checkbox" data-expfmt="${k}" ${exp.includes(k) ? 'checked' : ''}>${E.FORMATS[k].ratio}</label>`).join('')}</div></div>
        <button class="btn" data-action="download" ${S.deliverBusy ? 'disabled' : ''}>Download</button>
        <button class="btn btn-primary" data-action="drive" ${S.deliverBusy || !a ? 'disabled' : ''}>Save to ${a ? esc(a.name.split(' ')[0]) + '’s' : 'agent'} Drive</button>
      </div>
      ${S.lastDelivery ? `<div class="deliver" style="border-radius:0 0 18px 18px"><span class="chip ok">Saved</span><span class="grow">${esc(S.lastDelivery.count)} files in <b>${esc(S.lastDelivery.folderName)}</b></span><a class="btn btn-sm" href="${esc(S.lastDelivery.url)}" target="_blank" rel="noopener">Open folder</a></div>` : ''}`;
    refreshGallery();
  }
  function exportFormats() { const ex = S.draft.exportFormats || S.settings.exportFormats || FMTS; return FMTS.filter((k) => ex.includes(k)); }
  let renderToken = 0;
  async function refreshGallery() {
    if (S.tab !== 'create') return; const grid = $('#grid'); if (!grid) return;
    const tok = ++renderToken; await E.ensureFonts(); if (tok !== renderToken) return;
    const fmt = S.draft.format; const F = E.FORMATS[fmt]; const dpr = Math.min(2, window.devicePixelRatio || 1);
    const cards = $$('.dcard', grid);
    for (let i = 0; i < cards.length; i++) {
      if (tok !== renderToken) return;
      const c = $('canvas', cards[i]); const cssW = Math.max(160, cards[i].clientWidth || 220);
      const spec = await specFor(S.designs[i], fmt); if (tok !== renderToken) return;
      const info = E.render(c, spec, (cssW * dpr) / F.w);
      const pal = $(`[data-pal="${i}"]`); if (pal) pal.textContent = info.paletteName;
      if (i % 3 === 2) await new Promise((r) => requestAnimationFrame(r));
    }
    if (S.drawerDesign != null) renderPreviewCanvas();
  }
  const refreshSoon = debounce(() => { renderHero(); refreshGallery(); }, 260);

  /* ---------------- captions ---------------- */
  function capsHtml() {
    const c = S.captions; if (!c) return '';
    const block = (k, label, text) => text ? `<div class="cap"><div class="cap-head"><b>${label}</b><button class="btn btn-xs" data-action="copy" data-copy="${k}">Copy</button></div><pre>${esc(text)}</pre></div>` : '';
    return `<div class="caps"><div class="cap-head"><b style="font-size:15px">Captions</b><button class="btn btn-xs btn-ghost" data-action="captions">Rewrite</button></div>
      ${block('instagram', 'Instagram', c.instagram)}${block('facebook', 'Facebook', c.facebook)}${block('linkedin', 'LinkedIn', c.linkedin)}
      ${c.hashtags && c.hashtags.length ? block('hashtags', 'Hashtags', c.hashtags.join(' ')) : ''}
      ${c.headlines && c.headlines.length ? `<div class="cap"><div class="cap-head"><b>Headline ideas</b><small class="muted">Tap one to apply it to every design</small></div><div class="morechips">${c.headlines.map((h) => `<button class="mchip" data-action="apply-headline" data-h="${esc(h)}">${esc(h)}</button>`).join('')}</div></div>` : ''}</div>`;
  }
  function captionFacts() {
    const a = curAgent(); const d = S.draft.data; const T = E.TYPES[S.draft.type]; const s = (a && a.stats) || {};
    return { type: T.label, representation: T.eyebrow, agent: a ? a.name : '', title: a ? a.title : '', city: [d.city, d.state].filter(Boolean).join(', '),
      price: d.showPrice !== false && d.price ? E.fmtMoney(d.price) : '', month: d.showDate !== false && d.date ? E.fmtMonth(d.date) : '',
      beds: d.beds, baths: d.baths, sqft: d.sqft, openHouse: [d.ohDate1, d.ohTime1, d.ohDate2, d.ohTime2].filter(Boolean).join(' '), previousPrice: d.prevPrice,
      review: d.review, reviewer: d.reviewer, careerDeals: s.deals, careerVolume: s.volume, highestSale: s.highest, phone: a ? a.phone : '', license: a ? a.license : '' };
  }
  async function writeCaptions() {
    if (!S.sample) { toast('Captions need Claude in this view. Open the Studio in Claude to use it.', 'err'); return; }
    S.capsBusy = true; renderGalleryShell(); const t = toast('Claude is writing captions…', 'progress');
    const facts = captionFacts();
    const prompt = `You are the social media lead for a Redfin Powered by Rocket real estate team in Southern California. Write post captions for this graphic.
FACTS (use only these; omit empty ones; never invent numbers, awards or claims):
${JSON.stringify(facts, null, 1)}
RULES:
- Never mention a street address. City only.
- Fair housing: never describe who the home is ideal for, demographics, religion, family status, schools quality, or "safe" neighborhoods.
- Voice: polished, warm, confident, consumer-friendly; luxury but human; celebrate the client and the agent's guidance.
- Instagram: 4-7 short lines, 1-3 tasteful emojis, end with a call to action to scan the QR code or DM the agent. Facebook: 2 short paragraphs, friendly. LinkedIn: professional, 2-3 sentences, no emojis, mention the team's service.
- Credit "Redfin Powered by Rocket" once per caption.
- hashtags: 8-12 relevant tags (city, Southern California, real estate, Redfin).
- headlines: 6 alternative script headlines, 1-3 words each, matching the transaction type.
Reply with only JSON: {"instagram": string, "facebook": string, "linkedin": string, "hashtags": [string], "headlines": [string]}`;
    try {
      const out = await S.sample.json(prompt, { cache: false });
      S.captions = { instagram: String(out.instagram || ''), facebook: String(out.facebook || ''), linkedin: String(out.linkedin || ''), hashtags: Array.isArray(out.hashtags) ? out.hashtags.map(String).slice(0, 14) : [], headlines: Array.isArray(out.headlines) ? out.headlines.map(String).filter((h) => h.length <= 26).slice(0, 8) : [] };
    } catch (e) { toast(sampleErr(e), 'err'); }
    t.remove(); S.capsBusy = false; renderGalleryShell();
  }
  function sampleErr(e) {
    switch (e && e.code) {
      case 'not_granted': case 'sampling_disabled': case 'not_declared': case 'capability_disabled': return 'Claude features are off for this view. Fill the details by hand.';
      case 'rate_limited': return 'Claude is busy right now. Try again in a minute.';
      case 'images_unavailable': return 'This view can’t send images to Claude. Fill the details by hand.';
      case 'image_rejected': return 'Claude couldn’t read that image. Try a PNG or JPG screenshot.';
      case 'invalid_json': return 'Claude’s answer came back malformed. Try again.';
      case 'refused': return 'Claude declined that request. Try a different screenshot.';
      case 'cancelled': return 'Cancelled.';
      default: return 'Claude couldn’t finish that. Try again.';
    }
  }

  /* ---------------- screenshot reading ---------------- */
  async function readShot() {
    if (!S.shot || !S.shot.file) return;
    if (!S.sample) { S.shot.status = 'error'; S.shot.error = 'Claude isn’t available in this view'; renderSteps(); return; }
    S.shot.status = 'busy'; renderSteps();
    const names = S.agents.map((a) => a.name);
    const prompt = `You are reading a screenshot of a real estate transaction notice for a Redfin Powered by Rocket sales team in Southern California (for example a "deal closed" email, a closing announcement, or a transaction summary).
Return only JSON with exactly these keys:
{"agentName": string|null, "side": "buy"|"sell"|"both"|null, "premier": boolean, "status": "closed"|"under_contract"|"in_escrow"|"listed"|"coming_soon"|"open_house"|"price_change"|"back_on_market"|null, "city": string|null, "state": string|null, "price": number|null, "date": "YYYY-MM-DD"|null, "beds": number|null, "baths": number|null, "sqft": number|null, "notes": string}
Rules:
- Use only what is visible in the image. If a value is not shown, use null. Never guess numbers.
- Never return a street address. Return the city name only (for example "Torrance"). State as a 2-letter code.
- "side": "buy" if the agent represented the buyer, "sell" if the seller/listing side, "both" if both sides.
- "premier": true only if the screenshot explicitly says Premier.
- "price": whole dollars as a number (sale price for a closing, list price for a listing).
- "date": the close date (or status date).
- If an agent from this roster appears, copy the name exactly as listed: ${JSON.stringify(names)}.
- "notes": one short sentence naming anything you were unsure about, or "".`;
    try {
      const r = await S.sample.json(prompt, { images: S.shot.file, modelTier: 'default' });
      applyExtraction(r || {}); S.shot.status = 'done';
    } catch (e) { S.shot.status = 'error'; S.shot.error = sampleErr(e); }
    renderAll(); refreshGallery();
  }
  function applyExtraction(r) {
    const d = S.draft.data; const res = { notes: String(r.notes || '') };
    if (r.city) { d.city = String(r.city).replace(/\d+.*$/, '').trim(); res.city = d.city; }
    if (r.state) d.state = String(r.state).toUpperCase().slice(0, 20);
    if (r.price && Number(r.price)) { d.price = String(Math.round(Number(r.price))); res.price = d.price; }
    if (r.date && /^\d{4}-\d{2}-\d{2}$/.test(r.date)) { d.date = r.date; res.date = E.fmtMonth(r.date); }
    ['beds', 'baths', 'sqft'].forEach((k) => { if (r[k]) d[k] = String(r[k]); });
    const st = r.status; const side = r.side; const prem = !!r.premier;
    let type = null;
    if (!st || st === 'closed') { if (side === 'buy') type = prem ? 'premier_buy' : 'closed_buy'; else if (side === 'sell' || side === 'both') type = prem ? 'premier_sell' : 'closed_sell'; }
    else type = { under_contract: 'under_contract', in_escrow: 'in_escrow', listed: 'just_listed', coming_soon: 'coming_soon', open_house: 'open_house', price_change: 'price_improvement', back_on_market: 'back_on_market' }[st] || null;
    if (type) { S.draft.type = type; res.typeLabel = E.TYPES[type].label + (side === 'both' ? ' (both sides)' : ''); }
    if (r.agentName) {
      const n = String(r.agentName).toLowerCase(); const hit = S.agents.find((a) => a.name.toLowerCase() === n) || S.agents.find((a) => n.includes(a.name.toLowerCase().split(' ').slice(-1)[0]) && n.includes(a.name.toLowerCase().split(' ')[0]));
      if (hit && (S.me.isMgr || !lockedAgentId())) { S.draft.agentId = hit.id; res.agentName = hit.name; preloadAgentAssets(); }
      else res.agentName = String(r.agentName) + (hit ? '' : ' (not on roster)');
    }
    S.shot.result = res; saveDraft();
  }

  /* ---------------- photos ---------------- */
  async function addPhotos(files) {
    const list = Array.from(files || []).filter((f) => /^image\//.test(f.type) || /\.(jpe?g|png|webp|heic|heif)$/i.test(f.name));
    for (const file of list) {
      if (S.photos.length >= 4) break;
      const url = URL.createObjectURL(file); const img = await loadImage(url);
      if (!img) { toast(`${file.name} couldn’t be opened. Use a JPG or PNG (on iPhone, share the photo as JPG).`, 'err'); URL.revokeObjectURL(url); continue; }
      S.photos.push({ url, img: downscale(img), name: file.name });
    }
    if (S.photos.length === 1) S.draft.focus = { x: 0.5, y: 0.5 };
    renderSteps(); renderHero(); renderGalleryShell();
  }
  function setShot(file) {
    if (!file) return; if (S.shot && S.shot.url) URL.revokeObjectURL(S.shot.url);
    S.shot = { file, url: URL.createObjectURL(file), status: 'idle' }; readShot();
  }

  /* ---------------- preview drawer ---------------- */
  function openDrawer(html, narrow) { const d = $('#drawer'); d.className = 'drawer' + (narrow ? ' narrow' : ''); d.innerHTML = html; $('#drawerWrap').hidden = false; }
  function closeDrawer() { $('#drawerWrap').hidden = true; $('#drawer').innerHTML = ''; S.drawerDesign = null; S.editAgent = null; }
  function openDesign(i) {
    S.drawerDesign = i; S.drawerFmt = S.draft.format; renderDesignDrawer();
  }
  function renderDesignDrawer() {
    const i = S.drawerDesign; const d = S.designs[i]; const L = E.LAYOUTS[d.layout]; const T = E.TYPES[S.draft.type];
    const pals = T.tier === 'premier' ? ['putty', 'stone', 'mushroom', 'umber'] : ['ivory', 'marble', 'coastal', 'sage', 'parchment', 'bronze', 'redfin', 'espresso', 'noir', 'slate', 'midnight', 'redbold'];
    const P = E.PALETTES;
    openDrawer(`<div class="drawer-head"><h3 id="drawerTitle">${String(i + 1).padStart(2, '0')} · ${esc(L.name)}</h3><button class="btn btn-sm btn-ghost" data-action="close-drawer">Close</button></div>
      <div class="drawer-body"><div class="pv"><div class="pv-stage"><canvas id="pvCanvas"></canvas></div>
        <div style="display:grid;gap:14px;align-content:start">
          <p class="muted">${esc(L.blurb)}</p>
          <div class="seg">${FMTS.map((k) => `<button data-action="pv-fmt" data-fmt="${k}" class="${S.drawerFmt === k ? 'is-active' : ''}">${E.FORMATS[k].ratio}</button>`).join('')}</div>
          <div class="field"><span class="lbl">Palette</span><div class="swatches">${pals.map((k) => `<button class="swatch ${d.palette === k ? 'is-active' : ''}" title="${esc(P[k].name)}" data-action="pv-pal" data-pal="${k}" style="background:linear-gradient(135deg,${P[k].bg} 0 55%,${P[k].dark ? P[k].accent : P[k].ink} 55%)"></button>`).join('')}<button class="btn btn-xs btn-ghost" data-action="pv-pal" data-pal="">Auto</button></div></div>
          <label class="field"><span>Script lettering</span><select class="select" id="pvScript"><option value="">Auto</option>${E.SCRIPTS.map((s) => `<option value="${s}" ${d.scriptFam === s ? 'selected' : ''}>${{ pinyon: 'Pinyon (copperplate)', vibes: 'Great Vibes (rounded)', italianno: 'Italianno (engraver)', brush: 'Alex Brush (brush)', monsieur: 'Monsieur (hairline)' }[s]}</option>`).join('')}</select></label>
          <label class="field"><span>Headline for this design</span><input class="input" id="pvHeadline" value="${esc(d.copy.headline || '')}" placeholder="${esc(S.draft.data.headline || 'Auto')}"></label>
          <label class="field"><span>Tagline for this design</span><input class="input" id="pvTagline" value="${esc(d.copy.tagline || '')}" placeholder="Auto"></label>
          <div class="btn-row"><button class="btn" data-action="fav" data-i="${i}">${d.fav ? '★ Favorite' : '☆ Add to favorites'}</button><button class="btn btn-ghost" data-action="shuffle" data-i="${i}">Shuffle</button></div>
        </div></div></div>
      <div class="drawer-foot"><button class="btn" data-action="dl-one">Download this size</button><button class="btn btn-primary" data-action="dl-sizes">Download all ${exportFormats().length} sizes</button></div>`);
    renderPreviewCanvas();
  }
  async function renderPreviewCanvas() {
    const c = $('#pvCanvas'); if (!c || S.drawerDesign == null) return; await E.ensureFonts();
    const F = E.FORMATS[S.drawerFmt]; const spec = await specFor(S.designs[S.drawerDesign], S.drawerFmt);
    E.render(c, spec, Math.min(1, 1100 / F.h));
  }

  /* ---------------- exports ---------------- */
  function mime() { return S.settings.fileType === 'jpg' ? ['image/jpeg', 'jpg', 0.93] : ['image/png', 'png', undefined]; }
  async function renderBlob(design, fmt) {
    const c = document.createElement('canvas'); const spec = await specFor(design, fmt); E.render(c, spec, 1);
    const [m, , q] = mime(); return await new Promise((r) => c.toBlob(r, m, q));
  }
  function fileName(design, fmt) {
    const a = curAgent(); const T = E.TYPES[S.draft.type]; const [, ext] = mime();
    return [slug(a ? a.name : 'agent'), slug(T.label.replace('·', '')), slug(S.draft.data.city), String(design.layout + 1).padStart(2, '0') + '-' + slug(E.LAYOUTS[design.layout].name), E.FORMATS[fmt].ratio.replace(':', 'x').replace('.', '')].join('_') + '.' + ext;
  }
  function readyToDeliver() {
    if (!curAgent()) { toast('Pick the agent first.', 'err'); return false; }
    if (!S.photos.length) { toast('Add the property photo first.', 'err'); return false; }
    if (!String(S.draft.data.city || '').trim()) { toast('Add the city first.', 'err'); $('#d_city') && $('#d_city').focus(); return false; }
    return true;
  }
  function deliveryItems() { const favs = S.designs.filter((d) => d.fav); const ds = favs.length ? favs : S.designs; const items = []; ds.forEach((d) => exportFormats().forEach((fm) => items.push({ d, fm }))); return items; }
  async function saveFile(filename, data) {
    if (!S.downloads) { toast('Downloads aren’t available in this view. Use Save to Drive instead.', 'err'); return false; }
    try { await S.downloads.save({ filename, data }); return true; }
    catch (e) { if (e && e.code === 'declined') return false; toast(e && e.code === 'rate_limited' ? 'A download prompt is already open.' : 'The download didn’t start. Try again.', 'err'); return false; }
  }
  async function downloadAll() {
    if (!readyToDeliver()) return;
    const items = deliveryItems(); if (!items.length) return;
    S.deliverBusy = true; renderGalleryShell(); const t = toast(`Rendering ${items.length} files…`, 'progress');
    try {
      if (items.length === 1) { const b = await renderBlob(items[0].d, items[0].fm); t.remove(); await saveFile(fileName(items[0].d, items[0].fm), b); }
      else {
        const zip = new window.JSZip(); let n = 0;
        for (const it of items) { zip.file(fileName(it.d, it.fm), await renderBlob(it.d, it.fm)); t.textContent = `Rendering ${++n} of ${items.length}…`; await sleep(0); }
        if (S.captions) zip.file('captions.txt', captionsText());
        t.textContent = 'Packing the ZIP…'; const blob = await zip.generateAsync({ type: 'blob' }); t.remove();
        const a = curAgent(); await saveFile(`${slug(a ? a.name : 'spotlight')}_${slug(E.TYPES[S.draft.type].label)}_${slug(S.draft.data.city)}.zip`, blob);
      }
    } catch (e) { console.error(e); t.remove(); toast('Something went wrong while rendering. Try fewer files.', 'err'); }
    S.deliverBusy = false; renderGalleryShell();
  }
  function captionsText() { const c = S.captions; if (!c) return ''; return `INSTAGRAM\n${c.instagram}\n\nFACEBOOK\n${c.facebook}\n\nLINKEDIN\n${c.linkedin}\n\nHASHTAGS\n${(c.hashtags || []).join(' ')}\n`; }

  /* ---------------- Google Drive delivery ---------------- */
  function driveErr(e) {
    switch (e && e.code) {
      case 'server_not_connected': case 'server_not_found': return 'Connect Google Drive in claude.ai Settings → Connectors, then try again.';
      case 'needs_reauth': return 'Reconnect Google Drive in claude.ai Settings → Connectors.';
      case 'not_in_manifest': return 'Google Drive isn’t allowed for this Studio yet. Allow it when Claude asks, or in the artifact’s Permissions menu.';
      case 'selection_required': return 'Choose which Google Drive account to use when Claude asks.';
      case 'blocked_by_policy': case 'approval_required': return 'Your organization blocks this Drive action. Use Download instead.';
      case 'tool_error': return 'Drive refused the save: ' + String(e.message || '').slice(0, 160);
      case 'server_unavailable': return 'Google Drive didn’t answer. Try again in a moment.';
      default: return 'Drive save didn’t finish. Try again or use Download.';
    }
  }
  function payloadOf(res) { const p = res && (res.payload ?? res.structuredContent); if (p && typeof p === 'object') return p; try { return JSON.parse(res.content[0].text); } catch (e) { return {}; } }
  async function driveCreate(input) { return payloadOf(await S.mcp.callTool(DRIVE, 'create_file', input)); }
  async function driveUpload(blob, name, parentId, fileArgs) {
    const type = blob.type || 'image/png';
    if (fileArgs) return driveCreate({ title: name, parentId, contentMimeType: type, disableConversionToGoogleType: true, base64Content: { $file: { data: blob, name, type } } });
    if (blob.size > 700 * 1024) { const err = new Error('too_large'); err.code = 'too_large_inline'; throw err; }
    const b64 = (await blobToDataURL(blob)).split(',')[1];
    return driveCreate({ title: name, parentId, contentMimeType: type, disableConversionToGoogleType: true, base64Content: b64 });
  }
  async function saveToDrive(useMyDrive) {
    const a = curAgent(); if (!readyToDeliver()) return;
    if (!S.mcp) { toast('Saving to Drive needs the Google Drive connector in this view. Use Download instead.', 'err'); return; }
    const items = deliveryItems(); const T = E.TYPES[S.draft.type];
    S.deliverBusy = true; renderGalleryShell();
    const t = toast('Connecting to Google Drive…', 'progress');
    let folder = null; let saved = 0; let first = null;
    try {
      let fileArgs = false; try { const lt = await S.mcp.listTools(); fileArgs = !!lt.fileArgs; } catch (e) { /* fall back to inline */ }
      if (!fileArgs && S.settings.fileType !== 'jpg') toast('This view can only send small files to Drive, so designs go up as high-quality JPGs.', null, 5000);
      const parent = useMyDrive ? undefined : (a.driveFolderId || S.settings.rootFolderId || ROOT_FOLDER);
      const folderName = `${S.draft.data.date || today()} · ${T.label.replace('·', '-')} · ${S.draft.data.city || 'Spotlight'}`;
      folder = await driveCreate(Object.assign({ title: folderName, contentMimeType: 'application/vnd.google-apps.folder' }, parent ? { parentId: parent } : {}));
      if (!folder || !folder.id) throw Object.assign(new Error('no folder'), { code: 'tool_error', message: 'Drive did not return a folder.' });
      const files = [];
      for (const it of items) {
        t.textContent = `Saving ${saved + 1} of ${items.length} to Drive…`;
        let blob = await renderBlob(it.d, it.fm); let name = fileName(it.d, it.fm);
        if (!fileArgs && blob.type === 'image/png') { const c = document.createElement('canvas'); E.render(c, await specFor(it.d, it.fm), 1); blob = await new Promise((r) => c.toBlob(r, 'image/jpeg', 0.86)); name = name.replace(/\.png$/, '.jpg'); }
        const fres = await driveUpload(blob, name, folder.id, fileArgs); saved++;
        files.push({ id: fres.id || '', name, url: fres.viewUrl || '' });
        if (!first) first = { d: it.d, fm: it.fm };
      }
      if (S.captions) { try { await driveCreate({ title: `Captions · ${a.name} · ${S.draft.data.city}`, parentId: folder.id, textContent: captionsText(), contentMimeType: 'text/plain' }); } catch (e) { /* captions are optional */ } }
      t.remove();
      const url = folder.viewUrl || `https://drive.google.com/drive/folders/${folder.id}`;
      S.lastDelivery = { count: saved, folderName, url };
      toast(`Saved ${saved} files to ${a.name.split(' ')[0]}’s Drive.`);
      logCampaign({ a, T, folder, url, files, first });
    } catch (e) {
      t.remove(); console.warn('drive', e);
      if (e && e.code === 'too_large_inline') toast('These files are too large for this view’s Drive connection. Use Download, or switch Settings → File type to JPG.', 'err');
      else if (!useMyDrive && e && e.code === 'tool_error' && !folder) { toast('You can’t write to this agent’s shared folder. Saving to your own Drive instead…', 'err'); S.deliverBusy = false; return saveToDrive(true); }
      else toast(driveErr(e) + (saved ? ` (${saved} files saved before it stopped.)` : ''), 'err');
    }
    S.deliverBusy = false; renderGalleryShell();
  }
  async function logCampaign({ a, T, folder, url, files, first }) {
    if (!S.db) return;
    let thumb = '';
    try { const c = document.createElement('canvas'); const spec = await specFor(first.d, 'feed'); E.render(c, spec, 240 / 1080); thumb = c.toDataURL('image/jpeg', 0.72); } catch (e) { /* thumbnail optional */ }
    const doc = { agentId: a.id, agentName: a.name, type: S.draft.type, typeLabel: T.label, city: S.draft.data.city || '', state: S.draft.data.state || '', date: S.draft.data.date || '', createdAt: new Date().toISOString(), createdBy: S.me.id || '', folderId: folder.id, folderUrl: url, fileCount: files.length, files: files.slice(0, 80), thumb, captions: S.captions ? captionsText().slice(0, 6000) : '' };
    try { await S.db.collection('campaigns').add(doc); } catch (e) { console.warn('campaign log', e); }
  }

  /* ---------------- vault ---------------- */
  function vaultList() { if (S.me.isMgr) return S.campaigns.filter((c) => !S.vaultAgent || c.agentId === S.vaultAgent); const me = S.myClaim; return me ? S.campaigns.filter((c) => c.agentId === me) : []; }
  function renderVault() {
    const v = $('#view-vault'); const list = vaultList(); const mgr = S.me.isMgr; const a = mgr ? agentById(S.vaultAgent) : agentById(S.myClaim);
    const hero = a ? `<div class="vault-hero">${a.headshotAssetId ? `<img src="${esc(headSrc(a))}" alt="">` : `<span class="ini">${esc(initials(a.name))}</span>`}<div style="display:grid;gap:8px;min-width:0"><h3>${esc(a.name)}’s asset vault</h3><p>Every graphic saved for ${esc(a.name.split(' ')[0])} lands in one Drive folder. Bookmark it and grab assets anytime.</p>
      <div class="btn-row">${a.driveFolderId ? `<a class="btn light" href="https://drive.google.com/drive/folders/${esc(a.driveFolderId)}" target="_blank" rel="noopener">Open Drive vault</a><button class="btn" data-action="copy-link" data-link="https://drive.google.com/drive/folders/${esc(a.driveFolderId)}">Copy vault link</button>` : '<span class="chip warn">No Drive folder linked yet</span>'}<button class="btn" data-action="goto-create">Create new</button></div></div></div>` : '';
    v.innerHTML = `<div class="page-head"><div><h2>Vault</h2><p>${mgr ? 'Every campaign the team has delivered, with its Drive folder.' : 'Your delivered campaigns and Drive folder.'}</p></div></div>
      ${mgr ? `<div class="filter-row"><select class="select" id="vaultAgent"><option value="">All agents</option>${S.agents.map((x) => `<option value="${esc(x.id)}" ${S.vaultAgent === x.id ? 'selected' : ''}>${esc(x.name)}</option>`).join('')}</select><span class="chip">${list.length} campaign${list.length === 1 ? '' : 's'}</span></div>` : ''}
      ${hero}
      ${!mgr && !S.myClaim ? '<div class="empty"><b>Pick yourself on the Create tab first</b><span>Your vault fills as you deliver campaigns.</span></div>' : ''}
      ${list.length ? `<div class="cards">${list.map((c) => `<article class="vcard"><div class="vimg" style="${c.thumb ? `background-image:url('${esc(c.thumb)}')` : ''}"></div><div class="vb"><b>${esc(c.typeLabel || '')} · ${esc(c.city || '')}</b><small>${esc(c.agentName || '')} · ${esc(String(c.createdAt || '').slice(0, 10))} · ${esc(c.fileCount || 0)} files</small></div><div class="vf"><a class="btn btn-sm" href="${esc(c.folderUrl)}" target="_blank" rel="noopener">Open folder</a><button class="btn btn-sm btn-ghost" data-action="copy-link" data-link="${esc(c.folderUrl)}">Copy link</button></div></article>`).join('')}</div>`
        : (S.me.isMgr || S.myClaim ? `<div class="empty"><b>No campaigns yet</b><span>Deliver one with “Save to Drive” and it shows up here with its folder link.</span><button class="btn btn-primary" data-action="goto-create">Create a campaign</button></div>` : '')}`;
  }

  /* ---------------- roster ---------------- */
  function renderRoster() {
    const v = $('#view-roster'); if (!S.me.isMgr) { v.innerHTML = ''; return; }
    const q = (S.rosterQ || '').toLowerCase(); const list = S.agents.filter((a) => !q || a.name.toLowerCase().includes(q));
    const claimFor = (id) => S.claims.filter((c) => c.agentId === id);
    const stale = S.agents.filter((a) => !a.stats || !a.stats.deals).length;
    v.innerHTML = `<div class="page-head"><div><h2>Roster</h2><p>Headshots, stats, QR codes, loyalty links and Drive vaults for every agent. Stats refresh from public Redfin profiles every Monday.</p></div><div class="btn-row"><button class="btn btn-primary" data-action="add-agent">Add agent</button></div></div>
      <div class="filter-row"><input class="input" id="rosterSearch" placeholder="Search the roster" value="${esc(S.rosterQ)}"><span class="chip">${S.agents.length} agents</span>${stale ? `<span class="chip warn">${stale} without stats</span>` : ''}<span class="chip">${S.agents.filter((a) => a.loyaltyUrl || a.qrAssetId).length} with loyalty QR</span></div>
      ${!S.loaded.has('agents') ? '<div class="thinking">Loading…</div>' : list.length ? `<div class="cards">${list.map((a) => { const s = a.stats || {}; const cl = claimFor(a.id); const qi = qrInfo(a);
        return `<article class="rcard"><div class="rtop">${a.headshotAssetId ? `<img src="${esc(headSrc(a))}" alt="" loading="lazy">` : `<span class="ini">${esc(initials(a.name))}</span>`}<div style="min-width:0"><b>${esc(a.name)}</b><small>${esc(a.title || 'Redfin Agent')}${a.city ? ' · ' + esc(a.city) : ''}</small><small class="mono">${a.license ? 'DRE #' + esc(a.license) : 'No license on file'}</small></div></div>
          <div class="rstats"><div><b>${esc(s.deals || '—')}</b><small>Deals</small></div><div><b>${esc(s.volume || '—')}</b><small>Volume</small></div><div><b>${esc(s.highest || '—')}</b><small>Highest</small></div></div>
          <div class="rchips"><span class="chip ${qi.fallback ? 'warn' : qi.text || qi.image ? 'ok' : 'warn'}">QR: ${esc(qi.label)}</span>${a.driveFolderId ? '<span class="chip ok">Drive</span>' : '<span class="chip warn">No Drive</span>'}${cl.length ? `<span class="chip gold" data-claimers="${esc(a.id)}">Claimed</span>` : ''}${s.updatedAt ? `<span class="chip">${esc(String(s.updatedAt).slice(0, 10))}</span>` : ''}</div>
          <div class="btn-row"><button class="btn btn-sm" data-action="edit-agent" data-id="${esc(a.id)}">Edit</button><button class="btn btn-sm btn-ghost" data-action="create-for" data-id="${esc(a.id)}">Create</button>${a.driveFolderId ? `<a class="btn btn-sm btn-ghost" href="https://drive.google.com/drive/folders/${esc(a.driveFolderId)}" target="_blank" rel="noopener">Vault</a>` : ''}</div></article>`; }).join('')}</div>` : '<div class="empty"><b>No agents match</b></div>'}`;
  }
  function editAgent(id) {
    const a = id ? agentById(id) : { id: '', name: '', title: 'Redfin Agent', stats: {} }; S.editAgent = Object.assign({}, a, { stats: Object.assign({}, a.stats || {}) });
    const s = S.editAgent.stats; const cl = S.claims.filter((c) => c.agentId === a.id);
    openDrawer(`<div class="drawer-head"><h3 id="drawerTitle">${id ? 'Edit ' + esc(a.name) : 'Add agent'}</h3><button class="btn btn-sm btn-ghost" data-action="close-drawer">Close</button></div>
      <div class="drawer-body">
        <div class="agent-card">${a.headshotAssetId ? `<img src="${esc(headSrc(a))}" alt="" id="eaHeadImg">` : `<span class="ini" id="eaHeadImg">${esc(initials(a.name || '?'))}</span>`}<div><b>Headshot</b><small>Square, face centered, at least 800 px.</small></div>
          <label class="btn btn-sm" style="position:relative;overflow:hidden">Upload<input type="file" accept="image/*" id="eaHead" style="position:absolute;inset:0;opacity:0;cursor:pointer"></label></div>
        <div class="row2"><label class="field"><span>Full name</span><input class="input" id="ea_name" value="${esc(a.name)}"></label><label class="field"><span>Title</span><input class="input" id="ea_title" value="${esc(a.title || '')}"></label></div>
        <div class="row2"><label class="field"><span>Phone</span><input class="input" id="ea_phone" value="${esc(a.phone || '')}"></label><label class="field"><span>DRE license #</span><input class="input" id="ea_license" value="${esc(a.license || '')}"></label></div>
        <div class="row2"><label class="field"><span>Email</span><input class="input" id="ea_email" type="email" value="${esc(a.email || '')}"></label><label class="field"><span>Home market</span><input class="input" id="ea_city" value="${esc(a.city || '')}"></label></div>
        <label class="field"><span>Loyalty link</span><input class="input" id="ea_loyaltyUrl" value="${esc(a.loyaltyUrl || '')}" placeholder="https://…"><small>Paste once. Every graphic gets a crisp QR code to this link.</small></label>
        <div class="agent-card">${a.qrAssetId ? `<img src="/_blob/${esc(a.qrAssetId)}" alt="" style="border-radius:8px">` : '<span class="ini">QR</span>'}<div><b>Existing QR image (optional)</b><small>Upload only if the agent has a QR you must use as is.</small></div><label class="btn btn-sm" style="position:relative;overflow:hidden">Upload<input type="file" accept="image/*" id="eaQr" style="position:absolute;inset:0;opacity:0;cursor:pointer"></label></div>
        <label class="field"><span>Redfin profile URL</span><input class="input" id="ea_profileUrl" value="${esc(a.profileUrl || '')}" placeholder="https://www.redfin.com/real-estate-agents/…"><small>Monday refresh reads stats from this page.</small></label>
        <div class="row3"><label class="field"><span>Deals</span><input class="input" id="eas_deals" value="${esc(s.deals || '')}"></label><label class="field"><span>Volume</span><input class="input" id="eas_volume" value="${esc(s.volume || '')}" placeholder="$525M"></label><label class="field"><span>Highest</span><input class="input" id="eas_highest" value="${esc(s.highest || '')}" placeholder="$9.0M"></label></div>
        <label class="drop" style="padding:10px"><input type="file" accept="image/*" id="eaStatsShot"><b>Read stats from a profile screenshot</b><span>Claude fills deals, volume and highest sale.</span></label>
        <label class="field"><span>Personal tagline (optional)</span><input class="input" id="ea_tagline" value="${esc(a.tagline || '')}" placeholder="Only if the agent already uses one"></label>
        <label class="field"><span>Drive vault folder link</span><input class="input" id="ea_driveFolder" value="${a.driveFolderId ? 'https://drive.google.com/drive/folders/' + esc(a.driveFolderId) : ''}" placeholder="https://drive.google.com/drive/folders/…"></label>
        ${a.driveFolderId ? `<div class="row2"><label class="field"><span>Share vault with (email)</span><input class="input" id="ea_shareEmail" value="${esc(a.email || '')}" placeholder="agent@redfin.com"></label><div class="field"><span>&nbsp;</span><button class="btn" data-action="share-vault">Give edit access</button></div></div><small class="muted">Edit access lets the agent save their own graphics into this folder from the Studio.</small>` : ''}
        ${cl.length ? `<div class="field"><span class="lbl">Claimed in the Studio by</span><div class="rchips" id="claimList">${cl.map((c) => `<span class="chip gold" data-uid="${esc(c.id)}">…</span><button class="btn btn-xs btn-ghost" data-action="rm-claim" data-uid="${esc(c.id)}">Remove</button>`).join('')}</div></div>` : ''}
      </div>
      <div class="drawer-foot">${id ? '<button class="btn btn-ghost" data-action="archive-agent">Remove from roster</button>' : ''}<button class="btn btn-primary" data-action="save-agent">Save agent</button></div>`, true);
    if (cl.length && S.user) S.user.profiles(cl.map((c) => c.id)).then((ps) => { $$('#claimList [data-uid]').forEach((el) => { if (el.tagName === 'SPAN') el.textContent = (ps[el.dataset.uid] && ps[el.dataset.uid].name) || 'Someone'; }); });
  }
  function parseFolderId(v) { const m = /folders\/([\w-]{10,})/.exec(v || '') || /[?&]id=([\w-]{10,})/.exec(v || '') || /^([\w-]{20,})$/.exec((v || '').trim()); return m ? m[1] : ''; }
  async function saveAgent() {
    const e = S.editAgent; if (!e || !S.db) { toast('The roster can only be edited inside Claude.', 'err'); return; }
    const val = (id) => ($('#' + id) ? $('#' + id).value.trim() : '');
    const body = { name: val('ea_name'), title: val('ea_title'), phone: val('ea_phone'), license: val('ea_license').replace(/^#/, ''), email: val('ea_email'), city: val('ea_city'),
      loyaltyUrl: val('ea_loyaltyUrl'), profileUrl: val('ea_profileUrl'), tagline: val('ea_tagline'), driveFolderId: parseFolderId(val('ea_driveFolder')),
      headshotAssetId: e.headshotAssetId || '', qrAssetId: e.qrAssetId || '', active: true,
      stats: Object.assign({}, e.stats, { deals: val('eas_deals'), volume: val('eas_volume'), highest: val('eas_highest') }) };
    if (!body.name) { toast('Add the agent’s name.', 'err'); return; }
    if (body.loyaltyUrl && !/^https?:\/\//i.test(body.loyaltyUrl)) body.loyaltyUrl = 'https://' + body.loyaltyUrl;
    const changedStats = ['deals', 'volume', 'highest'].some((k) => String((e.stats || {})[k] || '') !== String(body.stats[k] || ''));
    if (changedStats) { body.stats.updatedAt = new Date().toISOString(); body.stats.source = 'manual'; }
    const id = e.id || slug(body.name);
    try { await S.db.doc('agents/' + id).set(body); toast('Saved ' + body.name); closeDrawer(); }
    catch (err) { toast(err && err.code === 'invalid_argument' ? 'Only the Studio owner or editors can change the roster.' : 'Save didn’t go through. Try again.', 'err'); }
  }
  async function uploadAgentImage(file, kind) {
    if (!S.assets) { toast('Uploading needs Editor access to this Studio.', 'err'); return; }
    const t = toast('Uploading…', 'progress');
    try {
      let blob = file; if (kind === 'head') { const img = await loadImage(URL.createObjectURL(file)); if (img) { const c = downscale(img, 1200); blob = await new Promise((r) => c.toBlob(r, 'image/jpeg', 0.92)); } }
      const r = await S.assets.upload(blob, { type: blob.type || 'image/jpeg' });
      if (kind === 'head') S.editAgent.headshotAssetId = r.id; else S.editAgent.qrAssetId = r.id;
      t.remove(); toast(kind === 'head' ? 'Headshot uploaded. Save to keep it.' : 'QR uploaded. Save to keep it.');
      const el = $(kind === 'head' ? '#eaHeadImg' : '#eaQr'); if (kind === 'head' && el) el.outerHTML = `<img src="${esc(r.url)}" alt="" id="eaHeadImg">`;
    } catch (e) { t.remove(); toast({ too_large: 'That file is too large.', unsupported_type: 'Use a PNG, JPG or WebP image.', quota_exceeded: 'Studio storage is full.' }[e && e.code] || 'Upload failed. Try again.', 'err'); }
  }
  async function readStatsShot(file) {
    if (!S.sample) { toast('Claude isn’t available in this view.', 'err'); return; }
    const t = toast('Claude is reading the profile…', 'progress');
    try {
      const r = await S.sample.json('Read this screenshot of a Redfin agent profile. Reply with only JSON {"deals": string|null, "volume": string|null, "highest": string|null, "license": string|null, "title": string|null}. deals is the total deals count (e.g. "487"), volume the sales volume as shown (e.g. "$525M"), highest the highest sale price as shown (e.g. "$9.0M"). Use only what is visible; null when not shown.', { images: file });
      if (r.deals) $('#eas_deals').value = r.deals; if (r.volume) $('#eas_volume').value = r.volume; if (r.highest) $('#eas_highest').value = r.highest;
      if (r.license && !$('#ea_license').value) $('#ea_license').value = r.license; if (r.title && !$('#ea_title').value) $('#ea_title').value = r.title;
      t.remove(); toast('Stats filled in. Review, then Save.');
    } catch (e) { t.remove(); toast(sampleErr(e), 'err'); }
  }
  async function shareVault() {
    const e = S.editAgent; const email = ($('#ea_shareEmail') || {}).value || '';
    if (!e || !e.driveFolderId || !/^[\w.+-]+@[\w-]+(\.[\w-]+)+$/.test(email.trim())) { toast('Enter the agent’s email first.', 'err'); return; }
    if (!S.mcp) { toast('Sharing needs the Google Drive connector in this view.', 'err'); return; }
    try { await S.mcp.callTool(DRIVE, 'share_file', { fileId: e.driveFolderId, emailAddress: email.trim(), role: 'writer' }); toast('Vault shared with ' + email.trim()); }
    catch (err) { toast(driveErr(err), 'err'); }
  }

  /* ---------------- claims ---------------- */
  async function claim(id) {
    S.myClaim = id; lsSet('spotlight.claim', id); S.draft.agentId = id; S.showAgentGrid = false; saveDraft(); preloadAgentAssets();
    if (S.db && S.me.id) { try { await S.db.doc('claims/' + S.me.id).set({ agentId: id, claimedAt: new Date().toISOString() }); } catch (e) { /* view-only viewers keep the claim in this browser */ } }
    renderAll();
  }

  /* ---------------- settings ---------------- */
  function renderSettings() {
    const v = $('#view-settings'); if (!S.me.isMgr) { v.innerHTML = ''; return; } const st = S.settings;
    v.innerHTML = `<div class="page-head"><div><h2>Settings</h2><p>Brand rules and defaults for every graphic the team makes.</p></div></div>
      <div class="two"><div class="panel"><h3>Graphics</h3>
        <label class="field"><span>Fine print on every graphic</span><input class="input" id="st_finePrint" value="${esc(st.finePrint)}"><small>{agent} and {license} fill in automatically. California requires the agent’s DRE number on advertising.</small></label>
        <label class="field"><span>File type</span><select class="select" id="st_fileType"><option value="png" ${st.fileType !== 'jpg' ? 'selected' : ''}>PNG, highest quality</option><option value="jpg" ${st.fileType === 'jpg' ? 'selected' : ''}>JPG, smaller files</option></select></label>
        <div class="field"><span class="lbl">Default sizes to deliver</span><div class="fmtpick">${FMTS.map((k) => `<label><input type="checkbox" data-stfmt="${k}" ${st.exportFormats.includes(k) ? 'checked' : ''}>${E.FORMATS[k].ratio} ${E.FORMATS[k].name}</label>`).join('')}</div></div>
        <div class="switch-row"><div><b>Agents can create Closed and Premier graphics</b><br><small class="muted">Off keeps closings manager-only; listings stay open to agents.</small></div><input type="checkbox" class="switch" id="st_agentsClosed" ${st.agentsClosed !== false ? 'checked' : ''}></div>
        <label class="field"><span>Master Drive folder</span><input class="input" id="st_root" value="https://drive.google.com/drive/folders/${esc(st.rootFolderId || ROOT_FOLDER)}"><small>Used when an agent has no folder of their own.</small></label>
        <div class="btn-row"><button class="btn btn-primary" data-action="save-settings">Save settings</button></div></div>
      <div class="panel"><h3>Team access</h3><p class="muted">Share this Studio with your agents from the Share menu at the top of the artifact.</p>
        <ul style="margin:0;padding-left:18px;display:grid;gap:6px;font-size:14px"><li><b>Contributor</b> lets an agent create, save to Drive and keep their own vault history. Recommended.</li><li><b>Viewer</b> can still create and download; the Studio remembers them in their browser only.</li><li><b>Editor</b> is for assistants who manage the roster and upload headshots.</li></ul>
        <p class="muted" style="font-size:13px">Each agent uses their own Claude account for screenshot reading and captions, and their own Google Drive connection for saves. Give agents edit access to their vault folder from Roster → Edit so their saves land in the right place.</p>
        <h3 style="margin-top:6px">Stats refresh</h3><p class="muted" style="font-size:14px">Every Monday morning Claude reads each agent’s public Redfin profile and updates deals, volume, highest sale and license. Manual edits stay until the next refresh finds new numbers.</p></div></div>`;
  }
  async function saveSettings() {
    if (!S.db) return; const fm = $$('[data-stfmt]').filter((x) => x.checked).map((x) => x.dataset.stfmt);
    const body = { finePrint: $('#st_finePrint').value.trim() || DEFAULT_SETTINGS.finePrint, fileType: $('#st_fileType').value, exportFormats: fm.length ? fm : FMTS.slice(), agentsClosed: $('#st_agentsClosed').checked, rootFolderId: parseFolderId($('#st_root').value) || ROOT_FOLDER, updatedAt: new Date().toISOString() };
    try { await S.db.doc('settings/brand').set(body); toast('Settings saved'); } catch (e) { toast('Only the Studio owner or editors can change settings.', 'err'); }
  }

  /* ---------------- playbook ---------------- */
  function renderPlaybook() {
    const slack = `:sparkles: *Meet Spotlight Studio* :sparkles:
Your listings, closings and client wins deserve marketing that looks like a luxury agency made it. Now it takes four clicks.

*How it works*
1️⃣ Drop a screenshot of the closing email or listing (Claude fills in the details)
2️⃣ Add your best exterior photo
3️⃣ Pick the type: Just Listed, Open House, Under Contract, In Escrow, Price Improvement, 5-Star Review, Just Sold, Just Closed
4️⃣ Star your favorites from 15 designs and hit *Save to Drive* or *Download*

Your headshot, stats, DRE number and QR code are already loaded. Every design comes in Story, Feed, Square and LinkedIn sizes, plus ready-to-paste captions.

*This week's challenge:* post one Spotlight graphic for every active listing and every closing. Tag the team so we can amplify it. :rocket:`;
    $('#view-playbook').innerHTML = `<div class="page-head"><div><h2>Playbook</h2><p>How the team uses Spotlight Studio to turn every milestone into content that earns trust, referrals and listings.</p></div></div>
      <div class="two"><div class="panel play"><h3>Four clicks to a full campaign</h3><ol>
        <li><b>Drop the screenshot.</b> The closing email, the listing alert or the accepted-offer notice. Claude reads the agent, side, city, price and date. Check the chips it fills.</li>
        <li><b>Add the hero photo.</b> A bright exterior, landscape orientation. Tap the photo to set the focus point so the house stays centered in every crop.</li>
        <li><b>Pick the type.</b> Closed buy side, closed sell side, the two Premier tiers, or a listing milestone.</li>
        <li><b>Star and deliver.</b> Star 3 to 5 designs. Save to Drive sends every size to the agent’s vault folder; Download gives you a ZIP for your phone.</li></ol>
        <h3>Posting plan for a closing</h3><ol>
        <li><b>Day 0:</b> Story (9:16) with the QR design. Pin the Feed (4:5) version to your profile grid.</li>
        <li><b>Day 1:</b> LinkedIn (1.91:1) with the LinkedIn caption. Tag the team.</li>
        <li><b>Day 3:</b> Facebook Square (1:1) with the Facebook caption. Share to neighborhood groups that allow agent posts.</li>
        <li><b>Day 7:</b> A second design in Stories with a “What’s your home worth?” question sticker.</li></ol></div>
      <div style="display:grid;gap:16px"><div class="panel"><h3>Brand and compliance rules</h3><ul style="margin:0;padding-left:18px;display:grid;gap:6px;font-size:14px">
        <li>City only. Never the street address.</li><li>Your DRE number prints on every graphic. Don’t crop it out.</li>
        <li>Stats come from your public Redfin profile. Never edit them upward.</li><li>Premier graphics are for Premier transactions only.</li>
        <li>Reviews: use the client’s exact words, first names only, with their permission.</li>
        <li>Fair housing: no language about who a home is “perfect for,” schools quality, or neighborhood demographics.</li></ul></div>
        <div class="panel"><div class="cap-head"><h3>Team announcement for Slack</h3><button class="btn btn-xs" data-action="copy-text" data-text="slack">Copy</button></div><div class="copybox" id="slackCopy">${esc(slack)}</div></div></div></div>`;
    S.slackText = slack;
  }

  /* ---------------- events ---------------- */
  document.addEventListener('click', async (ev) => {
    const btn = ev.target.closest('[data-action],[data-tab],[data-photo]'); if (!btn) return;
    if (btn.dataset.tab && !btn.dataset.action) { S.tab = btn.dataset.tab; closeDrawer(); renderAll(); window.scrollTo({ top: 0 }); return; }
    if (btn.dataset.photo != null && !ev.target.closest('[data-action]')) {
      if (+btn.dataset.photo === 0) { const r = btn.getBoundingClientRect(); S.draft.focus = { x: Math.min(1, Math.max(0, (ev.clientX - r.left) / r.width)), y: Math.min(1, Math.max(0, (ev.clientY - r.top) / r.height)) }; saveDraft(); renderSteps(); refreshSoon(); }
      else { const [p] = S.photos.splice(+btn.dataset.photo, 1); S.photos.unshift(p); S.draft.focus = { x: 0.5, y: 0.5 }; renderSteps(); refreshSoon(); }
      return;
    }
    const a = btn.dataset.action; const i = btn.dataset.i != null ? +btn.dataset.i : null;
    switch (a) {
      case 'close-drawer': closeDrawer(); break;
      case 'rm-photo': { const [p] = S.photos.splice(i, 1); if (p) URL.revokeObjectURL(p.url); renderSteps(); renderGalleryShell(); renderHero(); break; }
      case 'clear-shot': S.shot = null; renderSteps(); break;
      case 'reread': readShot(); break;
      case 'pick-agent': if (S.me.isMgr || !S.db || !S.myClaim) { if (S.me.isMgr) { S.draft.agentId = btn.dataset.id; S.showAgentGrid = false; saveDraft(); preloadAgentAssets(); renderAll(); } else claim(btn.dataset.id); } break;
      case 'pick-agent-again': S.showAgentGrid = true; renderSteps(); break;
      case 'unclaim': S.myClaim = null; lsSet('spotlight.claim', null); S.showAgentGrid = true; if (S.db && S.me.id) { try { await S.db.doc('claims/' + S.me.id).delete(); } catch (e) { /* ignore */ } } renderAll(); break;
      case 'pick-type': S.draft.type = btn.dataset.type; saveDraft(); renderSteps(); renderGalleryShell(); renderHero(); break;
      case 'generate': renderGalleryShell(); $('#gallery').scrollIntoView({ behavior: 'smooth', block: 'start' }); break;
      case 'fmt': S.draft.format = btn.dataset.fmt; saveDraft(); renderGalleryShell(); break;
      case 'fav': S.designs[i].fav = !S.designs[i].fav; if (S.drawerDesign === i) renderDesignDrawer(); renderGalleryShell(); break;
      case 'shuffle': S.designs[i].seed++; S.designs[i].palette = null; S.designs[i].scriptFam = null; if (S.drawerDesign === i) renderDesignDrawer(); refreshGallery(); break;
      case 'shuffle-all': S.designs.forEach((d) => { d.seed++; d.palette = null; d.scriptFam = null; }); refreshGallery(); break;
      case 'open': if (!ev.target.closest('.fav')) openDesign(i); break;
      case 'pv-fmt': S.drawerFmt = btn.dataset.fmt; renderDesignDrawer(); break;
      case 'pv-pal': S.designs[S.drawerDesign].palette = btn.dataset.pal || null; renderDesignDrawer(); refreshGallery(); break;
      case 'dl-one': { const d = S.designs[S.drawerDesign]; const b = await renderBlob(d, S.drawerFmt); await saveFile(fileName(d, S.drawerFmt), b); break; }
      case 'dl-sizes': { const d = S.designs[S.drawerDesign]; const zip = new window.JSZip(); for (const fm of exportFormats()) zip.file(fileName(d, fm), await renderBlob(d, fm)); await saveFile(fileName(d, 'story').replace(/_9x16\.\w+$/, '_all-sizes.zip'), await zip.generateAsync({ type: 'blob' })); break; }
      case 'captions': writeCaptions(); break;
      case 'apply-headline': S.draft.data.headline = btn.dataset.h; saveDraft(); renderSteps(); refreshGallery(); toast('Headline applied to every design'); break;
      case 'copy': { const c = S.captions || {}; const txt = btn.dataset.copy === 'hashtags' ? (c.hashtags || []).join(' ') : c[btn.dataset.copy]; copy(txt); break; }
      case 'copy-text': copy(S.slackText); break;
      case 'copy-link': copy(btn.dataset.link); break;
      case 'download': downloadAll(); break;
      case 'drive': saveToDrive(false); break;
      case 'goto-create': S.tab = 'create'; renderAll(); break;
      case 'add-agent': editAgent(''); break;
      case 'edit-agent': editAgent(btn.dataset.id); break;
      case 'create-for': S.draft.agentId = btn.dataset.id; S.tab = 'create'; saveDraft(); preloadAgentAssets(); renderAll(); break;
      case 'save-agent': saveAgent(); break;
      case 'share-vault': shareVault(); break;
      case 'archive-agent': { const e = S.editAgent; if (!e || !e.id) break; if (btn.dataset.armed !== '1') { btn.dataset.armed = '1'; btn.textContent = 'Click again to remove'; break; } try { await S.db.doc('agents/' + e.id).update({ active: false }); toast('Removed from roster'); closeDrawer(); } catch (err) { toast('Couldn’t remove. Try again.', 'err'); } break; }
      case 'rm-claim': try { await S.db.doc('claims/' + btn.dataset.uid).delete(); toast('Claim removed'); closeDrawer(); } catch (e) { toast('Couldn’t remove the claim.', 'err'); } break;
      case 'save-settings': saveSettings(); break;
      default: break;
    }
  });
  async function copy(text) {
    if (!text) return;
    try { await navigator.clipboard.writeText(text); toast('Copied'); }
    catch (e) { const ta = document.createElement('textarea'); ta.value = text; document.body.appendChild(ta); ta.select(); try { document.execCommand('copy'); toast('Copied'); } catch (e2) { toast('Select the text and copy it manually.', 'err'); } ta.remove(); }
  }
  document.addEventListener('input', (ev) => {
    const t = ev.target;
    if (t.dataset.field) { S.draft.data[t.dataset.field] = t.value; saveDraft(); refreshSoon(); if (t.dataset.field === 'city') { const m = $('.gbar .meta b'); if (m) m.textContent = `${E.TYPES[S.draft.type].label} · ${t.value || 'Your City'}`; } }
    else if (t.id === 'agentSearch') { S.agentQ = t.value; const pos = t.selectionStart; renderSteps(); const n = $('#agentSearch'); if (n) { n.focus(); n.setSelectionRange(pos, pos); } }
    else if (t.id === 'rosterSearch') { S.rosterQ = t.value; const pos = t.selectionStart; renderRoster(); const n = $('#rosterSearch'); if (n) { n.focus(); n.setSelectionRange(pos, pos); } }
    else if (t.id === 'qrCustom') { S.draft.qrCustom = t.value.trim(); saveDraft(); refreshSoon(); }
    else if (t.id === 'pvHeadline' || t.id === 'pvTagline') { S.designs[S.drawerDesign].copy[t.id === 'pvHeadline' ? 'headline' : 'tagline'] = t.value; debouncedPv(); }
  });
  const debouncedPv = debounce(() => { renderPreviewCanvas(); refreshGallery(); }, 250);
  document.addEventListener('change', (ev) => {
    const t = ev.target;
    if (t.dataset.check) { S.draft.data[t.dataset.check] = t.checked; saveDraft(); refreshSoon(); }
    else if (t.id === 'shotInput') setShot(t.files[0]);
    else if (t.id === 'photoInput') addPhotos(t.files);
    else if (t.id === 'qrMode') { S.draft.qrMode = t.value; saveDraft(); renderSteps(); refreshSoon(); }
    else if (t.dataset.expfmt) { const set = new Set(exportFormats()); t.checked ? set.add(t.dataset.expfmt) : set.delete(t.dataset.expfmt); S.draft.exportFormats = FMTS.filter((k) => set.has(k)); if (!S.draft.exportFormats.length) S.draft.exportFormats = [S.draft.format]; saveDraft(); renderGalleryShell(); }
    else if (t.id === 'pvScript') { S.designs[S.drawerDesign].scriptFam = t.value || null; renderPreviewCanvas(); refreshGallery(); }
    else if (t.id === 'vaultAgent') { S.vaultAgent = t.value; renderVault(); renderTabsCounts(); }
    else if (t.id === 'eaHead' && t.files[0]) uploadAgentImage(t.files[0], 'head');
    else if (t.id === 'eaQr' && t.files[0]) uploadAgentImage(t.files[0], 'qr');
    else if (t.id === 'eaStatsShot' && t.files[0]) readStatsShot(t.files[0]);
  });
  ['dragover', 'dragenter'].forEach((n) => document.addEventListener(n, (ev) => { const d = ev.target.closest && ev.target.closest('.drop'); if (d) { ev.preventDefault(); d.classList.add('is-over'); } }));
  ['dragleave', 'drop'].forEach((n) => document.addEventListener(n, (ev) => { const d = ev.target.closest && ev.target.closest('.drop'); if (d) d.classList.remove('is-over'); }));
  document.addEventListener('drop', (ev) => {
    const d = ev.target.closest && ev.target.closest('.drop'); if (!d) return; ev.preventDefault(); const files = ev.dataTransfer && ev.dataTransfer.files; if (!files || !files.length) return;
    if (d.id === 'shotDrop') setShot(files[0]); else if (d.id === 'photoDrop') addPhotos(files);
  });
  document.addEventListener('paste', (ev) => {
    if (S.tab !== 'create') return; const items = Array.from((ev.clipboardData && ev.clipboardData.files) || []); const img = items.find((x) => /^image\//.test(x.type)); if (!img) return;
    if (!S.shot) setShot(img); else addPhotos([img]);
  });
  document.addEventListener('keydown', (ev) => { if (ev.key === 'Escape' && !$('#drawerWrap').hidden) closeDrawer(); });
  window.addEventListener('resize', debounce(() => refreshGallery(), 300));

  boot();
})();
