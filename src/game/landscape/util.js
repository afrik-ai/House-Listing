import * as THREE from 'three';

// Deterministic RNG (mulberry32) so the garden is identical on every load.
export function rng(seed = 1) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Cheap smooth 2D value noise (CPU side, for placement / terrain heights).
function hash2(x, y) {
  let h = Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
export function vnoise(x, y) {
  const xi = Math.floor(x), yi = Math.floor(y);
  const xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const a = hash2(xi, yi), b = hash2(xi + 1, yi), c = hash2(xi, yi + 1), d = hash2(xi + 1, yi + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
export function fbm(x, y, oct = 4) {
  let s = 0, amp = 0.5, f = 1, n = 0;
  for (let i = 0; i < oct; i++) { s += amp * vnoise(x * f, y * f); n += amp; amp *= 0.5; f *= 2.03; }
  return s / n;
}

export const rectContains = ([x, z, w, d], px, pz, m = 0) => px >= x - m && px <= x + w + m && pz >= z - m && pz <= z + d + m;
export const circleContains = ([cx, cz, r], px, pz, m = 0) => (px - cx) ** 2 + (pz - cz) ** 2 <= (r + m) ** 2;
export function shapeContains(s, px, pz, m = 0) {
  if (s.rect) return rectContains(s.rect, px, pz, m);
  if (s.circle) return circleContains(s.circle, px, pz, m);
  return false;
}

// Geometry accumulator producing one non-indexed BufferGeometry with position/normal/uv(/uv1).
// UVs are world-planar (metres / scale) per face, so textures keep their real-world size.
export class GeoBuilder {
  constructor() { this.p = []; this.n = []; this.uv = []; this.c = null; }

  // Quad a,b,c,d (counter-clockwise seen from the normal side), uv per vertex.
  quad(a, b, c, d, n, uvs, col) {
    const tri = [0, 1, 2, 0, 2, 3];
    const v = [a, b, c, d];
    for (const i of tri) {
      this.p.push(v[i][0], v[i][1], v[i][2]);
      this.n.push(n[0], n[1], n[2]);
      this.uv.push(uvs[i][0], uvs[i][1]);
      if (col) { (this.c ||= []).push(col[0], col[1], col[2]); }
    }
  }

  // Axis-aligned box with world-planar UVs. `skip` = set of faces to omit ('+y','-y','+x','-x','+z','-z').
  box(x0, y0, z0, x1, y1, z1, scale = 1, { skip = [], uvOffset = [0, 0], col = null } = {}) {
    const s = 1 / scale, [ou, ov] = uvOffset;
    const S = new Set(skip);
    if (!S.has('+y')) this.quad([x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [x0, y1, z0], [0, 1, 0],
      [[x0 * s + ou, -z1 * s + ov], [x1 * s + ou, -z1 * s + ov], [x1 * s + ou, -z0 * s + ov], [x0 * s + ou, -z0 * s + ov]], col);
    if (!S.has('-y')) this.quad([x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1], [0, -1, 0],
      [[x0 * s, z0 * s], [x1 * s, z0 * s], [x1 * s, z1 * s], [x0 * s, z1 * s]], col);
    if (!S.has('+z')) this.quad([x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1], [0, 0, 1],
      [[x0 * s + ou, y0 * s], [x1 * s + ou, y0 * s], [x1 * s + ou, y1 * s], [x0 * s + ou, y1 * s]], col);
    if (!S.has('-z')) this.quad([x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0], [0, 0, -1],
      [[-x1 * s + ou, y0 * s], [-x0 * s + ou, y0 * s], [-x0 * s + ou, y1 * s], [-x1 * s + ou, y1 * s]], col);
    if (!S.has('+x')) this.quad([x1, y0, z1], [x1, y0, z0], [x1, y1, z0], [x1, y1, z1], [1, 0, 0],
      [[-z1 * s + ov, y0 * s], [-z0 * s + ov, y0 * s], [-z0 * s + ov, y1 * s], [-z1 * s + ov, y1 * s]], col);
    if (!S.has('-x')) this.quad([x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0], [-1, 0, 0],
      [[z0 * s + ov, y0 * s], [z1 * s + ov, y0 * s], [z1 * s + ov, y1 * s], [z0 * s + ov, y1 * s]], col);
  }

  // Box rotated around Y (for slabs/stones laid along a path). Centre cx,cz; size w (local x) x d (local z).
  rotBox(cx, cz, w, d, y0, y1, angle, scale = 1, uvOffset = [0, 0]) {
    const c = Math.cos(angle), s = Math.sin(angle);
    const P = (lx, lz) => [cx + lx * c + lz * s, cz - lx * s + lz * c];
    const hw = w / 2, hd = d / 2;
    const corners = [P(-hw, -hd), P(hw, -hd), P(hw, hd), P(-hw, hd)];
    const k = 1 / scale, [ou, ov] = uvOffset;
    const uvTop = (q) => [q[0] * k + ou, -q[1] * k + ov];
    // top (counter-clockwise from above: -hd -> +hd order reversed)
    const [a, b, cc, dd] = corners;
    this.quad([dd[0], y1, dd[1]], [cc[0], y1, cc[1]], [b[0], y1, b[1]], [a[0], y1, a[1]], [0, 1, 0], [uvTop(dd), uvTop(cc), uvTop(b), uvTop(a)]);
    const ring = [a, b, cc, dd];
    for (let i = 0; i < 4; i++) {
      const p = ring[i], q = ring[(i + 1) % 4];
      const nx = q[1] - p[1], nz = -(q[0] - p[0]);
      const L = Math.hypot(nx, nz) || 1;
      const len = Math.hypot(q[0] - p[0], q[1] - p[1]);
      this.quad([q[0], y0, q[1]], [p[0], y0, p[1]], [p[0], y1, p[1]], [q[0], y1, q[1]], [nx / L, 0, nz / L],
        [[ou, y0 * k], [ou + len * k, y0 * k], [ou + len * k, y1 * k], [ou, y1 * k]]);
    }
  }

  // Flat disc (top-facing) at height y.
  disc(cx, cz, r, y, scale = 1, seg = 48) {
    const k = 1 / scale;
    for (let i = 0; i < seg; i++) {
      const a0 = (i / seg) * Math.PI * 2, a1 = ((i + 1) / seg) * Math.PI * 2;
      const p0 = [cx + Math.cos(a0) * r, cz + Math.sin(a0) * r], p1 = [cx + Math.cos(a1) * r, cz + Math.sin(a1) * r];
      for (const v of [[cx, cz], p1, p0]) {
        this.p.push(v[0], y, v[1]); this.n.push(0, 1, 0); this.uv.push(v[0] * k, -v[1] * k);
      }
    }
  }

  get empty() { return this.p.length === 0; }

  build() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.p, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.n, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2));
    g.setAttribute('uv1', new THREE.Float32BufferAttribute(this.uv, 2));
    if (this.c) g.setAttribute('color', new THREE.Float32BufferAttribute(this.c, 3));
    g.computeBoundingSphere(); g.computeBoundingBox();
    return g;
  }
}

// Rect minus holes -> list of rects covering the remainder (grid split on all break lines).
export function rectMinus(rect, holes) {
  const [x, z, w, d] = rect;
  const xs = new Set([x, x + w]), zs = new Set([z, z + d]);
  for (const [hx, hz, hw, hd] of holes) {
    for (const v of [hx, hx + hw]) if (v > x && v < x + w) xs.add(v);
    for (const v of [hz, hz + hd]) if (v > z && v < z + d) zs.add(v);
  }
  const X = [...xs].sort((a, b) => a - b), Z = [...zs].sort((a, b) => a - b);
  const out = [];
  for (let i = 0; i < X.length - 1; i++) for (let j = 0; j < Z.length - 1; j++) {
    const cx = (X[i] + X[i + 1]) / 2, cz = (Z[j] + Z[j + 1]) / 2;
    if (holes.some((h) => rectContains(h, cx, cz))) continue;
    out.push([X[i], Z[j], X[i + 1] - X[i], Z[j + 1] - Z[j]]);
  }
  return out;
}

// Points along a polyline every `step` metres -> [{x, z, angle}] (angle = heading around Y).
export function alongPolyline(points, step, start = step / 2) {
  const out = [];
  let carry = start;
  for (let i = 0; i < points.length - 1; i++) {
    const [ax, az] = points[i], [bx, bz] = points[i + 1];
    const L = Math.hypot(bx - ax, bz - az);
    const ang = Math.atan2(bx - ax, bz - az);
    let t = carry;
    while (t <= L) { out.push({ x: ax + ((bx - ax) * t) / L, z: az + ((bz - az) * t) / L, angle: ang }); t += step; }
    carry = t - L;
  }
  return out;
}

// Invisible collision boxes -> one mesh (Physics bakes world transforms).
export function colliderMesh(boxes, name = 'COL_landscape') {
  const gb = new GeoBuilder();
  for (const b of boxes) gb.box(b[0], b[1], b[2], b[3], b[4], b[5]);
  const m = new THREE.Mesh(gb.build(), new THREE.MeshBasicMaterial({ visible: false }));
  m.name = name; m.visible = false; m.userData.colliderOnly = true;
  return m;
}

// Shared GLSL helpers.
export const GLSL_NOISE = /* glsl */`
float lsHash(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float lsNoise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(lsHash(i), lsHash(i + vec2(1.0, 0.0)), u.x), mix(lsHash(i + vec2(0.0, 1.0)), lsHash(i + vec2(1.0, 1.0)), u.x), u.y);
}
float lsFbm(vec2 p) { return lsNoise(p) * 0.55 + lsNoise(p * 2.07 + 13.1) * 0.3 + lsNoise(p * 4.3 + 7.7) * 0.15; }
`;
