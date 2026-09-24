import * as THREE from 'three';

// P05 light rig: many VIRTUAL lights (every LIGHT_* fixture, per-room aggregates, per-room bounce,
// exterior fixtures) mapped every 0.2 s onto a FIXED set of real lights, so the forward shaders
// never recompile while the player moves:
//   * KEYS   (3 SpotLights, castShadow): the most relevant fixtures (nearest, in view, in the
//     current room) -> real lamp shadows. Shadow maps re-render only when a key is re-assigned or
//     the scene is invalidated (lighting.invalidateShadows()).
//   * SPOTS  (8 SpotLights): further fixtures of the current room / exterior fixtures (down cones)
//     and "bounce" emitters (up cones just under a floor: the sunlit patch by day, the lamp-lit floor
//     at night) -> coloured bounce on walls + ceilings, and dark corners.
//   * POINTS (5 PointLights): whole-room aggregates of other rooms (the house glowing through its
//     windows / doorways) + the residual of the current room's fixtures that got no slot.
// Newly assigned slots fade in over ~0.3 s, so re-assignment never pops.
export const RIG = { keys: 3, spots: 8, points: 5 };

export const FIXTURE_COLOR = new THREE.Color().setRGB(1.0, 0.7, 0.42);   // ~2700 K, linear
const deg = THREE.MathUtils.degToRad;
// cd = candela at night (scene units), angle = cone half angle, pen = penumbra, drop = offset below node.
const TYPES = {
  downlight: { cd: 15, angle: deg(52), pen: 0.8, drop: 0.03 },
  pendant: { cd: 30, angle: deg(80), pen: 0.9, drop: 0.25 },
  ceiling: { cd: 26, angle: deg(86), pen: 1.0, drop: 0.06 },
  sconce: { cd: 9, angle: deg(70), pen: 0.9, drop: 0.0 },
  strip: { cd: 12, angle: deg(85), pen: 1.0, drop: 0.02 },
  cove: { cd: 8, angle: deg(85), pen: 1.0, drop: 0.02 },
};
const cone = (a, pen) => 2 * Math.PI * (1 - Math.cos(a * (1 - pen * 0.5)));   // effective solid angle
const DOWN = new THREE.Vector3(0, -1, 0), UPV = new THREE.Vector3(0, 1, 0);

function makeSlots(group, n, kind, shadow) {
  const out = [];
  for (let i = 0; i < n; i++) {
    let l;
    if (kind === 'point') l = new THREE.PointLight(FIXTURE_COLOR, 0, 8, 2);
    else {
      l = new THREE.SpotLight(FIXTURE_COLOR, 0, 8, deg(60), 0.8, 2);
      l.target.name = `${kind.toUpperCase()}_${i}_target`;
      group.add(l.target);
    }
    l.name = `${kind.toUpperCase()}_${i}`;
    l.castShadow = !!shadow;
    if (shadow) {
      l.shadow.mapSize.set(1024, 1024);
      l.shadow.bias = -0.0004;
      l.shadow.normalBias = 0.012;
      l.shadow.radius = 2.2;
      l.shadow.camera.near = 0.05;
      l.shadow.autoUpdate = false;
      l.shadow.needsUpdate = true;
    }
    group.add(l);
    out.push({ light: l, owner: null, target: 0, kind });
  }
  return out;
}

export class LightRig {
  constructor(lighting) {
    this.L = lighting;
    this.group = lighting.fixtureGroup;
    this.keys = makeSlots(this.group, RIG.keys, 'key', true);
    this.spots = makeSlots(this.group, RIG.spots, 'spot', false);
    this.points = makeSlots(this.group, RIG.points, 'point', false);
    this.fixtures = []; this.rooms = []; this.ext = [];
    this.byRoom = new Map();
  }

  get slots() { return [...this.keys, ...this.spots, ...this.points]; }

  setShadowSize(size) {
    for (const s of this.keys) {
      const sh = s.light.shadow;
      if (sh.mapSize.x !== size) { sh.mapSize.set(size, size); sh.map?.dispose(); sh.map = null; }
      sh.needsUpdate = true;
    }
  }

  invalidate() { for (const s of this.keys) s.light.shadow.needsUpdate = true; }

