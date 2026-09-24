import { openGame } from '../../scripts/shot.mjs';
import fs from 'fs';
let { browser, page, errors } = await openGame({ w:1280, h:720, quality:'medium', tod:'day' });
const h = JSON.parse(fs.readFileSync('houses/villa-nova/house.json','utf8'));
const rooms = [...h.ground_rooms.map(r=>({...r,lvl:0})), ...h.first_rooms.map(r=>({...r,lvl:3.15}))];
function rectsOf(r){ return r.rects || [r.rect]; }
function inRoom(r,x,z){ return rectsOf(r).some(([rx,rz,w,d])=>x>rx&&x<rx+w&&z>rz&&z<rz+d); }
const tests = [];
for (const o of h.openings.filter(o=>/door/.test(o.type))) {
  const lvl = o.level==='first'?3.15:0;
  const into = rooms.find(r=>r.id===o.swing_into && (r.lvl===lvl));
  const [x,z] = o.at;
  // wall orientation: which axis? try offsets both ways and see which lands in the 'into' room
  let best=null;
  for (const [dx,dz] of [[1,0],[-1,0],[0,1],[0,-1]]) {
    const ix=x+dx*0.8, iz=z+dz*0.8;
    if (into && inRoom(into,ix,iz)) best=[dx,dz];
  }
  if (!best) { console.log('skip', o.id); continue; }
  const [dx,dz]=best;
  const sx=x-dx*0.9, sz=z-dz*0.9;
  // yaw: dir = (-sin y, -cos y)
  const yaw = Math.atan2(-dx,-dz)*180/Math.PI;
  tests.push([o.id+'_in', [sx,lvl+1.65,sz], yaw, 'w', 2.2, o.swing_into]);
  tests.push([o.id+'_out', [x+dx*0.9,lvl+1.65,z+dz*0.9], yaw+180, 'w', 2.2, null]);
}
tests.push(['stairs_up_centre',[9.8,1.65,3.16],90,'w',7,'hall1']);
tests.push(['stairs_up_north',[9.8,1.65,2.95],90,'w',7,'hall1']);
tests.push(['street_to_door',[18,1.4,3.8],90,'w',4,'vestibule']);
const res=[];
for (const [name, eye, yaw, key, sec, expect] of tests) {
  let r;
  for (let a=0;a<3;a++){ try { r = await page.evaluate(async ({eye,yaw,key,sec}) => {
    const g = window.__game; g.teleport(eye[0],eye[1],eye[2],yaw,0);
    for (let i=0;i<3;i++) await new Promise(r=>requestAnimationFrame(r));
    const s0=g.state(); await g.move(key, sec);
    for (let i=0;i<5;i++) await new Promise(r=>requestAnimationFrame(r));
    const s1=g.state();
    return { fromRoom:s0.room?.id||'out', from:s0.feet, to:s1.feet, toRoom:s1.room?.id||'outside' };
  }, {eye,yaw,key,sec}); break; } catch(e) { console.log('retry'); await page.waitForTimeout(3000); await page.waitForFunction(()=>!!window.__game,null,{timeout:180000}); await page.evaluate(()=>window.__game.ready);} }
  const ok = expect ? r.toRoom===expect : r.toRoom!==r.fromRoom;
  res.push({name,ok,...r});
  console.log((ok?'PASS':'FAIL'), name.padEnd(22), r.fromRoom.padEnd(10),'->',r.toRoom.padEnd(10),'from',r.from.join(','),'to',r.to.join(','));
}
fs.writeFileSync('reviews/P02-r1/walk2.json', JSON.stringify(res,null,1));
await browser.close();
