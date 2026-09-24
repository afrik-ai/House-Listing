import { openGame } from '../../../scripts/shot.mjs';
import fs from 'fs';
const D='reviews/critic/P05-r2';
const { browser, page } = await openGame({ w:1280, h:720, quality:'high', tod:'day' });
const views0 = await page.evaluate(()=>window.__game.views());
const views=views0;
const ext = (views.exteriors||views.exterior||[]).slice(0,4); console.log('ext',ext.length);
const interior=[['living',[7.6,1.6,9.87],57.2,-8],['kitchen',[11.55,1.6,9.87],45.9,-8],['master_bed',[0.45,4.75,9.87],-28.2,-8]];
const stats={};
async function shot(name,pos,yaw,pitch,tod){
  try{
    await page.evaluate(async v=>{const g=window.__game; g.hideUI(true); await g.setTimeOfDay(v.tod); g.teleport(...v.pos,v.yaw,v.pitch); g.render();},{pos,yaw,pitch,tod});
    await new Promise(r=>setTimeout(r,10000));
    await page.evaluate(()=>window.__game.render());
    await page.screenshot({path:`${D}/${name}.png`});
    stats[name]=await page.evaluate(()=>window.__game.stats());
    fs.writeFileSync(D+'/stats.json',JSON.stringify(stats,null,1));
    console.log('ok',name);
  }catch(e){console.log('fail',name,e.message);}
}
for (const tod of ['day','golden_hour','night']) {
  for (const [i,v] of ext.entries()) await shot(`ext${i}_${tod}`,v.pos,v.yaw,v.pitch,tod);
  if (tod!=='golden_hour') for (const [n,p,y,pt] of interior) await shot(`${n}_${tod}`,p,y,pt,tod);
}
await shot('feet_sofa_day',[3.27,1.33,8.46],45,-39,'day');
await shot('feet_sofa_b_day',[1.73,1.33,6.92],-135,-39,'day');
await shot('living_floor_day',[0.45,1.6,9.87],-57.2,-45,'day');
await browser.close(); console.log('DONE');
