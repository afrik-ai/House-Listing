// P08 player path test. Boots the game once (harness mode), then drives the REAL Player/Physics at the
// fixed 120 Hz step directly (deterministic, independent of SwiftShader frame time) along every
// room-to-room path. Asserts: no stuck points, no penetration of colliders, stairs in reasonable time.
// Usage: node scripts/tests/player.mjs [--out reviews/P08-player.json]
import fs from 'node:fs';
import { openGame, hard, parseArgs } from '../shot.mjs';

const args = parseArgs(process.argv.slice(2), { out: 'reviews/P08-player.json' });
const G = 0, F = 3.15;
// Each path: list of [x, z] waypoints (feet targets), start level y; optional expect {room|minY|maxY} at end.
export const PATHS = [
  { name: 'hall->living->kitchen', y: G, wp: [[4.8, 3.7], [4.2, 6.0], [4.6, 9.3], [10.8, 8.3]], end: { room: 'kitchen' } },
  { name: 'kitchen->living->hall', y: G, wp: [[10.8, 8.3], [4.6, 9.3], [4.2, 6.0], [4.8, 3.7]], end: { room: 'hall' } },
  { name: 'stairs up', y: G, wp: [[10.3, 3.4], [9.3, 3.4, 'direct'], [4.1, 3.4, 'direct'], [4.0, 5.2]], end: { room: 'hall1', minY: F - 0.05 }, maxTime: 7, maxCamDy: 0.02 },
  { name: 'stairs down', y: F, wp: [[4.0, 5.2], [4.0, 3.4], [4.4, 3.4, 'direct'], [9.6, 3.4, 'direct'], [10.0, 3.6, 'direct']], end: { room: 'vestibule', maxY: 0.05 }, maxTime: 8, maxCamDy: 0.02 },
  { name: 'street->front door->vestibule', y: 0.2, wp: [[15.0, 4.0], [12.0, 3.9], [10.2, 3.6]], end: { room: 'vestibule' } },
  { name: 'vestibule->front door->street', y: G, wp: [[10.2, 3.6], [12.0, 3.9], [15.5, 4.0]], end: { room: null } },
  { name: 'living->terrace (west slider)', y: G, wp: [['gapW', 0, 5.2, 10.0], [-1.3, 'gap']], end: { room: null, box: [-2.6, -0.15, 0, 10.47], minY: -0.05 } },
  { name: 'terrace->garden (west steps)', y: G, wp: [[-2.4, 3.0], [-2.4, 0.9], [-5.0, 0.8]], end: { room: null, maxY: -0.1 } },
  { name: 'garden->terrace (north steps)', y: -0.3, wp: [[-1.5, -2.0], [-1.5, -0.5], [-2.4, 2.5]], end: { room: null, box: [-2.6, -0.15, 0, 10.47], minY: -0.05 } },
  { name: 'living->garden (south slider)', y: G, wp: [['gapS', 10.32, 0.6, 7.4], ['gap', 12.5]], end: { room: null } },
  { name: 'master->balcony (slider)', y: F, wp: [['gapW', 0, 5.2, 10.0], [-1.3, 'gap']], end: { room: null, box: [-2.6, 4.82, 0, 10.47], minY: 3.1 } },
];
// every door, both directions (orientation + sides found in-browser from roomAt)
export const DOORS = [['D_front', 11, 3.8, G], ['D_garage', 9.95, 2.6, G], ['D_office', 2.6, 2.6, G], ['D_wc', 1.5, 3.3, G], ['D_storage_n', 4.05, 2.6, G],
  ['D_boiler', 7.6, 1.4, G], ['D_cloak', 8.75, 4.52, G], ['D_storage_e', 10.25, 4.52, G], ['D_master', 3.37, 5.75, F], ['D_bed2', 4.2, 6.46, F],
  ['D_bed3', 7.8, 6.46, F], ['D_wardrobe_b', 4, 2.6, F], ['D_bath2', 9.7, 2.6, F], ['D_bath3', 10.2, 3.4, F], ['D_laundry', 9.2, 5.6, F],
  ['D_wardrobe_a', 1.6, 3.7, F], ['D_bath_master', 2.5, 2.6, F]];

