// In-browser export. Frame-exact: each frame is rendered at time t and encoded (WebCodecs MP4),
// so output matches the Claude Code renderer. Also GIF, poster PNG and storyboard sheets.
import { Muxer, ArrayBufferTarget } from 'mp4-muxer';
import { GIFEncoder, quantize, applyPalette } from 'gifenc';
import { MotionEngine } from '../engine/engine.js';
import { renderSoundtrack } from '../engine/audio.js';
import { FONTS } from '../engine/brand.js';

export const canEncodeMP4 = () => typeof window.VideoEncoder === 'function' && typeof window.VideoFrame === 'function';

async function makeEngine(project, format, scale = 1, quality = 'final') {
  const canvas = document.createElement('canvas');
  const eng = new MotionEngine({ canvas, scale, quality });
  await eng.load({ ...project, format }, { scale });
  return eng;
}

const yieldUI = () => new Promise(r => setTimeout(r, 0));

async function pickCodec(w, h, fps) {
  // H.264 first (plays everywhere); VP9 / AV1 in MP4 as fallbacks for browsers without an H.264 encoder
  const cands = [
    ['avc1.640033', 'avc'], ['avc1.64002A', 'avc'], ['avc1.640028', 'avc'], ['avc1.4D0033', 'avc'], ['avc1.4D002A', 'avc'], ['avc1.42003E', 'avc'], ['avc1.42002A', 'avc'],
    ['vp09.00.41.08', 'vp9'], ['vp09.00.40.08', 'vp9'], ['av01.0.09M.08', 'av1'], ['av01.0.08M.08', 'av1'],
  ];
  for (const [codec, mux] of cands) {
    try {
      const { supported } = await VideoEncoder.isConfigSupported({ codec, width: w, height: h, bitrate: 12e6, framerate: fps });
      if (supported) return { codec, mux };
    } catch (e) { /* try next */ }
  }
  return null;
}

async function decodeData(d) { return d ? fetch(d).then(r => r.arrayBuffer()).catch(() => null) : null; }

