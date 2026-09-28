import * as THREE from 'three';
import { floorSurfaceAt } from './player/surfaces.js';

// P08 first-person controller. constructor(game) + update(dt) are the Game.js contract; update runs at
// the fixed 120 Hz simulation step, so __game.move(dir, s) gives the same path at any frame rate.
// Convention: yaw 0 looks toward -Z (north), yaw 90 toward -X (west); pitch > 0 looks up.
// Settings setters (for P10's menu) are documented in docs/CONTRACTS.md (P08 section).
const WALK = 2.6, SPRINT = 4.2, CROUCH = 1.3;          // m/s (HF2: ~2.7 walk, sprint ~1.6x)
const ACCEL = 11, DECEL = 45, AIR = 1.5;                // exponential rates (1/s): ~0.2 s to full speed, ~0.2 s to stop
const EYE = 1.65, EYE_CROUCH = 1.05;
const H_STAND = 1.75, H_CROUCH = 1.15;
const JUMP = 4.6, JUMP_COOLDOWN = 0.45;
const SENS_BASE = 0.0021;
const FOV_DEFAULT = 75;                                 // vertical degrees (HF2 reads 75-80)
const SPRINT_FOV_KICK = 5;                              // degrees added while sprinting, eased in ~0.25 s
const STRIDE = 0.74, STRIDE_SPRINT = 0.98, STRIDE_CROUCH = 0.55;
const KEYS = {
  KeyW: 'w', KeyS: 's', KeyA: 'a', KeyD: 'd', ArrowUp: 'w', ArrowDown: 's', ArrowLeft: 'a', ArrowRight: 'd',
  ShiftLeft: 'shift', ShiftRight: 'shift', Space: 'jump', KeyC: 'crouch', ControlLeft: 'crouch',
};
const clamp = THREE.MathUtils.clamp;

export class Player {
  constructor(game) {
    this.game = game;
    this.camera = game.camera;
    this.physics = game.physics;
    this.feet = new THREE.Vector3(0, 0, 0);
    this.velocity = new THREE.Vector3();
    this.yaw = 0; this.pitch = 0;
    this._tYaw = 0; this._tPitch = 0;          // mouse-look targets (smoothing)
    this.eyeHeight = EYE;
    this.height = H_STAND;
    this.crouched = false;
    this.onGround = false;
    this.locked = false;
    this.enabled = true;
    this.emitsFootsteps = true;                 // Game.js' fallback footsteps are off: we emit them
    this.keys = new Set();
    this.simKeys = new Map();                   // key -> seconds remaining (for __game.move)
    this.settings = { sensitivity: 1, fov: FOV_DEFAULT, smoothing: 0, headBob: true, roll: false, invertY: false, jump: false };
    this.camera.fov = FOV_DEFAULT; this.camera.updateProjectionMatrix();
    this._sprintK = 0;
    this._fov = this.settings.fov;
    this._bobPhase = 0; this._bobAmp = 0; this._roll = 0;
    this._stepOffset = 0;                       // camera-only easing of stair steps / landings
    this._stride = 0;
    this._jumpCd = 0; this._jumpLatch = false; this._airTime = 0;
    this._safe = new THREE.Vector3(); this._safeT = 0; this._hasSafe = false;
    this._dynReady = false;
    this._move = new THREE.Vector3();
    this._delta = new THREE.Vector3();
    this._out = {};
    this._bind();
    // Every caller of house.surfaceAt gets the visible-floor answer (P04's landscape wrapper and the
    // rect lookup become the fallback). Installed once plugins are in (ready).
    game.on?.('ready', () => this._installSurfaceAt());
  }

  _installSurfaceAt() {
    const house = this.game.house;
    if (!house || house._p08Surface) return;
    const rect = house.surfaceAt.bind(house);
    house._p08Surface = true;
    house.surfaceAtRect = rect;
    const v = new THREE.Vector3();
    house.surfaceAt = (pos) => {
      v.set(pos.x ?? pos[0], pos.y ?? pos[1], pos.z ?? pos[2]);
      return floorSurfaceAt(this.game, v, rect).type;
    };
  }

