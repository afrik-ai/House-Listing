import { fileURLToPath } from 'url';
// Downloads 3 Poly Haven pure-sky HDRIs at 2k + 1k into public/assets/hdri/
// If api.polyhaven.com is unreachable (restricted networks), falls back to CC0 Poly Haven HDRIs mirrored on
// GitHub (pmndrs/drei-assets, mrdoob/three.js): 1k only, so both the _2k and _1k files hold the 1k image.
// These are different captures from the primary list; sun azimuth/elevation in src/engine/Lighting.js must match.
import fs from 'fs';
const OUT = fileURLToPath(new URL('../..', import.meta.url)).replace(/\\/g, '/').replace(/\/$/, '') + '/public/assets/hdri';
fs.mkdirSync(OUT, { recursive: true });
const list = [
  { name: 'day_partly_cloudy', id: 'kloofendal_48d_partly_cloudy_puresky', desc: 'Midday, partly cloudy, high contrast pure sky' },
  { name: 'golden_hour', id: 'qwantani_sunset_puresky', desc: 'Sunset / golden hour, warm low sun, pure sky' },
  { name: 'night_clear', id: 'kloppenheim_02_puresky', desc: 'Clear night, stars and moon, pure sky' },
];
const GH = 'https://raw.githubusercontent.com/';
const MIRROR = {
  day_partly_cloudy: { id: 'immenstadter_horn', url: GH + 'pmndrs/drei-assets/master/hdri/immenstadter_horn_1k.hdr', desc: 'Midday, partly cloudy alpine meadow, sun visible' },
  golden_hour: { id: 'spruit_sunrise', url: GH + 'mrdoob/three.js/dev/examples/textures/equirectangular/spruit_sunrise_1k.hdr', desc: 'Low warm sun over open field (golden hour)' },
  night_clear: { id: 'moonless_golf', url: GH + 'mrdoob/three.js/dev/examples/textures/equirectangular/moonless_golf_1k.hdr', desc: 'Clear moonless night, stars, distant suburban lights' },
};
const meta = {};
const primary = await fetch('https://api.polyhaven.com/types').then(r => r.ok, () => false);
if (!primary) console.log('api.polyhaven.com unreachable: using GitHub mirrors (1k)');
for (const h of list) {
  if (!primary) {
    const m = MIRROR[h.name];
    const buf = Buffer.from(await (await fetch(m.url)).arrayBuffer());
    if (buf.slice(0, 2).toString() !== '#?') throw new Error('not a Radiance HDR: ' + m.url);
    for (const res of ['2k', '1k']) fs.writeFileSync(OUT + '/' + h.name + '_' + res + '.hdr', buf);
    console.log('OK', h.name, '<-', m.id, (buf.length / 1e6).toFixed(1) + 'MB');
    meta[h.name] = { source: 'https://polyhaven.com/a/' + m.id, source_id: m.id, mirror: m.url, license: 'CC0', description: m.desc, files: { '2k': h.name + '_2k.hdr', '1k': h.name + '_1k.hdr' } };
    continue;
  }
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
