import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

// Geometry helpers for procedural furniture. All sizes in metres. Local convention for every generator
// output: origin at the base centre (min Y = 0), FRONT faces +Z (same as the manifest models).

// Metric box-projected UVs (1 UV = 1 m) computed in the geometry's current space. `grain` = 'x'|'y'|'z'
// forces the U axis to follow that axis on the faces where it is visible (wood grain direction).
export function boxUV(geo, grain = null) {
  const p = geo.attributes.position, n = geo.attributes.normal;
  const uv = new Float32Array(p.count * 2);
  for (let i = 0; i < p.count; i++) {
    const nx = Math.abs(n.getX(i)), ny = Math.abs(n.getY(i)), nz = Math.abs(n.getZ(i));
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    let u, v;
    if (nx >= ny && nx >= nz) { u = z; v = y; if (grain === 'y') { u = y; v = z; } }
    else if (ny >= nz) { u = x; v = z; if (grain === 'z') { u = z; v = x; } }
    else { u = x; v = y; if (grain === 'y') { u = y; v = x; } }
    uv[i * 2] = u; uv[i * 2 + 1] = v;
  }
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  return geo;
}

// Rounded box from min/max corners. r = edge radius (clamped). seg = bevel segments.
export function rbox(min, max, r = 0.004, seg = 2, grain = null) {
  const w = max[0] - min[0], h = max[1] - min[1], d = max[2] - min[2];
  const rr = Math.max(0.0005, Math.min(r, w / 2 - 1e-4, h / 2 - 1e-4, d / 2 - 1e-4));
  const g = new RoundedBoxGeometry(w, h, d, seg, rr);
  g.translate((min[0] + max[0]) / 2, (min[1] + max[1]) / 2, (min[2] + max[2]) / 2);
  return boxUV(g, grain);
}

export function box(min, max, grain = null) {
  const g = new THREE.BoxGeometry(max[0] - min[0], max[1] - min[1], max[2] - min[2]);
  g.translate((min[0] + max[0]) / 2, (min[1] + max[1]) / 2, (min[2] + max[2]) / 2);
  return boxUV(g, grain);
}

export function cyl(r, h, pos = [0, 0, 0], seg = 24, r2 = null, axis = 'y') {
  const g = new THREE.CylinderGeometry(r2 ?? r, r, h, seg, 1);
  if (axis === 'x') g.rotateZ(Math.PI / 2);
  if (axis === 'z') g.rotateX(Math.PI / 2);
  g.translate(pos[0], pos[1] + (axis === 'y' ? h / 2 : 0), pos[2]);
  return boxUV(g);
}

// Revolved profile [[r,y],...] around Y.
export function lathe(profile, pos = [0, 0, 0], seg = 32) {
  const g = new THREE.LatheGeometry(profile.map(([r, y]) => new THREE.Vector2(r, y)), seg);
  g.translate(pos[0], pos[1], pos[2]);
  return boxUV(g);
}

// Tube along a polyline.
export function tube(points, r, seg = 8, tubular = 32) {
  const curve = new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(...p)), false, 'catmullrom', 0.1);
  return boxUV(new THREE.TubeGeometry(curve, tubular, r, seg, false));
}

// Accumulates geometries per material key, then merges into one mesh per material (few draw calls).
export class Builder {
  constructor(mats) { this.mats = mats; this.parts = new Map(); this.extra = []; }
  add(matKey, geo, matrix = null) {
    if (matrix) geo.applyMatrix4(matrix);
    if (!this.parts.has(matKey)) this.parts.set(matKey, []);
    this.parts.get(matKey).push(geo);
    return geo;
  }
  // Adds a ready-made Object3D (e.g. a GLB sub-model) as-is.
  object(o) { this.extra.push(o); return o; }
  build(name = 'proc') {
    const root = new THREE.Group(); root.name = name;
    for (const [key, geos] of this.parts) {
      const mat = typeof key === 'string' ? this.mats.get(key) : key;
      const merged = mergeAll(geos);
      const mesh = new THREE.Mesh(merged, mat);
      mesh.name = `${name}_${typeof key === 'string' ? key : mat.name}`;
      root.add(mesh);
    }
    for (const o of this.extra) root.add(o);
    return root;
  }
}

export function mergeAll(geos) {
  const keepColor = geos.every((g) => g.attributes.color);
  const keep = keepColor ? ['position', 'normal', 'uv', 'color'] : ['position', 'normal', 'uv'];
  const norm = geos.map((g) => {
    let q = g.index ? g.toNonIndexed() : g;
    for (const k of Object.keys(q.attributes)) if (!keep.includes(k)) q.deleteAttribute(k);
    if (!q.attributes.uv) boxUV(q);
    if (!q.attributes.normal) q.computeVertexNormals();
    q.morphAttributes = {};
    q.clearGroups();
    return q;
  });
  const m = norm.length === 1 ? norm[0] : mergeGeometries(norm, false);
  m.computeBoundingBox(); m.computeBoundingSphere();
  return m;
}

export const M4 = {
  t: (x, y, z) => new THREE.Matrix4().makeTranslation(x, y, z),
  ry: (a) => new THREE.Matrix4().makeRotationY(a),
  rx: (a) => new THREE.Matrix4().makeRotationX(a),
  rz: (a) => new THREE.Matrix4().makeRotationZ(a),
  // translate * rotY
  tr: (x, y, z, ry = 0, rx = 0) => new THREE.Matrix4().makeTranslation(x, y, z).multiply(new THREE.Matrix4().makeRotationY(ry)).multiply(new THREE.Matrix4().makeRotationX(rx)),
};
