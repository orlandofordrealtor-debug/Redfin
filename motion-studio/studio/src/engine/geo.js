// Geometry builders: extruded type from real font outlines, the extruded Redfin mark,
// and rounded slabs for cards and panels.
import * as THREE from 'three';
import { SVGLoader } from 'three/examples/jsm/loaders/SVGLoader.js';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import GLYPHS from '../data/glyphs.json';
import { LOGO_SVGS } from './brand.js';

const glyphCache = new Map();

function glyphShapes(ch) {
  if (glyphCache.has(ch)) return glyphCache.get(ch);
  const g = GLYPHS.glyphs[ch] || GLYPHS.glyphs['?'];
  const sp = new THREE.ShapePath();
  for (const c of g.p) {
    switch (c[0]) {
      case 'M': sp.moveTo(c[1], c[2]); break;
      case 'L': sp.lineTo(c[1], c[2]); break;
      case 'Q': sp.quadraticCurveTo(c[1], c[2], c[3], c[4]); break;
      case 'C': sp.bezierCurveTo(c[1], c[2], c[3], c[4], c[5], c[6]); break;
      default: break;
    }
  }
  sp.userData = { style: { fillRule: 'nonzero' } };
  const shapes = SVGLoader.createShapes(sp);
  const out = { shapes, advance: g.a };
  glyphCache.set(ch, out);
  return out;
}

/**
 * Extruded text from the display font. size = cap height in world units.
 * Returns a centered BufferGeometry and its width.
 */
export function textGeometry(str, { size = 1, depth = 0.25, bevel = 0.03, curveSegments = 6, tracking = -0.02, bevelSegments = 4 } = {}) {
  const scale = size / GLYPHS.capHeight;
  const geos = [];
  let x = 0;
  for (const ch of String(str)) {
    if (ch === ' ') { x += GLYPHS.glyphs[' '].a * scale; continue; }
    const { shapes, advance } = glyphShapes(ch);
    if (shapes.length) {
      const geo = new THREE.ExtrudeGeometry(shapes, {
        depth: depth / scale, bevelEnabled: bevel > 0, bevelThickness: bevel / scale, bevelSize: (bevel * 0.8) / scale,
        bevelSegments, curveSegments,
      });
      geo.scale(scale, scale, scale);
      geo.translate(x, 0, 0);
      geos.push(geo);
    }
    x += advance * scale + tracking * size;
  }
  const merged = mergeGeometries(geos);
  merged.computeBoundingBox();
  const bb = merged.boundingBox;
  merged.translate(-(bb.min.x + bb.max.x) / 2, -size / 2, -depth / 2);
  merged.computeVertexNormals();
  return { geometry: merged, width: bb.max.x - bb.min.x, height: size };
}

/** Extrudes paths from one of the official logo SVGs. Returns a Group of meshes per fill color. */
export function logoMesh(key, { height = 1, depth = 0.12, bevel = 0.012, materials = {}, onlyClass = null, paths = null, maxX = null } = {}) {
  const data = new SVGLoader().parse(LOGO_SVGS[key]);
  const group = new THREE.Group();
  const byColor = new Map();
  for (const [pi, path] of data.paths.entries()) {
    if (paths && !paths.includes(pi)) continue;
    const fill = path.userData?.style?.fill;
    if (!fill || fill === 'none') continue;
    const color = new THREE.Color().setStyle(fill).getHexString();
    if (onlyClass && !onlyClass.includes('#' + color)) continue;
    let shapes = SVGLoader.createShapes(path);
    // keep only shapes left of maxX (in SVG units), e.g. the circular mark without the letters
    if (maxX !== null) shapes = shapes.filter(sh => Math.max(...sh.getPoints().map(pt => pt.x)) <= maxX);
    if (!shapes.length) continue;
    if (!byColor.has(color)) byColor.set(color, []);
    byColor.get(color).push(...shapes);
  }
  const all = [];
  for (const [color, shapes] of byColor) {
    const geo = new THREE.ExtrudeGeometry(shapes, { depth, bevelEnabled: bevel > 0, bevelThickness: bevel, bevelSize: bevel * 0.8, bevelSegments: 3, curveSegments: 10 });
    const mat = materials['#' + color] || materials.default || new THREE.MeshStandardMaterial({ color: '#' + color });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.castShadow = true;
    group.add(mesh);
    all.push(geo);
  }
  // SVG space is y-down and in px; normalize to the requested height and center
  const box = new THREE.Box3();
  all.forEach(g => { g.computeBoundingBox(); box.union(g.boundingBox); });
  const s = height / (box.max.y - box.min.y);
  const cx = (box.min.x + box.max.x) / 2, cy = (box.min.y + box.max.y) / 2;
  group.children.forEach(m => {
    m.geometry.translate(-cx, -cy, -depth / 2);
    m.geometry.scale(s, -s, s);
    m.geometry.computeVertexNormals();
    flipWinding(m.geometry);
  });
  group.userData.width = (box.max.x - box.min.x) * s;
  group.userData.height = height;
  return group;
}

