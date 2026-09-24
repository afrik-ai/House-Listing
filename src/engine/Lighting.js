import * as THREE from 'three';
import { Sky } from 'three/addons/objects/Sky.js';
import { Physics } from './Physics.js';

const { DataUtils } = THREE;

// Time of day = HDRI (background + PMREM image-based lighting) + a shadow-casting sun/moon aligned
// with the HDRI's own sun + exposure/grade, plus the pieces a rasteriser needs to fake GI:
//
//  * The HDRI is prepared once per load: the sun disc is clamped out of the IBL copy and re-emitted
//    as the shadow-casting DirectionalLight with the MEASURED irradiance (no double sun), and the
//    lower hemisphere (a mirrored sky in these "puresky" captures) is replaced by a ground radiance
//    (albedo x sky+sun irradiance) in the IBL and by the horizon colour in the background.
//  * A large ground disc at grade fades into the horizon with fog, so nothing ever shows the
//    mirrored clouds through windows or under the house (P04's landscape covers it later).
//  * Per-room light (one PointLight per room, constant light count -> no recompiles):
//      - day/golden: a BOUNCE light sitting just below the sunlit floor patch (the floor itself is
//        not lit by it, walls + ceiling are), power = sun irradiance x lit area x floor albedo, with
//        the lit area found by casting rays from the floor toward the sun through the real geometry;
//      - night: the room's ceiling fixtures (LIGHT_* nodes) as one warm light below the ceiling.
//  * Emissive bulbs at every LIGHT_* node (downlights, ceiling, pendant, sconces) that bloom at night.
//  * Eye adaptation inside rooms (IBL down, interior hemisphere fill + exposure up, warmer white
//    balance), easing ~0.45 s; snaps on teleport.
//
// Azimuth convention: 0 = north (-Z), 90 = east (+X), 180 = south (+Z), 270 = west (-X).
const PRESETS = {
  day: {
    hdri: 'day_partly_cloudy', azimuth: 215, minEl: 35, maxEl: 62, fallbackEl: 50,
    sunColor: 0xfff3e4, sunScale: 1.35, sunIntensity: 5.6, sunMax: 7.5,
    hemiSky: 0xc4d4ec, hemiGround: 0x8f8574, hemiIntensity: 0.1,
    inSky: 0xf2eee8, inGround: 0xece2d4, hemiInterior: 0.34,
    envIntensity: 1.0, bgIntensity: 1.0, exposure: 0.95, iblSaturation: 0.4,
    interiorEnv: 0.34, interiorExposure: 1.95, wbOut: [1.0, 1.0, 1.0], wbIn: [1.03, 1.0, 0.95],
    bounce: 1.0, fixtures: 0, bulbs: 0, groundAlbedo: [0.17, 0.16, 0.13], grass: [0.06, 0.1, 0.03],
    grade: { saturation: 0.1, contrast: 0.1, bloom: 0.75, bloomThreshold: 1.0, vignette: 0.34 },
    sky: { turbidity: 3, rayleigh: 1.2, mie: 0.004, mieG: 0.8 },
  },
  golden_hour: {
    hdri: 'golden_hour', azimuth: 245, minEl: 6, maxEl: 14, fallbackEl: 9,
    sunColor: 0xffae62, sunScale: 1.25, sunIntensity: 3.4, sunMax: 5,
    hemiSky: 0xd9b08a, hemiGround: 0x7a5e46, hemiIntensity: 0.06,
    inSky: 0xf0dcc4, inGround: 0xe0c09c, hemiInterior: 0.24,
    envIntensity: 0.4, bgIntensity: 0.62, exposure: 1.0, iblSaturation: 0.7,
    interiorEnv: 0.45, interiorExposure: 1.8, wbOut: [1.0, 0.99, 0.97], wbIn: [1.03, 0.99, 0.93],
    bounce: 1.1, fixtures: 0.35, bulbs: 0.4, groundAlbedo: [0.17, 0.15, 0.11], grass: [0.06, 0.08, 0.025],
    grade: { saturation: 0.14, contrast: 0.1, bloom: 0.8, bloomThreshold: 0.95, vignette: 0.4 },
    sky: { turbidity: 6, rayleigh: 2.4, mie: 0.012, mieG: 0.9 },
  },
  night: {
    hdri: 'night_clear', azimuth: 140, minEl: 25, maxEl: 60, fallbackEl: 40,
    sunColor: 0xa9bde8, sunScale: 0.06, sunIntensity: 0.1, sunMax: 0.2,
    hemiSky: 0x1c2640, hemiGround: 0x0b0c10, hemiIntensity: 0.05,
    inSky: 0x6a5846, inGround: 0xa07a52, hemiInterior: 0.22,
    envIntensity: 0.07, bgIntensity: 0.14, exposure: 1.0, iblSaturation: 0.6,
    interiorEnv: 1.0, interiorExposure: 1.05, wbOut: [1.0, 1.0, 1.0], wbIn: [1.0, 1.0, 1.0],
    bounce: 0, fixtures: 1.0, bulbs: 1.0, groundAlbedo: [0.1, 0.1, 0.08], grass: [0.05, 0.07, 0.03],
    grade: { saturation: 0.08, contrast: 0.08, bloom: 0.9, bloomThreshold: 0.8, vignette: 0.45 },
    sky: { turbidity: 2, rayleigh: 0.4, mie: 0.002, mieG: 0.7 },
  },
};
export const TIMES_OF_DAY = Object.keys(PRESETS);

