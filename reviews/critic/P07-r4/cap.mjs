import { openGame, stable } from '../../../scripts/shot.mjs';
import fs from 'fs';
const O='reviews/critic/P07-r4/';
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

const pts=await page.evaluate(()=>{const sc=window.__game.game.scene;const out={};sc.traverse(o=>{const m=/(sofa|nightstand|bedside|shelf)/i.exec(o.name);if(!m)return;const k=m[1].toLowerCase();out[k]=out[k]||[];
 if(o.isInstancedMesh){const M=new o.matrixWorld.constructor();for(let i=0;i<Math.min(o.count,6);i++){o.getMatrixAt(i,M);M.premultiply(o.matrixWorld);out[k].push([M.elements[12],M.elements[13],M.elements[14],o.name]);}}
 else if(o.isMesh||o.isGroup){const p=new o.position.constructor();o.getWorldPosition(p);out[k].push([p.x,p.y,p.z,o.name]);}});return out;});
fs.writeFileSync(O+'pts.json',JSON.stringify(pts,null,1));
const s=(x,z,tx,tz)=>Math.atan2(-(tx-x),-(tz-z))*180/Math.PI;
await snap('close_kitchen',{pos:[9.2,1.55,9.6],yaw:s(9.2,9.6,9.89,8.65),pitch:-35});
for(const k of ['nightstand','bedside','shelf','sofa']){const L=pts[k]||[];const n=L.find(p=>p[1]>2)||L[0];if(!n)continue;const [x,y,z]=n;const fy=Math.floor(y/3.2)*3.2;
 await snap('close_'+k,{pos:[x+0.8,fy+1.45,z+0.7],yaw:s(x+0.8,z+0.7,x,z),pitch:-30});}
fs.writeFileSync(O+'stats_end.json',JSON.stringify(await page.evaluate(()=>({stats:window.__game.stats(),report:window.__furnish?.report})),null,1));
await browser.close();console.error('DONE');
