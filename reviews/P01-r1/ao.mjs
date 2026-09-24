import { openGame, capture } from '../../scripts/shot.mjs';
const { browser, page } = await openGame({ w:1600, h:900, quality:'ultra', tod:'day' });
const view={pos:[1.2,1.6,1.9],yaw:-135,pitch:5};  // office corner
const views=await page.evaluate(()=>window.__game.views());
const off=views.rooms.find(v=>v.id==='office');
await capture(page,{view:off,tod:'day',out:'reviews/P01-r1/ao_on.png'});
await page.evaluate(()=>{ const pf=window.__game.game.postfx; pf.ao.enabled=false; if(pf.composer.passes[1]) pf.composer.passes[1].enabled=false; });
await capture(page,{view:off,tod:'day',out:'reviews/P01-r1/ao_off.png'});
await browser.close();
