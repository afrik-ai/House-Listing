import * as THREE from 'three';
import { Builder, rbox, box, cyl, lathe, boxUV, M4 } from '../geom.js';

// Media wall: floor-to-(near)ceiling panel with vertical oak slats on black felt, a floating anthracite
// low unit and a wall-mounted 65" TV. Back face (-Z) is plain white so it reads as a partition from the hall.
export const media_wall = {
  // params: { width: 3.2, height: 2.6, unitWidth: 2.4, tv: 1.45 (screen width), tvY: 1.2 (centre), backFinish: 'white_matte' }
  build(p, ctx) {
    const B = new Builder(ctx.mats);
    const W = p.width ?? 3.2, H = p.height ?? 2.6, core = p.core ?? 0.1;
    const z0 = -core / 2 - 0.035, z1 = z0 + core;         // core box
    B.add(p.backFinish || 'white_matte', rbox([-W / 2, 0, z0], [W / 2, H, z1], 0.006));
    B.add('felt_dark', box([-W / 2 + 0.01, 0.0, z1], [W / 2 - 0.01, H - 0.01, z1 + 0.012]));
    const pitch = 0.042, sw = 0.026;
    const n = Math.floor((W - 0.02) / pitch);
    const off = (W - n * pitch) / 2;
    for (let i = 0; i < n; i++) {
      const a = -W / 2 + off + i * pitch + (pitch - sw) / 2;
      B.add('oak', rbox([a, 0.0, z1 + 0.012], [a + sw, H - 0.01, z1 + 0.030], 0.003, 1, 'y'));
    }
    const zf = z1 + 0.03;
    // floating low unit
    const UW = p.unitWidth ?? 2.4, U0 = 0.22, U1 = 0.62, UD = 0.42, ux = p.tvX ?? 0;
    B.add('anthracite_dark', box([ux - UW / 2, U0, zf], [ux + UW / 2, U1, zf + UD - 0.018]));
    const nd = Math.round(UW / 0.6);
    for (let i = 0; i < nd; i++) {
      const a = ux - UW / 2 + i * UW / nd, b = a + UW / nd;
      B.add('anthracite', rbox([a + 0.0015, U0 + 0.0015, zf + UD - 0.018], [b - 0.0015, U1 - 0.0015, zf + UD], 0.0025, 2));
    }
    B.add('oak', rbox([ux - UW / 2 - 0.01, U1, zf - 0.0], [ux + UW / 2 + 0.01, U1 + 0.03, zf + UD + 0.01], 0.003, 2, 'x'));
    // TV (65"): black body, thin bezel, glossy screen. Wall-mounted, 2.5 cm off the slats.
    const tw = p.tv ?? 1.45, th = tw * 9 / 16, ty = p.tvY ?? 1.28, tz = zf + 0.025;
    B.add('black_plastic', rbox([ux - tw / 2 - 0.006, ty - th / 2 - 0.006, tz], [ux + tw / 2 + 0.006, ty + th / 2 + 0.006, tz + 0.026], 0.004));
    B.add(ctx.mats.get('screen'), box([ux - tw / 2, ty - th / 2, tz + 0.026], [ux + tw / 2, ty + th / 2, tz + 0.0275]));
    B.add('black_plastic', box([ux - 0.3, ty - 0.2, zf], [ux + 0.3, ty + 0.2, tz]));
    const root = B.build('media_wall');
    root.traverse((o) => { if (o.isMesh && o.material === ctx.mats.get('screen')) { o.name = 'TV_screen'; o.userData.interact = 'tv'; } });
    root.userData.colliders = [[[-W / 2, 0, z0], [W / 2, H, zf + 0.03]], [[ux - UW / 2, 0.2, zf], [ux + UW / 2, U1 + 0.03, zf + UD + 0.01]]];
    return root;
  },
};

