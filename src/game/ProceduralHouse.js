import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

// FALLBACK ONLY (used while public/assets/houses/<id>/house.glb does not exist).
// Builds a plain but correct shell from house.json so the engine, physics, lighting and harness can
// be exercised: floors/ceilings per room piece, walls on centre-lines with the spec's openings,
// stair from spec.stairs (+ ramp collider), structure boxes (terrace, pergola, pillars, platform),
// voids, glass balustrades, flat roofs, foundation plinth, lawn, pool.
// Coordinates follow house.json: X east, Z south, Y up; rect = [x, z, w, d]; rooms may use `rects`.

const SLAB_T = 0.30;
const WALL_EXT = 0.30, WALL_INT = 0.12;
const DOOR_H = 2.13;

const MATS = {
  wall: () => new THREE.MeshStandardMaterial({ color: 0xece9e3, roughness: 0.92 }),
  plinth: () => new THREE.MeshStandardMaterial({ color: 0x3b3d40, roughness: 0.75 }),
  ceiling: () => new THREE.MeshStandardMaterial({ color: 0xf4f2ee, roughness: 0.95 }),
  roof: () => new THREE.MeshStandardMaterial({ color: 0x3a3c3e, roughness: 0.8 }),
  structure: () => new THREE.MeshStandardMaterial({ color: 0xeeebe6, roughness: 0.85 }),
  oak_plank: () => new THREE.MeshStandardMaterial({ color: 0xa27a4f, roughness: 0.55 }),
  large_format_tile_grey: () => new THREE.MeshStandardMaterial({ color: 0x8e8d89, roughness: 0.38 }),
  large_format_tile_light: () => new THREE.MeshStandardMaterial({ color: 0xcfc9bd, roughness: 0.45 }),
  small_tile_white: () => new THREE.MeshStandardMaterial({ color: 0xe8e8e4, roughness: 0.3 }),
  concrete_screed: () => new THREE.MeshStandardMaterial({ color: 0x96958f, roughness: 0.7 }),
  concrete_pavers: () => new THREE.MeshStandardMaterial({ color: 0x9d978d, roughness: 0.85 }),
  lawn: () => new THREE.MeshStandardMaterial({ color: 0x4f7a33, roughness: 1 }),
  water: () => new THREE.MeshStandardMaterial({ color: 0x2b86b0, roughness: 0.06, metalness: 0.0, transparent: true, opacity: 0.82 }),
  poolWall: () => new THREE.MeshStandardMaterial({ color: 0xbcd3d8, roughness: 0.4 }),
  stair: () => new THREE.MeshStandardMaterial({ color: 0xa27a4f, roughness: 0.5 }),
  glass: () => new THREE.MeshStandardMaterial({ color: 0xd8e6e2, roughness: 0.05, metalness: 0.0, transparent: true, opacity: 0.18, depthWrite: false }),
};

const key = (v) => Math.round(v * 100);
export const roomRects = (r) => r.rects || (r.rect ? [r.rect] : []);

