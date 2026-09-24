import os from 'os';
import { fileURLToPath } from 'url';
// Downloads texture sets listed in textures.json into public/assets/textures/<name>/
// usage: node scripts/assets/dl_textures.mjs [name]
import fs from 'fs';
import { execSync } from 'child_process';
import sharp from 'sharp';

const ROOT = fileURLToPath(new URL('../..', import.meta.url)).replace(/\\/g, '/').replace(/\/$/, '');
const OUT = ROOT + '/public/assets/textures';
const TMP = os.tmpdir().replace(/\\/g, '/') + '/houselisting-tex';
fs.mkdirSync(TMP, { recursive: true });
const list = JSON.parse(fs.readFileSync(new URL('./textures.json', import.meta.url)));
const only = process.argv[2];
const UA = { 'User-Agent': 'Mozilla/5.0 HouseListing-asset-bot' };

async function dl(url, dest) {
  if (fs.existsSync(dest) && fs.statSync(dest).size > 0) return;
  const r = await fetch(url, { headers: UA });
  if (!r.ok) throw new Error(url + ' -> ' + r.status);
  fs.writeFileSync(dest, Buffer.from(await r.arrayBuffer()));
}

async function finish(name, maps, px, post) {
  const dir = OUT + '/' + name;
  fs.mkdirSync(dir, { recursive: true });
  const written = {};
  for (const [k, src] of Object.entries(maps)) {
    if (!src || !fs.existsSync(src) || k === 'displacement') continue;
    const dst = dir + '/' + k + '.jpg';
    let img = sharp(src).resize(px, px, { fit: 'fill' });
    if (k === 'color' && post) {
      // derived recolour (CC0 allows): greyscale -> scale mean luminance -> tint chroma
      const st = await sharp(src).greyscale().stats();
      const mean = st.channels[0].mean;
      img = img.greyscale().linear(post.mean / mean, 0).tint(post.tint).toColourspace('srgb');
    }
    await img.jpeg({ quality: k === 'color' ? 88 : 85, mozjpeg: true }).toFile(dst);
    written[k] = k + '.jpg';
  }
  if (!written.ao && maps.displacement && fs.existsSync(maps.displacement)) {
    // source has no AO: approximate cavity AO from height (low = darker, 0.55..1.0)
    await sharp(maps.displacement).resize(px, px, { fit: 'fill' }).greyscale().normalise().linear(0.45, 140).blur(1).jpeg({ quality: 85, mozjpeg: true }).toFile(dir + '/ao.jpg');
    written.ao = 'ao.jpg'; written._ao_derived = true;
  }
  return written;
}

for (const t of list) {
  if (only && t.name !== only) continue;
  try {
    const px = /2/.test(t.res) ? 2048 : 1024;
    let maps = {}, source;
    if (t.src === 'ph') {
      const f = await (await fetch('https://api.polyhaven.com/files/' + t.id)).json();
      const pick = (key) => f[key]?.[t.res]?.jpg?.url;
      const d = TMP + '/' + t.id; fs.mkdirSync(d, { recursive: true });
      const want = { color: pick('Diffuse'), normal: pick('nor_gl'), roughness: pick('Rough'), ao: pick('AO') };
      for (const [k, u] of Object.entries(want)) { if (!u) continue; const p = d + '/' + k + '.jpg'; await dl(u, p); maps[k] = p; }
      source = 'https://polyhaven.com/a/' + t.id;
    } else {
      const zipName = t.id + '_' + t.res + '-JPG.zip';
      const zp = TMP + '/' + zipName;
      await dl('https://ambientcg.com/get?file=' + zipName, zp);
      const d = TMP + '/' + t.id + '_' + t.res; fs.mkdirSync(d, { recursive: true });
      execSync('C:/Windows/System32/tar.exe -xf "' + zp + '" -C "' + d + '"');
      const files = fs.readdirSync(d);
      const find = (re) => { const m = files.find(x => re.test(x)); return m ? d + '/' + m : null; };
      maps = { color: find(/_Color\.jpg$/i), normal: find(/_NormalGL\.jpg$/i), roughness: find(/_Roughness\.jpg$/i), ao: find(/_AmbientOcclusion\.jpg$/i), displacement: find(/_Displacement\.jpg$/i) };
      source = 'https://ambientcg.com/view?id=' + t.id;
    }
    const written = await finish(t.name, maps, px, t.post);
    const aoDerived = written._ao_derived; delete written._ao_derived;
    const meta = { name: t.name, source, source_id: t.id, license: 'CC0', scale_m: t.scale_m, resolution: px, maps: written, normal: 'OpenGL (+Y up)', description: t.desc, ...(t.post ? { recolour: t.post } : {}), ...(aoDerived ? { ao_note: 'derived from displacement (source has no AO map)' } : {}) };
    fs.writeFileSync(OUT + '/' + t.name + '/meta.json', JSON.stringify(meta, null, 1));
    console.log('OK', t.name, Object.keys(written).join(','), px);
  } catch (e) {
    console.log('FAIL', t.name, e.message);
  }
}
