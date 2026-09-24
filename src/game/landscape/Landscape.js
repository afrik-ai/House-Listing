import * as THREE from 'three';
import { LandscapeTextures } from './materials.js';
import { buildGround } from './ground.js';
import { buildPool } from './pool.js';
import { buildGrass } from './grass.js';
import { InstancedModels, buildOrnamentals, Trees, scatterRing, scatterFar } from './plants.js';
import { buildHedges, buildFences, buildGabions } from './boundaries.js';
import { buildBollards } from './lights.js';
import { rng, colliderMesh, rectContains } from './util.js';

const NIGHT = { day: 0, golden_hour: 0.3, night: 1 };

// Data-driven site: everything comes from houses/<id>/site.json (see docs/CONTRACTS.md, P04).
export class Landscape {
  constructor(game) {
    this.game = game;
    this.group = new THREE.Group();
    this.group.name = 'LANDSCAPE';
    this.ctx = {
      game, group: this.group, house: game.house, textures: new LandscapeTextures(game),
      colliderBoxes: [], colliderMeshes: [],
    };
  }

  async init() {
    const g = this.game, ctx = this.ctx;
    const site = await g.loader.json(`/houses/${g.houseId}/site.json`, 'site plan');
    ctx.site = site;
    const t0 = performance.now();

    this.timings = {};
    let tl = performance.now();
    const lap = (k) => { const n = performance.now(); this.timings[k] = Math.round(n - tl); tl = n; };
    await buildGround(ctx); lap('ground');
    this.pool = await buildPool(ctx); lap('pool');
    this.grass = buildGrass(ctx, { radius: 13.5 }); lap('grass');
    this.bollards = buildBollards(ctx);
    await buildFences(ctx); lap('fences');
    await buildGabions(ctx); lap('gabions');
    await this._planting(site); lap('planting');

    // bounds walls (street ends / far side) — invisible
    for (const [x, z, w, d] of site.bounds_walls || []) ctx.colliderBoxes.push([x, site.grade_y - 0.5, z, x + w, 3, z + d]);

    g.scene.add(this.group);
    // Our terrain + lawn replace the engine's placeholder ground disc.
    if (g.lighting.ground) g.lighting.ground.visible = false;
    this._colliders();
    // sun shadow coverage is P05's (Lighting.js, cascaded sun shadows); landscape only sets per-mesh cast/receive flags
    this._surfaces();
    g.renderer.applyAnisotropy(this.group);
    this.onTimeOfDay(g.lighting.mode);
    this.onQuality(g.renderer.tier);
    this.buildMs = Math.round(performance.now() - t0);
  }

