// One recipe per textures.json entry: (px, entry) -> { t: Tex, mm: mm per px, opts: save options }
// Colours are linear RGB. meanLum pins the mean linear luminance to what the runtime shaders were tuned
// against (interior.js / exterior.js texMean) so their tint/contrast maths keeps working.
import { Tex, lin, rng, hash, fbm, ridged, gnoise, worley, smooth, mix, mod, sat, clamp, blur } from './lib.mjs';
import { planks } from './wood.mjs';
import { tiles } from './tiles.mjs';
import { pebble, blade, depthAO } from './scatter.mjs';
import { weave, leather, PLAIN, TWILL, BASKET } from './fabric.mjs';

const S = (e) => e.scale_m * 1000;
const put = (t, k, c, f = 1) => { t.r[k] = c[0] * f; t.g[k] = c[1] * f; t.b[k] = c[2] * f; };
const lerp3 = (a, b, x) => [mix(a[0], b[0], x), mix(a[1], b[1], x), mix(a[2], b[2], x)];

// ---------------------------------------------------------------- plaster / render / concrete
function plaster(px, e, o) {
  const t = new Tex(px), sz = S(e);
  const fStip = Math.round(sz / (o.stipMM ?? 1.2)), fGrain = Math.round(sz / (o.grainMM ?? 3));
  t.each((u, v, k) => {
    const cloud = fbm(u, v, o.cloudF ?? 3, o.cloudF ?? 3, 5, 1);
    const dirt = Math.max(0, fbm(u, v, 5, 5, 5, 2) - 0.05);
    const stip = gnoise(u * fStip, v * fStip, fStip, fStip, 3);
    const w = worley(u, v, fGrain, fGrain, 4, 1); const grain = smooth(0.0, 0.5, w.f1);
    // trowel: sweeping low relief from warped ridged noise
    const wu = u + fbm(u, v, 2, 2, 3, 5) * 0.08, wv = v + fbm(u, v, 2, 2, 3, 6) * 0.08;
    const tf = o.trowF ?? 4, trow = ridged(wu, wv, tf, Math.max(1, Math.round(tf * (o.trowAniso ?? 1))), 4, 7);
    const pw = worley(u, v, fGrain * 2, fGrain * 2, 8, 1), pit = (o.pits && hash(pw.id, 1, 2) < 0.08 && pw.f1 < 0.25) ? 1 : 0;
    t.h[k] = trow * (o.trowMM ?? 0.08) + stip * (o.stipH ?? 0.02) + (1 - grain) * (o.grainH ?? 0.0) - pit * 0.25;
    const f = 1 + cloud * (o.cloud ?? 0.03) - dirt * (o.dirt ?? 0.04) + stip * (o.stipC ?? 0.01) - pit * 0.2 + (1 - grain) * (o.grainC ?? 0);
    put(t, k, o.col, f);
    t.rough[k] = (o.rough ?? 0.9) + stip * 0.02 - trow * (o.trowGloss ?? 0.05) + dirt * 0.03;
  });
  return t;
}

function concrete(px, e, o) {
  const t = new Tex(px), sz = S(e);
  const fp = Math.round(sz / (o.poreCellMM ?? 12)), fa = Math.round(sz / 2.2);
  t.each((u, v, k) => {
    const wu = u + fbm(u, v, 2, 2, 3, 11) * 0.05, wv = v + fbm(u, v, 2, 2, 3, 12) * 0.05;
    const cloud = fbm(wu, wv, 2, 2, 6, 13), cloud2 = fbm(u, v, 9, 9, 4, 14);
    const burn = smooth(0.05, 0.35, fbm(wu, wv, 3, 3, 4, 15)); // trowel-burnished patches
    const w = worley(u, v, fp, fp, 16, 1);
    const pr = (hash(w.id, 1, 3) < (o.poreDensity ?? 0.35)) ? (0.08 + 0.3 * hash(w.id, 2, 3)) * (o.poreSize ?? 1) : 0;
    const pore = pr ? 1 - smooth(pr * 0.6, pr, w.f1) : 0;
    const agg = gnoise(u * fa, v * fa, fa, fa, 17);
    const speck = Math.max(0, gnoise(u * fa * 2, v * fa * 2, fa * 2, fa * 2, 18) - 0.45) * 2;
    const f = 1 + cloud * (o.cloud ?? 0.18) + cloud2 * 0.05 + agg * (o.agg ?? 0.03) + speck * (o.speck ?? 0.06) + burn * (o.burnC ?? -0.04) - pore * 0.35;
    put(t, k, o.col, f);
    t.h[k] = -pore * 0.4 + agg * 0.015 + cloud2 * 0.03 + fbm(u, v, 6, 6, 3, 19) * (o.wave ?? 0.05);
    t.rough[k] = (o.rough ?? 0.7) - burn * (o.burnR ?? 0.2) + agg * 0.03 + pore * 0.2 + cloud2 * 0.04;
  });
  return t;
}

