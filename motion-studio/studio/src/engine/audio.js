// Soundtrack: music bed + optional voiceover + synthesized sound effects (whooshes on scene
// changes, ticks on counters, pops on reveals), rendered offline so it is frame-exact.

const SR = 48000;

/**
 * Renders the full soundtrack to an AudioBuffer.
 * music / voiceover: ArrayBuffer of an audio file (mp3, m4a, wav) or null.
 */
export async function renderSoundtrack({ duration, cues = [], music = null, musicVolume = 0.8, voiceover = null, voiceVolume = 1, sfx = true, sfxVolume = 0.6, sampleRate = SR }) {
  const len = Math.max(1, Math.ceil(duration * sampleRate));
  const ctx = new OfflineAudioContext(2, len, sampleRate);
  const master = ctx.createDynamicsCompressor();
  master.threshold.value = -14; master.ratio.value = 3; master.attack.value = 0.01; master.release.value = 0.2;
  master.connect(ctx.destination);

  let voiceBuf = null;
  if (voiceover) { try { voiceBuf = await ctx.decodeAudioData(voiceover.slice(0)); } catch (e) { voiceBuf = null; } }

  if (music) {
    try {
      const buf = await ctx.decodeAudioData(music.slice(0));
      const src = ctx.createBufferSource();
      src.buffer = buf;
      src.loop = buf.duration < duration;
      const g = ctx.createGain();
      const v = musicVolume * (voiceBuf ? 0.45 : 1);   // duck under a voiceover
      g.gain.setValueAtTime(0, 0);
      g.gain.linearRampToValueAtTime(v, 0.6);
      g.gain.setValueAtTime(v, Math.max(0.6, duration - 1.4));
      g.gain.linearRampToValueAtTime(0, duration);
      src.connect(g).connect(master);
      src.start(0);
    } catch (e) { /* undecodable music: render without it */ }
  }
  if (voiceBuf) {
    const src = ctx.createBufferSource();
    src.buffer = voiceBuf;
    const g = ctx.createGain();
    g.gain.value = voiceVolume;
    src.connect(g).connect(master);
    src.start(0.3);
  }
  if (sfx) {
    const noise = noiseBuffer(ctx, 1.5);
    for (const c of cues) {
      if (c.t < 0 || c.t > duration) continue;
      SFX[c.type]?.(ctx, master, c.t, sfxVolume, noise);
    }
  }
  return ctx.startRendering();
}

function noiseBuffer(ctx, seconds) {
  const b = ctx.createBuffer(1, Math.ceil(seconds * ctx.sampleRate), ctx.sampleRate);
  const d = b.getChannelData(0);
  let s = 1234567;
  for (let i = 0; i < d.length; i++) { s = (s * 1103515245 + 12345) & 0x7fffffff; d[i] = (s / 0x7fffffff) * 2 - 1; }
  return b;
}

const SFX = {
  whoosh(ctx, out, t, vol, noise) {
    const src = ctx.createBufferSource(); src.buffer = noise;
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = 1.2;
    bp.frequency.setValueAtTime(300, t); bp.frequency.exponentialRampToValueAtTime(3200, t + 0.32); bp.frequency.exponentialRampToValueAtTime(600, t + 0.6);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.32 * vol, t + 0.25); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.62);
    const pan = ctx.createStereoPanner(); pan.pan.setValueAtTime(-0.5, t); pan.pan.linearRampToValueAtTime(0.5, t + 0.6);
    src.connect(bp).connect(g).connect(pan).connect(out);
    src.start(t, 0, 0.7);
  },
  tick(ctx, out, t, vol) {
    const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.setValueAtTime(1500, t);
    const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.16 * vol, t + 0.004); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.06);
    o.connect(g).connect(out); o.start(t); o.stop(t + 0.08);
  },
  pop(ctx, out, t, vol) {
    const o = ctx.createOscillator(); o.type = 'sine';
    o.frequency.setValueAtTime(420, t); o.frequency.exponentialRampToValueAtTime(980, t + 0.07);
    const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.22 * vol, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.16);
    o.connect(g).connect(out); o.start(t); o.stop(t + 0.18);
  },
  rise(ctx, out, t, vol, noise) {
    const o = ctx.createOscillator(); o.type = 'triangle';
    o.frequency.setValueAtTime(180, t); o.frequency.exponentialRampToValueAtTime(520, t + 0.9);
    const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.09 * vol, t + 0.7); g.gain.exponentialRampToValueAtTime(0.0001, t + 1.05);
    o.connect(g).connect(out); o.start(t); o.stop(t + 1.1);
    const src = ctx.createBufferSource(); src.buffer = noise;
    const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.setValueAtTime(2000, t); hp.frequency.exponentialRampToValueAtTime(6000, t + 0.9);
    const g2 = ctx.createGain(); g2.gain.setValueAtTime(0.0001, t); g2.gain.exponentialRampToValueAtTime(0.07 * vol, t + 0.8); g2.gain.exponentialRampToValueAtTime(0.0001, t + 1.0);
    src.connect(hp).connect(g2).connect(out); src.start(t, 0.3, 1.1);
  },
};

/** 16-bit PCM WAV encoder for an AudioBuffer. */
export function audioBufferToWav(buf) {
  const ch = buf.numberOfChannels, sr = buf.sampleRate, n = buf.length;
  const data = new DataView(new ArrayBuffer(44 + n * ch * 2));
  const w = (o, s) => { for (let i = 0; i < s.length; i++) data.setUint8(o + i, s.charCodeAt(i)); };
  w(0, 'RIFF'); data.setUint32(4, 36 + n * ch * 2, true); w(8, 'WAVE'); w(12, 'fmt ');
  data.setUint32(16, 16, true); data.setUint16(20, 1, true); data.setUint16(22, ch, true);
  data.setUint32(24, sr, true); data.setUint32(28, sr * ch * 2, true); data.setUint16(32, ch * 2, true); data.setUint16(34, 16, true);
  w(36, 'data'); data.setUint32(40, n * ch * 2, true);
  const chans = Array.from({ length: ch }, (_, i) => buf.getChannelData(i));
  let o = 44;
  for (let i = 0; i < n; i++) for (let c = 0; c < ch; c++) { const v = Math.max(-1, Math.min(1, chans[c][i])); data.setInt16(o, v < 0 ? v * 0x8000 : v * 0x7fff, true); o += 2; }
  return new Uint8Array(data.buffer);
}
