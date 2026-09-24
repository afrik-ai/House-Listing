import * as THREE from 'three';
import { Sky } from 'three/addons/objects/Sky.js';
import { Physics } from './Physics.js';
import { installShadowChunk, contactHardening, fitSunShadow, SUN_DEPTH } from './lighting/shadows.js';
import { gradeSky } from './lighting/sky.js';
import { LightRig, FIXTURE_COLOR } from './lighting/rig.js';

const { DataUtils } = THREE;

// Lighting & atmosphere (P01 engine, owned by P05 since wave 2).
//
// Time of day = HDRI (background + PMREM image-based lighting) + a shadow-casting sun/moon + grade:
//  * The HDRI is prepared once per load: its own sun is flattened out of the sky and re-emitted as the
//    shadow-casting DirectionalLight with the MEASURED irradiance (no double sun); the lower hemisphere
//    is replaced by ground radiance (IBL) / horizon colour (background). The sky is graded per preset
//    (lighting/sky.js): warm golden-hour gradient, lifted night horizon, and a sun / moon DISC painted
//    exactly where the light is (preset azimuth + elevation), so disc, shadows and highlights agree.
//  * Sun shadows (lighting/shadows.js): contact-hardening PCF (sharp at contact, soft with distance),
//    frustum fitted to the player's context — the current LEVEL of the house when inside (4096 over
//    ~25 m = 6 mm texels on high), the whole site outside — texel-snapped. Inside, the sun shadow map
//    is CACHED (re-rendered only when the fit, sun, tier or scene changes: doors move, interact events,
//    invalidateShadows()); outside it updates every frame (trees sway).
//  * Fixtures + bounce (lighting/rig.js): every LIGHT_* fixture, per-room aggregates, per-room bounce
//    emitters (sunlit floor patch by day, lamp-lit floor at night) and exterior fixtures are VIRTUAL
//    lights mapped onto a fixed rig of 3 shadow-casting key spots + 8 spots + 5 points (constant light
//    count -> no shader recompiles). Night = pools of warm light with lamp shadows and dark corners.
//  * Emissive bulbs at every LIGHT_* node (downlights, ceiling, pendant, sconces) that bloom at night.
//  * Eye adaptation inside rooms (IBL down, interior hemisphere fill + exposure up, warmer white
//    balance), easing ~0.45 s; snaps on teleport.
//
// Azimuth convention: 0 = north (-Z), 90 = east (+X), 180 = south (+Z), 270 = west (-X).
// `el` = fixed light elevation (deg). Day comes from the south-south-east so the east (street) facade
// is raked and the south glazing throws deep patches across the living room; golden hour is a low
// western sun (long shadows across the lawn, deep patches through the west glazing); night = moon.
const PRESETS = {
  day: {
    hdri: 'day_partly_cloudy', azimuth: 168, el: 36,
    sunColor: 0xfff2e0, sunScale: 0, sunIntensity: 7.5, sunMax: 7.5,
    hemiSky: 0xc4d4ec, hemiGround: 0x8f8574, hemiIntensity: 0.04,
    inSky: 0xf2ece4, inGround: 0xeadcc8, hemiInterior: 0.2,
    envIntensity: 0.55, bgIntensity: 0.8, exposure: 0.9, iblSaturation: 0.6,
    interiorEnv: 0.3, interiorExposure: 1.9, wbOut: [1.0, 1.0, 1.0], wbIn: [1.03, 1.0, 0.95],
    bounce: 1.25, fixtures: 0, bulbs: 0, groundAlbedo: [0.17, 0.16, 0.13], grass: [0.06, 0.1, 0.03],
    grade: { saturation: 0.1, contrast: 0.12, bloom: 0.7, bloomThreshold: 1.0, vignette: 0.34 },
    sky: { turbidity: 3, rayleigh: 1.2, mie: 0.004, mieG: 0.8 },
    skyGrade: { disc: { radiusDeg: 0.55, radiance: [60, 57, 52], glow: [1.2, 1.1, 0.95], glowDeg: 2.5 } },
  },
  golden_hour: {
    hdri: 'golden_hour', azimuth: 262, el: 8,
    sunColor: 0xffa45a, sunScale: 1.25, sunIntensity: 3.8, sunMax: 4.6,
    hemiSky: 0xd9b08a, hemiGround: 0x7a5e46, hemiIntensity: 0.05,
    inSky: 0xf0d6b8, inGround: 0xe0b890, hemiInterior: 0.14,
    envIntensity: 0.5, bgIntensity: 0.72, exposure: 1.05, iblSaturation: 0.8,
    interiorEnv: 0.42, interiorExposure: 1.75, wbOut: [1.0, 0.99, 0.97], wbIn: [1.03, 0.99, 0.93],
    bounce: 1.3, fixtures: 0.3, bulbs: 0.4, groundAlbedo: [0.17, 0.15, 0.11], grass: [0.06, 0.08, 0.025],
    grade: { saturation: 0.16, contrast: 0.12, bloom: 0.85, bloomThreshold: 0.95, vignette: 0.4 },
    sky: { turbidity: 6, rayleigh: 2.4, mie: 0.012, mieG: 0.9 },
    skyGrade: {
      tint: { horizon: [1.3, 1.0, 0.72], zenith: [1.02, 0.95, 0.95] }, sunSide: 1.6,
      // spruit_sunrise: power pylons + wires 40-70 deg right of the sun (u 0.62..0.93) -> painted out
      mask: { u0: 0.62, u1: 0.95, el0: 3, el1: 40, radius: 0.009 },
      disc: { radiusDeg: 0.75, radiance: [70, 38, 14], glow: [3.2, 1.6, 0.55], glowDeg: 3.5, glow2: [0.9, 0.42, 0.14], glow2Deg: 22 },
    },
  },
  night: {
    hdri: 'night_clear', azimuth: 140, el: 32,
    sunColor: 0x9fb8ff, sunScale: 0, sunIntensity: 0.32, sunMax: 0.32,
    hemiSky: 0x2a3c66, hemiGround: 0x0e1016, hemiIntensity: 0.12,
    inSky: 0x3c3a44, inGround: 0x6a5240, hemiInterior: 0.06,
    envIntensity: 0.14, bgIntensity: 0.3, exposure: 1.0, iblSaturation: 0.7,
    interiorEnv: 0.5, interiorExposure: 1.1, wbOut: [0.98, 1.0, 1.04], wbIn: [1.0, 1.0, 1.0],
    bounce: 0, fixtures: 1.0, bulbs: 1.0, groundAlbedo: [0.1, 0.1, 0.08], grass: [0.05, 0.07, 0.03],
    grade: { saturation: 0.1, contrast: 0.1, bloom: 0.95, bloomThreshold: 0.8, vignette: 0.45 },
    sky: { turbidity: 2, rayleigh: 0.4, mie: 0.002, mieG: 0.7 },
    skyGrade: {
      tint: { horizon: [0.9, 0.95, 1.1], zenith: [0.85, 0.88, 1.0] },
      add: { horizon: [0.03, 0.05, 0.11], zenith: [0.002, 0.003, 0.008] },
      disc: { radiusDeg: 1.1, radiance: [60, 64, 72], glow: [0.25, 0.3, 0.42], glowDeg: 3, glow2: [0.02, 0.03, 0.055], glow2Deg: 14 },
    },
  },
};
export const TIMES_OF_DAY = Object.keys(PRESETS);

