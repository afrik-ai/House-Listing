import { openGame } from '../../scripts/shot.mjs';
import fs from 'fs';
let { browser, page, errors } = await openGame({ w:1280, h:720, quality:'medium', tod:'day' });
const tests = [
  // name, eye start, yaw, key, seconds
  ['street_to_front_door', [18,1.4,4.2], 90, 'w', 4],
  ['vestibule_up_stairs', [9.8,1.65,3.2], 90, 'w', 6],
  ['stairs_down', [4.4,4.8,3.2], -90, 'w', 6],
  ['living_to_terrace_west', [1.5,1.65,7.5], 90, 'w', 3],
  ['living_to_garden_south', [4,1.65,8.5], 180, 'w', 3],
  ['terrace_to_living', [-1.5,1.65,7.5], -90, 'w', 3],
  ['master_to_balcony', [1.2,4.8,7.5], 90, 'w', 3],
  ['balcony_off_edge_west', [-1.3,4.8,7.5], 90, 'w', 3],
  ['balcony_to_master', [-1.3,4.8,7.5], -90, 'w', 3],
  ['hall_to_office_door', [2.6,1.65,3.8], 0, 'w', 3],
  ['hall_to_wc_door', [2.2,1.65,3.7], 90, 'w', 3],
  ['hall_to_storage_n', [4.25,1.65,3.8], 0, 'w', 3],
  ['vestibule_to_garage', [9.95,1.65,3.8], 0, 'w', 3],
  ['vestibule_to_front_out', [10.3,1.65,3.8], -90, 'w', 4],
  ['vestibule_to_cloak', [8.78,1.65,3.6], 180, 'w', 3],
  ['living_to_kitchen', [6,1.65,8], -90, 'w', 3],
  ['garage_out_east', [12,1.65,-1.5], -90, 'w', 4],
  ['living_wall_north_push', [3,1.65,6], 0, 'w', 4],
  ['landing_to_bed2', [5,4.8,5.5], 180, 'w', 3],
  ['landing_to_bed3', [9,4.8,5.5], 180, 'w', 3],
  ['landing_to_master', [4,4.8,4.5], 90, 'w', 3],
  ['landing_to_bath2', [7.5,4.8,3.0], 0, 'w', 3],
  ['landing_to_laundry', [8.6,4.8,5.6], -90, 'w', 3],
  ['landing_into_void', [6,4.8,4.3], 0, 'w', 3],
  ['master_to_wardrobe_a', [1.3,4.8,5.2], 0, 'w', 3],
  ['master_to_bath_master', [0.8,4.8,5.2], 0, 'w', 4],
];
const res = [];
for (const [name, eye, yaw, key, sec] of tests) {
  let r; for (let attempt=0;attempt<3;attempt++){ try { r = await page.evaluate(async ({eye,yaw,key,sec}) => {
    const g = window.__game;
    g.teleport(eye[0],eye[1],eye[2],yaw,0);
    for (let i=0;i<3;i++) await new Promise(r=>requestAnimationFrame(r));
    const s0 = g.state();
    const path=[];
    const p = g.move(key, sec);
    const iv = setInterval(()=>{ const s=g.state(); path.push(s.feet); }, 250);
    await p; clearInterval(iv);
    for (let i=0;i<10;i++) await new Promise(r=>requestAnimationFrame(r));
    const s1 = g.state();
    return { from:s0.feet, fromRoom:s0.room?.id, to:s1.feet, toRoom:s1.room?.id??'outside', onGround:s1.onGround, path };
  }, {eye,yaw,key,sec}); break; } catch(e){ console.log("retry",name,e.message.slice(0,60)); await page.waitForTimeout(3000); await page.waitForFunction(()=>!!window.__game,null,{timeout:180000}); await page.evaluate(()=>window.__game.ready); } }
  res.push({name, ...r});
  console.log(name.padEnd(26), (r.fromRoom||'out').padEnd(10),'->', String(r.toRoom).padEnd(10), 'from', r.from.join(','), 'to', r.to.join(','), 'ground', r.onGround);
}
fs.writeFileSync('reviews/P02-r1/walk.json', JSON.stringify(res,null,1));
console.log('errors', JSON.stringify(errors));
await browser.close();
