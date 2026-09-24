import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

// P07 lived-in clutter pass. After the hero pieces are placed, every "host" (worktop, shelf, nightstand, vanity, ...)
// is probed with downward rays to find its horizontal surfaces (every shelf level, with the free height above it).
// A recipe per host kind then scatters small props onto those surfaces: rows of books filling shelves, jars, mugs,
// toiletries, glasses, phones, clothes. Every prop kind is ONE InstancedMesh per part per floor level. Nothing here
// casts shadows, and nothing collides.

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);

// ------------------------------------------------------------------------------------------ prop geometry
// A part is a merged geometry with vertex colours (position, normal, color only). Tinted parts are
// multiplied per instance by instanceColor.
function paint(geo, hex) {
  const g = geo.index ? geo : geo;
  g.deleteAttribute('uv');
  if (g.attributes.uv1) g.deleteAttribute('uv1');
  const c = new THREE.Color(hex);
  const n = g.attributes.position.count, a = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { a[i * 3] = c.r; a[i * 3 + 1] = c.g; a[i * 3 + 2] = c.b; }
  g.setAttribute('color', new THREE.BufferAttribute(a, 3));
  return g.index ? g : g;
}
const idx = (g) => (g.index ? g : (() => { const n = g.attributes.position.count; const a = new Uint32Array(n); for (let i = 0; i < n; i++) a[i] = i; g.setIndex(new THREE.BufferAttribute(a, 1)); return g; })());
const merge = (...gs) => mergeGeometries(gs.map(idx), false);
const cyl = (r, h, hex, { y = 0, x = 0, z = 0, seg = 14, r2 = null, open = false } = {}) => {
  const g = new THREE.CylinderGeometry(r2 ?? r, r, h, seg, 1, open); g.translate(x, y + h / 2, z); return paint(g, hex);
};
const bx = (w, h, d, hex, { x = 0, y = 0, z = 0, r = 0 } = {}) => {
  const g = r ? new RoundedBoxGeometry(w, h, d, 1, Math.min(r, w / 2 - 1e-4, h / 2 - 1e-4, d / 2 - 1e-4)) : new THREE.BoxGeometry(w, h, d);
  g.translate(x, y + h / 2, z); return paint(g, hex);
};
const lathe = (prof, hex, seg = 16) => paint(new THREE.LatheGeometry(prof.map(([r, y]) => new THREE.Vector2(r, y)), seg), hex);
const torus = (R, r, hex, { x = 0, y = 0, z = 0, arc = Math.PI * 2, rx = 0, ry = 0 } = {}) => {
  const g = new THREE.TorusGeometry(R, r, 5, 12, arc); g.rotateX(rx); g.rotateY(ry); g.translate(x, y, z); return paint(g, hex);
};
const sphere = (r, hex, { x = 0, y = 0, z = 0, sy = 1 } = {}) => { const g = new THREE.IcosahedronGeometry(r, 1); g.scale(1, sy, 1); g.translate(x, y, z); return paint(g, hex); };

