import * as THREE from 'three';
import { Builder, rbox, box, cyl, M4 } from '../geom.js';

// Kitchen furniture: matte anthracite fronts, quartz worktops, oak accents, black hardware.
// Heights (m): plinth 0.10 (recessed 0.05), base fronts to 0.84, gola channel 0.84..0.87, worktop 0.87..0.90,
// backsplash 0.90..1.50, wall units 1.50..2.40, tall units 0.10..2.40.
const PL = 0.10, TOP0 = 0.87, TOP = 0.90, WALL0 = 1.50, TALL = 2.40, GAP = 0.003;

// Quartz from the sink module (matches its worktop exactly). Its UVs tile every 0.6 m; ours are metric.
function quartzMaterial(ctx) {
  return 'quartz';   // metric box-mapped marble_white quartz (the sink GLB speckle map stretched on the run's vertical ends)
  if (ctx.mats.m.quartz_sink) return 'quartz_sink';
  let q = null;
  try {
    ctx.model('kitchen_sink', 'sink_worktop').traverse((o) => { if (o.isMesh && !q && /quartz/i.test(o.material?.name || '')) q = o.material; });
  } catch { /* fall back */ }
  if (!q) return 'quartz';
  const m = q.clone();
  if (m.map) { m.map = m.map.clone(); m.map.wrapS = m.map.wrapT = THREE.RepeatWrapping; m.map.repeat.set(1 / 0.6, 1 / 0.6); m.map.needsUpdate = true; }
  m.name = 'P07_quartz_sink';
  ctx.mats.m.quartz_sink = m;
  return 'quartz_sink';
}

function hobMaterial(ctx) {
  if (ctx.mats.m.hob) return ctx.mats.m.hob;
  const c = document.createElement('canvas'); c.width = 512; c.height = 512;
  const g = c.getContext('2d');
  g.fillStyle = '#060606'; g.fillRect(0, 0, 512, 512);
  g.strokeStyle = 'rgba(200,200,200,0.35)'; g.lineWidth = 3;
  for (const [x, y, r] of [[140, 150, 95], [370, 140, 70], [140, 380, 70], [370, 370, 95]]) {
    g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.stroke();
    g.beginPath(); g.arc(x, y, r * 0.55, 0, Math.PI * 2); g.globalAlpha = 0.5; g.stroke(); g.globalAlpha = 1;
  }
  g.fillStyle = 'rgba(220,220,220,0.55)';
  for (let i = 0; i < 9; i++) g.fillRect(170 + i * 20, 485, 10, 4);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  const m = new THREE.MeshStandardMaterial({ name: 'P07_hob', map: t, roughness: 0.08, envMapIntensity: 1.2 });
  ctx.mats.m.hob = m;
  return m;
}

// Handle: slim black bar. axis 'x' horizontal / 'y' vertical, centred at (x,y), on front plane z.
function handle(B, x, y, z, len, axis = 'x') {
  const r = 0.006;
  if (axis === 'x') {
    B.add('black_metal', rbox([x - len / 2, y - r, z + 0.022], [x + len / 2, y + r, z + 0.034], 0.004));
    for (const s of [-1, 1]) B.add('black_metal', box([x + s * (len / 2 - 0.02) - 0.004, y - 0.004, z], [x + s * (len / 2 - 0.02) + 0.004, y + 0.004, z + 0.024]));
  } else {
    B.add('black_metal', rbox([x - r, y - len / 2, z + 0.022], [x + r, y + len / 2, z + 0.034], 0.004));
    for (const s of [-1, 1]) B.add('black_metal', box([x - 0.004, y + s * (len / 2 - 0.02) - 0.004, z], [x + 0.004, y + s * (len / 2 - 0.02) + 0.004, z + 0.024]));
  }
}

// A front panel between x0..x1, y0..y1 with its face at z (thickness 18 mm behind).
function front(B, x0, x1, y0, y1, z, mat = 'anthracite') {
  B.add(mat, rbox([x0 + GAP / 2, y0 + GAP / 2, z - 0.018], [x1 - GAP / 2, y1 - GAP / 2, z], 0.0025, 2, 'y'));
}

