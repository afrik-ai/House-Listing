import { openGame, stable, capture } from '../../../scripts/shot.mjs';
import fs from 'fs';
const O='reviews/critic/P07-r5/';
const G=await openGame({w:1280,h:720,quality:'high'});
const {page,browser}=G;
const snap=async(name,v)=>{try{await capture(page,{view:v,tod:'day',out:O+name+'.png'});console.error('shot',name);}catch(e){console.error('FAIL',name,e.message);}};
const info=await stable(page,()=>page.evaluate(()=>{const g=window.__game;const f=window.__furnish||{};
 const sc=g.game.scene; const out={};
 sc.traverse(o=>{const m=/(sofa|vanity|basin|sink|car|suv|vehicle|workbench|worktop|counter|hob|cooktop)/i.exec(o.name);if(!m)return;const k=m[1].toLowerCase();out[k]=out[k]||[];if(out[k].length>12)return;
  if(o.isInstancedMesh&&o.count){const M=new o.matrixWorld.constructor();o.getMatrixAt(0,M);M.premultiply(o.matrixWorld);out[k].push([M.elements[12],M.elements[13],M.elements[14],o.name]);}
  else {const p=new o.position.constructor();o.getWorldPosition(p);out[k].push([p.x,p.y,p.z,o.name]);}});
 return {views:g.views(),stats:g.stats(),report:f.report,pts:out};}));
fs.writeFileSync(O+'info.json',JSON.stringify(info,null,1));
for(const v of info.views.rooms) await snap('room_'+v.id,v);
await snap('ext_'+info.views.exteriors[0].id,info.views.exteriors[0]);
const s=(x,z,tx,tz)=>Math.atan2(-(tx-x),-(tz-z))*180/Math.PI;
const P=info.pts; const pick=(ks,f=()=>true)=>{for(const k of ks){const L=(P[k]||[]).filter(f);if(L.length)return L[0];}};
const close=async(name,p,dx=0.7,dz=0.7,up=0.6)=>{if(!p){console.error('nopt',name);return;}const [x,y,z]=p;const ex=x+dx,ez=z+dz;const ey=Math.max(y,Math.floor(y/3.2)*3.2+0.8)+up;
 await snap(name,{pos:[ex,ey,ez],yaw:s(ex,ez,x,z),pitch:-Math.atan2(ey-y-0.1,Math.hypot(dx,dz))*180/Math.PI});};
await close('close_kitchen',pick(['worktop','counter','hob','cooktop']));
await close('close_vanity',pick(['vanity','basin','sink'],p=>/vanit|basin|bath/i.test(p[3])));
await close('close_sofa',pick(['sofa']),0.9,0.9,0.4);
const car=pick(['car','suv','vehicle'],p=>p[1]<1.5);
if(car){const [x,y,z]=car; await snap('garage_car34',{pos:[x+3,1.5,z-3.2],yaw:s(x+3,z-3.2,x,z),pitch:-10});await snap('garage_car34b',{pos:[x-3,1.5,z+3.2],yaw:s(x-3,z+3.2,x,z),pitch:-10});}
const wb=pick(['workbench']); if(wb) await close('garage_workbench',wb,1.4,1.4,0.9);
fs.writeFileSync(O+'stats_end.json',JSON.stringify(await page.evaluate(()=>({stats:window.__game.stats(),report:window.__furnish?.report})),null,1));
await browser.close();console.error('DONE');