// Prop kinds: parts [{ geo, mat, tint }], fp = footprint radius (m), h = height, palette = instance tint colours.
const WHITE = '#ffffff';
function defs() {
  const D = {};
  D.book = { fp: 0.1, h: 1, parts: [{ geo: bx(1, 1, 1, WHITE, { r: 0.002 }), mat: 'cloth', tint: true }],
    palette: ['#7a2e26', '#2d4a6b', '#d8cfb8', '#3f5a3c', '#b8892f', '#1f1f22', '#8c6d5a', '#5a6b7a', '#a8543a', '#e3ddd0', '#40324a', '#6f7b5a', '#c9b48a', '#23403a'] };
  D.mug = { fp: 0.055, h: 0.095, parts: [{ geo: merge(lathe([[0.001, 0], [0.036, 0], [0.04, 0.01], [0.04, 0.095], [0.036, 0.095], [0.035, 0.012], [0.001, 0.012]], WHITE, 18),
    torus(0.026, 0.006, WHITE, { arc: Math.PI }).rotateZ(-Math.PI / 2).translate(0.04, 0.05, 0)), mat: 'glaze', tint: true }],
    palette: ['#f1eee8', '#2f4f5f', '#c46f4d', '#e0d4b8', '#3a3a3a', '#8aa08a', '#d9b44a'] };
  D.jar = { fp: 0.05, h: 0.17, parts: [
    { geo: cyl(0.045, 0.15, WHITE, { seg: 16 }), mat: 'glaze', tint: true },
    { geo: cyl(0.047, 0.025, '#b7925e', { y: 0.148, seg: 16 }), mat: 'wood', tint: false }],
    palette: ['#e9d7a6', '#c77f3d', '#8e5a36', '#f3efe6', '#b7a27a', '#6e3b2a', '#d9c47a'] };
  D.bottle = { fp: 0.04, h: 0.3, parts: [
    { geo: lathe([[0.001, 0], [0.032, 0], [0.034, 0.01], [0.034, 0.2], [0.014, 0.25], [0.013, 0.28], [0.001, 0.28]], WHITE, 14), mat: 'glass', tint: true },
    { geo: cyl(0.0145, 0.025, '#1c1c1c', { y: 0.275, seg: 10 }), mat: 'std', tint: false }],
    palette: ['#3a5a2a', '#6b4a1c', '#d8c690', '#2a1a14', '#7a8a3a', '#b0c8b8'] };
  D.crock = { fp: 0.07, h: 0.34, parts: [
    { geo: cyl(0.06, 0.16, WHITE, { seg: 18 }), mat: 'glaze', tint: true },
    { geo: merge(...[[-0.02, 0.01, 0.1], [0.02, -0.01, -0.12], [0.0, 0.025, 0.05], [-0.015, -0.02, -0.03], [0.022, 0.02, 0.0]].map(([x, z, t]) => {
      const g = merge(cyl(0.006, 0.3, '#b08a5a', { seg: 6 }), sphere(0.02, '#b08a5a', { y: 0.31, sy: 0.4 })); g.rotateZ(t); g.translate(x, 0.02, z); return g;
    })), mat: 'wood', tint: false }],
    palette: ['#e9e4d8', '#4a5a6a', '#8a4a30', '#2e2e2e'] };
  D.knifeblock = { fp: 0.09, h: 0.3, parts: [{ geo: (() => {
    const b = bx(0.11, 0.22, 0.16, '#8a6242', { r: 0.008 }); b.rotateX(-0.35); b.translate(0, 0.02, 0.03);
    const hs = [-0.03, 0, 0.03].map((x, i) => { const h = bx(0.018, 0.11, 0.024, '#1a1a1a', { r: 0.006 }); h.rotateX(-0.35); h.translate(x, 0.2 + i * 0.005, -0.03); return h; });
    return merge(b, ...hs); })(), mat: 'std', tint: false }] };
  D.dishrack = { fp: 0.2, h: 0.2, parts: [{ geo: merge(bx(0.4, 0.02, 0.3, '#d4d6d8'),
    ...[-0.12, -0.08, -0.04, 0, 0.04].map((x) => { const g = cyl(0.12, 0.012, '#f1efe9', { seg: 20 }); g.rotateZ(Math.PI / 2 - 0.12); g.translate(x, 0.13, -0.03); return g; }),
    ...[0.1, 0.15].map((x) => cyl(0.035, 0.1, '#e9e6de', { x, y: 0.02, z: 0.07, seg: 12 }))), mat: 'glaze', tint: false }] };
  D.platestack = { fp: 0.13, h: 0.06, parts: [{ geo: merge(...[0, 1, 2, 3, 4, 5].map((i) => lathe([[0.001, i * 0.009], [0.08, i * 0.009], [0.125, i * 0.009 + 0.018], [0.12, i * 0.009 + 0.02], [0.075, i * 0.009 + 0.006], [0.001, i * 0.009 + 0.006]], WHITE, 22))), mat: 'glaze', tint: true }],
    palette: ['#f3f1ec', '#dfe6e8', '#e8dccb'] };
  D.plate = { fp: 0.14, h: 0.025, parts: [{ geo: lathe([[0.001, 0], [0.085, 0], [0.135, 0.018], [0.13, 0.02], [0.08, 0.006], [0.001, 0.006]], WHITE, 24), mat: 'glaze', tint: true }], palette: ['#f3f1ec', '#e8dccb'] };
  D.glass = { fp: 0.04, h: 0.11, parts: [{ geo: lathe([[0.001, 0], [0.032, 0], [0.036, 0.11], [0.033, 0.11], [0.029, 0.01], [0.001, 0.01]], '#dfe8ec', 14), mat: 'glass', tint: false }] };
  D.spicerack = { fp: 0.2, h: 0.2, parts: [{ geo: merge(bx(0.36, 0.015, 0.09, '#9a7248'), bx(0.36, 0.015, 0.09, '#9a7248', { y: 0.1 }), bx(0.36, 0.2, 0.012, '#9a7248', { z: -0.04 }),
    ...[0, 1].flatMap((row) => [0, 1, 2, 3, 4].map((i) => merge(cyl(0.02, 0.07, '#e8e2d2', { x: -0.14 + i * 0.07, y: 0.015 + row * 0.1, seg: 10 }),
      cyl(0.021, 0.012, ['#b33a1c', '#d99b2b', '#5a6b2a', '#6e3b22', '#c8c0a8'][(i + row * 2) % 5], { x: -0.14 + i * 0.07, y: 0.085 + row * 0.1, seg: 10 }))))), mat: 'std', tint: false }] };
  D.towel = { fp: 0.14, h: 0.05, parts: [{ geo: merge(bx(0.26, 0.022, 0.18, WHITE, { r: 0.01 }), bx(0.25, 0.022, 0.175, WHITE, { r: 0.01, y: 0.02 })), mat: 'cloth', tint: true }],
    palette: ['#f2efe8', '#8ea0ad', '#c9b8a0', '#55585c', '#a8563c', '#d6d9c9'] };
  D.phone = { fp: 0.06, h: 0.01, parts: [{ geo: merge(bx(0.075, 0.008, 0.155, '#1c1c1e', { r: 0.004 }), bx(0.068, 0.001, 0.145, '#0b0d12', { y: 0.008 })), mat: 'gloss', tint: false }] };
  D.spectacles = { fp: 0.07, h: 0.03, parts: [{ geo: merge(torus(0.024, 0.0025, '#2a2320', { x: -0.03, y: 0.022, rx: 1.3 }), torus(0.024, 0.0025, '#2a2320', { x: 0.03, y: 0.022, rx: 1.3 }),
    bx(0.014, 0.003, 0.003, '#2a2320', { y: 0.022 }), bx(0.003, 0.003, 0.12, '#2a2320', { x: -0.055, y: 0.01, z: 0.06 }), bx(0.003, 0.003, 0.12, '#2a2320', { x: 0.055, y: 0.01, z: 0.06 })), mat: 'gloss', tint: false }] };
  D.remote = { fp: 0.1, h: 0.02, parts: [{ geo: merge(bx(0.05, 0.018, 0.18, '#1d1d1f', { r: 0.008 }), ...[0, 1, 2, 3].map((i) => bx(0.012, 0.004, 0.01, '#5a5a5e', { x: (i % 2 - 0.5) * 0.02, y: 0.017, z: -0.04 + Math.floor(i / 2) * 0.03 }))), mat: 'std', tint: false }] };
  D.candle = { fp: 0.04, h: 0.2, parts: [{ geo: merge(cyl(0.035, 0.09, '#b6b0a6', { seg: 14 }), cyl(0.028, 0.15, '#f1ebdd', { y: 0.005, seg: 14 }), cyl(0.002, 0.012, '#111', { y: 0.155, seg: 4 })), mat: 'glaze', tint: false }] };
  D.soap = { fp: 0.04, h: 0.19, parts: [
    { geo: cyl(0.036, 0.14, WHITE, { seg: 14 }), mat: 'glaze', tint: true },
    { geo: merge(cyl(0.012, 0.03, '#c9c9c9', { y: 0.14, seg: 8 }), bx(0.012, 0.012, 0.05, '#c9c9c9', { y: 0.165, z: 0.02 })), mat: 'metal', tint: false }],
    palette: ['#2f3a3a', '#e8e2d6', '#6f7f6a', '#a8826a'] };
  D.toiletry = { fp: 0.045, h: 0.2, parts: [
    { geo: bx(0.07, 0.17, 0.04, WHITE, { r: 0.015 }), mat: 'glaze', tint: true },
    { geo: cyl(0.016, 0.03, '#f1f1ef', { y: 0.165, seg: 10 }), mat: 'std', tint: false }],
    palette: ['#e7e1d3', '#2b5a74', '#d6a14a', '#5d7f68', '#b54a3a', '#f0eee9', '#7a6a9a', '#1f1f1f'] };
  D.toothcup = { fp: 0.04, h: 0.19, parts: [{ geo: merge(cyl(0.035, 0.1, '#dfe4e6', { seg: 14 }),
    (() => { const g = merge(cyl(0.004, 0.18, '#3c7ab8', { seg: 5 }), bx(0.01, 0.025, 0.012, '#f2f2f2', { y: 0.165 })); g.rotateZ(0.2); g.translate(0.01, 0.01, 0); return g; })(),
    (() => { const g = merge(cyl(0.004, 0.18, '#e0784a', { seg: 5 }), bx(0.01, 0.025, 0.012, '#f2f2f2', { y: 0.165 })); g.rotateZ(-0.15); g.translate(-0.01, 0.01, 0.005); return g; })()), mat: 'glaze', tint: false }] };
  D.bathmat = { fp: 0.35, h: 0.012, floor: true, parts: [{ geo: bx(0.8, 0.012, 0.5, WHITE, { r: 0.005 }), mat: 'cloth', tint: true }], palette: ['#e8e4dc', '#8a9aa6', '#c9bda6', '#5f6b62'] };
  D.storebox = { fp: 0.14, h: 0.18, parts: [{ geo: merge(bx(0.3, 0.18, 0.24, WHITE, { r: 0.006 }), bx(0.31, 0.03, 0.25, WHITE, { r: 0.006, y: 0.16 })), mat: 'cloth', tint: true }],
    palette: ['#b08a5c', '#d8cfbf', '#5a6b73', '#8a9a7f', '#2f2f31', '#c2a57a'] };
  D.tin = { fp: 0.06, h: 0.16, parts: [{ geo: merge(cyl(0.055, 0.15, WHITE, { seg: 16 }), cyl(0.056, 0.012, '#bdbdbd', { y: 0.145, seg: 16 })), mat: 'metal', tint: true }],
    palette: ['#c7c9cc', '#b3372c', '#2e5a8a', '#e3c24a', '#3b6b3f'] };
  D.herbpot = { fp: 0.07, h: 0.22, parts: [{ geo: merge(lathe([[0.001, 0], [0.045, 0], [0.058, 0.11], [0.062, 0.12], [0.001, 0.12]], '#b8674a', 14),
    ...[[0, 0.17, 0, 0.06], [0.03, 0.15, 0.02, 0.045], [-0.03, 0.16, -0.01, 0.05], [0.0, 0.2, -0.02, 0.04]].map(([x, y, z, r]) => sphere(r, '#4f7a3a', { x, y, z, sy: 0.8 }))), mat: 'std', tint: false }] };
  D.clothes = { fp: 0.22, h: 0.1, parts: [{ geo: merge(bx(0.42, 0.035, 0.34, WHITE, { r: 0.015 }),
    (() => { const g = bx(0.38, 0.03, 0.3, WHITE, { r: 0.014 }); g.rotateY(0.3); g.translate(0.03, 0.03, 0.02); return g; })(),
    (() => { const g = bx(0.36, 0.03, 0.26, WHITE, { r: 0.013 }); g.rotateY(-0.2); g.translate(-0.02, 0.058, -0.01); return g; })()), mat: 'cloth', tint: true }],
    palette: ['#2f3e56', '#c8c0b0', '#6b2f2a', '#3d3d40', '#8a9a7a', '#d7c29a'] };
  D.magazine = { fp: 0.13, h: 0.008, parts: [{ geo: bx(0.21, 0.006, 0.28, WHITE), mat: 'gloss', tint: true }], palette: ['#d9d2c0', '#b83a2e', '#2f4a6a', '#e8c85a', '#f2f0ea'] };
  D.bowl = { fp: 0.09, h: 0.07, parts: [{ geo: lathe([[0.001, 0], [0.04, 0], [0.085, 0.06], [0.08, 0.065], [0.035, 0.008], [0.001, 0.008]], WHITE, 18), mat: 'glaze', tint: true }], palette: ['#e8e0d0', '#3c5a6a', '#b86a4a'] };
  D.detergent = { fp: 0.08, h: 0.28, parts: [{ geo: merge(bx(0.14, 0.24, 0.09, WHITE, { r: 0.02 }), cyl(0.025, 0.04, '#f0f0f0', { y: 0.24, x: 0.035, seg: 10 })), mat: 'std', tint: true }], palette: ['#2a6fb0', '#e36a2a', '#f0f0ee', '#6ab04a'] };
  return D;
}