function oven(B, ctx, x0, x1, y0, y1, z) {
  // steel frame, black glass door, control strip, handle
  B.add('steel', rbox([x0 + 0.004, y0 + 0.004, z - 0.02], [x1 - 0.004, y1 - 0.004, z], 0.003));
  B.add(ctx.mats.get('glass_black'), box([x0 + 0.02, y0 + 0.02, z], [x1 - 0.02, y1 - 0.1, z + 0.006]));
  B.add(ctx.mats.get('glass_black'), box([x0 + 0.02, y1 - 0.085, z], [x1 - 0.02, y1 - 0.02, z + 0.004]));
  for (let i = 0; i < 2; i++) B.add('steel', cyl(0.016, 0.02, [x0 + 0.08 + i * (x1 - x0 - 0.16), y1 - 0.052, z + 0.004], 20, null, 'z'));
  handle(B, (x0 + x1) / 2, y1 - 0.13, z + 0.006, (x1 - x0) * 0.75, 'x');
}

export const kitchen_run = {
  deps: () => ['kitchen_sink'],
  // params: { modules: [{type, w}], wallUnits: true, backsplash: true, depth: 0.6, ceiling: 2.85, shelf: {from, to} }
  // module types: drawers | door | doors2 | sink | dishwasher | oven_hob | tall_fridge | tall_oven | tall_pantry
  build(p, ctx) {
    const B = new Builder(ctx.mats);
    const q = quartzMaterial(ctx);
    const D = p.depth ?? 0.6, zb = -D / 2, zf = D / 2 - 0.004;   // carcass back / front plane of fronts
    const mods = p.modules;
    const L = mods.reduce((s, m) => s + m.w, 0);
    let x = -L / 2;
    const cols = [];
    const topSpans = [];   // worktop runs between tall units
    let run = null;
    for (const m of mods) {
      const x0 = x, x1 = x + m.w; x = x1;
      const tall = m.type.startsWith('tall');
      // plinth + carcass
      B.add('black_matte', box([x0, 0, zb + 0.02], [x1, PL, zf - 0.07]));
      B.add('anthracite_dark', box([x0 + 0.002, PL, zb + 0.02], [x1 - 0.002, tall ? TALL : TOP0, zf - 0.018]));
      if (tall) {
        if (run) { topSpans.push(run); run = null; }
        if (m.type === 'tall_fridge') {
          front(B, x0, x1, PL, 0.86, zf); front(B, x0, x1, 0.86, TALL, zf);
          handle(B, x0 + 0.05, 1.05, zf, 0.5, 'y'); handle(B, x0 + 0.05, 0.62, zf, 0.3, 'y');
        } else if (m.type === 'tall_oven') {
          front(B, x0, x1, PL, 0.46, zf); front(B, x0, x1, 0.46, 0.80, zf);
          handle(B, (x0 + x1) / 2, 0.42, zf, m.w * 0.6); handle(B, (x0 + x1) / 2, 0.76, zf, m.w * 0.6);
          oven(B, ctx, x0, x1, 0.80, 1.40, zf);
          // compact combi-microwave
          B.add('steel', rbox([x0 + 0.004, 1.40, zf - 0.02], [x1 - 0.004, 1.85, zf], 0.003));
          B.add(ctx.mats.get('glass_black'), box([x0 + 0.02, 1.42, zf], [x1 - 0.02, 1.76, zf + 0.005]));
          B.add(ctx.mats.get('glass_black'), box([x0 + 0.02, 1.775, zf], [x1 - 0.02, 1.835, zf + 0.004]));
          handle(B, (x0 + x1) / 2, 1.72, zf + 0.005, m.w * 0.7);
          front(B, x0, x1, 1.85, TALL, zf); handle(B, (x0 + x1) / 2, 1.89, zf, m.w * 0.6);
        } else {
          front(B, x0, x1, PL, 1.25, zf); front(B, x0, x1, 1.25, TALL, zf);
          handle(B, x1 - 0.05, 1.05, zf, 0.4, 'y'); handle(B, x1 - 0.05, 1.45, zf, 0.4, 'y');
        }
        cols.push([[x0, 0, zb], [x1, TALL, D / 2]]);
        continue;
      }
      run = run || { x0, x1 }; run.x1 = x1;
      // gola channel (dark recess under the worktop)
      B.add('black_matte', box([x0, 0.84, zf - 0.05], [x1, TOP0, zf - 0.03]));
      if (m.type === 'drawers') {
        const cuts = [PL, 0.37, 0.62, 0.84];
        for (let i = 0; i < 3; i++) front(B, x0, x1, cuts[i], cuts[i + 1], zf);
      } else if (m.type === 'door' || m.type === 'sink' || m.type === 'dishwasher') {
        front(B, x0, x1, PL, 0.84, zf);
      } else if (m.type === 'doors2') {
        front(B, x0, (x0 + x1) / 2, PL, 0.84, zf); front(B, (x0 + x1) / 2, x1, PL, 0.84, zf);
      } else if (m.type === 'oven_hob') {
        oven(B, ctx, x0, x1, 0.25, 0.84, zf);
        front(B, x0, x1, PL, 0.25, zf);
        m.hob = true;
      }
    }
    if (run) topSpans.push(run);
    // worktops (+ backsplash); the sink module replaces the slab over a 'sink' module
    for (const s of topSpans) {
      let xs = s.x0;
      let cx = -L / 2;
      const pieces = [];
      for (const m of mods) {
        const x0 = cx, x1 = cx + m.w; cx = x1;
        if (x0 < s.x0 - 1e-6 || x1 > s.x1 + 1e-6) continue;
        if (m.type === 'sink') {
          if (x0 > xs) pieces.push([xs, x0]);
          const sink = ctx.model('kitchen_sink', 'sink_worktop');
          const sb = ctx.modelBox('kitchen_sink', 'sink_worktop');
          sink.position.set((x0 + x1) / 2 - (sb.min.x + sb.max.x) / 2, TOP - sb.max.y + (sb.max.y - 0.23 > 0.05 ? sb.max.y - 0.23 : 0) , D / 2 + 0.02 - sb.max.z);
          // top of the quartz is at local y=0.23 in the module
          sink.position.y = TOP - 0.23;
          B.object(sink);
          xs = x1;
        }
        if (m.hob) {
          const hw = Math.min(0.78, m.w - 0.06);
          B.add(hobMaterial(ctx), box([(x0 + x1) / 2 - hw / 2, TOP, -0.25], [(x0 + x1) / 2 + hw / 2, TOP + 0.005, 0.27]));
        }
      }
      if (s.x1 > xs) pieces.push([xs, s.x1]);
      for (const [a, b] of pieces) B.add(q, rbox([a, TOP0, zb], [b, TOP, D / 2 + 0.02], 0.002));
      if (p.backsplash !== false) B.add(q, box([s.x0, TOP, zb], [s.x1, WALL0, zb + 0.015]));
      cols.push([[s.x0, 0, zb], [s.x1, TOP, D / 2 + 0.02]]);
    }
    // wall units over the worktop runs (skip `p.wallSkip` = [[x0,x1]] ranges); LED strip underneath
    if (p.wallUnits !== false) {
      const WD = 0.35;
      for (const s of topSpans) {
        const n = Math.max(1, Math.round((s.x1 - s.x0) / 0.6));
        const w = (s.x1 - s.x0) / n;
        B.add('anthracite_dark', box([s.x0, WALL0, zb + 0.015], [s.x1, TALL, zb + WD - 0.018]));
        for (let i = 0; i < n; i++) {
          const a = s.x0 + i * w, b = a + w;
          B.add('anthracite', rbox([a + GAP / 2, WALL0 - 0.02, zb + WD - 0.018], [b - GAP / 2, TALL - GAP, zb + WD], 0.0025, 2, 'y'));
        }
        B.add(ctx.mats.get('led'), box([s.x0 + 0.03, WALL0 - 0.004, zb + WD - 0.07], [s.x1 - 0.03, WALL0, zb + WD - 0.05]));
        // extractor: steel underside panel above the hob
        let cx = -L / 2;
        for (const m of mods) { const x0 = cx, x1 = cx + m.w; cx = x1; if (m.hob) B.add('steel', box([x0 + 0.03, WALL0 - 0.03, zb + 0.03], [x1 - 0.03, WALL0 - 0.004, zb + WD - 0.03])); }
      }
    }
    const root = B.build('kitchen_run');
    root.userData.colliders = cols;
    return root;
  },
};