// Runs in the page (also usable from a REPL: `(${runPaths})(args)`).
export function runPaths({ PATHS, DOORS, only }) {
    const game = window.__game.game, P = game.player, ph = game.physics, house = game.house, T = window.__game.THREE;
    game.state = 'playing'; game.holdPhysics = false;
    const H = 1 / 120;
    const steps = (sec, fn) => { for (let i = 0; i < Math.round(sec / H); i++) { game._step(H); fn?.(); } };
    const depth = () => { const q = P.feet.clone(); q.y += 0.01; ph._h = P.height; ph._resolve(q); return Math.hypot(q.x - P.feet.x, q.y - P.feet.y - 0.01, q.z - P.feet.z); };
    const place = (x, y, z) => {
      // nearest spot (spiral, 5 cm steps) where the capsule stands free on a floor near level y
      let best = null;
      for (let rr = 0; rr <= 12 && !best; rr++) for (let a = 0; a < Math.max(1, rr * 8) && !best; a++) {
        const px = x + Math.cos(a / Math.max(1, rr * 8) * 2 * Math.PI) * rr * 0.05, pz = z + Math.sin(a / Math.max(1, rr * 8) * 2 * Math.PI) * rr * 0.05;
        const hit = ph.raycast(new T.Vector3(px, y + 0.5, pz), new T.Vector3(0, -1, 0), 1.2);
        if (hit && Math.abs(hit.point.y - y) < 0.25 && !ph.overlaps(new T.Vector3(px, hit.point.y, pz), 1.75, 0.03)) best = [px, hit.point.y, pz];
      }
      best = best || [x, y, z];
      P.teleport(best[0], best[1] + P.eyeHeight + 0.02, best[2], 0, 0); game.holdPhysics = false;
      steps(0.4);
    };
    const room = () => house.roomAt(P.feet)?.id ?? null;
    // Find the open panel of a slider: scan along the wall line for a gap at knee+chest height.
    const gapOnWall = (axis, line, a, b, y) => {
      let best = null, run = 0, start = null;
      for (let t = a; t <= b; t += 0.05) {
        const o = axis === 'x' ? new T.Vector3(line + 0.8, y + 0.5, t) : new T.Vector3(t, y + 0.5, line - 0.8);
        const d = axis === 'x' ? new T.Vector3(-1, 0, 0) : new T.Vector3(0, 0, 1);
        const o2 = o.clone(); o2.y = y + 1.4;
        const free = !ph.raycast(o, d, 1.6) && !ph.raycast(o2, d, 1.6);
        if (free) { if (start === null) start = t; run = t - start; if (!best || run > best.len) best = { c: (start + t) / 2, len: run }; } else start = null;
      }
      return best && best.len > 0.62 ? best.c : null;
    };
    // A* over a 0.1 m occupancy grid (capsule overlap + floor continuity) so the walker takes a
    // feasible route around furniture; the test then checks the REAL controller can follow it.
    const route = (ax, az, bx, bz, y0) => {
      const R = 0.1, pad = 3;
      const x0 = Math.min(ax, bx) - pad, z0 = Math.min(az, bz) - pad;
      const W = Math.ceil((Math.abs(bx - ax) + 2 * pad) / R) + 1, D = Math.ceil((Math.abs(bz - az) + 2 * pad) / R) + 1;
      const fy = new Float32Array(W * D).fill(NaN), free = new Uint8Array(W * D), done = new Uint8Array(W * D);
      const r0 = ph.radius; ph.radius = r0 + 0.005;
      const cell = (i) => {
        if (done[i]) return free[i]; done[i] = 1;
        const x = x0 + (i % W) * R, z = z0 + Math.floor(i / W) * R;
        const h = ph.raycast(new T.Vector3(x, y0 + 0.5, z), new T.Vector3(0, -1, 0), 1.3);
        if (!h || h.point.y < y0 - 0.7) return 0;
        fy[i] = h.point.y;
        free[i] = ph.overlaps(new T.Vector3(x, h.point.y, z), 1.75, 0.03) ? 0 : 1;
        return free[i];
      };
      const idx = (x, z) => Math.round((z - z0) / R) * W + Math.round((x - x0) / R);
      const nearestFree = (x, z) => { const i0 = idx(x, z); if (cell(i0)) return i0; for (let rr = 1; rr < 11; rr++) for (let dz = -rr; dz <= rr; dz++) for (let dx = -rr; dx <= rr; dx++) { const i = i0 + dz * W + dx; if (i >= 0 && i < W * D && cell(i)) return i; } return i0; };
      const s0 = nearestFree(ax, az), g0 = nearestFree(bx, bz);
      const gx = g0 % W, gz = Math.floor(g0 / W);
      const gS = new Float32Array(W * D).fill(Infinity), from = new Int32Array(W * D).fill(-1);
      const open = [[0, s0]]; gS[s0] = 0; let found = false, it = 0;
      const push = (f, i) => { open.push([f, i]); let k = open.length - 1; while (k > 0) { const pk = (k - 1) >> 1; if (open[pk][0] <= open[k][0]) break; [open[pk], open[k]] = [open[k], open[pk]]; k = pk; } };
      const pop = () => { const top = open[0], last = open.pop(); if (open.length) { open[0] = last; let k = 0; for (;;) { const l = 2 * k + 1, r = l + 1; let m = k; if (l < open.length && open[l][0] < open[m][0]) m = l; if (r < open.length && open[r][0] < open[m][0]) m = r; if (m === k) break; [open[m], open[k]] = [open[k], open[m]]; k = m; } } return top; };
      while (open.length && it++ < 200000) {
        const [, i] = pop();
        if (i === g0) { found = true; break; }
        const cx = i % W, cz = Math.floor(i / W);
        for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) {
          if (!dx && !dz) continue;
          const nx = cx + dx, nz = cz + dz; if (nx < 0 || nz < 0 || nx >= W || nz >= D) continue;
          const j = nz * W + nx; if (!cell(j)) continue;
          if (dx && dz && (!cell(cz * W + nx) || !cell(nz * W + cx))) continue;
          if (Math.abs(fy[j] - fy[i]) > 0.2) continue;
          const c = gS[i] + (dx && dz ? 1.414 : 1);
          if (c < gS[j]) { gS[j] = c; from[j] = i; push(c + Math.hypot(nx - gx, nz - gz), j); }
        }
      }
      ph.radius = r0;
      if (!found) { if (window.__dbgGrid) { const rows = []; for (let z = 0; z < D; z++) { let row = ''; for (let x = 0; x < W; x++) { const i = z * W + x; row += i === s0 ? 'S' : i === g0 ? 'G' : !done[i] ? '?' : free[i] ? (fy[i] > y0 + 0.1 ? '^' : fy[i] < y0 - 0.1 ? 'v' : '.') : '#'; } rows.push(row); } window.__dbgGrid.push({ x0, z0, rows }); } return null; }
      const pts = []; for (let i = g0; i !== -1; i = from[i]) pts.push([x0 + (i % W) * R, z0 + Math.floor(i / W) * R]);
      pts.reverse();
      const out = []; for (let k = 4; k < pts.length; k += 4) out.push(pts[k]);   // every 0.4 m
      out.push(pts[pts.length - 1]);   // the free cell nearest the goal
      return out;
    };
    const walk = (name, wps, opts = {}) => {
      const r = { name, ok: true, issues: [], time: 0, maxDepth: 0 };
      let lastProg = 0, lastPos = P.feet.clone();
      const goTo = (x, z) => {
        let t = 0;
        for (;;) {
          const dx = x - P.feet.x, dz = z - P.feet.z, dist = Math.hypot(dx, dz);
          if (dist < 0.2) break;
          P.look(Math.atan2(-dx, -dz), 0);
          P.simKeys.set('w', 1); if (opts.sprint) P.simKeys.set('shift', 1);
          const cy0 = game.camera.position.y; game._step(H); t += H; r.time += H;
          r.maxCamDy = Math.max(r.maxCamDy || 0, Math.abs(game.camera.position.y - cy0));
          const d = depth(); if (d > r.maxDepth) r.maxDepth = d;
          if (d > 0.03) { r.ok = false; r.issues.push(`penetration ${d.toFixed(3)} at ${P.feet.toArray().map((v) => v.toFixed(2))}`); break; }
          if (r.time - lastProg > 1.5) {
            if (P.feet.distanceTo(lastPos) < 0.1) { r.ok = false; r.issues.push(`stuck at ${P.feet.toArray().map((v) => v.toFixed(2))} heading to ${x},${z}`); break; }
            lastProg = r.time; lastPos.copy(P.feet);
          }
          if (t > 30) { r.ok = false; r.issues.push(`timeout to ${x},${z}`); break; }
        }
      };
      for (const w of wps) {
        if (w[2] === 'direct') goTo(w[0], w[1]);
        else {
          const rt = route(P.feet.x, P.feet.z, w[0], w[1], P.feet.y);
          if (!rt) { r.ok = false; r.issues.push(`no grid route to ${w[0]},${w[1]}`); }
          else for (const [x, z] of rt) { goTo(x, z); if (!r.ok) break; }
        }
        if (!r.ok) break;
      }
      P.simKeys.clear(); steps(0.5);
      r.end = { feet: P.feet.toArray().map((v) => +v.toFixed(2)), room: room() };
      return r;
    };
    const out = [];
    const want = (n) => !only || n.includes(only);
    for (const p of PATHS) {
      if (!want(p.name)) continue;
      const wps = []; let gap = null;
      for (const w of p.wp) {
        if (w[0] === 'gapW') { gap = gapOnWall('x', w[1], w[2], w[3], p.y); wps.push([0.55, gap], [0.45, gap, 'direct'], [-0.45, gap, 'direct']); continue; }
        if (w[0] === 'gapS') { gap = gapOnWall('z', w[1], w[2], w[3], p.y); wps.push([gap, 9.75], [gap, 9.9, 'direct'], [gap, 10.8, 'direct']); continue; }
        if (w[0] === 'gap') { wps.push([gap, w[1]]); continue; }
        wps.push(w.map((v) => (v === 'gap' ? gap : v)));
      }
      if (wps.some((w) => w.some((v) => v === null || v === undefined))) { out.push({ name: p.name, ok: false, issues: ['no open slider panel found'] }); continue; }
      place(wps[0][0], p.y, wps[0][1]);
      const r = walk(p.name, wps.slice(1), {});
      const e = p.end || {};
      if ('room' in e && r.end.room !== e.room) { r.ok = false; r.issues.push(`ended in ${r.end.room}, expected ${e.room}`); }
      if (e.box && !(r.end.feet[0] >= e.box[0] && r.end.feet[0] <= e.box[2] && r.end.feet[2] >= e.box[1] && r.end.feet[2] <= e.box[3])) { r.ok = false; r.issues.push('ended outside target area'); }
      if (e.minY !== undefined && r.end.feet[1] < e.minY) { r.ok = false; r.issues.push(`ended low y=${r.end.feet[1]}`); }
      if (e.maxY !== undefined && r.end.feet[1] > e.maxY) { r.ok = false; r.issues.push(`ended high y=${r.end.feet[1]}`); }
      if (p.maxCamDy && r.maxCamDy > p.maxCamDy) { r.ok = false; r.issues.push(`camera jumped ${(r.maxCamDy * 100).toFixed(1)} cm in one tick`); }
      if (p.maxTime && r.time > p.maxTime) { r.ok = false; r.issues.push(`slow: ${r.time.toFixed(1)} s`); }
      r.time = +r.time.toFixed(2); r.maxDepth = +r.maxDepth.toFixed(3); r.maxCamDy = +(r.maxCamDy || 0).toFixed(4);
      out.push(r);
    }
    // doors: find the two sides via roomAt, walk across both ways
    for (const [id, x, z, y] of DOORS) {
      if (!want(id)) continue;
      const probe = (px, pz) => house.roomAt([px, y + 0.05, pz])?.id ?? 'outside';
      let a, b;
      for (const [ax, az] of [[1, 0], [0, 1]]) {
        const side = (k) => [-0.25, 0, 0.25].map((l) => probe(x + k * ax * 0.7 + az * l, z + k * az * 0.7 + ax * l));
        const s1 = side(-1), s2 = side(1);
        if (new Set(s1).size === 1 && new Set(s2).size === 1 && s1[0] !== s2[0]) { a = [x - ax * 0.7, z - az * 0.7]; b = [x + ax * 0.7, z + az * 0.7]; break; }
      }
      if (!a) { out.push({ name: id, ok: false, issues: ['could not find door sides'] }); continue; }
      for (const [s, e, dirn] of [[a, b, 'fwd'], [b, a, 'back']]) {
        place(s[0], y, s[1]);
        const r = walk(`${id} ${dirn}`, [e]);  // A* routes through the doorway
        if (Math.hypot(r.end.feet[0] - e[0], r.end.feet[2] - e[1]) > 0.8) { r.ok = false; if (!r.issues.length) r.issues.push('did not arrive'); }
        r.time = +r.time.toFixed(2); r.maxDepth = +r.maxDepth.toFixed(3);
        out.push(r);
      }
    }
    // feel checks: accel/decel ramps, sprint FOV kick, crouch eye height, no bunny hop, respawn
    const feel = {};
    place(14.2, 0, -1); P.look(-Math.PI / 2, 0);
    P.simKeys.set('w', 0.1); steps(0.1); feel.speedAfter0_1s = +P.speed.toFixed(2);
    P.simKeys.set('w', 1); steps(1); feel.walkSpeed = +P.speed.toFixed(2);
    P.simKeys.clear(); steps(0.1); feel.speed0_1sAfterRelease = +P.speed.toFixed(2); steps(0.5); feel.stopped = P.speed === 0;
    place(14.2, 0, -1); P.look(-Math.PI / 2, 0); P.simKeys.set('w', 1.5); P.simKeys.set('shift', 1.5); steps(0.25); feel.sprintFov0_25s = +(P._fov - P.settings.fov).toFixed(2); steps(0.75); feel.sprintSpeed = +P.speed.toFixed(2); feel.sprintFov = +P._fov.toFixed(1); P.simKeys.clear(); steps(1);
    P.simKeys.set('crouch', 1); steps(1); feel.crouchEye = +P.eyeHeight.toFixed(2); P.simKeys.clear(); steps(1); feel.standEye = +P.eyeHeight.toFixed(2);
    let jumps = 0, air = false; place(14.2, 0, -1); P.setJumpEnabled(true); P.simKeys.set('jump', 2); steps(2, () => { if (P.velocity.y > 2 && !air) { jumps++; air = true; } if (P.onGround) air = false; }); feel.jumpsWhileHolding2s = jumps; P.setJumpEnabled(false);
    P.simKeys.clear(); P.teleport(30, -40, 30, 0, 0); game.holdPhysics = false; steps(0.3); feel.respawnedY = +P.feet.y.toFixed(2);
    let steps_ = []; const off = game.on?.('footstep', (e) => steps_.push(e));
    place(14.2, 0, -1); P.look(-Math.PI / 2, 0); P.simKeys.set('w', 2); steps(2); feel.footsteps = steps_.length; feel.footstep = steps_[0];
    // closed door blocks (dynamic collider follows the leaf), fixed glass blocks, stair descent is smooth
    const dOff = house.doors.find((d) => /office/.test(d.id));
    if (dOff) {
      const q0 = dOff.node.quaternion.clone(); dOff.node.rotation.set(0, 0, 0); dOff.node.updateMatrixWorld(true);
      place(2.6, 0, 3.4); P.look(0, 0); P.simKeys.set('w', 1.5); steps(1.5); P.simKeys.clear();
      feel.closedDoorBlocks = P.feet.z > 2.6; feel.closedDoorZ = +P.feet.z.toFixed(2);
      dOff.node.quaternion.copy(q0); dOff.node.updateMatrixWorld(true);
      place(2.6, 0, 3.4); P.look(0, 0); P.simKeys.set('w', 1.5); steps(1.5); P.simKeys.clear();
      feel.openDoorPasses = P.feet.z < 2.4;
    }
    place(0.6, 0, 9.6); P.look(Math.PI / 2, 0); P.simKeys.set('w', 1.5); steps(1.5); P.simKeys.clear(); feel.fixedGlassBlocks = P.feet.x > 0; feel.glassX = +P.feet.x.toFixed(2);
    P.setHeadBob(false); place(4.2, 3.15, 3.16); P.look(-Math.PI / 2, 0);
    let prev = null, maxJump = 0, ups = 0; P.simKeys.set('w', 2.2);
    steps(2.2, () => { const y = game.camera.position.y; if (prev !== null) { maxJump = Math.max(maxJump, Math.abs(y - prev)); if (y - prev > 0.002) ups++; } prev = y; });
    P.simKeys.clear(); P.setHeadBob(true);
    feel.stairDescentMaxCamStep = +maxJump.toFixed(4); feel.stairDescentCamUpTicks = ups; feel.stairDescentEndY = +P.feet.y.toFixed(2);
    // footstep surface must match the visible floor (critic r1: terrace/balcony said 'grass')
    feel.defaultFov = P.settings.fov; feel.roll = P.settings.roll; feel.jumpDefault = P.settings.jump;
    const SURF = [['terrace', -1.3, 0, 5, 'tile'], ['balcony', -1.3, 3.15, 5.16, 'tile'], ['garden lawn', -6, -0.3, 6, 'grass'], ['garden path', -5, -0.3, 0.8, 'stone'],
      ['driveway', 16, 0, -1, 'stone'], ['pool deck', 1, -0.14, 12.5, 'tile'], ['living oak', 4, 0, 7, 'wood'], ['hall tile', 4.8, 0, 3.7, 'tile'], ['stair', 7, 1.4, 3.16, 'wood']];
    feel.surfaces = {}; feel.surfacesOk = true;
    for (const [n, x, y, z, want] of SURF) {
      const hit = ph.raycast(new T.Vector3(x, y + 0.4, z), new T.Vector3(0, -1, 0), 1.2);
      P.feet.set(x, hit ? hit.point.y : y, z);
      const si = P.surfaceInfo(); feel.surfaces[n] = `${si.surface} (${si.type})`;
      if (si.surface !== want) { feel.surfacesOk = false; feel.surfaces[n] += ` != ${want}`; }
    }
    // stop time after release, head-bob peak-to-peak at walk
    place(14.2, 0, -1); P.look(-Math.PI / 2, 0); P.simKeys.set('w', 1.2); steps(1.2); P.simKeys.clear();
    let ticks = 0; while (P.speed > 0 && ticks < 240) { game._step(H); ticks++; } feel.stopTime = +(ticks * H).toFixed(3);
    place(14.2, 0, -1); P.look(-Math.PI / 2, 0); P.simKeys.set('w', 2); steps(0.8);
    let lo = 9, hi = -9; steps(1.0, () => { const o = game.camera.position.y - P.feet.y - P.eyeHeight - P._stepOffset; lo = Math.min(lo, o); hi = Math.max(hi, o); }); P.simKeys.clear();
    feel.bobP2Pmm = +((hi - lo) * 1000).toFixed(1);
    feel.ok = feel.stopTime < 0.1 && feel.bobP2Pmm < 8 && feel.bobP2Pmm > 1 && feel.surfacesOk && feel.sprintFov0_25s >= 4 && feel.walkSpeed > 2.3 && feel.sprintSpeed > 3.8 && feel.jumpsWhileHolding2s <= 1 && feel.closedDoorBlocks !== false && feel.fixedGlassBlocks && feel.stairDescentMaxCamStep < 0.04 && feel.stairDescentCamUpTicks === 0 && feel.footsteps > 0;
    return { paths: out, feel };
}

if (process.argv[1]?.endsWith('player.mjs')) {
const { browser, page } = await openGame({ w: 640, h: 360, quality: 'low', quiet: true });
let results;
try {
  results = await hard(page.evaluate(runPaths, { PATHS, DOORS, only: args.only || null }), 600000, 'player test');
} finally { await browser.close(); }
const fails = results.paths.filter((r) => !r.ok);
for (const r of results.paths) console.log(`${r.ok ? 'PASS' : 'FAIL'}  ${r.name.padEnd(34)} t=${r.time ?? '-'}s depth=${r.maxDepth ?? '-'} end=${JSON.stringify(r.end ?? '')} ${r.issues.join('; ')}`);
console.log('feel', JSON.stringify(results.feel));
console.log(`${results.paths.length - fails.length}/${results.paths.length} paths passed`);
fs.writeFileSync(args.out, JSON.stringify(results, null, 1));
process.exit(fails.length || !results.feel.ok ? 1 : 0);
}
