// Redfin Powered by Rocket Creative Studio. "Anything in. Amazing out."
// Home (start paths + template gallery) -> Content -> Look -> Format & sound -> Polish -> Export.
import { h, icon, toast, modal, drawer, download, copyText, slug, pickFiles, dropTarget } from './ui.js';
import { createStore, storage } from './store.js';
import { Preview } from './preview.js';
import { fieldEditor, readAudio } from './fields.js';
import { smartDraft, claudePrompt, parseClaudeReply } from './assist.js';
import { exportMP4, exportGIF, exportPoster, exportStoryboard, canEncodeMP4 } from './exporter.js';
import { guide } from './help.js';
import { STORIES, STORY_ORDER, CATEGORIES } from '../stories/index.js';
import { LOOKS, LOOK_ORDER } from '../looks/index.js';
import { SCENES, SCENE_ORDER } from '../scenes/index.js';
import { SHOT_PRESETS } from '../engine/camera.js';
import { FORMATS } from '../engine/stage.js';
import { LOGO_SVGS } from '../engine/brand.js';
import { validateProject, planScenes, normalizeProject, defaultProject } from '../engine/project.js';
import { MotionEngine } from '../engine/engine.js';
import { parseCSV } from '../engine/media.js';
import THUMBS from '../data/thumbs.json';

const store = createStore();
const S = store.state;
const app = document.getElementById('app');
const LOGO = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(LOGO_SVGS.tagline);
const STEPS = [
  { id: 'content', n: 1, label: 'Content', title: 'Add your content', sub: 'Names, numbers, photos and links. The checklist shows what’s missing.' },
  { id: 'look', n: 2, label: 'Look', title: 'Choose a look', sub: 'Any template works in any look. The Redfin brand switch keeps it on-brand.' },
  { id: 'format', n: 3, label: 'Format & sound', title: 'Format and sound', sub: 'Sizes, length, captions, music and sound effects.' },
  { id: 'polish', n: 4, label: 'Polish', title: 'Polish each scene', sub: 'Edit words, timing and camera moves. Reorder, hide or add scenes.' },
  { id: 'export', n: 5, label: 'Export', title: 'Export and share', sub: 'Download now, or hand off to Claude Code for the final render and delivery.' },
];
let preview = null;
let reel = null;

// ---------------------------------------------------------------- shell
function topbar() {
  const p = S.project;
  const cur = STEPS.findIndex(s => s.id === S.route);
  const stepper = p ? h('nav', { class: 'stepper', 'aria-label': 'Steps' },
    STEPS.map((s, i) => [
      i ? h('span', { class: 'sep', 'aria-hidden': 'true' }) : null,
      h('button', { class: (S.route === s.id ? 'on' : '') + (i < cur || (S.visited.has(s.id) && S.route !== s.id) ? ' done' : ''), 'aria-current': S.route === s.id ? 'step' : null, onclick: () => goStep(s.id) },
        h('span', { class: 'n' }, String(s.n)), h('span', { class: 'lbl' }, s.label)),
    ])) : h('div', { style: { flex: 1 } });
  return h('header', { class: 'topbar' },
    h('button', { class: 'brand', 'aria-label': 'Creative Studio home', onclick: () => goHome() }, h('img', { src: LOGO, alt: 'Redfin Powered by Rocket' }), h('span', { class: 'studio-name' }, 'Creative Studio')),
    stepper,
    h('div', { class: 'top-actions' },
      h('button', { class: 'btn sm ghost', onclick: openProjects }, icon('folder'), h('span', { class: 'lbl' }, 'Projects')),
      h('button', { class: 'btn sm ghost', onclick: () => drawer('Studio guide', guide()) }, icon('help'), h('span', { class: 'lbl' }, 'Guide')),
      p ? h('button', { class: 'btn sm', onclick: confirmReset, title: 'Start over from the beginning' }, icon('reset'), h('span', { class: 'lbl' }, 'Reset')) : null));
}

function render() {
  if (S.route === 'home') renderHome(); else renderWorkspace();
}

function goHome() {
  if (preview) preview.pause();
  S.route = 'home';
  render();
}

function goStep(id) {
  if (!S.project) return;
  S.visited.add(id);
  S.route = id;
  render();
}

async function confirmReset() {
  const ok = await modal({
    title: 'Start over?',
    body: 'This clears the current video and takes you back to the beginning. Your saved projects stay in Projects.',
    actions: [{ label: 'Keep working', value: false }, { label: 'Start over', value: true, primary: true }],
  });
  if (ok) { if (preview) preview.pause(); store.reset(); render(); toast('Fresh start. Pick a template or describe your idea.'); }
}

// ---------------------------------------------------------------- home
function renderHome() {
  disposePreview();
  app.replaceChildren(topbar(), homeView());
  startReel();
  window.scrollTo(0, 0);
}

function homeView() {
  let filter = 'All';
  const grid = h('div', { class: 'tgrid' });
  const filters = h('div', { class: 'filters', role: 'group', 'aria-label': 'Template categories' });
  const renderGrid = () => {
    filters.replaceChildren(...['All', ...CATEGORIES].map(c => h('button', { class: c === filter ? 'on' : '', onclick: () => { filter = c; renderGrid(); } }, c)));
    grid.replaceChildren(...STORY_ORDER.filter(id => !STORIES[id].hidden && (filter === 'All' || STORIES[id].category === filter)).map(id => templateCard(STORIES[id])));
  };
  renderGrid();
  const recent = h('div', { class: 'recent' });
  const mine = h('div', { class: 'recent' });
  storage.list().then(list => {
    const projects = list.filter(x => !x.isTemplate).slice(0, 6);
    const templates = list.filter(x => x.isTemplate);
    recent.replaceChildren(...projects.map(projectCard));
    if (!projects.length) recent.replaceChildren(h('p', { class: 'help' }, 'Projects you work on are saved here automatically.'));
    mine.replaceChildren(...templates.map(projectCard));
    mine.closest('section').hidden = !templates.length;
  });

  const describe = describePanel();
  const cont = S.project ? h('section', { class: 'describe', style: { gridTemplateColumns: 'auto 1fr auto', alignItems: 'center', display: 'grid' } },
    h('span', { class: 'chip red' }, 'In progress'),
    h('div', null, h('b', null, S.project.name || 'Untitled video'), h('div', { class: 'help' }, `${STORIES[S.project.story]?.name} · ${LOOKS[S.project.look]?.name || ''} · saved automatically`)),
    h('button', { class: 'btn primary', onclick: () => { S.visited = new Set(['content', 'look', 'format', 'polish']); goStep('content'); } }, 'Continue', icon('next'))) : null;
  return h('main', { class: 'home' },
    cont,
    h('section', { class: 'hero' },
      h('div', null,
        h('span', { class: 'eyebrow' }, 'Redfin Powered by Rocket · Creative Studio'),
        h('h1', { style: { marginTop: '14px' } }, 'One studio. Any starting point. An ', h('em', null, 'extraordinary'), ' finish.'),
        h('p', { class: 'lede' }, 'Start with whatever you already have: a photo, a link, a screenshot, a rough idea. The Studio organizes, designs and animates it into polished, on-brand motion video that looks like it came from a world-class creative team.'),
        h('div', { class: 'tagline' },
          h('span', { class: 'chip ink' }, 'Anything in. Amazing out.'),
          h('button', { class: 'btn primary lg', onclick: () => document.getElementById('templates').scrollIntoView({ behavior: 'smooth' }) }, icon('grid'), 'Pick a template'),
          h('button', { class: 'btn lg', onclick: () => document.getElementById('describe').scrollIntoView({ behavior: 'smooth' }) }, icon('wand'), 'Describe it'))),
      h('div', { class: 'hero-reel', id: 'reel' }, h('span', { class: 'chip reel-tag', style: { background: 'rgba(255,255,255,.9)' } }, 'Live preview · rendered in your browser'))),
    h('section', { class: 'starts', 'aria-label': 'Ways to start' },
      startCard('grid', 'Pick a template', 'The fastest way in. 18 ready-made stories for celebrations, listings, market updates, training and meetings. Fill in the blanks.', 'Best for your first video', () => document.getElementById('templates').scrollIntoView({ behavior: 'smooth' })),
      startCard('wand', 'Describe it', 'Type what you want and drop in photos, screenshots, notes or a spreadsheet. The Studio picks a template and fills in what it can.', 'Anything in', () => document.getElementById('describe').scrollIntoView({ behavior: 'smooth' })),
      startCard('folder', 'Open a project', 'Pick up where you left off, reuse your own templates, or import a project file from a teammate or Claude Code.', 'Saved automatically', openProjects)),
    h('ol', { class: 'how', 'aria-label': 'How it works' },
      h('li', null, h('b', null, 'Start with anything'), 'A template, a description, photos, screenshots or a spreadsheet.'),
      h('li', null, h('b', null, 'Fill in and pick a look'), 'A checklist coaches you through what’s needed. Every look stays on-brand.'),
      h('li', null, h('b', null, 'Polish in the preview'), 'Scrub the timeline, edit any scene’s words, timing and camera.'),
      h('li', null, h('b', null, 'Export and share'), 'MP4, GIF, poster and storyboard in every size, or a final render through Claude Code.')),
    h('section', { id: 'templates' },
      h('div', { class: 'section-head' }, h('div', null, h('h2', null, 'Templates'), h('p', null, 'Pick one and you’re a few fields away from a finished video. Switch the look any time.')), filters),
      grid),
    h('section', { id: 'describe' }, h('div', { class: 'section-head' }, h('div', null, h('h2', null, 'Describe it'), h('p', null, 'Tell the Studio what you want. Drop in anything that helps.'))), describe),
    h('section', null, h('div', { class: 'section-head' }, h('div', null, h('h2', null, 'My templates'), h('p', null, 'Projects you saved as templates. Start a new video from any of them.'))), mine),
    h('section', null, h('div', { class: 'section-head' }, h('div', null, h('h2', null, 'Recent projects'), h('p', null, 'Saved automatically in this browser.'))), recent));
}