// Modern L-shaped sofa: plinth + seat cushions + leaning back cushions + slim arms, fabric.
// Main section along X (back at -Z), chaise at +X (or -X with chaise:'left') extending toward +Z.
export const sofa = {
  // params: { length: 3.0, depth: 0.98, chaise: 'right'|'left'|null, chaiseLength: 1.65, fabric: 'fabric_grey',
  //           frame: null|'walnut' (outdoor teak frame), seatH: 0.44, pillows: [['fabric_rust', x], ...] }
  build(p, ctx) {
    const B = new Builder(ctx.mats);
    const L = p.length ?? 3.0, D = p.depth ?? 0.98, CL = p.chaiseLength ?? 1.65;
    const fab = p.fabric || 'fabric_grey';
    const base = p.frame || fab;
    const side = p.chaise === 'left' ? -1 : p.chaise === 'right' ? 1 : 0;
    const armW = 0.16, backD = 0.22, seatTop = p.seatH ?? 0.44, baseTop = seatTop - 0.15, backTop = p.backH ?? 0.78;
    const legH = 0.07;
    const z0 = -D / 2, z1 = D / 2;
    // legs (black, recessed)
    const legs = (x0, x1, za, zb) => { for (const x of [x0 + 0.08, x1 - 0.08]) for (const z of [za + 0.08, zb - 0.08]) B.add('black_metal', box([x - 0.02, 0, z - 0.02], [x + 0.02, legH, z + 0.02])); };
    // main plinth
    const mx0 = -L / 2, mx1 = L / 2;
    B.add(base, rbox([mx0, legH, z0], [mx1, baseTop, z1], 0.03, 3));
    legs(mx0, mx1, z0, z1);
    // chaise plinth
    let cx0 = 0, cx1 = 0;
    if (side) {
      cx0 = side > 0 ? mx1 - 1.0 : mx0; cx1 = cx0 + 1.0;
      B.add(base, rbox([cx0, legH, z1 - 0.02], [cx1, baseTop, z0 + CL], 0.03, 3));
      legs(cx0, cx1, z1, z0 + CL);
    }
    // back
    B.add(base, rbox([mx0, baseTop - 0.02, z0], [mx1, backTop - 0.12, z0 + backD], 0.04, 3));
    // arms: both ends of the main section when no chaise; only the far end otherwise
    const armEnds = side ? [-side] : [-1, 1];
    for (const e of armEnds) {
      const xa = e < 0 ? mx0 : mx1 - armW;
      B.add(base, rbox([xa, baseTop - 0.02, z0], [xa + armW, seatTop + 0.16, z1], 0.05, 3));
    }
    // seat cushions
    const inner0 = armEnds.includes(-1) ? mx0 + armW : mx0, inner1 = armEnds.includes(1) ? mx1 - armW : mx1;
    const seatX1 = side > 0 ? cx0 : inner1, seatX0 = side < 0 ? cx1 : inner0;
    const n = Math.max(1, Math.round((seatX1 - seatX0) / 0.75));
    const cw = (seatX1 - seatX0) / n;
    for (let i = 0; i < n; i++) B.add(fab, rbox([seatX0 + i * cw + 0.004, baseTop, z0 + backD], [seatX0 + (i + 1) * cw - 0.004, seatTop, z1 + 0.01], 0.05, 3));
    if (side) B.add(fab, rbox([cx0 + (side < 0 ? 0 : 0.004), baseTop, z0 + backD], [cx1 - (side > 0 ? 0 : 0.004), seatTop, z0 + CL + 0.01], 0.05, 3));
    // back cushions (leaning)
    const bx0 = inner0, bx1 = inner1;
    const nb = Math.max(1, Math.round((bx1 - bx0) / 0.8));
    const bw = (bx1 - bx0) / nb;
    for (let i = 0; i < nb; i++) {
      const g = rbox([-bw / 2 + 0.006, 0, -0.09], [bw / 2 - 0.006, backTop - seatTop + 0.02, 0.09], 0.07, 3);
      g.applyMatrix4(new THREE.Matrix4().makeRotationX(-0.18));
      g.translate(bx0 + (i + 0.5) * bw, seatTop - 0.01, z0 + backD + 0.07);
      B.add(fab, g);
    }
    // throw pillows (square, tilted back)
    for (const [mat, x, zOff = 0, rot = 0] of p.pillows || []) {
      const g = rbox([-0.23, 0, -0.07], [0.23, 0.46, 0.07], 0.07, 3);
      g.applyMatrix4(new THREE.Matrix4().makeRotationX(-0.32)).applyMatrix4(new THREE.Matrix4().makeRotationZ(rot));
      g.translate(x, seatTop - 0.02, z0 + backD + 0.22 + zOff);
      B.add(mat, g);
    }
    const root = B.build('sofa');
    const cols = [[[mx0, 0, z0], [mx1, backTop, z1]]];
    if (side) cols.push([[cx0, 0, z1 - 0.02], [cx1, seatTop, z0 + CL]]);
    root.userData.colliders = cols;
    return root;
  },
};

