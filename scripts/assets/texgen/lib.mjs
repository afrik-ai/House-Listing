// Procedural texture toolkit (pure JS, tileable). Used by scripts/assets/gen_textures.mjs.
// All fields are Float32Array W*H, texture space u,v in [0,1), every function is periodic in u and v.
import fs from 'fs';
import sharp from 'sharp';

export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const sat = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
export const mix = (a, b, t) => a + (b - a) * t;
export const smooth = (a, b, x) => { const t = sat((x - a) / (b - a)); return t * t * (3 - 2 * t); };
export const fract = (x) => x - Math.floor(x);
export const mod = (a, n) => ((a % n) + n) % n;

export function rng(seed) {
  let s = (seed >>> 0) || 1;
  return () => { s = (s + 0x6D2B79F5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
export function hashi(a, b, seed) {
  let h = Math.imul(a | 0, 0x27d4eb2d) ^ Math.imul(b | 0, 0x165667b1) ^ Math.imul(seed | 0, 0x9e3779b1);
  h = Math.imul(h ^ (h >>> 15), 0x85ebca6b); h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35); h ^= h >>> 16;
  return h >>> 0;
}
export const hash = (a, b, seed) => hashi(a, b, seed) / 4294967296;

const GX = new Float32Array(256), GY = new Float32Array(256);
for (let i = 0; i < 256; i++) { const a = (i / 256) * Math.PI * 2 + 0.3; GX[i] = Math.cos(a); GY[i] = Math.sin(a); }

// periodic gradient noise, lattice periods px, py (integers); x,y in lattice units. ~[-1,1]
export function gnoise(x, y, px, py, seed) {
  const ix = Math.floor(x), iy = Math.floor(y), fx = x - ix, fy = y - iy;
  const x0 = mod(ix, px), y0 = mod(iy, py), x1 = x0 + 1 === px ? 0 : x0 + 1, y1 = y0 + 1 === py ? 0 : y0 + 1;
  const h00 = hashi(x0, y0, seed) & 255, h10 = hashi(x1, y0, seed) & 255, h01 = hashi(x0, y1, seed) & 255, h11 = hashi(x1, y1, seed) & 255;
  const n00 = GX[h00] * fx + GY[h00] * fy, n10 = GX[h10] * (fx - 1) + GY[h10] * fy;
  const n01 = GX[h01] * fx + GY[h01] * (fy - 1), n11 = GX[h11] * (fx - 1) + GY[h11] * (fy - 1);
  const ux = fx * fx * fx * (fx * (fx * 6 - 15) + 10), uy = fy * fy * fy * (fy * (fy * 6 - 15) + 10);
  return 1.45 * ((n00 + (n10 - n00) * ux) + ((n01 + (n11 - n01) * ux) - (n00 + (n10 - n00) * ux)) * uy);
}
// periodic value noise ~[0,1]
export function vnoise(x, y, px, py, seed) {
  const ix = Math.floor(x), iy = Math.floor(y), fx = x - ix, fy = y - iy;
  const x0 = mod(ix, px), y0 = mod(iy, py), x1 = (x0 + 1) % px, y1 = (y0 + 1) % py;
  const ux = fx * fx * (3 - 2 * fx), uy = fy * fy * (3 - 2 * fy);
  const a = hash(x0, y0, seed), b = hash(x1, y0, seed), c = hash(x0, y1, seed), d = hash(x1, y1, seed);
  return mix(mix(a, b, ux), mix(c, d, ux), uy);
}

// fbm at texture point u,v. f/fy = base periods (cells per texture). ~[-1,1]
export function fbm(u, v, f, fy, oct, seed, gain = 0.5) {
  let s = 0, a = 1, n = 0, px = f, py = fy;
  for (let o = 0; o < oct; o++) { s += a * gnoise(u * px, v * py, px, py, seed + o * 131); n += a; a *= gain; px *= 2; py *= 2; }
  return s / n;
}
export function ridged(u, v, f, fy, oct, seed, gain = 0.5) {
  let s = 0, a = 1, n = 0, px = f, py = fy;
  for (let o = 0; o < oct; o++) { s += a * (1 - Math.abs(gnoise(u * px, v * py, px, py, seed + o * 131))); n += a; a *= gain; px *= 2; py *= 2; }
  return s / n;
}

// periodic Worley: n x m jittered cells. Writes into W_ = {f1, f2, id, cx, cy (texture units)}
export const WR = { f1: 0, f2: 0, id: 0, cx: 0, cy: 0 };
export function worley(u, v, n, m, seed, jit = 0.9) {
  const x = u * n, y = v * m, ix = Math.floor(x), iy = Math.floor(y);
  let f1 = 1e9, f2 = 1e9, id = 0, cx = 0, cy = 0;
  for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) {
    const gx = ix + i, gy = iy + j, wx = mod(gx, n), wy = mod(gy, m);
    const h = hashi(wx, wy, seed);
    const px = gx + 0.5 + jit * ((h & 1023) / 1023 - 0.5), py = gy + 0.5 + jit * (((h >>> 10) & 1023) / 1023 - 0.5);
    const dx = px - x, dy = py - y, d = dx * dx + dy * dy;
    if (d < f1) { f2 = f1; f1 = d; id = h; cx = px; cy = py; } else if (d < f2) f2 = d;
  }
  WR.f1 = Math.sqrt(f1); WR.f2 = Math.sqrt(f2); WR.id = id; WR.cx = cx / n; WR.cy = cy / m;
  return WR;
}

export class Tex {
  constructor(W, H = W) { this.W = W; this.H = H; const N = W * H;
    this.r = new Float32Array(N); this.g = new Float32Array(N); this.b = new Float32Array(N);
    this.h = new Float32Array(N); this.rough = new Float32Array(N).fill(0.5); this.ao = null; }
  each(fn) { const { W, H } = this; let k = 0;
    for (let y = 0; y < H; y++) { const v = (y + 0.5) / H; for (let x = 0; x < W; x++, k++) fn((x + 0.5) / W, v, k, x, y); } }
}

export function field(W, H, fn) { const a = new Float32Array(W * H); let k = 0;
  for (let y = 0; y < H; y++) { const v = (y + 0.5) / H; for (let x = 0; x < W; x++, k++) a[k] = fn((x + 0.5) / W, v, x, y); } return a; }

// separable periodic box blur, `passes` times (~gaussian)
export function blur(src, W, H, r, passes = 3) {
  r = Math.max(1, Math.round(r)); let a = Float32Array.from(src), b = new Float32Array(W * H); const n = 2 * r + 1;
  for (let p = 0; p < passes; p++) {
    for (let y = 0; y < H; y++) { const o = y * W; let s = 0; for (let i = -r; i <= r; i++) s += a[o + mod(i, W)];
      for (let x = 0; x < W; x++) { b[o + x] = s / n; s += a[o + mod(x + r + 1, W)] - a[o + mod(x - r, W)]; } }
    for (let x = 0; x < W; x++) { let s = 0; for (let i = -r; i <= r; i++) s += b[mod(i, H) * W + x];
      for (let y = 0; y < H; y++) { a[y * W + x] = s / n; s += b[mod(y + r + 1, H) * W + x] - b[mod(y - r, H) * W + x]; } }
  }
  return a;
}

export function stats(a) { let s = 0, s2 = 0; for (const v of a) { s += v; s2 += v * v; } const m = s / a.length; return { mean: m, std: Math.sqrt(Math.max(0, s2 / a.length - m * m)) }; }

// stamp an object into the texture with wrap-around. fn(dx,dy,k) where dx,dy = px offset from centre.
export function stamp(W, H, cx, cy, rx, ry, fn) {
  const x0 = Math.floor(cx - rx), x1 = Math.ceil(cx + rx), y0 = Math.floor(cy - ry), y1 = Math.ceil(cy + ry);
  for (let y = y0; y <= y1; y++) { const wy = mod(y, H) * W; for (let x = x0; x <= x1; x++) fn(x + 0.5 - cx, y + 0.5 - cy, wy + mod(x, W)); }
}

const toS = (l) => { l = sat(l); return l <= 0.0031308 ? l * 12.92 : 1.055 * Math.pow(l, 1 / 2.4) - 0.055; };
const LUT = new Uint8Array(4097); for (let i = 0; i <= 4096; i++) LUT[i] = Math.round(toS(i / 4096) * 255);
const enc = (l) => LUT[Math.round(sat(l) * 4096)];

async function jpg(buf, W, H, ch, file, q) {
  await sharp(buf, { raw: { width: W, height: H, channels: ch } }).jpeg({ quality: q, mozjpeg: true, chromaSubsampling: ch === 1 ? undefined : '4:4:4' }).toFile(file);
}

// Finalise + write color/normal/roughness/ao. opts: { mmPerPx, normalK, meanLum (linear target), aoK, aoR(mm) }
export async function save(t, dir, opts) {
  const { W, H } = t, N = W * H;
  fs.mkdirSync(dir, { recursive: true });
  // albedo: optional mean-luminance normalisation, then plausibility clamp (0.012..0.85 linear)
  if (opts.meanLum) { let s = 0; for (let k = 0; k < N; k++) s += 0.2126 * t.r[k] + 0.7152 * t.g[k] + 0.0722 * t.b[k];
    const f = opts.meanLum / (s / N); for (let k = 0; k < N; k++) { t.r[k] *= f; t.g[k] *= f; t.b[k] *= f; } }
  const c = Buffer.alloc(N * 3);
  for (let k = 0; k < N; k++) { c[k * 3] = enc(clamp(t.r[k], 0.012, 0.85)); c[k * 3 + 1] = enc(clamp(t.g[k], 0.012, 0.85)); c[k * 3 + 2] = enc(clamp(t.b[k], 0.012, 0.85)); }
  // normal (OpenGL): height in mm, slope = dh/dx(mm)
  const n = Buffer.alloc(N * 3), s = (opts.normalK ?? 1) / (2 * opts.mmPerPx), h = t.h;
  for (let y = 0; y < H; y++) { const yu = mod(y - 1, H) * W, yd = mod(y + 1, H) * W, o = y * W;
    for (let x = 0; x < W; x++) {
      const dx = (h[o + mod(x + 1, W)] - h[o + mod(x - 1, W)]) * s, dy = (h[yd + x] - h[yu + x]) * s; // +row = down
      const nx = -dx, ny = dy, l = 1 / Math.sqrt(nx * nx + ny * ny + 1), k = (o + x) * 3;
      n[k] = Math.round((nx * l * 0.5 + 0.5) * 255); n[k + 1] = Math.round((ny * l * 0.5 + 0.5) * 255); n[k + 2] = Math.round((l * 0.5 + 0.5) * 255);
    } }
  const r = Buffer.alloc(N); for (let k = 0; k < N; k++) r[k] = Math.round(clamp(t.rough[k], 0.03, 1) * 255);
  // ao: supplied, or cavity from height (local mean above the texel -> occluded)
  let ao = t.ao;
  if (!ao) { const rad = Math.max(1, (opts.aoR ?? 3) / opts.mmPerPx), bl = blur(h, W, H, rad, 2), k0 = opts.aoK ?? 0.25; ao = new Float32Array(N);
    for (let k = 0; k < N; k++) ao[k] = 1 - k0 * Math.max(0, bl[k] - h[k]); }
  const a = Buffer.alloc(N); for (let k = 0; k < N; k++) a[k] = Math.round(clamp(ao[k], 0.35, 1) * 255);
  await Promise.all([jpg(c, W, H, 3, dir + '/color.jpg', 90), jpg(n, W, H, 3, dir + '/normal.jpg', 92), jpg(r, W, H, 1, dir + '/roughness.jpg', 88), jpg(a, W, H, 1, dir + '/ao.jpg', 88)]);
  return { color: 'color.jpg', normal: 'normal.jpg', roughness: 'roughness.jpg', ao: 'ao.jpg' };
}

// linear colour from hex (sRGB)
export function lin(hex) { const n = parseInt(hex.replace('#', ''), 16); const f = (c) => { c /= 255; return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
  return [f((n >> 16) & 255), f((n >> 8) & 255), f(n & 255)]; }
