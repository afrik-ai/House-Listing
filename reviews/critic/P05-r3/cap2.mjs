import { openGame } from '../../../scripts/shot.mjs';
import fs from 'fs';
const D='reviews/critic/P05-r3';
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
    fs.writeFileSync(D+'/stats2.json',JSON.stringify(stats,null,1));
    console.log('ok',name);
  }catch(e){console.log('fail',name,e.message);}
}
const P=[['kitchen_b',[10.6,1.6,8.6],45.9,-12],['kitchen_c',[11.55,1.6,9.87],0,-12],['kitchen_d',[11.55,1.6,9.87],-60,-12],['feet_dining_day',[7.6,1.6,9.87],80,-50],['feet_lamp_day',[7.6,1.6,9.87],35,-40],['feet_dresser_day',[0.45,4.75,9.87],-50,-35]];
for (const tod of ['day','night']) for (const [n,p,y,pt] of P) { if(n.startsWith('feet')&&tod==='night') continue; await shot(n.startsWith('feet')?n:n+'_'+tod,p,y,pt,tod); }
await browser.close(); console.log('DONE');