function startCard(ic, title, text, meta, onclick) {
  return h('button', { class: 'start', onclick }, h('span', { class: 'ico' }, icon(ic)), h('h3', null, title), h('p', null, text), h('span', { class: 'meta' }, meta.toUpperCase()));
}

const CAT_ART = {
  Celebrate: ['#FCEBEC', '#DE3341'], Listings: ['#F3EEE7', '#111111'], 'Market & data': ['#EAF0F7', '#1C2B44'],
  Teach: ['#F1EEFB', '#4f46e5'], 'Lead & grow': ['#EEF4EF', '#137A4C'],
};

function templateCard(story) {
  const thumb = THUMBS.stories?.[story.id];
  const [bg, fg] = CAT_ART[story.category] || ['#F3EEE7', '#111'];
  const art = thumb ? h('img', { src: thumb, alt: '', loading: 'lazy' })
    : h('div', { class: 'art', style: { background: `radial-gradient(120% 120% at 20% 10%, #fff 0%, ${bg} 60%)` } },
      h('div', { style: { font: `800 38px var(--font)`, color: fg, letterSpacing: '-0.03em', textAlign: 'center', padding: '0 18px', lineHeight: 1 } }, story.name));
  return h('button', { class: 'tcard', onclick: () => { store.start(story.id); render(); } },
    h('div', { class: 'tthumb' }, art, h('span', { class: 'chip badge', style: { background: 'rgba(255,255,255,.92)' } }, story.category), h('span', { class: 'chip dur', style: { background: 'rgba(17,17,17,.8)', color: '#fff', borderColor: 'transparent' } }, `~${story.durations?.default || 20}s`)),
    h('div', { class: 'tbody' }, h('h3', null, story.name), h('p', null, story.blurb), h('span', { class: 'best' }, `Best for: ${story.bestFor}`)));
}

function projectCard(m) {
  return h('button', { class: 'rcard', onclick: async () => {
    const p = await storage.get(m.id);
    if (!p) { toast('That project could not be opened.', { error: true }); return; }
    if (m.isTemplate) { const c = store.duplicate(p, false); c.name = p.name; store.open(c); store.save(true); }
    else store.open(p);
    render();
  } },
  h('span', { class: 'rthumb' }, m.thumb ? h('img', { src: m.thumb, alt: '' }) : null),
  h('span', { class: 'grow' }, h('b', null, m.name || 'Untitled'), h('span', null, `${STORIES[m.story]?.name || m.story} · ${LOOKS[m.look]?.name || m.look} · ${new Date(m.updatedAt).toLocaleDateString()}`)));
}

function describePanel() {
  const files = [];
  const ta = h('textarea', { rows: 4, placeholder: 'Example: A 20-second vertical anniversary video for Heidi Ludwig, 11 years with Redfin. Use her photo, the homes she closed this year, and end with her QR code and loyalty link https://… and "Thank you for your amazing service."', 'aria-label': 'Describe your video' });
  const fileList = h('div', { class: 'filters' });
  const result = h('div');
  const showFiles = () => fileList.replaceChildren(...files.map((f, i) => h('span', { class: 'chip' }, f.name, h('button', { class: 'row-tools', style: { border: 0, background: 'none', padding: 0 }, 'aria-label': `Remove ${f.name}`, onclick: () => { files.splice(i, 1); showFiles(); } }, icon('x')))));
  const dz = h('button', { type: 'button', class: 'dropzone', onclick: async () => { files.push(...await pickFiles({ multiple: true })); showFiles(); } },
    icon('upload'), h('b', null, 'Drop anything here'), h('span', null, 'Photos, headshots, dashboard screenshots, CSV spreadsheets, notes, music. PDFs: copy the key numbers in, or use Draft with Claude.'));
  dropTarget(dz, f => { files.push(...f); showFiles(); });
  const go = async () => {
    if (!ta.value.trim() && !files.length) { toast('Describe your video or drop in a file first.'); ta.focus(); return; }
    result.replaceChildren(h('p', { class: 'help' }, 'Reading your notes and files…'));
    try {
      const d = await smartDraft(ta.value, files);
      const project = defaultProject(d.story, { format: d.format, look: d.look, formats: [d.format] });
      Object.assign(project.fields, d.fields);
      if (d.duration) project.duration = d.duration;
      if (d.music) project.audio.music = d.music;
      project.name = d.fields.agentName ? `${d.fields.agentName} · ${STORIES[d.story].name}` : STORIES[d.story].name;
      result.replaceChildren(h('div', { class: 'understood' },
        h('b', null, 'Here’s what I understood'),
        h('ul', null, d.notes.map(n => h('li', null, n))),
        d.missing.length ? h('div', null, h('b', null, 'Still needed: '), d.missing.join(', ')) : h('div', null, 'You have the essentials. Review and polish next.'),
        h('div', { style: { display: 'flex', gap: '8px', flexWrap: 'wrap' } },
          h('button', { class: 'btn primary', onclick: () => { store.open(project); store.save(true); render(); } }, 'Continue with this draft', icon('next')))));
    } catch (e) {
      console.error(e);
      result.replaceChildren(h('p', { class: 'help' }, 'Something went wrong reading that. Try a template instead, or remove the last file.'));
    }
  };
  const askClaude = async () => {
    const prompt = claudePrompt(ta.value, files, null);
    const reply = h('textarea', { rows: 6, placeholder: 'Paste Claude’s JSON reply here' });
    const ok = await modal({
      title: 'Draft with Claude', wide: true,
      body: h('div', { style: { display: 'grid', gap: '12px' } },
        h('p', null, 'Claude can read PDFs and screenshots and write tighter copy. Copy this prompt, paste it into Claude with your files, then paste the reply below.'),
        h('pre', null, prompt),
        h('button', { class: 'btn sm', onclick: async () => toast((await copyText(prompt)) ? 'Prompt copied' : 'Select the text and copy it') }, icon('copy'), 'Copy prompt'),
        reply),
      actions: [{ label: 'Cancel', value: false }, { label: 'Use Claude’s draft', value: true, primary: true }],
    });
    if (!ok) return;
    try {
      const r = parseClaudeReply(reply.value);
      const local = await smartDraft('', files);
      const project = defaultProject(r.story, { format: r.format || local.format, look: r.look || STORIES[r.story].defaultLook, formats: [r.format || local.format] });
      const keys = new Set(STORIES[r.story].fields.map(f => f.key));
      Object.entries(local.fields).forEach(([k, v]) => { if (keys.has(k) && ['headshot', 'photos', 'screenshot'].includes(k)) project.fields[k] = v; });
      Object.assign(project.fields, r.fields);
      project.name = r.fields.agentName ? `${r.fields.agentName} · ${STORIES[r.story].name}` : STORIES[r.story].name;
      store.open(project); store.save(true); render();
      if (r.notes) toast(`Claude says: ${r.notes}`, { ms: 7000 });
    } catch (e) { toast(e.message, { error: true, ms: 6000 }); }
  };
  return h('div', { class: 'describe' }, ta, dz, fileList,
    h('div', { style: { display: 'flex', gap: '10px', flexWrap: 'wrap' } },
      h('button', { class: 'btn primary', onclick: go }, icon('wand'), 'Build my draft'),
      h('button', { class: 'btn', onclick: askClaude }, icon('spark'), 'Draft with Claude')),
    result);
}

