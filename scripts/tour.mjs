// Standard tour (P01): every room + 4 exteriors (+ golden-hour and night variants of the garden view).
//   node scripts/tour.mjs --out reviews/tour-<name>/ [--w 1600 --h 900] [--quality high] [--tod day]
//        [--ui] [--id villa-nova] [--only living,kitchen] [--no-variants] [--base http://127.0.0.1:5173]
//        [--hmr] [--attempts 3]   (HMR blocked by default; reload-retry as in shot.mjs)
// Writes <out>/NN_<view>.png, <out>/index.html (contact sheet) and <out>/stats.json
// (per-shot __game.stats(), GPU benchmark, load time, console errors). Exit code 2 on console errors.
import fs from 'fs';
import path from 'path';
import sharp from 'sharp';
import { openGame, capture, parseArgs, stable } from './shot.mjs';

const a = parseArgs(process.argv.slice(2), { w: 1600, h: 900, quality: 'high', tod: 'day', id: 'villa-nova', out: 'reviews/tour/' });
const outDir = path.resolve(a.out);
fs.mkdirSync(outDir, { recursive: true });

const t0 = Date.now();
const G = await openGame({ base: a.base, id: a.id, w: a.w, h: a.h, quality: a.quality, tod: a.tod, attempts: +(a.attempts || 3), hmr: !!a.hmr });
const { browser, page, errors, warnings, loadMs, gpu } = G;
console.log(`ready on attempt ${G.readyAttempt}/${+(a.attempts || 3)} (load ${(loadMs / 1000).toFixed(1)} s)`);
const shots = [];
let bench = [];
try {
  const views = await stable(page, () => page.evaluate(() => window.__game.views()), 'views');
  let list = [
    ...views.rooms.map((v) => ({ ...v, kind: 'room', tod: a.tod })),
    ...views.exteriors.map((v) => ({ ...v, kind: 'exterior', tod: a.tod })),
  ];
  if (!a['no-variants']) {
    const hero = views.exteriors.find((v) => v.id === 'ext_garden_sw') || views.exteriors[0];
    for (const tod of ['golden_hour', 'night']) if (tod !== a.tod) list.push({ ...hero, id: `${hero.id}_${tod}`, name: `${hero.name} — ${tod.replace('_', ' ')}`, kind: 'variant', tod });
    const living = views.rooms.find((v) => v.id === 'living');
    if (living && a.tod !== 'night') list.push({ ...living, id: 'living_night', name: `${living.name} — night`, kind: 'variant', tod: 'night' });
  }
  if (a.only) { const only = new Set(String(a.only).split(',')); list = list.filter((v) => only.has(v.id)); }

  let i = 0;
  for (const v of list) {
    const file = `${String(++i).padStart(2, '0')}_${v.id}.png`;
    const errBefore = errors.length;
    const r = await capture(page, { view: v, tod: v.tod, out: path.join(outDir, file), ui: !!a.ui, quality: a.quality });
    const image = await imageStats(path.join(outDir, file), v.tod);
    shots.push({ file, id: v.id, name: v.name, level: v.level, kind: v.kind, tod: v.tod, pos: v.pos, yaw: v.yaw, pitch: v.pitch, room: r.state.room?.id ?? null, stats: r.stats, image, errors: errors.slice(errBefore) });
    process.stdout.write(`  ${file.padEnd(34)} ${String(r.stats.drawCalls).padStart(4)} calls ${(r.stats.triangles / 1000).toFixed(0).padStart(5)}k tris  luma ${image.mean} [p2 ${image.p2} p98 ${image.p98}] clip ${image.clippedPct}% ${image.flags.join(' ')}\n`);
  }

  // GPU-bound benchmark at a few heavy views (vsync-independent), plus the rAF fps over 1.5 s.
  const benchIds = ['living', 'kitchen', 'master', 'ext_garden_sw', 'ext_front_east'];
  for (const id of benchIds) {
    const v = [...views.rooms, ...views.exteriors].find((q) => q.id === id);
    if (!v) continue;
    const b = await stable(page, async () => {
      await page.evaluate(async ({ v, tod, q }) => {
        const g = window.__game;
        if (g.state().quality !== q) g.setQuality(q);
        await g.setTimeOfDay(tod);
        g.teleport(v.pos[0], v.pos[1], v.pos[2], v.yaw, v.pitch);
      }, { v, tod: a.tod, q: a.quality });
      await page.waitForTimeout(1500);
      const rafFps = await page.evaluate(() => window.__game.stats().fps);
      return { ...(await page.evaluate(() => window.__game.benchmark(150))), rafFps };
    }, `bench ${id}`);
    bench.push({ id, ...b });
  }
} finally {
  await browser.close();
}