export function buildProceduralHouse(spec) {
  const root = new THREE.Group();
  root.name = `HOUSE_${spec.id}_procedural`;
  const mats = Object.fromEntries(Object.entries(MATS).map(([k, f]) => [k, f()]));
  const merged = { wall: [], plinth: [], ceiling: [], roof: [], stair: [], poolWall: [], structure: [], glass: [] };
  const levels = Object.fromEntries(spec.levels.map((l) => [l.id, l]));
  const grade = spec.site?.grade_y ?? -0.3;
  const voids = spec.structure?.voids || [];
  const open = spec.walls?.open || {};
  const tExt = spec.walls?.exterior ?? WALL_EXT, tInt = spec.walls?.interior ?? WALL_INT;
  const levelRooms = [
    { level: levels.ground, rooms: spec.ground_rooms || [], above: spec.first_rooms || [] },
    { level: levels.first, rooms: spec.first_rooms || [], above: [] },
  ].filter((l) => l.level);
  const ceilingHoles = (levelId) => voids.filter((v) => v.level === levelId).map((v) => v.rect);

  for (const { level, rooms, above } of levelRooms) {
    const y0 = level.elevation, h = level.clear_height;
    const holesHere = ceilingHoles(level.id);
    const nextLevel = levelRooms.find((l) => l.level.elevation > y0)?.level;
    const holesAbove = nextLevel ? ceilingHoles(nextLevel.id) : [];

    for (const r of rooms) {
      for (const rect of roomRects(r)) {
        // Floor (named SURF_<type>_<room> for footsteps), minus voids on this level.
        for (const [px, pz, pw, pd] of subtractAll(rect, holesHere)) {
          const m = box(pw, SLAB_T / 2, pd, mats[r.floor] || mats.concrete_screed);
          m.position.set(px + pw / 2, y0 - SLAB_T / 4, pz + pd / 2);
          m.name = `SURF_${r.floor}_${r.id}`;
          root.add(m);
        }
        // Ceiling (below the next floor's slab) minus the voids of the level above.
        for (const [px, pz, pw, pd] of subtractAll(rect, holesAbove)) {
          const g = new THREE.BoxGeometry(pw, SLAB_T / 2, pd);
          g.translate(px + pw / 2, y0 + h + SLAB_T / 4, pz + pd / 2);
          merged.ceiling.push(g);
          if (!above.length || !coveredBy(rect, above)) {
            const rg = new THREE.BoxGeometry(pw + tExt, 0.12, pd + tExt);
            rg.translate(px + pw / 2, y0 + h + SLAB_T / 2 + 0.06, pz + pd / 2);
            merged.roof.push(rg);
          }
        }
        if (level.id === 'ground') {   // foundation plinth down to grade (and a bit below)
          const g = new THREE.BoxGeometry(rect[2] + tExt, -grade + 0.3 - SLAB_T / 2, rect[3] + tExt);
          g.translate(rect[0] + rect[2] / 2, (grade - 0.3 - SLAB_T / 2) / 2, rect[1] + rect[3] / 2);
          merged.plinth.push(g);
        }
      }
      const main = largest(roomRects(r));
      const empty = new THREE.Object3D();
      empty.name = `ROOM_${r.id}`;
      empty.position.set(main[0] + main[2] / 2, y0, main[1] + main[3] / 2);
      root.add(empty);
    }

    // Walls on centre-lines: dedupe shared edges, skip open connections, cut spec openings.
    const openPairs = new Set((open[level.id] || []).map((p) => [...p].sort().join('+')));
    const openings = (spec.openings || []).filter((o) => o.level === level.id);
    for (const seg of wallSegments(rooms)) {
      if (seg.internal) continue;
      if (seg.rooms.length === 2 && openPairs.has(seg.rooms.join('+'))) continue;
      const ext = seg.rooms.length === 1;
      const cuts = openings.filter((o) => onSegment(o.at, seg)).map((o) => {
        const c = seg.axis === 'z' ? o.at[0] : o.at[1];
        const bottom = o.sill ?? 0;
        const top = (o.type === 'window' || o.type === 'slide') ? bottom + o.height : (o.height ?? DOOR_H);
        return { a: c - o.width / 2, b: c + o.width / 2, bottom, top };
      });
      for (const g of wallPieces(seg, cuts, y0, h, ext ? tExt : tInt)) merged.wall.push(g);
    }
  }

  // Stairs (spec.stairs): treads + risers as solid blocks, and a collision ramp along the nosings.
  for (const st of spec.stairs || []) {
    const lv = levels[st.level] || levels.ground;
    const [fx, fz] = st.first_riser, [dx, dz] = st.dir, [sx, sz] = st.side;
    const n = st.risers, rise = st.riser, run = st.tread, w = st.width;
    for (let i = 0; i < n - 1; i++) {
      const top = lv.elevation + rise * (i + 1);
      const a = i * run, b = (i + 1) * run;
      const cx = fx + dx * (a + b) / 2 + sx * w / 2, cz = fz + dz * (a + b) / 2 + sz * w / 2;
      const g = new THREE.BoxGeometry(Math.abs(dx) * run + Math.abs(sx) * w, Math.min(top - lv.elevation, 0.25), Math.abs(dz) * run + Math.abs(sz) * w);
      g.translate(cx, top - Math.min(top - lv.elevation, 0.25) / 2, cz);
      merged.stair.push(g);
    }
    const L = (n - 1) * run, H = n * rise;
    const len = Math.hypot(L, H);
    const ramp = new THREE.Mesh(new THREE.BoxGeometry(len + 0.1, 0.05, w - 0.04), new THREE.MeshBasicMaterial());
    const cx = fx + dx * L / 2 + sx * w / 2, cz = fz + dz * L / 2 + sz * w / 2;
    ramp.position.set(cx, lv.elevation + H / 2 - 0.02, cz);
    ramp.rotation.set(0, Math.atan2(-dz, dx), 0, 'YXZ');
    ramp.rotateZ(Math.atan2(H, L));
    ramp.name = `STAIR_${st.id}_collider`;
    ramp.userData.colliderOnly = true;
    root.add(ramp);
  }

  // Structure boxes (terrace slab, pergola, pillars, entrance platform, steps).
  for (const b of spec.structure?.boxes || []) {
    const [x, z, w, d] = b.rect, [ya, yb] = b.y;
    const g = new THREE.BoxGeometry(w, yb - ya, d);
    g.translate(x + w / 2, (ya + yb) / 2, z + d / 2);
    merged.structure.push(g);
  }
  for (const [x, z, w, d] of spec.structure?.canopies?.ground || []) {
    const g = new THREE.BoxGeometry(w, 0.3, d);
    g.translate(x + w / 2, (levels.ground?.clear_height ?? 2.85) + 0.15, z + d / 2);
    merged.structure.push(g);
  }

  // Exterior floor surfaces (thin, on top of the structure so footsteps + materials read).
  for (const e of [...(spec.ground_exterior || []).map((e) => [e, 'ground']), ...(spec.first_exterior || []).map((e) => [e, 'first'])]) {
    const [ex, lvId] = e;
    const [x, z, w, d] = ex.rect;
    const y = ex.y ?? levels[lvId]?.elevation ?? 0;
    const mat = mats[ex.floor] || mats.concrete_pavers;
    let m;
    if (ex.y_far !== undefined) {           // sloped driveway: from y at the house to y_far at the street
      const drop = y - ex.y_far;
      const thick = Math.max(0.1, drop + 0.1);
      m = box(Math.hypot(w, drop), thick, d, mat);
      m.rotation.z = -Math.atan2(drop, w);
      m.position.set(x + w / 2, (y + ex.y_far) / 2 - thick / 2 + 0.005, z + d / 2);
    } else {
      const thick = lvId === 'ground' && y - grade < 0.8 ? Math.max(0.02, y - grade) : 0.03;
      m = box(w, thick, d, mat);
      m.position.set(x + w / 2, y - thick / 2 + 0.006, z + d / 2);
    }
    m.name = `SURF_${ex.floor}_${ex.id}`;
    root.add(m);
  }

  // Glass balustrades (collide, so the stair void and balcony edge are safe).
  for (const bl of spec.balustrades || []) {
    const lv = levels[bl.level] || levels.ground;
    for (let i = 0; i < bl.path.length - 1; i++) {
      const [ax, az] = bl.path[i], [bx, bz] = bl.path[i + 1];
      const len = Math.hypot(bx - ax, bz - az);
      const g = new THREE.BoxGeometry(len, bl.height, 0.02);
      g.rotateY(-Math.atan2(bz - az, bx - ax));
      g.translate((ax + bx) / 2, lv.elevation + bl.height / 2, (az + bz) / 2);
      merged.glass.push(g);
    }
  }

  // Lawn at grade, pool.
  const lawn = box(90, 0.3, 90, mats.lawn);
  lawn.position.set(5, grade - 0.15, 3);
  lawn.name = 'SURF_grass_lawn';
  lawn.castShadow = false;
  root.add(lawn);
  const pool = spec.site?.pool;
  if (pool) {
    const water = new THREE.Mesh(new THREE.PlaneGeometry(pool.w, pool.d), mats.water);
    water.rotation.x = -Math.PI / 2;
    water.position.set(pool.x + pool.w / 2, grade + 0.03, pool.z + pool.d / 2);
    water.name = 'WATER_pool';
    water.userData.noCollide = true;
    water.castShadow = false;
    root.add(water);
    // Coping frame (0.5 m wide) around the water; the water sits just below its top.
    const cw = 0.5, cy = grade + 0.04;
    for (const [x, z, w, d] of [
      [pool.x - cw, pool.z - cw, pool.w + 2 * cw, cw], [pool.x - cw, pool.z + pool.d, pool.w + 2 * cw, cw],
      [pool.x - cw, pool.z, cw, pool.d], [pool.x + pool.w, pool.z, cw, pool.d],
    ]) {
      const g = new THREE.BoxGeometry(w, 0.08, d);
      g.translate(x + w / 2, cy, z + d / 2);
      merged.poolWall.push(g);
    }
  }

  for (const [k, list] of Object.entries(merged)) {
    if (!list.length) continue;
    const m = new THREE.Mesh(mergeGeometries(list, false), mats[k]);
    m.name = `MERGED_${k}`;
    if (k === 'stair') m.userData.noCollide = true;
    if (k === 'glass') m.castShadow = false;
    list.forEach((g) => g.dispose());
    root.add(m);
  }

  // Spawn: spec.spawn (feet) or the entrance platform facing the front door.
  const spawnSpec = spec.spawn;
  const spawn = new THREE.Object3D();
  spawn.name = 'SPAWN';
  let yaw = 90;
  if (spawnSpec?.pos) { spawn.position.fromArray(spawnSpec.pos); yaw = spawnSpec.yaw ?? 90; }
  else {
    const entrance = (spec.ground_exterior || []).find((e) => e.id === 'entrance');
    if (entrance) spawn.position.set(entrance.rect[0] + entrance.rect[2] - 0.6, 0, entrance.rect[1] + entrance.rect[3] / 2);
  }
  spawn.rotation.y = THREE.MathUtils.degToRad(yaw);
  root.add(spawn);

  root.traverse((o) => { if (o.isMesh && o.castShadow !== false && !o.userData.colliderOnly) { o.castShadow = true; o.receiveShadow = true; } });
  lawn.receiveShadow = true; if (pool) root.getObjectByName('WATER_pool').receiveShadow = true;
  return { root, spawn: { pos: spawn.position.toArray(), yaw } };
}

