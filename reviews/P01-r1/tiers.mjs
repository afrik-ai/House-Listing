import { openGame } from '../../scripts/shot.mjs';
const { browser, page } = await openGame({ w:1600, h:900, quality:'high', tod:'day' });
for (const q of ['low','medium','high','ultra']) {
  const s = await page.evaluate(q=>{ window.__game.setQuality(q); const G=window.__game.game; const sun=[]; window.__game.scene.traverse(o=>{ if(o.isDirectionalLight) sun.push(o.shadow.mapSize.x, o.shadow.radius, o.shadow.blurSamples); }); return { settings:G.renderer._settings, pr:G.renderer.gl.getPixelRatio(), aoEnabled: G.postfx.ao?.enabled, aoCfg: G.postfx.ao?.configuration ? {r:G.postfx.ao.configuration.aoRadius, i:G.postfx.ao.configuration.intensity, s:G.postfx.ao.configuration.aoSamples, q:G.postfx.ao.configuration.halfRes} : null, sun, st: G.renderer.gl.shadowMap.type }; }, q);
  console.log(q, JSON.stringify(s));
}
await browser.close();