// Dining / desk table: slab top (oak/quartz/walnut) on black steel sled or 4 legs.
export const table = {
  // params: { w: 2.4, d: 1.0, h: 0.75, top: 'oak', thick: 0.04, legs: 'sled'|'four'|'trestle', legMat: 'black_metal', drawer: false }
  build(p, ctx) {
    const B = new Builder(ctx.mats);
    const W = p.w ?? 2.4, D = p.d ?? 1.0, H = p.h ?? 0.75, T = p.thick ?? 0.04;
    const lm = p.legMat || 'black_metal';
    B.add(p.top || 'oak', rbox([-W / 2, H - T, -D / 2], [W / 2, H, D / 2], 0.006, 2, 'x'));
    const s = 0.04;
    if ((p.legs || 'sled') === 'sled') {
      for (const e of [-1, 1]) {
        const x = e * (W / 2 - 0.22);
        B.add(lm, box([x - s / 2, H - T - 0.03, -D / 2 + 0.07], [x + s / 2, H - T, D / 2 - 0.07]));
        B.add(lm, box([x - s / 2, 0, -D / 2 + 0.07], [x + s / 2, 0.02, D / 2 - 0.07]));
        for (const z of [-D / 2 + 0.07, D / 2 - 0.07 - s]) B.add(lm, box([x - s / 2, 0, z], [x + s / 2, H - T, z + s]));
      }
    } else {
      const r = p.legR ?? 0.022;
      for (const ex of [-1, 1]) for (const ez of [-1, 1]) {
        const x = ex * (W / 2 - 0.06), z = ez * (D / 2 - 0.06);
        if (p.legs === 'round') B.add(lm, cyl(r, H - T, [x, 0, z], 16, r * 0.8));
        else B.add(lm, box([x - s / 2, 0, z - s / 2], [x + s / 2, H - T, z + s / 2]));
      }
      if (p.apron) B.add(p.apron, box([-W / 2 + 0.06, H - T - 0.08, -D / 2 + 0.06], [W / 2 - 0.06, H - T, D / 2 - 0.06]));
    }
    if (p.drawer) {
      B.add(p.top || 'oak', box([-0.3, H - T - 0.1, -D / 2 + 0.05], [0.3, H - T, D / 2 - 0.02]));
      B.add('black_metal', box([-0.08, H - T - 0.055, D / 2 - 0.02], [0.08, H - T - 0.045, D / 2 - 0.005]));
    }
    return B.build('table');
  },
};

