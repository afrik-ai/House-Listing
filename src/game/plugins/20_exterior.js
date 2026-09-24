import * as THREE from 'three';
import { EXT_STATE, FIXTURE_RGB } from '../materials/exterior.js';

// P03 — exterior finish.
//  * loads /assets/houses/<id>/exterior_detail.glb (pipeline/blender/exterior_build.py): fascia joints, copings
//    (where the shell has none), pergola beams, drip edges / flashings / hip caps, slat screen, larch surrounds,
//    balustrade top channel, grooved garage-door skin, up/down wall lights with wall washes;
//  * materials come from the P06 registry (definitions in materials/exterior.js);
//  * applies the GLB's declared `replaces` (hides a shell part only while it still needs replacing);
//  * per-board tone variation on the shell's GPU-instanced larch slats;
//  * time of day: lamp lenses + wall washes glow at dusk/night; glass is more reflective outside than inside.
// Disable with ?p03=0 (debug).
// Glass from outside reads as dark, sky-reflecting low-iron glass (effective F0 0.2 = specularColor 5 x 0.04,
// plus a base opacity for the darker interior); from inside it is near-physical and clear.
const GLASS = {           // [base opacity, F0 scale (x0.04), body tint scale] outside
  day: [0.2, 4.0, 1.0], golden_hour: [0.18, 4.0, 0.6], night: [0.06, 2.5, 0.08],
};
const GLASS_INSIDE = [0.02, 1.0, 0.2];
const PROBE_OFFSET = 6;          // probe distance in front of each facade (m)
const PROBE_BOX = 18;            // reflection box half-extent beyond the house (m)
const LAMP_CD = 1.6;             // real point light per P03 wall lamp at night (candela), range 4 m
const LENS_EMISSIVE = 45;
const WASH_GAIN = 1.25;

export class Plugin {
  constructor(game) {
    this.game = game;
    this.root = null;
    this.hidden = [];
    this._inside = 0;
    this._insideTarget = 0;
    this._t = 0;
    this.mode = game.lighting?.mode || 'day';
  }

  async init() {
    const g = this.game;
    if (new URLSearchParams(location.search).get('p03') === '0') return;
    const url = `/assets/houses/${g.houseId}/exterior_detail.glb`;
    let gltf = null;
    if (await g.loader.exists?.(url) ?? true) {
      gltf = await g.loader.loadGLTF(url, 'exterior detail').catch((err) => { console.warn('[exterior] no detail GLB', err?.message || err); return null; });
    }
    if (gltf) {
      this.root = gltf.scene;
      this.root.name = 'EXTERIOR_DETAIL_ROOT';
      if (g.materials) await g.materials.apply(this.root);
      else console.warn('[exterior] material registry missing (15_materials.js); detail keeps GLB materials');
      this.root.traverse((o) => {
        if (!o.isMesh) return;
        o.userData.noCollide = true;
        const mats = Array.isArray(o.material) ? o.material : [o.material];
        const wash = mats.some((m) => m?.name === 'EXT_light_wash');
        o.castShadow = !wash;
        o.receiveShadow = !wash;
        if (wash) o.renderOrder = 2;
      });
      g.scene.add(this.root);
      this.root.updateMatrixWorld(true);
      g.renderer.applyAnisotropy?.(this.root);
      this._applyReplaces(this._extras(this.root));
    }
    this._slatVariation();
    this._lamps(this._extras(this.root || new THREE.Group()).lights);
    this.onTimeOfDay(g.lighting?.mode || 'day');
  }

  // One short-range warm PointLight per P03 wall lamp that the engine does not already light (house.json sconces
  // get P01/P05 exterior lights). Constant light count: intensity 0 by day, so no shader recompiles.
  _lamps(lights) {
    const own = new Set((this.game.house?.spec?.lighting?.fixtures || []).map((f) => f.id));
    this.lampLights = [];
    for (const L of lights || []) {
      if (own.has(L.id) || !L.face) continue;
      const pl = new THREE.PointLight(new THREE.Color().setRGB(...FIXTURE_RGB), 0, 4, 2);
      pl.name = `P03_LAMP_${L.id}`;
      pl.position.set(L.face[0] + L.dir[0] * 0.25, L.face[1], L.face[2] + L.dir[2] * 0.25);
      pl.castShadow = false;
      this.game.scene.add(pl);
      this.lampLights.push(pl);
    }
  }

