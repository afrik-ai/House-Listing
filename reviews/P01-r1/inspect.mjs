import { openGame } from '../../scripts/shot.mjs';
const { browser, page } = await openGame({ w:1600, h:900, quality:'ultra', tod:'day' });
const r = await page.evaluate(()=>{
  const g=window.__game, G=g.game, sc=g.scene, THREE=g.THREE;
  const r=G.renderer.gl || G.renderer.renderer || G.renderer;
  const lights=[]; sc.traverse(o=>{ if(o.isLight) lights.push({type:o.type,name:o.name,int:+o.intensity.toFixed?.(3),vis:o.visible,cast:o.castShadow,pos:o.position.toArray().map(v=>+v.toFixed(1)), map:o.shadow?.mapSize?.x, bias:o.shadow?.bias, nbias:o.shadow?.normalBias, radius:o.shadow?.radius, cam: o.shadow?.camera?.isOrthographicCamera? [o.shadow.camera.left,o.shadow.camera.right,o.shadow.camera.top,o.shadow.camera.bottom,o.shadow.camera.far]:null }); });
  let casters=0, receivers=0, meshes=0; sc.traverse(o=>{ if(o.isMesh){meshes++; if(o.castShadow)casters++; if(o.receiveShadow)receivers++;} });
  const gl=r.isWebGLRenderer? r : null;
  return { toneMapping: gl?.toneMapping, exposure: gl?.toneMappingExposure, shadowType: gl?.shadowMap?.type, shadowEnabled: gl?.shadowMap?.enabled, outCS: gl?.outputColorSpace, env: !!sc.environment, envInt: sc.environmentIntensity, bgInt: sc.backgroundIntensity, lights, meshes, casters, receivers, rendererKeys:Object.keys(G.renderer).slice(0,40), gameKeys:Object.keys(G).slice(0,60) };
});
console.log(JSON.stringify(r,null,1));
await browser.close();