export const kitchen_island = {
  deps: () => ['kitchen_sink'],
  // Working side = +Z (sink + dishwasher + drawers), seating side = -Z with a 0.30 m overhang and oak slat panel.
  // params: { length: 2.4, modules: [{type,w}], overhang: 0.3 }
  build(p, ctx) {
    const B = new Builder(ctx.mats);
    const q = quartzMaterial(ctx);
    const mods = p.modules || [{ type: 'drawers', w: 0.6 }, { type: 'sink', w: 1.2 }, { type: 'dishwasher', w: 0.6 }];
    const L = mods.reduce((s, m) => s + m.w, 0);
    const T = 0.03, over = p.overhang ?? 0.3;
    const zf = 0.3, zb = -0.3, zt0 = zb - over, zt1 = zf + 0.02;
    B.add('black_matte', box([-L / 2, 0, zb + 0.05], [L / 2, PL, zf - 0.07]));
    B.add('anthracite_dark', box([-L / 2, PL, zb + 0.02], [L / 2, TOP0, zf - 0.018]));
    B.add('black_matte', box([-L / 2, 0.84, zf - 0.05], [L / 2, TOP0, zf - 0.03]));
    let x = -L / 2;
    for (const m of mods) {
      const x0 = x, x1 = x + m.w; x = x1;
      if (m.type === 'drawers') { const c = [PL, 0.37, 0.62, 0.84]; for (let i = 0; i < 3; i++) front(B, x0, x1, c[i], c[i + 1], zf); }
      else if (m.type === 'doors2' || m.type === 'sink') { front(B, x0, (x0 + x1) / 2, PL, 0.84, zf); front(B, (x0 + x1) / 2, x1, PL, 0.84, zf); }
      else front(B, x0, x1, PL, 0.84, zf);
      if (m.type === 'sink') {
        const sink = ctx.model('kitchen_sink', 'sink_worktop');
        const sb = ctx.modelBox('kitchen_sink', 'sink_worktop');
        sink.position.set((x0 + x1) / 2 - (sb.min.x + sb.max.x) / 2, TOP - 0.23, zt1 - sb.max.z);
        B.object(sink);
        m.sinkZ0 = zt1 - (sb.max.z - sb.min.z);
        m.x0 = x0; m.x1 = x1;
      }
    }
    // worktop around the sink module
    const sinkM = mods.find((m) => m.type === 'sink');
    if (sinkM) {
      if (sinkM.x0 > -L / 2) B.add(q, rbox([-L / 2, TOP0, zt0], [sinkM.x0, TOP, zt1], 0.002));
      if (sinkM.x1 < L / 2) B.add(q, rbox([sinkM.x1, TOP0, zt0], [L / 2, TOP, zt1], 0.002));
      B.add(q, rbox([sinkM.x0, TOP0, zt0], [sinkM.x1, TOP, sinkM.sinkZ0 + 0.001], 0.002));
    } else B.add(q, rbox([-L / 2, TOP0, zt0], [L / 2, TOP, zt1], 0.002));
    // waterfall ends
    for (const s of [-1, 1]) {
      const xa = s < 0 ? -L / 2 - T : L / 2, xb = xa + T;
      B.add(q, rbox([xa, 0, zt0], [xb, TOP, zt1], 0.002));
    }
    // seating side: vertical oak slats on a dark backing, recessed under the overhang
    B.add('black_matte', box([-L / 2, PL, zb], [L / 2, TOP0, zb + 0.02]));
    const n = Math.floor(L / 0.045);
    for (let i = 0; i < n; i++) {
      const a = -L / 2 + 0.012 + i * (L - 0.024) / n;
      B.add('oak', rbox([a, PL + 0.01, zb - 0.022], [a + 0.028, TOP0 - 0.01, zb], 0.003, 1, 'y'));
    }
    const root = B.build('kitchen_island');
    root.userData.colliders = [[[-L / 2 - T, 0, zt0], [L / 2 + T, TOP, zt1]]];
    return root;
  },
};