const BULB_EMISSIVE = 60;        // emissive intensity of a bulb at night (blooms)
const FLOOR_ALBEDO = {
  oak_plank: [0.42, 0.28, 0.16], large_format_tile_grey: [0.36, 0.35, 0.33], large_format_tile_light: [0.6, 0.57, 0.5],
  small_tile_white: [0.72, 0.72, 0.7], concrete_screed: [0.34, 0.33, 0.31], stair_tread: [0.42, 0.28, 0.16],
};
const OUT_SHADOW_HALF = 19;   // m: outdoor sun shadow box half-size (38 m, ~1 cm texels at 4096)
const _fwd = new THREE.Vector3();
const KEY_SHADOW = { low: 512, medium: 512, high: 1024, ultra: 1024 };

installShadowChunk();   // before any program compiles

export class Lighting {
  constructor(game) {
    this.game = game;
    this.scene = game.scene;
    this.renderer = game.renderer;
    this.loader = game.loader;
    this.mode = game.initialTod || 'day';
    this.bounds = new THREE.Box3(new THREE.Vector3(-15, -1, -10), new THREE.Vector3(25, 8, 15));   // outdoor shadow box
    this.hdri = new Map();        // "<name>_<res>" -> Promise<prepared HDRI | null>
    this.env = new Map();         // key -> PMREM render target
    this.envKey = null;
    this.sunDir = new THREE.Vector3(0, 1, 0);
    this.roomLights = [];         // [{room, area, floorY, ceilY, albedo, bounce}]
    this.extLights = [];
    this.occluder = null;         // BVH of shadow casters, for sun-patch sampling
    this._fitKey = null;
    this._shadowDirtyT = 0;       // seconds of forced shadow updates left (interact animations)

    this.sun = new THREE.DirectionalLight(0xffffff, 3);
    this.sun.name = 'SUN';
    this.sun.castShadow = true;
    this.sun.shadow.bias = -0.00005;
    this.sun.shadow.normalBias = 0.01;
    this.sun.target = new THREE.Object3D();
    this.scene.add(this.sun, this.sun.target);
    this.moon = this.sun;         // at night the same light is the moon (cool, dim)

    this.hemi = new THREE.HemisphereLight(0xbcd6ff, 0x7a6f60, 0.2);
    this.scene.add(this.hemi);

    this.sky = new Sky();
    this.sky.scale.setScalar(4500);
    this.sky.visible = false;

    // Placeholder ground to the horizon (P04 may hide it: lighting.ground.visible = false).
    this.groundMat = new THREE.MeshStandardMaterial({ color: 0x55653a, roughness: 1, metalness: 0 });
    this.ground = new THREE.Mesh(new THREE.CircleGeometry(900, 96).rotateX(-Math.PI / 2), this.groundMat);
    this.ground.name = 'ENV_ground';
    this.ground.receiveShadow = true;
    this.ground.position.y = -0.31;
    this.scene.add(this.ground);
    this.scene.fog = new THREE.Fog(0xbfcad6, 90, 880);

    this.fixtureGroup = new THREE.Group();
    this.fixtureGroup.name = 'FIXTURES';
    this.scene.add(this.fixtureGroup);
    this.bulbMat = new THREE.MeshStandardMaterial({ color: 0xf4f1ea, roughness: 0.4, emissive: FIXTURE_COLOR.clone(), emissiveIntensity: 0 });
    this.rig = new LightRig(this);   // real lights exist from the first compile (constant light count)

    this.pmrem = new THREE.PMREMGenerator(this.renderer.gl);
    this.pmrem.compileEquirectangularShader();
    this.renderer.onQuality((s) => this.applyQuality(s));
    this.applyQuality(this.renderer.settings);
  }

