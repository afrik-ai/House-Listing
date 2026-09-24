import * as THREE from 'three';
import { GeoBuilder, rng, fbm, rectMinus, alongPolyline, rectContains, circleContains } from './util.js';
import { groundMaterial } from './materials.js';

// Ground layers: lawn, gravel/mulch beds + steel edging, stone deck + patio, pool coping, slab
// paths, stepping stones, street (sidewalks, curbs, asphalt), and the terrain out to the horizon.
// Also rasterises the lawn mask (where grass blades may grow) and collects footstep surfaces.
export async function buildGround(ctx) {
  const { site, textures, group } = ctx;
  const G = site.grade_y;
  const mats = {};
  const matDefs = { ...site.materials, stone: { tex: 'concrete_smooth_light', scale: 2.4, tint: [0.95, 0.92, 0.86], macro: 0.3 } };
  const need = ['lawn', 'meadow', 'gravel', 'deck', 'concrete', 'coping', 'asphalt', 'mulch', 'stone'];
  await Promise.all(need.map(async (k) => { mats[k] = await groundMaterial(textures, matDefs[k]); }));
  mats.edge = new THREE.MeshStandardMaterial({ color: 0x1b1c1d, roughness: 0.45, metalness: 0.6 });
  mats.meadow.vertexColors = true;
  ctx.materials = mats;

  const builders = {};
  const B = (k) => (builders[k] ||= new GeoBuilder());
  const surfaces = [];      // {test(x,z), type, top}
  const colBoxes = ctx.colliderBoxes;
  const R = rng(site.seed ?? 5);

  // ---- lawn: one plane over the plot ----------------------------------------------------------
  const [px, pz, pw, pd] = site.plot;
  const lawnS = site.materials.lawn.scale;
  B('lawn').quad([px, G, pz + pd], [px + pw, G, pz + pd], [px + pw, G, pz], [px, G, pz], [0, 1, 0],
    [[px / lawnS, -(pz + pd) / lawnS], [(px + pw) / lawnS, -(pz + pd) / lawnS], [(px + pw) / lawnS, -pz / lawnS], [px / lawnS, -pz / lawnS]]);

  // ---- beds (gravel / mulch) with steel edging ------------------------------------------------
  const bedTop = G + 0.008;
  const edge = (x0, z0, x1, z1) => {   // thin steel strip along a segment
    const L = Math.hypot(x1 - x0, z1 - z0);
    B('edge').rotBox((x0 + x1) / 2, (z0 + z1) / 2, 0.008, L, G - 0.05, G + 0.018, Math.atan2(x1 - x0, z1 - z0), 1);
  };
  const addBed = (bed, key, type) => {
    const s = matDefs[key].scale;
    if (bed.rect) {
      const [x, z, w, d] = bed.rect;
      B(key).quad([x, bedTop, z + d], [x + w, bedTop, z + d], [x + w, bedTop, z], [x, bedTop, z], [0, 1, 0],
        [[x / s, -(z + d) / s], [(x + w) / s, -(z + d) / s], [(x + w) / s, -z / s], [x / s, -z / s]]);
      if (w > 0.4 && d > 0.4) { edge(x, z, x + w, z); edge(x + w, z, x + w, z + d); edge(x + w, z + d, x, z + d); edge(x, z + d, x, z); }
      surfaces.push({ test: (qx, qz) => rectContains(bed.rect, qx, qz), type, top: bedTop });
    } else if (bed.circle) {
      const [cx, cz, r] = bed.circle;
      B(key).disc(cx, cz, r, bedTop + 0.001, s, 56);
      const n = 40;
      for (let i = 0; i < n; i++) {
        const a0 = (i / n) * Math.PI * 2, a1 = ((i + 1) / n) * Math.PI * 2;
        edge(cx + Math.cos(a0) * r, cz + Math.sin(a0) * r, cx + Math.cos(a1) * r, cz + Math.sin(a1) * r);
      }
      surfaces.push({ test: (qx, qz) => circleContains(bed.circle, qx, qz), type, top: bedTop });
    }
  };
  for (const bed of site.gravel_beds || []) addBed(bed, 'gravel', 'gravel');
  for (const bed of site.mulch_beds || []) addBed(bed, 'mulch', 'soil');

  // ---- deck + patio (raised light stone), pool coping ------------------------------------------
  const pool = site.pool;
  const [qx, qz, qw, qd] = pool.rect;
  const cw = pool.coping;
  const copingRect = [qx - cw, qz - cw, qw + 2 * cw, qd + 2 * cw];
  const deckS = matDefs.deck.scale;
  for (const dk of site.deck || []) {
    const holes = rectContains(dk.rect, qx + qw / 2, qz + qd / 2) ? [copingRect] : [];
    const top = dk.top;
    for (const [x, z, w, d] of rectMinus(dk.rect, holes)) {
      B('deck').box(x, G - 0.12, z, x + w, top, z + d, deckS, { skip: ['-y'] });
    }
    colBoxes.push([dk.rect[0], G - 0.3, dk.rect[1], dk.rect[0] + dk.rect[2], top, dk.rect[1] + dk.rect[3]]);
    surfaces.push({ test: (x, z) => rectContains(dk.rect, x, z), type: 'large_format_tile_light', top });
  }
  // coping: four dark stone boxes around the water (slightly proud of the deck)
  const ct = pool.coping_top, cb = pool.water_y + 0.06;
  const cS = matDefs.coping.scale;
  B('coping').box(copingRect[0], cb, copingRect[1], copingRect[0] + copingRect[2], ct, qz, cS);
  B('coping').box(copingRect[0], cb, qz + qd, copingRect[0] + copingRect[2], ct, copingRect[1] + copingRect[3], cS);
  B('coping').box(copingRect[0], cb, qz, qx, ct, qz + qd, cS);
  B('coping').box(qx + qw, cb, qz, copingRect[0] + copingRect[2], ct, qz + qd, cS);
  surfaces.push({ test: (x, z) => rectContains(copingRect, x, z), type: 'large_format_tile_light', top: ct });

  // ---- slab paths (entrance, sidewalk) + stepping stones --------------------------------------
  for (const p of site.slab_paths || []) {
    const pts = [p.from, p.to];
    const L = Math.hypot(p.to[0] - p.from[0], p.to[1] - p.from[1]);
    const step = p.slab + p.gap;
    const n = Math.floor((L + p.gap) / step);
    const lead = (L - (n * step - p.gap)) / 2 + p.slab / 2;
    const slabs = alongPolyline(pts, step, lead);
    const s = matDefs[p.material].scale;
    slabs.forEach((sl, i) => {
      const top = p.stepped ? (p.stepped[Math.min(i, p.stepped.length - 1)]) : p.top;
      B(p.material === 'concrete' ? 'concrete' : 'stone').rotBox(sl.x, sl.z, p.width, p.slab, G - 0.1, top, sl.angle, s, [R() * 7, R() * 7]);
    });
    const [ax, az] = p.from, [bx, bz] = p.to;
    const rect = [Math.min(ax, bx) - (ax === bx ? p.width / 2 : 0), Math.min(az, bz) - (az === bz ? p.width / 2 : 0),
      Math.abs(bx - ax) || p.width, Math.abs(bz - az) || p.width];
    surfaces.push({ test: (x, z) => rectContains(rect, x, z), type: 'concrete_screed', top: p.top });
    p._rect = rect;
  }
  const stones = [];
  for (const sp of site.stepping_stones || []) {
    for (const st of alongPolyline(sp.points, sp.spacing)) {
      const w = sp.size[0] * (0.94 + R() * 0.1), d = sp.size[1] * (0.92 + R() * 0.14);
      const ang = st.angle + (R() - 0.5) * 0.1;
      const top = sp.top + (R() - 0.5) * 0.008;
      B('stone').rotBox(st.x, st.z, w, d, G - 0.08, top, ang, matDefs.stone.scale, [R() * 9, R() * 9]);
      stones.push({ x: st.x, z: st.z, w, d, angle: ang });
    }
  }
  surfaces.push({
    test: (x, z) => stones.some((s) => {
      const c = Math.cos(s.angle), sn = Math.sin(s.angle), dx = x - s.x, dz = z - s.z;
      const lx = dx * c - dz * sn, lz = dx * sn + dz * c;
      return Math.abs(lx) <= s.w / 2 && Math.abs(lz) <= s.d / 2;
    }), type: 'stone', top: G,
  });

  // ---- street ---------------------------------------------------------------------------------
  const st = site.street;
  if (st) {
    const [rx, rz, rw, rd] = st.road;
    const top = st.road_top;
    B('asphalt').box(rx, top - 0.2, rz, rx + rw, top, rz + rd, matDefs.asphalt.scale, { skip: ['-y', '+z', '-z'] });
    const ch = G + 0.02;
    for (const cx of st.curbs) B('concrete').box(cx, top - 0.2, rz, cx + 0.15, ch, rz + rd, 1.2, { skip: ['-y', '+z', '-z'] });
    const [fx, fz, fw, fd] = st.far_sidewalk;
    for (let z = fz; z < fz + fd; z += 1.0) B('concrete').box(fx, G - 0.1, z + 0.006, fx + fw, ch, z + 0.994, matDefs.concrete.scale, { skip: ['-y'], uvOffset: [R() * 5, R() * 5] });
    surfaces.push({ test: (x) => x > rx && x < rx + rw, type: 'asphalt', top });
    surfaces.push({ test: (x) => x > fx - 0.2 && x < fx + fw, type: 'concrete_screed', top: ch });
  }

  // ---- terrain (tensor grid out to the horizon, hills, lowered under the street) ----------------
  const terrain = buildTerrain(site, matDefs.meadow.scale);
  const tMesh = new THREE.Mesh(terrain, mats.meadow);
  tMesh.name = 'LS_terrain'; tMesh.receiveShadow = true; tMesh.castShadow = false;
  group.add(tMesh);
  ctx.terrainHeight = terrain.userData.height;

  // ---- meshes -----------------------------------------------------------------------------
  // flat paving casts nothing visible; keeping it out of the sun cascades saves ~100k shadow-pass triangles
  const cast = { deck: false, coping: false, concrete: false, stone: false, edge: false };
  for (const [k, b] of Object.entries(builders)) {
    if (b.empty) continue;
    const m = new THREE.Mesh(b.build(), mats[k]);
    m.name = `LS_${k}`;
    m.receiveShadow = true;
    m.castShadow = !!cast[k];
    group.add(m);
    if (k === 'lawn') ctx.lawnMesh = m;
  }

  // ---- ground collider: grade everywhere, lowered road between the curbs ----------------------
  const cg = new GeoBuilder();
  const E = 400;
  const flat = (x0, x1, y) => cg.quad([x0, y, E], [x1, y, E], [x1, y, -E], [x0, y, -E], [0, 1, 0], [[0, 0], [0, 0], [0, 0], [0, 0]]);
  if (st) {
    const c0 = st.curbs[0], c1 = st.curbs[1] + 0.15;
    flat(-E, c0, G); flat(c0, c1, st.road_top); flat(c1, E, G);
    cg.quad([c0, st.road_top, -E], [c0, st.road_top, E], [c0, G, E], [c0, G, -E], [1, 0, 0], [[0, 0], [0, 0], [0, 0], [0, 0]]);
    cg.quad([c1, st.road_top, E], [c1, st.road_top, -E], [c1, G, -E], [c1, G, E], [-1, 0, 0], [[0, 0], [0, 0], [0, 0], [0, 0]]);
  } else flat(-E, E, G);
  const gcol = new THREE.Mesh(cg.build(), new THREE.MeshBasicMaterial({ visible: false }));
  gcol.name = 'COL_landscape_ground'; gcol.visible = false;
  ctx.colliderMeshes.push(gcol);

  ctx.surfaces = surfaces;
  ctx.stones = stones;
  ctx.mask = buildLawnMask(ctx, stones, copingRect);
  return mats;
}

