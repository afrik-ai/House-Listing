import { openGame, stable, capture } from '../../../scripts/shot.mjs';
import fs from 'fs';
const O='reviews/critic/P07-r5/';
const {page,browser}=await openGame({w:1280,h:720,quality:'high'});
const r=await stable(page,()=>page.evaluate(()=>{const g=window.__game;const sc=g.game.scene;const B=[];
 const Box=sc.children.find(()=>1);let out=null;const gv=g.views().rooms.find(v=>v.id==='garage');
 sc.traverse(o=>{if(out||!/(^|[^a-z])(car|suv|vehicle|sedan|auto)([^a-z]|$)/i.test(o.name))return;out=o;});
 if(!out)return {gv};const b=new (Object.getPrototypeOf(sc).constructor===Object?Object:window.__game.game.THREE?.Box3||Object)();
 const pos=[];const p=out.getWorldPosition(out.position.clone());return {name:out.name,p:[p.x,p.y,p.z],rot:out.rotation.y,gv};}));
console.error(JSON.stringify(r));fs.writeFileSync(O+'car.json',JSON.stringify(r));
if(r.p){const [x,,z]=r.p;const s=(ex,ez)=>Math.atan2(-(x-ex),-(z-ez))*180/Math.PI;
 const cands=[[2.3,2.8],[-2.3,2.8],[2.3,-2.8],[-2.3,-2.8]];let i=0;
 for(const [dx,dz] of cands){const ex=x+dx,ez=z+dz;await capture(page,{view:{pos:[ex,1.5,ez],yaw:s(ex,ez),pitch:-12},tod:'day',out:O+'garage_car_'+(i++)+'.png'}).catch(e=>console.error(e.message));console.error('shot',i);}}
await browser.close();console.error('DONE');