  get presets() { return PRESETS; }
  get pool() { return this.rig.slots; }

  setGroundLevel(y) { this.ground.position.y = y - 0.012; }

  _hdriUrl(name, res) { return `/assets/hdri/${name}_${res}.hdr`; }

  // Loads (once) and prepares the HDRI for a mode at the tier's resolution (falls back to the other
  // resolution, then to the procedural sky). No existence probes: one request per file.
  _getHDRI(mode) {
    const p = PRESETS[mode];
    const res = this.renderer.settings.hdriRes || '2k';
    const key = `${p.hdri}_${res}`;
    if (!this.hdri.has(key)) {
      const label = `sky (${mode.replace('_', ' ')})`;
      const job = this.loader.loadHDRI(this._hdriUrl(p.hdri, res), label)
        .catch(() => this.loader.loadHDRI(this._hdriUrl(p.hdri, res === '2k' ? '1k' : '2k'), label))
        .then((tex) => this.loader.track('Preparing sky lighting', () => prepareHDRI(key, tex, p)))
        .catch((err) => { console.warn('[lighting] HDRI unavailable, using procedural sky', err?.message || err); return null; });
      this.hdri.set(key, job);
    }
    return this.hdri.get(key);
  }

  // Blocking load of the requested mode only; prefetch() fetches the others later (after entry).
  async init(mode = this.mode) { await this.setTimeOfDay(mode); }
  prefetch() { for (const m of TIMES_OF_DAY) this._getHDRI(m); }

  applyQuality(settings) {
    const size = settings.shadowMap;
    if (this.sun.shadow.mapSize.x !== size) {
      this.sun.shadow.mapSize.set(size, size);
      if (this.sun.shadow.map) { this.sun.shadow.map.dispose(); this.sun.shadow.map = null; }
    }
    this.rig.setShadowSize(KEY_SHADOW[settings.tier] || 1024);
    this._placeSun();
    if (this._ready) this.setTimeOfDay(this.mode);   // HDRI resolution may differ per tier
  }

  // Outdoor shadow box (P04 passes the site). Inside, the current level is used instead.
  fitShadowTo(box) {
    if (box && !box.isEmpty()) this.bounds.copy(box).expandByScalar(1.0);
    this._fitKey = null;
    this._placeSun();
  }

  invalidateShadows(seconds = 0) {
    this._shadowDirtyT = Math.max(this._shadowDirtyT, seconds, 1e-6);
    this.sun.shadow.needsUpdate = true;
    this.rig.invalidate();
  }

  _fitContext() {
    const inside = (this._adaptTarget ?? 0) > 0.5 && !!this.house;
    const level = inside ? (this.game.currentRoom?.level || 'ground') : null;
    if (inside) return { inside, level, key: `in:${level}` };
    // Outside: a view-fitted receiver box (camera + ahead), re-fitted when the camera crosses a 3 m cell
    // or turns by ~30 deg. The house-bounds box alone left the garden (trees, umbrella, furniture) unshadowed.
    const cam = this.game.camera;
    if (!cam) return { inside, level, key: 'out' };
    cam.getWorldDirection(_fwd);
    const hd = Math.round(Math.atan2(_fwd.x, _fwd.z) / (Math.PI / 6));
    const p = cam.position;
    return { inside, level, key: `out:${Math.round(p.x / 3)},${Math.round(p.z / 3)},${hd}` };
  }

  _levelBox(level) {
    const h = this.house;
    const rooms = h.rooms().filter((r) => r.level === level);
    const floor = rooms.length ? Math.min(...rooms.map((r) => r.center[1])) : h.bounds.min.y;
    const height = h.levelHeight?.(level) ?? (h.spec?.levels?.find((l) => l.id === level)?.clear_height ?? 2.85);
    const b = h.bounds.clone();
    b.min.y = floor - 0.35; b.max.y = floor + height + 0.35;
    b.min.x -= 4; b.max.x += 4; b.min.z -= 4; b.max.z += 4;   // terrace / garden seen through the glazing
    return b;
  }

  _viewBox() {
    const cam = this.game.camera;
    if (!cam) return this.bounds;
    cam.getWorldDirection(_fwd); _fwd.y = 0;
    if (_fwd.lengthSq() < 1e-4) _fwd.set(0, 0, -1);
    _fwd.normalize();
    const R = OUT_SHADOW_HALF, c = cam.position.clone().addScaledVector(_fwd, R * 0.62);
    const b = new THREE.Box3(new THREE.Vector3(c.x - R, this.bounds.min.y - 0.5, c.z - R), new THREE.Vector3(c.x + R, Math.max(this.bounds.max.y, 9), c.z + R));
    return b;
  }