async function startReel() {
  const host = document.getElementById('reel');
  if (!host) return;
  try {
    const canvas = h('canvas', { 'aria-label': 'Sample video playing' });
    host.prepend(canvas);
    const eng = new MotionEngine({ canvas, scale: 0.42, quality: 'final' });
    await eng.load(normalizeProject({ story: 'showcase', look: 'brand-glass', format: '4x5', fields: { qrLink: 'https://www.redfin.com' }, id: 'reel' }), { scale: 0.42 });
    let t = 1, last = performance.now(), visible = true;
    const io = new IntersectionObserver(([e]) => { visible = e.isIntersecting; });
    io.observe(host);
    reel = { stop: false, eng, io };
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const tick = now => {
      if (!reel || reel.stop) return;
      const dt = Math.min(0.1, (now - last) / 1000); last = now;
      if (visible && !document.hidden && !reduce) { t = (t + dt) % eng.duration; eng.renderFrame(t); }
      requestAnimationFrame(tick);
    };
    eng.renderFrame(reduce ? 6 : t);
    requestAnimationFrame(tick);
  } catch (e) { /* no WebGL: the hero keeps its static background */ }
}

function stopReel() {
  if (!reel) return;
  reel.stop = true;
  reel.io.disconnect();
  reel.eng.dispose();
  reel = null;
}

// ---------------------------------------------------------------- workspace
function disposePreview() {
  if (preview) { preview.pause(); preview.ro.disconnect(); preview.engine?.dispose(); preview = null; }
}

function renderWorkspace() {
  stopReel();
  const step = STEPS.find(s => s.id === S.route) || STEPS[0];
  const idx = STEPS.indexOf(step);
  if (!preview) { preview = new Preview(store); }
  const body = h('div', { class: 'side-body' });
  const side = h('section', { class: 'side', 'aria-label': step.title },
    h('div', { class: 'side-head' }, h('span', { class: 'eyebrow' }, `Step ${step.n} of ${STEPS.length} · ${STORIES[S.project.story].name}`), h('h2', null, step.title), h('p', null, step.sub)),
    body,
    h('div', { class: 'side-foot' },
      idx > 0 ? h('button', { class: 'btn', onclick: () => goStep(STEPS[idx - 1].id) }, icon('back'), 'Back') : h('button', { class: 'btn', onclick: () => goHome() }, icon('back'), 'Templates'),
      idx < STEPS.length - 1 ? h('button', { class: 'btn primary', onclick: () => goStep(STEPS[idx + 1].id) }, `Next: ${STEPS[idx + 1].label}`, icon('next')) : h('button', { class: 'btn dark', onclick: saveTemplate }, icon('save'), 'Save as my template')));
  app.replaceChildren(topbar(), h('main', { class: 'workspace' }, side, preview.el));
  const views = { content: contentStep, look: lookStep, format: formatStep, polish: polishStep, export: exportStep };
  views[step.id](body);
  if (!preview.engine) preview.load(); else { preview.fit(); preview.renderFormats(); }
}