// ---------------------------------------------------------------- lawn
function lawn(px, e, o) {
  const t = new Tex(px), mm = S(e) / px, R = rng(o.seed), z = new Float32Array(px * px).fill(0);
  t.each((u, v, k) => { const n = fbm(u, v, 30, 30, 3, o.seed + 1); put(t, k, lerp3(o.soil, o.thatch, sat(0.5 + n)), 0.6 + 0.3 * n); t.h[k] = 0; t.rough[k] = 0.95; });
  const n = Math.round(px * px * (o.density ?? 0.09) * (1.37 / mm) ** 2);
  for (let i = 0; i < n; i++) {
    const x = R() * px, y = R() * px, u = x / px, v = y / px;
    const clump = fbm(u, v, 5, 5, 4, o.seed + 2), dry = smooth(0.1, 0.45, fbm(u, v, 3, 3, 4, o.seed + 3));
    let col = lerp3(o.green, o.yellow, sat(dry * 0.7 + (R() < 0.05 ? 0.6 : 0) + R() * 0.15));
    col = lerp3(col, o.dark, sat(0.5 - clump * 1.5) * 0.6);
    const vv = 0.8 + R() * 0.4;
    const len = (o.lenMM * (0.5 + R() * 0.8)) / mm, zb = R() * 4 - 4;
    blade(t, z, { x, y, a: R() * Math.PI * 2, len, w: (o.wMM * (0.7 + R() * 0.6)) / mm, h: 10 + R() * 12, z0: zb, bend: (R() - 0.5) * 0.3,
      col: [col[0] * vv * 0.55, col[1] * vv * 0.55, col[2] * vv * 0.55], tipCol: [col[0] * vv * 1.1, col[1] * vv * 1.1, col[2] * vv], dark: 0.1, rough: 0.55 + R() * 0.2, taper: 0.7 });
  }
  const lo = blur(z, px, px, 4 / mm, 2);
  t.ao = new Float32Array(px * px);
  for (let k = 0; k < px * px; k++) { const occ = clamp(1 - 0.04 * Math.max(0, lo[k] - z[k]), 0.45, 1) * clamp(0.55 + z[k] / 40, 0.5, 1); t.ao[k] = occ; t.r[k] *= occ; t.g[k] *= occ; t.b[k] *= occ; t.h[k] *= 0.15; }
  return t;
}

// ---------------------------------------------------------------- stone scatter (gravel, asphalt, soil)
function gravel(px, e, o) {
  const t = new Tex(px), mm = S(e) / px, R = rng(o.seed), z = new Float32Array(px * px).fill(-50);
  t.each((u, v, k) => { put(t, k, o.bed, 0.7 + 0.3 * fbm(u, v, 40, 40, 3, 5)); t.h[k] = -5; t.rough[k] = 0.95; });
  const area = S(e) ** 2, mean = o.sizeMM;
  const n = Math.round(area / (mean * mean * 0.55) * (o.cover ?? 1.8));
  for (let i = 0; i < n; i++) {
    const s = mean * (0.5 + R() * R() * 1.4), el = 0.6 + R() * 0.4;
    const ci = o.palette[Math.floor(R() * o.palette.length)], vv = 0.75 + R() * 0.5;
    const c = [ci[0] * vv, ci[1] * vv * (0.97 + R() * 0.06), ci[2] * vv * (0.95 + R() * 0.1)];
    pebble(t, z, { x: R() * px, y: R() * px, rx: s / 2 / mm, ry: s / 2 * el / mm, a: R() * Math.PI, h: s * 0.35 * (0.6 + R() * 0.4), z0: -s * 0.2 - R() * s * 0.4,
      col: c, rough: (o.rough ?? 0.75) + (R() - 0.5) * 0.15, sharp: o.sharp ?? 0.45, irr: o.irr ?? 0.18, seed: R() * 100, speck: o.speck ?? 0.08, bump: 0.1 });
  }
  t.ao = depthAO(t, z, blur, o.sizeMM / mm, 0.6 / o.sizeMM, 0.35);
  for (let k = 0; k < px * px; k++) { const a = t.ao[k]; t.r[k] *= a; t.g[k] *= a; t.b[k] *= a; }
  return t;
}

