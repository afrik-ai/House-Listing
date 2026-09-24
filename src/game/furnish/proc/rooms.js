import * as THREE from 'three';
import { Builder, rbox, box, cyl, lathe, tube, boxUV } from '../geom.js';

const CLOTH = ['#2f3a45', '#e9e4da', '#8a3b2b', '#56684f', '#c9b99a', '#1f1f1f', '#a7b3bd', '#d7c2a3', '#6a4e3c', '#f4f1ea', '#394536', '#9a8f84', '#c7684a', '#46525e'];

function colorize(g, hex, jitter = 0.08, R = Math.random) {
  const c = new THREE.Color(hex);
  const v = 1 - jitter / 2 + R() * jitter;
  const n = g.attributes.position.count, a = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { a[i * 3] = c.r * v; a[i * 3 + 1] = c.g * v; a[i * 3 + 2] = c.b * v; }
  g.setAttribute('color', new THREE.BufferAttribute(a, 3));
  return g;
}
// Hanging garment silhouette (shoulders, sleeves, tapering body) in the XY plane: width w along X, hanging from
// y=0 down to -h, thickness t along Z (centred). Extruded with a soft bevel so it reads as fabric, not a slab.
function garment(w, h, t, R = Math.random) {
  const s = new THREE.Shape();
  const sw = w / 2, sl = Math.min(h * 0.75, 0.55 + R() * 0.15), cuff = sw + 0.02;
  s.moveTo(-0.05, -0.01); s.lineTo(-sw + 0.02, -0.05); s.lineTo(-cuff, -0.1); s.lineTo(-cuff - 0.01, -sl);
  s.lineTo(-sw + 0.03, -sl + 0.01); s.lineTo(-sw + 0.07, -0.2); s.lineTo(-sw + 0.05, -h); s.lineTo(sw - 0.05, -h);
  s.lineTo(sw - 0.07, -0.2); s.lineTo(sw - 0.03, -sl + 0.01); s.lineTo(cuff + 0.01, -sl); s.lineTo(cuff, -0.1);
  s.lineTo(sw - 0.02, -0.05); s.lineTo(0.05, -0.01); s.quadraticCurveTo(0, -0.05, -0.05, -0.01);
  const g = new THREE.ExtrudeGeometry(s, { depth: Math.max(0.004, t - 0.02), bevelEnabled: true, bevelThickness: 0.01, bevelSize: 0.008, bevelSegments: 1, curveSegments: 3 });
  g.translate(0, 0, -(t - 0.02) / 2);
  return boxUV(g);
}
function clothMat(ctx) {
  if (!ctx.mats.m.cloth_vc) {
    const base = ctx.mats.get('fabric_natural');
    const m = base.clone(); m.name = 'P07_cloth_vc'; m.vertexColors = true; m.color = new THREE.Color('#ffffff');
    ctx.mats.m.cloth_vc = m;
  }
  return 'cloth_vc';
}

// Garments hanging from a rail along X (rail at height y). Returns nothing; adds to builder.
function garments(B, ctx, x0, x1, y, zc, long = false) {
  const R = ctx.rng, cm = clothMat(ctx);
  let x = x0 + 0.04;
  while (x < x1 - 0.05) {
    const t = 0.025 + R() * 0.035, h = (long ? 0.95 : 0.62) + R() * (long ? 0.25 : 0.2), w = 0.42 + R() * 0.06;
    const g = garment(w, h - 0.06, t, R);
    g.rotateY(Math.PI / 2); g.translate(0, -0.06, 0);
    g.applyMatrix4(new THREE.Matrix4().makeRotationZ((R() - 0.5) * 0.06));
    g.translate(x + t / 2, y, zc);
    B.add(cm, colorize(g, CLOTH[Math.floor(R() * CLOTH.length)], 0.1, R));
    // hanger
    const hg = new THREE.TorusGeometry(0.02, 0.003, 3, 6, Math.PI); hg.rotateY(Math.PI / 2); hg.translate(x + t / 2, y - 0.005, zc);
    B.add('black_metal', boxUV(hg));
    B.add('black_metal', box([x + t / 2 - 0.002, y - 0.07, zc - 0.2], [x + t / 2 + 0.002, y - 0.06, zc + 0.2]));
    x += t + 0.02 + R() * 0.03;
  }
}