function buildTerrain(site, scale) {
  const T = site.terrain || {};
  const [px, pz, pw, pd] = site.plot;
  const cx = px + pw / 2, cz = pz + pd / 2;
  const G = site.grade_y;
  const st = site.street;
  const lines = (c, breaks) => {
    const v = new Set();
    for (let d = 0; d <= 70; d += 2.5) { v.add(+(c + d).toFixed(3)); v.add(+(c - d).toFixed(3)); }
    let d = 70, s = 3;
    while (d < 640) { d += s; s *= 1.12; v.add(+(c + d).toFixed(2)); v.add(+(c - d).toFixed(2)); }
    for (const b of breaks) v.add(b);
    return [...v].sort((a, b) => a - b);
  };
  const xb = st ? [st.curbs[0] - 0.05, st.curbs[0] + 0.05, st.curbs[1] + 0.1, st.curbs[1] + 0.2] : [];
  const X = lines(cx, xb), Z = lines(cz, []);
  const roadX0 = st ? st.curbs[0] : 1e9, roadX1 = st ? st.curbs[1] + 0.15 : -1e9;
  const H = T.hill_height ?? 30, h0 = T.hill_start ?? 110, h1 = T.hill_end ?? 420;
  const height = (x, z) => {
    if (x > roadX0 - 0.02 && x < roadX1 + 0.02) return st.road_top - 0.25;
    const r = Math.hypot(x - cx, z - cz);
    const k = THREE.MathUtils.smoothstep(r, h0, h1);
    const corridor = st ? THREE.MathUtils.smoothstep(Math.abs(x - (roadX0 + roadX1) / 2), 8, 70) : 1;
    const n = 0.3 + 0.7 * fbm(x / 170 + 5.3, z / 170 - 2.1, 4);
    const near = r < 60 ? -0.03 : -0.03 + (fbm(x / 25, z / 25, 3) - 0.5) * 0.6 * THREE.MathUtils.smoothstep(r, 60, 110);
    return G + near + H * k * n * corridor;
  };
  const nx = X.length, nz = Z.length;
  const pos = new Float32Array(nx * nz * 3), uv = new Float32Array(nx * nz * 2), col = new Float32Array(nx * nz * 3);
  const cA = new THREE.Color(0.86, 0.9, 0.74), cB = new THREE.Color(0.7, 0.76, 0.58), cC = new THREE.Color(0.98, 0.92, 0.72), cF = new THREE.Color(0.42, 0.48, 0.36);
  const tmp = new THREE.Color();
  for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
    const x = X[i], z = Z[j], k = j * nx + i;
    const y = height(x, z);
    pos.set([x, y, z], k * 3);
    uv.set([x / scale, -z / scale], k * 2);
    const f = fbm(x / 60, z / 60, 3), g = fbm(x / 23 + 9, z / 23 - 4, 2);
    tmp.copy(cA).lerp(cB, THREE.MathUtils.smoothstep(f, 0.35, 0.65));
    if (g > 0.62) tmp.lerp(cC, (g - 0.62) * 2.2);
    const r = Math.hypot(x - cx, z - cz);
    if (r > 90) tmp.lerp(cF, THREE.MathUtils.smoothstep(fbm(x / 90 - 3, z / 90 + 8, 3), 0.5, 0.62) * 0.8);
    col.set([tmp.r, tmp.g, tmp.b], k * 3);
  }
  const idx = [];
  for (let j = 0; j < nz - 1; j++) for (let i = 0; i < nx - 1; i++) {
    const a = j * nx + i, b = a + 1, c = a + nx, d = c + 1;
    idx.push(a, c, b, b, c, d);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  g.computeBoundingSphere();
  g.userData.height = height;
  return g;
}

