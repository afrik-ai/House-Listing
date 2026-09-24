import * as THREE from 'three';
import { EventEmitter } from '../engine/EventEmitter.js';
import { Renderer, QUALITY_TIERS } from '../engine/Renderer.js';
import { Loader } from '../engine/Loader.js';
import { PostFX } from '../engine/PostFX.js';
import { Physics } from '../engine/Physics.js';
import { Lighting, TIMES_OF_DAY } from '../engine/Lighting.js';
import { House } from './House.js';
import { Player } from './Player.js';

// Optional modules owned by other pieces. They are picked up automatically when the file exists
// (import.meta.glob never fails on a missing file). Contract: the module exports a class named
// after the key (or default) with `constructor(game)`, optional `async init()`, `update(dt)`
// (called every rendered frame, after the simulation) and `dispose()`.
const OPTIONAL = import.meta.glob(['./Interact.js', './Audio.js', '../ui/HUD.js', '../ui/Menus.js']);
// Generic plugins: every src/game/plugins/*.js, loaded in filename order (see CONTRACTS.md).
const PLUGINS = import.meta.glob('./plugins/*.js');
const OPTIONAL_SLOTS = [
  { path: './Interact.js', exportName: 'Interact', prop: 'interaction' },
  { path: './Audio.js', exportName: 'Audio', prop: 'audio' },
  { path: '../ui/HUD.js', exportName: 'HUD', prop: 'hud' },
  { path: '../ui/Menus.js', exportName: 'Menus', prop: 'menus' },
];

const STEP = 1 / 120;           // fixed simulation step (s)
const MAX_STEPS = 12;           // spiral-of-death guard (0.1 s of simulation per frame max)
const STRIDE = 0.72, STRIDE_SPRINT = 0.95;
const MOVE_KEYS = new Set(['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space']);

// Orchestrator. Owns the renderer, scene, camera, loader, physics, lighting, post FX, house and
// player; runs a fixed-timestep simulation with render interpolation; exposes events
// (see docs/CONTRACTS.md) and the window.__game debug API (see ./debugApi in createDebugApi).
export class Game extends EventEmitter {
  constructor({ canvas, houseId = 'villa-nova', quality = 'high', tod = 'day', harness = false } = {}) {
    super();
    this.houseId = houseId;
    this.harness = harness;
    this.initialTod = TIMES_OF_DAY.includes(tod) ? tod : 'day';
    this.state = 'loading';     // loading -> attract (title screen) -> playing <-> paused
    this.paused = false;
    this.uiHidden = false;
    this.holdPhysics = false;   // true after teleport(): player floats until movement input
    this.currentRoom = null;

    this.renderer = new Renderer(canvas, { quality: QUALITY_TIERS.includes(quality) ? quality : 'high' });
    this.renderer.gl.info.autoReset = false;
    this.scene = new THREE.Scene();
    this.scene.name = 'WORLD';
    this.camera = new THREE.PerspectiveCamera(62, this.renderer.width / this.renderer.height, 0.05, 600);
    this.camera.rotation.order = 'YXZ';
    this.scene.add(this.camera);   // so camera-attached objects (hand props, audio listener) render
    this.renderer.onResize((w, h) => { this.camera.aspect = w / h; this.camera.updateProjectionMatrix(); });

    this.loader = new Loader({ renderer: this.renderer });
    this.postfx = new PostFX(this.renderer, this.scene, this.camera);
    this.physics = new Physics();
    this.lighting = new Lighting(this);
    this.house = new House(this);
    this.player = new Player(this);
    this.interaction = null; this.audio = null; this.hud = null; this.menus = null;
    this.modules = [];
    this.plugins = new Map();     // name -> instance (src/game/plugins/<name>.js)

    this._acc = 0;
    this._last = 0;
    this._raf = 0;
    this._prevCam = new THREE.Vector3();
    this._curCam = new THREE.Vector3();
    this._frameTimes = [];
    this._stride = 0;
    this._roomTimer = 0;
    this._moveWaiters = [];
    this._lastInfo = { calls: 0, triangles: 0 };
    this._raycaster = new THREE.Raycaster();

    this.ready = new Promise((res, rej) => { this._resolveReady = res; this._rejectReady = rej; });
    this.ready.catch(() => {});

    // Overall progress: downloads + HDRI preparation = 0..0.84 (byte-weighted), then fixed stages.
    this._stage = 'load';
    this.loader.on('progress', (p) => {
      if (this._stage === 'load') this._progress(0.84 * p.fraction, p.label);
      else if (this._stage === 'plugins') this._progress(0.86 + 0.04 * p.fraction, p.label);
    });
    // Fan time-of-day / quality changes out to modules and plugins that care.
    this.on('tod', (mode) => { for (const m of this.modules) { try { m.onTimeOfDay?.(mode); } catch (err) { console.error('[game] onTimeOfDay', err); } } });
    this.on('quality', (tier) => { for (const m of this.modules) { try { m.onQuality?.(tier); } catch (err) { console.error('[game] onQuality', err); } } });
    this.on('pointerlock', (locked) => this._onPointerLock(locked));
    window.addEventListener('keydown', (e) => { if (MOVE_KEYS.has(e.code) && this.state === 'playing') this.holdPhysics = false; });
  }