// Counter stool: black steel 4-leg frame with footrest, round oak seat (seat height 0.65).
export const counter_stool = {
  build(p, ctx) {
    const B = new Builder(ctx.mats);
    const H = p.height ?? 0.65, rs = 0.19;
    B.add(p.seat || 'oak', cyl(rs, 0.035, [0, H - 0.035, 0], 32));
    B.add('black_metal', cyl(0.12, 0.012, [0, H - 0.047, 0], 24));
    for (let i = 0; i < 4; i++) {
      const a = Math.PI / 4 + i * Math.PI / 2;
      const top = [Math.cos(a) * 0.11, H - 0.047, Math.sin(a) * 0.11], bot = [Math.cos(a) * 0.2, 0, Math.sin(a) * 0.2];
      const len = Math.hypot(bot[0] - top[0], H - 0.047, bot[2] - top[2]);
      const g = new THREE.CylinderGeometry(0.011, 0.011, len, 10);
      const dir = new THREE.Vector3(bot[0] - top[0], -(H - 0.047), bot[2] - top[2]).normalize();
      const qn = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, -1, 0), dir);
      g.applyQuaternion(qn); g.translate((top[0] + bot[0]) / 2, (H - 0.047) / 2, (top[2] + bot[2]) / 2);
      B.add('black_metal', g);
    }
    const ring = new THREE.TorusGeometry(0.168, 0.008, 8, 40); ring.rotateX(Math.PI / 2); ring.translate(0, 0.26, 0);
    B.add('black_metal', ring);
    return B.build('counter_stool');
  },
};