// Folded clothes stack on a shelf at y (centre x, z).
function folded(B, ctx, x, y, z, n, w = 0.3, d = 0.25) {
  const R = ctx.rng, cm = clothMat(ctx);
  let yy = y;
  for (let i = 0; i < n; i++) {
    const h = 0.03 + R() * 0.03;
    const g = rbox([-w / 2, 0, -d / 2], [w / 2, h, d / 2], 0.012, 1);
    g.applyMatrix4(new THREE.Matrix4().makeRotationY((R() - 0.5) * 0.08));
    g.translate(x + (R() - 0.5) * 0.015, yy, z);
    B.add(cm, colorize(g, CLOTH[Math.floor(R() * CLOTH.length)], 0.1, R));
    yy += h;
  }
}

// Built-in wardrobe, floor to (near) ceiling. Back at -Z.
export const wardrobe = {
  // params: { w: 2.4, h: 2.6, d: 0.62, doors: 4, fronts: 'white_lacquer', body: 'white_matte', handle: 'bar'|'none' }
  build(p, ctx) {
    const B = new Builder(ctx.mats);
    const W = p.w ?? 2.4, H = p.h ?? 2.6, D = p.d ?? 0.62, n = p.doors ?? Math.round(W / 0.6);
    const fr = p.fronts || 'white_lacquer';
    B.add(p.body || 'white_matte', box([-W / 2, 0.08, -D / 2], [W / 2, H, D / 2 - 0.02]));
    B.add('black_matte', box([-W / 2 + 0.01, 0, -D / 2], [W / 2 - 0.01, 0.08, D / 2 - 0.06]));
    const dw = W / n;
    for (let i = 0; i < n; i++) {
      const a = -W / 2 + i * dw, b = a + dw;
      B.add(fr, rbox([a + 0.0015, 0.082, D / 2 - 0.02], [b - 0.0015, H - 0.002, D / 2], 0.0025, 2, 'y'));
      if ((p.handle || 'bar') === 'bar') {
        const hx = i % 2 === 0 ? b - 0.045 : a + 0.045;
        B.add('black_metal', rbox([hx - 0.006, 0.85, D / 2 + 0.002], [hx + 0.006, 1.45, D / 2 + 0.024], 0.004));
      }
    }
    const root = B.build('wardrobe');
    root.userData.colliders = [[[-W / 2, 0, -D / 2], [W / 2, H, D / 2]]];
    return root;
  },
};