// Dining chair: oak frame, upholstered seat, curved oak back rail. Front +Z. Seat 0.46.
export const dining_chair = {
  build(p, ctx) {
    const B = new Builder(ctx.mats);
    const fr = p.frame || 'oak', seat = p.seat || 'fabric_natural';
    const W = 0.46, D = 0.5, SH = 0.46, BH = 0.82;
    for (const ex of [-1, 1]) {
      // front legs (slightly tapered)
      B.add(fr, cyl(0.016, SH - 0.04, [ex * (W / 2 - 0.035), 0, D / 2 - 0.04], 12, 0.019));
      // back legs rise to the back rail with a slight rake
      const g = new THREE.CylinderGeometry(0.019, 0.016, BH, 12);
      g.applyMatrix4(new THREE.Matrix4().makeRotationX(0.08));
      g.translate(ex * (W / 2 - 0.035), BH / 2, -D / 2 + 0.05);
      B.add(fr, boxUV(g));
    }
    B.add(fr, box([-W / 2 + 0.02, SH - 0.075, -D / 2 + 0.03], [W / 2 - 0.02, SH - 0.04, D / 2 - 0.03]));
    B.add(seat, rbox([-W / 2 + 0.01, SH - 0.045, -D / 2 + 0.04], [W / 2 - 0.01, SH + 0.015, D / 2 - 0.005], 0.02, 3));
    // curved back rail: arc segment of a torus-ish bent slab
    const rail = new THREE.CylinderGeometry(0.9, 0.9, 0.11, 32, 1, true, -0.27, 0.54);
    rail.rotateY(Math.PI);
    rail.translate(0, BH - 0.1, -D / 2 + 0.07 + 0.9 - 0.005);
    const railMesh = rail; railMesh.scale?.(1, 1, 1);
    B.add(fr, boxUV(rail));
    const rail2 = new THREE.CylinderGeometry(0.885, 0.885, 0.11, 32, 1, true, -0.27, 0.54);
    rail2.rotateY(Math.PI);
    rail2.translate(0, BH - 0.1, -D / 2 + 0.07 + 0.9 - 0.005);
    const idx = rail2.index.array; for (let i = 0; i < idx.length; i += 3) { const t = idx[i]; idx[i] = idx[i + 2]; idx[i + 2] = t; }
    rail2.computeVertexNormals();
    B.add(fr, boxUV(rail2));
    return B.build('dining_chair');
  },
};

// Open shelving: black steel uprights + oak shelves (or all-oak). Back at -Z.
export const shelf_unit = {
  // params: { w: 1.2, h: 2.0, d: 0.35, levels: [0.05, 0.45, ...] (shelf tops), frame: 'black_metal', board: 'oak', back: null }
  build(p, ctx) {
    const B = new Builder(ctx.mats);
    const W = p.w ?? 1.2, H = p.h ?? 2.0, D = p.d ?? 0.35, t = p.thick ?? 0.025, u = 0.022;
    const levels = p.levels || [0.08, 0.46, 0.84, 1.22, 1.6, H - 0.02];
    const fr = p.frame || 'black_metal';
    for (const ex of [-1, 1]) for (const ez of [-1, 1]) B.add(fr, box([ex * W / 2 - (ex > 0 ? u : 0), 0, ez * D / 2 - (ez > 0 ? u : 0)], [ex * W / 2 + (ex < 0 ? u : 0), H, ez * D / 2 + (ez < 0 ? u : 0)]));
    for (const y of levels) B.add(p.board || 'oak', rbox([-W / 2 + (p.inset ?? 0), y - t, -D / 2], [W / 2 - (p.inset ?? 0), y, D / 2], 0.003, 1, 'x'));
    if (p.back) B.add(p.back, box([-W / 2, 0, -D / 2], [W / 2, H, -D / 2 + 0.01]));
    return B.build('shelf_unit');
  },
};

