// Woven cloth (plain / twill / basket), carpet pile and leather grain.
import { Tex, hash, fbm, gnoise, worley, smooth, mix, fract, mod, sat, clamp } from './lib.mjs';

// o: { sizeMM, n (threads per texture, warp=weft), pattern(i,j)->warp on top, warpCol, weftCol, threadVar, slub, fuzz, gap, rough }
export function weave(res, o) {
  const t = new Tex(res), mm = o.sizeMM / res, n = o.n, nf = o.nf ?? n;
  t.each((u, v, k) => {
    const x = u * n, y = v * nf, i = Math.floor(x), j = Math.floor(y), a = x - i, b = y - j;
    const wi = mod(i, n), wj = mod(j, nf);
    const top = o.pattern(wi, wj);
    // thread thickness irregularity (slubs) along each thread
    const slubW = 1 + o.slub * gnoise(v * 24, wi * 0.37, 24, 4096, 5) + o.slub * 0.5 * gnoise(v * 90, wi * 0.71, 90, 4096, 6);
    const slubF = 1 + o.slub * gnoise(u * 24, wj * 0.37, 24, 4096, 7) + o.slub * 0.5 * gnoise(u * 90, wj * 0.71, 90, 4096, 8);
    const pw = Math.max(0, 1 - Math.pow(Math.abs(a - 0.5) * 2 / Math.min(1, (1 - o.gap) * slubW), 2)); // warp cross-section
    const pf = Math.max(0, 1 - Math.pow(Math.abs(b - 0.5) * 2 / Math.min(1, (1 - o.gap) * slubF), 2));
    const archW = Math.sin(Math.PI * b) ** 0.6, archF = Math.sin(Math.PI * a) ** 0.6;
    const hw = Math.sqrt(pw) * (top ? 0.6 + 0.4 * archW : 0.25), hf = Math.sqrt(pf) * (top ? 0.25 : 0.6 + 0.4 * archF);
    const warp = hw >= hf;
    const hh = Math.max(hw, hf);
    const fuzzW = gnoise(u * n * 1.5, v * n * 8, n * 1.5 | 0, n * 8, 9), fuzzF = gnoise(u * nf * 8, v * nf * 1.5, nf * 8, nf * 1.5 | 0, 10);
    const tv = warp ? 1 + o.threadVar * (hash(wi, 1, o.seed ?? 3) - 0.5) * 2 : 1 + o.threadVar * (hash(wj, 2, o.seed ?? 3) - 0.5) * 2;
    const col = warp ? o.warpCol : o.weftCol;
    const mott = 1 + fbm(u, v, 4, 4, 4, 12) * (o.mottle ?? 0.08);
    const f = tv * mott * (0.55 + 0.45 * hh) * (1 + (warp ? fuzzW : fuzzF) * o.fuzz);
    t.r[k] = col[0] * f; t.g[k] = col[1] * f; t.b[k] = col[2] * f;
    t.h[k] = hh * o.threadMM + (warp ? fuzzW : fuzzF) * o.threadMM * 0.08;
    t.rough[k] = o.rough + (1 - hh) * 0.08 + (warp ? fuzzW : fuzzF) * 0.03;
  });
  return { t, mm };
}
export const PLAIN = (i, j) => (i + j) % 2 === 0;
export const TWILL = (i, j) => mod(i - j, 4) < 2;
export const BASKET = (i, j) => ((i >> 1) + (j >> 1)) % 2 === 0;

// Leather: pebbled cells (worley) at two scales + pores + soft creases
export function leather(res, o) {
  const t = new Tex(res), mm = o.sizeMM / res;
  t.each((u, v, k) => {
    const wu = u + fbm(u, v, 3, 3, 3, 21) * 0.01, wv = v + fbm(u, v, 3, 3, 3, 22) * 0.01;
    const w1 = worley(wu, wv, o.cells, o.cells, 31); const e1 = w1.f2 - w1.f1, dome1 = smooth(0, 0.35, e1);
    const w2 = worley(u, v, o.cells * 3, o.cells * 3, 32); const dome2 = smooth(0, 0.3, w2.f2 - w2.f1);
    const pore = Math.max(0, gnoise(u * o.cells * 9, v * o.cells * 9, o.cells * 9, o.cells * 9, 33) - 0.55) * 2;
    const crease = Math.abs(fbm(u, v, 5, 5, 3, 34));
    const cr = (1 - smooth(0.0, 0.02, crease)) * 0.4;
    const cloud = fbm(u, v, 2, 2, 4, 35);
    t.h[k] = dome1 * 0.06 + dome2 * 0.02 - pore * 0.02 - cr * 0.03;
    const f = (1 + cloud * o.cloud) * (0.86 + 0.14 * dome1) * (1 - pore * 0.1 - cr * 0.12);
    t.r[k] = o.col[0] * f; t.g[k] = o.col[1] * f; t.b[k] = o.col[2] * f;
    t.rough[k] = o.rough + (1 - dome1) * 0.12 + pore * 0.05 - dome1 * 0.04 + cloud * 0.05;
  });
  return { t, mm };
}