// Walk-in closet system: oak carcass sections, open front. Back at -Z.
export const closet = {
  // params: { h: 2.3, d: 0.55, sections: [{type:'hang'|'hang2'|'shelves'|'drawers'|'shoes', w}], seed }
  build(p, ctx) {
    const B = new Builder(ctx.mats);
    const R = ctx.rng;
    const H = p.h ?? 2.3, D = p.d ?? 0.55, t = 0.019;
    const secs = p.sections;
    const W = secs.reduce((s, q) => s + q.w, 0);
    const body = p.body || 'oak';
    let x = -W / 2;
    const side = (xx) => B.add(body, box([xx, 0, -D / 2], [xx + t, H, D / 2]));
    side(x);
    B.add(body, box([-W / 2, H - t, -D / 2], [W / 2, H, D / 2]));
    B.add('white_matte', box([-W / 2, 0, -D / 2], [W / 2, H, -D / 2 + 0.008]));
    for (const s of secs) {
      const x0 = x + t, x1 = x + s.w;
      if (s.type === 'hang' || s.type === 'hang2') {
        const rails = s.type === 'hang2' ? [1.05, 2.0] : [1.9];
        for (const ry of rails) {
          B.add('black_metal', cyl(0.012, x1 - x0, [(x0 + x1) / 2, ry, 0], 12, null, 'x'));
          garments(B, ctx, x0, x1, ry, 0, s.type === 'hang');
        }
        if (s.type === 'hang2') B.add(body, box([x0, 1.12, -D / 2], [x1, 1.12 + t, D / 2]));
        B.add(body, box([x0, 2.02, -D / 2], [x1, 2.02 + t, D / 2]));
        // boxes on the top shelf
        folded(B, ctx, (x0 + x1) / 2, 2.02 + t, -0.02, 3, Math.min(0.34, x1 - x0 - 0.08));
      } else if (s.type === 'shelves') {
        for (let y = 0.35; y < H - 0.2; y += 0.36) {
          B.add(body, box([x0, y, -D / 2], [x1, y + t, D / 2 - 0.01]));
          const n = Math.max(1, Math.floor((x1 - x0) / 0.36));
          for (let k = 0; k < n; k++) if (R() < 0.85) folded(B, ctx, x0 + (k + 0.5) * (x1 - x0) / n, y + t, 0, 2 + Math.floor(R() * 4), 0.3);
        }
      } else if (s.type === 'drawers') {
        for (let i = 0; i < 4; i++) {
          const ya = 0.05 + i * 0.22;
          B.add(body, rbox([x0 + 0.002, ya + 0.002, D / 2 - 0.02], [x1 - 0.002, ya + 0.218, D / 2], 0.002, 2));
          B.add('black_metal', box([(x0 + x1) / 2 - 0.08, ya + 0.17, D / 2], [(x0 + x1) / 2 + 0.08, ya + 0.18, D / 2 + 0.015]));
        }
        B.add(body, box([x0, 0.94, -D / 2], [x1, 0.94 + t, D / 2]));
        for (let y = 1.3; y < H - 0.2; y += 0.36) {
          B.add(body, box([x0, y, -D / 2], [x1, y + t, D / 2 - 0.01]));
          folded(B, ctx, (x0 + x1) / 2, y + t, 0, 2 + Math.floor(R() * 3), 0.3);
        }
        folded(B, ctx, (x0 + x1) / 2, 0.94 + t, 0, 3, 0.3);
      } else if (s.type === 'shoes') {
        for (let i = 0; i < 5; i++) {
          const y = 0.12 + i * 0.22;
          const g = box([x0, 0, -D / 2 + 0.05], [x1, t, D / 2 - 0.02]);
          g.applyMatrix4(new THREE.Matrix4().makeRotationX(0.25)); g.translate(0, y, 0);
          B.add(body, g);
          for (let k = 0; k < Math.floor((x1 - x0) / 0.22); k++) {
            const col = ['#1f1f1f', '#6a4e3c', '#e9e4da', '#8a3b2b', '#2f3a45'][Math.floor(R() * 5)];
            for (const off of [-0.045, 0.045]) {
              const sh = rbox([-0.04, 0, -0.13], [0.04, 0.09, 0.13], 0.03, 1);
              sh.applyMatrix4(new THREE.Matrix4().makeRotationX(0.25));
              sh.translate(x0 + 0.11 + k * 0.22 + off, y + 0.03, 0.02);
              B.add('cloth_vc', colorize(sh, col, 0.05, R));
            }
          }
        }
        clothMat(ctx);
        for (let y = 1.3; y < H - 0.2; y += 0.36) B.add(body, box([x0, y, -D / 2], [x1, y + t, D / 2 - 0.01]));
      }
      side(x1 - t);
      x = x1;
    }
    const root = B.build('closet');
    root.userData.colliders = [[[-W / 2, 0, -D / 2], [W / 2, H, D / 2]]];
    return root;
  },
};