// Sideboard / dresser / nightstand / bench: carcass with drawer or door grid, optional legs or floating.
export const cabinet = {
  // params: { w, h, d, body: 'oak', fronts: 'oak', cols: 2, rows: 3, doors: false, legs: 0.12|0 (leg height), legMat,
  //           top: null|'quartz'|..., handle: 'bar'|'none'|'groove', floatY: 0 }
  build(p, ctx) {
    const B = new Builder(ctx.mats);
    const W = p.w ?? 1.6, H = p.h ?? 0.75, D = p.d ?? 0.45, L = p.legs ?? 0, fy = p.floatY ?? 0;
    const body = p.body || 'oak', fronts = p.fronts || body;
    const y0 = fy + L, y1 = fy + H;
    B.add(body, rbox([-W / 2, y0, -D / 2], [W / 2, y1, D / 2 - 0.02], 0.004, 2, 'x'));
    if (p.top) B.add(p.top, rbox([-W / 2 - 0.005, y1, -D / 2], [W / 2 + 0.005, y1 + 0.02, D / 2 + 0.005], 0.003));
    const cols = p.cols ?? 2, rows = p.rows ?? 1, g = 0.004, inset = 0.012;
    const fw = (W - 2 * inset) / cols, fh = (H - L - 2 * inset) / rows;
    for (let c = 0; c < cols; c++) for (let r = 0; r < rows; r++) {
      const a = -W / 2 + inset + c * fw, b = a + fw, ya = y0 + inset + r * fh, yb = ya + fh;
      B.add(fronts, rbox([a + g / 2, ya + g / 2, D / 2 - 0.02], [b - g / 2, yb - g / 2, D / 2], 0.003, 2, p.doors ? 'y' : 'x'));
      if ((p.handle || 'bar') === 'bar') {
        const hx = p.doors ? (c % 2 ? a + 0.04 : b - 0.04) : (a + b) / 2;
        const hy = p.doors ? (ya + yb) / 2 : yb - 0.045;
        const len = p.doors ? Math.min(0.2, fh * 0.4) : Math.min(0.16, fw * 0.35);
        if (p.doors) B.add('black_metal', rbox([hx - 0.006, hy - len / 2, D / 2 + 0.002], [hx + 0.006, hy + len / 2, D / 2 + 0.02], 0.004));
        else B.add('black_metal', rbox([hx - len / 2, hy - 0.006, D / 2 + 0.002], [hx + len / 2, hy + 0.006, D / 2 + 0.02], 0.004));
      } else if (p.handle === 'knob') {
        const hx = (a + b) / 2, hy = (ya + yb) / 2;
        B.add(p.knobMat || 'brass', cyl(0.014, 0.022, [hx, hy, D / 2], 16, null, 'z'));
      }
    }
    if (L > 0) {
      const lm = p.legMat || 'black_metal';
      for (const ex of [-1, 1]) for (const ez of [-1, 1]) B.add(lm, cyl(0.015, L, [ex * (W / 2 - 0.05), fy, ez * (D / 2 - 0.06)], 12, 0.012));
    }
    return B.build('cabinet');
  },
};

// A row of books standing on a shelf along X (spines face +Z). Optional lying stack at one end.
// params: { length: 0.8, seed, depth: [0.14, 0.2], height: [0.19, 0.27], lean: true, stack: 0|n, palette: [...] }
const PALETTE = ['#e8e1d3', '#c9b99a', '#2f3b45', '#8a3b2b', '#56684f', '#c78d3b', '#d7c9b8', '#1f1f1f', '#a79b8a', '#6a7d8c', '#b85c3c', '#eeeae3', '#394536', '#7a5a44'];
export const books = {
  build(p, ctx) {
    const R = ctx.rng;
    const cover = [], pages = [];
    const pal = p.palette || PALETTE;
    const Lr = p.length ?? 0.8;
    const [d0, d1] = p.depth || [0.14, 0.2];
    const [h0, h1] = p.height || [0.19, 0.27];
    const col = new THREE.Color();
    const push = (w, h, d, m, c) => {
      col.set(c);
      const t = 0.003;
      // covers: two boards + spine
      const parts = [box([-w / 2, 0, -d / 2], [-w / 2 + t, h, d / 2]), box([w / 2 - t, 0, -d / 2], [w / 2, h, d / 2]), box([-w / 2, 0, d / 2 - t], [w / 2, h, d / 2])];
      for (const g of parts) { g.applyMatrix4(m); addColor(g, col); cover.push(g); }
      const pg = box([-w / 2 + t, 0.004, -d / 2 + 0.002], [w / 2 - t, h - 0.004, d / 2 - t]);
      pg.applyMatrix4(m); pages.push(pg);
    };
    let x = -Lr / 2;
    const stackN = p.stack || 0;
    const endX = stackN ? Lr / 2 - 0.3 : Lr / 2;
    let lastLean = false;
    while (x < endX - 0.02) {
      const w = 0.018 + R() * 0.035, h = h0 + R() * (h1 - h0), d = d0 + R() * (d1 - d0);
      if (x + w > endX) break;
      const c = pal[Math.floor(R() * pal.length)];
      const m = new THREE.Matrix4();
      if (p.lean !== false && !lastLean && R() < 0.06 && x + w + h * 0.3 < endX) {
        // one leaning book
        const a = 0.28;
        m.makeTranslation(x + w / 2 + Math.sin(a) * h * 0.5, 0, 0).multiply(new THREE.Matrix4().makeRotationZ(-a));
        x += w + Math.sin(a) * h + 0.004;
        lastLean = true;
      } else { m.makeTranslation(x + w / 2, 0, (d1 - d) / 2 - (d1 - d0) / 2 + 0.0); x += w + 0.0015; lastLean = false; }
      push(w, h, d, m, c);
    }
    if (stackN) {
      let y = 0;
      for (let i = 0; i < stackN; i++) {
        const w = 0.2 + R() * 0.07, h = 0.02 + R() * 0.03, d = 0.14 + R() * 0.06;
        const m = new THREE.Matrix4().makeTranslation(Lr / 2 - 0.15 + (R() - 0.5) * 0.02, y, 0).multiply(new THREE.Matrix4().makeRotationY((R() - 0.5) * 0.25))
          .multiply(new THREE.Matrix4().makeRotationZ(Math.PI / 2)).multiply(new THREE.Matrix4().makeTranslation(-h / 2, -w / 2, 0));
        // lying book: its "height" axis is along X
        push(h, w, d, m, pal[Math.floor(R() * pal.length)]);
        y += h;
      }
    }
    const B = new Builder(ctx.mats);
    if (!ctx.mats.m.book_cover_vc) { const m = ctx.mats.get('book_cover').clone(); m.vertexColors = true; m.name = 'P07_book_cover_vc'; ctx.mats.m.book_cover_vc = m; }
    for (const g of cover) B.add('book_cover_vc', g);
    for (const g of pages) B.add('pages', g);
    return B.build('books');
  },
};