  // ---- planting: beds, trees, features -------------------------------------------------------
  async _planting(site) {
    const ctx = this.ctx, G = site.grade_y;
    const R = rng(site.plant_seed ?? 99);
    const inst = new InstancedModels(ctx);
    const views = (this.game.views?.().exteriors || []).map((v) => v.pos);
    const clearOf = (x, z, r = 2.0) => !views.some((p) => Math.hypot(p[0] - x, p[2] - z) < r);

    const rockKinds = await Promise.all([1, 2, 3, 4, 5, 6].map((i) => inst.kind('rock_moss_set', `rock_moss_set_01_rock0${i}`, { tint: [1.15, 1.1, 1.05] })));
    const lowKinds = await Promise.all(['a', 'b', 'c', 'd'].map((v) => inst.kind('grass_clump_medium_02', `grass_medium_02_${v}`, { alphaTest: 0.5, tint: [0.8, 0.85, 0.7] })));
    const orn = [];
    const balls = [];
    const place = (key, x, z, s, rot) => {
      const m = new THREE.Matrix4().compose(new THREE.Vector3(x, G, z), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), rot), new THREE.Vector3(s, s, s));
      inst.add(key, m);
    };
    for (const bed of site.gravel_beds || []) {
      const P = site.planting?.[bed.planting];
      if (!P || !bed.rect) continue;
      const [x, z, w, d] = bed.rect;
      const alongX = w >= d;
      const L = alongX ? w : d, W = alongX ? d : w;
      const rows = W >= 1.6 ? 2 : 1;
      const at = (u, v) => (alongX ? [x + u, z + v] : [x + v, z + u]);
      if (bed.planting === 'low') {
        for (let u = 0.35; u < L - 0.2; u += P.shrub_step) {
          const [px, pz] = at(u, W / 2);
          balls.push({ ball: [px, pz, 0.2 + R() * 0.05] });
        }
        continue;
      }
      if (bed.planting === 'island') {
        const cx = x + w / 2, cz = z + d / 2;
        for (let i = 0; i < 9; i++) {
          const a = (i / 9) * Math.PI * 2 + R() * 0.3, rr = 1.05 + R() * 0.35;
          const px = cx + Math.cos(a) * rr * (w / d), pz = cz + Math.sin(a) * rr * 0.75;
          if (!rectContains(bed.rect, px, pz, -0.3)) continue;
          if (i % 3 === 0) balls.push({ ball: [px, pz, 0.3 + R() * 0.08] });
          else orn.push({ type: 'pampas', variant: i, x: px, y: G, z: pz, scale: 0.85 + R() * 0.2, rot: R() * 6.28 });
        }
        continue;
      }
      let i = 0;
      for (let u = 0.6; u < L - 0.4; u += P.grass_step * (0.85 + R() * 0.3), i++) {
        for (let r = 0; r < rows; r++) {
          const v = rows === 1 ? W / 2 : W * (r === 0 ? 0.3 : 0.7) + (R() - 0.5) * 0.15;
          const uu = u + (r === 1 ? P.grass_step * 0.5 : 0);
          if (uu > L - 0.4) continue;
          const [px, pz] = at(uu, v);
          if (!clearOf(px, pz, 2.4)) continue;
          const slot = (i + r * 2) % 5;
          if (slot === 0) balls.push({ ball: [px, pz, 0.32 + R() * 0.1] });
          else if (slot === 3) balls.push({ ball: [px, pz, 0.42 + R() * 0.14], squash: 0.62 + R() * 0.12 });   // low mounded shrub
          else orn.push({ type: (slot === 2) === (r === 0) ? 'pampas' : 'feather', variant: i + r, x: px, y: G, z: pz, scale: 0.85 + R() * 0.3, rot: R() * 6.28 });
        }
        if (R() < P.rock_chance) {
          const [px, pz] = at(u + 0.45, W * (0.15 + R() * 0.7));
          place(rockKinds[Math.floor(R() * 6)], px, pz, 0.16 + R() * 0.12, R() * 6.28);
        }
        // low ground cover along the lawn edge
        if (W > 1.2 && R() < 0.6) {
          const [px, pz] = at(u + 0.3, rows === 1 ? W * 0.85 : W * 0.5);
          place(lowKinds[Math.floor(R() * 4)], px, pz, 1.1 + R() * 0.5, R() * 6.28);
        }
      }
    }
    // entrance: a pair of box balls either side of the front steps
    balls.push({ ball: [14.55, 2.72, 0.2] });

    // hedges + topiary balls share one foliage system
    buildHedges(ctx, [...(site.hedges || []), ...balls]);
    this.ornamentals = buildOrnamentals(orn, this.group);

    // features (fire pit ...)
    for (const f of site.features || []) {
      const key = await inst.kind(f.model);
      const m = new THREE.Matrix4().compose(new THREE.Vector3(f.pos[0], f.y ?? G, f.pos[1]), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), THREE.MathUtils.degToRad(f.rot || 0)), new THREE.Vector3(1, 1, 1));
      inst.add(key, m);
      const sz = inst.size(key);
      ctx.colliderBoxes.push([f.pos[0] - sz.x / 2, G - 0.2, f.pos[1] - sz.z / 2, f.pos[0] + sz.x / 2, G + sz.y, f.pos[1] + sz.z / 2]);
    }
    inst.build(this.group, { castShadow: true });
    // small stuff (rocks, grass tufts) does not cast sun shadows: AO grounds it, and it saves shadow-map triangles
    for (const m of inst.meshes) if (/rock|grass_clump/.test(m.name)) m.castShadow = false;
    this.instanced = inst;

    // trees
    const names = [...new Set([...(site.trees || []).map((t) => t.model), 'tree_island_01', 'tree_island_02', 'tree_small'])];
    const trees = new Trees(ctx);
    await trees.load(names, new InstancedModels(ctx));
    // Garden trees: trunk >= 3 m from every standard exterior viewpoint, path stone and bollard; the
    // canopy clear of the viewpoints (+1 m); lowest foliage >= 2.2 m (walkable lawn) -> scale up if not.
    this.treeInfo = [];
    const views3 = (this.game.views?.().exteriors || []).map((v) => v.pos);
    for (const t of site.trees || []) {
      const M = trees.models.get(t.model);
      const leafMin = Math.min(...M.parts.filter((p) => /leaf|leaves/i.test(p.material.name)).map((p) => { p.geometry.computeBoundingBox(); return p.geometry.boundingBox.min.y; }), 99);
      let scale = t.scale;
      if (leafMin < 99 && leafMin * scale < 2.2) scale = Math.min(3.4, 2.2 / Math.max(leafMin, 0.3));
      const crown = (Math.max(M.size.x, M.size.z) / 2) * scale * 0.85;
      const avoid = [
        ...views3.map((p) => [p[0], p[2], Math.max(3, crown + 1.0)]),
        ...(ctx.stones || []).map((s) => [s.x, s.z, 3.0]),
        ...(site.bollards || []).map((b) => [b[0], b[1], 3.0]),
      ];
      let [x, z] = t.pos;
      for (let it = 0; it < 12; it++) {
        let moved = false;
        for (const [ax, az, r] of avoid) {
          const dx = x - ax, dz = z - az, d = Math.hypot(dx, dz);
          if (d < r) { const k = (r - d + 0.05) / Math.max(d, 1e-3); x += dx * k; z += dz * k; moved = true; }
        }
        if (!moved) break;
      }
      this.treeInfo.push({ model: t.model, from: t.pos, to: [+x.toFixed(2), +z.toFixed(2)], scale: +scale.toFixed(2), leafMinY: +(leafMin * scale).toFixed(2), crown: +crown.toFixed(1) });
      trees.addFixed({ model: t.model, x, y: G - 0.02, z, scale, rot: THREE.MathUtils.degToRad(t.rot || 0) });
      ctx.colliderBoxes.push([x - 0.3, G - 0.2, z - 0.3, x + 0.3, G + 3, z + 0.3]);
    }
    const hgt = ctx.terrainHeight || (() => G);
    const sr = site.tree_ring;
    if (sr) {
      for (const p of scatterRing(site, sr, sr.avoid)) {
        trees.addDynamic({ model: names[Math.floor(p.r * names.length)], x: p.x, y: hgt(p.x, p.z) - 0.05, z: p.z, scale: sr.scale[0] + p.r2 * (sr.scale[1] - sr.scale[0]), rot: p.r2 * 6.28 });
      }
    }
    const sf = site.far_trees;
    if (sf) {
      const st = site.street;
      for (const p of scatterFar(site, sf, hgt, st ? [st.curbs[0] - 2, st.curbs[1] + 2] : null)) {
        // far trees are scaled so their height (not the model's) lands in [scale0, scale1] metres
        const model = names[Math.floor(p.r * names.length)];
        const h = trees.models.get(model).size.y;
        trees.addFar({ model, x: p.x, y: p.y, z: p.z, scale: (sf.scale[0] + p.r2 * (sf.scale[1] - sf.scale[0])) / h, rot: p.r2 * 6.28 });
      }
    }
    trees.build(this.group, { maxFull: 3, fullDist: 24 });
    this.trees = trees;
  }

  _colliders() {
    const g = this.game, ctx = this.ctx;
    const col = colliderMesh(ctx.colliderBoxes, 'COL_landscape');
    this.colliders = [col, ...ctx.colliderMeshes];
    // Shared registry (same convention as P07): game.colliderSets = Map(name -> meshes); every writer
    // rebuilds with [...house.colliders, lighting.ground, ...all sets]. The engine's placeholder ground
    // disc (y -0.312) would hold the player above our lowered street, so it is parked below it:
    // COL_landscape_ground is the real ground now.
    if (g.lighting.ground) { g.lighting.ground.position.y = -1.5; g.lighting.ground.updateMatrixWorld(true); }
    g.colliderSets = g.colliderSets || new Map();
    g.colliderSets.set('landscape', this.colliders);
    const extra = [...g.colliderSets.values()].flat();
    g.physics.setColliders([...g.house.colliders, ...(g.lighting.ground ? [g.lighting.ground] : []), ...extra]);
  }


  // Footstep surfaces outside the house (gravel, stone, deck, street) — wraps house.surfaceAt.
  _surfaces() {
    const house = this.game.house;
    if (house._lsSurfaceWrapped) return;
    const orig = house.surfaceAt.bind(house);
    house.surfaceAt = (pos) => {
      const s = orig(pos);
      if (house.roomAt(pos)) return s;
      const x = pos.x ?? pos[0], z = pos.z ?? pos[2];
      return this.surfaceAt(x, z) || s;
    };
    house._lsSurfaceWrapped = true;
  }

  surfaceAt(x, z) {
    for (const s of this.ctx.surfaces || []) if (s.test(x, z)) return s.type;
    const [px, pz, pw, pd] = this.ctx.site.plot;
    if (x >= px && x <= px + pw && z >= pz && z <= pz + pd) return 'grass';
    return null;
  }

  update(dt) {
    const g = this.game, sun = g.lighting.sun;
    this.pool?.update(dt, sun);
    this.grass?.update(dt, g.camera, sun);
    this.trees?.update(g.camera, false, sun);
    if (this.ornamentals) this.ornamentals.material.userData.uniforms.uTime.value += dt;
  }

  onTimeOfDay(mode) {
    const k = NIGHT[mode] ?? 0;
    this.pool?.setNight(k);
    this.bollards?.setNight(k);
  }

  onQuality(tier) { this.grass?.setQuality(tier); }
}