// Coat rail with hooks + coats (cloakroom / vestibule). Back at -Z. Origin at floor.
export const coat_rail = {
  build(p, ctx) {
    const B = new Builder(ctx.mats);
    const W = p.w ?? 1.2, y = p.y ?? 1.75, R = ctx.rng, cm = clothMat(ctx);
    B.add('oak', rbox([-W / 2, y - 0.05, -0.02], [W / 2, y + 0.05, 0.0], 0.003));
    const n = Math.max(2, Math.round(W / 0.2));
    for (let i = 0; i < n; i++) {
      const x = -W / 2 + (i + 0.5) * W / n;
      B.add('black_metal', cyl(0.007, 0.06, [x, y, 0], 10, null, 'z'));
      if (R() < (p.fill ?? 0.7)) {
        const h = 0.7 + R() * 0.35, w = 0.4 + R() * 0.08, t = 0.08 + R() * 0.05;
        const g = garment(w, h, t, R); g.translate(0, 0, t / 2);
        g.applyMatrix4(new THREE.Matrix4().makeRotationX(0.06));
        g.translate(x, y + 0.02, 0.01);
        B.add(cm, colorize(g, ['#2f3a45', '#6a4e3c', '#1f1f1f', '#c9b99a', '#56684f', '#8a3b2b'][Math.floor(R() * 6)], 0.1, R));
      }
    }
    return B.build('coat_rail');
  },
};

// Walk-in shower: fixed glass panel with black profiles, ceiling rain head, wall mixer + hand shower,
// linear floor drain. The wall is at -Z; the glass runs along +Z edge from x0 (params.glassFrom) for glassLen.
export const shower = {
  build(p, ctx) {
    const B = new Builder(ctx.mats);
    const W = p.w ?? 1.2, D = p.d ?? 0.9, GL = p.glassLen ?? 0.9;
    const H = 2.0;
    let col;
    if (p.glassEdge === 'left' || p.glassEdge === 'right') {
      // glass along a side edge, starting at the back wall and running GL toward +Z (entry beyond it)
      const xg = p.glassEdge === 'left' ? -W / 2 : W / 2;
      B.add(ctx.mats.get('glass'), box([xg - 0.004, 0.02, -D / 2], [xg + 0.004, H, -D / 2 + GL]));
      B.add('black_metal', box([xg - 0.012, 0, -D / 2], [xg + 0.012, 0.025, -D / 2 + GL]));
      B.add('black_metal', box([xg - 0.012, 0, -D / 2], [xg + 0.012, H, -D / 2 + 0.02]));
      B.add('black_metal', box([xg - 0.01, H - 0.02, -D / 2 + GL - 0.02], [xg + 0.01, H, -D / 2 + GL]));
      const wx = p.glassEdge === 'left' ? W / 2 : -W / 2;
      B.add('black_metal', box([Math.min(xg, wx), H - 0.02, -D / 2 + GL - 0.02], [Math.max(xg, wx), H, -D / 2 + GL]));
      col = [[xg - 0.03, 0, -D / 2], [xg + 0.03, H, -D / 2 + GL]];
    } else {
      const gx = p.glassSide === 'right' ? W / 2 - GL : -W / 2, zg = D / 2;
      B.add(ctx.mats.get('glass'), box([gx, 0.02, zg - 0.004], [gx + GL, H, zg + 0.004]));
      B.add('black_metal', box([gx, 0, zg - 0.012], [gx + GL, 0.025, zg + 0.012]));
      const wallX = p.glassSide === 'right' ? W / 2 : -W / 2;
      B.add('black_metal', box([wallX - (wallX > 0 ? 0.02 : 0), 0, zg - 0.012], [wallX + (wallX > 0 ? 0 : 0.02), H, zg + 0.012]));
      const fx = p.glassSide === 'right' ? gx : gx + GL;
      B.add('black_metal', box([fx - 0.01, H - 0.02, -D / 2], [fx + 0.01, H, zg]));
      col = [[gx, 0, zg - 0.03], [gx + GL, H, zg + 0.03]];
    }
    // rain head on an arm from the back wall
    B.add('black_metal', cyl(0.012, 0.3, [0, 2.12, -D / 2 + 0.15], 12, null, 'z'));
    B.add('black_metal', rbox([-0.15, 2.07, -D / 2 + 0.16], [0.15, 2.09, -D / 2 + 0.46], 0.008));
    // thermostatic mixer + hand shower on the back wall
    B.add('black_metal', rbox([-0.14, 1.02, -D / 2], [0.14, 1.1, -D / 2 + 0.03], 0.01));
    for (const x of [-0.11, 0.11]) B.add('black_metal', cyl(0.022, 0.035, [x, 1.06, -D / 2 + 0.03], 16, null, 'z'));
    B.add('black_metal', cyl(0.008, 0.9, [0.3, 1.1, -D / 2 + 0.025], 10));
    B.add('black_metal', cyl(0.018, 0.22, [0.3, 1.55, -D / 2 + 0.05], 16, 0.024));
    // linear drain along the back wall
    B.add('black_metal', box([-W / 2 + 0.1, 0.0, -D / 2 + 0.06], [W / 2 - 0.1, 0.004, -D / 2 + 0.12]));
    const root = B.build('shower');
    root.userData.colliders = [col];
    return root;
  },
};

