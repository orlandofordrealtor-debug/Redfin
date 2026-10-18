// Minimal page entry used by the Node renderer: a canvas plus a small frame API on window.MS.
import { MotionEngine } from './engine/engine.js';
import { normalizeProject, defaultProject } from './engine/project.js';
import { STORIES, STORY_ORDER } from './stories/index.js';
import { LOOKS, LOOK_ORDER } from './looks/index.js';
import { renderSoundtrack, audioBufferToWav } from './engine/audio.js';

let engine = null;

window.MS = {
  async load(project, { scale = 1, quality = 'final' } = {}) {
    if (engine) engine.dispose();
    // A canvas whose WebGL context was released cannot host a new one, so each load gets a fresh canvas
    const old = document.getElementById('stage');
    const canvas = document.createElement('canvas');
    canvas.id = 'stage';
    old.replaceWith(canvas);
    engine = new MotionEngine({ canvas, scale, quality });
    await engine.load(project);
    const s = engine.stage;
    return { duration: engine.duration, width: s.pw, height: s.ph, timeline: engine.timeline(), cues: engine.cues() };
  },
  get engine() { return engine; },
  frame(t) { engine.renderFrame(t); return true; },
  frameData(t, type = 'image/png', q = 0.95) { engine.renderFrame(t); return engine.canvas.toDataURL(type, q); },
  /** Renders the 2D type layer only, on transparent, for the overlay export. */
  overlayData(t) {
    engine.renderFrame(t);
    return engine.stage.overlay.toDataURL('image/png');
  },
  timeline() { return engine.timeline(); },
  cues() { return engine.cues(); },
  normalizeProject,
  defaultProject,
  sample(id) { return STORIES[id]?.sample || {}; },
  storyList() {
    return STORY_ORDER.filter(id => !STORIES[id].hidden).map(id => {
      const s = STORIES[id];
      const defaults = {};
      s.fields.forEach(f => { if (f.default !== undefined) defaults[f.key] = f.default; });
      return { id, defaultLook: s.defaultLook, sample: s.sample || {}, defaults };
    });
  },
  lookList() { return LOOK_ORDER.map(id => ({ id, placeholder: !!LOOKS[id].placeholder })); },
  /** Soundtrack as a base64 WAV (sound effects + music/voiceover passed in as base64). */
  async soundtrackWav({ musicB64 = null, voiceB64 = null } = {}) {
    const p = engine.project;
    const dec = b64 => (b64 ? Uint8Array.from(atob(b64), c => c.charCodeAt(0)).buffer : null);
    const buf = await renderSoundtrack({
      duration: engine.duration, cues: engine.cues(), music: dec(musicB64), musicVolume: p.audio.musicVolume ?? 0.8,
      voiceover: dec(voiceB64), sfx: p.audio.sfx !== false, sfxVolume: p.audio.sfxVolume ?? 0.6,
    });
    const wav = audioBufferToWav(buf);
    let s = '';
    for (let i = 0; i < wav.length; i += 0x8000) s += String.fromCharCode.apply(null, wav.subarray(i, i + 0x8000));
    return btoa(s);
  },
};
window.MS_READY = true;
