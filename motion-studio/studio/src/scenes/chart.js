// Chart: 3D columns grow to their values with labels pinned underneath and values counting up
// above. Always carries a source / as-of line so numbers stay accountable.
import * as THREE from 'three';
import { textZone, drawHeader, popIn, worldPos } from './common.js';
import { clamp, ease, seg, parseStat, formatNumber } from '../engine/util.js';

export default {
  type: 'chart',
  label: 'Chart',
  description: '3D columns that build up with values counting, plus a source line.',
  defaults: { dur: 6, shot: 'orbit' },
  editable: [
    { key: 'eyebrow', label: 'Small label above', type: 'text' },
    { key: 'headline', label: 'Headline (the takeaway)', type: 'text' },
    { key: 'sub', label: 'Supporting line', type: 'text' },
    { key: 'source', label: 'Source and as-of date', type: 'text', data: true },
  ],
  build(ctx) {
    const { scene, group, world, stage, palette } = ctx;
    const portrait = stage.aspect < 0.95;
    const d = scene.data || {};
    const rows = (d.series || []).map(r => ({ label: r.label, raw: r.value, p: parseStat(r.value) })).filter(r => r.p).slice(0, portrait ? 6 : 8);
    const values = rows.map(r => r.p.value);
    const highlight = d.highlight ?? (rows.length ? values.indexOf(Math.max(...values)) : -1);
    const n = Math.max(1, rows.length);
    const width = portrait ? Math.min(0.75, 4.2 / n - 0.25) : Math.min(0.85, 7 / n - 0.3);
    const gap = width * 0.45;
    const maxH = portrait ? 3.2 : 2.8;
    const bars = world.bars(values.length ? values : [1], { width, gap, maxHeight: maxH, depth: width, highlight });
    bars.position.y = -maxH / 2;
    group.add(bars);
    const base = world.panel({ w: bars.userData.width + 1.2, h: 0.12, depth: width + 0.9, radius: 0.05 });
    base.rotation.x = 0;
    base.position.y = -maxH / 2 - 0.08;
    group.add(base);
    const layout = portrait ? 'stack' : 'stack';
    const grow = t => ease.outCubic(seg(t, 0.6, 1.8));

    return {
      shot: { frame: { w: bars.userData.width + 1.6, h: maxH + 1.8 }, layout, pitch: 10, fov: portrait ? 40 : 32, center: new THREE.Vector3(0, 0.2, 0) },
      cues: rows.map((_, i) => ({ t: 0.6 + i * 0.12, type: 'tick' })),
      update(lt, info) {
        const out = ease.inCubic(seg(lt, info.dur - 0.45, 0.5));
        bars.userData.set(grow(lt) * (1 - out), 0.1);
        base.scale.x = Math.max(0.001, ease.outCubic(seg(lt, 0.1, 0.7)) * (1 - out));
        base.userData.setOpacity(1 - out);
      },
      draw(o, lt, info) {
        const zone = textZone(o, layout);
        zone.layout = layout;
        drawHeader(o, zone, scene.text, lt, { dur: info.dur, size: (portrait ? 72 : 66) * o.U, maxLines: 2 });
        const a = t0 => clamp(ease.outCubic(seg(lt, t0, 0.5))) * (1 - seg(lt, info.dur - 0.45, 0.4));
        const k = grow(lt);
        bars.userData.meshes.forEach((m, i) => {
          const r = rows[i];
          if (!r) return;
          const top = worldPos(m, new THREE.Vector3(0, 0.5, 0));
          const bot = worldPos(bars, new THREE.Vector3(m.position.x, -0.15, width / 2));
          const pt = stage.project(top), pb = stage.project(bot);
          const hl = i === highlight;
          const val = formatNumber(r.p.value * k, { prefix: r.p.prefix, suffix: r.p.suffix, decimals: r.p.decimals });
          o.text(val, pt.x, pt.y - 18 * o.U, { size: (hl ? 40 : 32) * o.U, weight: 800, align: 'center', color: hl ? o.theme.accent : o.theme.text, alpha: a(0.7 + i * 0.08) });
          o.text(String(r.label || ''), pb.x, pb.y + 38 * o.U, { size: 24 * o.U, weight: 600, family: 'body', align: 'center', color: o.theme.sub, alpha: a(0.4 + i * 0.06) });
        });
        if (d.source) o.text(d.source, o.W / 2, o.H - o.safe.bottom + 10 * o.U, { size: 22 * o.U, family: 'mono', weight: 500, align: 'center', color: o.theme.sub, alpha: a(1.2) });
      },
    };
  },
};

export function chartPopIn(lt) { return popIn(lt, 0, 1); }