// Recipes: [kind, count, zone] (zone: 'back' | 'front' | 'any' | 'top' ); special entries handled in code.
const RECIPES = {
  worktop: { shelves: false, items: [['jar', 6, 'back'], ['crock', 1, 'back'], ['knifeblock', 1, 'back'], ['spicerack', 1, 'back'], ['bottle', 5, 'back'],
    ['tin', 3, 'back'], ['herbpot', 2, 'back'], ['mug', 4, 'any'], ['glass', 3, 'any'], ['platestack', 1, 'any'], ['dishrack', 1, 'any'], ['towel', 1, 'front'],
    ['bowl', 2, 'any'], ['candle', 1, 'back'], ['bookrow', 1, 'back'], ['booklie', 2, 'any']] },
  island: { items: [['mug', 3, 'any'], ['glass', 2, 'any'], ['booklie', 2, 'any'], ['magazine', 1, 'any'], ['candle', 2, 'any'], ['bottle', 2, 'any'], ['bowl', 1, 'any'], ['phone', 1, 'any']] },
  shelves: { fill: 'books', items: [] },
  shelves_storage: { fill: 'storage', items: [] },
  nightstand: { items: [['booklie', 3, 'any'], ['spectacles', 1, 'any'], ['phone', 1, 'any'], ['glass', 1, 'any'], ['mug', 1, 'any']] },
  console: { items: [['booklie', 3, 'any'], ['candle', 2, 'any'], ['storebox', 1, 'any'], ['magazine', 1, 'any'], ['bowl', 1, 'any']] },
  coffee: { items: [['remote', 1, 'any'], ['magazine', 2, 'any'], ['mug', 2, 'any'], ['candle', 1, 'any'], ['spectacles', 1, 'any']] },
  sidetable: { items: [['booklie', 2, 'any'], ['glass', 1, 'any'], ['mug', 1, 'any']] },
  desk: { items: [['mug', 1, 'any'], ['magazine', 2, 'any'], ['booklie', 3, 'any'], ['phone', 1, 'any'], ['glass', 1, 'any'], ['spectacles', 1, 'any'], ['storebox', 1, 'back']] },
  dining: { items: [['plate', 6, 'any'], ['glass', 6, 'any'], ['bottle', 1, 'any'], ['magazine', 1, 'any']] },
  vanity: { items: [['soap', 1, 'any'], ['toiletry', 4, 'any'], ['toothcup', 1, 'any'], ['towel', 1, 'any'], ['candle', 1, 'any'], ['jar', 1, 'any']], mat: true },
  tub: { items: [], mat: true },
  washer: { items: [['detergent', 1, 'any'], ['towel', 2, 'any']] },
  bed: { items: [['clothes', 1, 'any'], ['booklie', 1, 'any'], ['magazine', 1, 'any']] },
  chair: { items: [['clothes', 1, 'any']] },
  stool: { items: [['towel', 1, 'any'], ['toiletry', 1, 'any']] },
};
const BEDROOMS = new Set(['master', 'bed2', 'bed3']);
function hostKind(p) {
  const it = p.item, n = it.proc || it.model, room = p.room;
  if (n === 'kitchen_run') return 'worktop';
  if (n === 'kitchen_island') return 'island';
  if (n === 'media_wall' || n === 'shelf_unit' || n === 'wall_shelves') return 'shelves';
  if (n === 'garage_shelves_steel_narrow') return 'shelves_storage';
  if (n === 'cabinet') return BEDROOMS.has(room) ? 'nightstand' : 'console';
  if (n === 'coffee_table_round_marble') return 'coffee';
  if (n === 'side_table_oak' || n === 'side_table_tall') return 'sidetable';
  if (n === 'table') return room === 'dining' ? 'dining' : (room === 'office' || room === 'bed3') ? 'desk' : null;
  if (n === 'bathroom_vanity') return 'vanity';
  if (n === 'bathtub_freestanding') return 'tub';
  if (n === 'washing_machine') return 'washer';
  if (n === 'bed_double_modern' && room !== 'master') return 'bed';
  if (n === 'armchair_modern' && BEDROOMS.has(room)) return 'chair';
  if (n === 'stool_wood') return 'stool';
  return null;
}