const worst = bench.reduce((m, b) => (m && m.fps < b.fps ? m : b), null);
const summary = {
  id: a.id, date: new Date().toISOString(), gpu, resolution: [+a.w, +a.h], quality: a.quality, tod: a.tod,
  loadMs, readyAttempt: G.readyAttempt, reloads: G.reloads, tourMs: Date.now() - t0, shots: shots.length,
  benchmark: { views: bench, worstFps: worst?.fps ?? null, worstView: worst?.id ?? null, meetsTarget60: worst ? worst.fps >= 60 : null },
  imageFlags: shots.filter((s) => s.image.flags.length).map((s) => `${s.id}: ${s.image.flags.join(' ')}`),
  maxDrawCalls: Math.max(...shots.map((s) => s.stats.drawCalls)),
  maxTriangles: Math.max(...shots.map((s) => s.stats.triangles)),
  consoleErrors: errors, consoleWarnings: [...new Set(warnings)].slice(0, 30),
};
fs.writeFileSync(path.join(outDir, 'stats.json'), JSON.stringify({ summary, shots }, null, 2));
fs.writeFileSync(path.join(outDir, 'index.html'), contactSheet(summary, shots));
console.log(JSON.stringify({ out: outDir, ...summary, consoleWarnings: undefined }, null, 2));
if (errors.length) process.exitCode = 2;

// Tonal sanity of a screenshot (sRGB 8-bit, Rec.709 luma): catches washed-out (no blacks,
// low contrast), blown (clipped highlights) and crushed images objectively.
async function imageStats(file, tod = 'day') {
  const { data, info } = await sharp(file).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const hist = new Uint32Array(256);
  let sum = 0, sat = 0, n = 0;
  for (let i = 0; i < data.length; i += 3 * 4) {       // every 4th pixel is plenty
    const r = data[i], g = data[i + 1], b = data[i + 2];
    const y = Math.round(0.2126 * r + 0.7152 * g + 0.0722 * b);
    hist[y]++; sum += y; n++;
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
    sat += mx ? (mx - mn) / mx : 0;
  }
  const pct = (q) => { let acc = 0; for (let v = 0; v < 256; v++) { acc += hist[v]; if (acc >= q * n) return v; } return 255; };
  const clipped = hist.slice(250).reduce((a, b) => a + b, 0) / n * 100;
  const crushed = hist.slice(0, 6).reduce((a, b) => a + b, 0) / n * 100;
  const p2 = pct(0.02), p98 = pct(0.98);
  const flags = [];
  if (p2 > 85 && p98 - p2 < 130) flags.push('WASHED-OUT');   // no darks AND compressed range
  if (clipped > 6) flags.push('BLOWN');
  if (crushed > (tod === 'night' ? 60 : 25)) flags.push('CRUSHED');   // night skies are legitimately dark
  return { mean: Math.round(sum / n), p2, p50: pct(0.5), p98, contrast: p98 - p2, clippedPct: +clipped.toFixed(1), crushedPct: +crushed.toFixed(1), saturation: +(sat / n).toFixed(3), size: [info.width, info.height], flags };
}

function esc(s) { return String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }

