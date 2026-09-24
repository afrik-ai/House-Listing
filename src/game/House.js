import * as THREE from 'three';
import { buildProceduralHouse, roomRects } from './ProceduralHouse.js';

const EYE = 1.65;

// Loads the house (GLB when present, procedural placeholder otherwise), parses the node
// naming contract (ROOM_/DOOR_/LIGHT_/COL_/SPAWN/SURF_) and registers collision.
export class House {
  constructor(game) {
    this.game = game;
    this.id = game.houseId;
    this.root = new THREE.Group();
    this.root.name = 'HOUSE';
    this.kind = null;
    this.spec = null;          // houses/<id>/house.json
    this.meta = null;          // house.meta.json (GLB path)
    this._rooms = [];
    this.doors = [];
    this.lights = [];
    this.surfaces = [];
    this.colliders = [];
    this.spawn = { pos: [0, 0, 0], yaw: 0 };
    this.bounds = new THREE.Box3();
  }

  async load() {
    const { loader } = this.game;
    this.spec = await loader.json(`/houses/${this.id}/house.json`, 'house spec').catch(() => null);
    const res = await loader.house(this.id);
    this.kind = res.kind;

    if (res.kind === 'glb') {
      this.meta = res.meta;
      this.root.add(res.gltf.scene);
    } else {
      if (!this.spec) throw new Error(`no GLB and no spec for house "${this.id}"`);
      const built = buildProceduralHouse(this.spec);
      this.root.add(built.root);
      this.spawn = built.spawn;
    }
    this.root.updateMatrixWorld(true);   // ROOM_/SPAWN empties are read in world space below
    this._parse();
    this._buildRooms();
    this.game.scene.add(this.root);
    this.root.updateMatrixWorld(true);
    this.bounds.setFromObject(this.root);
    // The lawn/site makes the box huge; use the room rects for the "house" bounds when we have them.
    if (this.spec) this.bounds.copy(this._specBounds());
    this.game.physics.setColliders(this.colliders);
    this.game.renderer.applyAnisotropy(this.root);
    return this;
  }

  // Load hook: shadow/visibility/collision policy for every mesh (GLB or procedural).
  //  * COL_* proxies: never rendered, never cast/receive shadows; collide (static, except door ones).
  //  * Glass / transmissive / transparent materials: never cast shadows (sunlight must enter the
  //    house through the glazing) and don't collide (their COL_glass_* proxy does, if present).
  //  * Door leaves (anything under a DOOR_<id> hinge): excluded from the STATIC collider; their
  //    COL_DOOR_* proxies are exposed as house.doorColliders for P09 to handle dynamically.
  //  * GPU-instanced meshes (slats) don't collide (static BVH ignores instance matrices).
  //  * If a COL_stair proxy exists, the visible stair meshes don't collide (the proxy is the ramp).
  _parse() {
    const cols = [];
    const meshes = [];
    const doorNodes = new Set((this.meta?.doors || []).map((d) => d.node).filter(Boolean));
    const isDoorHinge = (o) => !o.isMesh && (doorNodes.size ? doorNodes.has(o.name) : o.name.startsWith('DOOR_') && !/_leaf$/.test(o.name));
    const underDoor = (o) => { for (let p = o.parent; p; p = p.parent) if (isDoorHinge(p)) return true; return false; };
    let hasStairProxy = false;
    this.root.traverse((o) => { if (/^COL_stair/i.test(o.name)) hasStairProxy = true; });
    this.doorColliders = [];
    this.glass = [];
    this.root.traverse((o) => {
      const n = o.name || '';
      if (o.isMesh) {
        const mats = Array.isArray(o.material) ? o.material : [o.material];
        const clear = mats.some((m) => m && (m.transparent || (m.transmission ?? 0) > 0 || (m.opacity ?? 1) < 1 || /glass/i.test(m.name || '')));
        if (n.startsWith('COL_')) {
          o.visible = false; o.castShadow = false; o.receiveShadow = false;
          if (underDoor(o) || /^COL_DOOR/.test(n)) this.doorColliders.push(o); else cols.push(o);
        } else if (o.userData.colliderOnly) {
          o.visible = false; o.castShadow = false; o.receiveShadow = false; meshes.push(o);
        } else {
          o.castShadow = !clear && o.userData.castShadow !== false;
          o.receiveShadow = !clear;
          if (clear) {
            this.glass.push(o);
            // Engine glass policy: keep the tint subtle (strong green tints read "sickly" when lit
            // interiors are seen through them at night). Done once per material.
            for (const m of mats) if (m && !m.userData._p01glass) { m.userData._p01glass = true; m.color?.lerp(new THREE.Color(1, 1, 1), 0.55); if (m.attenuationColor) m.attenuationColor.lerp(new THREE.Color(1, 1, 1), 0.55); }
          }
          const skip = clear || o.userData.noCollide || n.startsWith('WATER_') || o.isInstancedMesh || underDoor(o)
            || (hasStairProxy && /stair/i.test(n));
          if (!skip) meshes.push(o);
        }
        if (n.startsWith('SURF_')) {
          // glTF extra `surface` (P02) is authoritative; name parsing is only a fallback (room ids contain '_').
          let type = o.userData.surface || o.parent?.userData?.surface;
          if (!type) { const known = ['large_format_tile_grey', 'large_format_tile_light', 'small_tile_white', 'concrete_screed', 'concrete_pavers', 'oak_plank', 'stair_tread']; type = known.find((k) => n.startsWith(`SURF_${k}`)) || n.slice(5).split('_')[0]; }
          this.surfaces.push({ mesh: o, type });
        }
      }
      if (isDoorHinge(o) && !o.isMesh) this.doors.push({ id: n.slice(5), node: o });
      if (n.startsWith('LIGHT_')) this.lights.push({ id: n.slice(6), node: o, type: o.userData?.type || 'point', room: o.userData?.room });
      if (n === 'SPAWN') {
        this._hasSpawnNode = true;
        o.updateWorldMatrix(true, false);
        const p = new THREE.Vector3().setFromMatrixPosition(o.matrixWorld);
        const dir = new THREE.Vector3(0, 0, -1).applyQuaternion(o.getWorldQuaternion(new THREE.Quaternion()));
        this.spawn = { pos: p.toArray(), yaw: THREE.MathUtils.radToDeg(Math.atan2(-dir.x, -dir.z)) };
      }
    });
    if (this.meta?.spawn) this.spawn = { pos: this.meta.spawn.pos, yaw: this.meta.spawn.yaw ?? 0 };
    else if (!this._hasSpawnNode && this.spec?.spawn?.pos) this.spawn = { pos: this.spec.spawn.pos, yaw: this.spec.spawn.yaw ?? 0 };
    // Visible geometry + COL_ proxies together: P02's COL_* only cover glass/stair/doors/structure.
    this.colliders = [...meshes, ...cols];
  }

