import * as THREE from 'three';
import { Materials, rng } from './materials.js';
import { GENERATORS } from './proc/index.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

// Data-driven furnishing (P07). Reads houses/<id>/furniture.json:
//   { rooms: { <roomId>: { level?: 'ground'|'first', floorY?: m, items: [ Item, ... ] } }, models?: { <name>: ModelDefaults } }
// Item = { model | proc, pos:[x, yAboveFloor, z], rotY?: deg, scale?: n|[x,y,z], variant?, params? (proc),
//          snap?: 'N'|'S'|'E'|'W'|[...] (push until the back/side touches that wall; gap?: m, rayY?: m),
//          drop?: true|yStart (fall onto the surface below: furniture or floor), collide?: bool, collider?: [[min],[max]] local,
//          shadow?: bool, tint?: '#hex' | {<materialName>: '#hex'}, repeat?: {n, step:[dx,dy,dz], rotStep?}, id?, tuck?: bool }
// Model conventions (manifest): origin at base centre, min Y = 0, front = +Z. rotY 0 -> front faces +Z (south),
// 90 -> east (+X), 180 -> north, -90 -> west. ModelDefaults.yaw (deg) corrects models whose front is not +Z.
const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const DIRS = { N: [0, 0, -1], S: [0, 0, 1], E: [1, 0, 0], W: [-1, 0, 0] };

export class Furnisher {
  constructor(game) {
    this.game = game;
    this.root = new THREE.Group();
    this.root.name = 'FURNISH';
    this.templates = new Map();   // key -> {object, box}
    this.placed = [];             // {item, key, matrix, box(local), object, floorY, room}
    this.colliderMeshes = [];
    this.report = { items: 0, instanced: 0, meshes: 0, warnings: [] };
    this._ray = new THREE.Raycaster();
  }

  async load(houseId) {
    const L = this.game.loader;
    const [data, manifest] = await Promise.all([
      L.json(`/houses/${houseId}/furniture.json`, 'furniture list'),
      L.json('/assets/manifest.json', 'asset manifest'),
    ]);
    this.data = data; this.manifest = manifest;
    this.mats = await new Materials(this.game, manifest).init();
    const items = this._flatten(data);
    // Models: every item's model + generator dependencies.
    const need = new Set();
    for (const it of items) {
      if (it.model) need.add(it.model);
      if (it.proc && GENERATORS[it.proc]?.deps) for (const d of GENERATORS[it.proc].deps(it.params || {})) need.add(d);
    }
    // A missing/failed model never aborts furnishing: one warning per model, its items are skipped and
    // generators get an empty placeholder (partial asset sets still furnish).
    this.missing = new Set();
    await Promise.all([...need].map((n) => this._loadModel(n).catch((e) => {
      this.missing.add(n); this._warn(`model ${n}: ${e.message} (skipped)`); console.warn(`[furnish] model "${n}" unavailable: ${e.message} — skipped`);
    })));
    // Build + place in list order (so `drop` lands on things placed earlier).
    this.work = new THREE.Group(); this.work.name = 'FURNISH_work';
    this.root.add(this.work);
    for (const it of items) {
      try { this._place(it); } catch (e) { this._warn(`${it.room}/${it.model || it.proc}: ${e.message}`); console.error(e); }
    }
    this._instance();
    this._buildColliders();
    this._validate();          // against the house-only BVH (before our boxes join it)
    this._registerColliders();
    if (!/[?&]nomerge\b/.test(globalThis.location?.search || '')) this._merge();
    this.root.traverse((o) => { if (o.isMesh) this.report.meshes++; });
    this.game.scene.add(this.root);
    this.game.renderer.applyAnisotropy?.(this.root);
    return this;
  }

  // ---------------------------------------------------------------------------------------------
  _levelFloor(level) {
    const lv = this.game.house.meta?.levels?.find((l) => l.id === level);
    if (lv) return lv.floor;
    const s = this.game.house.spec?.levels?.find((l) => l.id === level);
    return s ? s.elevation : 0;
  }