  // ---- boot ---------------------------------------------------------------------------------
  async start() {
    try {
      this._loop = this._loop.bind(this);
      this._raf = requestAnimationFrame(this._loop);
      await Promise.all([
        this.house.load(),
        this.lighting.init(this.initialTod),
      ]);
      this._stage = 'build';
      this._progress(0.86, 'Placing lights');
      await nextFrame();
      this.lighting.setGroundLevel(this.house.gradeY);
      this.physics.setColliders([...this.house.colliders, this.lighting.ground]);
      this.lighting.fitShadowTo(this.house.bounds);
      this.lighting.buildFixtures(this.house);
      this.entryView = this._bestEntryView();
      this.player.spawn(this.entryView.pos, this.entryView.yaw);
      this._snapCamera();
      await this._initModules();
      await this._whenLoaderIdle();
      this._progress(0.9, 'Compiling shaders');
      await nextFrame();
      // Compile every program up front so nothing hitches on the first look around.
      // Warm-up in visible steps (ANGLE/D3D compiles synchronously on first use, so each step blocks;
      // yielding a frame between them keeps the bar moving instead of a long stall):
      // scene programs -> shadow + direct scene render -> full post chain.
      const T = {}; let tc = performance.now();
      await this.renderer.gl.compileAsync(this.scene, this.camera).catch(() => {});
      T.compileMs = Math.round(performance.now() - tc);
      this._progress(0.94, 'Preparing shadows');
      await nextFrame();
      tc = performance.now();
      if (!this.harness) this.enterAttract(); else this.state = 'playing';
      this.camera.updateMatrixWorld();
      const rt = new THREE.WebGLRenderTarget(64, 36, { type: THREE.HalfFloatType });
      const gl = this.renderer.gl;
      gl.setRenderTarget(rt); gl.render(this.scene, this.camera); gl.setRenderTarget(null);
      rt.dispose();
      T.sceneMs = Math.round(performance.now() - tc);
      this._progress(0.97, 'Preparing post-processing');
      await nextFrame();
      tc = performance.now();
      this.renderFrame(0);
      T.postMs = Math.round(performance.now() - tc);
      this._progress(1, 'Ready');
      await nextFrame();
      this.renderFrame(0);
      this.timings = { ...T, readyMs: Math.round(performance.now()) };
      this.emit('ready', this);
      this._resolveReady(this);
    } catch (err) {
      console.error('[game] failed to start', err);
      this.emit('error', err);
      this._rejectReady(err);
    }
    return this.ready;
  }

