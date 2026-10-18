// Project storage: the current project lives in memory and autosaves to IndexedDB (projects
// and user templates). Falls back to memory-only when storage is unavailable.
import { normalizeProject, defaultProject, newId } from '../engine/project.js';

const DB_NAME = 'redfin-creative-studio';
const DB_VER = 1;
let dbp = null;

function openDB() {
  if (dbp) return dbp;
  dbp = new Promise(resolve => {
    try {
      const req = indexedDB.open(DB_NAME, DB_VER);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains('projects')) db.createObjectStore('projects', { keyPath: 'id' });
        if (!db.objectStoreNames.contains('meta')) db.createObjectStore('meta');
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
      req.onblocked = () => resolve(null);
    } catch (e) { resolve(null); }
  });
  return dbp;
}

async function tx(store, mode, fn) {
  const db = await openDB();
  if (!db) return null;
  return new Promise(resolve => {
    try {
      const t = db.transaction(store, mode);
      const s = t.objectStore(store);
      const r = fn(s);
      t.oncomplete = () => resolve(r?.result ?? true);
      t.onerror = () => resolve(null);
      t.onabort = () => resolve(null);
    } catch (e) { resolve(null); }
  });
}

export const storage = {
  async list() {
    const db = await openDB();
    if (!db) return [];
    return new Promise(resolve => {
      try {
        const out = [];
        const req = db.transaction('projects', 'readonly').objectStore('projects').openCursor();
        req.onsuccess = () => {
          const c = req.result;
          if (c) { const p = c.value; out.push({ id: p.id, name: p.name, story: p.story, look: p.look, format: p.format, updatedAt: p.updatedAt, thumb: p.thumb, isTemplate: !!p.isTemplate }); c.continue(); }
          else resolve(out.sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt))));
        };
        req.onerror = () => resolve([]);
      } catch (e) { resolve([]); }
    });
  },
  async get(id) {
    const db = await openDB();
    if (!db) return null;
    return new Promise(resolve => {
      try {
        const req = db.transaction('projects', 'readonly').objectStore('projects').get(id);
        req.onsuccess = () => resolve(req.result || null);
        req.onerror = () => resolve(null);
      } catch (e) { resolve(null); }
    });
  },
  put(p) { return tx('projects', 'readwrite', s => s.put(JSON.parse(JSON.stringify(p)))); },
  remove(id) { return tx('projects', 'readwrite', s => s.delete(id)); },
  setMeta(k, v) { return tx('meta', 'readwrite', s => s.put(v, k)); },
  async getMeta(k) {
    const db = await openDB();
    if (!db) return null;
    return new Promise(resolve => {
      try {
        const req = db.transaction('meta', 'readonly').objectStore('meta').get(k);
        req.onsuccess = () => resolve(req.result ?? null);
        req.onerror = () => resolve(null);
      } catch (e) { resolve(null); }
    });
  },
};

/** Observable app state. */
export function createStore() {
  const listeners = new Set();
  const state = {
    route: 'home',
    project: null,
    visited: new Set(),
    preview: { t: 0, playing: false, sound: false },
  };
  let saveTimer = null;
  const api = {
    state,
    on(fn) { listeners.add(fn); return () => listeners.delete(fn); },
    emit(kind = 'change') { listeners.forEach(fn => fn(kind)); },
    go(route) { state.route = route; state.visited.add(route); api.emit('route'); },
    start(storyId, overrides = {}) {
      state.project = defaultProject(storyId, overrides);
      state.visited = new Set(['content']);
      api.save();
      api.go('content');
    },
    open(project) {
      state.project = normalizeProject(project);
      state.visited = new Set(['content', 'look', 'format', 'polish']);
      api.go('content');
    },
    /** Mutates the project and schedules save + preview refresh. kind: 'content' | 'structure' */
    update(mut, kind = 'content') {
      if (!state.project) return;
      mut(state.project);
      state.project.updatedAt = new Date().toISOString();
      api.emit(kind);
      api.save();
    },
    save(immediate = false) {
      clearTimeout(saveTimer);
      const run = () => { if (state.project) storage.put(state.project); storage.setMeta('current', state.project?.id || null); };
      if (immediate) run(); else saveTimer = setTimeout(run, 600);
    },
    reset() {
      state.project = null;
      state.visited = new Set();
      storage.setMeta('current', null);
      api.go('home');
    },
    duplicate(p, asTemplate = false) {
      const c = normalizeProject(JSON.parse(JSON.stringify(p)));
      c.id = newId();
      c.isTemplate = asTemplate;
      c.name = asTemplate ? (p.name || 'My template') : `${p.name || 'Project'} (copy)`;
      c.createdAt = c.updatedAt = new Date().toISOString();
      return c;
    },
  };
  return api;
}
