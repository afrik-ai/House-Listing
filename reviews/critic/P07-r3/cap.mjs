import { openGame, stable } from '../../../scripts/shot.mjs';
import fs from 'fs';
const O='reviews/critic/P07-r3/';
const G=await openGame({w:1280,h:720,quality:'high'});
const {page,browser}=G;
const snap=async(name,v)=>{await page.evaluate(v=>{const g=window.__game;g.hideUI(true);g.teleport(v.pos[0],v.pos[1],v.pos[2],v.yaw??0,v.pitch??0);g.render();},v);
 await new Promise(r=>setTimeout(r,10000));await page.evaluate(()=>window.__game.render());await page.screenshot({path:O+name+'.png'});console.error('shot',name);};
const info=await stable(page,()=>page.evaluate(()=>{const g=window.__game;const f=window.__furnish||{};
 const sc=g.game?.scene||g.scene; const find=[];
 sc&&sc.traverse(o=>{if(/sofa|nightstand|bedside|shelf|kitchen|garage|worktop|counter/i.test(o.name)&&find.length<400){const p=new o.position.constructor();o.getWorldPosition(p);find.push([o.name,+p.x.toFixed(2),+p.y.toFixed(2),+p.z.toFixed(2)]);}});
 return {rooms:g.rooms(),views:g.views(),stats:g.stats(),report:f.report,find};}));
fs.writeFileSync(O+'info.json',JSON.stringify(info,null,1));
for(const v of info.views.rooms) await snap('room_'+v.id,v);
for(const v of info.views.exteriors.slice(0,1)) await snap('ext_'+v.id,v);
const pick=re=>info.find.find(f=>re.test(f[0]));
const close=[['close_kitchen',/kitchen.*(clutter|worktop|counter|run)/i],['close_nightstand',/nightstand|bedside/i],['close_shelf',/shelf/i],['close_sofa',/sofa/i]];
for(const [n,re] of close){const f=pick(re);if(!f)continue;const [x,y,z]=[f[1],f[2],f[3]];
 for(const [dx,dz,s] of [[1.1,0,'a'],[0,1.1,'b']]){const yaw=Math.atan2(-(-dx),-(-dz))*180/Math.PI;// look from (x+dx) toward x
  await snap(n+'_'+s,{pos:[x+dx,Math.max(y,0)+1.4,z+dz],yaw:Math.atan2(dx,dz)*180/Math.PI,pitch:-30});}}
fs.writeFileSync(O+'stats_end.json',JSON.stringify(await page.evaluate(()=>({stats:window.__game.stats(),report:window.__furnish?.report})),null,1));
await browser.close();console.error('DONE');
