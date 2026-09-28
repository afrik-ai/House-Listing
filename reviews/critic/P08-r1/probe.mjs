import fs from 'node:fs';
import { openGame, hard } from '../../../scripts/shot.mjs';
const OUT='reviews/critic/P08-r1/';
const { browser, page } = await openGame({ w: 960, h: 540, quality: 'low', quiet: true });
const shot = async (n)=>{ await hard(page.evaluate(()=>window.__game.render()),120000); await page.screenshot({path:OUT+n+'.png'}); };
try {
const R = await hard(page.evaluate(() => {
  const game=__game.game,P=game.player,ph=game.physics,T=__game.THREE,house=game.house;
  game.state='playing'; game.holdPhysics=false; const H=1/120;
  const cam=game.camera; const ev=[]; game.on?.('footstep',e=>ev.push({...e,x:+P.feet.x.toFixed(2),z:+P.feet.z.toFixed(2)})); game.on?.('land',e=>ev.push({land:1,...e}));
  const steps=(s,f)=>{for(let i=0;i<Math.round(s/H);i++){game._step(H);f?.(i);}};
  const place=(x,y,z,yaw=0)=>{P.simKeys.clear();P.teleport(x,y+P.eyeHeight+0.02,z,yaw,0);game.holdPhysics=false;steps(0.5);};
  const depth=()=>{const q=P.feet.clone();q.y+=0.01;ph._h=P.height;ph._resolve(q);return +Math.hypot(q.x-P.feet.x,q.y-P.feet.y-0.01,q.z-P.feet.z).toFixed(3);};
  const rec=(s,keys,every=6)=>{Object.entries(keys).forEach(([k,v])=>P.simKeys.set(k,v));const a=[];let md=0;let px=P.feet.x,pz=P.feet.z;
    steps(s,i=>{const d=depth();md=Math.max(md,d);if(i%every==0){a.push([+(i*H).toFixed(3),+P.feet.x.toFixed(3),+P.feet.y.toFixed(3),+P.feet.z.toFixed(3),+cam.position.y.toFixed(4),+P.speed.toFixed(2),+(P._fov??cam.fov).toFixed(1)]);}});
    P.simKeys.clear();return {a,md};};
  const out={info:P.info?.(),settings:P.getSettings?.()};
  // speed curves (open ground east of house)
  place(14.2,0,-1,90); out.walk=rec(1.2,{w:1},3); out.walkStop=rec(0.5,{},3);
  place(14.2,0,-1,90); out.sprint=rec(1.5,{w:1,shift:1},6); out.sprintStop=rec(0.6,{},6);
  place(14.2,0,-1,90); out.crouch=rec(1.5,{w:1,crouch:1},6);
  // head bob: camY - feetY over walking 2s
  place(14.2,0,-1,90); const hb=[];P.simKeys.set('w',1);steps(2,()=>hb.push(cam.position.y-P.feet.y));P.simKeys.clear();const hs=hb.slice(60);out.bob={min:Math.min(...hs),max:Math.max(...hs)};
  // jump
  place(14.2,0,-1,90); const jy=[];P.simKeys.set('jump',0.05);steps(1.5,()=>jy.push(P.feet.y));out.jumpMax=Math.max(...jy);
  // stairs up and down: record cam y per tick with bob on
  const stair=(x,y,z,yaw,wps)=>{place(x,y,z,yaw);const ys=[];let md=0;for(const [tx,tz] of wps){let t=0;for(;;){const dx=tx-P.feet.x,dz=tz-P.feet.z;if(Math.hypot(dx,dz)<0.2||t>12)break;P.look(Math.atan2(-dx,-dz),0);P.simKeys.set('w',1);game._step(H);t+=H;ys.push([+P.feet.x.toFixed(2),+P.feet.y.toFixed(3),+cam.position.y.toFixed(4)]);md=Math.max(md,depth());}}P.simKeys.clear();let pop=0,ups=0,dn=0;for(let i=1;i<ys.length;i++){const d=ys[i][2]-ys[i-1][2];pop=Math.max(pop,Math.abs(d));}return {n:ys.length,t:+(ys.length*H).toFixed(2),endY:P.feet.y,pop,md,ys:ys.filter((_,i)=>i%10==0)};};
  out.stairUp=stair(10.3,0,3.16,90,[[9.3,3.16],[4.1,3.16],[4.0,5.2]]);
  out.stairDown=stair(4.0,3.15,5.2,0,[[4.0,3.16],[4.4,3.16],[9.6,3.16],[10.0,3.6]]);
  // wall slide: from hall, walk at 30 deg into walls; measure tangential motion
  const slide=(x,y,z,yawDeg)=>{place(x,y,z,yawDeg);P.look(yawDeg*Math.PI/180,0);const r=rec(2,{w:1},24);return {start:[x,z],yaw:yawDeg,a:r.a,md:r.md};};
  out.slides=[slide(14.2,0,-1,90+180-30),slide(4.2,0,6.0,30),slide(4.2,0,6.0,-150),slide(10.8,0,8.3,-60)];
  // corner test: sprint into various directions 3s then reverse and check escape
  out.corners=[];for(const [x,z,y] of [[4.6,9.3,0],[10.8,8.3,0],[2.0,7.5,0],[7,8,3.15],[4.2,6,0]])for(const yaw of [45,135,-45,-135]){place(x,y,z);P.look(yaw*Math.PI/180,0);const r=rec(3,{w:1,shift:1},120);const p1=P.feet.clone();P.look((yaw+180)*Math.PI/180,0);rec(1,{w:1});out.corners.push({x,z,yaw,hit:[+p1.x.toFixed(2),+p1.z.toFixed(2)],escaped:+P.feet.distanceTo(p1).toFixed(2),md:r.md});}
  // glass & closed door
  place(0.6,0,9.6,-90);P.look(Math.PI/2,0);out.glass=rec(1.5,{w:1,shift:1},60);
  const dOff=house.doors.find(d=>/office/.test(d.id));if(dOff){const q0=dOff.node.quaternion.clone();dOff.node.rotation.set(0,0,0);dOff.node.updateMatrixWorld(true);place(2.6,0,3.4);P.look(0,0);out.closedDoor=rec(1.5,{w:1,shift:1},60);dOff.node.quaternion.copy(q0);dOff.node.updateMatrixWorld(true);}
  out.doors=house.doors.map(d=>d.id);
  // footsteps per surface: walk on several spots
  out.surfaces={};for(const [n,x,y,z,yaw] of [['hall',4.8,0,3.7,180],['living',4.2,0,7,0],['kitchen',10.8,0,8.3,90],['street',15,0.2,4,0],['terrace',-1.5,0,5,0],['garden',-5,-0.3,0.8,0],['upstairs',4.0,3.15,5.2,90],['balcony',-1.5,3.15,5,0]]){const n0=ev.length;place(x,y,z,yaw);P.look(yaw*Math.PI/180,0);P.simKeys.set('w',1);steps(1.5);P.simKeys.clear();out.surfaces[n]={n:ev.length-n0,surf:[...new Set(ev.slice(n0).map(e=>e.surface+'/'+e.type))],feet:P.feet.toArray().map(v=>+v.toFixed(2)),room:house.roomAt(P.feet)?.id??null};}
  out.evSample=ev.slice(0,3);
  return out;
}),580000,'probe');
fs.writeFileSync(OUT+'metrics.json',JSON.stringify(R,null,1));
// frames
const fr=async(n,code)=>{await hard(page.evaluate(code),120000);await shot(n);};
await fr('f1_hall_stand',`(()=>{const g=__game.game,P=g.player;P.simKeys.clear();P.teleport(4.8,1.67,3.7,180,0);g.holdPhysics=false;for(let i=0;i<60;i++)g._step(1/120);})()`);
await fr('f2_sprint_fov',`(()=>{const g=__game.game,P=g.player;P.teleport(4.2,1.67,9.3,0,0);g.holdPhysics=false;P.simKeys.set('w',1);P.simKeys.set('shift',1);for(let i=0;i<60;i++)g._step(1/120);})()`);
await fr('f3_crouch',`(()=>{const g=__game.game,P=g.player;P.simKeys.clear();P.simKeys.set('crouch',1);for(let i=0;i<120;i++)g._step(1/120);})()`);
await fr('f4_midstairs_up',`(()=>{const g=__game.game,P=g.player;P.simKeys.clear();P.teleport(9.4,1.67,3.16,90,0);g.holdPhysics=false;P.simKeys.set('w',1);for(let i=0;i<150;i++)g._step(1/120);})()`);
await fr('f5_midstairs_down',`(()=>{const g=__game.game,P=g.player;P.simKeys.clear();P.teleport(4.4,3.15+1.67,3.16,-90,-15);g.holdPhysics=false;P.simKeys.set('w',1);for(let i=0;i<150;i++)g._step(1/120);})()`);
await fr('f6_wall_press',`(()=>{const g=__game.game,P=g.player;P.simKeys.clear();P.teleport(4.2,1.67,7,0,0);g.holdPhysics=false;P.simKeys.set('w',1);for(let i=0;i<400;i++)g._step(1/120);})()`);
await fr('f7_terrace',`(()=>{const g=__game.game,P=g.player;P.simKeys.clear();P.teleport(-1.5,1.67,5,90,-5);g.holdPhysics=false;for(let i=0;i<60;i++)g._step(1/120);})()`);
console.log('done');
} finally { await browser.close(); }