/** Exports an MP4. onProgress(k, label). Returns a Blob. */
export async function exportMP4(project, format, { fps = 60, onProgress = () => {}, signal } = {}) {
  if (!canEncodeMP4()) throw new Error('This browser cannot encode MP4. Use Chrome or Edge, or render with Claude Code.');
  onProgress(0, 'Preparing');
  const eng = await makeEngine(project, format, 1, 'final');
  const W = eng.stage.pw, H = eng.stage.ph;
  const picked = await pickCodec(W, H, fps);
  if (!picked) throw new Error('This browser has no video encoder for this size. Try Chrome or Edge, or render with Claude Code.');
  const { codec, mux } = picked;
  const total = Math.round(eng.duration * fps);

  // Soundtrack (music, voiceover, sound effects)
  const p = project;
  let audioBuf = null;
  const wantAudio = p.audio?.sfx || p.audio?.music || p.audio?.voiceover;
  let audioCfg = null;
  if (wantAudio && typeof window.AudioEncoder === 'function') {
    onProgress(0, 'Mixing sound');
    audioBuf = await renderSoundtrack({ duration: eng.duration, cues: eng.cues(), music: await decodeData(p.audio.music), musicVolume: p.audio.musicVolume, voiceover: await decodeData(p.audio.voiceover), sfx: p.audio.sfx, sfxVolume: p.audio.sfxVolume });
    // AAC where the browser has an encoder (Chrome and Edge on Windows and Mac), otherwise Opus
    for (const [codec, muxCodec] of [['mp4a.40.2', 'aac'], ['opus', 'opus']]) {
      const cfg = { codec, sampleRate: audioBuf.sampleRate, numberOfChannels: 2, bitrate: 192000 };
      try { if ((await AudioEncoder.isConfigSupported(cfg)).supported) { audioCfg = { ...cfg, muxCodec }; break; } } catch (e) { /* try next */ }
    }
  }

  const target = new ArrayBufferTarget();
  const muxer = new Muxer({
    target, fastStart: 'in-memory', firstTimestampBehavior: 'offset',
    video: { codec: mux, width: W, height: H, frameRate: fps },
    audio: audioCfg ? { codec: audioCfg.muxCodec, sampleRate: audioCfg.sampleRate, numberOfChannels: 2 } : undefined,
  });
  let encErr = null;
  const enc = new VideoEncoder({ output: (chunk, meta) => muxer.addVideoChunk(chunk, meta), error: e => { encErr = e; } });
  enc.configure({ codec, width: W, height: H, bitrate: Math.round(W * H * fps * 0.11), framerate: fps, latencyMode: 'quality' });
  const frameDur = Math.round(1e6 / fps);
  for (let i = 0; i < total; i++) {
    if (signal?.aborted) { enc.close(); eng.dispose(); throw new DOMException('Export cancelled', 'AbortError'); }
    if (encErr) throw encErr;
    eng.renderFrame(i / fps);
    const frame = new VideoFrame(eng.canvas, { timestamp: i * frameDur, duration: frameDur });
    enc.encode(frame, { keyFrame: i % (fps * 2) === 0 });
    frame.close();
    if (enc.encodeQueueSize > 4) await new Promise(r => { const chk = () => (enc.encodeQueueSize > 2 ? setTimeout(chk, 1) : r()); chk(); });
    if (i % 6 === 0) { onProgress(i / total, `Rendering frame ${i + 1} of ${total}`); await yieldUI(); }
  }
  await enc.flush();
  enc.close();

  if (audioCfg && audioBuf) {
    onProgress(1, 'Encoding sound');
    const aenc = new AudioEncoder({ output: (chunk, meta) => muxer.addAudioChunk(chunk, meta), error: e => { encErr = e; } });
    aenc.configure({ codec: audioCfg.codec, sampleRate: audioCfg.sampleRate, numberOfChannels: 2, bitrate: audioCfg.bitrate });
    const sr = audioBuf.sampleRate, N = audioBuf.length, CH = 1024 * 4;
    const L = audioBuf.getChannelData(0), R = audioBuf.getChannelData(Math.min(1, audioBuf.numberOfChannels - 1));
    for (let o = 0; o < N; o += CH) {
      const n = Math.min(CH, N - o);
      const data = new Float32Array(n * 2);
      data.set(L.subarray(o, o + n), 0);
      data.set(R.subarray(o, o + n), n);
      const ad = new AudioData({ format: 'f32-planar', sampleRate: sr, numberOfFrames: n, numberOfChannels: 2, timestamp: Math.round((o / sr) * 1e6), data });
      aenc.encode(ad);
      ad.close();
    }
    await aenc.flush();
    aenc.close();
  }
  muxer.finalize();
  eng.dispose();
  const notes = [];
  if (mux !== 'avc') notes.push('this browser has no H.264 encoder, so the video uses VP9/AV1');
  if (wantAudio && !audioCfg) notes.push('this browser cannot encode sound, so the video is silent');
  onProgress(1, notes.length ? `Done. Note: ${notes.join('; ')}. For the widest compatibility, render with Claude Code.` : 'Done');
  const blob = new Blob([target.buffer], { type: 'video/mp4' });
  blob.codec = mux;
  blob.silent = !!(wantAudio && !audioCfg);
  return blob;
}