// ---------------------------------------------------------------- metals
function brushed(px, e, o) {
  const t = new Tex(px);
  t.each((u, v, k) => {
    // streaks along u: long along the brush direction, fine across
    const s1 = gnoise(u * 3, v * 900, 3, 900, 1) * 0.5 + gnoise(u * 6, v * 380, 6, 380, 2) * 0.35 + gnoise(u * 12, v * 900, 12, 900, 3) * 0.25;
    const cloud = fbm(u, v, 2, 2, 4, 4);
    const scratch = Math.max(0, gnoise(u * 2, v * 600, 2, 600, 5) - 0.7) * 3;
    put(t, k, o.col, 1 + s1 * (o.streakC ?? 0.06) + cloud * 0.04 - scratch * 0.03);
    t.h[k] = s1 * 0.004 - scratch * 0.004;
    t.rough[k] = o.rough + s1 * (o.streakR ?? 0.08) + cloud * 0.04 + scratch * 0.05;
  });
  return t;
}

// ---------------------------------------------------------------- marble
function marble(px, e, o) {
  const t = new Tex(px);
  t.each((u, v, k) => {
    const wu = u + fbm(u, v, 2, 2, 5, 1) * 0.25, wv = v + fbm(u, v, 2, 2, 5, 2) * 0.25;
    const n1 = fbm(wu, wv, 3, 2, 6, 3), n2 = fbm(wu + 0.3, wv, 6, 5, 5, 4);
    const vein = Math.exp(-Math.abs(n1) * 60) * 0.9 + Math.exp(-Math.abs(n2) * 120) * 0.45;
    const hair = Math.exp(-Math.abs(fbm(wu, wv + 0.2, 12, 10, 4, 5)) * 200) * 0.25;
    const cloud = fbm(u, v, 3, 3, 5, 6);
    const g = sat(vein + hair);
    const base = lerp3(o.col, o.warm, sat(0.5 + cloud * 1.5));
    put(t, k, lerp3(base, o.vein, g * 0.8), 1 + cloud * 0.04);
    t.h[k] = -g * 0.01 + fbm(u, v, 20, 20, 3, 7) * 0.003;
    t.rough[k] = o.rough + g * 0.06 + fbm(u, v, 8, 8, 3, 8) * 0.03;
  });
  return t;
}

// ---------------------------------------------------------------- tile face helpers
const stoneFace = (col, o = {}) => (u, v, id, hr, out) => {
  const ou = hr(6), ov = hr(7);
  const cloud = fbm(u + ou, v + ov, o.cf ?? 4, o.cf ?? 4, 5, 51);
  const bed = fbm(u + ou, v + ov, 2, o.bedF ?? 30, 3, 52) * (o.bed ?? 0.04);
  const fs = o.fossF ?? 120;
  const w = worley(u, v, fs, fs, 53, 1);
  const foss = hash(w.id, 5, 1) < (o.fossD ?? 0.12) ? 1 - smooth(0.12, 0.3, w.f1) : 0;
  const sp = gnoise(u * fs * 3, v * fs * 3, fs * 3, fs * 3, 54);
  const pit = hash(w.id, 6, 1) < (o.pitD ?? 0.05) ? 1 - smooth(0.05, 0.12, w.f1) : 0;
  const hue = (hr(4) - 0.5) * (o.hue ?? 0.04);
  const f = 1 + cloud * (o.cloud ?? 0.12) + bed + sp * (o.speck ?? 0.03) + foss * (o.foss ?? 0.1) - pit * 0.3;
  out.r = col[0] * f * (1 + hue); out.g = col[1] * f; out.b = col[2] * f * (1 - hue);
  out.h = sp * 0.01 - pit * 0.25 + cloud * 0.03;
  out.rough = (o.rough ?? 0.6) + sp * 0.03 + pit * 0.2 + cloud * (o.roughCloud ?? 0.06);
};
const glazeFace = (pal, o = {}) => (u, v, id, hr, out) => {
  const c = typeof pal === 'function' ? pal(hr) : pal;
  const ou = hr(6), ov = hr(7);
  const ripple = fbm(u + ou, v + ov, o.rf ?? 20, o.rf ?? 20, 3, 61);
  const spk = Math.max(0, gnoise(u * 700, v * 700, 700, 700, 62) - 0.6);
  const f = 1 + ripple * (o.rc ?? 0.015) - spk * (o.spk ?? 0.1);
  out.r = c[0] * f; out.g = c[1] * f; out.b = c[2] * f;
  out.h = ripple * (o.rh ?? 0.05);
  out.rough = (o.rough ?? 0.1) + Math.abs(ripple) * 0.03;
};