  // ---- settings (P10 menu) ----------------------------------------------------------------------
  setSensitivity(mult) { this.settings.sensitivity = clamp(+mult || 1, 0.1, 5); this._emitSettings(); }
  setFov(deg) { this.settings.fov = clamp(+deg || FOV_DEFAULT, 45, 110); this._emitSettings(); }
  setMouseSmoothing(v) { this.settings.smoothing = clamp(+v || 0, 0, 0.95); this._emitSettings(); }
  setHeadBob(on) { this.settings.headBob = !!on; this._emitSettings(); }
  setStrafeRoll(on) { this.settings.roll = !!on; this._emitSettings(); }
  setInvertY(on) { this.settings.invertY = !!on; this._emitSettings(); }
  setJumpEnabled(on) { this.settings.jump = !!on; this._emitSettings(); }
  getSettings() { return { ...this.settings }; }
  _emitSettings() { this.game.emit?.('player-settings', this.getSettings()); }

  _bind() {
    const canvas = this.game.renderer.canvas;
    window.addEventListener('keydown', (e) => { const k = KEYS[e.code]; if (k) { this.keys.add(k); if (!e.repeat && k !== 'shift') e.preventDefault(); } });
    window.addEventListener('keyup', (e) => { const k = KEYS[e.code]; if (k) this.keys.delete(k); });
    window.addEventListener('blur', () => this.keys.clear());
    document.addEventListener('pointerlockchange', () => {
      this.locked = document.pointerLockElement === canvas;
      this.game.emit('pointerlock', this.locked);
    });
    document.addEventListener('mousemove', (e) => {
      if (!this.locked || !this.enabled) return;
      // Ignore the huge spurious deltas some browsers send right after locking.
      if (Math.abs(e.movementX) > 400 || Math.abs(e.movementY) > 400) return;
      const s = SENS_BASE * this.settings.sensitivity;
      this._tYaw -= e.movementX * s;
      this._tPitch = clamp(this._tPitch - e.movementY * s * (this.settings.invertY ? -1 : 1), -Math.PI / 2 + 0.01, Math.PI / 2 - 0.01);
      if (this.settings.smoothing <= 0) this._applyLook(this._tYaw, this._tPitch);
    });
  }

  requestPointerLock() {
    const canvas = this.game.renderer.canvas;
    try { canvas.requestPointerLock?.()?.catch?.(() => {}); } catch { /* not available in this context */ }
  }

  _resetMotion() {
    this.velocity.set(0, 0, 0);
    this._stepOffset = 0; this._bobAmp = 0; this._roll = 0; this._stride = 0; this._airTime = 0;
    this._fov = this.settings.fov; this._sprintK = 0;
  }

  spawn(pos, yawDeg = 0) {
    this.feet.set(pos[0], pos[1], pos[2]);
    this._resetMotion();
    this.look(THREE.MathUtils.degToRad(yawDeg), 0);
    this._safe.copy(this.feet); this._hasSafe = true;
  }

  // Place the EYE at x,y,z looking (yawDeg, pitchDeg). Always stands up.
  teleport(x, y, z, yawDeg = 0, pitchDeg = 0) {
    this.crouched = false; this.height = H_STAND; this.eyeHeight = EYE;
    this.feet.set(x, y - this.eyeHeight, z);
    this._resetMotion();
    this.look(THREE.MathUtils.degToRad(yawDeg), THREE.MathUtils.degToRad(pitchDeg));
  }

  look(yaw, pitch) {
    this._tYaw = yaw;
    this._tPitch = clamp(pitch, -Math.PI / 2 + 0.01, Math.PI / 2 - 0.01);
    this._applyLook(this._tYaw, this._tPitch);
  }

  _applyLook(yaw, pitch) {
    this.yaw = yaw;
    this.pitch = clamp(pitch, -Math.PI / 2 + 0.01, Math.PI / 2 - 0.01);
    this.syncCamera();
  }

  get eye() { return new THREE.Vector3(this.feet.x, this.feet.y + this.eyeHeight, this.feet.z); }
  get forward() { return new THREE.Vector3(-Math.sin(this.yaw), 0, -Math.cos(this.yaw)); }
  get right() { return new THREE.Vector3(Math.cos(this.yaw), 0, -Math.sin(this.yaw)); }
  get speed() { return Math.hypot(this.velocity.x, this.velocity.z); }
  get sprinting() { return this.isDown('shift') && !this.crouched && this.speed > WALK + 0.2; }

  syncCamera() {
    const bobOn = this.settings.headBob;
    const a = bobOn ? this._bobAmp : 0;
    const bobY = Math.abs(Math.sin(this._bobPhase)) * 0.005 * a - 0.0025 * a;   // ~5 mm p-p at walk
    const bobX = Math.cos(this._bobPhase) * 0.0025 * a;
    const r = this.right;
    this.camera.position.set(
      this.feet.x + r.x * bobX,
      this.feet.y + this.eyeHeight + this._stepOffset + bobY,
      this.feet.z + r.z * bobX,
    );
    this.camera.rotation.set(this.pitch, this.yaw, bobOn && this.settings.roll ? this._roll : 0, 'YXZ');
    if (Math.abs(this.camera.fov - this._fov) > 0.01) { this.camera.fov = this._fov; this.camera.updateProjectionMatrix(); }
  }

