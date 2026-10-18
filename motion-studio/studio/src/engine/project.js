// Project model. A project = story (content framework) + look (visual world) + fields (content)
// + optional per-scene overrides. Editing fields regenerates scenes while keeping user overrides.
import { STORIES } from '../stories/index.js';
import { SCENES } from '../scenes/index.js';

export const PROJECT_VERSION = 1;

export function newId(prefix = 'p') {
  const r = (globalThis.crypto?.getRandomValues ? Array.from(crypto.getRandomValues(new Uint8Array(6))) : Array.from({ length: 6 }, () => Math.floor(Math.random() * 256)))
    .map(b => b.toString(16).padStart(2, '0')).join('');
  return `${prefix}_${r}`;
}

export function defaultProject(storyId = 'anniversary', overrides = {}) {
  const story = STORIES[storyId] || STORIES.anniversary;
  const fields = {};
  for (const f of story.fields) if (f.default !== undefined) fields[f.key] = structuredCloneSafe(f.default);
  return normalizeProject({
    id: newId(),
    name: story.name,
    story: story.id,
    look: story.defaultLook || 'brand-glass',
    format: story.defaultFormat || '9x16',
    fields,
    ...overrides,
  });
}

export function normalizeProject(p = {}) {
  const story = STORIES[p.story] ? p.story : 'anniversary';
  return {
    version: PROJECT_VERSION,
    id: p.id || newId(),
    name: p.name || STORIES[story].name,
    story,
    look: p.look || STORIES[story].defaultLook || 'brand-glass',
    format: p.format || '9x16',
    formats: Array.isArray(p.formats) && p.formats.length ? p.formats : [p.format || '9x16'],
    duration: p.duration || null,
    fps: [24, 30, 60].includes(Number(p.fps)) ? Number(p.fps) : 60,
    energy: p.energy || 'standard',
    brand: { mode: 'brand', ...(p.brand || {}) },
    fields: { ...(p.fields || {}) },
    scenes: Array.isArray(p.scenes) ? p.scenes : null,
    audio: { music: null, musicVolume: 0.8, sfx: true, sfxVolume: 0.6, voiceover: null, ...(p.audio || {}) },
    captions: { on: false, lines: [], ...(p.captions || {}) },
    exports: { mp4: true, poster: true, gif: false, storyboard: false, overlay: false, ...(p.exports || {}) },
    delivery: { download: true, slack: false, drive: false, email: false, github: false, ...(p.delivery || {}) },
    privacy: p.privacy || 'internal',
    chrome: { logo: true, steps: null, ...(p.chrome || {}) },
    post: p.post || null,
    fadeEdges: p.fadeEdges !== false,
    isTemplate: !!p.isTemplate,
    thumb: p.thumb || null,
    createdAt: p.createdAt || new Date().toISOString(),
    updatedAt: p.updatedAt || new Date().toISOString(),
  };
}

/** Default scene plan from the story, merged with the user's scene overrides. */
export function planScenes(p) {
  const story = STORIES[p.story];
  const base = story.plan(p.fields || {}, { privacy: p.privacy, format: p.format }).filter(Boolean)
    .map((s, i) => ({ id: s.id || `${s.type}-${i}`, shot: SCENES[s.type]?.defaults?.shot, ...s, dur: s.dur || SCENES[s.type]?.defaults?.dur || 3 }));
  let scenes = base;
  if (Array.isArray(p.scenes) && p.scenes.length) {
    const byId = new Map(base.map(s => [s.id, s]));
    scenes = [];
    for (const o of p.scenes) {
      const b = byId.get(o.id);
      if (o.enabled === false) { byId.delete(o.id); continue; }
      if (b) {
        scenes.push({ ...b, ...pick(o, ['dur', 'shot', 'label']), text: { ...(b.text || {}), ...stripEmpty(o.text || {}) }, data: { ...(b.data || {}), ...(o.data || {}) } });
        byId.delete(o.id);
      } else if (o.custom && SCENES[o.type]) {
        scenes.push({ ...o, dur: o.dur || SCENES[o.type].defaults?.dur || 3 });
      }
    }
    // scenes the story added since the user last edited (e.g. after adding photos) go before the end card
    for (const s of byId.values()) {
      if (p.scenes.some(o => o.id === s.id)) continue;
      const endIdx = scenes.findIndex(x => x.type === 'endcard');
      if (endIdx >= 0) scenes.splice(endIdx, 0, s); else scenes.push(s);
    }
  }
  scenes = scenes.filter(s => SCENES[s.type]);
  const minDur = story.durations?.min;
  if (!p.duration && minDur) {
    // stories with a minimum length (data recaps run 30s+) stretch evenly to reach it
    const total = scenes.reduce((a, s) => a + s.dur, 0);
    if (total < minDur) scenes = scenes.map(s => ({ ...s, dur: s.dur * (minDur / total) }));
  }
  if (p.duration) {
    const total = scenes.reduce((a, s) => a + s.dur, 0);
    const k = p.duration / total;
    scenes = scenes.map(s => ({ ...s, dur: Math.max(1.6, s.dur * k) }));
  }
  return scenes;
}

/** Runs the story's checks plus general ones. Returns [{level, msg, field}]. */
export function validateProject(p) {
  const story = STORIES[p.story];
  const out = [];
  for (const f of story.fields) {
    const v = p.fields[f.key];
    const empty = v === undefined || v === null || v === '' || (Array.isArray(v) && v.length === 0);
    if (f.required && empty) out.push({ level: 'error', field: f.key, msg: `${f.label} is needed. ${f.help || ''}`.trim() });
    if (f.type === 'images' && Array.isArray(v)) {
      if (f.min && v.length < f.min) out.push({ level: 'warn', field: f.key, msg: `Add at least ${f.min} ${f.unit || 'photos'} for this template (you have ${v.length}). Placeholders fill the gaps until you do.` });
      if (f.max && v.length > f.max) out.push({ level: 'warn', field: f.key, msg: `That's more than fits well (${v.length}). The first ${f.max} will be used, or lengthen the video.` });
    }
    if (f.type === 'url' && v && !/^https?:\/\//i.test(String(v))) out.push({ level: 'warn', field: f.key, msg: `${f.label} should start with https:// so the QR code opens correctly.` });
  }
  if (story.validate) out.push(...story.validate(p.fields || {}, p));
  const scenes = planScenes(p);
  const total = scenes.reduce((a, s) => a + s.dur, 0);
  if (total > 90) out.push({ level: 'warn', msg: `This video runs ${Math.round(total)}s. Most social platforms favor 60s or less.` });
  return out;
}

function pick(o, keys) { const r = {}; keys.forEach(k => { if (o[k] !== undefined && o[k] !== null && o[k] !== '') r[k] = o[k]; }); return r; }
function stripEmpty(o) { const r = {}; Object.entries(o).forEach(([k, v]) => { if (v !== undefined && v !== null && v !== '') r[k] = v; }); return r; }
function structuredCloneSafe(v) { try { return structuredClone(v); } catch (e) { return JSON.parse(JSON.stringify(v)); } }
