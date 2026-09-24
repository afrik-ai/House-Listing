// Z-buffered scatter of 3D objects (stones, chips, needles, grass blades) into a tileable texture.
import { rng, stamp, mix, sat, clamp, gnoise, fbm } from './lib.mjs';

// Pebble / chip: ellipse rx,ry (px), angle, peak height hMM, colour [r,g,b], rough, sharp (0 round..1 flat top)
export function pebble(t, z, o) {
  const { W, H } = t, c = Math.cos(o.a), s = Math.sin(o.a), R = Math.max(o.rx, o.ry) + 1;
  const base = o.z0 ?? 0, bump = o.bump ?? 0.12, seed = o.seed ?? 1;
  stamp(W, H, o.x, o.y, R, R, (dx, dy, k) => {
    const lx = (dx * c + dy * s) / o.rx, ly = (-dx * s + dy * c) / o.ry;
    // slightly irregular outline
    const ang = Math.atan2(ly, lx), wob = 1 + (o.irr ?? 0.12) * (Math.sin(ang * 3 + seed) * 0.6 + Math.sin(ang * 5 + seed * 1.7) * 0.4);
    const d2 = (lx * lx + ly * ly) / (wob * wob); if (d2 >= 1) return;
    const dome = Math.pow(1 - d2, o.sharp ?? 0.5);
    const zz = base + o.h * dome * (1 + bump * gnoise(lx * 2 + seed, ly * 2, 4096, 4096, 3));
    if (zz <= z[k]) return;
    z[k] = zz; t.h[k] = zz;
    const shade = 0.82 + 0.18 * dome + (o.speck ?? 0) * gnoise((o.x + dx) * 0.9, (o.y + dy) * 0.9, 4096, 4096, seed + 1);
    t.r[k] = o.col[0] * shade; t.g[k] = o.col[1] * shade; t.b[k] = o.col[2] * shade;
    t.rough[k] = o.rough + (1 - dome) * 0.05;
  });
}

// Blade / needle: segment from (x,y) along angle a, length len px, width w px; height rises base->tip
export function blade(t, z, o) {
  const { W, H } = t, c = Math.cos(o.a), s = Math.sin(o.a), bend = o.bend ?? 0;
  const cx = o.x + c * o.len / 2, cy = o.y + s * o.len / 2, R = o.len / 2 + o.w + Math.abs(bend) * o.len;
  stamp(W, H, cx, cy, R, R, (dx, dy, k) => {
    let al = dx * c + dy * s + o.len / 2; const tt = al / o.len; if (tt < 0 || tt > 1) return;
    const off = bend * o.len * tt * tt; // curve sideways
    const pr = -dx * s + dy * c - off;
    const hw = o.w * 0.5 * (1 - tt * (o.taper ?? 0.85));
    if (Math.abs(pr) > hw) return;
    const zz = o.z0 + o.h * tt + 0.15 * (1 - Math.abs(pr) / hw);
    if (zz <= z[k]) return;
    z[k] = zz; t.h[k] = zz;
    const across = 1 - Math.pow(Math.abs(pr) / hw, 2) * 0.25; // midrib highlight
    const tip = o.tipCol ? tt : 0;
    const f = across * (o.dark ? mix(1 - o.dark, 1, tt) : 1);
    t.r[k] = mix(o.col[0], o.tipCol ? o.tipCol[0] : o.col[0], tip) * f;
    t.g[k] = mix(o.col[1], o.tipCol ? o.tipCol[1] : o.col[1], tip) * f;
    t.b[k] = mix(o.col[2], o.tipCol ? o.tipCol[2] : o.col[2], tip) * f;
    t.rough[k] = o.rough;
  });
}

// AO from z-buffer: texels deep below their neighbourhood are occluded
export function depthAO(t, z, blurFn, rad, k0, floor = 0.4) {
  const bl = blurFn(z, t.W, t.H, rad, 2), ao = new Float32Array(z.length);
  for (let i = 0; i < z.length; i++) ao[i] = clamp(1 - k0 * Math.max(0, bl[i] - z[i]), floor, 1);
  return ao;
}