  _placeSun() {
    const ctx = this._fitContext();
    this._fitKey = ctx.key;
    const box = ctx.inside ? this._levelBox(ctx.level) : this._viewBox();
    const fit = fitSunShadow(this.sun, box, this.sunDir, ctx.inside ? 30 : 45);
    const sh = this.sun.shadow;
    const ch = contactHardening() && fit.far <= SUN_DEPTH + 0.6;
    sh.radius = ch ? -(sh.mapSize.x / fit.size) : (this.renderer.settings.shadowRadius ?? 2);
    sh.normalBias = fit.texel * 1.6;
    sh.bias = -(fit.texel * 0.6) / fit.far;
    sh.autoUpdate = !ctx.inside;
    sh.needsUpdate = true;
    this.shadowFit = { ...fit, key: ctx.key, contactHardening: ch };
  }

  async setTimeOfDay(mode) {
    const p = PRESETS[mode];
    if (!p) throw new Error(`unknown time of day "${mode}" (${TIMES_OF_DAY.join('|')})`);
    this.mode = mode;
    const token = (this._todToken = (this._todToken || 0) + 1);
    const h = await this._getHDRI(mode);
    if (token !== this._todToken) return;
    const el = p.el ?? THREE.MathUtils.clamp(h?.sun ? h.sun.el : p.fallbackEl, p.minEl, p.maxEl);
    this.sunDir.copy(dirFromAzEl(p.azimuth, el));
    this.sunEl = el;
    this.sun.color.set(p.sunColor);
    this.sun.intensity = h?.sun?.irradiance && p.sunScale ? Math.min(p.sunMax, h.sun.irradiance * p.sunScale) : p.sunIntensity;
    this._placeSun();
    this._applyEnvironment(p, h);
    this.game.postfx?.setGrade(p.grade);
    this._updateRoomLights();
    this._applyAdaptation();
    this._ready = true;
    this.invalidateShadows();
    this.game.emit('tod', mode);
  }

  _applyEnvironment(p, h) {
    if (h) {
      if (!this.env.has(h.key)) this.env.set(h.key, this.pmrem.fromEquirectangular(h.iblTex));
      const rotY = h.sun ? THREE.MathUtils.degToRad(h.sun.az - p.azimuth) : 0;
      this.scene.background = h.tex;
      this.scene.environment = this.env.get(h.key).texture;
      this.scene.backgroundRotation.set(0, rotY, 0);
      this.scene.environmentRotation.set(0, rotY, 0);
      this.envKey = h.key;
      const hz = h.horizon;
      this.scene.fog.color.setRGB(hz[0] * p.bgIntensity, hz[1] * p.bgIntensity, hz[2] * p.bgIntensity);
    } else {
      const u = this.sky.material.uniforms;
      u.turbidity.value = p.sky.turbidity; u.rayleigh.value = p.sky.rayleigh;
      u.mieCoefficient.value = p.sky.mie; u.mieDirectionalG.value = p.sky.mieG;
      u.sunPosition.value.copy(this.sunDir);
      const skyScene = new THREE.Scene();
      this.sky.visible = true;
      skyScene.add(this.sky);
      const key = `sky_${this.mode}`;
      this.env.get(key)?.dispose();
      this.env.set(key, this.pmrem.fromScene(skyScene, 0.02));
      this.scene.add(this.sky);
      this.scene.background = null;
      this.scene.environment = this.env.get(key).texture;
      this.envKey = key;
      this.scene.fog.color.setRGB(0.6, 0.65, 0.72);
    }
    const gr = p.grass;
    this.groundMat.color.setRGB(gr[0], gr[1], gr[2]);
    this.scene.backgroundIntensity = p.bgIntensity;
  }

  // ---- eye adaptation --------------------------------------------------------------------
  setInterior(inside, snap = false) {
    this._adaptTarget = inside ? 1 : 0;
    if (snap) { this._adapt = this._adaptTarget; this._applyAdaptation(); }
  }

  _applyAdaptation() {
    const p = PRESETS[this.mode];
    const a = this._adapt ?? 0;
    const lerp = THREE.MathUtils.lerp;
    this.scene.environmentIntensity = p.envIntensity * lerp(1, p.interiorEnv, a);
    this.hemi.intensity = lerp(p.hemiIntensity, p.hemiInterior, a);
    this.hemi.color.set(p.hemiSky).lerp(_c.set(p.inSky), a);
    this.hemi.groundColor.set(p.hemiGround).lerp(_c.set(p.inGround), a);
    this.renderer.exposure = p.exposure * lerp(1, p.interiorExposure, a);
    this.game.postfx?.setWhiteBalance(lerp(p.wbOut[0], p.wbIn[0], a), lerp(p.wbOut[1], p.wbIn[1], a), lerp(p.wbOut[2], p.wbIn[2], a));
  }