// ---------- step 1: content
function contentStep(body) {
  const p = S.project;
  const story = STORIES[p.story];
  const coach = h('div', { class: 'coach', 'aria-live': 'polite' });
  const nameInput = h('input', { type: 'text', value: p.name || '', 'aria-label': 'Project name', oninput: e => store.update(pr => { pr.name = e.target.value; }, 'meta') });
  const groups = new Map();
  for (const f of story.fields) {
    const g = f.group || (['image', 'images'].includes(f.type) ? 'Photos and media' : 'Content');
    if (!groups.has(g)) groups.set(g, []);
    groups.get(g).push(f);
  }
  const order = ['Content', 'Photos and media', 'Contact'];
  const wrappers = [];
  const sections = [...groups.entries()].sort((a, b) => order.indexOf(a[0]) - order.indexOf(b[0])).map(([g, fields]) => h('div', { class: 'group' },
    h('h3', null, g, g === 'Contact' ? h('small', null, 'For the end card') : null),
    fields.map(f => { const el = fieldEditor(f, store); wrappers.push({ f, el }); return el; })));
  const applyShowIf = () => wrappers.forEach(({ f, el }) => { if (f.showIf) el.hidden = !f.showIf(S.project.fields); });
  applyShowIf();
  const switcher = h('div', { class: 'group' }, h('h3', null, 'Template', h('small', null, 'Content carries over where fields match')),
    h('div', { style: { display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' } },
      h('span', { class: 'chip red' }, story.name),
      h('button', { class: 'btn sm', onclick: switchTemplate }, 'Switch template')),
    h('p', { class: 'help' }, story.blurb));
  const filledCount = story.fields.filter(f => { const v = p.fields[f.key]; return v !== undefined && v !== '' && v !== null && !(Array.isArray(v) && !v.length) && f.default === undefined; }).length;
  const sampleBtn = story.sample && filledCount < 2 ? h('div', { class: 'coach' },
    h('div', { class: 'coach-head' }, h('span', { class: 'dot' }, icon('spark')), 'First time with this template?'),
    h('p', null, 'Load clearly labelled sample content to see how it plays, then replace it with yours.'),
    h('div', null, h('button', { class: 'btn sm', onclick: () => { store.update(pr => { Object.assign(pr.fields, JSON.parse(JSON.stringify(story.sample))); }, 'structure'); render(); toast('Sample content loaded. Replace it with your own before exporting.'); } }, icon('spark'), 'Try it with sample content'))) : null;
  body.append(coach, sampleBtn, h('label', { class: 'field' }, h('span', { class: 'field-label' }, 'Project name'), nameInput), ...sections, switcher);
  const refreshCoach = () => renderCoach(coach, body);
  refreshCoach();
  const off = store.on(kind => {
    if (!body.isConnected) { off(); return; }
    if (kind === 'content' || kind === 'structure') { refreshCoach(); applyShowIf(); body.querySelectorAll('.uploader').forEach(u => u.refresh?.()); }
  });
}

function renderCoach(coach, body) {
  const p = S.project;
  const issues = validateProject(p);
  const errors = issues.filter(i => i.level === 'error'), warns = issues.filter(i => i.level === 'warn'), tips = issues.filter(i => i.level === 'tip');
  const head = errors.length
    ? `${errors.length} thing${errors.length > 1 ? 's' : ''} needed before export`
    : warns.length ? 'Looking good. A couple of things will make it better' : 'Ready. Preview it, then pick a look';
  const focus = key => { const el = body.querySelector(`[data-field="${key}"]`); if (el) { el.scrollIntoView({ behavior: 'smooth', block: 'center' }); el.querySelector('input, textarea, select, button')?.focus({ preventScroll: true }); } };
  const item = (lvl, i, mark) => h('li', { class: lvl }, h('span', { class: 'i' }, mark), h('span', null, i.field ? h('button', { onclick: () => focus(i.field) }, i.msg) : i.msg));
  coach.replaceChildren(
    h('div', { class: 'coach-head' }, h('span', { class: 'dot' }, icon('coach')), head),
    issues.length ? h('ul', { class: 'checks' }, errors.map(i => item('error', i, '!')), warns.map(i => item('warn', i, '!')), tips.map(i => item('tip', i, 'i')))
      : h('ul', { class: 'checks' }, h('li', { class: 'ok' }, h('span', { class: 'i' }, '✓'), 'Everything this template needs is filled in.')));
}

async function switchTemplate() {
  const p = S.project;
  const list = h('div', { class: 'tgrid', style: { gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))' } });
  let chosen = null;
  const ok = await new Promise(resolve => {
    list.append(...STORY_ORDER.filter(id => !STORIES[id].hidden).map(id => {
      const b = h('button', { class: 'tcard' + (id === p.story ? ' on' : ''), onclick: () => { chosen = id; list.querySelectorAll('.tcard').forEach(x => x.classList.remove('on')); b.classList.add('on'); } },
        h('div', { class: 'tbody' }, h('h3', null, STORIES[id].name), h('p', null, STORIES[id].category)));
      return b;
    }));
    modal({ title: 'Switch template', wide: true, body: h('div', { style: { display: 'grid', gap: '12px' } }, h('p', null, 'Fields with the same meaning (names, photos, links, contact details) carry over.'), list), actions: [{ label: 'Cancel', value: false }, { label: 'Switch', value: true, primary: true }] }).then(resolve);
  });
  if (!ok || !chosen || chosen === p.story) return;
  const keep = p.fields;
  const np = defaultProject(chosen, { id: p.id, name: p.name, look: p.look, format: p.format, formats: p.formats, audio: p.audio, brand: p.brand, privacy: p.privacy, exports: p.exports, delivery: p.delivery });
  const keys = new Set(STORIES[chosen].fields.map(f => f.key));
  Object.entries(keep).forEach(([k, v]) => { if (keys.has(k) && v !== undefined && v !== '' && v !== null) np.fields[k] = v; });
  store.open(np);
  store.save(true);
  render();
  preview.load();
  toast(`Switched to ${STORIES[chosen].name}`);
}

function coachCard(title, text) {
  return h('div', { class: 'coach' }, h('div', { class: 'coach-head' }, h('span', { class: 'dot' }, icon('coach')), title), h('p', null, text));
}

// ---------- step 2: look
function lookStep(body) {
  const p = S.project;
  const grid = h('div', { class: 'lgrid' });
  const renderGrid = () => grid.replaceChildren(...LOOK_ORDER.map(id => {
    const L = LOOKS[id];
    const thumb = THUMBS.looks?.[id];
    return h('button', { class: 'lcard' + (p.look === id ? ' on' : ''), 'aria-pressed': p.look === id ? 'true' : 'false', onclick: () => { store.update(pr => { pr.look = id; }, 'structure'); renderGrid(); preview.refresh(); } },
      h('div', { class: 'lthumb' }, thumb ? h('img', { src: thumb, alt: '' }) : (L.swatch || ['#fff', '#eee', '#DE3341', '#111']).map(c => h('span', { style: { background: c } }))),
      h('b', null, L.name), h('span', null, L.description || ''));
  }));
  renderGrid();
  const brand = h('label', { class: 'toggle' }, h('input', { type: 'checkbox', checked: p.brand?.mode !== 'native', onchange: e => { store.update(pr => { pr.brand.mode = e.target.checked ? 'brand' : 'native'; }, 'structure'); preview.refresh(); } }), 'Redfin brand colors');
  const energy = h('div', { class: 'segmented', role: 'group', 'aria-label': 'Camera energy' },
    ...[['calm', 'Calm'], ['standard', 'Standard'], ['energetic', 'Energetic']].map(([v, l]) => h('button', { class: (p.energy || 'standard') === v ? 'on' : '', onclick: e => { store.update(pr => { pr.energy = v; }, 'structure'); energy.querySelectorAll('button').forEach(b => b.classList.remove('on')); e.target.classList.add('on'); preview.refresh(); } }, l)));
  const fontBox = h('div', { style: { display: 'grid', gap: '8px' } });
  const renderFonts = () => {
    const f = S.project.brand.fonts || {};
    const slot = (key, label) => h('div', { style: { display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' } },
      h('span', { style: { fontWeight: 650, fontSize: '13.5px', minWidth: '110px' } }, label),
      f[key] ? h('span', { class: 'chip red' }, f[`${key}Name`] || 'Added') : h('span', { class: 'help' }, 'Default'),
      h('button', { class: 'btn sm', onclick: async () => {
        const [file] = await pickFiles({ accept: '.otf,.ttf,.woff,.woff2,font/*' });
        if (!file) return;
        if (file.size > 4e6) { toast('That font file is over 4 MB. Use a WOFF2 or OTF version.', { error: true }); return; }
        const reader = new FileReader();
        reader.onload = () => { store.update(pr => { pr.brand.fonts = { ...(pr.brand.fonts || {}), [key]: reader.result, [`${key}Name`]: file.name }; }, 'structure'); renderFonts(); toast(`${label} font added`); };
        reader.readAsDataURL(file);
      } }, icon('upload'), f[key] ? 'Replace' : 'Upload'),
      f[key] ? h('button', { class: 'btn sm ghost', onclick: () => { store.update(pr => { const n = { ...(pr.brand.fonts || {}) }; delete n[key]; delete n[`${key}Name`]; pr.brand.fonts = n; }, 'structure'); renderFonts(); } }, 'Remove') : null);
    fontBox.replaceChildren(slot('display', 'Headlines'), slot('body', 'Body text'));
  };
  renderFonts();
  body.append(
    coachCard('Not sure which look?', 'Redfin Glass is the house look and works for almost everything. Luxury for high-end listings, Celebration for wins, Data Newsroom for numbers, Premium Clay for friendly explainers. Click any look and the preview updates.'),
    h('div', { class: 'group' }, h('h3', null, 'Brand'), brand, h('p', { class: 'help' }, 'On: every look uses Redfin red, ink and the official Redfin Powered by Rocket lockup. Off: the look’s original palette (still with the logo).')),
    h('div', { class: 'group' }, h('h3', null, 'Brand fonts', h('small', null, 'Optional')), fontBox, h('p', { class: 'help' }, 'Upload the official brand font files (OTF, TTF or WOFF2) to use them in every look. Without them, the Studio uses Plus Jakarta Sans, a close free match to the logo\u2019s geometric type.')),
    h('div', { class: 'group' }, h('h3', null, 'Camera energy'), energy, h('p', { class: 'help' }, 'Calm for luxury and client pieces, Energetic for wins and social hooks.')),
    h('div', { class: 'group' }, h('h3', null, 'Looks', h('small', null, `${LOOK_ORDER.length} styles`)), grid));
}

// ---------- step 3: format & sound
function formatStep(body) {
  const p = S.project;
  const story = STORIES[p.story];
  const fmts = h('div', { class: 'fmt-grid' });
  const renderFmts = () => fmts.replaceChildren(...Object.values(FORMATS).map(f => {
    const on = p.formats.includes(f.id);
    const s = 38 / Math.max(f.w, f.h);
    return h('button', { class: 'fmt' + (on ? ' on' : ''), 'aria-pressed': on ? 'true' : 'false', onclick: () => {
      const switching = on && S.project.format === f.id;
      store.update(pr => { pr.formats = on ? pr.formats.filter(x => x !== f.id) : [...pr.formats, f.id]; if (!pr.formats.length) pr.formats = [f.id]; if (!pr.formats.includes(pr.format)) pr.format = pr.formats[0]; }, switching ? 'structure' : 'meta');
      renderFmts(); preview.renderFormats();
    } }, h('span', { class: 'shape', style: { width: `${f.w * s}px`, height: `${f.h * s}px` } }), h('b', null, f.id.replace('x', ':')), h('span', null, f.use.split(',')[0]));
  }));
  renderFmts();
  const auto = planScenes({ ...p, duration: null }).reduce((a, s) => a + s.dur, 0);
  const { min = 10, max = 60 } = story.durations || {};
  const lenLabel = h('b', null, p.duration ? `${p.duration}s` : `Auto · ${auto.toFixed(0)}s`);
  const slider = h('input', { type: 'range', min, max, step: 1, value: p.duration || Math.round(auto), 'aria-label': 'Video length', oninput: e => { lenLabel.textContent = `${e.target.value}s`; store.update(pr => { pr.duration = Number(e.target.value); }, 'structure'); preview.refresh(); } });
  const autoBtn = h('button', { class: 'btn sm', onclick: () => { store.update(pr => { pr.duration = null; }, 'structure'); lenLabel.textContent = `Auto · ${auto.toFixed(0)}s`; slider.value = Math.round(auto); preview.refresh(); } }, 'Use automatic length');
  const fps = h('div', { class: 'segmented' }, ...[60, 30].map(v => h('button', { class: (p.fps || 60) === v ? 'on' : '', onclick: e => { store.update(pr => { pr.fps = v; }, 'meta'); fps.querySelectorAll('button').forEach(b => b.classList.remove('on')); e.target.classList.add('on'); } }, `${v} fps`)));

  // Sound
  const musicBox = h('div', { class: 'uploader' });
  const renderMusic = () => musicBox.replaceChildren(p.audio.music
    ? h('div', { style: { display: 'grid', gap: '8px' } },
      h('div', { style: { display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' } }, h('span', { class: 'chip red' }, p.audio.musicName || 'Music added'), h('button', { class: 'btn sm ghost', onclick: () => { store.update(pr => { pr.audio.music = null; pr.audio.musicName = null; }, 'meta'); renderMusic(); } }, icon('trash'), 'Remove')),
      h('label', { class: 'field' }, h('span', { class: 'help' }, 'Music volume'), h('input', { type: 'range', min: 0, max: 1, step: 0.05, value: p.audio.musicVolume, oninput: e => store.update(pr => { pr.audio.musicVolume = Number(e.target.value); }, 'meta') })))
    : h('button', { class: 'drop', onclick: async () => { const [f] = await pickFiles({ accept: 'audio/*' }); if (!f) return; const d = await readAudio(f); if (d) { store.update(pr => { pr.audio.music = d; pr.audio.musicName = f.name; }, 'meta'); renderMusic(); toast('Music added. Turn on preview sound to hear it.'); } } }, icon('upload'), 'Add a music track you have the rights to use (MP3, M4A, WAV)'));
  renderMusic();
  const voiceBox = h('div', { class: 'uploader' });
  const renderVoice = () => voiceBox.replaceChildren(p.audio.voiceover
    ? h('div', { style: { display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' } }, h('span', { class: 'chip red' }, p.audio.voiceName || 'Voiceover added'), h('button', { class: 'btn sm ghost', onclick: () => { store.update(pr => { pr.audio.voiceover = null; }, 'meta'); renderVoice(); } }, icon('trash'), 'Remove'))
    : h('div', { style: { display: 'grid', gap: '8px' } },
      h('button', { class: 'drop', onclick: async () => { const [f] = await pickFiles({ accept: 'audio/*' }); if (!f) return; const d = await readAudio(f); if (d) { store.update(pr => { pr.audio.voiceover = d; pr.audio.voiceName = f.name; }, 'meta'); renderVoice(); } } }, icon('upload'), 'Add a recorded or AI-generated voiceover'),
      h('button', { class: 'btn sm', onclick: copyScript }, icon('copy'), 'Copy a voiceover script from my scenes')));
  renderVoice();
  const sfx = h('label', { class: 'toggle' }, h('input', { type: 'checkbox', checked: p.audio.sfx, onchange: e => store.update(pr => { pr.audio.sfx = e.target.checked; }, 'meta') }), 'Sound effects (whooshes, ticks, pops)');
  const sfxVol = h('input', { type: 'range', min: 0, max: 1, step: 0.05, value: p.audio.sfxVolume, 'aria-label': 'Sound effect volume', oninput: e => store.update(pr => { pr.audio.sfxVolume = Number(e.target.value); }, 'meta') });

  // Captions
  const capList = h('div', { class: 'rows' });
  const renderCaps = () => capList.replaceChildren(...(p.captions.lines || []).map((c, i) => h('div', { class: 'row' },
    h('input', { type: 'text', value: c.text, 'aria-label': `Caption ${i + 1}`, oninput: e => { store.update(pr => { pr.captions.lines[i].text = e.target.value; }, 'structure'); preview.refresh(); } }),
    h('span', { class: 'help', style: { whiteSpace: 'nowrap' } }, `${c.start.toFixed(1)}–${c.end.toFixed(1)}s`))));
  const capToggle = h('label', { class: 'toggle' }, h('input', { type: 'checkbox', checked: p.captions.on, onchange: e => { store.update(pr => { pr.captions.on = e.target.checked; if (e.target.checked && !pr.captions.lines?.length) pr.captions.lines = autoCaptions(); }, 'structure'); renderCaps(); preview.refresh(); } }), 'Burn in captions');
  renderCaps();

  const privacy = h('div', { class: 'segmented' }, ...[['internal', 'Internal: real names'], ['social', 'Social: initials only']].map(([v, l]) => h('button', { class: p.privacy === v ? 'on' : '', onclick: e => { store.update(pr => { pr.privacy = v; }, 'structure'); privacy.querySelectorAll('button').forEach(b => b.classList.remove('on')); e.target.classList.add('on'); preview.refresh(); } }, l)));

  body.append(
    coachCard('Where will it be watched?', 'Reels, TikTok and Stories: 9:16. Team meetings, YouTube and slides: 16:9. Feed posts: 1:1 or 4:5. Select every size you need and export makes them all from the same project.'),
    h('div', { class: 'group' }, h('h3', null, 'Sizes', h('small', null, 'Pick every size you need')), fmts, h('p', { class: 'help' }, 'The preview shows one size at a time; switch with the buttons under the preview. Export renders every size you select.')),
    h('div', { class: 'group' }, h('h3', null, 'Length', lenLabel), slider, h('div', { style: { display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' } }, autoBtn, h('span', { class: 'help' }, `This template works best between ${min} and ${max} seconds.`))),
    h('div', { class: 'group' }, h('h3', null, 'Frame rate'), fps, h('p', { class: 'help' }, '60 fps is the smoothest. 30 fps makes smaller files.')),
    h('div', { class: 'group' }, h('h3', null, 'Music'), musicBox),
    h('div', { class: 'group' }, h('h3', null, 'Sound effects'), sfx, sfxVol, h('p', { class: 'help' }, 'Effects line up with scene changes, numbers and reveals automatically.')),
    h('div', { class: 'group' }, h('h3', null, 'Voiceover'), voiceBox, h('p', { class: 'help' }, 'Music ducks automatically under a voiceover. Need an AI voice? Copy the script and ask Claude to generate it.')),
    h('div', { class: 'group' }, h('h3', null, 'Captions'), capToggle, capList, h('p', { class: 'help' }, 'Captions are built from each scene’s words. Edit any line. Most useful with a voiceover.')),
    h('div', { class: 'group' }, h('h3', null, 'Privacy for names and numbers'), privacy, h('p', { class: 'help' }, 'Leaderboards and team numbers show real names internally and initials for social posts.')));
}

function autoCaptions() {
  const tl = preview?.engine?.timeline() || [];
  const plan = planScenes(S.project);
  return tl.map((s, i) => {
    const sc = plan[i] || {};
    const text = [sc.text?.headline, sc.text?.sub].filter(Boolean).join(' · ') || sc.text?.eyebrow || '';
    return text ? { start: +(s.start + 0.3).toFixed(2), end: +(s.end - 0.2).toFixed(2), text } : null;
  }).filter(Boolean);
}

async function copyScript() {
  const plan = planScenes(S.project);
  const text = plan.map((s, i) => `${i + 1}. ${[s.text?.headline, s.text?.sub].filter(Boolean).join('. ')}`).filter(l => l.length > 4).join('\n');
  const script = `Voiceover script for "${S.project.name}" (${plan.reduce((a, s) => a + s.dur, 0).toFixed(0)} seconds):\n${text}`;
  toast((await copyText(script)) ? 'Script copied. Paste it to Claude or your voice tool.' : 'Could not copy. Try again.');
}

// ---------- step 4: polish
function polishStep(body) {
  const list = h('div', { class: 'scene-list' });
  const open = new Set();
  const base = () => planScenes({ ...S.project, scenes: null, duration: null });
  const overrides = () => {
    const p = S.project;
    if (!Array.isArray(p.scenes) || !p.scenes.length) p.scenes = base().map(s => ({ id: s.id }));
    return p.scenes;
  };
  const renderList = () => {
    const b = base();
    const byId = new Map(b.map(s => [s.id, s]));
    const ov = Array.isArray(S.project.scenes) && S.project.scenes.length ? S.project.scenes : b.map(s => ({ id: s.id }));
    const missing = b.filter(s => !ov.some(o => o.id === s.id)).map(s => ({ id: s.id }));
    const all = [...ov, ...missing];
    let visibleIndex = -1;
    list.replaceChildren(...all.map((o, i) => {
      const bs = byId.get(o.id) || o;
      const def = SCENES[bs.type];
      if (!def) return null;
      const enabled = o.enabled !== false;
      if (enabled) visibleIndex++;
      const vi = visibleIndex;
      const text = { ...(bs.text || {}), ...(o.text || {}) };
      const title = text.headline || text.eyebrow || def.label;
      const isOpen = open.has(o.id);
      const mutate = (fn, kind = 'structure') => { store.update(() => { const arr = overrides(); let t = arr.find(x => x.id === o.id); if (!t) { t = { id: o.id }; arr.push(t); } fn(t); }, kind); preview.refresh(); };
      const editor = isOpen ? h('div', { class: 'scene-edit' },
        (def.editable || []).map(e => {
          const cur = e.data ? (o.data?.[e.key] ?? bs.data?.[e.key] ?? '') : (text[e.key] ?? '');
          const input = e.type === 'textarea'
            ? h('textarea', { rows: 3, oninput: ev => mutate(t => { if (e.data) { t.data = { ...(t.data || {}), [e.key]: ev.target.value }; } else { t.text = { ...(t.text || {}), [e.key]: ev.target.value }; } }, 'content') }, cur)
            : h('input', { type: 'text', value: cur, oninput: ev => mutate(t => { if (e.data) { t.data = { ...(t.data || {}), [e.key]: ev.target.value }; } else { t.text = { ...(t.text || {}), [e.key]: ev.target.value }; } }, 'content') });
          return h('label', { class: 'field' }, h('span', { class: 'field-label' }, e.label), input);
        }),
        h('div', { class: 'two' },
          h('label', { class: 'field' }, h('span', { class: 'field-label' }, 'Seconds'), h('input', { type: 'number', min: 1.5, max: 15, step: 0.5, value: (o.dur ?? bs.dur ?? def.defaults.dur), oninput: ev => mutate(t => { t.dur = Math.max(1.5, Math.min(15, Number(ev.target.value) || def.defaults.dur)); }) })),
          h('label', { class: 'field' }, h('span', { class: 'field-label' }, 'Camera move'), (() => { const s = h('select', { onchange: ev => mutate(t => { t.shot = ev.target.value; }) }, Object.entries(SHOT_PRESETS).map(([k, v]) => h('option', { value: k, title: v.help }, v.label))); s.value = o.shot || bs.shot || def.defaults.shot; return s; })())),
        o.custom ? h('p', { class: 'help' }, 'Added scene: it uses the words you type here.') : h('p', { class: 'help' }, 'Edits here override the template text for this scene only. Content-step changes still flow in.')) : null;
      return h('div', { class: 'scene-item' + (enabled ? '' : ' off') },
        h('div', { class: 'scene-top' },
          h('span', { class: 'num' }, String(i + 1).padStart(2, '0')),
          h('button', { style: { all: 'unset', cursor: 'pointer', minWidth: 0 }, onclick: () => { if (isOpen) open.delete(o.id); else open.add(o.id); renderList(); if (enabled) preview.seekScene(vi); } },
            h('b', null, title), h('small', null, `${def.label} · ${(o.dur ?? bs.dur ?? def.defaults.dur).toFixed?.(1) ?? o.dur}s${enabled ? '' : ' · hidden'}`)),
          h('div', { class: 'row-tools' },
            h('button', { title: 'Move up', 'aria-label': 'Move up', disabled: i === 0, onclick: () => { store.update(() => { const arr = overrides(); const j = arr.findIndex(x => x.id === o.id); if (j > 0) [arr[j - 1], arr[j]] = [arr[j], arr[j - 1]]; }, 'structure'); renderList(); preview.refresh(); } }, icon('up')),
            h('button', { title: 'Move down', 'aria-label': 'Move down', onclick: () => { store.update(() => { const arr = overrides(); const j = arr.findIndex(x => x.id === o.id); if (j >= 0 && j < arr.length - 1) [arr[j + 1], arr[j]] = [arr[j], arr[j + 1]]; }, 'structure'); renderList(); preview.refresh(); } }, icon('down')),
            h('label', { class: 'toggle', title: enabled ? 'Hide this scene' : 'Show this scene' }, h('input', { type: 'checkbox', checked: enabled, 'aria-label': enabled ? 'Scene on' : 'Scene off', onchange: ev => { mutate(t => { t.enabled = ev.target.checked; }); renderList(); } })))),
        editor);
    }));
  };
  renderList();
  const add = async () => {
    let pick = null;
    const opts = h('div', { class: 'scene-list' }, SCENE_ORDER.filter(t => t !== 'endcard' || true).map(t => {
      const b = h('button', { class: 'export-item', style: { textAlign: 'left', cursor: 'pointer' }, onclick: () => { pick = t; opts.querySelectorAll('.export-item').forEach(x => x.style.borderColor = ''); b.style.borderColor = 'var(--red)'; } },
        h('span', { class: 'chip' }, SCENES[t].label), h('span', null, SCENES[t].description), h('span'));
      return b;
    }));
    const ok = await modal({ title: 'Add a scene', wide: true, body: h('div', { style: { display: 'grid', gap: '10px' } }, h('p', null, 'New scenes start with placeholder words; open them to type your own.'), opts), actions: [{ label: 'Cancel', value: false }, { label: 'Add scene', value: true, primary: true }] });
    if (!ok || !pick) return;
    const id = `custom-${pick}-${Date.now().toString(36)}`;
    store.update(() => {
      const arr = overrides();
      const endIdx = arr.findIndex(x => (base().find(b => b.id === x.id) || x).type === 'endcard');
      const scene = { id, type: pick, custom: true, dur: SCENES[pick].defaults.dur, shot: SCENES[pick].defaults.shot, text: { eyebrow: 'New scene', headline: 'Your headline here' }, data: pick === 'list' ? { items: ['First point', 'Second point', 'Third point'] } : pick === 'hero' ? { glyph: '1' } : pick === 'stats' ? { stats: [{ value: '10', label: 'Your number' }] } : {} };
      if (endIdx >= 0) arr.splice(endIdx, 0, scene); else arr.push(scene);
    }, 'structure');
    open.add(id);
    renderList();
    preview.refresh();
  };
  const resetScenes = async () => {
    const ok = await modal({ title: 'Reset scenes?', body: 'This restores the template’s scenes, order and timing. Your content fields stay.', actions: [{ label: 'Cancel', value: false }, { label: 'Reset scenes', value: true, primary: true }] });
    if (!ok) return;
    store.update(p => { p.scenes = null; }, 'structure'); renderList(); preview.refresh();
  };
  body.append(
    h('div', { class: 'coach' }, h('div', { class: 'coach-head' }, h('span', { class: 'dot' }, icon('coach')), 'Make it yours'), h('p', null, 'Click a scene to jump the preview there and edit its words, length and camera move. Use the arrows to reorder and the switch to hide a scene.')),
    list,
    h('div', { style: { display: 'flex', gap: '8px', flexWrap: 'wrap' } }, h('button', { class: 'btn', onclick: add }, icon('plus'), 'Add a scene'), h('button', { class: 'btn ghost', onclick: resetScenes }, icon('reset'), 'Reset scenes')));
}

// ---------- step 5: export
function exportStep(body) {
  const p = S.project;
  const issues = validateProject(p);
  const errors = issues.filter(i => i.level === 'error');
  const types = [
    ['mp4', 'MP4 video', 'Frame-perfect H.264 with sound. Best for every platform.', canEncodeMP4() ? null : 'Needs Chrome or Edge'],
    ['poster', 'Poster frame PNG', 'A still for thumbnails, emails and slides.'],
    ['gif', 'GIF', 'Plays inline in Slack and email. Smaller and silent.'],
    ['storyboard', 'Storyboard sheet', 'Every scene on one image, for review and approvals.'],
    ['overlay', 'Transparent overlay', 'Type and graphics on transparency for editing apps. Rendered by Claude Code.', 'Claude Code'],
  ];
  const typeList = h('div', { class: 'export-list' }, types.map(([k, label, desc, note]) => h('label', { class: 'export-item' },
    h('input', { type: 'checkbox', checked: !!p.exports[k], onchange: e => store.update(pr => { pr.exports[k] = e.target.checked; }, 'meta') }),
    h('span', null, h('b', null, label), h('span', null, desc)),
    note ? h('span', { class: 'chip' }, note) : h('span'))));
  const fmtChips = h('div', { class: 'filters' }, Object.values(FORMATS).map(f => h('button', { class: p.formats.includes(f.id) ? 'on' : '', onclick: e => { store.update(pr => { pr.formats = pr.formats.includes(f.id) ? pr.formats.filter(x => x !== f.id) : [...pr.formats, f.id]; if (!pr.formats.length) pr.formats = [f.id]; }, 'meta'); e.target.classList.toggle('on', S.project.formats.includes(f.id)); } }, f.label)));
  const prog = h('div', { class: 'group', hidden: true }, h('h3', null, 'Exporting'), h('div', { class: 'progress' }, h('i')), h('p', { class: 'help', 'aria-live': 'polite' }, ''), h('button', { class: 'btn sm', onclick: () => ctl?.abort() }, 'Cancel'));
  let ctl = null;
  const run = async () => {
    if (errors.length) {
      const go = await modal({ title: 'Some content is still missing', body: h('ul', null, errors.map(e => h('li', null, e.msg))), actions: [{ label: 'Go fix it', value: false, primary: true }, { label: 'Export anyway', value: true }] });
      if (!go) { goStep('content'); return; }
    }
    preview.pause();
    ctl = new AbortController();
    prog.hidden = false;
    const bar = prog.querySelector('i'), label = prog.querySelector('p');
    const jobs = [];
    for (const fmt of S.project.formats) {
      if (S.project.exports.mp4 && canEncodeMP4()) jobs.push([fmt, 'mp4']);
      if (S.project.exports.poster) jobs.push([fmt, 'poster']);
      if (S.project.exports.gif) jobs.push([fmt, 'gif']);
      if (S.project.exports.storyboard) jobs.push([fmt, 'storyboard']);
    }
    if (!jobs.length) { toast('Choose at least one file type to export here.'); prog.hidden = true; return; }
    const base = slug(S.project.name);
    const notes = new Set();
    try {
      for (let j = 0; j < jobs.length; j++) {
        const [fmt, kind] = jobs[j];
        const onProgress = (k, msg) => { bar.style.width = `${((j + k) / jobs.length) * 100}%`; label.textContent = `${kind.toUpperCase()} · ${fmt.replace('x', ':')} · ${msg}`; };
        onProgress(0, 'Starting');
        let blob, ext;
        if (kind === 'mp4') {
          blob = await exportMP4(S.project, fmt, { fps: S.project.fps || 60, onProgress, signal: ctl.signal }); ext = 'mp4';
          if (blob.codec !== 'avc') notes.add('this browser saved the MP4 as VP9/AV1 instead of H.264');
          if (blob.silent) notes.add('this browser could not encode sound, so the MP4 is silent');
        }
        if (kind === 'poster') { blob = await exportPoster(S.project, fmt); ext = 'png'; }
        if (kind === 'gif') { blob = await exportGIF(S.project, fmt, { onProgress, signal: ctl.signal }); ext = 'gif'; }
        if (kind === 'storyboard') { blob = await exportStoryboard(S.project, fmt, { onProgress }); ext = 'png'; }
        download(blob, `${base}-${fmt}${kind === 'poster' ? '-poster' : kind === 'storyboard' ? '-storyboard' : ''}.${ext}`);
      }
      bar.style.width = '100%';
      label.textContent = 'Done. Your files are in your downloads folder.' + (notes.size ? ` Note: ${[...notes].join('; ')}. For the widest compatibility, use Send with Claude.` : '');
      toast('Export complete');
      S.project.thumb = preview.snapshot(200);
      store.save(true);
    } catch (e) {
      if (e.name === 'AbortError') { label.textContent = 'Cancelled.'; toast('Export cancelled'); }
      else { console.error(e); label.textContent = e.message; toast(e.message, { error: true, ms: 7000 }); }
    }
  };
  const deliveries = [['download', 'Download to this computer'], ['slack', 'Post to a Slack channel'], ['drive', 'Save to Google Drive'], ['email', 'Draft an email with it attached'], ['github', 'Commit to the GitHub repo']];
  const delivery = h('div', { class: 'export-list' }, deliveries.map(([k, l]) => h('label', { class: 'export-item' },
    h('input', { type: 'checkbox', checked: !!p.delivery[k], onchange: e => store.update(pr => { pr.delivery[k] = e.target.checked; }, 'meta') }), h('span', null, h('b', null, l)), k === 'download' ? h('span', { class: 'chip' }, 'Here') : h('span', { class: 'chip' }, 'Via Claude'))));

  body.append(
    coachCard('Two ways to finish', canEncodeMP4()
      ? 'Export now renders frame-perfect files right here; keep this tab open while it works. For the transparent overlay, batch jobs or delivery to Slack, Drive or email, use Send with Claude.'
      : 'This browser can\u2019t encode MP4, but the poster, GIF and storyboard work here. For MP4s, open the Studio in Chrome or Edge, or use Send with Claude for a final render.'),
    errors.length ? h('div', { class: 'coach' }, h('div', { class: 'coach-head' }, h('span', { class: 'dot' }, icon('coach')), 'Before you export'), h('ul', { class: 'checks' }, errors.map(e => h('li', { class: 'error' }, h('span', { class: 'i' }, '!'), e.msg)))) : null,
    h('div', { class: 'group' }, h('h3', null, 'Sizes'), fmtChips),
    h('div', { class: 'group' }, h('h3', null, 'Files'), typeList),
    h('button', { class: 'btn primary lg', onclick: run }, icon('download'), 'Export now in this browser'),
    prog,
    h('div', { class: 'group' }, h('h3', null, 'Deliver', h('small', null, 'Pick any combination')), delivery,
      h('button', { class: 'btn dark', onclick: sendWithClaude }, icon('send'), 'Send with Claude'),
      h('p', { class: 'help' }, 'Copies a ready-to-paste request and downloads the project file. Claude Code renders final 60fps files in every size and delivers them to Slack, Drive, email or GitHub using your connected accounts.')),
    h('div', { class: 'group' }, h('h3', null, 'Batch', h('small', null, 'One video per spreadsheet row')), h('p', { class: 'help' }, 'Same template and look for many agents or listings. Upload a CSV with a column per field.'), h('button', { class: 'btn', onclick: batchDialog }, icon('table'), 'Make a batch from a spreadsheet')),
    h('div', { class: 'group' }, h('h3', null, 'Project file'), h('div', { style: { display: 'flex', gap: '8px', flexWrap: 'wrap' } },
      h('button', { class: 'btn', onclick: () => download(new Blob([JSON.stringify(S.project, null, 2)], { type: 'application/json' }), `${slug(S.project.name)}.json`) }, icon('download'), 'Download project'),
      h('button', { class: 'btn', onclick: saveTemplate }, icon('save'), 'Save as my template'))));
}

async function sendWithClaude() {
  const p = S.project;
  const file = `${slug(p.name)}.json`;
  download(new Blob([JSON.stringify(p, null, 2)], { type: 'application/json' }), file);
  const types = Object.entries(p.exports).filter(([, v]) => v).map(([k]) => k).join(',');
  const d = p.delivery;
  const steps = [
    `Render the attached Creative Studio project "${p.name}" (${file}) with the Motion Studio renderer in motion-studio/render:`,
    `node render/render.mjs projects/${file} --formats ${p.formats.join(',')} --exports ${types || 'mp4,poster'} --fps ${p.fps || 60}`,
    'Check the poster and storyboard stills before rendering the full clip.',
  ];
  if (d.slack) steps.push('Then post the 9:16 MP4 (or the first size) to Slack channel #[channel name] with a short caption I approve first.');
  if (d.drive) steps.push('Then save every file to my Google Drive folder [folder name or link].');
  if (d.email) steps.push('Then draft (do not send) an email to [recipient] with the MP4 attached or linked and a two-line message.');
  if (d.github) steps.push('Then commit the project file and renders to the repo and push.');
  const text = steps.join('\n');
  await modal({
    title: 'Send with Claude', wide: true,
    body: h('div', { style: { display: 'grid', gap: '12px' } },
      h('p', null, `The project file (${file}) is in your downloads. Paste this request to Claude together with that file, and fill in the [brackets].`),
      h('pre', null, text),
      h('button', { class: 'btn sm', onclick: async () => toast((await copyText(text)) ? 'Request copied' : 'Select the text and copy it') }, icon('copy'), 'Copy request')),
    actions: [{ label: 'Done', value: true, primary: true }],
  });
}

async function batchDialog() {
  const p = S.project;
  const story = STORIES[p.story];
  const textFields = story.fields.filter(f => ['text', 'number', 'textarea', 'url', 'select'].includes(f.type));
  let rows = [], headers = [], map = {};
  const table = h('div', { style: { display: 'grid', gap: '8px' } });
  const renderMap = () => {
    table.replaceChildren(
      h('p', { class: 'help' }, `${rows.length} row${rows.length === 1 ? '' : 's'} found. Match columns to fields:`),
      ...textFields.map(f => {
        const sel = h('select', { onchange: e => { map[f.key] = e.target.value; } }, h('option', { value: '' }, '(keep the current value)'), headers.map(x => h('option', { value: x }, x)));
        sel.value = map[f.key] || '';
        return h('label', { class: 'two', style: { alignItems: 'center' } }, h('span', { class: 'field-label' }, f.label), sel);
      }));
  };
  const pick = h('button', { class: 'drop', onclick: async () => {
    const [f] = await pickFiles({ accept: '.csv,text/csv' });
    if (!f) return;
    ({ headers, rows } = parseCSV(await f.text()));
    map = {};
    textFields.forEach(fd => { const hit = headers.find(x => x.toLowerCase().replace(/[^a-z]/g, '') === fd.key.toLowerCase() || x.toLowerCase().includes(fd.label.toLowerCase().split(' ')[0])); if (hit) map[fd.key] = hit; });
    renderMap();
  } }, icon('upload'), 'Choose a CSV file (one row per video)');
  const choice = await modal({
    title: 'Batch: one video per row', wide: true,
    body: h('div', { style: { display: 'grid', gap: '12px' } }, h('p', null, `Every video uses ${story.name} in ${LOOKS[p.look]?.name}, with the photos and settings from this project. Text fields come from your spreadsheet.`), pick, table),
    actions: [{ label: 'Cancel', value: null }, { label: 'Download batch for Claude Code', value: 'claude' }, { label: 'Export MP4s here', value: 'here', primary: true }],
  });
  if (!choice) return;
  if (!rows.length) { toast('Choose a CSV with at least one row.'); return; }
  const projects = rows.map((r, i) => {
    const c = store.duplicate(p);
    Object.entries(map).forEach(([k, col]) => { if (col) c.fields[k] = r[col]; });
    c.name = `${p.name} · ${r[map.agentName] || r[map.address] || r[headers[0]] || i + 1}`;
    return c;
  });
  if (choice === 'claude') {
    download(new Blob([JSON.stringify(projects, null, 2)], { type: 'application/json' }), `${slug(p.name)}-batch.json`);
    toast(`Batch of ${projects.length} projects downloaded. Ask Claude Code to render each one.`, { ms: 6000 });
    return;
  }
  if (!canEncodeMP4()) { toast('MP4 export needs Chrome or Edge. Use "Download batch for Claude Code" instead.', { error: true }); return; }
  preview.pause();
  for (let i = 0; i < projects.length; i++) {
    toast(`Rendering ${i + 1} of ${projects.length}: ${projects[i].name}`);
    try {
      const blob = await exportMP4(projects[i], p.format, { fps: p.fps || 60 });
      download(blob, `${slug(projects[i].name)}-${p.format}.mp4`);
    } catch (e) { toast(`${projects[i].name}: ${e.message}`, { error: true }); }
  }
  toast('Batch complete');
}

async function saveTemplate() {
  const name = h('input', { type: 'text', value: `${S.project.name} template` });
  const ok = await modal({ title: 'Save as my template', body: h('div', { style: { display: 'grid', gap: '10px' } }, h('p', null, 'Saves this template, look, settings and scene edits so you can start new videos from it. Photos and text are saved too; replace them each time.'), h('label', { class: 'field' }, h('span', { class: 'field-label' }, 'Template name'), name)), actions: [{ label: 'Cancel', value: false }, { label: 'Save template', value: true, primary: true }] });
  if (!ok) return;
  const t = store.duplicate(S.project, true);
  t.name = name.value || t.name;
  t.thumb = preview?.snapshot(200) || null;
  await storage.put(t);
  toast(`Saved "${t.name}" to My templates`);
}

async function openProjects() {
  const list = await storage.list();
  const body = h('div', { style: { display: 'grid', gap: '10px' } });
  const close = drawer('Projects', body);
  const importBtn = h('button', { class: 'btn', onclick: async () => {
    const [f] = await pickFiles({ accept: '.json,application/json' });
    if (!f) return;
    try {
      const j = JSON.parse(await f.text());
      const arr = Array.isArray(j) ? j : [j];
      for (const pj of arr) await storage.put(normalizeProject(pj));
      store.open(normalizeProject(arr[0]));
      close(); render();
      toast(arr.length > 1 ? `Imported ${arr.length} projects` : 'Project imported');
    } catch (e) { toast('That file is not a Creative Studio project.', { error: true }); }
  } }, icon('upload'), 'Import a project file');
  body.append(importBtn);
  if (!list.length) body.append(h('p', { class: 'help' }, 'No saved projects yet. Projects save automatically as you work.'));
  for (const m of list) {
    body.append(h('div', { class: 'rcard' },
      h('span', { class: 'rthumb' }, m.thumb ? h('img', { src: m.thumb, alt: '' }) : null),
      h('span', { class: 'grow' }, h('b', null, (m.isTemplate ? '★ ' : '') + (m.name || 'Untitled')), h('span', null, `${STORIES[m.story]?.name || m.story} · ${new Date(m.updatedAt).toLocaleString()}`)),
      h('div', { class: 'row-tools' },
        h('button', { title: 'Open', 'aria-label': 'Open', onclick: async () => { const p = await storage.get(m.id); if (p) { store.open(p); close(); render(); } } }, icon('next')),
        h('button', { title: 'Download', 'aria-label': 'Download project file', onclick: async () => { const p = await storage.get(m.id); if (p) download(new Blob([JSON.stringify(p, null, 2)], { type: 'application/json' }), `${slug(p.name)}.json`); } }, icon('download')),
        h('button', { title: 'Delete', 'aria-label': 'Delete', onclick: async e => {
          const ok = await modal({ title: 'Delete this project?', body: `"${m.name}" will be removed from this browser.`, actions: [{ label: 'Cancel', value: false }, { label: 'Delete', value: true, primary: true }] });
          if (ok) { await storage.remove(m.id); e.target.closest('.rcard').remove(); }
        } }, icon('trash')))));
  }
}

// ---------------------------------------------------------------- boot
document.addEventListener('keydown', e => {
  if (S.route === 'home' || !preview) return;
  const tag = (e.target.tagName || '').toLowerCase();
  if (['input', 'textarea', 'select'].includes(tag) || e.target.isContentEditable) return;
  if (e.code === 'Space') { e.preventDefault(); preview.toggle(); }
});
// Any change to content or structure re-renders the preview (debounced inside Preview)
store.on(kind => { if ((kind === 'content' || kind === 'structure') && preview && S.route !== 'home') preview.refresh(); });
window.addEventListener('beforeunload', () => store.save(true));
// Handy for support and automated checks
window.CreativeStudio = { store, exportMP4, exportGIF, exportPoster, exportStoryboard, version: '1.0.0' };

(async () => {
  const cur = await storage.getMeta('current');
  if (cur) {
    const p = await storage.get(cur);
    if (p) { S.project = normalizeProject(p); }
  }
  render();
})();
