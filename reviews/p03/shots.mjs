// P03 exterior review shots. usage: node reviews/p03/shots.mjs <outdir> [name,name] [--quality high]
import { openGame, capture } from '../../scripts/shot.mjs';
const V = {
  street:        { pos: [26, 1.65, 2.5], yaw: 90, pitch: 5, tod: 'day' },
  street_ne:     { pos: [24, 1.7, -11], yaw: 128, pitch: 5, tod: 'day' },
  garden_s:      { view: 'ext_south', tod: 'day' },
  garden_sw:     { view: 'ext_garden_sw', tod: 'day' },
  sw34:          { pos: [-9, 1.7, 19], yaw: -44, pitch: 6, tod: 'day' },
  nw:            { view: 'ext_north_west', tod: 'day' },
  entrance_2m:   { pos: [13.3, 1.6, 4.9], yaw: 66, pitch: -2, tod: 'day' },
  window_2m:     { pos: [-2.0, 1.6, 2.4], yaw: -62, pitch: -2, tod: 'day' },
  garage_2m:     { pos: [15.6, 1.6, 0.6], yaw: 68, pitch: -6, tod: 'day' },
  kitchen_screen:{ pos: [10.0, 1.6, 12.6], yaw: 5, pitch: 3, tod: 'day' },
  upper_win:     { pos: [5.2, 3.0, 14.5], yaw: 0, pitch: 18, tod: 'day' },
  golden_sw:     { pos: [-9, 1.7, 19], yaw: -44, pitch: 6, tod: 'golden_hour' },
  golden_street: { pos: [26, 1.65, 2.5], yaw: 90, pitch: 5, tod: 'golden_hour' },
  night_street:  { pos: [26, 1.65, 2.5], yaw: 90, pitch: 5, tod: 'night' },
  night_sw:      { pos: [-9, 1.7, 19], yaw: -44, pitch: 6, tod: 'night' },
  night_entrance:{ pos: [16.5, 1.6, 5.5], yaw: 70, pitch: 4, tod: 'night' },
};
const args = process.argv.slice(2);
const out = args[0] || 'reviews/p03/cur';
const only = args[1] && !args[1].startsWith('--') ? args[1].split(',') : Object.keys(V);
const qi = args.indexOf('--quality');
const quality = qi >= 0 ? args[qi + 1] : 'high';
async function open() {
  for (let a = 0; ; a++) {
    try { return await openGame({ w: 1600, h: 900, quality, tod: 'day' }); }
    catch (e) { if (a > 5) throw e; console.log('reopen', String(e.message).slice(0, 60)); await new Promise((r) => setTimeout(r, 4000)); }
  }
}
let { browser, page, errors } = await open();
let views = await page.evaluate(() => window.__game.views());
const allErrors = [];
const all = [...views.rooms, ...views.exteriors];
// order by tod to minimise switches
only.sort((a, b) => (V[a].tod > V[b].tod ? 1 : V[a].tod < V[b].tod ? -1 : 0));
for (const k of only) {
  const s = V[k];
  let view = s.view ? all.find((v) => v.id === s.view) : s;
  let r;
  for (let attempt = 0; ; attempt++) {
    try { r = await capture(page, { view: { pos: view.pos, yaw: view.yaw, pitch: view.pitch }, tod: s.tod, out: `${out}/${k}.png` }); break; }
    catch (e) {
      if (attempt > 3) throw e;
      console.log('retry', k, String(e.message).slice(0, 80));
      allErrors.push(...errors); await browser.close().catch(() => {});
      ({ browser, page, errors } = await open());
    }
  }
  console.log(k, JSON.stringify({ fps: r.stats.fps, calls: r.stats.drawCalls, tris: r.stats.triangles }));
}
const bench = await page.evaluate(async () => { const g = window.__game; await g.setTimeOfDay('day'); g.teleport(-9, 1.7, 19, -44, 6); return g.benchmark(120); });
console.log('bench sw34', JSON.stringify(bench));
console.log('errors', JSON.stringify([...allErrors, ...errors]));
await browser.close();