const FIXTURE_COLOR = new THREE.Color().setRGB(1.0, 0.72, 0.45);  // ~2700 K, linear
const FIXTURE_CD_PER_M2 = 0.34;  // night room light: candela per m² of room (clamped)
const BULB_EMISSIVE = 60;        // emissive intensity of a bulb at night (blooms)
const POOL_SIZE = 10;            // real PointLights (see _assignPool)
const FLOOR_ALBEDO = {
  oak_plank: [0.42, 0.28, 0.16], large_format_tile_grey: [0.36, 0.35, 0.33], large_format_tile_light: [0.6, 0.57, 0.5],
  small_tile_white: [0.72, 0.72, 0.7], concrete_screed: [0.34, 0.33, 0.31], stair_tread: [0.42, 0.28, 0.16],
};

export class Lighting {
  constructor(game) {
    this.game = game;
    this.scene = game.scene;
    this.renderer = game.renderer;
    this.loader = game.loader;
    this.mode = game.initialTod || 'day';
    this.bounds = new THREE.Box3(new THREE.Vector3(-15, -1, -10), new THREE.Vector3(25, 8, 15));
    this.hdri = new Map();        // "<name>_<res>" -> Promise<prepared HDRI | null>
    this.env = new Map();         // key -> PMREM render target
    this.envKey = null;
    this.sunDir = new THREE.Vector3(0, 1, 0);
    this.roomLights = [];         // [{room, light, bounce:{pos,I,color}, fixture:{pos,I}}]
    this.extLights = [];
    this.occluder = null;         // BVH of shadow casters, for sun-patch sampling

    this.sun = new THREE.DirectionalLight(0xffffff, 3);
    this.sun.name = 'SUN';
    this.sun.castShadow = true;
    this.sun.shadow.bias = -0.0002;
    this.sun.shadow.normalBias = 0.025;
    this.sun.target = new THREE.Object3D();
    this.scene.add(this.sun, this.sun.target);

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

    this.pmrem = new THREE.PMREMGenerator(this.renderer.gl);
    this.pmrem.compileEquirectangularShader();
    this.renderer.onQuality((s) => this.applyQuality(s));
    this.applyQuality(this.renderer.settings);
  }

