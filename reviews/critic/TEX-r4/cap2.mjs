import { openGame } from '../../../scripts/shot.mjs';
const D='reviews/critic/TEX-r4';
const vv=null;
const G = await openGame({ w:1280, h:720, quality:'high', tod:'day' });
const { browser, page } = G;
const fs=await import('fs');
const list=[
['gravel',[17.6,1.6,11],-90,-50],
['driveway',[17.5,1.6,7.5],0,-38],
['pool_surround',[-7.5,1.6,11.5],0,-32],
['lawn',[0,1.6,20],180,-35],
['ext_garden_sw',[-13.95,1.6,18.82],-51.1,2.4],
['kitchen_top',[11.55,1.6,9.87],45.9,-50],['kitchen_top2',[11.55,1.6,9.87],80,-45],['wc',[0.75,1.6,4.6],0,-16],['wc_floor',[0.75,1.6,4.6],0,-60],['wc_wall',[0.75,1.6,4.6],90,-10],['bath3',[10.42,4.75,3.71],-90,-16],['bath3_close',[10.42,4.75,3.71],-90,-45],['bath_master_wall',[0.45,4.75,0.45],-170,-5],['bed2',[6.56,4.75,9.87],42.8,-8],
];
for (const [name,pos,yaw,pitch] of list) {
  try {
    await page.evaluate(v=>{const g=window.__game; g.hideUI(true); g.teleport(...v.pos,v.yaw,v.pitch); g.render();}, {pos,yaw,pitch});
    await new Promise(r=>setTimeout(r,10000));
    await page.evaluate(()=>window.__game.render());
    await page.screenshot({path:`${D}/${name}.png`});
    console.log('ok',name);
  } catch(e){ console.log('fail',name,e.message); }
}
await browser.close(); console.log('DONE');
