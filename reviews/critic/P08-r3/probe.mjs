import fs from 'node:fs';
import { openGame, hard } from '../../../scripts/shot.mjs';
const OUT='reviews/critic/P08-r3/';
const { browser, page } = await openGame({ w: 1280, h: 720, quality: 'low', quiet: true });
const shot = async (n)=>{ await hard(page.evaluate(()=>window.__game.render()),180000); await page.screenshot({path:OUT+n+'.png'}); };
const errs=[];page.on('pageerror',e=>errs.push(String(e)));
try {
const R = await hard(page.evaluate(() => {
  const game=__game.game,P=game.player,ph=game.physics,house=game.house,T=__game.THREE;
  game.state='playing'; game.holdPhysics=false; const H=1/120; const cam=game.camera;
  const ev=[]; game.on('footstep',e=>ev.push({...e,x:+P.feet.x.toFixed(2),y:+P.feet.y.toFixed(2),z:+P.feet.z.toFixed(2)}));
  const step=()=>game._step(H);
  const place=(x,y,z,yaw=0)=>{P.simKeys.clear();P.teleport(x,y+P.eyeHeight+0.02,z,yaw,0);game.holdPhysics=false;for(let i=0;i<60;i++)step();};
  const depth=()=>{const q=P.feet.clone();q.y+=0.01;ph._h=P.height;ph._resolve(q);return Math.hypot(q.x-P.feet.x,q.y-P.feet.y-0.01,q.z-P.feet.z);};
  const out={info:P.info(),errs:[]};
  // follow waypoints; returns trace stats
  const follow=(wps,{sprint=false,crouch=false,tmax=15}={})=>{let ys=[],pop=0,md=0,t=0,stuck=0,reached=0,lastMove=0,prev=P.feet.clone();
    for(const [tx,tz] of wps){let tt=0;for(;;){const dx=tx-P.feet.x,dz=tz-P.feet.z;if(Math.hypot(dx,dz)<0.18){reached++;break;}if(tt>tmax){break;}
      P.look(Math.atan2(-dx,-dz),0);P.simKeys.set('w',1);if(sprint)P.simKeys.set('shift',1);if(crouch)P.simKeys.set('crouch',1);
      const cy=cam.position.y;step();tt+=H;t+=H;const d=cam.position.y-cy;pop=Math.max(pop,Math.abs(d));md=Math.max(md,depth());
      if(P.feet.distanceTo(prev)<0.004)stuck++;prev.copy(P.feet);ys.push([+P.feet.x.toFixed(2),+P.feet.y.toFixed(3),+P.feet.z.toFixed(2),+cam.position.y.toFixed(4),+d.toFixed(4)]);}
      if(tt>tmax)break;}
    P.simKeys.clear();for(let i=0;i<30;i++)step();
    let big=ys.filter(r=>Math.abs(r[4])>0.018);
    return {ok:reached===wps.length,reached,n:wps.length,t:+t.toFixed(2),end:P.feet.toArray().map(v=>+v.toFixed(2)),pop:+pop.toFixed(4),bigTicks:big.length,bigSample:big.slice(0,6),stuckTicks:stuck,md:+md.toFixed(3),trace:ys.filter((_,i)=>i%15==0)};};
  const rec=(s,keys,every=3)=>{Object.entries(keys).forEach(([k,v])=>P.simKeys.set(k,v));const a=[];for(let i=0;i<Math.round(s/H);i++){step();if(i%every==0)a.push([+(i*H).toFixed(3),+P.speed.toFixed(2),+(cam.position.y-P.feet.y).toFixed(4),+cam.fov.toFixed(2),+P.feet.x.toFixed(3)]);}P.simKeys.clear();return a;};
  // --- curves
  place(14.2,0,-1,90); out.walk=rec(1.0,{w:3}); out.walkStop=rec(0.4,{});
  place(14.2,0,-1,90); out.sprint=rec(1.2,{w:3,shift:3}); out.sprintStop=rec(0.5,{});
  place(14.2,0,-1,90); out.crouch=rec(1.2,{w:3,crouch:3}); out.crouchUp=rec(0.6,{});
  place(14.2,0,-1,90); const hb=[];P.simKeys.set('w',3);for(let i=0;i<240;i++){step();hb.push(cam.position.y-P.feet.y);}P.simKeys.clear();out.bobWalk=[Math.min(...hb.slice(80)),Math.max(...hb.slice(80))];
  place(14.2,0,-1,90); const hs=[];P.simKeys.set('w',3);P.simKeys.set('shift',3);for(let i=0;i<240;i++){step();hs.push(cam.position.y-P.feet.y);}P.simKeys.clear();out.bobSprint=[Math.min(...hs.slice(80)),Math.max(...hs.slice(80))];
  // --- stair collider bbox
  const sb=[];house.root.traverse(o=>{if(/^COL_stair/i.test(o.name)){const b=new T.Box3().setFromObject(o);sb.push([o.name,b.min.toArray().map(v=>+v.toFixed(2)),b.max.toArray().map(v=>+v.toFixed(2))]);}});out.stairBoxes=sb;
  // --- main stair up/down, three lanes
  out.stairs={};
  for(const [lane,z] of [['north',2.92],['centre',3.16],['south',3.40]]){
    place(10.3,0,z,90); out.stairs['up_'+lane]=follow([[9.3,z],[4.1,z],[4.0,5.2]]);
    place(4.0,3.15,5.2,0); out.stairs['down_'+lane]=follow([[4.0,z],[4.4,z],[9.6,z],[10.3,z],[10.3,3.9]]);
  }
  out.stairs.down_sprint=(place(4.0,3.15,5.2,0),follow([[4.0,3.16],[4.4,3.16],[10.3,3.16]],{sprint:true}));
  out.stairs.down_crouch=(place(4.0,3.15,5.2,0),follow([[4.0,3.16],[4.4,3.16],[10.3,3.16]],{crouch:true}));
  // exterior steps
  out.ext={};
  out.ext.terraceSteps_down=(place(-1.3,0,1.0,0),follow([[-1.4,-0.3],[-1.4,-2.2]]));
  out.ext.terraceSteps_up=follow([[-1.4,-0.3],[-1.3,1.2]]);
  out.ext.entrance_down=(place(12.3,0,4.53,-90),follow([[13.9,4.53],[15.5,4.53]]));
  out.ext.entrance_up=follow([[13.9,4.53],[12.0,4.53],[10.3,3.9]]);
  out.ext.doorsteps=(place(4.2,0,9.8,180),follow([[4.6,10.6],[4.6,11.8]]));
  out.ext.doorsteps_up=follow([[4.6,10.6],[4.2,9.6]]);
  // --- doorways, 4 hypotheses
  const rc={};for(const r of house.rooms())rc[r.id]=r;
  const meta=house.meta||{};const doors=(meta.doors||[]);out.doors={};
  for(const d of doors){const A=rc[d.room_a==='exterior'?'entrance':d.room_a],B=rc[d.room_b];if(!A||!B){out.doors[d.id]='noroom';continue;}
    const y=d.hinge[1];let res=null;
    for(const [ax,sg] of [['x',1],['x',-1],['z',1],['z',-1]]){const c=[d.hinge[0]+(ax==='x'?sg*d.width/2:0),d.hinge[2]+(ax==='z'?sg*d.width/2:0)];
      const nx=ax==='x'?0:1,nz=ax==='x'?1:0;const sA=Math.sign((A.center.x-c[0])*nx+(A.center.z-c[1])*nz)||1;
      const pre=[c[0]+nx*sA*0.6,c[1]+nz*sA*0.6],post=[c[0]-nx*sA*0.6,c[1]-nz*sA*0.6];
      place(A.center.x,y,A.center.z);const f=follow([pre,c,post,[B.center.x,B.center.z]],{tmax:8});
      if(!res||f.reached>res.reached)res={hyp:ax+sg,...f,trace:undefined};if(f.ok)break;}
    const back=follow([[B.center.x,B.center.z],[A.center.x,A.center.z]],{tmax:8});
    out.doors[d.id]={fwd_ok:res.ok,reached:res.reached,hyp:res.hyp,t:res.t,stuck:res.stuckTicks,md:res.md,end:res.end,back_ok:back.ok,back_end:back.end};}
  // garage route to driveway
  out.garage=(place(10.5,0,-0.3,-90),follow([[13,-0.5],[17.5,-0.5]]));
  out.garageIn=follow([[13,-0.5],[10.5,-0.3],[10.4,2.2],[9.5,3.56]]);
  // wall slides & corners & furniture
  const slide=(x,y,z,yaw)=>{place(x,y,z);P.look(yaw*Math.PI/180,0);const a=rec(2,{w:2},30);return {start:[x,z],yaw,a,md:+depth().toFixed(3)};};
  out.slides=[slide(4.2,0,6.0,30),slide(4.2,0,6.0,-150),slide(10.8,0,8.3,-60),slide(6.3,3.15,4.5,60)];
  out.corners=[];for(const [x,y,z] of [[4.6,0,9.3],[10.8,0,8.3],[1.75,0,1.3],[6.3,3.15,4.5],[5.19,3.15,8.39],[9.5,0,3.56],[10.5,0,-0.3]])for(const yaw of [45,135,-45,-135]){place(x,y,z);P.look(yaw*Math.PI/180,0);let md=0;P.simKeys.set('w',3);P.simKeys.set('shift',3);for(let i=0;i<360;i++){step();md=Math.max(md,depth());}P.simKeys.clear();const p1=P.feet.clone();P.look((yaw+180)*Math.PI/180,0);rec(1,{w:1});out.corners.push({x,z,yaw,hit:[+p1.x.toFixed(2),+p1.y.toFixed(2),+p1.z.toFixed(2)],esc:+P.feet.distanceTo(p1).toFixed(2),md:+md.toFixed(3)});}
  // furniture: walk straight lines through the living and bedrooms, check min dist of camera to any visible mesh
  const rayc=new T.Raycaster();const clip=[];
  for(const [x,y,z] of [[4.025,0,7.57],[10.025,0,8.39],[1.685,3.15,7.57],[5.19,3.15,8.39],[9.005,3.15,8.39],[1.75,0,1.3]])for(const yaw of [0,90,180,270]){place(x,y,z);P.look(yaw*Math.PI/180,0);P.simKeys.set('w',3);let near=9;for(let i=0;i<300;i++){step();if(i%10==0){for(const dv of [[1,0,0],[-1,0,0],[0,0,1],[0,0,-1],[0,-1,0]]){rayc.set(cam.position,new T.Vector3(...dv));rayc.far=2;const h=rayc.intersectObject(house.root,true).find(h=>h.object.visible&&!/GLASS/i.test(h.object.name));if(h&&dv[1]===0)near=Math.min(near,h.distance);}}}P.simKeys.clear();clip.push({x,y,z,yaw,end:P.feet.toArray().map(v=>+v.toFixed(2)),nearCam:+near.toFixed(3),md:+depth().toFixed(3)});}
  out.clip=clip;
  // glass
  place(0.6,0,9.6,-90);P.look(Math.PI/2,0);out.glass=rec(1.5,{w:2,shift:2},30);
  // closed door
  const dOff=house.doors.find(d=>/office/.test(d.id));if(dOff){const q0=dOff.node.quaternion.clone();dOff.node.rotation.set(0,0,0);dOff.node.updateMatrixWorld(true);place(2.6,0,3.4);P.look(0,0);out.closedDoor=rec(1.5,{w:2,shift:2},30);out.closedDoorEnd=P.feet.toArray();dOff.node.quaternion.copy(q0);dOff.node.updateMatrixWorld(true);}
  // footsteps
  out.surfaces={};for(const [n,x,y,z,yaw] of [['hall',4.8,0,3.7,180],['living',4.2,0,7,0],['kitchen',10.0,0,8.3,90],['vestibule',9.5,0,3.56,90],['garage',10.5,0,-0.3,90],['wc',0.75,0,3.71,0],['entrance',12.3,0,4.53,-90],['driveway',17.5,0,-0.5,0],['terrace',-1.5,0,5,0],['garden',-5,-0.3,0.8,0],['upstairs',6.3,3.15,4.5,90],['bath2',8.5,3.15,1.3,90],['bed2',5.19,3.15,8.39,90],['balcony',-1.3,3.15,7.6,0],['stairs',9.0,0,3.16,90]]){const n0=ev.length;place(x,y,z,yaw);P.look(yaw*Math.PI/180,0);P.simKeys.set('w',1.5);for(let i=0;i<180;i++)step();P.simKeys.clear();out.surfaces[n]={n:ev.length-n0,surf:[...new Set(ev.slice(n0).map(e=>e.surface+'/'+e.type))],feet:P.feet.toArray().map(v=>+v.toFixed(2)),sa:house.surfaceAt(P.feet)};}
  return out;
}),590000*3,'probe');
fs.writeFileSync(OUT+'metrics.json',JSON.stringify(R,null,1));console.log('metrics written');
const fr=async(n,code)=>{await hard(page.evaluate(code),180000);await shot(n);console.log(n);};
const S=(x,y,z,yaw,p,keys,ticks)=>`(()=>{const g=__game.game,P=g.player;P.simKeys.clear();P.teleport(${x},${y}+P.eyeHeight,${z},${yaw},${p});g.holdPhysics=false;${Object.entries(keys).map(([k,v])=>`P.simKeys.set('${k}',${v});`).join('')}for(let i=0;i<${ticks};i++)g._step(1/120);})()`;
await fr('f1_hall_stand',S(4.8,0,3.7,180,0,{},60));
await fr('f2_sprint_fov',S(14.2,0,-1,90,0,{w:3,shift:3},90));
await fr('f3_crouch',S(4.2,0,7,0,0,{crouch:3},120));
await fr('f4_stairs_up_mid',S(9.6,0,3.16,90,0,{w:3},150));
await fr('f5_stairs_down_mid',S(4.4,3.15,3.16,-90,-15,{w:3},150));
await fr('f6_stairs_down_last',S(4.4,3.15,3.16,-90,-10,{w:6},370));
await fr('f7_wall_press',S(4.2,0,7,0,0,{w:3},300));
await fr('f8_garage_route',S(10.5,0,-0.3,-90,0,{w:3},150));
await fr('f9_terrace',S(-1.5,0,5,90,-5,{},60));
await fr('f10_balcony',S(-1.3,3.15,7.6,90,-5,{},60));
await fr('f11_doorway_office',S(2.6,0,3.4,0,0,{w:3},60));
const mv=await hard(page.evaluate(async()=>{const g=__game;g.teleport(14.2,1.67,-1,90,0);const a=g.state().feet;await g.move('w',1);const b=g.state().feet;return {a,b};}),300000,'mv');
fs.writeFileSync(OUT+'move.json',JSON.stringify({mv,errs}));console.log('done');
} catch(e){console.log('ERR',e);} finally { await browser.close(); }