  // ---- fixtures, bounce, exterior lights, bulbs ---------------------------------------------
  // Called once the house is loaded. Constant light count across times of day.
  buildFixtures(house) {
    this.house = house;
    for (const o of [...this.fixtureGroup.children]) if (o.isInstancedMesh) { this.fixtureGroup.remove(o); o.geometry.dispose(); }
    // Occluder = everything that casts sun shadows (glass/COL excluded by House's load hook).
    const casters = [];
    house.root.traverse((o) => { if (o.isMesh && o.castShadow && o.visible && !o.isInstancedMesh) casters.push(o); });
    this.occluder = new Physics();
    this.occluder.setColliders(casters);

    const rooms = house.rooms().filter((r) => r.rects?.length || r.rect);
    const nodeLights = (house.lights || []).filter((l) => l.node).map((l) => ({
      id: l.id, type: l.type, room: l.room || l.node.userData?.room,
      pos: new THREE.Vector3().setFromMatrixPosition(l.node.matrixWorld),
    }));
    this.roomLights = [];
    for (const r of rooms) {
      const area = r.area || (r.rects || [r.rect]).reduce((a, q) => a + q[2] * q[3], 0);
      if (area < 1.5) continue;
      const floorY = r.center[1];
      const ceilY = floorY + (house.levelHeight?.(r.level) ?? (house.spec?.levels?.find((l) => l.id === r.level)?.clear_height ?? 2.8));
      this.roomLights.push({ room: r, area, floorY, ceilY, albedo: FLOOR_ALBEDO[r.floor] || [0.45, 0.42, 0.38], bounce: null });
    }
    // Exterior fixtures (terrace/entrance/balcony): LIGHT_* nodes outside rooms, else house.json.
    const roomIds = new Set(this.roomLights.map((r) => r.room.id));
    let ext = nodeLights.filter((l) => !roomIds.has(l.room) && !rooms.some((r) => r.id === l.room)).map((l) => ({ id: l.id, type: l.type, pos: l.pos }));
    if (!nodeLights.length) {
      ext = (house.spec?.lighting?.fixtures || []).filter((f) => !roomIds.has(f.room)).map((f) => {
        const pos = new THREE.Vector3(...f.pos); if (f.level_offset) pos.y += f.level_offset;
        return { id: f.id, type: f.type, pos, dir: f.dir };
      });
    }
    this.extLights = ext;
    this.rig.build(house, this.roomLights, ext);

    // Emissive bulbs: small discs at every downlight/ceiling point, spheres for pendants/sconces.
    const discs = nodeLights.filter((l) => /downlight|ceiling|strip|cove/.test(l.type || 'downlight'));
    const bulbs = discs.length ? discs : this.rig.fixtures.map((f) => ({ type: 'ceiling', pos: f.pos }));
    if (bulbs.length) {
      const g = new THREE.CylinderGeometry(0.05, 0.05, 0.012, 20);
      const im = new THREE.InstancedMesh(g, this.bulbMat, bulbs.length);
      const m = new THREE.Matrix4();
      bulbs.forEach((b, i) => im.setMatrixAt(i, m.makeTranslation(b.pos.x, b.pos.y - 0.004, b.pos.z)));
      im.name = 'BULBS'; im.castShadow = false; im.receiveShadow = false;
      im.frustumCulled = false;
      this.fixtureGroup.add(im);
    }
    const globes = nodeLights.filter((l) => /pendant|sconce/.test(l.type || ''));
    if (globes.length) {
      const im = new THREE.InstancedMesh(new THREE.SphereGeometry(0.05, 16, 12), this.bulbMat, globes.length);
      const m = new THREE.Matrix4();
      globes.forEach((b, i) => im.setMatrixAt(i, m.makeTranslation(b.pos.x, b.pos.y - (b.type === 'pendant' ? 0.05 : 0), b.pos.z)));
      im.name = 'GLOBES'; im.castShadow = false; im.frustumCulled = false;
      this.fixtureGroup.add(im);
    }
    this._fitKey = null;
    this._placeSun();
    this._updateRoomLights();
  }

  // Sun-patch sampling -> coloured bounce emitter per room; then fixture levels for this TOD.
  _updateRoomLights() {
    if (!this.roomLights.length) return;
    const p = PRESETS[this.mode];
    const sunOn = p.bounce > 0 && this.sun.intensity > 0.3 && this.occluder?.bvh;
    const o = new THREE.Vector3();
    const sinEl = Math.max(0.05, this.sunDir.y);
    const t0 = performance.now();
    const sunBounce = new Map();
    for (const rl of this.roomLights) {
      rl.bounce = null;
      if (!sunOn) continue;
      const step = 0.3;
      let lit = 0; const c = new THREE.Vector3();
      for (const [x, z, w, d] of rl.room.rects || [rl.room.rect]) {
        for (let px = x + step / 2; px < x + w; px += step) {
          for (let pz = z + step / 2; pz < z + d; pz += step) {
            o.set(px, rl.floorY + 0.03, pz);
            if (!this.occluder.raycast(o, this.sunDir, 60)) { lit++; c.x += px; c.z += pz; }
          }
        }
      }
      if (!lit) continue;
      const A = lit * step * step;
      c.multiplyScalar(1 / lit); c.y = rl.floorY - 0.04;    // just BELOW the floor: an up-cone lights walls + ceiling
      const alb = rl.albedo;
      const lum = (alb[0] + alb[1] + alb[2]) / 3;
      // Lambertian patch: flux = E_sun,h * A * albedo, I0 = flux / pi; x1.7 stands in for further bounces.
      const I = this.sun.intensity * sinEl * A * lum / Math.PI * 1.7 * p.bounce;
      const col = new THREE.Color(this.sun.color).multiply(_c.setRGB(alb[0] / lum, alb[1] / lum, alb[2] / lum)).lerp(new THREE.Color(1, 1, 1), 0.12);
      rl.bounce = { pos: c, I, color: col, area: A };
      sunBounce.set(rl.room.id, rl.bounce);
    }
    this.bounceMs = performance.now() - t0;
    this.rig.setLevels(p, sunBounce);
    this._assignPool(true);
    this.bulbMat.emissiveIntensity = BULB_EMISSIVE * p.bulbs;
    this.bulbMat.color.set(p.bulbs > 0.5 ? 0xffffff : 0xe8e6e0);
  }