  // house: engine House. rooms: [{room, area, floorY, ceilY, albedo}] from Lighting.
  build(house, rooms, extFixtures) {
    const vf = (o) => ({ kind: 'spot', shadow: false, pos: new THREE.Vector3(), dir: DOWN.clone(), color: FIXTURE_COLOR.clone(), I: 0, base: 0, angle: deg(60), pen: 0.8, distance: 8, room: null, ...o });
    this.fixtures = []; this.rooms = []; this.ext = [];
    this.byRoom = new Map();
    const roomIds = new Set(rooms.map((r) => r.room.id));
    for (const l of house.lights || []) {
      if (!l.node) continue;
      const room = l.room || l.node.userData?.room;
      if (!roomIds.has(room)) continue;
      const T = TYPES[l.type] || TYPES.downlight;
      const pos = new THREE.Vector3().setFromMatrixPosition(l.node.matrixWorld);
      pos.y -= T.drop;
      const f = vf({ id: l.id, type: l.type, room, pos, base: T.cd, angle: T.angle, pen: T.pen, shadow: true, distance: 7.5 });
      f.flux = T.cd * cone(T.angle, T.pen);
      this.fixtures.push(f);
      if (!this.byRoom.has(room)) this.byRoom.set(room, []);
      this.byRoom.get(room).push(f);
    }
    for (const r of rooms) {
      const own = this.byRoom.get(r.room.id) || [];
      let flux = own.reduce((a, f) => a + f.flux, 0);
      const ceil = r.ceilY - 0.06;
      if (!own.length) {   // no LIGHT_* node: one ceiling light at the room centre
        const [x, z, w, d] = r.room.main || r.room.rect;
        const T = TYPES.ceiling;
        const f = vf({ id: `${r.room.id}_auto`, type: 'ceiling', room: r.room.id, pos: new THREE.Vector3(x + w / 2, ceil, z + d / 2), base: T.cd * THREE.MathUtils.clamp(r.area / 10, 0.6, 2), angle: T.angle, pen: T.pen, shadow: true });
        f.flux = f.base * cone(T.angle, T.pen);
        this.fixtures.push(f); own.push(f); this.byRoom.set(r.room.id, own);
        flux = f.flux;
      }
      const c = own.reduce((a, f) => a.add(f.pos), new THREE.Vector3()).multiplyScalar(1 / own.length);
      const agg = vf({ kind: 'point', id: `${r.room.id}_agg`, room: r.room.id, pos: new THREE.Vector3(c.x, r.floorY + (r.ceilY - r.floorY) * 0.5, c.z), distance: Math.max(6, Math.sqrt(r.area) * 2.4) });
      agg.flux = flux;
      const bounce = vf({ id: `${r.room.id}_bounce`, room: r.room.id, pos: new THREE.Vector3(c.x, r.floorY - 0.04, c.z), dir: UPV.clone(), angle: deg(89.5), pen: 1, distance: Math.max(7, Math.sqrt(r.area) * 2.2) });
      this.rooms.push({ ...r, id: r.room.id, agg, bounce, flux, fixtures: own });
    }
    for (const e of extFixtures.slice(0, 12)) {
      const T = TYPES[e.type] || TYPES.downlight;
      const pos = e.pos.clone(); pos.y -= T.drop;
      const f = vf({ id: e.id, type: e.type, room: null, pos, base: T.cd * 1.1, angle: T.angle, pen: T.pen, shadow: true, distance: 9, ext: true });
      if (e.dir) f.pos.add(new THREE.Vector3(...e.dir).multiplyScalar(0.12));
      f.flux = f.base * cone(T.angle, T.pen);
      this.ext.push(f);
    }
  }

  // Intensities for the time of day. bounces: Map(roomId -> {pos, I, color}) of sun-patch bounce.
  setLevels(preset, sunBounce) {
    const k = preset.fixtures;
    for (const f of this.fixtures) { f.I = f.base * k; f.color.copy(FIXTURE_COLOR); }
    for (const f of this.ext) { f.I = f.base * k; f.color.copy(FIXTURE_COLOR); }
    for (const r of this.rooms) {
      // whole-room aggregate point (flux / 4 pi), for rooms seen from elsewhere
      r.aggFull = (r.flux / (4 * Math.PI)) * 0.85 * k;
      r.agg.I = r.aggFull;
      r.agg.color.copy(FIXTURE_COLOR);
      // bounce: max(sun-patch bounce, lamp-lit floor bounce). Up-cone below the floor: I0 = flux*albedo/pi.
      const lum = (r.albedo[0] + r.albedo[1] + r.albedo[2]) / 3;
      const nightB = r.flux * k * 0.55 * lum / Math.PI;
      const sb = sunBounce.get(r.id);
      if (sb && sb.I >= nightB) {
        r.bounce.pos.copy(sb.pos); r.bounce.I = sb.I; r.bounce.color.copy(sb.color);
      } else {
        r.bounce.pos.set(r.agg.pos.x, r.floorY - 0.04, r.agg.pos.z);
        r.bounce.I = nightB;
        r.bounce.color.copy(FIXTURE_COLOR).multiply(new THREE.Color(r.albedo[0] / lum, r.albedo[1] / lum, r.albedo[2] / lum)).lerp(FIXTURE_COLOR, 0.3);
      }
      r.sunBounce = sb || null;
    }
    this.nightK = k;
  }

