import fs from 'node:fs';
import { openGame, hard } from '../../../scripts/shot.mjs';
const OUT='reviews/critic/P08-r3/';
const { browser, page } = await openGame({ w: 1280, h: 720, quality: 'low', quiet: true });
const shot = async (n)=>{ await hard(page.evaluate(()=>window.__game.render()),180000); await page.screenshot({path:OUT+n+'.png'}); };
try {
await hard(page.evaluate(() => {
  const game=__game.game,P=game.player,ph=game.physics,house=game.house,T=__game.THREE;const H=1/120,cam=game.camera;
  const step=()=>game._step(H);
  const place=(x,y,z,yaw=0)=>{P.simKeys.clear();P.teleport(x,y+P.eyeHeight+0.02,z,yaw,0);game.holdPhysics=false;for(let i=0;i<60;i++)step();};
  const follow=(wps,{sprint=false,tmax=10}={})=>{let reached=0,pop=0,big=[],stuck=0,prev=P.feet.clone(),t=0;for(const [tx,tz] of wps){let tt=0;for(;;){const dx=tx-P.feet.x,dz=tz-P.feet.z;if(Math.hypot(dx,dz)<0.2){reached++;break;}if(tt>tmax)break;P.look(Math.atan2(-dx,-dz),0);P.simKeys.set('w',1);if(sprint)P.simKeys.set('shift',1);const cy=cam.position.y;step();tt+=H;t+=H;const d=cam.position.y-cy;if(Math.abs(d)>pop)pop=Math.abs(d);if(Math.abs(d)>0.018)big.push([+P.feet.x.toFixed(2),+P.feet.y.toFixed(3),+d.toFixed(4)]);if(P.feet.distanceTo(prev)<0.003)stuck++;prev.copy(P.feet);}if(tt>tmax)break;}P.simKeys.clear();for(let i=0;i<20;i++)step();return {ok:reached===wps.length,reached,n:wps.length,t:+t.toFixed(2),end:P.feet.toArray().map(v=>+v.toFixed(2)),pop:+pop.toFixed(4),big:big.length,bigS:big.slice(0,5),stuck};};
  const rec=(s,keys,every=3)=>{Object.entries(keys).forEach(([k,v])=>P.simKeys.set(k,v));const a=[];for(let i=0;i<Math.round(s/H);i++){step();if(i%every==0)a.push([+(i*H).toFixed(3),+P.speed.toFixed(2),+(cam.position.y-P.feet.y).toFixed(4),+cam.fov.toFixed(2),+P.feet.z.toFixed(3)]);}P.simKeys.clear();return a;};
  const out={};
  place(17.5,0,3,0); out.walk=rec(0.8,{w:0.6}); place(17.5,0,3,0); out.sprint=rec(1.2,{w:0.8,shift:0.8});
  place(17.5,0,3,0); const hb=[];P.simKeys.set('w',2);for(let i=0;i<200;i++){step();hb.push(cam.position.y-P.feet.y);}P.simKeys.clear();out.bob=[Math.min(...hb.slice(80)),Math.max(...hb.slice(80))];
  const rc={};for(const r of house.rooms())rc[r.id]=r;const C=r=>Array.isArray(r.center)?r.center:[r.center.x,r.center.y,r.center.z];
  const eye=r=>r.eye?(Array.isArray(r.eye)?r.eye:[r.eye.x,r.eye.y,r.eye.z]):C(r);
  out.roomSample=JSON.stringify(house.rooms()[0]).slice(0,300);
  out.doors={};for(const d of (house.meta?.doors||[])){const A=d.room_a==='exterior'?{center:[12.9,0,4.53]}:rc[d.room_a],B=rc[d.room_b];if(!A||!B){out.doors[d.id]='noroom';continue;}const a=eye(A),b=eye(B);let best=null;
    for(const [ax,sg] of [['x',1],['x',-1],['z',1],['z',-1]]){const c=[d.hinge[0]+(ax==='x'?sg*d.width/2:0),d.hinge[2]+(ax==='z'?sg*d.width/2:0)];const nx=ax==='x'?0:1,nz=1-nx;const s=Math.sign((a[0]-c[0])*nx+(a[2]-c[1])*nz)||1;
      place(a[0],d.hinge[1],a[2]);const f=follow([[c[0]+nx*s*0.6,c[1]+nz*s*0.6],c,[c[0]-nx*s*0.6,c[1]-nz*s*0.6],[b[0],b[2]]]);if(!best||f.reached>best.reached)best={hyp:ax+sg,...f};if(f.ok)break;}
    const back=best.ok?follow([[b[0],b[2]],[a[0],a[2]]]):null;
    out.doors[d.id]={ok:best.ok,reached:best.reached,hyp:best.hyp,t:best.t,stuck:best.stuck,end:best.end,back:back&&back.ok,backEnd:back&&back.end,start:a.map(v=>+v.toFixed(2))};}
  // stairs full routes hall -> hall1 and back (centre), and down to vestibule
  place(9.5,0,3.56,90);out.stairUpFromVest=follow([[10.0,3.16],[9.4,3.16],[4.3,3.16],[4.0,4.5],[6.3,4.5]]);
  out.stairDownToHall=follow([[4.0,4.5],[4.0,3.16],[4.4,3.16],[9.9,3.16],[9.5,3.9]]);
  out.stairDownSprint=(place(4.0,3.15,4.5,0),follow([[4.0,3.16],[4.4,3.16],[9.9,3.16],[9.5,3.9]],{sprint:true}));
  // blockers
  const probe=(x,y,z,dir)=>{const r=new T.Raycaster(new T.Vector3(x,y,z),new T.Vector3(...dir).normalize(),0,3);const hs=r.intersectObject(house.root,true).slice(0,3);return hs.map(h=>[h.object.name,+h.distance.toFixed(2),h.object.visible]);};
  out.block={stairFoot:probe(10.3,0.5,3.03,[0,0,1]),terraceN:probe(-1.35,0.5,1.1,[0,0,-1]),garageE:probe(12.5,1,-0.4,[1,0,0]),office:[probe(1.75,0.5,1.3,[1,0,0]),probe(1.75,0.3,1.3,[0,-1,0]),probe(1.75,1.2,1.3,[0,1,0])]};
  place(1.75,0,1.3);out.officeOverlap={feet:P.feet.toArray(),ov:ph.overlaps(P.feet,1.75)};
  const n=[];house.root.traverse(o=>{if(/garage/i.test(o.name)&&/door|gate|sect/i.test(o.name))n.push(o.name)});out.garageNodes=n.slice(0,20);
  // terrace steps from garden side up and down
  place(-1.45,-0.3,-2.0,0);out.terrStepsUp=follow([[-1.45,-0.3],[-1.45,2.0],[-1.3,5.0]]);out.terrStepsDown=follow([[-1.45,2.0],[-1.45,-0.3],[-1.45,-2.0]]);
  // balcony from master
  place(1.685,3.15,7.57,90);out.toBalcony=follow([[0.2,7.57],[-1.3,7.6]]);
  window.__out=out;
}),590000,'probe2');
fs.writeFileSync(OUT+'metrics2.json',JSON.stringify(await page.evaluate(()=>window.__out),null,1));console.log('metrics2');
// frame sequence: last steps of stair descent
await hard(page.evaluate(()=>{const g=__game.game,P=g.player;P.simKeys.clear();P.teleport(4.4,3.15+P.eyeHeight,3.16,-90,-12);g.holdPhysics=false;for(let i=0;i<30;i++)g._step(1/120);}),120000);
for(let k=0;k<4;k++){await hard(page.evaluate(k=>{const g=__game.game,P=g.player;P.simKeys.set('w',1);for(let i=0;i<(k==0?160:40);i++){if(P.feet.x>10.05)break;g._step(1/120);}P.simKeys.clear();window.__s=P.feet.toArray();},k),120000);await shot('seq_down_'+k);console.log('seq',k,await page.evaluate(()=>window.__s));}
const S=(x,y,z,yaw,p,keys,ticks)=>`(()=>{const g=__game.game,P=g.player;P.simKeys.clear();P.teleport(${x},${y}+P.eyeHeight,${z},${yaw},${p});g.holdPhysics=false;${Object.entries(keys).map(([k,v])=>`P.simKeys.set('${k}',${v});`).join('')}for(let i=0;i<${ticks};i++)g._step(1/120);return P.feet.toArray().map(v=>+v.toFixed(2)).concat([+g.camera.fov.toFixed(1)]);})()`;
const fr=async(n,c)=>{const r=await hard(page.evaluate(c),180000);await shot(n);console.log(n,r);};
await fr('g1_sprint_open',S(17.5,0,3,0,0,{w:3,shift:3},60));
await fr('g2_walk_open',S(17.5,0,3,0,0,{w:3},60));
await fr('g3_stairs_up_mid',S(10.0,0,3.16,90,5,{w:3},180));
await fr('g4_living_sofa_press',S(4.025,0,7.57,90,-10,{w:3},300));
await fr('g5_doorway_bed2',S(6.3,3.15,5.8,180,0,{w:0.5},40));
await fr('g6_garden_steps',S(-1.45,-0.3,-2.0,0,-5,{w:3},120));
await fr('g7_terrace',S(-1.3,0,4.0,90,-3,{},30));
console.log('done');
} catch(e){console.log('ERR',e);} finally { await browser.close(); }