  // Debug/inspection: {room: {litArea, bounceCd, fixtures}} + the current rig assignment.
  roomLightInfo() {
    const rooms = Object.fromEntries(this.rig.rooms.map((r) => [r.id, { litArea: +(r.sunBounce?.area ?? 0).toFixed(2), bounceCd: +r.bounce.I.toFixed(3), aggCd: +(r.aggFull ?? 0).toFixed(3), fixtures: r.fixtures.length }]));
    return { rooms, rig: this.rig.info(), shadow: this.shadowFit };
  }

  // Map the virtual lights onto the real rig for the camera (Game.teleport calls this with snap).
  _assignPool(snap = false) {
    if (snap) { const ctx = this._fitContext(); if (ctx.key !== this._fitKey) this._placeSun(); }
    this.rig.assign(this.game.camera, this.game.currentRoom?.id, snap);
  }

  update(dt) {
    const target = this._adaptTarget ?? 0;
    const cur = this._adapt ?? 0;
    if (cur !== target) {
      const k = 1 - Math.exp(-dt / 0.45);
      this._adapt = Math.abs(target - cur) < 0.002 ? target : cur + (target - cur) * k;
      this._applyAdaptation();
    }
    const ctx = this._fitContext();
    if (ctx.key !== this._fitKey) this._placeSun();
    this._poolT = (this._poolT || 0) - dt;
    if (this._poolT <= 0) { this._poolT = 0.2; this._assignPool(false); }
    this.rig.tick(dt);
    // Cached shadows: re-render while something moves (doors / interact animations).
    if (this._doorsMoved()) this.invalidateShadows(0.3);
    if (this._shadowDirtyT > 0) {
      this._shadowDirtyT -= dt;
      this.sun.shadow.needsUpdate = true;
      this.rig.invalidate();
    }
  }

  _doorsMoved() {
    const doors = this.house?.doors;
    if (!doors?.length) return false;
    let h = 0;
    for (const d of doors) { const q = d.node.quaternion, p = d.node.position; h += q.x * 1.3 + q.y * 1.7 + q.z * 2.1 + q.w + p.x * 0.7 + p.z * 0.3; }
    const moved = this._doorHash !== undefined && Math.abs(h - this._doorHash) > 1e-6;
    this._doorHash = h;
    return moved;
  }

  dispose() {
    this.pmrem.dispose();
    for (const t of this.env.values()) t.dispose();
  }
}

const _c = new THREE.Color();

export function dirFromAzEl(azDeg, elDeg) {
  const az = THREE.MathUtils.degToRad(azDeg), el = THREE.MathUtils.degToRad(elDeg);
  return new THREE.Vector3(Math.sin(az) * Math.cos(el), Math.sin(el), -Math.cos(az) * Math.cos(el));
}