  _flatten(data) {
    const out = [];
    const rooms = this.game.house.rooms();
    for (const [roomId, room] of Object.entries(data.rooms || {})) {
      const r = rooms.find((q) => q.id === roomId);
      const level = room.level || r?.level || 'ground';
      const floorY = room.floorY ?? this._levelFloor(level);
      for (const raw of room.items || []) {
        if (raw.skip) continue;
        const n = raw.repeat?.n || 1;
        for (let k = 0; k < n; k++) {
          const it = { ...raw, room: roomId, floorY };
          if (k) {
            const st = raw.repeat.step || [0, 0, 0];
            it.pos = [raw.pos[0] + st[0] * k, (raw.pos[1] || 0) + st[1] * k, raw.pos[2] + st[2] * k];
            it.rotY = (raw.rotY || 0) + (raw.repeat.rotStep || 0) * k;
            if (raw.repeat.seedStep) it.params = { ...(raw.params || {}), seed: (raw.params?.seed || 1) + k };
          }
          out.push(it);
        }
      }
    }
    return out;
  }

  async _loadModel(name) {
    if (this.templates.has(name)) return;
    const info = this.manifest.models?.[name];
    if (!info) throw new Error('not in manifest');
    const gltf = await this.game.loader.loadGLTF(`/assets/${info.file}`, `model ${name}`);
    const scene = gltf.scene;
    scene.traverse((o) => {
      if (!o.isMesh) return;
      const mats = Array.isArray(o.material) ? o.material : [o.material];
      for (const m of mats) {
        if (!m) continue;
        if (m.map) m.map.anisotropy = 8;
        // alpha-masked foliage/weaves: keep them cheap and sorted-free
        if (m.transparent && m.alphaTest === 0 && m.map && !/glass/i.test(m.name)) { m.alphaTest = 0.5; m.transparent = false; }
      }
    });
    this.templates.set(name, { scene, info });
  }

  // Template object for (model, variant): a detached clone whose root is at the origin.
  _template(model, variant) {
    const key = variant ? `${model}#${variant}` : model;
    let t = this.templates.get(key);
    if (t?.object) return t;
    const base = this.templates.get(model);
    if (!base) return this._placeholder(key, model, `model "${model}" not loaded`);
    let src = base.scene;
    if (variant) {
      src = base.scene.getObjectByName(variant);
      if (!src) return this._placeholder(key, model, `variant "${variant}" not found in ${model}`);
    }
    let object;
    if (variant) {
      // Variants are top-level children "centred at the origin": keep their own transform inside a wrapper.
      object = new THREE.Group(); object.name = key;
      const v = src.clone(true); v.position.x = 0; v.position.z = 0;
      object.add(v);
    } else {
      object = src.clone(true);
      object.position.set(0, 0, 0); object.quaternion.identity(); object.scale.set(1, 1, 1);
    }
    object.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(object);
    t = { object, box, info: base.info };
    this.templates.set(key, t);
    return t;
  }

  // Empty stand-in for a missing model/variant (warned once per key); `missing` lets _place skip items.
  _placeholder(key, model, why) {
    if (!this.missing?.has(model) && !this._phWarned?.has(key)) {
      (this._phWarned ||= new Set()).add(key); this._warn(`${why} (skipped)`); console.warn(`[furnish] ${why} — skipped`);
    }
    const object = new THREE.Group(); object.name = `missing_${key}`;
    const t = { object, box: new THREE.Box3(V(), V()), info: null, missing: true };
    this.templates.set(key, t);
    return t;
  }

