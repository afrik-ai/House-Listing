import { openGame, capture } from '../../scripts/shot.mjs';
let { browser, page } = await openGame({ w:1600, h:900, quality:'ultra', tod:'day' });
async function run(eye,yaw,key,sec){ return page.evaluate(async ({eye,yaw,key,sec}) => {
    const g = window.__game; g.teleport(eye[0],eye[1],eye[2],yaw,0);
    for (let i=0;i<3;i++) await new Promise(r=>requestAnimationFrame(r));
    const s0=g.state(); await g.move(key, sec);
    for (let i=0;i<5;i++) await new Promise(r=>requestAnimationFrame(r));
    const s1=g.state(); return { from:s0.feet, to:s1.feet, eye:s1.eye, room:s1.room?.id||'outside', ground:s1.onGround };
  }, {eye,yaw,key,sec}); }
const T = [
 ['garden_to_terrace', [-1.3,1.4,13],0,'w',4],
 ['garden_to_terrace_w', [-5,1.4,7.5],-90,'w',4],
 ['cloak_from_vest', [8.75,1.65,4.05],180,'w',2.5],
 ['street_to_door_again', [18,1.4,4.2],90,'w',4],
 ['stairs_up_sprintless', [9.6,1.65,3.16],90,'w',8],
];
for (const [n,e,y,k,s] of T) { const r = await run(e,y,k,s); console.log(n.padEnd(22), JSON.stringify(r)); }
// stuck shots
await capture(page,{view:{pos:[8.078,0.844+1.65,3.16],yaw:90,pitch:10},out:'reviews/P02-r1/stuck_stairs.png'});
await capture(page,{view:{pos:[8.6,1.9,3.9],yaw:90,pitch:25},out:'reviews/P02-r1/stuck_stairs_side.png'});
await capture(page,{view:{pos:[15.2,1.35,3.6],yaw:90,pitch:-30},out:'reviews/P02-r1/stuck_front_step.png'});
await capture(page,{view:{pos:[2.6,1.65,2.95],yaw:0,pitch:-5},out:'reviews/P02-r1/door_midpass.png'});
await capture(page,{view:{pos:[3.2,1.6,4.2],yaw:-20,pitch:-5},out:'reviews/P02-r1/door_casing.png'});
await capture(page,{view:{pos:[13.2,1.5,4.6],yaw:120,pitch:40},out:'reviews/P02-r1/canopy_soffit.png'});
await capture(page,{view:{pos:[5,7.0,8],yaw:180,pitch:-30},out:'reviews/P02-r1/roof_parapet.png'});
await capture(page,{view:{pos:[9.5,6.6,-2.2],yaw:120,pitch:-20},out:'reviews/P02-r1/hip_fascia.png'});
await capture(page,{view:{pos:[16,3.9,-4.5],yaw:60,pitch:-10},out:'reviews/P02-r1/garage_roof_eave.png'});
await capture(page,{view:{pos:[6.5,1.2,5.2],yaw:0,pitch:12},out:'reviews/P02-r1/stair_open_side.png'});
await browser.close();