/** Animated GIF (15 fps, smaller size) for Slack and email. */
export async function exportGIF(project, format, { fps = 15, width = null, onProgress = () => {}, signal } = {}) {
  const eng = await makeEngine(project, format, 0.5, 'final');
  const W0 = eng.stage.pw, H0 = eng.stage.ph;
  const w = width || (format === '16x9' ? 720 : 480);
  const hgt = Math.round(w * (H0 / W0));
  const c = document.createElement('canvas'); c.width = w; c.height = hgt;
  const x = c.getContext('2d', { willReadFrequently: true });
  const gif = GIFEncoder();
  const total = Math.round(eng.duration * fps);
  for (let i = 0; i < total; i++) {
    if (signal?.aborted) { eng.dispose(); throw new DOMException('Export cancelled', 'AbortError'); }
    eng.renderFrame(i / fps);
    x.drawImage(eng.canvas, 0, 0, w, hgt);
    const { data } = x.getImageData(0, 0, w, hgt);
    const palette = quantize(data, 256, { format: 'rgb565' });
    const index = applyPalette(data, palette, 'rgb565');
    gif.writeFrame(index, w, hgt, { palette, delay: Math.round(1000 / fps) });
    if (i % 3 === 0) { onProgress(i / total, `GIF frame ${i + 1} of ${total}`); await yieldUI(); }
  }
  gif.finish();
  eng.dispose();
  return new Blob([gif.bytes()], { type: 'image/gif' });
}

function posterTime(eng) {
  const tl = eng.timeline();
  const s = tl.find(x => x.type === 'hero' || x.type === 'property' || x.type === 'intro') || tl[0];
  return s.start + Math.min(s.dur * 0.65, s.dur - 0.4);
}

export async function exportPoster(project, format) {
  const eng = await makeEngine(project, format, 1, 'final');
  eng.renderFrame(posterTime(eng));
  const blob = await new Promise(r => eng.canvas.toBlob(r, 'image/png'));
  eng.dispose();
  return blob;
}

/** A contact sheet of every scene, labelled, for review and approvals. */
export async function exportStoryboard(project, format, { onProgress = () => {} } = {}) {
  const eng = await makeEngine(project, format, 0.5, 'final');
  const tl = eng.timeline();
  const cols = format === '16x9' ? 3 : 4;
  const tw = format === '16x9' ? 560 : 340;
  const th = Math.round(tw * (eng.stage.ph / eng.stage.pw));
  const pad = 28, labelH = 44, headH = 110;
  const rows = Math.ceil(tl.length / cols);
  const c = document.createElement('canvas');
  c.width = cols * tw + (cols + 1) * pad;
  c.height = headH + rows * (th + labelH) + (rows + 1) * pad;
  const x = c.getContext('2d');
  x.fillStyle = '#F6F4F1'; x.fillRect(0, 0, c.width, c.height);
  x.fillStyle = '#111111'; x.font = `800 34px ${FONTS.display}`; x.fillText(project.name || 'Storyboard', pad, 58);
  x.fillStyle = '#5D626B'; x.font = `500 18px ${FONTS.body}`;
  x.fillText(`${tl.length} scenes · ${eng.duration.toFixed(1)}s · ${format.replace('x', ':')} · Redfin Powered by Rocket Creative Studio`, pad, 90);
  for (let i = 0; i < tl.length; i++) {
    const s = tl[i];
    eng.renderFrame(s.start + Math.min(s.dur * 0.62, s.dur - 0.4));
    const col = i % cols, row = Math.floor(i / cols);
    const px = pad + col * (tw + pad), py = headH + pad + row * (th + labelH + pad);
    x.drawImage(eng.canvas, px, py, tw, th);
    x.fillStyle = '#DE3341'; x.font = `700 15px ${FONTS.mono}`; x.fillText(String(i + 1).padStart(2, '0'), px, py + th + 28);
    x.fillStyle = '#111111'; x.font = `700 17px ${FONTS.body}`; x.fillText(`${s.label}`, px + 34, py + th + 28);
    x.fillStyle = '#8A8E96'; x.font = `500 14px ${FONTS.mono}`; x.textAlign = 'right'; x.fillText(`${s.start.toFixed(1)}–${s.end.toFixed(1)}s`, px + tw, py + th + 28); x.textAlign = 'left';
    onProgress((i + 1) / tl.length, `Scene ${i + 1} of ${tl.length}`);
    await yieldUI();
  }
  eng.dispose();
  return new Promise(r => c.toBlob(r, 'image/png'));
}