  _place(it) {
    const G = this.game;
    let object, box, key;
    const defaults = this.data.models?.[it.model] || {};
    if (it.proc) {
      const gen = GENERATORS[it.proc];
      if (!gen) throw new Error(`unknown generator "${it.proc}"`);
      const ctx = {
        mats: this.mats, THREE, rng: rng(it.params?.seed || 1),
        model: (name, variant) => this._template(name, variant).object.clone(true),
        modelBox: (name, variant) => this._template(name, variant).box.clone(),
      };
      object = gen.build(it.params || {}, ctx);
      object.updateMatrixWorld(true);
      box = new THREE.Box3().setFromObject(object);
      key = it.instanceKey ? `proc:${it.proc}:${it.instanceKey}` : null;   // procedural pieces are unique unless keyed
    } else {
      const t = this._template(it.model, it.variant || defaults.variant);
      if (t.missing) { this.report.skipped = (this.report.skipped || 0) + 1; return; }
      object = t.object.clone(true);
      box = t.box.clone();
      key = `${it.model}#${it.variant || ''}#${JSON.stringify(it.tint || '')}`;
      if (it.tint) this._tint(object, it.tint);
    }
    // scale
    const s = it.scale ?? defaults.scale ?? 1;
    const scl = Array.isArray(s) ? V(...s) : V(s, s, s);
    const yaw = THREE.MathUtils.degToRad((it.rotY || 0) + (defaults.yaw || 0));
    const pos = V(it.pos[0], it.floorY + (it.pos[1] || 0), it.pos[2]);
    const quat = new THREE.Quaternion().setFromAxisAngle(V(0, 1, 0), yaw);
    // extents of the rotated/scaled local box around pos (XZ), for snapping
    const ext = () => {
      const m = new THREE.Matrix4().compose(V(), quat, scl);
      const b = box.clone().applyMatrix4(m);
      return b;
    };
    // --- wall snapping (house geometry only)
    const snaps = it.snap ? (Array.isArray(it.snap) ? it.snap : [it.snap]) : [];
    for (const side of snaps) {
      const d = DIRS[side];
      const b = ext();
      const origin = V(pos.x, it.floorY + (it.rayY ?? 0.55), pos.z);
      // start from the item's centre in plan
      origin.x += (b.min.x + b.max.x) / 2; origin.z += (b.min.z + b.max.z) / 2;
      const hit = G.physics.raycast(origin, V(...d), 8);
      if (!hit) { this._warn(`${it.room}/${it.model || it.proc}: snap ${side} found no wall`); continue; }
      const gap = it.gap ?? 0.012;
      if (side === 'N') pos.z = hit.point.z + gap - b.min.z;
      if (side === 'S') pos.z = hit.point.z - gap - b.max.z;
      if (side === 'W') pos.x = hit.point.x + gap - b.min.x;
      if (side === 'E') pos.x = hit.point.x - gap - b.max.x;
    }
    // --- drop onto whatever is below (earlier furniture or the floor)
    if (it.drop !== undefined && it.drop !== false) {
      const start = it.floorY + (typeof it.drop === 'number' ? it.drop : (it.pos[1] || 0) + 0.6);
      const y = this._surfaceBelow(pos.x, start, pos.z, it.floorY);
      if (y === null) this._warn(`${it.room}/${it.model || it.proc}: drop found nothing`);
      else pos.y = y + (it.lift || 0);
    }
    const wrap = new THREE.Group();
    wrap.name = `F_${it.id || it.model || it.proc}`;
    wrap.position.copy(pos); wrap.quaternion.copy(quat); wrap.scale.copy(scl);
    wrap.add(object);
    wrap.userData.furnish = { room: it.room, model: it.model, proc: it.proc, id: it.id };
    this.work.add(wrap);
    wrap.updateMatrixWorld(true);
    // shadows
    const size = box.getSize(V()).multiply(scl);
    // Shadow passes carry only large pieces: small props (books, clutter, kitchen items, decor < ~0.3 m) never cast.
    const big = Math.max(size.x, size.z);
    const cast = it.shadow ?? defaults.shadow ?? ((size.y > 0.3 && big > 0.3) || big > 0.9);
    wrap.traverse((o) => {
      if (!o.isMesh) return;
      const clear = [].concat(o.material).some((m) => m && (m.transparent || (m.transmission ?? 0) > 0));
      o.castShadow = cast && !clear && !o.userData.noShadow;
      o.receiveShadow = !clear;
    });
    this.placed.push({ item: it, key, wrap, box, size, floorY: it.floorY, room: it.room });
    this.report.items++;
  }

  _tint(object, tint) {
    object.traverse((o) => {
      if (!o.isMesh) return;
      const one = (m) => {
        const want = typeof tint === 'string' ? tint : tint[m.name];
        if (!want) return m;
        const c = m.clone(); c.color = new THREE.Color(want); return c;
      };
      o.material = Array.isArray(o.material) ? o.material.map(one) : one(o.material);
    });
  }

  // Highest surface under (x,z) below yStart: placed furniture meshes, then the static house BVH.
  _surfaceBelow(x, yStart, z, floorY) {
    let best = null;
    this._ray.set(V(x, yStart, z), V(0, -1, 0));
    this._ray.far = yStart - floorY + 0.5;
    const hits = this._ray.intersectObject(this.work, true);
    for (const h of hits) {
      const m = [].concat(h.object.material)[0];
      if (!h.object.visible || m?.transparent) continue;
      best = h.point.y; break;
    }
    const hh = this.game.physics.raycast(V(x, yStart, z), V(0, -1, 0), yStart - floorY + 0.5);
    if (hh && (best === null || hh.point.y > best)) best = hh.point.y;
    return best;
  }

