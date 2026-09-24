import { openGame, capture } from '../../scripts/shot.mjs';
const { browser, page } = await openGame({ w:1600, h:900, quality:'ultra', tod:'day' });
const info = await page.evaluate(()=>{
  const g=window.__game, sc=g.scene; const glass=[];
  sc.traverse(o=>{ if(o.isMesh){ const m=Array.isArray(o.material)?o.material[0]:o.material; if(m.transparent||m.transmission>0||/glass|glaz/i.test(o.name+m.name)) glass.push({n:o.name,m:m.name,t:m.transparent,op:m.opacity,tr:m.transmission,cast:o.castShadow}); } });
  const pf=g.game.postfx; const passes=(pf?.composer?.passes||[]).map(p=>p.name||p.constructor.name);
  const eff=[]; (pf?.composer?.passes||[]).forEach(p=>{ (p.effects||[]).forEach(e=>eff.push(e.name||e.constructor.name)); });
  return { glass, passes, eff, pfKeys: pf?Object.keys(pf):null };
});
console.log(JSON.stringify(info,null,1));
const views = await page.evaluate(()=>window.__game.views());
const v = views.rooms.find(x=>x.id==='living');
await page.evaluate(()=>{ window.__game.scene.traverse(o=>{ if(o.isMesh){ const m=Array.isArray(o.material)?o.material[0]:o.material; if(m.transparent||m.transmission>0||/glass|glaz/i.test(o.name+m.name)) o.castShadow=false; } }); });
await capture(page,{view:v,tod:'day',out:'reviews/P01-r1/diag_living_glass_noshadow.png'});
await browser.close();
