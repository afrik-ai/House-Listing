import { openGame } from '../../scripts/shot.mjs';
let { browser, page } = await openGame({ w:800, h:450, quality:'low', tod:'day' });
const r = await page.evaluate(() => {
  const g = window.__game, T = g.THREE; const out={};
  g.scene.traverse(o=>{ if(o.isMesh && /^COL_(glass|stair|DOOR_D_front)|STAIR|HANDRAIL|ROOF_hip|GARAGE_DOOR|SURF_concrete_screed_entrance|EXT_roof/.test(o.name)){ const b=new T.Box3().setFromObject(o); out[o.name]=[b.min.toArray().map(v=>+v.toFixed(3)), b.max.toArray().map(v=>+v.toFixed(3)), o.visible]; }});
  const p = g.game.player; out.player = { radius:p.radius, height:p.height, stepHeight:p.stepHeight, eye:p.eyeHeight, keys:Object.keys(p).slice(0,60) };
  return out; });
console.log(JSON.stringify(r,null,0).replace(/\],"/g,'],\n"'));
await browser.close();