// ------------------------------------------------------------------------------------------ surface probe
// Returns levels [{ y, pts:[{u,w,clear}] }] in host-local plan coordinates (u along local X, w along local Z),
// found by casting rays down through the host from above its top. `clear` = free height above that point.
function probe(F, p, step = 0.045) {
  const wrap = p.wrap, box = p.box;
  const q = wrap.getWorldQuaternion(new THREE.Quaternion());
  const s = wrap.getWorldScale(V());
  const ax = V(1, 0, 0).applyQuaternion(q), az = V(0, 0, 1).applyQuaternion(q);
  const o = wrap.getWorldPosition(V());
  const top = o.y + box.max.y * s.y + 0.05, bottom = o.y + box.min.y * s.y;
  const ray = F._ray, levels = [];
  const hostMeshes = []; wrap.traverse((m) => { if (m.isMesh) hostMeshes.push(m); });
  const up = V(0, 1, 0), nrm = V();
  for (let u = box.min.x * s.x + step / 2; u < box.max.x * s.x; u += step) {
    for (let w = box.min.z * s.z + step / 2; w < box.max.z * s.z; w += step) {
      const x = o.x + ax.x * u + az.x * w, z = o.z + ax.z * u + az.z * w;
      ray.set(V(x, top, z), V(0, -1, 0)); ray.far = top - bottom + 0.01;
      const hits = ray.intersectObjects(hostMeshes, false);
      let prevY = null;
      for (const h of hits) {
        const m = [].concat(h.object.material)[h.face?.materialIndex ?? 0] || [].concat(h.object.material)[0];
        if (m?.transparent) continue;
        nrm.copy(h.face.normal).transformDirection(h.object.matrixWorld);
        if (nrm.dot(up) > 0.9) {
          const y = h.point.y;
          if (prevY !== null && prevY - y < 0.06) { prevY = y; continue; }
          // free height above: host geometry above (prevY) and anything else placed above (upward ray)
          let clear = prevY === null ? 0.6 : prevY - y;
          ray.set(V(x, y + 0.004, z), up); ray.far = clear;
          const above = ray.intersectObject(F.work, true).find((a) => a.object.visible);
          if (above) clear = Math.min(clear, above.distance);
          let L = levels.find((l) => Math.abs(l.y - y) < 0.012);
          if (!L) { L = { y, pts: [] }; levels.push(L); }
          L.pts.push({ u, w, clear, y });
        }
        prevY = h.point.y;
      }
    }
  }
  for (const L of levels) {
    L.grid = new Map(L.pts.map((pt) => [`${Math.round(pt.u / step)}|${Math.round(pt.w / step)}`, pt]));
    L.step = step;
  }
  return { levels: levels.sort((a, b) => b.y - a.y), ax, az, o, box, s };
}

