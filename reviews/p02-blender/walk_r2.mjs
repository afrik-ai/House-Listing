// P02 round-2 walkability check in the real game: node reviews/p02-blender/walk_r2.mjs
import { openGame } from '../../scripts/shot.mjs';
import fs from 'fs';
const meta = JSON.parse(fs.readFileSync('public/assets/houses/villa-nova/house.meta.json', 'utf8'));
const h = JSON.parse(fs.readFileSync('houses/villa-nova/house.json', 'utf8'));
let browser, page;
for (let t = 0; t < 4; t++) { try { ({ browser, page } = await openGame({ w: 1280, h: 720, quality: 'low', tod: 'day' })); break; } catch (e) { console.log('openGame retry', e.message.slice(0, 80)); try { await browser?.close(); } catch {} } }
const mid = (id) => { const s = meta.slides.find((q) => q.id === id); return (s.open_range[0] + s.open_range[1]) / 2; };
const tests = [];
for (let i = 1; i <= 3; i++) {
  tests.push([`stairs_up_${i}`, [9.9, 1.65, 3.1 + 0.05 * i], 90, 7, (r) => r.to[1] > 3.1 && r.toRoom === 'hall1']);
  tests.push([`stairs_down_${i}`, [4.3, 4.8, 3.1 + 0.05 * i], -90, 6, (r) => r.to[1] < 0.05 && r.to[0] > 8.5]);
}
tests.push(['living_to_terrace_W', [1.2, 1.65, mid('W_living_w')], 90, 3, (r) => r.to[0] < -0.4]);
tests.push(['terrace_to_living_W', [-1.2, 1.65, mid('W_living_w')], -90, 3, (r) => r.to[0] > 0.6]);
tests.push(['living_to_garden_S', [mid('W_living_s'), 1.65, 9.2], 180, 3, (r) => r.to[2] > 10.8]);
tests.push(['garden_to_living_S', [mid('W_living_s'), 1.51, 11.8], 0, 3, (r) => r.to[2] < 9.8]);
tests.push(['master_to_balcony', [1.2, 4.8, mid('W_master_w')], 90, 3, (r) => r.to[0] < -0.5 && r.to[1] > 3.1]);
tests.push(['deck_to_terrace', [-5.0, 1.51, 4.0], -90, 3, (r) => r.to[0] > -2.2 && r.to[1] > -0.01]);
tests.push(['lawn_to_terrace_N', [-1.3, 1.35, -2.0], 180, 2.5, (r) => r.to[2] > 0.3 && r.to[1] > -0.01]);
tests.push(['street_to_vestibule', [18.0, 1.40, 4.0], 90, 5, (r) => r.to[0] < 10.9 && r.to[1] > -0.01]);
tests.push(['vestibule_to_street', [10.3, 1.65, 4.0], -90, 4, (r) => r.to[0] > 14.3]);
// every hinged door, both ways (doors are exported open)
const rooms = [...h.ground_rooms.map((r) => ({ ...r, lvl: 0 })), ...h.first_rooms.map((r) => ({ ...r, lvl: 3.15 }))];
const rectsOf = (r) => r.rects || [r.rect];
const inRoom = (r, x, z) => rectsOf(r).some(([rx, rz, w, d]) => x > rx && x < rx + w && z > rz && z < rz + d);
for (const o of h.openings.filter((o) => o.type === 'door')) {
  const lvl = o.level === 'first' ? 3.15 : 0;
  const into = rooms.find((r) => r.id === o.swing_into && r.lvl === lvl);
  const [x, z] = o.at;
  let best = null;
  for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (into && inRoom(into, x + dx * 0.5, z + dz * 0.5)) best = [dx, dz];
  if (!best) continue;
  const [dx, dz] = best;
  const yaw = Math.atan2(-dx, -dz) * 180 / Math.PI;
  tests.push([o.id + '_in', [x - dx * 0.8, lvl + 1.65, z - dz * 0.8], yaw, 2.0, (r) => r.toRoom === o.swing_into]);
  tests.push([o.id + '_out', [x + dx * 0.7, lvl + 1.65, z + dz * 0.7], yaw + 180, 2.0, (r) => r.toRoom !== o.swing_into]);
}
const res = [];
let pass = 0;
for (const [name, eye, yaw, sec, okf] of tests) {
  let r;
  for (let a = 0; a < 4; a++) { try { r = await page.evaluate(async ({ eye, yaw, sec }) => {
    const g = window.__game; g.teleport(eye[0], eye[1], eye[2], yaw, 0);
    for (let i = 0; i < 4; i++) await new Promise((r) => requestAnimationFrame(r));
    const s0 = g.state(); await g.move('w', sec);
    for (let i = 0; i < 5; i++) await new Promise((r) => requestAnimationFrame(r));
    const s1 = g.state();
    return { fromRoom: s0.room?.id || 'out', from: s0.feet, to: s1.feet, toRoom: s1.room?.id || 'outside' };
  }, { eye, yaw, sec }); break; } catch (e) { console.log('retry (page reloaded)'); await page.waitForTimeout(3000); await page.waitForFunction(() => !!window.__game, null, { timeout: 180000 }); await page.evaluate(() => window.__game.ready); } }
  const ok = !!okf(r); pass += ok;
  res.push({ name, ok, ...r });
  console.log((ok ? 'PASS' : 'FAIL'), name.padEnd(24), r.fromRoom.padEnd(11), '->', r.toRoom.padEnd(11), 'to', r.to.map((v) => v.toFixed(2)).join(','));
}
console.log(`\n${pass}/${tests.length} passed`);
fs.writeFileSync('reviews/p02-blender/walk_r2.json', JSON.stringify(res, null, 1));
await browser.close();