  get presets() { return PRESETS; }

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
    this.sun.shadow.radius = settings.shadowRadius ?? 2;
    this.sun.shadow.blurSamples = 12;
    this.sun.shadow.normalBias = 0.02 * Math.max(1, 2048 / size);
    this.sun.shadow.needsUpdate = true;
    if (this._ready) this.setTimeOfDay(this.mode);   // HDRI resolution may differ per tier
  }

  fitShadowTo(box) {
    if (box && !box.isEmpty()) this.bounds.copy(box).expandByScalar(1.0);
    this._placeSun();
  }

  _placeSun() {
    const dir = this.sunDir;
    const center = this.bounds.getCenter(new THREE.Vector3());
    const sphere = this.bounds.getBoundingSphere(new THREE.Sphere());
    this.sun.position.copy(center).addScaledVector(dir, sphere.radius * 2.5);
    this.sun.target.position.copy(center);
    this.sun.target.updateMatrixWorld();
    this.sun.updateMatrixWorld();
    const view = new THREE.Matrix4().lookAt(this.sun.position, center, new THREE.Vector3(0, 1, 0));
    const inv = view.clone().invert();
    const min = new THREE.Vector3(Infinity, Infinity, Infinity), max = min.clone().negate();
    const c = new THREE.Vector3();
    for (let i = 0; i < 8; i++) {
      c.set(i & 1 ? this.bounds.max.x : this.bounds.min.x, i & 2 ? this.bounds.max.y : this.bounds.min.y, i & 4 ? this.bounds.max.z : this.bounds.min.z);
      c.sub(this.sun.position).applyMatrix4(inv);
      min.min(c); max.max(c);
    }
    const cam = this.sun.shadow.camera;
    cam.left = min.x; cam.right = max.x; cam.bottom = min.y; cam.top = max.y;
    cam.near = Math.max(0.1, -max.z - 1); cam.far = -min.z + 1;
    cam.updateProjectionMatrix();
    this.sun.shadow.needsUpdate = true;
  }

  async setTimeOfDay(mode) {
    const p = PRESETS[mode];
    if (!p) throw new Error(`unknown time of day "${mode}" (${TIMES_OF_DAY.join('|')})`);
    this.mode = mode;
    const token = (this._todToken = (this._todToken || 0) + 1);
    const h = await this._getHDRI(mode);
    if (token !== this._todToken) return;
    const el = THREE.MathUtils.clamp(h?.sun ? h.sun.el : p.fallbackEl, p.minEl, p.maxEl);
    this.sunDir.copy(dirFromAzEl(p.azimuth, el));
    this.sunEl = el;
    this.sun.color.set(p.sunColor);
    this.sun.intensity = h?.sun?.irradiance ? Math.min(p.sunMax, h.sun.irradiance * p.sunScale) : p.sunIntensity;
    this._placeSun();
    this._applyEnvironment(p, h);
    this.game.postfx?.setGrade(p.grade);
    this._updateRoomLights();
    this._applyAdaptation();
    this._ready = true;
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

  // ---- per-room bounce/fixture lights, exterior fixtures, bulbs ----------------------------
  // Called once the house is loaded. Constant light count across times of day.
  buildFixtures(house) {
    this.house = house;
    this.fixtureGroup.clear();
    this.roomLights = []; this.extLights = [];
    // Light POOL: a fixed number of real PointLights shared by all room/exterior "virtual" lights,
    // re-assigned to the ones that matter most for the camera (current room first, then by
    // intensity / distance). Every forward-shaded program loops over every light and ANGLE
    // compiles that loop per program: 29 real lights cost ~3.4 s of first-frame compile vs ~1 s.
    this.pool = [];
    for (let i = 0; i < POOL_SIZE; i++) {
      const l = new THREE.PointLight(FIXTURE_COLOR, 0, 7, 2);
      l.name = `POOL_${i}`; l.castShadow = false;
      this.fixtureGroup.add(l);
      this.pool.push({ light: l, owner: null, target: 0 });
    }
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
    const levelOf = (r) => ({ floor: r.center[1], ceil: r.center[1] + (house.levelHeight?.(r.level) ?? 2.8) });

    for (const r of rooms) {
      const area = r.area || (r.rects || [r.rect]).reduce((a, q) => a + q[2] * q[3], 0);
      if (area < 1.5) continue;
      const lv = levelOf(r);
      const own = nodeLights.filter((l) => l.room === r.id);
      const main = r.main || r.rect;
      const fixPos = own.length
        ? own.reduce((a, l) => a.add(l.pos), new THREE.Vector3()).multiplyScalar(1 / own.length)
        : new THREE.Vector3(main[0] + main[2] / 2, lv.ceil, main[1] + main[3] / 2);
      fixPos.y = lv.floor + (lv.ceil - lv.floor) * 0.48;   // mid-height: even walls+ceiling, no ceiling hotspot
      const light = vlight(`ROOMLIGHT_${r.id}`, Math.max(6, Math.sqrt(area) * 2.4));
      light.position.copy(fixPos);
      this.roomLights.push({ room: r, light, area, floorY: lv.floor, fixture: { pos: fixPos, I: FIXTURE_CD_PER_M2 * THREE.MathUtils.clamp(area, 4, 30) }, bounce: null });
    }

    // Exterior fixtures (terrace/entrance/balcony): LIGHT_* nodes outside rooms, else house.json.
    const roomIds = new Set(rooms.map((r) => r.id));
    let ext = nodeLights.filter((l) => !roomIds.has(l.room)).map((l) => ({ id: l.id, type: l.type, pos: l.pos }));
    if (!nodeLights.length) {
      ext = (house.spec?.lighting?.fixtures || []).filter((f) => !roomIds.has(f.room)).map((f) => {
        const pos = new THREE.Vector3(...f.pos); if (f.level_offset) pos.y += f.level_offset;
        return { id: f.id, type: f.type, pos, dir: f.dir };
      });
    }
    for (const f of ext.slice(0, 10)) {
      const light = vlight(`EXTLIGHT_${f.id}`, 7);
      light.position.copy(f.pos);
      if (f.type === 'downlight') light.position.y -= 0.3;
      if (f.dir) light.position.add(new THREE.Vector3(...f.dir).multiplyScalar(0.2));
      this.extLights.push({ light, I: f.type === 'sconce' ? 1.4 : 2.2 });
    }

    // Emissive bulbs: small discs at every downlight/ceiling point, spheres for pendants/sconces.
    const discs = nodeLights.filter((l) => /downlight|ceiling|strip|cove/.test(l.type || 'downlight'));
    const bulbs = discs.length ? discs : this.roomLights.map((rl) => ({ type: 'ceiling', pos: new THREE.Vector3(rl.fixture.pos.x, rl.floorY + 2.84, rl.fixture.pos.z) }));
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
    this._updateRoomLights();
  }

  // Sun-patch sampling -> bounce light per room; then blend with night fixtures for this TOD.
  _updateRoomLights() {
    if (!this.roomLights.length) return;
    const p = PRESETS[this.mode];
    const sunOn = p.bounce > 0 && this.sun.intensity > 0.3 && this.occluder?.bvh;
    const o = new THREE.Vector3();
    const sinEl = Math.max(0.05, this.sunDir.y);
    const t0 = performance.now();
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
      c.multiplyScalar(1 / lit); c.y = rl.floorY - 0.03;    // just BELOW the floor: lights walls + ceiling, not the floor
      const alb = FLOOR_ALBEDO[rl.room.floor] || [0.45, 0.42, 0.38];
      const lum = (alb[0] + alb[1] + alb[2]) / 3;
      // Flux leaving the patch into the hemisphere above it: E_sun,h * A * albedo; I = flux / 2π.
      // x2.2: stands in for the second+ bounces (walls/ceiling re-reflecting it).
      const I = this.sun.intensity * sinEl * A * lum / (2 * Math.PI) * 2.2 * p.bounce;
      const col = new THREE.Color(this.sun.color).multiply(_c.setRGB(alb[0] / lum, alb[1] / lum, alb[2] / lum)).lerp(new THREE.Color(1, 1, 1), 0.45);
      rl.bounce = { pos: c, I, color: col, area: A };
    }
    this.bounceMs = performance.now() - t0;
    for (const rl of this.roomLights) {
      const fI = rl.fixture.I * p.fixtures;
      const bI = rl.bounce?.I ?? 0;
      if (bI >= fI) {
        rl.light.position.copy(rl.bounce ? rl.bounce.pos : rl.fixture.pos);
        rl.light.color.copy(rl.bounce ? rl.bounce.color : FIXTURE_COLOR);
      } else {
        rl.light.position.copy(rl.fixture.pos);
        rl.light.color.copy(FIXTURE_COLOR);
      }
      rl.light.intensity = bI + fI;
    }
    for (const e of this.extLights) { e.light.intensity = e.I * p.fixtures; e.light.color.copy(FIXTURE_COLOR); }
    this._assignPool(true);
    this.bulbMat.emissiveIntensity = BULB_EMISSIVE * p.bulbs;
    this.bulbMat.color.set(p.bulbs > 0.5 ? 0xffffff : 0xe8e6e0);
  }

  // Debug/inspection: {room: {litArea, bounceCd, fixtureCd}}.
  roomLightInfo() {
    return Object.fromEntries(this.roomLights.map((rl) => [rl.room.id, { litArea: +(rl.bounce?.area ?? 0).toFixed(2), bounceCd: +(rl.bounce?.I ?? 0).toFixed(3), cd: +rl.light.intensity.toFixed(3) }]));
  }

  // Pick the POOL_SIZE most relevant virtual lights for the camera and map them onto the pool.
  // snap = apply intensities immediately (teleports, TOD changes, harness shots); otherwise newly
  // assigned lights fade in over ~0.3 s so reassignment never pops.
  _assignPool(snap = false) {
    if (!this.pool?.length) return;
    const cam = this.game.camera.position;
    const inRoom = this.game.currentRoom?.id;
    const cands = [...this.roomLights.map((rl) => ({ v: rl.light, room: rl.room.id })), ...this.extLights.map((e) => ({ v: e.light, room: null }))]
      .filter((c) => c.v.intensity > 1e-3)
      .map((c) => ({ ...c, score: c.room && c.room === inRoom ? Infinity : c.v.intensity / (1 + c.v.position.distanceToSquared(cam) / 16) }))
      .sort((a, b) => b.score - a.score)
      .slice(0, this.pool.length);
    const chosen = new Set(cands.map((c) => c.v));
    for (const slot of this.pool) if (slot.owner && !chosen.has(slot.owner)) { slot.owner = null; slot.target = 0; if (snap) slot.light.intensity = 0; }
    const owned = new Set(this.pool.map((s) => s.owner).filter(Boolean));
    for (const c of cands) {
      let slot = this.pool.find((s) => s.owner === c.v);
      if (!slot) { slot = this.pool.find((s) => !s.owner && s.light.intensity < 1e-3) || this.pool.find((s) => !s.owner); if (!slot) continue; slot.owner = c.v; slot.light.intensity = 0; }
      owned.add(c.v);
      slot.light.position.copy(c.v.position);
      slot.light.color.copy(c.v.color);
      slot.light.distance = c.v.distance;
      slot.target = c.v.intensity;
      if (snap) slot.light.intensity = slot.target;
    }
  }

  update(dt) {
    this._poolT = (this._poolT || 0) - dt;
    if (this._poolT <= 0) { this._poolT = 0.2; this._assignPool(false); }
    if (this.pool) for (const s of this.pool) {
      const d = s.target - s.light.intensity;
      if (Math.abs(d) > 1e-4) s.light.intensity += d * Math.min(1, dt / 0.3 * 3);
      else s.light.intensity = s.target;
    }
    const target = this._adaptTarget ?? 0;
    const cur = this._adapt ?? 0;
    if (cur !== target) {
      const k = 1 - Math.exp(-dt / 0.45);
      this._adapt = Math.abs(target - cur) < 0.002 ? target : cur + (target - cur) * k;
      this._applyAdaptation();
    }
  }

  dispose() {
    this.pmrem.dispose();
    for (const t of this.env.values()) t.dispose();
  }
}

const _c = new THREE.Color();
const vlight = (name, distance) => ({ name, distance, position: new THREE.Vector3(), color: FIXTURE_COLOR.clone(), intensity: 0 });

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
  const sunEh = sun ? sun.irradiance * Math.max(0, Math.sin(THREE.MathUtils.degToRad(sun.el))) : 0;
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
  tex.needsUpdate = true;
  return { key, tex, iblTex, sun, horizon, skyL, groundL };
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
