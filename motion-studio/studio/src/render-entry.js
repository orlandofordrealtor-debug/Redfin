// Minimal page entry used by the Node renderer: a canvas plus a small frame API on window.MS.
import { MotionEngine } from './engine/engine.js';
import { normalizeProject, defaultProject } from './engine/project.js';

let engine = null;

window.MS = {
  async load(project, { scale = 1, quality = 'final' } = {}) {
    if (engine) engine.dispose();
    const canvas = document.getElementById('stage');
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
};
window.MS_READY = true;