/** Mirroring with a negative scale flips triangle winding; restore it so faces render outward. */
function flipWinding(geo) {
  const idx = geo.index;
  if (idx) {
    const a = idx.array;
    for (let i = 0; i < a.length; i += 3) { const t = a[i]; a[i] = a[i + 2]; a[i + 2] = t; }
    idx.needsUpdate = true;
  } else {
    const pos = geo.attributes.position;
    const attrs = Object.values(geo.attributes);
    for (const attr of attrs) {
      const arr = attr.array, n = attr.itemSize;
      for (let i = 0; i < pos.count; i += 3) {
        for (let k = 0; k < n; k++) { const t = arr[i * n + k]; arr[i * n + k] = arr[(i + 2) * n + k]; arr[(i + 2) * n + k] = t; }
      }
      attr.needsUpdate = true;
    }
  }
  geo.computeVertexNormals();
}

export function slab(w, h, d, r = 0.06, segments = 4) {
  return new RoundedBoxGeometry(w, h, d, segments, Math.min(r, w / 2, h / 2, d / 2));
}

/** Rounded-rectangle plane (for image faces) with UVs mapped 0..1. */
export function roundedPlane(w, h, r = 0.08, segments = 8) {
  const s = new THREE.Shape();
  const x = -w / 2, y = -h / 2;
  const rr = Math.min(r, w / 2, h / 2);
  s.moveTo(x + rr, y);
  s.lineTo(x + w - rr, y);
  s.quadraticCurveTo(x + w, y, x + w, y + rr);
  s.lineTo(x + w, y + h - rr);
  s.quadraticCurveTo(x + w, y + h, x + w - rr, y + h);
  s.lineTo(x + rr, y + h);
  s.quadraticCurveTo(x, y + h, x, y + h - rr);
  s.lineTo(x, y + rr);
  s.quadraticCurveTo(x, y, x + rr, y);
  const geo = new THREE.ShapeGeometry(s, segments);
  const uv = geo.attributes.uv, pos = geo.attributes.position;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, (pos.getX(i) - x) / w, (pos.getY(i) - y) / h);
  return geo;
}

export function mergeGeometries(geos) {
  if (geos.length === 1) return geos[0];
  if (!geos.length) return new THREE.BufferGeometry();
  // ExtrudeGeometry is non-indexed with position/normal/uv; concatenate attributes
  const names = ['position', 'normal', 'uv'];
  const out = new THREE.BufferGeometry();
  for (const name of names) {
    const parts = geos.map(g => g.attributes[name]).filter(Boolean);
    if (parts.length !== geos.length) continue;
    const n = parts[0].itemSize;
    const total = parts.reduce((s, a) => s + a.count, 0);
    const arr = new Float32Array(total * n);
    let off = 0;
    for (const a of parts) { arr.set(a.array, off); off += a.array.length; }
    out.setAttribute(name, new THREE.BufferAttribute(arr, n));
  }
  geos.forEach(g => g.dispose());
  return out;
}
