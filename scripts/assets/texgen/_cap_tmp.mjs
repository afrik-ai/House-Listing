import { openGame, stable } from '/home/user/House-Listing/scripts/shot.mjs';
const G = await openGame({ id: 'villa-nova', w: 1280, h: 720, quality: 'medium', tod: 'day', attempts: 4 });
const { page, browser } = G;
const shot = async (view, out) => {
  await stable(page, () => page.evaluate(async (v) => { const g = window.__game; g.hideUI(true); g.teleport(v.pos[0], v.pos[1], v.pos[2], v.yaw ?? 0, v.pitch ?? 0); g.render(); }, view), 'tp', 120000);
  await new Promise(r => setTimeout(r, 12000));
  await page.evaluate(() => window.__game.render());
  await page.screenshot({ path: out, timeout: 300000 }); console.error('shot', out);
};
try {
  const v = await stable(page, () => page.evaluate(() => window.__game.views()), 'views', 120000);
  const all = [...v.rooms, ...v.exteriors]; console.error(all.map(x => x.id).join(' '));
  const pick = (re) => all.find(x => re.test(x.id));
  const L = pick(/^living$/); if (L) { await shot(L, 'reviews/textures/r2/living.png'); await shot({ ...L, pitch: -0.1, yaw: (L.yaw ?? 0) + 1.2 }, 'reviews/textures/r2/living_wall.png'); }
  for (const [re, n] of [[/bath_master|bath/, 'bath'], [/front|street/, 'ext_front'], [/south|garden/, 'ext_south']]) { const x = pick(re); if (x) await shot(x, `reviews/textures/r2/${n}.png`); }
} finally { await browser.close(); }
