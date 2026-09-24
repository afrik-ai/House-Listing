import { openGame } from '../../scripts/shot.mjs';
let browser, page;
for (let t = 0; t < 4; t++) { try { ({ browser, page } = await openGame({ w: 800, h: 450, quality: 'low', tod: 'day' })); break; } catch (e) { console.log('openGame retry', e.message.slice(0, 80)); try { await browser?.close(); } catch {} } }
const out = await page.evaluate(() => {
  const g = window.__game.game, T = g.scene.constructor; const ph = g.physics;
  const V = (x, y, z) => ({ x, y, z });
  const res = [];
  const R = (o, d, far) => { const h = ph.raycast(new o.constructor(o.x, o.y, o.z), new d.constructor(d.x, d.y, d.z).normalize(), far); return h ? { d: +h.distance.toFixed(3), p: [h.point.x, h.point.y, h.point.z].map(v => +v.toFixed(3)), o: h.object?.name } : null; };
  const v3 = (x, y, z) => { const v = g.camera.position.clone(); v.set(x, y, z); return v; };
  const m=JSON.parse(JSON.stringify(window.__houseMetaSlides||null));
  for (const z of [6.5, 6.97, 7.3]) for (const y of [0.2, 0.9, 1.6]) {
    const hit = ph.raycast(v3(1.2, y, z), v3(-1, 0, 0).normalize(), 3);
    let o = hit?.object, path=[]; while (o) { path.push(o.name); o = o.parent; }
    res.push(['W z=' + z + ' y=' + y, hit ? { d: +hit.distance.toFixed(3), x: +hit.point.x.toFixed(3), path: path.slice(0,4).join('<') } : null]);
  }
  return res;
});
for (const r of out) console.log(r[0].padEnd(14), JSON.stringify(r[1]));
await browser.close();