// Heated towel ladder (black) with a draped towel. Wall-mounted, back at -Z, origin at floor.
export const towel_rail = {
  build(p, ctx) {
    const B = new Builder(ctx.mats);
    const W = p.w ?? 0.5, y0 = p.y0 ?? 0.3, H = p.h ?? 1.2;
    for (const x of [-W / 2, W / 2]) B.add('black_metal', cyl(0.013, H, [x, y0, 0.06], 12));
    for (let y = y0 + 0.08; y < y0 + H; y += 0.12) B.add('black_metal', cyl(0.009, W, [0, y, 0.06], 10, null, 'x'));
    for (const y of [y0 + 0.1, y0 + H - 0.1]) for (const x of [-W / 2, W / 2]) B.add('black_metal', cyl(0.008, 0.05, [x, y, 0.03], 8, null, 'z'));
    if (p.towel !== false) {
      const col = p.towelColor || '#f2efe9';
      const ty = y0 + H - 0.28;
      const m = clothMat(ctx);
      B.add(m, colorize(rbox([-W / 2 + 0.05, ty - 0.45, 0.075], [W / 2 - 0.05, ty + 0.01, 0.095], 0.008), col, 0.02));
      B.add(m, colorize(rbox([-W / 2 + 0.05, ty - 0.35, 0.03], [W / 2 - 0.05, ty + 0.01, 0.048], 0.008), col, 0.02));
      B.add(m, colorize(rbox([-W / 2 + 0.05, ty - 0.005, 0.03], [W / 2 - 0.05, ty + 0.025, 0.095], 0.012), col, 0.02));
    }
    return B.build('towel_rail');
  },
};

// Wall mirror: round or rectangular, thin black frame, optional LED halo. Back at -Z, origin bottom centre.
export const mirror = {
  build(p, ctx) {
    const B = new Builder(ctx.mats);
    const W = p.w ?? 0.6, H = p.h ?? 0.8;
    if (p.shape === 'round') {
      const r = W / 2;
      const ring = new THREE.TorusGeometry(r, 0.008, 8, 64); ring.translate(0, r, 0.012); B.add(p.frame || 'black_metal', boxUV(ring));
      const g = new THREE.CircleGeometry(r - 0.004, 64); g.translate(0, r, 0.015); B.add('mirror', boxUV(g));
      const back = new THREE.CylinderGeometry(r - 0.01, r - 0.01, 0.012, 48); back.rotateX(Math.PI / 2); back.translate(0, r, 0.006); B.add('black_matte', boxUV(back));
    } else {
      B.add(p.frame || 'black_metal', rbox([-W / 2, 0, 0], [W / 2, H, 0.02], 0.004));
      const g = new THREE.PlaneGeometry(W - 0.016, H - 0.016); g.translate(0, H / 2, 0.0205); B.add('mirror', boxUV(g));
    }
    return B.build('mirror');
  },
};