  // Box-projected reflection probes, one per facade direction (E, S, W, N), rendered once per time of day in the
  // exterior lighting state, glass hidden, shadow maps frozen.
  captureProbes() {
    const g = this.game;
    const rts = EXT_STATE.probeRT;
    if (!rts || !g.house?.bounds) return;
    const t0 = performance.now();
    const b = g.house.bounds;
    const c = b.getCenter(new THREE.Vector3());
    const y = (g.house.gradeY ?? -0.3) + 1.9;
    const pos = [
      new THREE.Vector3(b.max.x + PROBE_OFFSET, y, c.z), new THREE.Vector3(c.x, y, b.max.z + PROBE_OFFSET),
      new THREE.Vector3(b.min.x - PROBE_OFFSET, y, c.z), new THREE.Vector3(c.x, y, b.min.z - PROBE_OFFSET),
    ];
    const bmin = new THREE.Vector3(b.min.x - PROBE_BOX, (g.house.gradeY ?? -0.3) - 0.05, b.min.z - PROBE_BOX);
    const bmax = new THREE.Vector3(b.max.x + PROBE_BOX, 40, b.max.z + PROBE_BOX);
    const gl = g.renderer.gl;
    const hidden = [];
    g.scene.traverse((o) => {
      if (!o.isMesh || !o.visible) return;
      const mats = Array.isArray(o.material) ? o.material : [o.material];
      if (mats.some((m) => m?.userData?.p03glass || m?.name === 'EXT_light_wash')) { o.visible = false; hidden.push(o); }
    });
    const prevAuto = gl.shadowMap.autoUpdate;
    gl.shadowMap.autoUpdate = false;
    const wasInside = !!g.lighting?._adaptTarget;
    if (wasInside) g.lighting.setInterior(false, true);
    const prevRT = gl.getRenderTarget();
    for (let i = 0; i < 4; i++) {
      const cam = new THREE.CubeCamera(0.15, 600, rts[i]);
      cam.position.copy(pos[i]);
      cam.updateMatrixWorld(true);
      cam.update(gl, g.scene);
      EXT_STATE.probe.uProbePos.value[i].copy(pos[i]);
      EXT_STATE.probe.uBoxMin.value[i].copy(bmin);
      EXT_STATE.probe.uBoxMax.value[i].copy(bmax);
    }
    gl.setRenderTarget(prevRT);
    if (wasInside) g.lighting.setInterior(true, true);
    gl.shadowMap.autoUpdate = prevAuto;
    for (const o of hidden) o.visible = true;
    EXT_STATE.probe.uProbeK.value = 1;
    this.probeMs = Math.round(performance.now() - t0);
  }

  _extras(root) {
    let ex = null;
    root.traverse((o) => { if (!ex && o.userData?.kind === 'exterior_detail' && o.userData.replaces) ex = o.userData; });
    const parse = (v) => { try { return typeof v === 'string' ? JSON.parse(v) : (v || []); } catch { return []; } };
    return { replaces: parse(ex?.replaces), lights: parse(ex?.lights) };
  }

  // Hide shell parts that the detail GLB replaces. 'when: vertical' = only while the shell's instanced boards
  // are still vertical (P02 may switch them to horizontal; then both would clash).
  _applyReplaces({ replaces }) {
    const house = this.game.house?.root;
    if (!house) return;
    for (const r of replaces) {
      const hit = [];
      house.traverse((o) => {
        if (r.node && o.name === r.node) hit.push(o);
        if (r.node_prefix && r.node_prefix.some((p) => o.name.startsWith(p)) && /^SLATS_/.test(o.name)) hit.push(o);
      });
      for (const o of hit) {
        if (r.when === 'vertical' && !this._isVertical(o)) continue;
        o.visible = false;
        this.hidden.push(o.name);
      }
    }
    if (this.hidden.length) console.info(`[exterior] replaced shell parts: ${this.hidden.join(', ')}`);
  }

  _isVertical(o) {
    const box = new THREE.Box3();
    let mesh = null;
    o.traverse((c) => { if (!mesh && c.isMesh) mesh = c; });
    if (!mesh) return false;
    mesh.geometry.computeBoundingBox();
    box.copy(mesh.geometry.boundingBox);
    const s = box.getSize(new THREE.Vector3());
    return s.y > Math.max(s.x, s.z);
  }