  // Repeated models -> one InstancedMesh per sub-mesh. Singletons stay as regular meshes.
  _instance() {
    const groups = new Map();
    for (const p of this.placed) {
      if (!p.key || p.item.noInstance) continue;
      if (!groups.has(p.key)) groups.set(p.key, []);
      groups.get(p.key).push(p);
    }
    const inv = new THREE.Matrix4();
    for (const [key, list] of groups) {
      if (list.length < 2) continue;
      const first = list[0].wrap;
      first.updateMatrixWorld(true);
      inv.copy(first.matrixWorld).invert();
      const meshes = [];
      first.traverse((o) => { if (o.isMesh) meshes.push(o); });
      for (const m of meshes) {
        const rel = inv.clone().multiply(m.matrixWorld);
        const im = new THREE.InstancedMesh(m.geometry, m.material, list.length);
        im.name = `FI_${key}_${m.name}`;
        list.forEach((p, i) => { p.wrap.updateMatrixWorld(true); im.setMatrixAt(i, p.wrap.matrixWorld.clone().multiply(rel)); });
        im.instanceMatrix.needsUpdate = true;
        im.castShadow = m.castShadow; im.receiveShadow = m.receiveShadow;
        im.computeBoundingSphere(); im.computeBoundingBox?.();
        this.root.add(im);
      }
      for (const p of list) { p.wrap.removeFromParent(); p.instanced = true; }
      this.report.instanced += list.length;
    }
  }

  // Draw-call budget: bake every remaining (non-instanced) opaque mesh into one mesh per (room, material,
  // shadow flags, attribute layout). Shared palette/GLB materials merge by identity; plain untextured GLB
  // materials (colour-only) additionally collapse into one vertex-coloured material per (roughness,
  // metalness, side) bucket. Emissive / night-glow / transparent / skinned meshes stay as they are.
  _merge() {
    const groups = new Map();
    const shared = new Map();
    const q = (v) => Math.round((v ?? 0) * 20) / 20;
    const plain = (m) => m.isMeshStandardMaterial && !m.vertexColors && !m.map && !m.normalMap && !m.roughnessMap && !m.metalnessMap && !m.aoMap &&
      !m.emissiveMap && !m.alphaMap && !(m.transmission > 0) && !(m.clearcoat > 0) && !(m.sheen > 0) && m.emissive.getHex() === 0 && !m.userData?.night;
    this.work.updateMatrixWorld(true);
    // grouped per LEVEL (not per room): fewer draw calls; indoors the frustum rarely culls a whole room anyway
    const byRoom = new Map(this.placed.filter((p) => !p.instanced).map((p) => [p.wrap, `L${p.floorY.toFixed(2)}`]));
    for (const wrap of [...this.work.children]) {
      const room = byRoom.get(wrap) ?? '_';
      wrap.traverse((o) => {
        if (!o.isMesh || o.isInstancedMesh || o.isSkinnedMesh || Array.isArray(o.material) || !o.visible) return;
        const m = o.material;
        if (!m || m.transparent || m.userData?.night !== undefined || o.userData.noMerge || (m.emissive && m.emissive.getHex() !== 0)) return;
        const attrs = Object.keys(o.geometry.attributes).filter((a) => ['position', 'normal', 'uv', 'uv1', 'color'].includes(a)).sort();
        if (!attrs.includes('normal')) return;
        let mat = m, colour = null;
        if (plain(m)) {
          const k = `${q(m.roughness)}|${q(m.metalness)}|${m.side}|${m.flatShading}`;
          mat = shared.get(k);
          if (!mat) {
            mat = new THREE.MeshStandardMaterial({ roughness: m.roughness, metalness: m.metalness, side: m.side, vertexColors: true, envMapIntensity: m.envMapIntensity ?? 1 });
            mat.name = `P07_plain_${k}`; shared.set(k, mat);
          }
          colour = m.color;
        }
        // plain materials: colour becomes a vertex colour (UVs dropped); others keep their own attributes (incl. vertex colours)
        const layout = colour ? attrs.filter((a) => a === 'position' || a === 'normal').join(',') + ',color' : attrs.join(',');
        const key = `${room}|${mat.uuid}|${o.castShadow}|${o.receiveShadow}|${layout}`;
        if (!groups.has(key)) groups.set(key, { mat, cast: o.castShadow, recv: o.receiveShadow, list: [] });
        groups.get(key).list.push({ o, colour, layout: layout.split(',') });
      });
    }
    let merged = 0, saved = 0;
    for (const [key, g] of groups) {
      if (g.list.length < 2 && !g.list[0].colour) continue;
      const geos = g.list.map(({ o, colour, layout }) => {
        const src = o.geometry;
        const geo = new THREE.BufferGeometry();
        for (const a of layout) {
          if (a === 'color' && colour) continue;
          const at = src.attributes[a];
          const arr = new Float32Array(at.count * at.itemSize);
          const get = [at.getX, at.getY, at.getZ, at.getW];   // these denormalise quantized (KHR_mesh_quantization) data
          for (let i = 0; i < at.count; i++) for (let c = 0; c < at.itemSize; c++) arr[i * at.itemSize + c] = get[c].call(at, i);
          geo.setAttribute(a, new THREE.BufferAttribute(arr, at.itemSize));
        }
        const n = geo.attributes.position.count;
        if (colour) {
          const col = new Float32Array(n * 3);
          for (let i = 0; i < n; i++) { col[i * 3] = colour.r; col[i * 3 + 1] = colour.g; col[i * 3 + 2] = colour.b; }
          geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
        }
        if (src.index) geo.setIndex(Array.from(src.index.array));
        else { const idx = new Uint32Array(n); for (let i = 0; i < n; i++) idx[i] = i; geo.setIndex(new THREE.BufferAttribute(idx, 1)); }
        geo.applyMatrix4(o.matrixWorld);
        return geo;
      });
      const geo = mergeGeometries(geos, false);
      if (!geo) { this._warn(`merge failed for ${key}`); continue; }
      geo.computeBoundingSphere(); geo.computeBoundingBox();
      const mesh = new THREE.Mesh(geo, g.mat);
      mesh.name = `FM_${key.split('|')[0]}_${g.mat.name || 'mat'}`;
      mesh.castShadow = g.cast; mesh.receiveShadow = g.recv;
      this.root.add(mesh);
      for (const { o } of g.list) { o.removeFromParent(); }
      for (const gg of geos) gg.dispose();
      merged++; saved += g.list.length - 1;
    }
    this.report.merged = { meshes: merged, drawCallsSaved: saved };
  }