  // Rooms come from house.json rects (needed for roomAt); ROOM_ empties / meta override centers.
  _buildRooms() {
    const rooms = [];
    const levels = Object.fromEntries((this.spec?.levels || []).map((l) => [l.id, l]));
    const addLevel = (list, levelId) => {
      const lv = levels[levelId] || { elevation: 0, clear_height: 2.8 };
      for (const r of list || []) {
        const rects = roomRects(r);
        if (!rects.length) continue;
        const main = rects.reduce((a, q) => (q[2] * q[3] > a[2] * a[3] ? q : a), rects[0]);
        const [x, z, w, d] = main;
        rooms.push({
          id: r.id, name: r.name, level: levelId, rect: bboxOf(rects), rects, main, floor: r.floor,
          area: r.area ?? rects.reduce((a, q) => a + q[2] * q[3], 0),
          center: [x + w / 2, lv.elevation, z + d / 2],
          eye: [x + w / 2, lv.elevation + EYE, z + d / 2],
          yMin: lv.elevation - 0.3, yMax: lv.elevation + lv.clear_height,
          axis: w >= d ? 'x' : 'z',
        });
      }
    };
    addLevel(this.spec?.ground_rooms, 'ground');
    addLevel(this.spec?.first_rooms, 'first');
    // GLB meta refines rects/area/centre of spec rooms (exterior zones stay out of the room list).
    for (const m of this.meta?.rooms || []) {
      if (m.exterior) continue;
      const r = rooms.find((q) => q.id === m.id);
      const lv = this.meta.levels?.find((l) => l.id === m.level);
      const extra = {};
      if (m.rects?.length) { extra.rects = m.rects; extra.rect = bboxOf(m.rects); extra.main = m.rects.reduce((a, q) => (q[2] * q[3] > a[2] * a[3] ? q : a), m.rects[0]); }
      if (m.area) extra.area = m.area;
      if (lv) { extra.yMin = lv.floor - 0.3; extra.yMax = lv.ceil; }
      if (r) Object.assign(r, extra);
      else if (m.center) rooms.push({ id: m.id, name: m.name, level: m.level, floor: m.floor, center: m.center, eye: [m.center[0], m.center[1] + EYE, m.center[2]], ...extra });
    }
    this.root.traverse((o) => {
      if (!o.name?.startsWith('ROOM_')) return;
      if (this.meta?.rooms?.find((m) => m.id === o.name.slice(5))?.exterior) return;
      const r = rooms.find((q) => q.id === o.name.slice(5));
      if (!r) return;
      const p = new THREE.Vector3().setFromMatrixPosition(o.matrixWorld);
      r.center = p.toArray(); r.eye = [p.x, p.y + EYE, p.z];
    });
    this._rooms = rooms;
  }