  // Tone variation per board on every GPU-instanced slat group of the shell (+-9 % brightness, slight hue).
  _slatVariation() {
    const house = this.game.house?.root;
    if (!house) return;
    let n = 0;
    const c = new THREE.Color();
    house.traverse((o) => {
      if (!o.isInstancedMesh || o.instanceColor) return;
      let p = o; let slat = false;
      for (; p; p = p.parent) if (/^SLATS_|^slat_/.test(p.name || '')) { slat = true; break; }
      if (!slat) return;
      let seed = (o.count * 9301 + o.id * 49297) % 233280;
      const rnd = () => { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; };
      for (let i = 0; i < o.count; i++) {
        const b = 0.9 + rnd() * 0.2;
        c.setRGB(b * (1 + (rnd() - 0.5) * 0.05), b, b * (1 - (rnd() - 0.5) * 0.08));
        o.setColorAt(i, c);
      }
      o.instanceColor.needsUpdate = true;
      n++;
    });
    this.slatGroups = n;
  }

  onTimeOfDay(mode) {
    this.mode = mode;
    const p = this.game.lighting?.presets?.[mode];
    const f = p ? p.fixtures : (mode === 'night' ? 1 : mode === 'golden_hour' ? 0.35 : 0);
    for (const m of EXT_STATE.glow) m.emissiveIntensity = LENS_EMISSIVE * f;
    for (const m of EXT_STATE.wash) {
      m.visible = f > 0.01;
      m.color.copy(m.userData.baseColor).multiplyScalar(WASH_GAIN * f);
    }
    for (const l of this.lampLights || []) l.intensity = LAMP_CD * f;
    this._applyGlass();
    try { this.captureProbes(); } catch (err) { console.warn('[exterior] probe capture failed', err); }
  }

  _applyGlass() {
    const o = GLASS[this.mode] || GLASS.day;
    const k = this._inside;
    const s = THREE.MathUtils.lerp(o[1], GLASS_INSIDE[1], k);
    EXT_STATE.glass.uBase.value = THREE.MathUtils.lerp(o[0], GLASS_INSIDE[0], k);
    EXT_STATE.glass.uF0.value = 0.04 * s;
    for (const m of EXT_STATE.glassMats) m.specularColor.setScalar(s);
    if (EXT_STATE.probe) {
      const bk = THREE.MathUtils.lerp(o[2], GLASS_INSIDE[2], k);
      EXT_STATE.probe.uBody.value.setRGB(0.05 * bk, 0.065 * bk, 0.06 * bk);
      EXT_STATE.probe.uDistK.value = 0.28 * (1 - k);
    }
  }

  update(dt) {
    const feet = this.game.player?.feet;
    this._insideTarget = feet && this.game.house?.roomAt?.(feet) ? 1 : 0;
    const cam = this.game.camera.position;
    if (!this._lastCam) this._lastCam = cam.clone();
    const jumped = this._lastCam.distanceToSquared(cam) > 1.0;     // teleport -> snap (deterministic shots)
    this._lastCam.copy(cam);
    if (jumped && this._inside !== this._insideTarget) { this._inside = this._insideTarget; this._applyGlass(); return; }
    if (this._inside !== this._insideTarget) {
      const s = Math.min(1, dt / 0.4);
      this._inside += (this._insideTarget - this._inside) * s;
      if (Math.abs(this._inside - this._insideTarget) < 0.01) this._inside = this._insideTarget;
      this._applyGlass();
    }
  }

  // Teleports snap (harness shots).
  snap() {
    const feet = this.game.player?.feet;
    this._inside = this._insideTarget = feet && this.game.house?.roomAt?.(feet) ? 1 : 0;
    this._applyGlass();
  }

  stats() {
    let tris = 0, meshes = 0;
    this.root?.traverse((o) => { if (o.isMesh) { meshes++; tris += (o.geometry.index ? o.geometry.index.count : o.geometry.attributes.position.count) / 3; } });
    return { meshes, tris, hidden: this.hidden, slatGroups: this.slatGroups, glass: { base: EXT_STATE.glass.uBase.value, f0: EXT_STATE.glass.uF0.value }, probeMs: this.probeMs, lampLights: this.lampLights?.length };
  }
}