function addColor(g, c) {
  const n = g.attributes.position.count;
  const a = new Float32Array(n * 3);
  const v = 0.9 + Math.random() * 0.1;
  for (let i = 0; i < n; i++) { a[i * 3] = c.r * v; a[i * 3 + 1] = c.g * v; a[i * 3 + 2] = c.b * v; }
  g.setAttribute('color', new THREE.BufferAttribute(a, 3));
}

// Framed art (canvas or print with passe-partout). Back at -Z, origin bottom centre.
export const art = {
  // params: { w: 0.9, h: 1.2, style: 'shapes'|'lines'|'landscape'|'photo_bw', seed, frame: 'black_matte'|'oak'|'white_lacquer', mat: 0.08 }
  build(p, ctx) {
    const B = new Builder(ctx.mats);
    const W = p.w ?? 0.9, H = p.h ?? 1.2, fd = p.depth ?? 0.03, fw = p.frameW ?? 0.02, mt = p.mat ?? 0;
    const fm = p.frame || 'black_matte';
    B.add(fm, box([-W / 2, 0, -fd / 2], [-W / 2 + fw, H, fd / 2]));
    B.add(fm, box([W / 2 - fw, 0, -fd / 2], [W / 2, H, fd / 2]));
    B.add(fm, box([-W / 2 + fw, 0, -fd / 2], [W / 2 - fw, fw, fd / 2]));
    B.add(fm, box([-W / 2 + fw, H - fw, -fd / 2], [W / 2 - fw, H, fd / 2]));
    if (mt > 0) B.add('paper', box([-W / 2 + fw, fw, -fd / 2], [W / 2 - fw, H - fw, fd / 2 - 0.008]));
    const iw = W - 2 * fw - 2 * mt, ih = H - 2 * fw - 2 * mt;
    const g = new THREE.PlaneGeometry(iw, ih); g.translate(0, H / 2, fd / 2 - (mt > 0 ? 0.0075 : 0.004));
    B.add(ctx.mats.artMaterial(p.seed ?? 1, p.style || 'shapes', iw / ih), g);
    return B.build('art');
  },
};

