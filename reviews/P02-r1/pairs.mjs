import { openGame, capture } from '../../scripts/shot.mjs';
const V = {
  ours_ext_garden: [[-10,1.6,15.5],-40,6],
  ours_ext_front: [[21,1.6,10],60,5],
  ours_living: [[7.6,1.6,5.2],120,-4],
  ours_office: [[3.2,1.6,2.3],-110,-6],
  ours_stair_hall: [[3.0,1.6,6.0],-60,12],
};
const { browser, page } = await openGame({ w:1600, h:900, quality:'ultra', tod:'day' });
for (const [k,[pos,yaw,pitch]] of Object.entries(V)) { await capture(page,{view:{pos,yaw,pitch},tod:'day',out:`reviews/P02-r1/${k}.png`}); console.log(k); }
await browser.close();