  async _initModules() {
    for (const slot of OPTIONAL_SLOTS) {
      const importer = OPTIONAL[slot.path];
      if (!importer) continue;
      try {
        const mod = await importer();
        const Cls = mod[slot.exportName] || mod.default;
        if (typeof Cls !== 'function') continue;
        const inst = new Cls(this);
        this[slot.prop] = inst;
        if (inst.init) await inst.init();
        this.modules.push(inst);
      } catch (err) {
        console.error(`[game] optional module ${slot.path} failed`, err);
      }
    }
    // Plugins: constructed in filename order, each init() joined to the loading bar; all resolve
    // before `ready`. A failing plugin is reported and skipped (it never blocks the game).
    this._stage = 'plugins';
    for (const path of Object.keys(PLUGINS).sort()) {
      const name = path.replace(/^.*\//, '').replace(/\.js$/, '');
      try {
        const mod = await PLUGINS[path]();
        const Cls = mod.Plugin || mod.default;
        if (typeof Cls !== 'function') { console.warn(`[game] plugin ${name}: no Plugin/default export`); continue; }
        const inst = new Cls(this);
        inst.pluginName = name;
        this.plugins.set(name, inst);
        if (inst.init) await this.loader.track(`plugin ${name}`, () => inst.init());
        this.modules.push(inst);
      } catch (err) {
        console.error(`[game] plugin ${name} failed`, err);
      }
    }
    this._stage = 'build';
  }

  _progress(fraction, label) {
    this._lastProgress = Math.max(this._lastProgress || 0, fraction);
    if (label) this._lastLabel = label;
    this.emit('progress', { fraction: this._lastProgress, label });
  }

  _whenLoaderIdle() {
    if (this.loader.isIdle) return Promise.resolve();
    return new Promise((res) => this.loader.once('idle', res));
  }

  // ---- title screen ("attract") / play / pause ----------------------------------------------
  // Before the player clicks in, the camera slowly drifts around a hero exterior view.
  enterAttract() {
    this.state = 'attract';
    this._attractT = 0;
    const ext = this.views().exteriors;
    this._attract = ext.find((v) => v.id === 'ext_garden_sw') || ext[0];
    this.lighting.setInterior(false, true);
  }

  // Called by the loading screen's "Click to enter" (a user gesture -> pointer lock allowed).
  // From the title shot: a 0.6 s push-in toward the house (under a fade), then the camera settles
  // from slightly behind/above into the player's eye over 1.0 s; input is live after that.
  enter() {
    if (this.state === 'attract' || this.state === 'loading') {
      this.player.spawn(this.entryView?.pos ?? this.house.spawn.pos, this.entryView?.yaw ?? this.house.spawn.yaw);
      this.player.look(this.player.yaw, THREE.MathUtils.degToRad(-3));
      this.player.syncCamera();
      this.lighting.setInterior(!!this.house.roomAt(this.player.feet), false);
      if (!this.harness) {
        this._glide = { t: 0, from: { pos: this.camera.position.clone(), quat: this.camera.quaternion.clone() } };
        this.state = 'entering';
        this.emit('enter-transition', 1.6);
        this.player.requestPointerLock();
        return;
      }
    }
    this._finishEnter();
  }

  _finishEnter() {
    this._glide = null;
    this.state = 'playing';
    this.holdPhysics = false;
    this._snapCamera();
    this.emit('enter');
    if (!this.harness && !this.player.locked) this.player.requestPointerLock();
    setTimeout(() => this.lighting.prefetch(), 2500);   // other times of day, after the player is in
  }

  _updateGlide(dt) {
    const g = this._glide;
    g.t += dt;
    const P1 = 0.6, P2 = 1.0;
    if (g.t < P1) {                       // push in along the title-shot view
      const k = easeInOut(g.t / P1);
      const fwd = new THREE.Vector3(0, 0, -1).applyQuaternion(g.from.quat);
      this.camera.position.copy(g.from.pos).addScaledVector(fwd, k * 4);
      this.camera.quaternion.copy(g.from.quat);
    } else if (g.t < P1 + P2) {           // settle into the eye from 0.8 m behind, 0.35 m above
      const k = easeInOut((g.t - P1) / P2);
      this.player.syncCamera();
      const eye = this.camera.position.clone(), q = this.camera.quaternion.clone();
      const back = new THREE.Vector3(0, 0, 1).applyQuaternion(q).setY(0).normalize();
      this.camera.position.copy(eye).addScaledVector(back, 0.8 * (1 - k)).add(new THREE.Vector3(0, 0.35 * (1 - k), 0));
      const qStart = q.clone().multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -0.12));
      this.camera.quaternion.copy(qStart).slerp(q, k);
    } else {
      this._finishEnter();
    }
  }

  // First view after "Click to enter". P02's spawn (the front door) is the anchor; the engine
  // walks up to 4 m along the spawn's view and turns up to +-80 deg to find the most open framing
  // (a fan of rays: long sightlines into the big rooms beat a wall or the side of the stair).
  _bestEntryView() {
    const s = this.house.spawn;
    const P = this.physics, EYE = this.player.eyeHeight;
    const yaw0 = THREE.MathUtils.degToRad(s.yaw);
    const fwd = new THREE.Vector3(-Math.sin(yaw0), 0, -Math.cos(yaw0));
    const side = new THREE.Vector3(fwd.z, 0, -fwd.x);
    const dir = new THREE.Vector3();
    let best = { pos: s.pos, yaw: s.yaw, score: -Infinity };
    for (const d of [0, 1, 2, 3, 4]) {
      for (const l of [-0.5, 0, 0.5]) {
        const feet = new THREE.Vector3(...s.pos).addScaledVector(fwd, d).addScaledVector(side, l);
        const eye = feet.clone(); eye.y += EYE;
        // must stand on a floor at the spawn level, with 0.4 m clearance all round
        const g = P.raycast(eye, new THREE.Vector3(0, -1, 0), EYE + 0.3);
        if (!g || Math.abs(g.point.y - s.pos[1]) > 0.1) continue;
        let tight = false;
        for (let a = 0; a < 8 && !tight; a++) { dir.set(Math.cos(a * Math.PI / 4), 0, Math.sin(a * Math.PI / 4)); if (P.raycast(eye, dir, 0.4)) tight = true; }
        if (tight) continue;
        for (let dy = -80; dy <= 80; dy += 10) {
          let score = 0;
          for (let f = -35; f <= 35; f += 5) {
            const a = THREE.MathUtils.degToRad(s.yaw + dy + f);
            dir.set(-Math.sin(a), -0.04, -Math.cos(a)).normalize();
            const hit = P.raycast(eye, dir, 16);
            score += Math.min(hit ? hit.distance : 16, 16);
          }
          score = score / 15 - d * 0.15 - Math.abs(dy) * 0.004;
          if (score > best.score) best = { pos: feet.toArray(), yaw: s.yaw + dy, score };
        }
      }
    }
    return best;
  }

  pause() { if (this.state !== 'playing') return; this.state = 'paused'; this.paused = true; this.emit('pause', true); }
  resume() {
    if (this.state !== 'paused') return;
    this.state = 'playing'; this.paused = false; this.emit('pause', false);
    if (!this.harness) this.player.requestPointerLock();
  }
  _onPointerLock(locked) {
    if (this.harness) return;
    if (!locked && this.state === 'playing') this.pause();
    else if (locked && this.state === 'paused') { this.state = 'playing'; this.paused = false; this.emit('pause', false); }
  }

  // ---- main loop ----------------------------------------------------------------------------
  _loop(now) {
    this._raf = requestAnimationFrame(this._loop);
    const t = now / 1000;
    const dt = this._last ? Math.min(0.1, t - this._last) : 0;
    this._last = t;
    if (dt > 0) { this._frameTimes.push(now); while (this._frameTimes.length && now - this._frameTimes[0] > 1000) this._frameTimes.shift(); }
    if (this.state === 'loading') return;

    this._simulate(dt);
    for (const m of this.modules) if (m.update) { try { m.update(dt); } catch (err) { console.error('[game] module update', err); } }
    this.lighting.update(dt);
    this.emit('update', dt);
    this.renderFrame(dt);
  }

  _simulate(dt) {
    if (this.state === 'attract') { this._updateAttract(dt); return; }
    if (this.state === 'entering') { this._updateGlide(dt); return; }
    const live = this.state === 'playing' && !this.holdPhysics;
    if (!live) { this._acc = 0; this._resolveMoveWaiters(); return; }
    this._acc += dt;
    let steps = 0;
    while (this._acc >= STEP && steps < MAX_STEPS) {
      this._prevCam.copy(this.camera.position);
      this._step(STEP);
      this._curCam.copy(this.camera.position);
      this._acc -= STEP; steps++;
    }
    if (steps === MAX_STEPS) this._acc = 0;
    // Render interpolation between the last two simulated states (rotation is never interpolated:
    // mouse look is applied immediately for zero added latency).
    if (steps > 0) this.camera.position.lerpVectors(this._prevCam, this._curCam, this._acc / STEP);
  }

  _step(h) {
    const before = this.player.feet.clone();
    this.player.update(h);
    this.emit('step', h);
    // Footsteps (P08/P11 can take over by setting player.emitsFootsteps = true).
    if (!this.player.emitsFootsteps && this.player.onGround) {
      const moved = Math.hypot(this.player.feet.x - before.x, this.player.feet.z - before.z);
      this._stride += moved;
      const sprint = this.player.isDown?.('shift');
      if (this._stride >= (sprint ? STRIDE_SPRINT : STRIDE)) {
        this._stride = 0;
        this.emit('footstep', { surface: this.house.surfaceAt(this.player.feet), sprint: !!sprint });
      }
    }
    this._roomTimer -= h;
    if (this._roomTimer <= 0) {
      this._roomTimer = 0.2;
      const r = this.house.roomAt(this.player.feet);
      if ((r?.id ?? null) !== (this.currentRoom?.id ?? null)) {
        this.currentRoom = r;
        this.lighting.setInterior(!!r);
        this.emit('room-enter', r || { id: 'outside', name: 'Outside', level: 'ground' });
      }
    }
    this._resolveMoveWaiters();
  }

  _resolveMoveWaiters() {
    if (!this._moveWaiters.length) return;
    this._moveWaiters = this._moveWaiters.filter((w) => {
      if (this.player.simKeys.has(w.key)) return true;
      w.resolve(this.state_());
      return false;
    });
  }

  _updateAttract(dt) {
    const v = this._attract;
    if (!v) return;
    this._attractT += dt;
    const s = Math.sin(this._attractT * 0.12);
    const side = new THREE.Vector3(Math.cos(THREE.MathUtils.degToRad(v.yaw)), 0, -Math.sin(THREE.MathUtils.degToRad(v.yaw)));
    this.camera.position.set(v.pos[0], v.pos[1], v.pos[2]).addScaledVector(side, s * 1.6);
    this.camera.rotation.set(THREE.MathUtils.degToRad(v.pitch), THREE.MathUtils.degToRad(v.yaw - s * 4), 0, 'YXZ');
  }

  _snapCamera() {
    this.player.syncCamera();
    this._prevCam.copy(this.camera.position); this._curCam.copy(this.camera.position); this._acc = 0;
  }

  renderFrame(dt = 0) {
    const info = this.renderer.gl.info;
    info.reset();
    this.camera.updateMatrixWorld();
    this.postfx.render(dt);
    this._lastInfo = { calls: info.render.calls, triangles: info.render.triangles };
  }

  // ---- API used by the debug facade, HUD, menus, harness ------------------------------------
  teleport(x, y, z, yawDeg = 0, pitchDeg = 0) {
    if (this.state === 'attract' || this.state === 'loading' || this.state === 'entering') { this._glide = null; this.state = 'playing'; }
    this.player.teleport(x, y, z, yawDeg, pitchDeg);
    this.holdPhysics = true;
    this._snapCamera();
    const r = this.house.roomAt(this.player.feet);
    this.lighting.setInterior(!!r, true);   // teleports snap eye adaptation (deterministic shots)
    this.currentRoom = r; this.camera.updateMatrixWorld();
    this.lighting._assignPool(true);        // ... and the light pool
    if ((r?.id ?? null) !== (this.currentRoom?.id ?? null)) { this.currentRoom = r; this.emit('room-enter', r || { id: 'outside', name: 'Outside', level: 'ground' }); }
  }

  async setTimeOfDay(mode) { await this.lighting.setTimeOfDay(mode); return mode; }

  setQuality(tier) {
    const s = this.renderer.setQuality(tier);
    this.renderer.applyAnisotropy(this.scene);
    this.emit('quality', tier);
    return s.tier;
  }

  hideUI(hidden = true) {
    this.uiHidden = !!hidden;
    const ui = document.getElementById('ui');
    if (ui) ui.style.visibility = hidden ? 'hidden' : '';
    this.emit('hideui', this.uiHidden);
  }

  move(dir, seconds = 1) {
    const key = { w: 'w', a: 'a', s: 's', d: 'd', forward: 'w', back: 's', left: 'a', right: 'd', shift: 'shift', jump: 'jump' }[dir];
    if (!key) throw new Error(`move(dir): dir must be w|a|s|d (got "${dir}")`);
    if (this.state !== 'playing') { if (this.state === 'paused') this.paused = false; this.state = 'playing'; }
    this.holdPhysics = false;
    this.player.simKeys.set(key, seconds);
    return new Promise((resolve) => this._moveWaiters.push({ key, resolve }));
  }

  // Center-screen interaction. P09's Interact module handles it when present.
  interact() {
    if (this.interaction?.interact) return this.interaction.interact();
    this._raycaster.setFromCamera(new THREE.Vector2(0, 0), this.camera);
    this._raycaster.far = 3;
    const hit = this._raycaster.intersectObject(this.house.root, true).find((h) => h.object.visible);
    if (!hit) return null;
    let o = hit.object, target = null;
    while (o && !target) { if (/^(DOOR|LIGHT)_/.test(o.name)) target = o; o = o.parent; }
    const info = { target: target?.name || hit.object.name, type: target ? target.name.split('_')[0].toLowerCase() : 'none', distance: hit.distance };
    this.emit('interact', info);
    return info;
  }

  rooms() { return this.house.rooms().map((r) => ({ id: r.id, name: r.name, level: r.level, center: r.center })); }

  state_() {
    const p = this.player;
    return {
      state: this.state,
      eye: [p.feet.x, p.feet.y + p.eyeHeight, p.feet.z].map((v) => +v.toFixed(3)),
      feet: p.feet.toArray().map((v) => +v.toFixed(3)),
      yaw: +THREE.MathUtils.radToDeg(p.yaw).toFixed(1),
      pitch: +THREE.MathUtils.radToDeg(p.pitch).toFixed(1),
      onGround: p.onGround,
      room: this.house.roomAt(p.feet),
      tod: this.lighting.mode,
      quality: this.renderer.tier,
    };
  }

  stats() {
    const now = performance.now();
    const ft = this._frameTimes.filter((t) => now - t <= 1000);
    let fps = 0;
    if (ft.length > 1) fps = ((ft.length - 1) * 1000) / (ft[ft.length - 1] - ft[0]);
    const mem = this.renderer.gl.info.memory;
    const heap = performance.memory?.usedJSHeapSize;
    return {
      fps: Math.round(fps * 10) / 10,
      drawCalls: this._lastInfo.calls,
      triangles: this._lastInfo.triangles,
      textures: mem.textures,
      geometries: mem.geometries,
      programs: this.renderer.gl.info.programs?.length ?? 0,
      memoryMB: heap ? Math.round(heap / 1048576) : null,
      gpuTexMB: Math.round(estimateTextureBytes(this.scene) / 1048576),
      quality: this.renderer.tier,
      pixelRatio: this.renderer.pixelRatio,
      resolution: [this.renderer.width, this.renderer.height],
    };
  }

  // Synchronous GPU-bound benchmark: renders `frames` frames back-to-back, forcing the GPU to
  // finish each one (1px readPixels), and returns the average frame time. Independent of vsync.
  benchmark(frames = 120) {
    const gl = this.renderer.gl.getContext();
    const px = new Uint8Array(4);
    this.renderFrame(0); gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
    const t0 = performance.now();
    for (let i = 0; i < frames; i++) {
      this.renderFrame(1 / 60);
      gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
    }
    const ms = (performance.now() - t0) / frames;
    return { frames, avgMs: +ms.toFixed(2), fps: +(1000 / ms).toFixed(1), drawCalls: this._lastInfo.calls, triangles: this._lastInfo.triangles };
  }

  // Standard viewpoints: one "real-estate corner shot" per room + exterior views.
  views() {
    const rooms = this.house.rooms().filter((r) => r.main || r.rect).map((r) => this._roomView(r));
    const b = this.house.bounds;
    const c = b.getCenter(new THREE.Vector3());
    const eyeY = 1.6;
    const look = (id, name, px, pz, tx, ty, tz, y = eyeY) => {
      const dx = tx - px, dz = tz - pz, dy = ty - y;
      return { id, name, level: 'exterior', pos: [px, y, pz], yaw: +THREE.MathUtils.radToDeg(Math.atan2(-dx, -dz)).toFixed(1), pitch: +THREE.MathUtils.radToDeg(Math.atan2(dy, Math.hypot(dx, dz))).toFixed(1) };
    };
    const exteriors = [
      look('ext_front_east', 'Front (street, east)', b.max.x + 9, c.z + 6, c.x + 2, 2.4, c.z),
      look('ext_garden_sw', 'Garden & pool (south-west)', b.min.x - 11, b.max.z + 8, c.x - 1, 2.6, c.z),
      look('ext_south', 'South facade', c.x + 1, b.max.z + 13, c.x, 2.8, c.z),
      look('ext_north_west', 'North-west corner', b.min.x - 8, b.min.z - 9, c.x, 2.6, c.z),
    ];
    return { rooms, exteriors };
  }

  _roomView(r) {
    const [x, z, w, d] = r.main || r.rect;
    const floorY = r.center[1];
    const eyeY = floorY + 1.6;
    const cx = x + w / 2, cz = z + d / 2;
    // Normal rooms: the 4 corners (classic two-wall listing shot). Narrow rooms (WC, storage):
    // the middle of each edge looking across the long axis � a corner is too close to the walls.
    const narrow = Math.min(w, d) < 2.4;
    const inset = narrow ? 0.22 : Math.min(0.45, w / 4, d / 4);
    const corners = narrow
      ? [[cx, z + inset], [cx, z + d - inset], [x + inset, cz], [x + w - inset, cz]]
      : [[x + inset, z + inset], [x + w - inset, z + inset], [x + inset, z + d - inset], [x + w - inset, z + d - inset]];
    const dirV = new THREE.Vector3(), origin = new THREE.Vector3();
    let best = null;
    for (const [px, pz] of corners) {
      // Aim a bit past the centre toward the far corner so two walls + floor read.
      const tx = narrow ? cx + (cx - px) * 0.9 : cx + (cx - px) * 0.35, tz = narrow ? cz + (cz - pz) * 0.9 : cz + (cz - pz) * 0.35;
      origin.set(px, eyeY, pz);
      dirV.set(tx - px, 0, tz - pz);
      const want = dirV.length();
      const hit = this.physics.raycast(origin, dirV, 50);
      const clear = hit ? hit.distance : 50;
      // Reject corners buried in geometry (e.g. stair, cabinets): short clearance around the eye.
      let tight = 0;
      for (const a of [0, Math.PI / 2, Math.PI, -Math.PI / 2]) {
        const h2 = this.physics.raycast(origin, new THREE.Vector3(Math.cos(a), 0, Math.sin(a)), 0.25);
        if (h2) tight++;
      }
      const score = Math.min(clear, want * 2.5) + (narrow ? want : 0) - tight * 3 + (pz > cz ? 0.05 : 0);
      if (!best || score > best.score) {
        const yaw = THREE.MathUtils.radToDeg(Math.atan2(-(tx - px), -(tz - pz)));
        best = { score, pos: [px, eyeY, pz], yaw: +yaw.toFixed(1) };
      }
    }
    return { id: r.id, name: r.name, level: r.level, pos: best.pos.map((v) => +v.toFixed(3)), yaw: best.yaw, pitch: narrow ? -16 : -8 };
  }
}

