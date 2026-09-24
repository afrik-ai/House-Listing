import { openGame } from '../../scripts/shot.mjs';
const { browser, page, errors } = await openGame({ w: 800, h: 450, quality: 'high', tod: 'day' });
const r = await page.evaluate(() => {
  const g = window.__game.game; const out = [];
  const root = g.plugins.get('20_exterior').root;
  root.traverse((o) => { if (o.isMesh) { const m = o.material; out.push([o.name, m.name, m.type, m.color && m.color.getHexString(), m.metalness, m.roughness, !!m.userData.registry, o.visible]); } });
  const gar = []; g.house.root.traverse((o) => { if (o.isMesh && /GARAGE/.test(o.name + (o.parent?.name||''))) gar.push([o.name, o.material.name, o.material.color?.getHexString(), o.visible]); });
  return { out, gar, stats: g.plugins.get('20_exterior').stats() };
});
console.log(JSON.stringify(r, null, 0));
console.log('errors', errors);
await browser.close();
