// Automatic quality gates for one house, in the real running game (one browser boot).
//   node scripts/check.mjs [--id villa-nova] [--base URL] [--only boot,walk,perf,views] [--strict] [--out DIR]
//   npm run check -- --id villa-nova
//
// Gates (FAIL = exit code 1; builders must not report done and nobody commits while a FAIL stands):
//   boot   console errors, failed plugins, and any asset request that 404s or fails (catches a fresh clone
//          missing generated textures, which otherwise makes a whole plugin silently disappear)
//   spawn  the player does not start inside geometry and does not start facing a wall
//   walk   generated from house.json: every door and the front door both ways, every sliding door in and
//          out, every stair up and down. A failed walk names the object in the way (e.g. a furniture item).
//   perf   triangles / draw calls / GPU frame time on standard views vs houses/<id>/budget.json.
//          WARN by default (FAIL with --strict). Frame time is only meaningful on a real GPU.
//   views  screenshots of standard views + contact sheet; each view is compared with the previous run
//          and big changes are listed so a reviewer can look at exactly what moved.
// Output: <out>/<timestamp>/ (images, report.json, REPORT.md) and <out>/latest.json. Default out: reviews/check/<id>.
import fs from 'fs';
import path from 'path';
import { openGame, parseArgs, capture } from './shot.mjs';

const a = parseArgs(process.argv.slice(2), { id: 'villa-nova' });
const id = a.id;
const only = a.only ? new Set(String(a.only).split(',')) : null;
const want = (g) => !only || only.has(g);
const OUT_ROOT = a.out || `reviews/check/${id}`;
const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
const OUT = path.join(OUT_ROOT, stamp);
fs.mkdirSync(OUT, { recursive: true });

const house = JSON.parse(fs.readFileSync(`houses/${id}/house.json`, 'utf8'));
const metaPath = `public/assets/houses/${id}/house.meta.json`;
if (!fs.existsSync(metaPath)) {
  console.error(`FAIL: ${metaPath} is missing. Build the house first: node pipeline/build.mjs ${id} (see docs/NEW_HOUSE.md).`);
  process.exit(1);
}
const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
const budgetPath = `houses/${id}/budget.json`;
const budget = { trianglesMax: 1500000, drawCallsMax: 900, frameMsMax: 16.7, ...(fs.existsSync(budgetPath) ? JSON.parse(fs.readFileSync(budgetPath, 'utf8')) : {}) };

const results = [];   // {gate, name, status: PASS|WARN|FAIL, detail}
const add = (gate, name, status, detail = '') => { results.push({ gate, name, status, detail }); console.log(`${status.padEnd(4)} ${gate.padEnd(5)} ${name}${detail ? ' - ' + detail : ''}`); };

// ---------- static checks (no browser) ----------
if (want('boot')) {
  if (!fs.existsSync('public/assets/manifest.json')) add('boot', 'assets present', 'FAIL', 'public/assets/manifest.json missing: rebuild assets (docs/NEW_HOUSE.md, "Assets on a fresh clone")');
  const furnPath = `houses/${id}/furniture.json`;
  if (fs.existsSync(furnPath) && fs.existsSync('public/assets/manifest.json')) {
    const man = JSON.parse(fs.readFileSync('public/assets/manifest.json', 'utf8'));
    const f = JSON.parse(fs.readFileSync(furnPath, 'utf8'));
    const missing = new Set();
    for (const room of Object.values(f.rooms || {})) for (const it of room.items || []) {
      if (it.model && !man.models?.[it.model] && !fs.existsSync(`public/assets/models/${it.model}.glb`)) missing.add(it.model);
    }
    add('boot', 'furniture models exist', missing.size ? 'FAIL' : 'PASS', missing.size ? [...missing].join(', ') : '');
  }
}

// ---------- boot the game once ----------
const G = await openGame({ base: a.base, id, w: 1280, h: 720, quality: 'high', tod: 'day', quiet: true });
const { page } = G;

