// Wood boards: oak plank floor, staggered parquet, cedar/larch cladding.
// Board columns run across u, grain along v (the runtime's plank mode relies on this: `cells` columns).
import { Tex, rng, hash, fbm, gnoise, smooth, mix, fract, mod, sat, clamp, blur } from './lib.mjs';

export function planks(res, o) {
  const t = new Tex(res), W = res, S = o.sizeMM, mm = S / res, R = rng(o.seed);
  const cols = o.cols, pitch = 1 / cols, bw = S / cols;
  // per column: butt joints (sorted positions in [0,1)), per segment: board properties
  const colData = [];
  for (let c = 0; c < cols; c++) {
    const nj = o.joints[0] + Math.floor(R() * (o.joints[1] - o.joints[0] + 1));
    const js = []; const base = R();
    for (let j = 0; j < nj; j++) js.push(fract(base + j / nj + (R() - 0.5) * 0.5 / nj));
    js.sort((a, b) => a - b);
    const segs = js.map(() => {
      const quarter = R() < (o.quarter ?? 0.3);
      return {
        tone: 1 + (R() - 0.5) * 2 * o.toneVar, warm: (R() - 0.5) * 2 * (o.hueVar ?? 0.04), quarter,
        cx: (R() - 0.5) * bw * (quarter ? 6 : 1.6), depth: quarter ? 250 + R() * 200 : 25 + R() * 70,
        tilt: (R() - 0.5) * (quarter ? 0.02 : 0.09), ring: o.ringMM * (0.7 + R() * 0.6), seed: Math.floor(R() * 1e6),
        rough: (R() - 0.5) * 0.08, lift: (R() - 0.5) * 0.12,
        knots: Array.from({ length: R() < (o.knotP ?? 0) ? 1 + Math.floor(R() * 2) : 0 }, () => ({ x: R() * bw, y: R(), r: 4 + R() * (o.knotR ?? 8) })),
      };
    });
    colData.push({ js, segs });
  }
  const [br, bg, bb] = o.base, [lr, lg, lb] = o.late;
  const lenMM = S;
  t.each((u, v, k) => {
    const xc = u * cols - o.off;
    const c = mod(Math.floor(xc), cols), xl = xc - Math.floor(xc), bx = xl * bw;
    const cd = colData[c]; let si = cd.js.length - 1;
    for (let i = 0; i < cd.js.length; i++) if (v >= cd.js[i]) si = i;
    const s = cd.segs[si], vs = mod(v - cd.js[si], 1), segLen = mod((cd.js[(si + 1) % cd.js.length] - cd.js[si]) || 1, 1) || 1;
    const by = vs * lenMM;
    // growth-ring figure: plank = plane through a log, tilted along its length -> cathedral arches
    const wob = fbm(bx / bw * 0.5 + c * 0.37, v, 1, 3, 3, s.seed) * 4 + gnoise(u * cols * 2, v * 40, cols * 2, 40, s.seed + 5) * 0.35;
    const dx = bx - bw / 2 - s.cx + wob * 2.2, dz = s.depth + by * s.tilt + wob * 1.5;
    let r = Math.sqrt(dx * dx + dz * dz);
    for (const kn of s.knots) { const kx = (bx - kn.x) / kn.r, ky = (by - kn.y * segLen * lenMM) / (kn.r * 1.7), d2 = kx * kx + ky * ky; r += 14 * Math.exp(-d2 * 0.35) ; }
    const ph = r / s.ring + 0.9 * gnoise(r / (s.ring * 4.5), 0.5, 65536, 7, s.seed) + 0.15 * gnoise(u * cols * 3, v * 24, cols * 3, 24, s.seed + 9), p = fract(ph);
    // latewood band + ring-porous earlywood pores
    const late = smooth(0.3, 0.85, p) * (1 - smooth(0.9, 1.0, p));
    const ringVar = 0.75 + 0.5 * hash(Math.floor(ph), s.seed, 7);
    const pore = Math.max(0, gnoise(u * (o.poreU ?? 700), v * (o.poreV ?? 110), o.poreU ?? 700, o.poreV ?? 110, 11 + c) - 0.2) * 2.2;
    const earlyPores = (0.35 + 0.65 * (1 - smooth(0.0, 0.35, p))) * pore;
    const streak = fbm(u, v, cols * 6, 2, 3, s.seed + 21);
    const fibre = gnoise(u * 1400, v * 9, 1400, 9, 3 + c) * 0.5 + gnoise(u * 360, v * 5, 360, 5, 4 + c) * 0.5;
    let knotDark = 0;
    for (const kn of s.knots) { const kx = (bx - kn.x) / kn.r, ky = (by - kn.y * segLen * lenMM) / (kn.r * 1.2); knotDark = Math.max(knotDark, 1 - smooth(0.6, 1.1, Math.sqrt(kx * kx + ky * ky))); }
    const cloud = fbm(u, v, 3, 3, 4, o.seed + 91) * (o.cloud ?? 0.12);
    let m = late * (o.lateK ?? 0.8) * ringVar;
    const tone = s.tone * (1 + cloud + streak * (o.streak ?? 0.18) + fibre * 0.045 - earlyPores * (o.poreDark ?? 0.25) - knotDark * 0.55);
    t.r[k] = mix(br, lr, m) * tone * (1 + s.warm); t.g[k] = mix(bg, lg, m) * tone; t.b[k] = mix(bb, lb, m) * tone * (1 - s.warm * 1.5);
    // height (mm): V-groove / micro-bevel at long edges and butt joints, pores, raised latewood
    const e = Math.min(bx, bw - bx), ej = Math.min(by, (segLen * lenMM) - by);
    const bev = o.grooveMM * (1 - smooth(0, o.bevelMM, e)) + o.grooveMM * 0.8 * (1 - smooth(0, o.bevelMM * 0.8, ej));
    t.h[k] = s.lift - bev - earlyPores * 0.035 + late * 0.012 + fibre * 0.006;
    // satin lacquer: smooth faces, pores and grooves rougher, soft wipe/buff patches
    const wipe = fbm(u, v, 5, 5, 4, o.seed + 17);
    t.rough[k] = clamp(o.rough + s.rough + wipe * 0.1 + earlyPores * 0.12 + late * 0.03 + (bev > 0.02 ? 0.25 : 0) + knotDark * 0.1, 0.1, 0.95);
    // darken the groove
    const gd = 1 - 0.45 * smooth(0, o.grooveMM, bev);
    t.r[k] *= gd; t.g[k] *= gd; t.b[k] *= gd;
  });
  return { t, mm };
}