// Bathroom toiletries cluster (soap pump, bottles, cup with toothbrushes, tray). Origin = surface point.
export const toiletries = {
  build(p, ctx) {
    const B = new Builder(ctx.mats);
    if (!ctx.mats.m.amber) ctx.mats.plain('amber', '#6b3a17', 0.12, 0, { transparent: false });
    B.add('marble', rbox([-0.14, 0, -0.07], [0.14, 0.012, 0.07], 0.004));
    B.add('amber', lathe([[0.001, 0.012], [0.032, 0.012], [0.034, 0.03], [0.034, 0.15], [0.02, 0.17], [0.012, 0.18]], [-0.08, 0, 0], 24));
    B.add('black_metal', cyl(0.009, 0.035, [-0.08, 0.18, 0], 10));
    B.add('black_metal', box([-0.08, 0.205, -0.004], [-0.045, 0.215, 0.004]));
    B.add('ceramic_white', lathe([[0.001, 0.012], [0.026, 0.012], [0.028, 0.02], [0.028, 0.13], [0.01, 0.14], [0.008, 0.165]], [0.0, 0, 0.01], 24));
    B.add('black_matte', cyl(0.011, 0.02, [0, 0.16, 0.01], 12));
    // cup + 2 brushes
    B.add('ceramic_black', lathe([[0.001, 0.012], [0.03, 0.012], [0.034, 0.11], [0.03, 0.11], [0.026, 0.02]], [0.08, 0, -0.01], 24));
    for (const [dx, col] of [[-0.008, 'plastic_white'], [0.01, 'terracotta']]) {
      const g = new THREE.CylinderGeometry(0.004, 0.004, 0.18, 8); g.rotateZ(dx * 12); g.translate(0.08 + dx, 0.12, -0.01); B.add(col, boxUV(g));
    }
    return B.build('toiletries');
  },
};

// Boiler room plant: wall-hung combi boiler + hot water cylinder + expansion vessel + pipework. Back at -Z.
export const boiler = {
  build(p, ctx) {
    const B = new Builder(ctx.mats);
    B.add('plastic_white', rbox([-0.22, 1.2, -0.3], [0.22, 1.92, 0.05], 0.02));
    B.add('black_plastic', rbox([-0.15, 1.24, 0.05], [0.15, 1.3, 0.056], 0.004));
    for (let i = 0; i < 4; i++) B.add('steel', cyl(0.011, 1.2, [-0.12 + i * 0.08, 0, -0.22], 10));
    B.add('plastic_white', cyl(0.3, 1.75, [0.75, 0, -0.02], 40));
    B.add('plastic_white', lathe([[0.3, 0], [0.29, 0.06], [0.2, 0.11], [0.001, 0.13]], [0.75, 1.75, -0.02], 40));
    B.add('terracotta', cyl(0.13, 0.36, [-0.62, 1.3, -0.12], 24));
    // expansion-vessel wall bracket: back plate on the wall, arm, and a steel strap round the vessel
    B.add('steel', box([-0.68, 1.38, -0.33], [-0.56, 1.56, -0.315]));
    B.add('steel', box([-0.64, 1.45, -0.315], [-0.6, 1.49, -0.24]));
    B.add('steel', cyl(0.134, 0.035, [-0.62, 1.45, -0.12], 24));
    B.add('steel', cyl(0.012, 0.25, [-0.62, 1.66, -0.12], 8));
    for (const y of [0.35, 1.45]) B.add('steel', cyl(0.011, 0.9, [0.3, y, -0.22], 10, null, 'x'));
    const root = B.build('boiler');
    root.userData.colliders = [[[-0.25, 0, -0.33], [1.06, 1.9, 0.33]]];
    return root;
  },
};

// Stack of wall-mounted floating shelves (oak) - for laundry/bath/office. Back at -Z. params { w, d, levels:[y...] }
export const wall_shelves = {
  build(p, ctx) {
    const B = new Builder(ctx.mats);
    const W = p.w ?? 0.9, D = p.d ?? 0.22, t = p.t ?? 0.03;
    for (const y of p.levels || [1.2]) B.add(p.mat || 'oak', rbox([-W / 2, y - t, -D / 2], [W / 2, y, D / 2], 0.003, 2, 'x'));
    return B.build('wall_shelves');
  },
};
