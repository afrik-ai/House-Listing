import { openGame } from '../../../scripts/shot.mjs';
const D='reviews/critic/TEX-r2';
const G = await openGame({ w:1280, h:720, quality:'high', tod:'day' });
const { browser, page } = G;
const list=[
['bath2',[10.55,4.75,2.15],67.5,-8],
['bath2_close',[10.55,4.75,2.15],67.5,-40],
['bath_master_close',[0.45,4.75,0.45],-124.5,-35],
['living_floor',[0.45,1.6,9.87],-57.2,-45],
['ext_front_east',[23.25,1.6,9.795],69,2.7],
['gabion',[18.8,1.6,12],-90,-22],
['gravel',[17.6,1.6,11],-90,-50],
['driveway',[17.5,1.6,7.5],0,-38],
['pool_surround',[-7.5,1.6,11.5],0,-32],
['lawn',[0,1.6,20],180,-35],
['ext_garden_sw',[-13.95,1.6,18.82],-51.1,2.4],
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
