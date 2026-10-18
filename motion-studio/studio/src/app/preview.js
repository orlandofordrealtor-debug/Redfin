// Live preview: the same engine that renders final videos, sized to the stage, with
// play/pause, a scene timeline to scrub, format switching and synced sound.
import { MotionEngine } from '../engine/engine.js';
import { FORMATS } from '../engine/stage.js';
import { renderSoundtrack } from '../engine/audio.js';
import { h, icon, fmtTime, debounce, toast } from './ui.js';

export class Preview {
  constructor(store) {
    this.store = store;
    this.canvas = h('canvas', { 'aria-label': 'Video preview' });
    this.engine = null;
    this.t = 1.2;   // start past the fade-in so the first frame shows content
    this.playing = false;
    this.quality = 'final';
    this.loading = false;
    this.soundOn = false;
    this.audioCtx = null;
    this.audioSrc = null;
    this.soundBuf = null;
    this.soundKey = '';
    this.el = this.build();
    this.ro = new ResizeObserver(() => this.fit());
    this.ro.observe(this.stage);
    this.refresh = debounce(() => this.load(), 280);
    this.loop = this.loop.bind(this);
  }

  build() {
    this.stage = h('div', { class: 'stage' }, this.canvas,
      this.note = h('div', { class: 'stage-note' }),
      this.busy = h('div', { class: 'busy', hidden: true }, 'Building your scene…'));
    this.playBtn = h('button', { class: 'play', 'aria-label': 'Play', onclick: () => this.toggle() }, icon('play'));
    this.timeEl = h('span', { class: 'time' }, '0:00.00 / 0:00.00');
    this.soundBtn = h('button', { class: 'icon-btn', style: { background: 'transparent', borderColor: 'rgba(255,255,255,.2)', color: '#fff' }, 'aria-label': 'Sound on preview', title: 'Preview sound', onclick: () => this.toggleSound() }, icon('mute'));
    this.fmtSeg = h('div', { class: 'seg-dark', role: 'group', 'aria-label': 'Preview format' });
    this.qualSeg = h('div', { class: 'seg-dark', role: 'group', 'aria-label': 'Preview quality' },
      ...[['final', 'Best'], ['draft', 'Fast']].map(([q, l]) => h('button', { 'data-q': q, class: q === this.quality ? 'on' : '', onclick: () => this.setQuality(q) }, l)));
    this.timeline = h('div', { class: 'timeline', role: 'slider', 'aria-label': 'Timeline', tabindex: '0' });
    this.head = h('div', { class: 'head' });
    this.timeline.append(this.head);
    const seek = e => {
      const r = this.timeline.getBoundingClientRect();
      const k = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width));
      this.pause();
      this.seek(k * (this.engine?.duration || 0));
    };
    this.timeline.addEventListener('pointerdown', e => { this.timeline.setPointerCapture(e.pointerId); seek(e); const mv = ev => seek(ev); this.timeline.addEventListener('pointermove', mv); this.timeline.addEventListener('pointerup', () => this.timeline.removeEventListener('pointermove', mv), { once: true }); });
    this.timeline.addEventListener('keydown', e => {
      if (e.key === 'ArrowRight') { this.pause(); this.seek(this.t + 0.5); }
      if (e.key === 'ArrowLeft') { this.pause(); this.seek(this.t - 0.5); }
    });
    const controls = h('div', { class: 'controls' },
      h('div', { class: 'controls-row' }, this.playBtn, this.timeEl, h('div', { class: 'spacer' }), this.fmtSeg, this.qualSeg, this.soundBtn),
      this.timeline);
    return h('section', { class: 'stage-wrap', 'aria-label': 'Preview' }, this.stage, controls);
  }

  async load() {
    const p = this.store.state.project;
    if (!p) return;
    this.renderFormats();
    const first = !this.engine;
    if (first) {
      try {
        this.engine = new MotionEngine({ canvas: this.canvas, scale: this.scaleFor(p.format), quality: this.quality });
      } catch (e) {
        this.stage.replaceChildren(h('div', { style: { color: '#fff', maxWidth: '420px', textAlign: 'center', display: 'grid', gap: '8px' } },
          h('b', null, 'This browser could not start 3D graphics.'),
          h('span', null, 'Use a recent Chrome, Edge or Safari with hardware acceleration turned on. You can still fill in your content and export the project for Claude Code to render.')));
        return;
      }
    }
    this.loading = true;
    if (first) this.busy.hidden = false;
    try {
      await this.engine.load(p, { scale: this.scaleFor(p.format) });
      this.t = Math.min(this.t, this.engine.duration);
      this.engine.renderFrame(this.t);
      this.renderTimeline();
      this.fit();
      this.soundKey = '';
      this.store.emit('preview');
    } catch (e) {
      console.error(e);
      toast('The preview hit a problem with this content. Check the last change you made.', { error: true });
    }
    this.loading = false;
    this.busy.hidden = true;
  }

  scaleFor(format) {
    const f = FORMATS[format] || FORMATS['16x9'];
    const r = this.stage.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const availW = Math.max(200, r.width - 48), availH = Math.max(200, r.height - 48);
    const fit = Math.min(availW / f.w, availH / f.h);
    const cap = this.quality === 'draft' ? 0.5 : 1;
    return Math.max(0.2, Math.min(cap, fit * dpr));
  }

  fit() {
    if (!this.engine) return;
    const f = this.engine.stage.format;
    const r = this.stage.getBoundingClientRect();
    const availW = Math.max(100, r.width - 48), availH = Math.max(100, r.height - 48);
    const s = Math.min(availW / f.w, availH / f.h);
    this.canvas.style.width = `${Math.floor(f.w * s)}px`;
    this.canvas.style.height = `${Math.floor(f.h * s)}px`;
    const want = this.scaleFor(f.id);
    if (Math.abs(want - this.engine.stage.scale) / want > 0.25) { this.engine.setScale(want); }
  }

  renderFormats() {
    const p = this.store.state.project;
    this.fmtSeg.replaceChildren(...Object.values(FORMATS).map(f => h('button', {
      class: f.id === p.format ? 'on' : '', title: `${f.label} · ${f.use}`,
      onclick: () => { this.store.update(pr => { pr.format = f.id; if (!pr.formats.includes(f.id)) pr.formats = [f.id, ...pr.formats.filter(x => x !== f.id)]; }, 'structure'); },
    }, f.id.replace('x', ':'))));
  }

  renderTimeline() {
    if (!this.engine) return;
    const d = this.engine.duration;
    [...this.timeline.querySelectorAll('.blk')].forEach(b => b.remove());
    this.blocks = this.engine.timeline().map((s, i) => {
      const b = h('div', { class: 'blk', style: { left: `${(s.start / d) * 100}%`, width: `calc(${(s.dur / d) * 100}% - 3px)` }, title: s.label }, h('span', null, `${i + 1} · ${s.label}`));
      this.timeline.insertBefore(b, this.head);
      return { b, s };
    });
    this.updateHead();
    const p = this.store.state.project;
    this.note.replaceChildren(h('span', { class: 'chip' }, `${FORMATS[p.format].label} · ${FORMATS[p.format].w}×${FORMATS[p.format].h}`), h('span', { class: 'chip' }, `${d.toFixed(1)}s`));
  }

  updateHead() {
    const d = this.engine?.duration || 1;
    this.head.style.left = `${(this.t / d) * 100}%`;
    this.timeEl.textContent = `${fmtTime(this.t)} / ${fmtTime(d)}`;
    this.timeline.setAttribute('aria-valuenow', this.t.toFixed(1));
    (this.blocks || []).forEach(({ b, s }) => b.classList.toggle('cur', this.t >= s.start && this.t < s.end));
  }

  seek(t) {
    if (!this.engine) return;
    this.t = Math.max(0, Math.min(this.engine.duration - 0.001, t));
    this.engine.renderFrame(this.t);
    this.updateHead();
    this.store.state.preview.t = this.t;
    this.store.emit('time');
  }

  /** Jump to the middle of scene i (used by the Polish step). */
  seekScene(i) {
    const s = this.engine?.timeline()[i];
    if (s) { this.pause(); this.seek(s.start + Math.min(s.dur * 0.6, s.dur - 0.3)); }
  }

  toggle() { this.playing ? this.pause() : this.play(); }

  play() {
    if (!this.engine || this.playing) return;
    if (this.t >= this.engine.duration - 0.05) this.t = 0;
    this.playing = true;
    this.playBtn.replaceChildren(icon('pause'));
    this.playBtn.setAttribute('aria-label', 'Pause');
    this.last = performance.now();
    this.startSound();
    requestAnimationFrame(this.loop);
  }

  pause() {
    if (!this.playing) return;
    this.playing = false;
    this.playBtn.replaceChildren(icon('play'));
    this.playBtn.setAttribute('aria-label', 'Play');
    this.stopSound();
  }

  loop(now) {
    if (!this.playing) return;
    const dt = Math.min(0.1, (now - this.last) / 1000);
    this.last = now;
    if (!this.loading) {
      this.t += dt;
      if (this.t >= this.engine.duration) {
        this.t = 0;
        this.stopSound(); this.startSound();
      }
      this.engine.renderFrame(this.t);
      this.updateHead();
    }
    requestAnimationFrame(this.loop);
  }

  setQuality(q) {
    this.quality = q;
    this.qualSeg.querySelectorAll('button').forEach(b => b.classList.toggle('on', b.dataset.q === q));
    if (!this.engine) return;
    this.engine.stage.quality = q;
    this.engine.stage.setFormat(this.engine.project.format, this.scaleFor(this.engine.project.format));
    this.engine.rebuild();
  }

  async toggleSound() {
    this.soundOn = !this.soundOn;
    this.soundBtn.replaceChildren(icon(this.soundOn ? 'sound' : 'mute'));
    if (!this.soundOn) { this.stopSound(); return; }
    try {
      this.audioCtx = this.audioCtx || new (window.AudioContext || window.webkitAudioContext)();
      await this.audioCtx.resume();
      if (this.playing) this.startSound();
      toast('Preview sound on');
    } catch (e) { toast('This browser blocked audio playback.', { error: true }); }
  }

  async soundtrack() {
    const p = this.store.state.project;
    const key = JSON.stringify([this.engine.duration, p.audio.sfx, p.audio.sfxVolume, p.audio.musicVolume, (p.audio.music || '').length, (p.audio.voiceover || '').length, this.engine.cues().length]);
    if (key === this.soundKey && this.soundBuf) return this.soundBuf;
    const dec = d => (d ? fetch(d).then(r => r.arrayBuffer()).catch(() => null) : null);
    this.soundBuf = await renderSoundtrack({
      duration: this.engine.duration, cues: this.engine.cues(), music: await dec(p.audio.music), musicVolume: p.audio.musicVolume,
      voiceover: await dec(p.audio.voiceover), sfx: p.audio.sfx, sfxVolume: p.audio.sfxVolume,
    });
    this.soundKey = key;
    return this.soundBuf;
  }

  async startSound() {
    if (!this.soundOn || !this.audioCtx || !this.engine) return;
    try {
      const buf = await this.soundtrack();
      if (!this.playing) return;
      this.stopSound();
      const src = this.audioCtx.createBufferSource();
      src.buffer = buf;
      src.connect(this.audioCtx.destination);
      src.start(0, Math.min(this.t, buf.duration - 0.01));
      this.audioSrc = src;
    } catch (e) { /* silent preview */ }
  }

  stopSound() { try { this.audioSrc?.stop(); } catch (e) { /* already stopped */ } this.audioSrc = null; }

  snapshot(w = 320) {
    if (!this.engine) return null;
    const c = document.createElement('canvas');
    const f = this.engine.stage.format;
    c.width = w; c.height = Math.round(w * (f.h / f.w));
    c.getContext('2d').drawImage(this.canvas, 0, 0, c.width, c.height);
    return c.toDataURL('image/jpeg', 0.7);
  }
}