if (want('boot')) {
  const errs = G.errors.filter((e) => !/X3595|gradient instruction/.test(e));
  const plugins = errs.filter((e) => /plugin .* failed/i.test(e));
  add('boot', 'no failed plugins', plugins.length ? 'FAIL' : 'PASS', plugins.map((e) => e.split('\n')[0]).join(' | '));
  add('boot', 'no console errors', errs.length ? 'FAIL' : 'PASS', errs.length ? `${errs.length}: ${errs[0].split('\n')[0].slice(0, 200)}` : '');
  const bad = await page.evaluate(() => performance.getEntriesByType('resource')
    .filter((r) => r.responseStatus >= 400 || (r.responseStatus === 0 && r.transferSize === 0 && r.decodedBodySize === 0 && !/^(data|blob):/.test(r.name) && r.initiatorType !== 'other'))
    .map((r) => `${r.responseStatus || 'failed'} ${new URL(r.name).pathname}`));
  const real = bad.filter((b) => !/^failed \/@vite|favicon/.test(b));
  add('boot', 'no missing asset requests', real.length ? 'FAIL' : 'PASS', real.slice(0, 8).join(', '));
  add('boot', 'load time', 'PASS', `${(G.loadMs / 1000).toFixed(1)} s to ready`);
}

// ---------- page-side helpers ----------
await page.evaluate(() => {
  const g = window.__game, T = g.THREE;
  // Walk from an EYE position facing yaw for `sec` seconds; returns start/end room + feet.
  window.__check = {
    async walk(eye, yaw, sec) {
      g.teleport(eye[0], eye[1], eye[2], yaw, 0);
      for (let i = 0; i < 4; i++) await new Promise((r) => requestAnimationFrame(r));
      const s0 = g.state();
      await g.move('w', sec);
      for (let i = 0; i < 4; i++) await new Promise((r) => requestAnimationFrame(r));
      const s1 = g.state();
      return { fromRoom: s0.room?.id || 'outside', toRoom: s1.room?.id || 'outside', from: s0.feet, to: s1.feet };
    },
    // How far the player capsule gets pushed when placed with its feet at p (0 = free space).
    push(p) {
      const q = new T.Vector3(p[0], p[1] + 0.02, p[2]), q0 = q.clone();
      g.game.physics._resolve(q);
      return Math.hypot(q.x - q0.x, q.z - q0.z);
    },
    // Floor height under x,z near level y (feet), or y if none.
    floor(x, y, z) {
      const hit = g.game.physics.raycast(new T.Vector3(x, y + 1.2, z), new T.Vector3(0, -1, 0), 2.5);
      return hit ? hit.point.y : y;
    },
    // Name what surrounds a stuck player: nearest surfaces (visible or not) in 8 directions at knee/hip height.
    blocker(p, yaw) {
      const rc = new T.Raycaster(); rc.far = 0.8;
      const name = (o) => { const n = []; for (let x = o; x && n.length < 3; x = x.parent) if (x.name) n.push(x.name); return (n.join(' < ') || o.type) + (o.visible ? '' : ' [invisible]'); };
      const found = [];
      for (let k = 0; k < 8; k++) {
        const a = yaw * Math.PI / 180 + k * Math.PI / 4;
        const dir = new T.Vector3(-Math.sin(a), 0, -Math.cos(a));
        for (const h of [0.25, 0.9]) {
          rc.set(new T.Vector3(p[0], p[1] + h, p[2]), dir);
          const hit = rc.intersectObject(g.scene, true).find((q) => q.object.isMesh && !/^(SURF|CEIL)_/.test(q.object.name));
          if (hit && hit.distance < 0.45) { found.push([hit.distance, `${name(hit.object)} ${k === 0 ? 'ahead' : 'at ' + k * 45 + ' deg'} ${hit.distance.toFixed(2)} m`]); break; }
        }
      }
      found.sort((x, y) => x[0] - y[0]);
      return found.length ? [...new Set(found.map((f) => f[1]))].slice(0, 3).join('; ') : 'nothing within 0.45 m (a floor edge or step is stopping the player)';
    },
  };
});

