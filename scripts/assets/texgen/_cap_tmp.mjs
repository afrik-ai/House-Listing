import { openGame } from '/home/user/House-Listing/scripts/shot.mjs';
const G = await openGame({ w: 1280, h: 720, quality: 'high', tod: 'day', attempts: 4 });
const { browser, page } = G;
const list = [['bath3',[10.42,4.75,3.71],-90,-16],['bath3_close',[10.42,4.75,3.71],-90,-45],['bath_master',[0.45,4.75,0.45],-124.5,-8],['bath_master_close',[0.45,4.75,0.45],-124.5,-35],['wc_floor',[0.75,1.6,4.6],0,-60],['bath2',[10.55,4.75,2.15],67.5,-8]];
for (const [name, pos, yaw, pitch] of list) {
  try {
    await page.evaluate(v => { const g = window.__game; g.hideUI(true); g.teleport(...v.pos, v.yaw, v.pitch); g.render(); }, { pos, yaw, pitch });
    await new Promise(r => setTimeout(r, 10000)); await page.evaluate(() => window.__game.render());
    await page.screenshot({ path: `reviews/textures/r6/${name}.png`, timeout: 300000 }); console.error('ok', name);
  } catch (e) { console.error('fail', name, e.message); }
}
await browser.close(); console.error('DONE');