// ---- helpers ------------------------------------------------------------------

function box(w, h, d, mat) { return new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); }
function largest(rects) { return rects.reduce((a, r) => (r[2] * r[3] > a[2] * a[3] ? r : a), rects[0]); }

function coveredBy(rect, rooms) {
  const cx = rect[0] + rect[2] / 2, cz = rect[1] + rect[3] / 2;
  return rooms.some((r) => roomRects(r).some((q) => inRect(cx, cz, q)));
}
function inRect(x, z, [rx, rz, rw, rd]) { return x >= rx - 1e-3 && x <= rx + rw + 1e-3 && z >= rz - 1e-3 && z <= rz + rd + 1e-3; }

function onSegment([x, z], seg) {
  const along = seg.axis === 'z' ? x : z, across = seg.axis === 'z' ? z : x;
  return Math.abs(across - seg.c) < 0.05 && along > seg.a - 1e-3 && along < seg.b + 1e-3;
}

// Rect minus rect -> up to 4 rects (only the parts of A not inside B).
function subtractRect([ax, az, aw, ad], [bx, bz, bw, bd]) {
  const out = [];
  const ix0 = Math.max(ax, bx), ix1 = Math.min(ax + aw, bx + bw);
  const iz0 = Math.max(az, bz), iz1 = Math.min(az + ad, bz + bd);
  if (ix1 <= ix0 || iz1 <= iz0) return [[ax, az, aw, ad]];
  if (iz0 > az) out.push([ax, az, aw, iz0 - az]);
  if (iz1 < az + ad) out.push([ax, iz1, aw, az + ad - iz1]);
  if (ix0 > ax) out.push([ax, iz0, ix0 - ax, iz1 - iz0]);
  if (ix1 < ax + aw) out.push([ix1, iz0, ax + aw - ix1, iz1 - iz0]);
  return out;
}
function subtractAll(rect, holes) {
  let pieces = [rect];
  for (const h of holes) pieces = pieces.flatMap((p) => subtractRect(p, h));
  return pieces;
}