// ---------- spawn ----------
if (want('walk')) {
  const s = await page.evaluate(() => {
    const g = window.__game, game = g.game, T = g.THREE, sp = game.house.spawn;
    g.teleport(sp.pos[0], sp.pos[1] + 1.65, sp.pos[2], sp.yaw, 0);
    const p = new T.Vector3(...sp.pos), q = p.clone(); q.y += 0.02;
    const q0 = q.clone(); game.physics._resolve(q);
    const yaw = sp.yaw * Math.PI / 180;
    const hit = game.physics.raycast(new T.Vector3(p.x, p.y + 1.65, p.z), new T.Vector3(-Math.sin(yaw), 0, -Math.cos(yaw)), 30);
    return { pushed: Math.hypot(q.x - q0.x, q.z - q0.z), view: hit ? hit.distance : 99 };
  });
  add('walk', 'spawn not inside geometry', s.pushed > 0.03 ? 'FAIL' : 'PASS', s.pushed > 0.03 ? `pushed ${s.pushed.toFixed(2)} m` : '');
  add('walk', 'spawn view is open', s.view < 1.5 ? 'FAIL' : 'PASS', `first surface ${s.view.toFixed(1)} m ahead`);
}

// ---------- walk tests generated from house.json ----------
if (want('walk')) {
  const lvlY = Object.fromEntries(house.levels.map((l) => [l.id, l.elevation]));
  const rooms = house.levels.flatMap((l) => (house[`${l.id}_rooms`] || []).map((r) => ({ ...r, level: l.id })));
  const rectsOf = (r) => r.rects || [r.rect];
  const inRoom = (r, x, z) => rectsOf(r).some(([rx, rz, w, d]) => x > rx && x < rx + w && z > rz && z < rz + d);
  const roomAt = (level, x, z) => rooms.find((r) => r.level === level && inRoom(r, x, z));
  const yawOf = (dx, dz) => Math.atan2(-dx, -dz) * 180 / Math.PI;
  const tests = [];

  // A crossing test: start on one side of an opening at a FREE spot (furniture may fill the first
  // candidate), walk through, pass when the feet end at least 0.4 m past the opening's line.
  const crossing = (name, [x, z], y, [dx, dz]) => ({ name, cross: { x, z, y, dx, dz } });

  // Doors and the front door: find which side is the room it swings into, then cross both ways.
  for (const o of house.openings.filter((o) => o.type === 'door' || o.type === 'front_door')) {
    const lv = o.level || 'ground', y = lvlY[lv] ?? 0, [x, z] = o.at;
    let dirIn = null;
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const r = roomAt(lv, x + dx * 0.5, z + dz * 0.5);
      if (r && r.id === o.swing_into) dirIn = [dx, dz];
    }
    if (!dirIn) { add('walk', `${o.id} (layout)`, 'WARN', `cannot tell which side is ${o.swing_into}; skipped`); continue; }
    tests.push(crossing(`${o.id} into ${o.swing_into}`, [x, z], y, dirIn));
    tests.push(crossing(`${o.id} out of ${o.swing_into}`, [x, z], y, [-dirIn[0], -dirIn[1]]));
  }

  // Sliding doors: cross through the middle of the open panel, both ways.
  for (const s of meta.slides || []) {
    const o = house.openings.find((q) => q.id === s.id); if (!o) continue;
    const lv = o.level || 'ground', y = lvlY[lv] ?? 0;
    const mid = (s.open_range[0] + s.open_range[1]) / 2;
    const alongZ = Math.abs(s.axis[2]) > 0.5;
    const [cx, cz] = alongZ ? [o.at[0], mid] : [mid, o.at[1]];
    const n = alongZ ? [1, 0] : [0, 1];
    const inside = roomAt(lv, cx + n[0] * 0.6, cz + n[1] * 0.6) ? n : [-n[0], -n[1]];
    const roomIn = roomAt(lv, cx + inside[0] * 0.6, cz + inside[1] * 0.6)?.id;
    tests.push(crossing(`${s.id} out of ${roomIn}`, [cx, cz], y, [-inside[0], -inside[1]]));
    tests.push(crossing(`${s.id} into ${roomIn}`, [cx, cz], y, inside));
  }

  // Stairs: full flight up and down along the centre line.
  for (const st of house.stairs || []) {
    const y0 = lvlY[st.level || 'ground'] ?? 0, run = st.risers * st.tread, top = y0 + st.risers * st.riser;
    const c = [st.first_riser[0] + st.side[0] * st.width / 2, st.first_riser[1] + st.side[1] * st.width / 2];
    const [dx, dz] = st.dir;
    const sec = (run + 1.6) / 1.7;
    tests.push({ name: `stair ${st.id} up`, eye: [c[0] - dx * 0.7, y0 + 1.65, c[1] - dz * 0.7], yaw: yawOf(dx, dz), sec, ok: (r) => r.to[1] > top - 0.1 });
    tests.push({ name: `stair ${st.id} down`, eye: [c[0] + dx * (run + 0.7), top + 1.65, c[1] + dz * (run + 0.7)], yaw: yawOf(-dx, -dz), sec, ok: (r) => r.to[1] < y0 + 0.1 });
  }

  for (const t of tests) {
    let r, note = '';
    try {
      if (t.cross) {
        const { x, z, y, dx, dz } = t.cross;
        // First free starting spot 0.6-1.3 m before the opening (a small room may be full of furniture there).
        let d0 = null, fy = y;
        for (const d of [0.9, 0.75, 0.6, 1.1, 1.3]) {
          const sx = x - dx * d, sz = z - dz * d;
          const f = await page.evaluate(([sx, y, sz]) => window.__check.floor(sx, y, sz), [sx, y, sz]);
          const push = await page.evaluate((p) => window.__check.push(p), [sx, f, sz]);
          if (push < 0.01) { d0 = d; fy = f; break; }
        }
        if (d0 === null) { add('walk', t.name, 'FAIL', `no free spot to stand within 1.3 m before the opening at ${x},${z}: furniture or walls fill the approach`); continue; }
        if (d0 !== 0.9) note = ` (started ${d0} m out: nearer spots are blocked)`;
        const sec = (d0 + 1.0) / 1.7 + 0.35;
        r = await page.evaluate(({ eye, yaw, sec }) => window.__check.walk(eye, yaw, sec), { eye: [x - dx * d0, fy + 1.65, z - dz * d0], yaw: yawOf(dx, dz), sec });
        const past = (r.to[0] - x) * dx + (r.to[2] - z) * dz;
        r.ok = past >= 0.4;
        r.yaw = yawOf(dx, dz);
        if (!r.ok) r.why = `got ${past.toFixed(2)} m past the opening (needs 0.40)`;
      } else {
        r = await page.evaluate(({ eye, yaw, sec }) => window.__check.walk(eye, yaw, sec), { eye: t.eye, yaw: t.yaw, sec: t.sec });
        r.ok = t.ok(r); r.yaw = t.yaw;
      }
    } catch (e) { add('walk', t.name, 'FAIL', `page error: ${String(e.message).split('\n')[0]}`); continue; }
    if (r.ok) { add('walk', t.name, note ? 'WARN' : 'PASS', note.trim()); continue; }
    const who = await page.evaluate(({ to, yaw }) => window.__check.blocker(to, yaw), { to: r.to, yaw: r.yaw });
    add('walk', t.name, 'FAIL', `stopped in ${r.toRoom} at ${r.to.map((v) => v.toFixed(2)).join(',')}${r.why ? ', ' + r.why : ''}; around the player: ${who}`);
  }
}

