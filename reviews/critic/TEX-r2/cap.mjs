import { openGame } from '../../../scripts/shot.mjs';
import fs from 'fs';
const D='reviews/critic/TEX-r2';
const G = await openGame({ w:1280, h:720, quality:'high', tod:'day' });
const { browser, page } = G;
const views = await page.evaluate(()=>window.__game.views());
fs.writeFileSync(D+'/views.json', JSON.stringify(views,null,1));
const all=[...views.rooms,...views.exteriors];
const list=[];
for (const v of all) {
  if (/living|kitchen|bath|bed|master|ensuite|wc/i.test(v.id) || views.exteriors.includes(v)) {
    list.push({name:v.id, ...v});
    if (/bath|ensuite|living/i.test(v.id)) list.push({name:v.id+'_close', pos:v.pos, yaw:v.yaw, pitch:-0.75});
  }
}
for (const v of list.slice(0,22)) {
  try {
    await page.evaluate(v=>{const g=window.__game; g.hideUI(true); g.teleport(v.pos[0],v.pos[1],v.pos[2],v.yaw??0,v.pitch??0); g.render();}, v);
    await new Promise(r=>setTimeout(r,10000));
    await page.evaluate(()=>window.__game.render());
    await page.screenshot({path:`${D}/${v.name}.png`});
    console.log('ok',v.name, JSON.stringify(v.pos), v.yaw, v.pitch);
  } catch(e){ console.log('fail',v.name,e.message); }
}
await browser.close(); console.log('DONE');
