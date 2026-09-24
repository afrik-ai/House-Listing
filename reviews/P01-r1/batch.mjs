import { openGame, capture } from '../../scripts/shot.mjs';
const quality = process.argv[2]||'ultra';
const ids = (process.argv[3]||'living,kitchen,master,office,bath_master,garage,hall1,ext_garden_sw,ext_front_east,ext_south').split(',');
const tods = (process.argv[4]||'day,golden_hour,night').split(',');
const { browser, page, errors, loadMs, gpu } = await openGame({ w:1600, h:900, quality, tod:'day' });
console.log('gpu', gpu, 'loadMs', loadMs);
const views = await page.evaluate(()=>window.__game.views());
const all=[...views.rooms,...views.exteriors];
for (const tod of tods) for (const id of ids) {
  const v = all.find(x=>x.id===id);
  const r = await capture(page, { view:v, tod, out:`reviews/P01-r1/${quality}_${tod}_${id}.png` });
  console.log(tod, id, JSON.stringify(r.stats));
}
console.log('errors', JSON.stringify(errors));
await browser.close();
