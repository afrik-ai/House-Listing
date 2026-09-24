import { fileURLToPath } from 'url';
// Downloads 3 Poly Haven pure-sky HDRIs at 2k + 1k into public/assets/hdri/
import fs from 'fs';
const OUT = fileURLToPath(new URL('../..', import.meta.url)).replace(/\\/g, '/').replace(/\/$/, '') + '/public/assets/hdri';
fs.mkdirSync(OUT, { recursive: true });
const list = [
  { name: 'day_partly_cloudy', id: 'kloofendal_48d_partly_cloudy_puresky', desc: 'Midday, partly cloudy, high contrast pure sky' },
  { name: 'golden_hour', id: 'qwantani_sunset_puresky', desc: 'Sunset / golden hour, warm low sun, pure sky' },
  { name: 'night_clear', id: 'kloppenheim_02_puresky', desc: 'Clear night, stars and moon, pure sky' },
];
const meta = {};
for (const h of list) {
  const f = await (await fetch('https://api.polyhaven.com/files/' + h.id)).json();
  for (const res of ['2k', '1k']) {
    const u = f.hdri[res].hdr.url;
    const dest = OUT + '/' + h.name + '_' + res + '.hdr';
    if (!fs.existsSync(dest)) { const r = await fetch(u); fs.writeFileSync(dest, Buffer.from(await r.arrayBuffer())); }
    console.log('OK', dest, (fs.statSync(dest).size / 1e6).toFixed(1) + 'MB');
  }
  meta[h.name] = { source: 'https://polyhaven.com/a/' + h.id, source_id: h.id, license: 'CC0', description: h.desc, files: { '2k': h.name + '_2k.hdr', '1k': h.name + '_1k.hdr' } };
}
fs.writeFileSync(OUT + '/meta.json', JSON.stringify(meta, null, 1));
