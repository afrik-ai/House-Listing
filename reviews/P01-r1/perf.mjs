import { openGame, capture } from '../../scripts/shot.mjs';
const W=+(process.argv[2]||1920), H=+(process.argv[3]||1080);
const { browser, page, errors, loadMs } = await openGame({ w:W, h:H, quality:'high', tod:'day' });
const out={W,H,loadMs,walks:{},bench:{},switch:{}};
async function walk(q){
  await page.evaluate(q=>window.__game.setQuality(q), q);
  await page.evaluate(()=>{ window.__game.hideUI(true); window.__game.teleport(1.0,1.6,9.5,-60,0); });
  await page.waitForTimeout(1000);
  await page.evaluate(()=>{ const P=window.__game.game.player; window.__ft=[]; let last=performance.now(), t0=last, y0=P.yaw;
    function f(now){ window.__ft.push(now-last); last=now; const t=(now-t0)/1000; P.look(y0+Math.sin(t*1.3)*1.4, Math.sin(t*0.7)*0.15); if(now-t0<10000) requestAnimationFrame(f); else window.__done=true; }
    window.__done=false; requestAnimationFrame(f); });
  // scripted keys: W 4s, D 1.5s, S 2s, A 1.5s, W+Shift 1s
  const seq=[['KeyW',4000],['KeyD',1500],['KeyS',2000],['KeyA',1500],['KeyW',1000]];
  for(const [k,ms] of seq){ await page.keyboard.down(k); if(ms===1000) await page.keyboard.down('ShiftLeft'); await page.waitForTimeout(ms); await page.keyboard.up(k); await page.keyboard.up('ShiftLeft'); }
  await page.waitForFunction(()=>window.__done,null,{timeout:20000});
  const ft = await page.evaluate(()=>window.__ft.slice(2));
  const st = await page.evaluate(()=>window.__game.state());
  const s=[...ft].sort((a,b)=>a-b); const pct=p=>s[Math.min(s.length-1,Math.floor(p*s.length))];
  const mean=ft.reduce((a,b)=>a+b,0)/ft.length;
  return { frames:ft.length, meanMs:+mean.toFixed(2), fps:+(1000/mean).toFixed(1), p50:+pct(.5).toFixed(2), p95:+pct(.95).toFixed(2), p99:+pct(.99).toFixed(2), max:+s[s.length-1].toFixed(1), over20:ft.filter(x=>x>20).length, over33:ft.filter(x=>x>33.4).length, over50:ft.filter(x=>x>50).length, endEye:st.eye.map(v=>+v.toFixed(2)), room:st.room?.id, series: ft.map(x=>+x.toFixed(1)) };
}
for(const q of ['low','medium','high','ultra']){
  const t=Date.now(); await page.evaluate(q=>window.__game.setQuality(q), q); await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))); out.switch[q]=Date.now()-t;
  out.bench[q]=await page.evaluate(()=>window.__game.benchmark(120));
  const views=await page.evaluate(()=>window.__game.views());
  await capture(page,{view:views.rooms.find(v=>v.id==='living'),tod:'day',out:`reviews/P01-r1/tier_${q}_living_${W}.png`});
  const w=await walk(q); out.walks[q]=w;
}
out.errors=errors;
const fs=await import('fs'); fs.writeFileSync(`reviews/P01-r1/perf_${W}x${H}.json`, JSON.stringify(out,null,1));
for(const q in out.walks){ const {series,...r}=out.walks[q]; console.log(q, JSON.stringify(r)); }
console.log('bench', JSON.stringify(out.bench)); console.log('switch ms', JSON.stringify(out.switch)); console.log('errors', JSON.stringify(errors));
await browser.close();