const PAL_POOL = [lin('#7fc4d6'), lin('#5fb0cc'), lin('#9fd5e0'), lin('#4c9ec0'), lin('#8ccde0'), lin('#6bb8d0')];
const PAL_HEX = [lin('#3f8fb8'), lin('#5aa6c8'), lin('#2f7aa6'), lin('#e2e6e4'), lin('#78bcd4'), lin('#3f8fb8')];
const pick = (P) => (hr) => P[Math.floor(hr(5) * P.length) % P.length];

// ---------------------------------------------------------------- recipes
export const RECIPES = {
  // Poly Haven laminate_floor_03 layout (interior.js OAK): 11 board columns, first groove at 99/186.18 of a column.
  oak_plank: (px, e) => {
    const { t, mm } = planks(px, { sizeMM: S(e), cols: 11, off: 99 / 186.18, joints: [1, 2], seed: 11,
      base: lin('#b08a5e'), late: lin('#7a5534'), toneVar: 0.1, hueVar: 0.05, ringMM: 4.5, lateK: 0.45,
      grooveMM: 0.9, bevelMM: 2.4, rough: 0.42, knotP: 0.12, knotR: 5, quarter: 0.3 });
    return { t, mm, opts: { meanLum: 0.19, normalK: 1 } };
  },
  parquet_brown: (px, e) => ({ ...planks(px, { sizeMM: S(e), cols: 18, off: 0, joints: [3, 4], seed: 21,
    base: lin('#8a5a36'), late: lin('#5a361e'), toneVar: 0.16, hueVar: 0.06, ringMM: 3.5, lateK: 0.5, streak: 0.14,
    grooveMM: 0.3, bevelMM: 0.8, rough: 0.4, knotP: 0.03, knotR: 3, quarter: 0.4, poreU: 700, poreV: 60 }), opts: {} }),
  larch_boards: (px, e) => ({ ...planks(px, { sizeMM: S(e), cols: 8, off: 0.13, joints: [1, 1], seed: 31,
    base: lin('#c08a55'), late: lin('#8a552c'), toneVar: 0.14, hueVar: 0.07, ringMM: 3.2, lateK: 0.75, streak: 0.2, poreDark: 0.08,
    grooveMM: 2.5, bevelMM: 2.2, rough: 0.72, knotP: 0.35, knotR: 7, quarter: 0.5, poreU: 500, poreV: 40 }), opts: {} }),

  limestone_tile_light: (px, e) => ({ ...tiles(px, { sizeMM: S(e), layout: { kind: 'grid', nx: 6, ny: 6 }, seed: 41, groutMM: 3, bevelMM: 1.5, bevelDepth: 0.5,
    groutDepth: 1.2, grout: lin('#9c968a'), groutRough: 0.95, tintVar: 0.06, tilt: 0.003, lip: 0.15,
    face: stoneFace(lin('#d2c8b4'), { cloud: 0.1, bed: 0.02, foss: 0.12, fossD: 0.1, speck: 0.03, rough: 0.62, hue: 0.06 }) }), opts: { meanLum: 0.36 } }),
  concrete_tile_grey: (px, e) => ({ ...tiles(px, { sizeMM: S(e), layout: { kind: 'grid', nx: 3, ny: 3 }, seed: 42, groutMM: 2.5, bevelMM: 1.2, bevelDepth: 0.4,
    groutDepth: 1, grout: lin('#585652'), groutRough: 0.95, tintVar: 0.05, tilt: 0.002,
    face: stoneFace(lin('#8e8b85'), { cloud: 0.16, cf: 3, bed: 0.02, foss: 0.0, speck: 0.06, pitD: 0.08, rough: 0.55, hue: 0.02, fossF: 200 }) }), opts: {} }),
  tile_white_square: (px, e) => ({ ...tiles(px, { sizeMM: S(e), layout: { kind: 'grid', nx: 10, ny: 10 }, seed: 43, groutMM: 2.5, bevelMM: 2, bevelDepth: 0.8,
    groutDepth: 0.8, grout: lin('#b3b0a8'), groutRough: 0.92, tintVar: 0.02, tilt: 0.004, lip: 0.2, roughVar: 0.03,
    face: glazeFace(lin('#e6e5e0'), { rough: 0.08, rh: 0.06 }) }), opts: {} }),
  tile_white_hex: (px, e) => ({ ...tiles(px, { sizeMM: S(e), layout: { kind: 'hex', nx: 7, ny: 8 }, seed: 44, groutMM: 2, bevelMM: 1.5, bevelDepth: 0.6,
    groutDepth: 0.7, grout: lin('#b0ada6'), groutRough: 0.92, tintVar: 0.025, tilt: 0.005, lip: 0.15, roughVar: 0.03,
    face: glazeFace(lin('#e4e3de'), { rough: 0.12, rh: 0.04, rf: 30 }) }), opts: {} }),
  pool_tile_blue: (px, e) => ({ ...tiles(px, { sizeMM: S(e), layout: { kind: 'grid', nx: 40, ny: 40 }, seed: 45, groutMM: 2, bevelMM: 1.5, bevelDepth: 0.6,
    groutDepth: 0.8, grout: lin('#c9cfcc'), groutRough: 0.9, tintVar: 0.06, tilt: 0.006, lip: 0.2,
    face: glazeFace(pick(PAL_POOL), { rough: 0.1, rf: 60, rc: 0.04 }) }), opts: {} }),
  pool_tile_hex_blue: (px, e) => ({ ...tiles(px, { sizeMM: S(e), layout: { kind: 'hex', nx: 14, ny: 16 }, seed: 46, groutMM: 1.8, bevelMM: 1.2, bevelDepth: 0.5,
    groutDepth: 0.7, grout: lin('#d4d8d6'), groutRough: 0.9, tintVar: 0.05, tilt: 0.006, lip: 0.15,
    face: glazeFace(pick(PAL_HEX), { rough: 0.1, rf: 60, rc: 0.04 }) }), opts: {} }),
  concrete_pavers: (px, e) => ({ ...tiles(px, { sizeMM: S(e), layout: { kind: 'grid', nx: 8, ny: 16, stagger: 0.5 }, seed: 47, groutMM: 4, bevelMM: 5, bevelDepth: 3,
    groutDepth: 2, grout: lin('#8a8173'), groutRough: 0.98, groutDirt: 0.35, tintVar: 0.1, tilt: 0.02, lip: 1.2,
    face: stoneFace(lin('#9a968e'), { cloud: 0.12, cf: 6, bed: 0, foss: 0.15, fossF: 500, fossD: 0.3, speck: 0.12, pitD: 0.1, rough: 0.85, hue: 0.03 }) }), opts: {} }),
  fibre_cement_panel: (px, e) => {
    const face = stoneFace(lin('#8d8c88'), { cloud: 0.08, cf: 3, bed: 0.015, bedF: 60, foss: 0, speck: 0.03, pitD: 0.02, rough: 0.8, hue: 0.01, fossF: 250 });
    return { ...tiles(px, { sizeMM: S(e), layout: { kind: 'grid', nx: 2, ny: 3 }, seed: 48, groutMM: 8, bevelMM: 0.8, bevelDepth: 0.4,
      groutDepth: 6, grout: lin('#2c2c2c'), groutRough: 0.95, tintVar: 0.04, tilt: 0.0005, lip: 0,
      face: (u, v, id, hr, out, lx, ly, tw, th) => {
        face(u, v, id, hr, out);
        // 4 fixing rivets per panel, 60 mm in from the edges
        const dx = Math.abs(lx) * tw - (tw / 2 - 60), dy = Math.abs(ly) * th - (th / 2 - 60), d = Math.sqrt(dx * dx + dy * dy);
        if (d < 7) { const f = d < 5 ? 0.75 : 1.08; out.r *= f; out.g *= f; out.b *= f; out.h += d < 5 ? 0.3 : -0.1; if (d < 5) out.rough = 0.5; }
      } }), opts: {} };
  },

  plaster_white_int: (px, e) => ({ t: plaster(px, e, { col: lin('#e9e6e0'), cloud: 0.03, dirt: 0.04, trowMM: 0.35, trowF: 6, stipH: 0.22, stipMM: 2.2, stipC: 0.02, rough: 0.9 }), mm: S(e) / px, opts: { normalK: 3 } }),
  render_white_ext: (px, e) => ({ t: plaster(px, e, { col: lin('#e8e6e0'), cloud: 0.08, dirt: 0.16, trowMM: 0.4, stipH: 0.3, stipMM: 2.5, stipC: 0.04, grainMM: 3.5, grainH: 1.0, grainC: -0.08, pits: 1, rough: 0.93, cloudF: 2 }), mm: S(e) / px, opts: { aoK: 0.35, aoR: 2, normalK: 2.2 } }),
  plaster_white_ext_alt: (px, e) => ({ t: plaster(px, e, { col: lin('#e6e4de'), cloud: 0.035, dirt: 0.05, trowMM: 0.7, trowF: 5, trowAniso: 0.6, stipH: 0.12, stipMM: 1.6, stipC: 0.01, pits: 1, rough: 0.88, trowGloss: 0.1 }), mm: S(e) / px, opts: { normalK: 2.5 } }),
  concrete_screed: (px, e) => ({ t: concrete(px, e, { col: lin('#9a9893'), cloud: 0.2, agg: 0.03, speck: 0.05, poreDensity: 0.25, poreSize: 0.8, rough: 0.72, burnR: 0.3, burnC: -0.06 }), mm: S(e) / px, opts: { meanLum: 0.31 } }),
  concrete_smooth_light: (px, e) => ({ t: concrete(px, e, { col: lin('#bdbbb5'), cloud: 0.1, agg: 0.02, speck: 0.03, poreDensity: 0.12, poreCellMM: 10, poreSize: 0.45, rough: 0.8, burnR: 0.1, burnC: 0.0, wave: 0.03 }), mm: S(e) / px, opts: { meanLum: 0.48 } }),
  asphalt: (px, e) => {
    const t = gravel(px, e, { seed: 51, sizeMM: 7, cover: 1.3, bed: lin('#2a2a2a'), palette: [lin('#4a4a48'), lin('#5c5b58'), lin('#3a3a3a'), lin('#6e6b66'), lin('#35332f')], rough: 0.85, sharp: 0.25, irr: 0.3, speck: 0.15 });
    t.each((u, v, k) => { const bind = smooth(-0.2, 0.3, fbm(u, v, 30, 30, 3, 53)); const f = mix(1, 0.62, bind * 0.6); t.r[k] *= f; t.g[k] *= f; t.b[k] *= f; t.h[k] = Math.max(t.h[k], -1.2); t.rough[k] = clamp(t.rough[k] + 0.05, 0, 1); });
    return { t, mm: S(e) / px, opts: { aoK: 0.2, aoR: 3 } };
  },
  gravel: (px, e) => ({ t: gravel(px, e, { seed: 52, sizeMM: 28, cover: 2.4, bed: lin('#6d665c'), palette: [lin('#c8c0b2'), lin('#a89e8e'), lin('#8a8478'), lin('#d6cfc2'), lin('#7c6e5e'), lin('#b5a48a')], rough: 0.72, sharp: 0.5, irr: 0.2 }), mm: S(e) / px, opts: { meanLum: 0.2 } }),
  soil_beds: (px, e) => {
    const t = gravel(px, e, { seed: 53, sizeMM: 5, cover: 1.6, bed: lin('#3a2a1e'), palette: [lin('#4a3524'), lin('#3e2c1e'), lin('#56402c'), lin('#33251a'), lin('#7a6a58')], rough: 0.95, sharp: 0.8, irr: 0.45, speck: 0.2 });
    t.each((u, v, k) => { const m = fbm(u, v, 4, 4, 4, 54); const f = 1 + m * 0.25; t.r[k] *= f; t.g[k] *= f; t.b[k] *= f * 0.97; });
    return { t, mm: S(e) / px, opts: {} };
  },
  bark_mulch: (px, e) => {
    const t = new Tex(px), mm = S(e) / px, R = rng(55), z = new Float32Array(px * px).fill(-30);
    t.each((u, v, k) => { put(t, k, lin('#2e2016'), 0.7 + 0.3 * fbm(u, v, 30, 30, 3, 5)); t.h[k] = -30; t.rough[k] = 0.95; });
    const area = S(e) ** 2, P = [lin('#6b4a32'), lin('#5a3c28'), lin('#7d5a3e'), lin('#4a3222'), lin('#8a6a4a')];
    for (let i = 0, n = Math.round(area / 900 * 2.2); i < n; i++) { // bark chips 18-58 mm, flat
      const s = 18 + R() * 40, c = P[Math.floor(R() * P.length)], vv = 0.7 + R() * 0.5;
      pebble(t, z, { x: R() * px, y: R() * px, rx: s / 2 / mm, ry: s * (0.25 + R() * 0.25) / mm, a: R() * Math.PI, h: 3 + R() * 4, z0: -12 + R() * 10,
        col: [c[0] * vv, c[1] * vv, c[2] * vv], rough: 0.9, sharp: 0.15, irr: 0.35, seed: R() * 100, speck: 0.35, bump: 0.3 });
    }
    for (let i = 0, n = Math.round(area / 400); i < n; i++) { // pine needles
      const c = R() < 0.5 ? lin('#8a6a3e') : lin('#6a4a2a'), vv = 0.7 + R() * 0.5;
      blade(t, z, { x: R() * px, y: R() * px, a: R() * Math.PI * 2, len: (40 + R() * 50) / mm, w: 1.3 / mm, h: 1, z0: -8 + R() * 10, bend: (R() - 0.5) * 0.15,
        col: [c[0] * vv, c[1] * vv, c[2] * vv], rough: 0.8, taper: 0.3 });
    }
    t.ao = depthAO(t, z, blur, 10 / mm, 0.025, 0.35);
    for (let k = 0; k < px * px; k++) { const a = t.ao[k]; t.r[k] *= a; t.g[k] *= a; t.b[k] *= a; t.h[k] *= 0.3; }
    return { t, mm, opts: {} };
  },
  grass_lawn_01: (px, e) => ({ t: lawn(px, e, { seed: 61, green: lin('#5f8a2e'), yellow: lin('#9a9a44'), dark: lin('#2f5a1e'), soil: lin('#3a3020'), thatch: lin('#5a5030'), lenMM: 30, wMM: 3, density: 0.1 }), mm: S(e) / px, opts: { normalK: 0.5 } }),
  grass_lawn_02: (px, e) => ({ t: lawn(px, e, { seed: 62, green: lin('#4a7a28'), yellow: lin('#7e8a3a'), dark: lin('#27481a'), soil: lin('#30281a'), thatch: lin('#4a4428'), lenMM: 26, wMM: 2.6, density: 0.13 }), mm: S(e) / px, opts: { normalK: 0.5 } }),

  marble_white: (px, e) => ({ t: marble(px, e, { col: lin('#e8e6e2'), warm: lin('#dcd8d0'), vein: lin('#8a8a8c'), rough: 0.18 }), mm: S(e) / px, opts: {} }),

  fabric_linen_grey: (px, e) => ({ ...weave(px, { sizeMM: S(e), n: 160, pattern: PLAIN, warpCol: lin('#8a8884'), weftCol: lin('#7e7c78'), threadVar: 0.08, slub: 0.25, fuzz: 0.15, gap: 0.1, threadMM: 0.35, rough: 0.9, mottle: 0.06 }), opts: {} }),
  fabric_woven_light: (px, e) => ({ ...weave(px, { sizeMM: S(e), n: 200, pattern: BASKET, warpCol: lin('#d4cfc4'), weftCol: lin('#c9c3b6'), threadVar: 0.05, slub: 0.12, fuzz: 0.1, gap: 0.08, threadMM: 0.3, rough: 0.88 }), opts: {} }),
  fabric_linen_natural: (px, e) => ({ ...weave(px, { sizeMM: S(e), n: 120, pattern: PLAIN, warpCol: lin('#d8d0c2'), weftCol: lin('#cfc6b6'), threadVar: 0.1, slub: 0.35, fuzz: 0.18, gap: 0.12, threadMM: 0.4, rough: 0.92, mottle: 0.05 }), opts: {} }),
  rug_grey: (px, e) => ({ ...weave(px, { sizeMM: S(e), n: 64, pattern: TWILL, warpCol: lin('#8c8b88'), weftCol: lin('#d2d0ca'), threadVar: 0.12, slub: 0.3, fuzz: 0.3, gap: 0.06, threadMM: 1.5, rough: 0.95, seed: 9 }), opts: {} }),
  rug_wool_beige: (px, e) => {
    const t = new Tex(px), mm = S(e) / px, n = Math.round(S(e) / 3.2), col = lin('#cbbba0');
    t.each((u, v, k) => {
      const w = worley(u, v, n, n, 71, 0.8); const tuft = Math.pow(1 - smooth(0.1, 0.75, w.f1), 0.7);
      const fib = gnoise(u * n * 3, v * n * 3, n * 3, n * 3, 72); const cl = fbm(u, v, 3, 3, 4, 73), tone = (hash(w.id, 1, 1) - 0.5) * 0.12;
      put(t, k, col, (0.62 + 0.38 * tuft) * (1 + fib * 0.1 + cl * 0.08 + tone));
      t.h[k] = tuft * 1.2 + fib * 0.15; t.rough[k] = 0.95;
    });
    return { t, mm, opts: { aoK: 0.4, aoR: 3 } };
  },
  leather_dark: (px, e) => ({ ...leather(px, { sizeMM: S(e), cells: 90, col: lin('#4a2e1e'), cloud: 0.15, rough: 0.55 }), opts: {} }),
  leather_white: (px, e) => ({ ...leather(px, { sizeMM: S(e), cells: 70, col: lin('#dcd8d0'), cloud: 0.04, rough: 0.5 }), opts: {} }),

  metal_dark_painted: (px, e) => {
    const t = new Tex(px), f = 96;
    t.each((u, v, k) => { const p = fbm(u, v, f, f, 3, 81), c = fbm(u, v, 3, 3, 4, 82);
      put(t, k, lin('#1d1e20'), 1 + c * 0.08 + p * 0.03); t.h[k] = p * 0.012; t.rough[k] = 0.42 + p * 0.04 + c * 0.05; });
    return { t, mm: S(e) / px, opts: {} };
  },
  metal_brushed: (px, e) => ({ t: brushed(px, e, { col: lin('#b8b8b6'), rough: 0.32 }), mm: S(e) / px, opts: {} }),
  metal_brushed_black: (px, e) => ({ t: brushed(px, e, { col: lin('#2a2b2d'), rough: 0.36, streakC: 0.12 }), mm: S(e) / px, opts: {} }),
  roof_metal_seam_dark: (px, e) => {
    const t = new Tex(px), sz = S(e), pitch = sz / 4; // standing seams every 500 mm
    t.each((u, v, k) => {
      const x = mod(u * sz, pitch), d = Math.min(x, pitch - x);
      const seam = 1 - smooth(6, 12, d), stiff = Math.max(0, 1 - Math.abs(Math.abs(x - pitch / 2) - 80) / 4);
      const oil = fbm(u, v, 1, 6, 4, 91) * 0.3 + fbm(u, v, 4, 4, 3, 92) * 0.7, streak = gnoise(u * 60, v * 3, 60, 3, 93);
      put(t, k, lin('#383e42'), 1 + oil * 0.07 + streak * 0.03 - seam * 0.05 + (d < 3 ? -0.2 : 0));
      t.h[k] = seam * 25 + stiff * 0.5 + oil * 0.05;
      t.rough[k] = 0.42 + oil * 0.08 + streak * 0.04 + seam * 0.05;
    });
    return { t, mm: sz / px, opts: { normalK: 0.5 } };
  },

  // ---- extra sets (not in textures.json; see EXTRA in gen_textures.mjs) --------------------------
  rock_limestone: (px, e) => {
    const t = new Tex(px);
    t.each((u, v, k) => {
      const wu = u + fbm(u, v, 2, 2, 4, 101) * 0.15, wv = v + fbm(u, v, 2, 2, 4, 102) * 0.15;
      const rid = ridged(wu, wv, 3, 3, 6, 103), cloud = fbm(u, v, 3, 3, 5, 104);
      const xt = gnoise(u * 300, v * 300, 300, 300, 105), sp = Math.max(0, gnoise(u * 160, v * 160, 160, 160, 106) - 0.4) * 1.6;
      const crack = Math.exp(-Math.abs(fbm(wu, wv, 4, 4, 4, 107)) * 90);
      const lich = smooth(0.25, 0.4, fbm(u, v, 6, 6, 4, 108)) * 0.5;
      const c = lerp3(lin('#b3aa9b'), lin('#8f877a'), sat(0.5 + cloud * 2));
      put(t, k, lerp3(c, lin('#6f6a52'), lich), 1 + xt * 0.06 - sp * 0.12 - crack * 0.35 + (rid - 0.5) * 0.15);
      t.h[k] = rid * 2.5 + xt * 0.15 - crack * 0.8 - sp * 0.1;
      t.rough[k] = 0.82 + xt * 0.05 + crack * 0.1 - rid * 0.05;
    });
    return { t, mm: S(e) / px, opts: { aoK: 0.2, aoR: 6 } };
  },
  concrete_aggregate: (px, e) => {
    const t = gravel(px, e, { seed: 111, sizeMM: 8, cover: 0.45, bed: lin('#a9a498'), palette: [lin('#9a9488'), lin('#b0a898'), lin('#8a857c'), lin('#b8af9f'), lin('#a0968a')], rough: 0.7, sharp: 0.35, irr: 0.25 });
    t.each((u, v, k) => {
      const stain = smooth(0.1, 0.5, fbm(u, v, 3, 3, 5, 112)), drip = smooth(0.3, 0.8, fbm(u, v, 8, 2, 3, 113));
      const pw = worley(u, v, 90, 90, 114, 1), pore = hash(pw.id, 1, 1) < 0.2 ? 1 - smooth(0.05, 0.14, pw.f1) : 0;
      const f = (1 - stain * 0.16 - drip * 0.05 - pore * 0.3) * (1 + fbm(u, v, 12, 12, 3, 115) * 0.06);
      t.r[k] *= f; t.g[k] *= f; t.b[k] *= f * 0.99;
      t.h[k] = Math.max(t.h[k], -3) - pore * 0.6; t.rough[k] = clamp(t.rough[k] + stain * 0.05 + pore * 0.1, 0, 1);
    });
    return { t, mm: S(e) / px, opts: { meanLum: 0.3, aoK: 0.15, aoR: 3 } };
  },
};