  // Floor-to-ceiling height of a level (GLB meta, else house.json).
  levelHeight(levelId) {
    const m = this.meta?.levels?.find((l) => l.id === levelId);
    if (m && m.ceil !== undefined) return m.ceil - m.floor;
    return this.spec?.levels?.find((l) => l.id === levelId)?.clear_height ?? 2.8;
  }
  get gradeY() { return this.meta?.grade_y ?? this.spec?.site?.grade_y ?? -0.3; }

  _specBounds() {
    const b = new THREE.Box3();
    for (const r of this._rooms) {
      if (!r.rect) continue;
      b.expandByPoint(new THREE.Vector3(r.rect[0], r.yMin ?? 0, r.rect[1]));
      b.expandByPoint(new THREE.Vector3(r.rect[0] + r.rect[2], (r.yMax ?? 3) + 0.8, r.rect[1] + r.rect[3]));
    }
    for (const e of [...(this.spec.ground_exterior || []), ...(this.spec.first_exterior || [])]) {
      if (e.id === 'driveway') continue;   // flat paving far from the house: keep the shadow box tight
      b.expandByPoint(new THREE.Vector3(e.rect[0], -0.5, e.rect[1]));
      b.expandByPoint(new THREE.Vector3(e.rect[0] + e.rect[2], 3.5, e.rect[1] + e.rect[3]));
    }
    return b.isEmpty() ? this.bounds : b;
  }

  rooms() { return this._rooms.map((r) => ({ id: r.id, name: r.name, level: r.level, center: [...r.center], eye: r.eye ? [...r.eye] : undefined, rect: r.rect ? [...r.rect] : undefined, rects: r.rects?.map((q) => [...q]), main: r.main ? [...r.main] : undefined, area: r.area, axis: r.axis })); }

  // Exterior zones from house.json (terrace, entrance, driveway, balcony) with their level.
  exteriors() {
    const lv = Object.fromEntries((this.spec?.levels || []).map((l) => [l.id, l.elevation]));
    return [
      ...(this.spec?.ground_exterior || []).map((e) => ({ ...e, level: 'ground', elevation: lv.ground ?? 0 })),
      ...(this.spec?.first_exterior || []).map((e) => ({ ...e, level: 'first', elevation: lv.first ?? 3 })),
    ];
  }

  // Floor surface type under a FEET position (for footsteps): room floor, exterior paving or grass.
  surfaceAt(pos) {
    const x = pos.x ?? pos[0], y = pos.y ?? pos[1], z = pos.z ?? pos[2];
    const r = this.roomAt(pos);
    if (r) return this._rooms.find((q) => q.id === r.id)?.floor || 'tile';
    for (const e of this.exteriors()) {
      const [ex, ez, ew, ed] = e.rect;
      if (x >= ex && x <= ex + ew && z >= ez && z <= ez + ed && Math.abs(y - (e.y ?? e.elevation)) < 0.6) return e.floor || 'stone';
    }
    const pool = this.spec?.site?.pool;
    if (pool && x >= pool.x - 0.6 && x <= pool.x + pool.w + 0.6 && z >= pool.z - 0.6 && z <= pool.z + pool.d + 0.6) return 'large_format_tile_light';
    return 'grass';
  }

  // Room containing a FEET position (rect + level band), or null when outside.
  roomAt(pos) {
    const x = pos.x ?? pos[0], y = pos.y ?? pos[1], z = pos.z ?? pos[2];
    let best = null, bestArea = Infinity;
    for (const r of this._rooms) {
      if (y < (r.yMin ?? -Infinity) - 0.4 || y > (r.yMax ?? Infinity)) continue;
      for (const [rx, rz, rw, rd] of r.rects || (r.rect ? [r.rect] : [])) {
        if (x < rx || x > rx + rw || z < rz || z > rz + rd) continue;
        const area = rw * rd;
        if (area < bestArea) { best = r; bestArea = area; }
      }
    }
    return best ? { id: best.id, name: best.name, level: best.level } : null;
  }
}

function bboxOf(rects) {
  let x0 = Infinity, z0 = Infinity, x1 = -Infinity, z1 = -Infinity;
  for (const [x, z, w, d] of rects) { x0 = Math.min(x0, x); z0 = Math.min(z0, z); x1 = Math.max(x1, x + w); z1 = Math.max(z1, z + d); }
  return [x0, z0, x1 - x0, z1 - z0];
}