// Point `pt` has a free disc of radius r and height h on its level (all grid points in the disc present + clear).
function fits(L, u, w, r, h) {
  const st = L.step, n = Math.ceil(r / st);
  for (let i = -n; i <= n; i++) for (let j = -n; j <= n; j++) {
    if (Math.hypot(i * st, j * st) > r + 1e-6) continue;
    const q = L.grid.get(`${Math.round(u / st) + i}|${Math.round(w / st) + j}`);
    if (!q || q.clear < h || Math.abs(q.y - L.y) > 0.01) return false;
  }
  return true;
}

// ------------------------------------------------------------------------------------------ main
export class Clutter {
  constructor(F) {
    this.F = F; this.THREE = THREE;
    this.D = defs();
    this.inst = new Map();   // `${kind}|${floorY}` -> [{ m: Matrix4, c: Color|null }]
    this.count = {};         // room -> n props
    this.total = 0;
  }

  add(kind, room, floorY, pos, yaw, scale, color) {
    const k = `${kind}|${floorY.toFixed(2)}`;
    if (!this.inst.has(k)) this.inst.set(k, []);
    const m = new THREE.Matrix4().compose(pos, new THREE.Quaternion().setFromAxisAngle(V(0, 1, 0), yaw), scale instanceof THREE.Vector3 ? scale : V(scale, scale, scale));
    this.inst.get(k).push({ m, c: color });
    this.count[room] = (this.count[room] || 0) + 1; this.total++;
  }