function contactSheet(sum, shots) {
  const groups = [['Rooms — ground floor', (s) => s.kind === 'room' && s.level === 'ground'], ['Rooms — first floor', (s) => s.kind === 'room' && s.level === 'first'], ['Exteriors', (s) => s.kind === 'exterior'], ['Time-of-day variants', (s) => s.kind === 'variant']];
  const card = (s) => `
    <figure>
      <a href="${esc(s.file)}" target="_blank"><img src="${esc(s.file)}" loading="lazy" alt="${esc(s.name)}"></a>
      <figcaption><b>${esc(s.name)}</b><span>${esc(s.id)} · ${esc(s.tod)}</span>
      <code>pos ${s.pos.map((v) => (+v).toFixed(2)).join(', ')} · yaw ${s.yaw} · pitch ${s.pitch}</code>
      <code>${s.stats.drawCalls} calls · ${(s.stats.triangles / 1000).toFixed(1)}k tris · ${s.stats.textures} tex</code>
      <code>luma ${s.image.mean} · p2–p98 ${s.image.p2}–${s.image.p98} · clip ${s.image.clippedPct}% · sat ${s.image.saturation} ${s.image.flags.length ? `<b class="bad">${s.image.flags.join(' ')}</b>` : ''}</code>
      ${s.errors.length ? `<em>${s.errors.length} console error(s)</em>` : ''}</figcaption>
    </figure>`;
  const b = sum.benchmark;
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Tour — ${esc(sum.id)}</title>
<meta name="viewport" content="width=device-width,initial-scale=1">
<style>
  :root { color-scheme: dark; --bg:#0d0f12; --card:#15191e; --ink:#eeebe5; --dim:#8d949c; --acc:#d9a45f; --bad:#ff8b7a; --ok:#8fd19e; }
  * { box-sizing: border-box; }
  body { margin: 0; background: var(--bg); color: var(--ink); font: 14px/1.45 "Segoe UI", system-ui, sans-serif; padding: 28px 16px 60px; }
  main { max-width: 1680px; margin: 0 auto; }
  h1 { font-weight: 300; font-size: 34px; margin: 0 0 6px; letter-spacing: -0.01em; }
  h2 { font-size: 12px; letter-spacing: 0.26em; text-transform: uppercase; color: var(--acc); margin: 36px 0 14px; font-weight: 600; }
  .meta { color: var(--dim); display: flex; flex-wrap: wrap; gap: 6px 22px; }
  .meta b { color: var(--ink); font-weight: 600; }
  .ok { color: var(--ok); } .bad { color: var(--bad); }
  .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(min(100%, 380px), 1fr)); gap: 14px; }
  figure { margin: 0; background: var(--card); border-radius: 6px; overflow: hidden; }
  img { display: block; width: 100%; aspect-ratio: ${sum.resolution[0]} / ${sum.resolution[1]}; object-fit: cover; background: #000; }
  figcaption { padding: 10px 12px 12px; display: grid; gap: 2px; }
  figcaption span { color: var(--dim); font-size: 12px; }
  code { font: 11px/1.4 ui-monospace, Consolas, monospace; color: var(--dim); }
  em { color: var(--bad); font-style: normal; font-size: 12px; }
  table { border-collapse: collapse; margin-top: 8px; font-size: 13px; }
  td, th { padding: 4px 14px 4px 0; text-align: left; } th { color: var(--dim); font-weight: 500; }
  pre { white-space: pre-wrap; color: var(--bad); font-size: 12px; }
</style></head><body><main>
<h1>${esc(sum.id)} — standard tour</h1>
<div class="meta">
  <span><b>${sum.shots}</b> shots</span><span><b>${sum.resolution.join('×')}</b> · ${esc(sum.quality)}</span>
  <span>load <b>${(sum.loadMs / 1000).toFixed(1)} s</b></span>
  <span>worst GPU-bound fps <b class="${b.meetsTarget60 ? 'ok' : 'bad'}">${b.worstFps ?? '—'}</b> (${esc(b.worstView)})</span>
  <span>max <b>${sum.maxDrawCalls}</b> draw calls · <b>${(sum.maxTriangles / 1e6).toFixed(2)}M</b> tris</span>
  <span>console errors <b class="${sum.consoleErrors.length ? 'bad' : 'ok'}">${sum.consoleErrors.length}</b></span>
  <span>${esc(sum.gpu)}</span><span>${esc(sum.date)}</span>
</div>
<table><tr><th>bench view</th><th>avg ms</th><th>fps</th><th>rAF fps</th><th>calls</th><th>tris</th></tr>
${b.views.map((v) => `<tr><td>${esc(v.id)}</td><td>${v.avgMs}</td><td>${v.fps}</td><td>${v.rafFps}</td><td>${v.drawCalls}</td><td>${v.triangles}</td></tr>`).join('')}</table>
${sum.consoleErrors.length ? `<pre>${esc(sum.consoleErrors.join('\n'))}</pre>` : ''}
${groups.map(([title, f]) => { const g = shots.filter(f); return g.length ? `<h2>${title}</h2><div class="grid">${g.map(card).join('')}</div>` : ''; }).join('')}
</main></body></html>`;
}