  // Oriented collision boxes for floor-standing furniture, merged into ONE invisible mesh, registered
  // with game.physics through the shared collider-set convention (game.colliderSets, see CONTRACTS.md).
  _buildColliders() {
    const geos = [];
    this.colBoxes = [];
    for (const p of this.placed) {
      const it = p.item;
      const defaults = this.data.models?.[it.model] || {};
      const boxes = [];
      const custom = it.collider || defaults.collider;
      const genCols = p.wrap.children[0]?.userData?.colliders;
      if (it.collide === false || defaults.collide === false) continue;
      if (custom) boxes.push(custom);
      else if (genCols) boxes.push(...genCols);
      else {
        const wy = p.wrap.position.y - p.floorY;
        // props dropped onto furniture/shelves never collide; dropped floor pieces (deck) opt in with collide:true
        const auto = !(it.drop !== undefined && it.drop !== false) && wy < 0.3 && p.size.y > 0.3 && Math.max(p.size.x, p.size.z) >= 0.25;
        if (!(it.collide === true || auto)) continue;
        boxes.push([p.box.min.toArray(), p.box.max.toArray()]);
      }
      for (const [mn, mx] of boxes) {
        const g = new THREE.BoxGeometry(mx[0] - mn[0], Math.max(0.05, mx[1] - mn[1]), mx[2] - mn[2]);
        g.translate((mn[0] + mx[0]) / 2, (mn[1] + mx[1]) / 2, (mn[2] + mx[2]) / 2);
        g.applyMatrix4(p.wrap.matrixWorld);
        geos.push(g);
        this.colBoxes.push({ p, mn, mx });
      }
    }
    if (!geos.length) return;
    const merged = mergeBoxes(geos);
    const mesh = new THREE.Mesh(merged, new THREE.MeshBasicMaterial({ visible: false }));
    mesh.name = 'COL_furnish';
    mesh.visible = false;
    this.colliderMeshes = [mesh];
  }