  run() {
    const F = this.F;
    const R = mulberry(7);
    for (const p of F.placed) {
      const kind = hostKind(p);
      if (!kind || !RECIPES[kind]) continue;
      try { this._host(p, kind, R); } catch (e) { F._warn(`clutter ${p.room}/${p.item.model || p.item.proc}: ${e.message}`); }
    }
    return this;
  }

  _host(p, kind, R) {
    const rec = RECIPES[kind];
    this._tight = kind === 'vanity' || kind === 'nightstand' || kind === 'sidetable';
    const S = probe(this.F, p);
    const toWorld = (u, w, y) => V(S.o.x + S.ax.x * u + S.az.x * w, y, S.o.z + S.ax.z * u + S.az.z * w);
    const hostYaw = Math.atan2(S.ax.z, S.ax.x) * -1;   // rotation of host about Y
    const taken = [];   // {L, u, w, r}
    const free = (L, u, w, r) => !taken.some((t) => t.L === L && Math.hypot(t.u - u, t.w - w) < t.r + r);
    const room = p.room, floorY = p.floorY;
    const depthW = (S.box.max.z - S.box.min.z) * S.s.z, minW = S.box.min.z * S.s.z;
    const zoneOk = (zone, w) => zone === 'back' ? w < minW + depthW * 0.45 : zone === 'front' ? w > minW + depthW * 0.6 : true;
    const pal = (k) => { const P = this.D[k].palette; return P ? new THREE.Color(P[Math.floor(R() * P.length)]) : null; };
    const place = (k, zone, levelFilter = null) => {
      const d = this.D[k === 'booklie' ? 'book' : k === 'bookrow' ? 'book' : k];
      const r = (k === 'booklie' ? 0.13 : k === 'bookrow' ? 0.16 : d.fp) * (this._tight ? 0.7 : 1), h = k === 'booklie' ? 0.12 : k === 'bookrow' ? 0.26 : d.h;
      const levels = S.levels.filter((L) => (levelFilter ? levelFilter(L) : true));
      for (let tries = 0; tries < 60; tries++) {
        const L = levels[Math.floor(R() * levels.length)]; if (!L) return false;
        const pt = L.pts[Math.floor(R() * L.pts.length)];
        if (!zoneOk(zone, pt.w) || !free(L, pt.u, pt.w, r) || !fits(L, pt.u, pt.w, r, h)) continue;
        taken.push({ L, u: pt.u, w: pt.w, r });
        const pos = toWorld(pt.u, pt.w, L.y);
        if (k === 'booklie') {
          // a small stack of 1-3 lying books
          let y = L.y; const n = 1 + Math.floor(R() * 3);
          for (let i = 0; i < n; i++) {
            const t = 0.025 + R() * 0.03, sc = V(0.15 + R() * 0.07, t, 0.21 + R() * 0.07);
            this.add('book', room, floorY, V(pos.x, y, pos.z), hostYaw + (R() - 0.5) * 0.5, sc, pal('book')); y += t;
          }
        } else if (k === 'bookrow') {
          // a short row of upright cookbooks between the wall and the front, spines toward the room
          let u = pt.u - 0.12;
          for (let i = 0; i < 5; i++) {
            const t = 0.025 + R() * 0.02, hh = 0.2 + R() * 0.06;
            const q = toWorld(u + t / 2, pt.w, L.y);
            this.add('book', room, floorY, q, hostYaw, V(t, hh, 0.17 + R() * 0.04), pal('book')); u += t + 0.002;
          }
        } else {
          this.add(k, room, floorY, pos, hostYaw + (d.fp > 0.12 ? (R() - 0.5) * 0.3 : R() * Math.PI * 2), 1, pal(k));
        }
        return true;
      }
      return false;
    };
    // shelf fill: rows of books (and boxes / jars) along every level that has 0.12-0.5 m of free height
    if (rec.fill) {
      for (const L of S.levels) {
        const rows = new Map();
        for (const pt of L.pts) { if (pt.clear < 0.12) continue; const key = Math.round(pt.w / L.step); if (!rows.has(key)) rows.set(key, []); rows.get(key).push(pt); }
        if (!rows.size) continue;
        // use the row about 40% back from the front edge; spine faces +Z (front)
        const keys = [...rows.keys()].sort((a, b) => a - b);
        const wFront = keys[keys.length - 1] * L.step, wBack = keys[0] * L.step, depth = wFront - wBack + L.step;
        if (depth < 0.12) continue;
        const wRow = wBack + depth * 0.45;
        const row = rows.get(Math.round(wRow / L.step)) || rows.get(keys[Math.floor(keys.length / 2)]);
        const us = row.map((pt) => pt.u).sort((a, b) => a - b);
        // contiguous segments
        const segs = []; let a = us[0], b = us[0];
        for (const u of us.slice(1)) { if (u - b > L.step * 1.5) { segs.push([a, b]); a = u; } b = u; }
        segs.push([a, b]);
        for (const [s0, s1] of segs) {
          let u = s0 - L.step / 2 + 0.01; const end = s1 + L.step / 2 - 0.01;
          const clear = Math.min(...row.filter((pt) => pt.u >= s0 && pt.u <= s1).map((pt) => pt.clear));
          const bookD = Math.min(0.24, depth - 0.03);
          while (u < end - 0.02) {
            const roll = R();
            if (rec.fill === 'storage') {
              const k = roll < 0.45 ? 'storebox' : roll < 0.7 ? 'tin' : roll < 0.85 ? 'detergent' : 'jar';
              const d = this.D[k]; const w = d.fp * 2 + 0.02;
              if (u + w > end || d.h > clear) { u += 0.05; continue; }
              if (R() < 0.12) { u += 0.08; continue; }
              this.add(k, p.room, p.floorY, toWorld(u + w / 2, wBack + depth / 2, L.y), hostYaw + (R() - 0.5) * 0.2, 1, pal(k)); u += w;
              continue;
            }
            if (roll < 0.06) { u += 0.04 + R() * 0.08; continue; }                    // gap
            if (roll < 0.14 && clear > 0.2) {                                         // a jar / box / candle breaks the row
              const k = ['jar', 'candle', 'storebox', 'bowl'][Math.floor(R() * 4)]; const d = this.D[k]; const w = d.fp * 2 + 0.02;
              if (u + w <= end && d.h < clear - 0.01 && d.fp * 2 < depth) { this.add(k, p.room, p.floorY, toWorld(u + w / 2, wBack + depth / 2, L.y), hostYaw, 1, pal(k)); u += w; continue; }
            }
            if (roll < 0.22) {                                                         // lying stack
              if (u + 0.24 > end) { u += 0.03; continue; }
              let y = L.y; const n = 2 + Math.floor(R() * 3);
              for (let i = 0; i < n && y - L.y < clear - 0.05; i++) { const t = 0.02 + R() * 0.03; this.add('book', p.room, p.floorY, toWorld(u + 0.11, wBack + depth / 2, y), hostYaw + (R() - 0.5) * 0.2, V(0.2 + R() * 0.03, t, Math.min(bookD, 0.2 + R() * 0.05)), pal('book')); y += t; }
              u += 0.25; continue;
            }
            const t = 0.018 + R() * 0.03, hh = Math.min(clear - 0.015, 0.16 + R() * 0.14);
            if (hh < 0.1) break;
            const lean = 0;
            this.add('book', p.room, p.floorY, toWorld(u + t / 2, wBack + bookD / 2 + 0.01, L.y), hostYaw + lean, V(t, hh, bookD * (0.8 + R() * 0.2)), pal('book'));
            u += t + 0.001;
          }
        }
      }
    }
    // scattered items (top level first for worktops/tables)
    for (const [k, n, zone] of rec.items) for (let i = 0; i < n; i++) place(k, zone, (L) => L.y > S.levels[0].y - 0.01);
    // bath mat on the floor in front of the host
    if (rec.mat) {
      const w = S.box.max.z * S.s.z + 0.34;
      const pos = toWorld((S.box.min.x + S.box.max.x) / 2 * S.s.x, w, p.floorY + 0.5);
      const F = this.F; F._ray.set(pos, V(0, -1, 0)); F._ray.far = 0.6;
      const hit = F._ray.intersectObject(F.work, true)[0];
      const hh = F.game.physics.raycast(pos, V(0, -1, 0), 0.6);
      if (!hit && hh && Math.abs(hh.point.y - p.floorY) < 0.03) this.add('bathmat', p.room, p.floorY, V(pos.x, hh.point.y + 0.001, pos.z), hostYaw, 1, pal('bathmat'));
    }
  }