function easeInOut(x) { x = Math.min(1, Math.max(0, x)); return x * x * (3 - 2 * x); }

function nextFrame() { return new Promise((r) => requestAnimationFrame(() => r())); }

function estimateTextureBytes(root) {
  const seen = new Set();
  let bytes = 0;
  root.traverse((o) => {
    const mats = o.material ? (Array.isArray(o.material) ? o.material : [o.material]) : [];
    for (const m of mats) for (const v of Object.values(m)) {
      if (!v?.isTexture || seen.has(v)) continue;
      seen.add(v);
      const img = v.image;
      const w = img?.width || 0, h = img?.height || 0;
      const bpp = v.type === THREE.HalfFloatType ? 8 : v.type === THREE.FloatType ? 16 : 4;
      bytes += w * h * bpp * (v.generateMipmaps !== false ? 1.33 : 1);
    }
  });
  return bytes;
}

// window.__game: the stable debug/harness API (SPEC.md). Everything returns plain data.
export function createDebugApi(game) {
  return {
    game,
    ready: game.ready.then(() => true),
    teleport: (x, y, z, yawDeg = 0, pitchDeg = 0) => { game.teleport(x, y, z, yawDeg, pitchDeg); return game.state_(); },
    setTimeOfDay: (mode) => game.setTimeOfDay(mode),
    setQuality: (tier) => game.setQuality(tier),
    hideUI: (hidden = true) => { game.hideUI(hidden); return game.uiHidden; },
    stats: () => game.stats(),
    rooms: () => game.rooms(),
    interact: () => game.interact(),
    move: (dir, seconds = 1) => game.move(dir, seconds),
    render: () => { game.camera.updateMatrixWorld(); game.renderFrame(0); return true; },
    // extras
    state: () => game.state_(),
    views: () => game.views(),
    benchmark: (frames) => game.benchmark(frames),
    enter: () => game.enter(),
    setToneMapping: (name) => game.postfx.setToneMapping(name),
    get scene() { return game.scene; },
    get camera() { return game.camera; },
    get THREE() { return THREE; },
  };
}
