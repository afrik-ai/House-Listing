// P03 round-2 review shots: HMR blocked (stable page), hard 60 s timeouts on every wait.
// usage: node reviews/p03/shots2.mjs <outdir> [name,name]
import { chromium } from 'playwright';
import fs from 'fs';
import { GPU_ARGS } from '../../scripts/shot.mjs';

const V = {
  street:        { pos: [26, 1.65, 2.5], yaw: 90, pitch: 5, tod: 'day' },
  garden_s:      { pos: [6.8, 1.6, 23.5], yaw: 3, pitch: 3.5, tod: 'day' },
  sw34:          { pos: [-9, 1.7, 19], yaw: -44, pitch: 6, tod: 'day' },
  south_upper:   { pos: [5.2, 1.65, 13.6], yaw: 0, pitch: 26, tod: 'day' },
  living_glass:  { pos: [5.0, 1.6, 13.0], yaw: 0, pitch: 0, tod: 'day' },
  far_glass:     { pos: [-4, 1.7, 26], yaw: -18, pitch: 4, tod: 'day' },
  pergola:       { pos: [-5.2, 1.6, 12.6], yaw: -28, pitch: 6, tod: 'day' },
  base_grime:    { pos: [2.2, 1.2, 12.3], yaw: 0, pitch: -18, tod: 'day' },
  entrance_2m:   { pos: [13.3, 1.6, 4.9], yaw: 66, pitch: -2, tod: 'day' },
  garage_2m:     { pos: [15.6, 1.6, 0.6], yaw: 68, pitch: -6, tod: 'day' },
  fascia:        { pos: [16, 1.7, 8.5], yaw: 110, pitch: 12, tod: 'day' },
  golden_sw:     { pos: [-9, 1.7, 19], yaw: -44, pitch: 6, tod: 'golden_hour' },
  golden_street: { pos: [26, 1.65, 2.5], yaw: 90, pitch: 5, tod: 'golden_hour' },
  night_street:  { pos: [26, 1.65, 2.5], yaw: 90, pitch: 5, tod: 'night' },
  night_south:   { pos: [6.8, 1.6, 20], yaw: 3, pitch: 5, tod: 'night' },
  night_entrance:{ pos: [16.5, 1.6, 5.5], yaw: 70, pitch: 4, tod: 'night' },
  night_lamp:    { pos: [9.0, 1.6, 13.0], yaw: 20, pitch: 8, tod: 'night' },
};
const out = process.argv[2] || 'reviews/p03/cur';
const only = process.argv[3] ? process.argv[3].split(',') : Object.keys(V);
const T = (p, ms = 60000, what = 'wait') => Promise.race([p, new Promise((_, r) => setTimeout(() => r(new Error(`timeout: ${what}`)), ms))]);
fs.mkdirSync(out, { recursive: true });

const browser = await chromium.launch({ headless: true, args: GPU_ARGS });
const page = await browser.newPage({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 1 });
const errors = [];
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
await page.route('**/@vite/client', (r) => r.fulfill({ status: 200, contentType: 'application/javascript', body: 'export {}; export function createHotContext(){return {accept(){},dispose(){},prune(){},on(){},off(){},send(){},invalidate(){},data:{}}}; export function updateStyle(){}; export function removeStyle(){}; export function injectQuery(u){return u}' }));
await page.goto('http://127.0.0.1:5173/house.html?id=villa-nova&harness=1&quality=high&tod=day', { waitUntil: 'domcontentloaded', timeout: 600000 });
await page.waitForFunction(() => !!window.__game, null, { timeout: 600000 });
await T(page.evaluate(() => window.__game.ready.then(() => true)), 900000, 'ready');
const order = only.sort((a, b) => (V[a].tod > V[b].tod ? 1 : V[a].tod < V[b].tod ? -1 : 0));
for (const k of order) {
  const s = V[k];
  try {
    await T(page.evaluate(async (s) => {
      const g = window.__game;
      g.hideUI(true);
      await g.setTimeOfDay(s.tod);
      g.teleport(s.pos[0], s.pos[1], s.pos[2], s.yaw, s.pitch);
      for (let i = 0; i < 6; i++) await new Promise((r) => requestAnimationFrame(r));
      g.render();
    }, s), 60000, k);
    await T(page.screenshot({ path: `${out}/${k}.png`, type: 'png' }), 60000, `shot ${k}`);
    const st = await T(page.evaluate(() => window.__game.stats()), 60000, 'stats');
    console.log(k, JSON.stringify({ fps: st.fps, calls: st.drawCalls }));
  } catch (e) { console.log('FAIL', k, e.message); }
}
const info = await T(page.evaluate(async () => {
  const g = window.__game; await g.setTimeOfDay('day'); g.teleport(-9, 1.7, 19, -44, 6);
  const b = await g.benchmark(120);
  return { bench: b, p03: g.game.plugins.get('20_exterior').stats() };
}), 120000, 'bench').catch((e) => ({ err: e.message }));
console.log('info', JSON.stringify(info));
console.log('errors', JSON.stringify(errors));
await browser.close();