// Lawn mask: R = 1 where lawn (grass blades allowed), 0 elsewhere. 10 px per metre over the plot.
function buildLawnMask(ctx, stones, copingRect) {
  const { site, house } = ctx;
  const [px, pz, pw, pd] = site.plot;
  const res = 10;
  const W = Math.ceil(pw * res), H = Math.ceil(pd * res);
  const cv = document.createElement('canvas');
  cv.width = W; cv.height = H;
  const c = cv.getContext('2d');
  c.fillStyle = '#fff'; c.fillRect(0, 0, W, H);
  c.fillStyle = '#000';
  const R = (x, z, w, d, m = 0.04) => c.fillRect((x - m - px) * res, (z - m - pz) * res, (w + 2 * m) * res, (d + 2 * m) * res);
  for (const r of site.house_footprint || []) R(...r, 0.1);
  for (const e of house?.exteriors?.() || []) if (e.level === 'ground') R(...e.rect, 0.05);
  for (const b of [...(site.gravel_beds || []), ...(site.mulch_beds || [])]) {
    if (b.rect) R(...b.rect, 0.02);
    else { c.beginPath(); c.arc((b.circle[0] - px) * res, (b.circle[1] - pz) * res, (b.circle[2] + 0.03) * res, 0, Math.PI * 2); c.fill(); }
  }
  for (const d of site.deck || []) R(...d.rect, 0.03);
  R(...copingRect, 0.03);
  for (const p of site.slab_paths || []) if (p._rect) R(...p._rect, 0.03);
  for (const h of site.hedges || []) R(...h.rect, 0.1);
  for (const g of site.gabions || []) R(...g.rect, 0.05);
  for (const s of stones) {
    c.save(); c.translate((s.x - px) * res, (s.z - pz) * res); c.rotate(-s.angle);
    c.fillRect((-s.w / 2 - 0.02) * res, (-s.d / 2 - 0.02) * res, (s.w + 0.04) * res, (s.d + 0.04) * res);
    c.restore();
  }
  const img = c.getImageData(0, 0, W, H).data;
  const tex = new THREE.CanvasTexture(cv);
  tex.flipY = false; tex.colorSpace = THREE.NoColorSpace;
  tex.minFilter = THREE.LinearFilter; tex.magFilter = THREE.LinearFilter; tex.generateMipmaps = false;
  tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
  const isLawn = (x, z) => {
    const u = Math.floor((x - px) * res), v = Math.floor((z - pz) * res);
    if (u < 0 || v < 0 || u >= W || v >= H) return false;
    return img[(v * W + u) * 4] > 127;
  };
  return { tex, isLawn, rect: site.plot };
}