  _registerColliders() {
    if (!this.colliderMeshes.length) return;
    const G = this.game;
    G.colliderSets = G.colliderSets || new Map();
    G.colliderSets.set('furnish', this.colliderMeshes);
    const extra = [...G.colliderSets.values()].flat();
    G.physics.setColliders([...G.house.colliders, ...(G.lighting.ground ? [G.lighting.ground] : []), ...extra]);
  }

  // QA: overlaps between floor-standing pieces, pieces poking through walls, door swings blocked.
  _validate() {
    const obb = this.colBoxes.map(({ p, mn, mx }) => {
      const m = p.wrap.matrixWorld;
      const c = [[mn[0], mn[2]], [mx[0], mn[2]], [mx[0], mx[2]], [mn[0], mx[2]]].map(([x, z]) => V(x, 0, z).applyMatrix4(m));
      const y0 = V(0, mn[1], 0).applyMatrix4(m).y, y1 = V(0, mx[1], 0).applyMatrix4(m).y;
      return { p, c, y0: Math.min(y0, y1), y1: Math.max(y0, y1), name: `${p.room}/${p.item.id || p.item.model || p.item.proc}` };
    });
    const overlaps = [];
    for (let i = 0; i < obb.length; i++) for (let j = i + 1; j < obb.length; j++) {
      const a = obb[i], b = obb[j];
      if (a.p === b.p || a.p.item.tuck || b.p.item.tuck) continue;
      if (a.y1 <= b.y0 + 0.01 || b.y1 <= a.y0 + 0.01) continue;
      const pen = satPenetration(a.c, b.c);
      if (pen > 0.015) overlaps.push(`${a.name} x ${b.name} (${(pen * 100).toFixed(1)} cm)`);
    }
    // wall pokes: ray from the box centre to each corner at 2 heights must not hit the house
    const walls = [];
    for (const o of obb) {
      const cx = o.c.reduce((s, q) => s + q.x, 0) / 4, cz = o.c.reduce((s, q) => s + q.z, 0) / 4;
      for (const h of [o.y0 + 0.12, Math.min(o.y1 - 0.05, o.y0 + 1.0)]) {
        for (const q of o.c) {
          const from = V(cx, h, cz), dir = V(q.x - cx, 0, q.z - cz);
          const len = dir.length(); if (len < 1e-3) continue;
          const hit = this.game.physics.raycast(from, dir.normalize(), len);
          if (hit && len - hit.distance > 0.02) { walls.push(`${o.name} pokes ${((len - hit.distance) * 100).toFixed(1)} cm`); break; }
        }
      }
    }
    // door swings: the leaf sweeps the sector between its closed direction (hinge -> opening centre) and its
    // default open angle (meta default_open, ~92 deg) with radius = leaf width + 5 cm. Nothing may stand in it.
    const doors = [];
    const meta = this.game.house.meta || {};
    const specOpen = Object.fromEntries((this.game.house.spec?.openings || []).map((o) => [o.id, o]));
    const outline = (o, fn) => {
      for (let k = 0; k < 4; k++) {
        const a = o.c[k], b = o.c[(k + 1) % 4];
        for (let t = 0; t <= 1.0001; t += 0.05) if (fn(a.x + (b.x - a.x) * t, a.z + (b.z - a.z) * t)) return true;
      }
      // box centre too (covers a zone entirely inside a box)
      const cx = o.c.reduce((q, v) => q + v.x, 0) / 4, cz = o.c.reduce((q, v) => q + v.z, 0) / 4;
      return fn(cx, cz);
    };
    for (const d of meta.doors || []) {
      const so = specOpen[d.id]; if (!so) continue;
      const hx = d.hinge[0], hz = d.hinge[2], R = d.width + 0.05;
      const cx = so.at[0] - hx, cz = so.at[1] - hz; const cl = Math.hypot(cx, cz) || 1;
      const a0 = Math.atan2(cz / cl, cx / cl);
      const ang = d.default_open ?? (d.swing * (d.open_angle ?? 1.6));
      // three.js rotation about +Y by `ang` maps angle a -> a - ang in atan2(z, x) terms
      const a1 = a0 - ang;
      const lo = Math.min(a0, a1), hi = Math.max(a0, a1);
      const inSector = (x, z) => {
        const r = Math.hypot(x - hx, z - hz); if (r > R || r < 0.02) return false;
        let a = Math.atan2(z - hz, x - hx);
        while (a < lo - 1e-6) a += Math.PI * 2; while (a > lo + Math.PI * 2) a -= Math.PI * 2;
        return a <= hi + 0.05;
      };
      for (const o of obb) {
        if (Math.abs(o.y0 - d.hinge[1]) > 0.6 && o.y0 > d.hinge[1] + 2.1) continue;
        if (o.y1 < d.hinge[1] + 0.05 || o.y0 > d.hinge[1] + 2.0) continue;
        if (outline(o, inSector)) doors.push(`${d.id} swing blocked by ${o.name}`);
      }
    }
    // sliding doors: keep the open panel's range clear 0.8 m deep on BOTH sides of the wall
    for (const op of meta.openings || []) {
      if (!op.open_range) continue;
      const lv = (meta.levels || []).find((l) => l.id === op.level); const fy = lv?.floor ?? 0;
      const [u0, u1] = op.open_range, half = (op.wall_t ?? 0.3) / 2;
      const zones = [[op.wall_c + half, op.wall_c + half + 0.8], [op.wall_c - half - 0.8, op.wall_c - half]];
      for (const o of obb) {
        if (o.y1 < fy + 0.05 || o.y0 > fy + 2.0) continue;
        const hit = outline(o, (x, z) => {
          const u = op.run === 'z' ? z : x, w = op.run === 'z' ? x : z;
          return u > u0 && u < u1 && zones.some(([a, b]) => w > a && w < b);
        });
        if (hit) doors.push(`${op.id} slider walkway blocked by ${o.name}`);
      }
    }
    this.report.overlaps = overlaps; this.report.wallPokes = walls; this.report.doorBlocks = doors;
    const n = overlaps.length + walls.length + doors.length + this.report.warnings.length;
    if (n) console.warn(`[furnish] QA: ${overlaps.length} overlaps, ${walls.length} wall pokes, ${doors.length} blocked doors, ${this.report.warnings.length} warnings — see __furnish.report`);
  }

