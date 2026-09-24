import { openGame } from '../../scripts/shot.mjs';
const { browser, page, errors } = await openGame({ w:1280, h:720, quality:'high', tod:'day' });
const r = await page.evaluate(() => {
  const g = window.__game;
  const out = { keys: Object.keys(g), gameKeys: Object.keys(g.game||{}), views: g.views(), state: g.state() };
  const scene = g.game.scene || g.game.renderer?.scene;
  const names = [];
  const THREE_Box = g.game.THREE;
  scene.traverse(o => { if (o.isMesh) names.push([o.name, o.parent?.name, o.geometry?.attributes?.position?.count]); });
  out.meshCount = names.length;
  out.names = names;
  return out;
});
console.log(JSON.stringify({keys:r.keys, gameKeys:r.gameKeys, state:r.state, views:r.views}, null, 0));
console.log('meshes', r.meshCount);
const fs = await import('fs');
fs.writeFileSync('reviews/P02-r1/meshes.json', JSON.stringify(r.names));
await browser.close();
