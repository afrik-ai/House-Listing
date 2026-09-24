import { chromium } from 'playwright';
const GPU=['--use-angle=d3d11','--enable-gpu','--ignore-gpu-blocklist'];
const out='reviews/P01-r1/flow_';
const browser = await chromium.launch({ headless: true, args: GPU });
const ctx = await browser.newContext({ viewport:{width:1600,height:900}, deviceScaleFactor:1 });
const page = await ctx.newPage();
const errs=[], warns=[], urls={};
page.on('console', m=>{ if(m.type()==='error') errs.push(m.text()); else if(m.type()==='warning') warns.push(m.text().slice(0,160)); });
page.on('pageerror', e=>errs.push('pageerror: '+e.message));
page.on('request', r=>{ const u=r.url().replace('http://127.0.0.1:5173',''); urls[u]=(urls[u]||0)+1; });
const t0=Date.now();
await page.goto('http://127.0.0.1:5173/house.html?id=villa-nova&harness=0',{waitUntil:'commit'});
const timeline=[];
let readyAt=null, i=0, lastShot=0;
while(Date.now()-t0<60000){
  const s = await page.evaluate(()=>{ const el=document.querySelector('.ld, [class*="ld-"]')?.closest('[class]'); const root=document.querySelector('.is-loading,.is-ready,.is-gone'); return { cls: root?root.className:null, pct: document.querySelector('[data-k="pct"]')?.textContent, label: document.querySelector('[data-k="label"]')?.textContent }; }).catch(()=>null);
  const t=Date.now()-t0;
  if(s) timeline.push([t, s.pct, s.label, s.cls]);
  if(t-lastShot>1500 && i<6){ await page.screenshot({path:out+`loading_${i++}_${t}ms.png`}); lastShot=Date.now()-t0; }
  if(s && s.cls && /is-ready/.test(s.cls)){ readyAt=t; break; }
  await page.waitForTimeout(100);
}
const tGame = await page.evaluate(async()=>{ const a=performance.now(); await window.__game.ready; return performance.now(); });
console.log('ready class at', readyAt, 'ms; __game.ready resolved at perf', Math.round(tGame));
await page.waitForTimeout(800);
await page.screenshot({path:out+'title_card_a.png'});
await page.waitForTimeout(2500);
await page.screenshot({path:out+'title_card_b.png'});
const st1 = await page.evaluate(()=>window.__game.state());
// click to enter
const tc=Date.now();
await page.mouse.click(800,450);
for(let k=0;k<5;k++){ await page.waitForTimeout(150); await page.screenshot({path:out+`after_click_${k}.png`}); }
await page.waitForTimeout(1500);
await page.screenshot({path:out+'entered.png'});
const st2 = await page.evaluate(()=>window.__game.state());
console.log(JSON.stringify({st1, st2}, null, 0));
console.log('timeline', JSON.stringify(timeline.filter((x,j)=>j%5==0 || j==timeline.length-1)));
console.log('errors', JSON.stringify(errs,null,1));
console.log('warnings', warns.length, JSON.stringify([...new Set(warns)].slice(0,15),null,1));
console.log('dup requests', JSON.stringify(Object.entries(urls).filter(([u,c])=>c>1)));
await browser.close();