  _warn(msg) { this.report.warnings.push(msg); }

  // Night: lamp shades / LED strips glow (materials opt in by name containing 'P07_led').
  setNight(on) {
    for (const m of Object.values(this.mats?.m || {})) {
      if (m.userData.night !== undefined) m.emissiveIntensity = on ? m.userData.night : 0;
    }
    if (this.mats?.m?.flame) this.mats.m.flame.opacity = on ? 0.9 : 0.55;
  }
}

function inRects(rects, x, z) { return rects.some(([rx, rz, w, d]) => x > rx && x < rx + w && z > rz && z < rz + d); }

// Separating-axis penetration depth of two convex quads (XZ). <= 0 means separated.
function satPenetration(A, B) {
  let min = Infinity;
  for (const P of [A, B]) {
    for (let i = 0; i < 4; i++) {
      const p = P[i], q = P[(i + 1) % 4];
      const nx = -(q.z - p.z), nz = q.x - p.x; const l = Math.hypot(nx, nz) || 1;
      const ax = nx / l, az = nz / l;
      let a0 = Infinity, a1 = -Infinity, b0 = Infinity, b1 = -Infinity;
      for (const v of A) { const d = v.x * ax + v.z * az; a0 = Math.min(a0, d); a1 = Math.max(a1, d); }
      for (const v of B) { const d = v.x * ax + v.z * az; b0 = Math.min(b0, d); b1 = Math.max(b1, d); }
      const o = Math.min(a1, b1) - Math.max(a0, b0);
      if (o <= 0) return 0;
      min = Math.min(min, o);
    }
  }
  return min;
}

function mergeBoxes(geos) {
  let n = 0; for (const g of geos) n += g.index.count;
  const pos = new Float32Array(n * 3); let k = 0;
  for (const g of geos) {
    const p = g.attributes.position, idx = g.index;
    for (let i = 0; i < idx.count; i++) { const j = idx.getX(i); pos[k++] = p.getX(j); pos[k++] = p.getY(j); pos[k++] = p.getZ(j); }
    g.dispose();
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  out.computeVertexNormals();
  return out;
}