// ---- HDRI preparation ------------------------------------------------------------------------
// three samples an equirect with u = atan(dir.z, dir.x)/2PI + 0.5, v = asin(dir.y)/PI + 0.5,
// and row 0 of the file is the top (+Y).
function prepareHDRI(key, tex, preset) {
  const img = tex.image;
  const { data, width: W, height: H } = img;
  const half = data instanceof Uint16Array;
  const ch = data.length / (W * H);
  const f = half ? DataUtils.fromHalfFloat : (v) => v;
  const t = half ? DataUtils.toHalfFloat : (v) => v;
  const sun = findSun(data, W, H, ch, f);
  const clamp = sun ? sun.clamp : Infinity;

  // Sky grade phase 1 (before the IBL copy): flatten the HDRI's own sun, gradients.
  const sg = preset.skyGrade || {};
  const texAz = sun ? sun.az : preset.azimuth;             // the preset azimuth in texture frame
  const lightEl = preset.el ?? THREE.MathUtils.clamp(sun ? sun.el : preset.fallbackEl, preset.minEl, preset.maxEl);
  if (sg.mask) maskSky(data, W, H, ch, f, t, sg.mask);
  gradeSky(img, f, t, {
    removeSun: sun ? { az: sun.az, el: sun.el, radiusDeg: 5 } : null,
    tint: sg.tint, add: sg.add, sunSide: sg.sunSide, sunAz: texAz,
  });

  // Sky statistics (sun clamped): cosine-weighted upper-hemisphere radiance (-> sky irradiance on the
  // ground) and the mean horizon colour (0..4 deg), both linear RGB.
  const up = [0, 0, 0]; let upW = 0;
  const hz = [0, 0, 0]; let hzN = 0;
  const step = Math.max(1, Math.round(W / 512));
  for (let y = 0; y < H / 2; y += step) {
    const el = (0.5 - (y + 0.5) / H) * Math.PI;
    const w = Math.sin(el) * Math.cos(el);
    for (let x = 0; x < W; x += step * 2) {
      const i = (y * W + x) * ch;
      let r = f(data[i]), g = f(data[i + 1]), b = f(data[i + 2]);
      const l = 0.2126 * r + 0.7152 * g + 0.0722 * b;
      if (l > clamp) { const k = clamp / l; r *= k; g *= k; b *= k; }
      up[0] += r * w; up[1] += g * w; up[2] += b * w; upW += w;
      if (el < 0.07) { hz[0] += r; hz[1] += g; hz[2] += b; hzN++; }
    }
  }
  const skyL = up.map((v) => v / upW);                          // mean cos-weighted radiance
  const horizon = hz.map((v) => v / Math.max(1, hzN));
  const sunEh = sun ? sun.irradiance * Math.max(0, Math.sin(THREE.MathUtils.degToRad(lightEl))) : 0;
  const ga = preset.groundAlbedo;
  const groundL = [0, 1, 2].map((c) => ga[c] * (skyL[c] * 2 + sunEh * 0.95) / Math.PI * 0.9);

  // IBL copy at <=1k: sun clamped, desaturated sky, lower hemisphere = ground radiance
  // (blended over a 3 deg horizon band).
  const S = preset.iblSaturation ?? 1;
  const ds = W > 1024 ? 2 : 1;
  const w2 = W / ds, h2 = H / ds;
  const out = new (half ? Uint16Array : Float32Array)(w2 * h2 * 4);
  for (let y = 0; y < h2; y++) {
    const el = (0.5 - (y + 0.5) / h2) * 180;
    const gk = THREE.MathUtils.clamp((1.5 - el) / 3, 0, 1);      // 0 above +1.5deg .. 1 below -1.5deg
    for (let x = 0; x < w2; x++) {
      let r = 0, g = 0, b = 0;
      for (let sy = 0; sy < ds; sy++) for (let sx = 0; sx < ds; sx++) {
        const i = ((y * ds + sy) * W + (x * ds + sx)) * ch;
        let R = f(data[i]), G = f(data[i + 1]), B = f(data[i + 2]);
        const l = 0.2126 * R + 0.7152 * G + 0.0722 * B;
        if (l > clamp) { const k = clamp / l; R *= k; G *= k; B *= k; }
        r += R; g += G; b += B;
      }
      const n = ds * ds; r /= n; g /= n; b /= n;
      const l = 0.2126 * r + 0.7152 * g + 0.0722 * b;
      r = l + (r - l) * S; g = l + (g - l) * S; b = l + (b - l) * S;
      if (gk > 0) { r += (groundL[0] - r) * gk; g += (groundL[1] - g) * gk; b += (groundL[2] - b) * gk; }
      const o = (y * w2 + x) * 4;
      out[o] = t(r); out[o + 1] = t(g); out[o + 2] = t(b); out[o + 3] = t(1);
    }
  }
  const iblTex = new THREE.DataTexture(out, w2, h2, THREE.RGBAFormat, tex.type);
  iblTex.colorSpace = tex.colorSpace;
  iblTex.mapping = THREE.EquirectangularReflectionMapping;
  iblTex.minFilter = THREE.LinearFilter; iblTex.magFilter = THREE.LinearFilter; iblTex.generateMipmaps = false;
  iblTex.flipY = tex.flipY;
  iblTex.needsUpdate = true;

  // Background: lower hemisphere (the mirrored sky) -> horizon colour, in place (no extra copy).
  const hzBelow = horizon.map((v, c) => v * 0.55 + groundL[c] * 0.45);
  for (let y = Math.floor(H / 2) - 1; y < H; y++) {
    const el = (0.5 - (y + 0.5) / H) * 180;
    const gk = THREE.MathUtils.clamp((0.6 - el) / 1.2, 0, 1);
    if (gk <= 0) continue;
    for (let x = 0; x < W; x++) {
      const i = (y * W + x) * ch;
      for (let c = 0; c < 3; c++) data[i + c] = t(f(data[i + c]) * (1 - gk) + hzBelow[c] * gk);
    }
  }
  // Sky grade phase 2 (background only): the sun / moon disc where the light is.
  if (sg.disc) gradeSky(img, f, t, { disc: { ...sg.disc, az: texAz, el: lightEl } });
  tex.needsUpdate = true;
  return { key, tex, iblTex, sun, horizon, skyL, groundL };
}

