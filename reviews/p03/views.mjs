import { openGame } from '../../scripts/shot.mjs';
const { browser, page, errors } = await openGame({ w: 800, h: 450, quality: 'high', tod: 'day' });
const v = await page.evaluate(() => ({ views: window.__game.views(), plugins: [...window.__game.game.plugins.keys()], stats: window.__game.stats() }));
console.log(JSON.stringify(v, null, 1));
console.log('errors', errors);
await browser.close();