  // Pick the real lights for the camera. snap = apply intensities now (teleport / TOD / harness).
  assign(camera, roomId, snap = false) {
    const cam = camera.position;
    const fwd = camera.getWorldDirection(_f);
    const facing = (p) => { _d.subVectors(p, cam); const l = _d.length() || 1; return 0.55 + 0.45 * Math.max(0, _d.dot(fwd) / l); };
    const cur = this.rooms.find((r) => r.id === roomId);
    const inside = !!cur;
    const keyC = [], spotC = [], pointC = [];
    // current room: individual fixtures (keys first), its bounce, its residual
    if (cur && this.nightK > 0) {
      for (const f of cur.fixtures) if (f.I > 1e-3) keyC.push({ v: f, s: 1e6 + f.I * facing(f.pos) / (1 + f.pos.distanceToSquared(cam) / 6) });
    }
    if (!inside && this.nightK > 0) {
      for (const f of this.ext) if (f.I > 1e-3) keyC.push({ v: f, s: 1e3 + f.I * facing(f.pos) / (1 + f.pos.distanceToSquared(cam) / 30) });
    } else if (this.nightK > 0) {
      for (const f of this.ext) if (f.I > 1e-3) spotC.push({ v: f, s: f.I * facing(f.pos) / (1 + f.pos.distanceToSquared(cam) / 20) });
    }
    keyC.sort((a, b) => b.s - a.s);
    // Key hysteresis: keep a current key unless a candidate beats it by 30%.
    const keyPick = this._withHysteresis(this.keys, keyC, RIG.keys);
    const keySet = new Set(keyPick.map((c) => c.v));
    for (const c of keyC) if (!keySet.has(c.v)) spotC.push({ v: c.v, s: c.s * 0.5 });
    for (const r of this.rooms) {
      r.agg.I = r.aggFull ?? 0;
      if (r.bounce.I > 1e-3) spotC.push({ v: r.bounce, s: (r === cur ? 5e5 : 0) + r.bounce.I * facing(r.bounce.pos) / (1 + r.bounce.pos.distanceToSquared(cam) / 16) });
      if (r !== cur && r.agg.I > 1e-3) pointC.push({ v: r.agg, s: r.agg.I * facing(r.agg.pos) / (1 + r.agg.pos.distanceToSquared(cam) / 25) });
    }
    spotC.sort((a, b) => b.s - a.s);
    const spotPick = spotC.slice(0, RIG.spots);
    // residual: current-room fixtures with no real light -> a soft fill point
    if (cur && this.nightK > 0) {
      const covered = new Set([...keyPick, ...spotPick].map((c) => c.v));
      const lost = cur.fixtures.filter((f) => !covered.has(f)).reduce((a, f) => a + f.flux * this.nightK, 0);
      cur.agg.I = (lost / (4 * Math.PI)) * 0.7;
      if (cur.agg.I > 1e-3) pointC.push({ v: cur.agg, s: 1e6 });
    }
    pointC.sort((a, b) => b.s - a.s);
    this._fill(this.keys, keyPick, snap, true);
    this._fill(this.spots, spotPick, snap, false);
    this._fill(this.points, pointC.slice(0, RIG.points), snap, false);
  }

  _withHysteresis(slots, cands, n) {
    const top = cands.slice(0, n);
    const owned = slots.map((s) => s.owner).filter(Boolean);
    const cand = new Map(cands.map((c) => [c.v, c]));
    const keep = owned.filter((v) => cand.has(v));
    if (!keep.length) return top;
    const out = keep.map((v) => cand.get(v));
    for (const c of cands) {
      if (out.length >= n) break;
      if (!out.includes(c)) out.push(c);
    }
    // swap the weakest kept one if a free candidate is clearly better
    const rest = cands.filter((c) => !out.includes(c));
    out.sort((a, b) => b.s - a.s);
    while (rest.length && out.length && rest[0].s > out[out.length - 1].s * 1.3) { out[out.length - 1] = rest.shift(); out.sort((a, b) => b.s - a.s); }
    return out.slice(0, n);
  }

  _fill(slots, picks, snap, shadow) {
    const chosen = new Set(picks.map((c) => c.v));
    for (const s of slots) if (s.owner && !chosen.has(s.owner)) { s.owner = null; s.target = 0; if (snap) s.light.intensity = 0; }
    for (const c of picks) {
      const v = c.v;
      let s = slots.find((x) => x.owner === v);
      if (!s) {
        s = slots.find((x) => !x.owner && x.light.intensity < 1e-3) || slots.find((x) => !x.owner);
        if (!s) continue;
        s.owner = v; s.light.intensity = 0;
        if (shadow) s.light.shadow.needsUpdate = true;
      }
      const l = s.light;
      if (!l.position.equals(v.pos)) { l.position.copy(v.pos); if (shadow) l.shadow.needsUpdate = true; }
      l.color.copy(v.color);
      l.distance = v.distance;
      if (l.isSpotLight) {
        l.angle = v.angle; l.penumbra = v.pen;
        l.target.position.copy(v.pos).add(v.dir);
        l.target.updateMatrixWorld();
      }
      s.target = v.I;
      if (snap) l.intensity = v.I;
    }
  }

  tick(dt) {
    const k = Math.min(1, (dt / 0.3) * 3);
    for (const s of this.slots) {
      const d = s.target - s.light.intensity;
      if (Math.abs(d) > 1e-4) s.light.intensity += d * k; else s.light.intensity = s.target;
      // unassigned shadow keys stay dark and never re-render
    }
  }

  info() {
    const o = (s) => s.owner ? `${s.owner.id}:${s.light.intensity.toFixed(2)}` : '-';
    return { keys: this.keys.map(o), spots: this.spots.map(o), points: this.points.map(o) };
  }
}

const _f = new THREE.Vector3(), _d = new THREE.Vector3();
