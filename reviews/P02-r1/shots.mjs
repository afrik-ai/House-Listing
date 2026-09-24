import { openGame, capture } from '../../scripts/shot.mjs';
const V = {
  front_door: [[18.5,1.6,4.2],90,2],
  front_wide: [[27,1.8,1.5],90,6],
  front_ne_oblique: [[24,1.7,-10],130,6],
  front_se_oblique: [[24,1.7,14],60,6],
  garage_door: [[17,1.6,-0.6],90,-3],
  roofs_high_e: [[22,10,4],90,-22],
  aerial_sw: [[-12,14,20],-48,-26],
  aerial_ne: [[22,15,-12],130,-30],
  terrace_under: [[-1.3,1.6,1.2],180,4],
  terrace_pillar: [[-4.5,1.4,12.5],-45,8],
  terrace_ceiling_joint: [[-1.2,1.7,6],90,35],
  balcony_south: [[-1.2,4.75,5.3],180,-8],
  balcony_west: [[-0.6,4.75,7.5],90,-12],
  balcony_from_below: [[-7,2.2,7.5],-90,18],
  window_reveal_s: [[4.0,4.6,12.2],-28,-3],
  living_slide_int: [[2.0,1.6,6.5],60,-5],
  kitchen_window: [[10,1.6,8.2],180,-5],
  stair_side: [[6.3,1.6,4.5],-20,15],
  stair_top_down: [[4.2,4.75,3.2],-90,-35],
  stair_underside: [[5.5,1.2,4.3],-30,40],
  door_casing: [[6,1.6,3.7],0,-5],
  garage_int: [[9.2,1.6,-1.7],-90,0],
  hall1_void: [[7.5,4.75,5.2],60,-30],
  bed2_window_int: [[5.2,4.75,8.0],180,-5],
};
const only = process.argv[2] ? process.argv[2].split(',') : Object.keys(V);
const { browser, page, errors } = await openGame({ w:1600, h:900, quality:'ultra', tod:'day' });
for (const k of only) {
  const [pos,yaw,pitch] = V[k];
  await capture(page, { view:{pos,yaw,pitch}, tod:'day', out:`reviews/P02-r1/${k}.png` });
  console.log('shot', k);
}
console.log('errors', JSON.stringify(errors));
await browser.close();