// Paints out thin structures (pylons, wires) in a sky window: a separable median filter (removes the
// thin lines) then a box blur gives the local sky, blended in with feathered edges.
function maskSky(data, W, H, ch, f, t, m) {
  const x0 = Math.floor(m.u0 * W), x1 = Math.ceil(m.u1 * W);
  const y0 = Math.max(0, Math.floor((0.5 - m.el1 / 180) * H)), y1 = Math.ceil((0.5 - m.el0 / 180) * H);
  const R = Math.max(2, Math.round(W * (m.radius ?? 0.008))), P = R * 2;
  const w = x1 - x0 + 2 * P, h = y1 - y0 + 2 * P;
  const src = new Float32Array(w * h * 3);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const yy = THREE.MathUtils.clamp(y0 - P + y, 0, H - 1), xx = (x0 - P + x + W) % W, i = (yy * W + xx) * ch;
    for (let c = 0; c < 3; c++) src[(y * w + x) * 3 + c] = f(data[i + c]);
  }
  const pass = (a, fn, dx, dy, r) => {
    const o = new Float32Array(a.length), buf = new Float32Array(2 * r + 1);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) for (let c = 0; c < 3; c++) {
      let acc = 0;
      for (let k = -r; k <= r; k++) {
        const xx = THREE.MathUtils.clamp(x + k * dx, 0, w - 1), yy = THREE.MathUtils.clamp(y + k * dy, 0, h - 1);
        const v = a[(yy * w + xx) * 3 + c];
        if (fn === 'med') buf[k + r] = v; else acc += v;
      }
      o[(y * w + x) * 3 + c] = fn === 'med' ? buf.sort()[r] : acc / (2 * r + 1);
    }
    return o;
  };
  let sky = pass(pass(src, 'med', 1, 0, R), 'med', 0, 1, R);
  sky = pass(pass(sky, 'avg', 1, 0, R), 'avg', 0, 1, R);
  for (let y = y0; y < y1; y++) {
    const el = (0.5 - (y + 0.5) / H) * 180;
    const ke = THREE.MathUtils.smoothstep(el, m.el0, m.el0 + 1.5) * (1 - THREE.MathUtils.smoothstep(el, m.el1 - 3, m.el1));
    for (let x = x0; x < x1; x++) {
      const u = x / W;
      const k = ke * THREE.MathUtils.smoothstep(u, m.u0, m.u0 + 0.02) * (1 - THREE.MathUtils.smoothstep(u, m.u1 - 0.02, m.u1));
      if (k <= 0) continue;
      const i = (y * W + x) * ch, j = ((y - y0 + P) * w + (x - x0 + P)) * 3;
      for (let c = 0; c < 3; c++) { const v = f(data[i + c]), sv = sky[j + c]; data[i + c] = t(v + (sv - v) * k); }
    }
  }
}

// Brightest region of the upper hemisphere -> {az, el, clamp, irradiance} (texture frame).
function findSun(data, W, H, ch, f) {
  const lum = (i) => 0.2126 * f(data[i]) + 0.7152 * f(data[i + 1]) + 0.0722 * f(data[i + 2]);
  const step = Math.max(1, Math.round(W / 1024));
  let max = 0, mx = 0, my = 0;
  for (let y = 0; y < H / 2; y += step) for (let x = 0; x < W; x += step) {
    const l = lum((y * W + x) * ch);
    if (l > max) { max = l; mx = x; my = y; }
  }
  if (max <= 0) return null;
  let sx = 0, sy = 0, sw = 0;
  const R = Math.round(W / 64);
  for (let dy = -R; dy <= R; dy++) {
    const y = my + dy; if (y < 0 || y >= H) continue;
    for (let dx = -R; dx <= R; dx++) {
      const l = lum((y * W + (mx + dx + W) % W) * ch);
      if (l > max * 0.5) { sx += dx * l; sy += dy * l; sw += l; }
    }
  }
  const cx = mx + (sw ? sx / sw : 0), cy = my + (sw ? sy / sw : 0);
  const u = (cx + 0.5) / W, v = 1 - (cy + 0.5) / H;
  const phi = (u - 0.5) * Math.PI * 2;
  const el = (v - 0.5) * Math.PI;
  const d = new THREE.Vector3(Math.cos(phi) * Math.cos(el), Math.sin(el), Math.sin(phi) * Math.cos(el));
  const az = (THREE.MathUtils.radToDeg(Math.atan2(d.x, -d.z)) + 360) % 360;
  const sample = [];
  for (let y = 0; y < H / 2; y += step * 2) for (let x = 0; x < W; x += step * 2) sample.push(lum((y * W + x) * ch));
  sample.sort((a, b) => a - b);
  const clamp = Math.max(8, sample[Math.floor(sample.length * 0.999)] * 3);
  let irradiance = 0;
  const R2 = Math.round(W / 32);
  for (let dy = -R2; dy <= R2; dy++) {
    const y = my + dy; if (y < 0 || y >= H) continue;
    const dOmega = (2 * Math.PI / W) * (Math.PI / H) * Math.cos(((y + 0.5) / H - 0.5) * Math.PI);
    for (let dx = -R2; dx <= R2; dx++) {
      const l = lum((y * W + ((mx + dx + W) % W)) * ch);
      if (l > clamp) irradiance += (l - clamp) * dOmega;
    }
  }
  return { az, el: THREE.MathUtils.radToDeg(el), peak: max, clamp, irradiance };
}
