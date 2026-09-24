import * as THREE from 'three';

// Initial first-person controller (P08 deepens this; constructor(game) + update(dt) stay).
// Convention: yaw 0 looks toward -Z (north), yaw 90 toward -X (west); pitch > 0 looks up.
const WALK = 1.9, SPRINT = 3.4, EYE = 1.65, ACCEL = 14, JUMP = 5.2;
const SENS = 0.0021;
const KEYS = { KeyW: 'w', KeyS: 's', KeyA: 'a', KeyD: 'd', ArrowUp: 'w', ArrowDown: 's', ArrowLeft: 'a', ArrowRight: 'd', ShiftLeft: 'shift', ShiftRight: 'shift', Space: 'jump' };

export class Player {
  constructor(game) {
    this.game = game;
    this.camera = game.camera;
    this.physics = game.physics;
    this.feet = new THREE.Vector3(0, 0, 0);
    this.velocity = new THREE.Vector3();
    this.yaw = 0; this.pitch = 0;
    this.eyeHeight = EYE;
    this.onGround = false;
    this.locked = false;
    this.enabled = true;
    this.keys = new Set();
    this.simKeys = new Map();       // key -> seconds remaining (for __game.move)
    this._move = new THREE.Vector3();
    this._delta = new THREE.Vector3();
    this._out = {};
    this._bind();
  }

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
      this.look(this.yaw - e.movementX * SENS, this.pitch - e.movementY * SENS);
    });
  }

  requestPointerLock() {
    const canvas = this.game.renderer.canvas;
    try { canvas.requestPointerLock?.(); } catch { /* not available in this context */ }
  }

  spawn(pos, yawDeg = 0) {
    this.feet.set(pos[0], pos[1], pos[2]);
    this.velocity.set(0, 0, 0);
    this.look(THREE.MathUtils.degToRad(yawDeg), 0);
    this.syncCamera();
  }

  // Place the EYE at x,y,z looking (yawDeg, pitchDeg).
  teleport(x, y, z, yawDeg = 0, pitchDeg = 0) {
    this.feet.set(x, y - this.eyeHeight, z);
    this.velocity.set(0, 0, 0);
    this.look(THREE.MathUtils.degToRad(yawDeg), THREE.MathUtils.degToRad(pitchDeg));
    this.syncCamera();
  }

  look(yaw, pitch) {
    this.yaw = yaw;
    this.pitch = THREE.MathUtils.clamp(pitch, -Math.PI / 2 + 0.01, Math.PI / 2 - 0.01);
    this.syncCamera();
  }

  get eye() { return new THREE.Vector3(this.feet.x, this.feet.y + this.eyeHeight, this.feet.z); }
  get forward() { return new THREE.Vector3(-Math.sin(this.yaw), 0, -Math.cos(this.yaw)); }
  get right() { return new THREE.Vector3(Math.cos(this.yaw), 0, -Math.sin(this.yaw)); }

  syncCamera() {
    this.camera.position.set(this.feet.x, this.feet.y + this.eyeHeight, this.feet.z);
    this.camera.rotation.set(this.pitch, this.yaw, 0, 'YXZ');
  }

  isDown(k) { return this.keys.has(k) || this.simKeys.has(k); }

  update(dt) {
    for (const [k, t] of this.simKeys) { if (t - dt <= 0) this.simKeys.delete(k); else this.simKeys.set(k, t - dt); }
    if (!this.enabled) return;

    const mv = this._move.set(0, 0, 0);
    if (this.isDown('w')) mv.add(this.forward);
    if (this.isDown('s')) mv.sub(this.forward);
    if (this.isDown('d')) mv.add(this.right);
    if (this.isDown('a')) mv.sub(this.right);
    const speed = this.isDown('shift') ? SPRINT : WALK;
    if (mv.lengthSq() > 0) mv.normalize().multiplyScalar(speed);

    // Smooth horizontal acceleration; vertical is gravity-driven.
    const k = 1 - Math.exp(-ACCEL * dt);
    this.velocity.x += (mv.x - this.velocity.x) * k;
    this.velocity.z += (mv.z - this.velocity.z) * k;
    if (this.onGround && this.isDown('jump')) { this.velocity.y = JUMP; this.onGround = false; }
    this.velocity.y += this.physics.gravity * dt;
    if (this.velocity.y < -25) this.velocity.y = -25;

    this._delta.copy(this.velocity).multiplyScalar(dt);
    const r = this.physics.moveCapsule(this.feet, this._delta, this._out);
    this.feet.copy(r.pos);
    this.onGround = r.onGround;
    if (this.onGround && this.velocity.y < 0) this.velocity.y = 0;
    if (this.feet.y < -30) this.spawn(this.game.house?.spawn.pos ?? [0, 0, 0], this.game.house?.spawn.yaw ?? 0);
    this.syncCamera();
  }
}