  // Build the InstancedMeshes (one per kind part per floor level). No shadows cast.
  build(root, mats) {
    const out = [];
    for (const [key, list] of this.inst) {
      const [kind, fy] = key.split('|');
      const d = this.D[kind];
      d.parts.forEach((part, pi) => {
        const im = new THREE.InstancedMesh(part.geo, mats[part.mat] || mats.std, list.length);
        im.name = `FC_${kind}_${pi}_${fy}`;
        list.forEach((e, i) => { im.setMatrixAt(i, e.m); if (part.tint) im.setColorAt(i, e.c || new THREE.Color(1, 1, 1)); });
        im.instanceMatrix.needsUpdate = true; if (im.instanceColor) im.instanceColor.needsUpdate = true;
        im.castShadow = false; im.receiveShadow = true;
        im.computeBoundingSphere(); im.computeBoundingBox?.();
        im.userData.p07 = { floorY: +fy, clutter: true };
        root.add(im); out.push(im);
      });
    }
    return out;
  }
}

export function clutterMaterials() {
  const m = (o) => new THREE.MeshStandardMaterial({ vertexColors: true, ...o });
  return {
    std: m({ roughness: 0.55 }), cloth: m({ roughness: 0.9 }), glaze: m({ roughness: 0.25 }), gloss: m({ roughness: 0.18 }),
    wood: m({ roughness: 0.6 }), metal: m({ roughness: 0.3, metalness: 0.8 }),
    glass: m({ roughness: 0.05, transparent: true, opacity: 0.55, depthWrite: false }),
  };
}

function mulberry(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