// Planter with a plant model. params: { plant, variant, pot: 'cylinder'|'taper'|'bowl', r: 0.2, h: 0.4, mat: 'concrete', plantScale: 1 }
export const planter = {
  deps: (p) => (p.plant ? [p.plant] : []),
  build(p, ctx) {
    const B = new Builder(ctx.mats);
    const r = p.r ?? 0.2, h = p.h ?? 0.4, shape = p.pot || 'taper';
    let prof;
    if (shape === 'cylinder') prof = [[0.001, 0], [r, 0], [r, h], [r - 0.012, h], [r - 0.012, 0.03]];
    else if (shape === 'bowl') prof = [[0.001, 0], [r * 0.55, 0], [r * 0.9, h * 0.35], [r, h * 0.8], [r, h], [r - 0.012, h], [r - 0.012, h * 0.8]];
    else prof = [[0.001, 0], [r * 0.72, 0], [r, h], [r - 0.012, h], [r * 0.72 - 0.012, 0.03]];
    B.add(p.mat || 'concrete', lathe(prof, [0, 0, 0], 40));
    const soilY = h - 0.03;
    B.add('soil', cyl(r - 0.013, 0.004, [0, soilY - 0.004, 0], 32));
    if (p.plant) {
      const plant = ctx.model(p.plant, p.variant);
      const s = p.plantScale ?? 1;
      plant.scale.multiplyScalar(s);
      plant.position.set(0, soilY - 0.01, 0);
      plant.rotation.y = p.plantRot ?? 0;
      B.object(plant);
    }
    const root = B.build('planter');
    root.userData.colliders = [[[-r, 0, -r], [r, h + 0.3, r]]];
    return root;
  },
};

// Table lamp: ceramic/brass base + linen drum shade (shade glows at night via the 'led' material).
export const table_lamp = {
  build(p, ctx) {
    const B = new Builder(ctx.mats);
    const H = p.h ?? 0.52, base = p.base || 'ceramic_white';
    B.add(base, lathe([[0.001, 0], [0.07, 0], [0.085, 0.06], [0.09, 0.14], [0.06, 0.24], [0.015, 0.27], [0.012, H - 0.2]], [0, 0, 0], 32));
    B.add('brass', cyl(0.006, 0.2, [0, H - 0.22, 0], 8));
    const shade = new THREE.CylinderGeometry(p.shadeR ?? 0.14, (p.shadeR ?? 0.14) + 0.02, 0.2, 40, 1, true);
    shade.translate(0, H - 0.1, 0);
    if (!ctx.mats.m.shade) {
      const m = ctx.mats.get('fabric_natural').clone(); m.name = 'P07_shade'; m.side = THREE.DoubleSide;
      m.emissive = new THREE.Color('#ffcf94'); m.emissiveIntensity = 0; m.userData.night = 1.4; ctx.mats.m.shade = m;
    }
    B.add('shade', boxUV(shade));
    return B.build('table_lamp');
  },
};

// Throw pillows on beds/chairs: params { list: [[mat, x, z, rotY, tilt, size]] }
export const cushions = {
  build(p, ctx) {
    const B = new Builder(ctx.mats);
    for (const [mat, x, z, ry = 0, tilt = -0.3, s = 0.46] of p.list || []) {
      const g = rbox([-s / 2, 0, -0.07], [s / 2, s, 0.07], 0.07, 3);
      g.applyMatrix4(new THREE.Matrix4().makeRotationX(tilt)).applyMatrix4(new THREE.Matrix4().makeRotationY(ry));
      g.translate(x, 0, z);
      B.add(mat, g);
    }
    return B.build('cushions');
  },
};

// Generic box/slab (plinths, shelves, niches). params: { size:[w,h,d], mat, r }
export const slab = {
  build(p, ctx) {
    const B = new Builder(ctx.mats);
    const [w, h, d] = p.size;
    B.add(p.mat || 'oak', rbox([-w / 2, 0, -d / 2], [w / 2, h, d / 2], p.r ?? 0.003, 2, p.grain || 'x'));
    return B.build('slab');
  },
};
