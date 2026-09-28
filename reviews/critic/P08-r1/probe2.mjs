import fs from 'node:fs';
import { openGame, hard } from '../../../scripts/shot.mjs';
const OUT='reviews/critic/P08-r1/';
const { browser, page } = await openGame({ w: 960, h: 540, quality: 'low', quiet: true });
try {
const R = await hard(page.evaluate(() => {
  const game=__game.game,P=game.player,T=__game.THREE,house=game.house,cam=game.camera;
  game.state='playing'; game.holdPhysics=false; const H=1/120; const ev=[]; game.on('footstep',e=>ev.push(e));
  const steps=(s,f)=>{for(let i=0;i<Math.round(s/H);i++){game._step(H);f?.(i);}};
  const place=(x,y,z)=>{P.simKeys.clear();P.teleport(x,y+1.67,z,0,0);game.holdPhysics=false;steps(0.6);};
  const out={}; const X=20,Z=-4; // open ground, walk east (+x => yaw -90)
  const curve=(keys,hold,tot)=>{place(X,0,Z);P.look(-Math.PI/2,0);for(const k of keys)P.simKeys.set(k,hold);const a=[];const bob=[];steps(tot,i=>{if(i%6==0)a.push([+(i*H).toFixed(2),+P.speed.toFixed(2),+(P._fov).toFixed(2),+(cam.position.y-P.feet.y).toFixed(4)]);bob.push(cam.position.y-P.feet.y);});return {a,feet:P.feet.toArray()};};
  out.walk=curve(['w'],1.5,2.2); out.sprint=curve(['w','shift'],1.5,2.2); out.crouch=curve(['w','crouch'],1.5,2.2);
  // strafe roll / cam quaternion while strafing
  place(X,0,Z);P.look(-Math.PI/2,0);P.simKeys.set('d',1);let roll=0;steps(1,()=>{const e=new T.Euler().setFromQuaternion(cam.quaternion,'YXZ');roll=Math.max(roll,Math.abs(e.z));});out.strafeRollDeg=roll*57.3;
  // ground surfaces sampled directly
  out.surf={};for(const [n,x,y,z] of [['terrace',-1.3,0,5],['terrace2',-2,0,8],['garden',-5,-0.3,0.8],['balcony',-1.3,3.15,5],['street',15,0.2,4],['upHall',4,3.15,5.2]]){place(x,y,z);out.surf[n]={feet:P.feet.toArray().map(v=>+v.toFixed(2)),surface:house.surfaceAt?.(P.feet)};const n0=ev.length;P.look(0,0);P.simKeys.set('s',1.5);steps(1.5);out.surf[n].ev=ev.slice(n0).map(e=>e.surface+'/'+e.type);out.surf[n].end=P.feet.toArray().map(v=>+v.toFixed(2));}
  return out;
}),500000,'p2');
fs.writeFileSync(OUT+'metrics2.json',JSON.stringify(R,null,1)); console.log('done');
} finally { await browser.close(); }
