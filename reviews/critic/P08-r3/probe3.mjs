import fs from 'node:fs';
import { openGame, hard } from '../../../scripts/shot.mjs';
const OUT='reviews/critic/P08-r3/';
const { browser, page } = await openGame({ w: 1280, h: 720, quality: 'low', quiet: true });
const shot = async (n)=>{ await hard(page.evaluate(()=>window.__game.render()),180000); await page.screenshot({path:OUT+n+'.png'}); };
try {
const R=await hard(page.evaluate(() => {
  const game=__game.game,P=game.player,ph=game.physics,house=game.house,T=__game.THREE;const H=1/120,cam=game.camera;const step=()=>game._step(H);
  const place=(x,y,z,yaw=0)=>{P.simKeys.clear();P.teleport(x,y+P.eyeHeight+0.02,z,yaw,0);game.holdPhysics=false;for(let i=0;i<60;i++)step();};
  const rec=(s,keys,every=3)=>{Object.entries(keys).forEach(([k,v])=>P.simKeys.set(k,v));const a=[];for(let i=0;i<Math.round(s/H);i++){step();if(i%every==0)a.push([+(i*H).toFixed(3),+P.speed.toFixed(2),+(cam.position.y-P.feet.y).toFixed(4),+cam.fov.toFixed(2),+P.feet.z.toFixed(3)]);}P.simKeys.clear();return a;};
  const all=(o,d,far=3)=>{const r=new T.Raycaster(new T.Vector3(...o),new T.Vector3(...d).normalize(),0,far);return r.intersectObject(house.root,true).slice(0,4).map(h=>[h.object.name,+h.distance.toFixed(2),h.object.visible,+h.point.y.toFixed(2)]);};
  const out={};
  out.drive={};for(const y of [-0.2,0,0.1,0.3,0.6,1.2])out.drive[y]=all([17.5,y,3.0],[0,0,-1]);
  out.driveDown=[3.2,2.9,2.6,2.3,2.0,1.0].map(z=>[z,all([17.5,2,z],[0,-1,0],4).slice(0,2)]);
  out.terr={};for(const y of [-0.25,-0.1,0.05,0.2,0.5])out.terr[y]=all([-1.45,y,-0.3],[0,0,1],2);
  out.terrDown=[-0.3,0,0.2,0.4,0.6,0.9,1.2].map(z=>[z,all([-1.45,2,z],[0,-1,0],4).slice(0,2)]);
  // clean curves on driveway going north from z=-0.5
  place(17.5,-0.3,-0.5,0);out.start=P.feet.toArray();out.walk=rec(1.1,{w:0.8},3);
  place(17.5,-0.3,-0.5,0);out.sprint=rec(1.1,{w:0.8,shift:0.8},3);
  place(17.5,-0.3,-0.5,0);const hb=[];P.simKeys.set('w',1.2);for(let i=0;i<144;i++){step();hb.push(cam.position.y-P.feet.y);}P.simKeys.clear();out.bob=[Math.min(...hb.slice(60)),Math.max(...hb.slice(60))];
  place(17.5,-0.3,-0.5,0);const hs=[];P.simKeys.set('w',1);P.simKeys.set('shift',1);for(let i=0;i<120;i++){step();hs.push(cam.position.y-P.feet.y);}P.simKeys.clear();out.bobS=[Math.min(...hs.slice(60)),Math.max(...hs.slice(60))];
  place(17.5,-0.3,-0.5,0);out.back=rec(0.8,{s:0.6},6);
  return out;}),400000,'p3');
fs.writeFileSync(OUT+'metrics3.json',JSON.stringify(R,null,1));console.log('m3');
const S=(x,y,z,yaw,p,keys,ticks)=>`(()=>{const g=__game.game,P=g.player;P.simKeys.clear();P.teleport(${x},${y}+P.eyeHeight,${z},${yaw},${p});g.holdPhysics=false;${Object.entries(keys).map(([k,v])=>`P.simKeys.set('${k}',${v});`).join('')}for(let i=0;i<${ticks};i++)g._step(1/120);return P.feet.toArray().map(v=>+v.toFixed(2)).concat([+g.camera.fov.toFixed(1)]);})()`;
const fr=async(n,c)=>{const r=await hard(page.evaluate(c),180000);await shot(n);console.log(n,r);};
await fr('h1_drive_block',S(17.5,-0.3,3.2,0,-20,{w:2},240));
await fr('h2_terrace_steps_block',S(-1.45,-0.3,-2.0,180,-25,{w:3},400));
await fr('h3_sprint_open',S(17.5,-0.3,-0.5,0,0,{w:3,shift:3},70));
console.log('done');
} catch(e){console.log('ERR',e);} finally { await browser.close(); }
