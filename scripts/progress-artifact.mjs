// Renders progress/status.json into a self-contained HTML snapshot for publishing as an Artifact.
// usage: node scripts/progress-artifact.mjs <out.html>
import fs from 'fs';
import path from 'path';
const s = JSON.parse(fs.readFileSync('progress/status.json', 'utf8'));
const out = process.argv[2] || 'scratch/progress-artifact.html';
const esc = t => String(t ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const fmt = t => t ? new Date(t).toLocaleString('en-US', { hour12: false, month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '';
// Embed up to 6 latest screenshots as JPEG data URIs if sharp is available, else skip.
let shots = [];
try {
  const sharp = (await import('sharp')).default;
  for (const x of s.shots.filter(x => !x.src.includes('/hf2/')).slice(0, 6)) {
    const p = x.src.replace(/^\//, '');
    if (!fs.existsSync(p)) continue;
    const buf = await sharp(p).resize({ width: 720 }).jpeg({ quality: 72 }).toBuffer();
    shots.push({ ...x, data: 'data:image/jpeg;base64,' + buf.toString('base64') });
  }
} catch { /* sharp not installed yet */ }
const done = s.pieces.filter(p => p.status === 'won').length;
const html = `<title>Villa Nova Build Log</title>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Archivo:wdth,wght@87.5,500;87.5,700&family=IBM+Plex+Sans:wght@400;500&family=IBM+Plex+Mono:wght@400;500&display=swap">
<style>
:root{--bg:#f3f1ec;--bg2:#ffffff;--line:#d9d4ca;--fg:#1b1f24;--mut:#6b7079;--acc:#b8763b;--acc-ink:#8a5322;--ok:#2f8f5b;--warn:#b7841c;--bad:#c2463e;--build:#2f6bb0;--critic:#8a5322;--smooth:#6a4fb3}
@media (prefers-color-scheme: dark){:root:not([data-theme="light"]){--bg:#111519;--bg2:#181d23;--line:#29313a;--fg:#e9e4da;--mut:#8f97a3;--acc:#d29a5b;--acc-ink:#e6b982;--ok:#5fc48f;--warn:#e6b04a;--bad:#e0605a;--build:#7fb0f0;--critic:#e6b982;--smooth:#b9a5f0}}
:root[data-theme="dark"]{--bg:#111519;--bg2:#181d23;--line:#29313a;--fg:#e9e4da;--mut:#8f97a3;--acc:#d29a5b;--acc-ink:#e6b982;--ok:#5fc48f;--warn:#e6b04a;--bad:#e0605a;--build:#7fb0f0;--critic:#e6b982;--smooth:#b9a5f0}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--fg);font:15px/1.5 "IBM Plex Sans",system-ui,sans-serif}
.wrap{max-width:1180px;margin:0 auto;padding:32px 28px 48px}
header{display:flex;flex-wrap:wrap;gap:8px 28px;align-items:baseline;border-bottom:2px solid var(--fg);padding-bottom:14px}
h1{margin:0;font:700 30px/1.05 Archivo,"Archivo Narrow",system-ui,sans-serif;font-stretch:87.5%;letter-spacing:-.01em;text-wrap:balance}
h1 small{font:500 13px/1 "IBM Plex Mono",monospace;color:var(--mut);letter-spacing:.08em;text-transform:uppercase;display:block;margin-bottom:8px}
.mono{font-family:"IBM Plex Mono",monospace;font-variant-numeric:tabular-nums;color:var(--mut);font-size:13px}
.headline{margin:18px 0 0;font-size:17px;max-width:70ch}
.track{display:flex;gap:4px;margin:18px 0 6px;height:10px}.track i{flex:1;background:var(--line);border-radius:2px}
.track i.won{background:var(--ok)}.track i.building{background:var(--build)}.track i.critic{background:var(--critic)}.track i.lost{background:var(--bad)}.track i.smoothing{background:var(--smooth)}
main{display:grid;grid-template-columns:1.15fr .85fr;gap:28px;margin-top:22px}
@media(max-width:860px){main{grid-template-columns:1fr}}
h2{font:500 12px/1 "IBM Plex Mono",monospace;letter-spacing:.12em;text-transform:uppercase;color:var(--mut);margin:0 0 12px}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(210px,1fr));gap:10px}
.p{background:var(--bg2);border:1px solid var(--line);padding:12px 14px;display:flex;flex-direction:column;gap:4px}
.p .id{font:500 12px "IBM Plex Mono",monospace;color:var(--mut)}.p b{font-weight:500}
.st{font:500 11px/1 "IBM Plex Mono",monospace;letter-spacing:.08em;text-transform:uppercase;padding:4px 0}
.st.pending{color:var(--mut)}.st.building{color:var(--build)}.st.critic{color:var(--critic)}.st.won{color:var(--ok)}.st.lost{color:var(--bad)}.st.smoothing{color:var(--smooth)}
.p .v,.p .gap{font-size:12.5px;color:var(--mut)}.p .gap::before{content:"Gap · ";color:var(--acc-ink)}
.log{border-top:1px solid var(--line)}.log div{display:grid;grid-template-columns:78px 1fr;gap:12px;padding:8px 0;border-bottom:1px solid var(--line);font-size:13.5px}
.shots{display:grid;grid-template-columns:repeat(auto-fill,minmax(230px,1fr));gap:10px;margin-top:26px}
.shots figure{margin:0;background:var(--bg2);border:1px solid var(--line)}.shots img{width:100%;display:block;aspect-ratio:16/9;object-fit:cover}
.shots figcaption{font-size:12px;color:var(--mut);padding:6px 10px}
</style>
<div class="wrap">
<header><h1><small>HouseListing · build log</small>Villa Nova</h1>
<span class="mono">${esc(s.phase)} · wave ${s.wave} · ${done}/${s.pieces.length} pieces won · ${fmt(s.updated)}</span></header>
<p class="headline">${esc(s.headline)}</p>
<div class="track">${s.pieces.map(p => `<i class="${p.status}" title="${esc(p.id)} ${esc(p.status)}"></i>`).join('')}</div>
<main>
<section><h2>Pieces</h2><div class="grid">${s.pieces.map(p => `<div class="p"><span class="id">${p.id} · round ${p.round}</span><b>${esc(p.name)}</b><span class="st ${p.status}">${p.status}</span>${p.verdict ? `<span class="v">${esc(p.verdict)}</span>` : ''}${p.gap ? `<span class="gap">${esc(p.gap)}</span>` : ''}</div>`).join('')}</div>
${shots.length ? `<h2 style="margin-top:26px">Latest screenshots</h2><div class="shots" style="margin-top:0">${shots.map(x => `<figure><img src="${x.data}" alt="${esc(x.caption)}"><figcaption>${esc(x.caption)}</figcaption></figure>`).join('')}</div>` : ''}
</section>
<section><h2>Activity</h2><div class="log">${s.log.slice(0, 60).map(l => `<div><span class="mono">${fmt(l.t).split(', ')[1] || ''}</span><span>${esc(l.m)}</span></div>`).join('')}</div></section>
</main></div>`;
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, html);
console.log('wrote', out, (html.length / 1024).toFixed(0) + 'KB', 'shots:', shots.length);
