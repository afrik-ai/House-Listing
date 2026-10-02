import { openGame } from '../../../scripts/shot.mjs';
const O='reviews/critic/P07-r3/';
const G=await openGame({w:1280,h:720,quality:'high'});const {page,browser}=G;
const snap=async(name,v)=>{await page.evaluate(v=>{const g=window.__game;g.hideUI(true);g.teleport(v.pos[0],v.pos[1],v.pos[2],v.yaw,v.pitch);g.render();},v);
 await new Promise(r=>setTimeout(r,10000));await page.evaluate(()=>window.__game.render());await page.screenshot({path:O+name+'.png'});console.error('shot',name,JSON.stringify(v));};
const ns=await page.evaluate(()=>{const sc=window.__game.game.scene;let out=[];sc.traverse(o=>{if(o.isInstancedMesh&&/nightstand/.test(o.name)){const M=new o.matrixWorld.constructor();for(let i=0;i<o.count;i++){o.getMatrixAt(i,M);M.premultiply(o.matrixWorld);out.push([M.elements[12],M.elements[13],M.elements[14]]);}}});return out;});
console.error('ns',JSON.stringify(ns));
const s=(x,z,tx,tz)=>Math.atan2(-(tx-x),-(tz-z))*180/Math.PI;
await snap('close_kitchen',{pos:[9.2,1.55,9.6],yaw:s(9.2,9.6,9.89,8.65),pitch:-35});
const n=ns.find(p=>p[1]>2)||ns[0];
if(n){const [x,y,z]=n;for(const [dx,dz,t] of [[0.9,0.5,'a'],[-0.5,0.9,'b']])await snap('close_nightstand_'+t,{pos:[x+dx,y+1.45,z+dz],yaw:s(x+dx,z+dz,x,z),pitch:-38});}
await browser.close();console.error('DONE');