// ---------- perf ----------
if (want('perf')) {
  const views = await page.evaluate(() => window.__game.views());
  const pick = [...views.rooms.filter((v) => /living|kitchen|master/.test(v.id)), ...views.exteriors.filter((v) => /garden|front/.test(v.id))];
  const sev = a.strict ? 'FAIL' : 'WARN';
  for (const v of pick) {
    const m = await page.evaluate(async (v) => {
      const g = window.__game; g.teleport(v.pos[0], v.pos[1], v.pos[2], v.yaw, v.pitch || 0);
      for (let i = 0; i < 6; i++) await new Promise((r) => requestAnimationFrame(r));
      const s = g.stats(); const b = await g.benchmark(60);
      return { tris: s.triangles, calls: s.drawCalls, ms: b.avgMs, gpu: g.game.renderer.gl.getContext().getParameter(0x1F01) };
    }, v);
    const over = [];
    if (m.tris > budget.trianglesMax) over.push(`triangles ${(m.tris / 1e6).toFixed(2)}M > ${(budget.trianglesMax / 1e6).toFixed(2)}M`);
    if (m.calls > budget.drawCallsMax) over.push(`draw calls ${m.calls} > ${budget.drawCallsMax}`);
    const realGpu = !/swiftshader|llvmpipe/i.test(G.gpu || '');
    if (realGpu && m.ms > budget.frameMsMax) over.push(`frame ${m.ms.toFixed(1)} ms > ${budget.frameMsMax} ms`);
    add('perf', v.id, over.length ? sev : 'PASS', `${(m.tris / 1e6).toFixed(2)}M tris, ${m.calls} calls, ${m.ms.toFixed(1)} ms/frame${realGpu ? '' : ' (software GPU: time not judged)'}${over.length ? ' | over: ' + over.join('; ') : ''}`);
  }
}