  isDown(k) { return this.keys.has(k) || this.simKeys.has(k); }

  // Snapshot for tests / HUD.
  info() {
    return { speed: +this.speed.toFixed(3), crouched: this.crouched, sprinting: this.sprinting, onGround: this.onGround, eyeHeight: +this.eyeHeight.toFixed(3), fov: +this._fov.toFixed(2), settings: this.getSettings() };
  }

  update(dt) {
    for (const [k, t] of this.simKeys) { if (t - dt <= 0) this.simKeys.delete(k); else this.simKeys.set(k, t - dt); }
    if (!this._dynReady && this.game.house?.doorColliders) {
      this.physics.setDynamic?.(this.game.house.doorColliders); this._dynReady = true;
    }
    if (!this.enabled) return;

    // Mouse smoothing (frame-rate independent).
    if (this.settings.smoothing > 0) {
      const kk = 1 - Math.pow(this.settings.smoothing, dt * 60);   // smoothing = fraction of lag kept per 1/60 s
      this._applyLook(this.yaw + (this._tYaw - this.yaw) * kk, this.pitch + (this._tPitch - this.pitch) * kk);
    }

    // ---- crouch (hold), with ceiling check before standing up
    const wantCrouch = this.isDown('crouch');
    if (wantCrouch && !this.crouched) { this.crouched = true; this.height = H_CROUCH; }
    else if (!wantCrouch && this.crouched && !this.physics.overlaps?.(this.feet, H_STAND)) { this.crouched = false; this.height = H_STAND; }
    const eyeT = this.crouched ? EYE_CROUCH : EYE;
    this.eyeHeight += (eyeT - this.eyeHeight) * (1 - Math.exp(-10 * dt));

    // ---- horizontal intent
    const mv = this._move.set(0, 0, 0);
    if (this.isDown('w')) mv.add(this.forward);
    if (this.isDown('s')) mv.sub(this.forward);
    if (this.isDown('d')) mv.add(this.right);
    if (this.isDown('a')) mv.sub(this.right);
    const moving = mv.lengthSq() > 0;
    const back = this.isDown('s') && !this.isDown('w');
    const maxSpeed = this.crouched ? CROUCH : (this.isDown('shift') && !back ? SPRINT : WALK);
    if (moving) mv.normalize().multiplyScalar(maxSpeed);

    const rate = this.onGround ? (moving ? ACCEL : DECEL) : AIR;
    const k = 1 - Math.exp(-rate * dt);
    this.velocity.x += (mv.x - this.velocity.x) * k;
    this.velocity.z += (mv.z - this.velocity.z) * k;
    if (!moving && this.onGround && Math.hypot(this.velocity.x, this.velocity.z) < 0.12) { this.velocity.x = 0; this.velocity.z = 0; }

    // ---- jump: needs a fresh press, ground contact and a cooldown after landing (no bunny-hopping)
    this._jumpCd = Math.max(0, this._jumpCd - dt);
    const jumpKey = this.isDown('jump');
    let jumped = false;
    if (jumpKey && !this._jumpLatch && this.settings.jump && this.onGround && this._jumpCd <= 0 && !this.crouched) {
      this.velocity.y = JUMP; jumped = true;
      this.velocity.x *= 0.9; this.velocity.z *= 0.9;
    }
    this._jumpLatch = jumpKey;
    this.velocity.y += this.physics.gravity * dt;
    if (this.velocity.y < -25) this.velocity.y = -25;

    // ---- collide & slide (step-up in Physics; step-down snap only while grounded and not rising)
    const wasGround = this.onGround && !jumped;
    const y0 = this.feet.y, fallV = this.velocity.y;
    this._delta.copy(this.velocity).multiplyScalar(dt);
    const snap = wasGround && this.velocity.y <= 0 ? this.physics.stepHeight + 0.05 : 0.08;
    const r = this.physics.moveCapsule(this.feet, this._delta, this._out, { height: this.height, snap });
    const px = this.feet.x, pz = this.feet.z;
    this.feet.copy(r.pos);
    this.onGround = r.onGround && !jumped && this.velocity.y <= 0.5;
    // Wall sliding: drop the velocity component we could not realise (so we don't keep pushing into walls).
    if (dt > 0 && r.blocked) {
      const ax = (this.feet.x - px) / dt, az = (this.feet.z - pz) / dt;
      if (Math.abs(ax) < Math.abs(this.velocity.x) - 0.05) this.velocity.x = ax;
      if (Math.abs(az) < Math.abs(this.velocity.z) - 0.05) this.velocity.z = az;
    }
    const dy = this.feet.y - y0;
    if (this.onGround) {
      if (this.velocity.y < 0) this.velocity.y = 0;
      // Camera easing: stair steps (both ways) glide instead of popping.
      if ((wasGround || dy < 0) && Math.abs(dy) > 0.03) this._stepOffset = clamp(this._stepOffset - dy, -0.3, 0.3);
      if (!wasGround && this._airTime > 0.25) {
        const impact = Math.min(0.08, -fallV * 0.012);
        this._stepOffset = clamp(this._stepOffset - impact, -0.3, 0.3);
        this._jumpCd = JUMP_COOLDOWN;
        this.velocity.x *= 0.7; this.velocity.z *= 0.7;       // landing costs speed: no bunny-hop gain
        this.game.emit('land', { surface: this._surface(), speed: -fallV });
      }
      this._airTime = 0;
    } else {
      if (this.velocity.y > 0 && dy < this.velocity.y * dt * 0.5) this.velocity.y = 0;   // bonked a ceiling
      this._airTime += dt;
    }
    // Release the offset exponentially, but never let the camera's vertical move this tick exceed
    // max(1.8 cm, the natural ramp move) -- no pops at stair ends, no extra speed mid-ramp.
    {
      const snapped = Math.abs(dy) > 0.03 && this.onGround;
      const base = snapped ? 0 : dy;                              // camera move before releasing the offset
      const want = this._stepOffset * (1 - Math.exp(-12 * dt));
      const cap = Math.max(0.018 * dt * 120, Math.abs(base));
      this._stepOffset -= clamp(want, base - cap, base + cap);    // camera move = base - release
    }

    // ---- head bob / sway / FOV
    const sp = this.speed;
    const ampT = this.onGround ? clamp(sp / WALK, 0, 1.4) : 0;
    this._bobAmp += (ampT - this._bobAmp) * (1 - Math.exp(-8 * dt));
    const stride = this.crouched ? STRIDE_CROUCH : (sp > WALK + 0.3 ? STRIDE_SPRINT : STRIDE);
    const hdist = sp * dt;
    if (this.onGround) this._bobPhase += (hdist / stride) * Math.PI;
    const strafe = this.velocity.x * this.right.x + this.velocity.z * this.right.z;
    this._roll += (-strafe * 0.004 - this._roll) * (1 - Math.exp(-6 * dt));
    const sprintT = moving && !back && !this.crouched && this.isDown('shift') && sp > WALK * 0.8 ? 1 : 0;
    this._sprintK += (sprintT - this._sprintK) * (1 - Math.exp(-12 * dt));      // ~95 % in 0.25 s
    this._fov = this.settings.fov + SPRINT_FOV_KICK * this._sprintK;

    // ---- footsteps
    if (this.onGround && sp > 0.4) {
      this._stride += hdist;
      if (this._stride >= stride) {
        this._stride -= stride;
        const { type, surface } = floorSurfaceAt(this.game, this.feet);
        this.game.emit('footstep', { surface, type, speed: +sp.toFixed(2), sprint: sp > WALK + 0.3, crouch: this.crouched });
      }
    } else if (!moving) this._stride = Math.min(this._stride, stride * 0.5);

    // ---- safety: remember safe ground; respawn if we ever fall out of the world
    this._safeT -= dt;
    if (this.onGround && this._safeT <= 0) { this._safeT = 0.5; this._safe.copy(this.feet); this._hasSafe = true; }
    const floorY = (this.game.house?.gradeY ?? 0) - 8;
    if (this.feet.y < floorY || !Number.isFinite(this.feet.y)) this._respawn();
    this.syncCamera();
  }

  _surface() { return floorSurfaceAt(this.game, this.feet).surface; }
  surfaceInfo() { return floorSurfaceAt(this.game, this.feet); }

  _respawn() {
    const s = this.game.house?.spawn;
    const p = this._hasSafe && this._safe.y > (this.game.house?.gradeY ?? 0) - 8 ? this._safe.toArray() : (s?.pos ?? [0, 0, 0]);
    this.feet.set(p[0], p[1] + 0.05, p[2]);
    this._resetMotion();
    this.game.emit('respawn', { pos: p });
  }
}
