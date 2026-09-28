import fs from 'node:fs';
import { openGame, hard } from '../../../scripts/shot.mjs';
const OUT='reviews/critic/P08-r2/';
const { browser, page } = await openGame({ w: 960, h: 540, quality: 'low', quiet: true });
const shot = async (n)=>{ await hard(page.evaluate(()=>window.__game.render()),120000); await page.screenshot({path:OUT+n+'.png'}); };
try {
const R = await hard(page.evaluate(() => {
  const game=__game.game,P=game.player,cam=game.camera,house=game.house;game.state='playing';game.holdPhysics=false;const H=1/120;
  const steps=(s,f)=>{for(let i=0;i<Math.round(s/H);i++){game._step(H);f?.(i);}};
  const place=(x,y,z)=>{P.simKeys.clear();P.teleport(x,y+1.67,z,0,0);game.holdPhysics=false;steps(0.5);};
  const out={runs:[]};
  let best=null;
  for(const [x,y,z] of [[-8,-0.3,-5],[-10,-0.3,0],[-6,-0.3,-8],[20,0,-4],[18,0,6],[-12,-0.3,-10]]) for(const yaw of [0,90,180,-90]){place(x,y,z);P.look(yaw*Math.PI/180,0);const p0=P.feet.clone();P.simKeys.set('w',3);steps(3);const d=P.feet.distanceTo(p0);out.runs.push([x,z,yaw,+d.toFixed(2)]);if(!best||d>best.d)best={x,y,z,yaw,d};}
  out.best=best;
  const curve=(keys,hold,tot)=>{place(best.x,best.y,best.z);P.look(best.yaw*Math.PI/180,0);for(const k of keys)P.simKeys.set(k,hold);const a=[],bob=[];steps(tot,i=>{if(i%6==0)a.push([+(i*H).toFixed(2),+P.speed.toFixed(2),+P._fov.toFixed(1)]);if(i>60&&i<hold*120)bob.push(cam.position.y-P.feet.y);});return {a,bob:[Math.min(...bob),Math.max(...bob)]};};
  out.walk=curve(['w'],1.5,2.2);out.sprint=curve(['w','shift'],1.5,2.2);out.crouch=curve(['w','crouch'],1.5,2.2);
  // stair down detail
  P.simKeys.clear();P.teleport(4.0,3.15+1.67,5.2,0,0);game.holdPhysics=false;steps(0.5);const ys=[];
  for(const [tx,tz] of [[4.0,3.16],[4.4,3.16],[9.6,3.16],[10.0,3.6]]){let t=0;for(;;){const dx=tx-P.feet.x,dz=tz-P.feet.z;if(Math.hypot(dx,dz)<0.2||t>12)break;P.look(Math.atan2(-dx,-dz),0);P.simKeys.set('w',1);game._step(H);t+=H;ys.push([+P.feet.x.toFixed(3),+P.feet.z.toFixed(3),+P.feet.y.toFixed(3),+cam.position.y.toFixed(4)]);}}
  P.simKeys.clear();out.pops=[];for(let i=1;i<ys.length;i++){const d=ys[i][3]-ys[i-1][3];if(Math.abs(d)>0.03)out.pops.push([i,ys[i-1],ys[i]]);}
  // balcony walk
  place(-1.3,3.15,5.16);out.balc=[];for(const yaw of [0,90,180,-90]){place(-1.3,3.15,5.16);P.look(yaw*Math.PI/180,0);P.simKeys.set('w',2);steps(2);out.balc.push([yaw,P.feet.toArray().map(v=>+v.toFixed(2))]);}
  return out;
}),580000,'p2');
fs.writeFileSync(OUT+'metrics2.json',JSON.stringify(R,null,1));
const fr=async(n,code)=>{await hard(page.evaluate(code),120000);await shot(n);};
await fr('f9_east_block',`(()=>{const g=__game.game,P=g.player;P.simKeys.clear();P.teleport(20.2,1.67,-4,-90,-5);g.holdPhysics=false;for(let i=0;i<30;i++)g._step(1/120);})()`);
await fr('f10_stairdown_pop',`(()=>{const g=__game.game,P=g.player;P.simKeys.clear();P.teleport(4.0,3.15+1.67,5.2,180,-10);g.holdPhysics=false;for(let i=0;i<30;i++)g._step(1/120);})()`);
console.log('done');
} finally { await browser.close(); }