// ---------- views + change detection ----------
if (want('views')) {
  const views = await page.evaluate(() => window.__game.views());
  const pick = [...views.rooms.filter((v) => /^(living|kitchen|hall|vestibule|master|bath_master)$/.test(v.id)), ...views.exteriors].slice(0, 10);
  let sharp = null; try { sharp = (await import('sharp')).default; } catch { /* optional */ }
  const prevRun = fs.existsSync(path.join(OUT_ROOT, 'latest.json')) ? JSON.parse(fs.readFileSync(path.join(OUT_ROOT, 'latest.json'), 'utf8')).dir : null;
  const changed = [];
  for (const v of pick) {
    const file = path.join(OUT, `${v.id}.png`);
    await capture(page, { view: v, tod: 'day', out: file });
    const prev = prevRun && path.join(prevRun, `${v.id}.png`);
    if (sharp && prev && fs.existsSync(prev)) {
      const load = (f) => sharp(f).resize(160, 90).greyscale().raw().toBuffer();
      const [x, y] = await Promise.all([load(file), load(prev)]);
      let d = 0; for (let i = 0; i < x.length; i++) d += Math.abs(x[i] - y[i]);
      const pct = d / x.length / 2.55;
      if (pct > 4) changed.push(`${v.id} ${pct.toFixed(1)}%`);
    }
  }
  const sheet = `<title>Check ${id} ${stamp}</title><body style="background:#111;color:#ddd;font:13px system-ui;margin:16px">
<h3>${id} - ${stamp}</h3><div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(380px,1fr));gap:10px">
${pick.map((v) => `<figure style="margin:0"><img src="${v.id}.png" style="width:100%"><figcaption>${v.id}</figcaption></figure>`).join('\n')}</div>`;
  fs.writeFileSync(path.join(OUT, 'index.html'), sheet);
  add('views', `${pick.length} standard views captured`, 'PASS', path.join(OUT, 'index.html'));
  if (prevRun) add('views', 'changed since last check', changed.length ? 'WARN' : 'PASS', changed.length ? changed.join(', ') + ' (look at these before approving)' : 'no big changes');
}

await G.browser.close();

// ---------- report ----------
const count = (s) => results.filter((r) => r.status === s).length;
const verdict = count('FAIL') ? 'FAIL' : 'PASS';
const report = { id, stamp, verdict, pass: count('PASS'), warn: count('WARN'), fail: count('FAIL'), budget, gpu: G.gpu, results, dir: OUT };
fs.writeFileSync(path.join(OUT, 'report.json'), JSON.stringify(report, null, 1));
fs.writeFileSync(path.join(OUT_ROOT, 'latest.json'), JSON.stringify(report, null, 1));
const md = [`# Check: ${id} (${stamp})`, '', `**${verdict}**: ${report.pass} pass, ${report.warn} warn, ${report.fail} fail. GPU: ${G.gpu || 'unknown'}`, '',
  '| Gate | Check | Result | Detail |', '|---|---|---|---|',
  ...results.map((r) => `| ${r.gate} | ${r.name} | ${r.status} | ${String(r.detail).replace(/\|/g, '/')} |`)].join('\n');
fs.writeFileSync(path.join(OUT, 'REPORT.md'), md + '\n');
console.log(`\n${verdict}: ${report.pass} pass, ${report.warn} warn, ${report.fail} fail -> ${path.join(OUT, 'REPORT.md')}`);
process.exit(verdict === 'FAIL' ? 1 : 0);