// Axis-aligned wall segments from room-piece edges, merged so shared walls are built once.
// Each: {axis:'x'|'z', c, a, b, rooms:[ids], internal} — internal = an edge between two pieces of
// the same (L-shaped) room, which gets no wall.
function wallSegments(rooms) {
  const lines = new Map();
  const push = (axis, c, a, b, room, side) => {
    const k = `${axis}:${key(c)}`;
    if (!lines.has(k)) lines.set(k, []);
    lines.get(k).push({ a, b, room, side });
  };
  for (const r of rooms) {
    for (const [x, z, w, d] of roomRects(r)) {
      push('z', z, x, x + w, r.id, -1);
      push('z', z + d, x, x + w, r.id, 1);
      push('x', x, z, z + d, r.id, -1);
      push('x', x + w, z, z + d, r.id, 1);
    }
  }
  const out = [];
  for (const [k, list] of lines) {
    const [axis, ck] = k.split(':');
    const c = Number(ck) / 100;
    const cuts = [...new Set(list.flatMap((s) => [key(s.a), key(s.b)]))].sort((p, q) => p - q);
    let cur = null;
    for (let i = 0; i < cuts.length - 1; i++) {
      const a = cuts[i] / 100, b = cuts[i + 1] / 100, mid = (a + b) / 2;
      const hits = list.filter((s) => s.a < mid && s.b > mid);
      if (!hits.length) { cur = null; continue; }
      const owners = [...new Set(hits.map((s) => s.room))].sort();
      const internal = owners.length === 1 && hits.length >= 2 && new Set(hits.map((s) => s.side)).size === 2;
      const sig = owners.join('+') + (internal ? '#i' : '');
      if (cur && cur.sig === sig && Math.abs(cur.b - a) < 1e-6) cur.b = b;
      else { cur = { axis, c, a, b, rooms: owners, sig, internal }; out.push(cur); }
    }
  }
  return out;
}

// Wall segment with openings -> box geometries (extended by t/2 at both ends to close corners).
function wallPieces(seg, openings, y0, h, t) {
  const geos = [];
  const add = (a, b, bottom, top) => {
    if (b - a < 1e-3 || top - bottom < 1e-3) return;
    const len = b - a, hh = top - bottom;
    const g = seg.axis === 'z' ? new THREE.BoxGeometry(len, hh, t) : new THREE.BoxGeometry(t, hh, len);
    const cx = seg.axis === 'z' ? (a + b) / 2 : seg.c;
    const cz = seg.axis === 'z' ? seg.c : (a + b) / 2;
    g.translate(cx, y0 + bottom + hh / 2, cz);
    geos.push(g);
  };
  const A = seg.a - t / 2, B = seg.b + t / 2;
  const sorted = openings.filter((o) => o.b > A && o.a < B).sort((p, q) => p.a - q.a);
  let cursor = A;
  for (const o of sorted) {
    const oa = Math.max(o.a, A), ob = Math.min(o.b, B);
    add(cursor, oa, 0, h);
    add(oa, ob, 0, o.bottom);
    add(oa, ob, Math.min(o.top, h), h);
    cursor = ob;
  }
  add(cursor, B, 0, h);
  return geos;
}
