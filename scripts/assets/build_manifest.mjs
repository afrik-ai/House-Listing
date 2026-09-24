import { fileURLToPath } from 'url';
// Scans public/assets/{textures,models,hdri} and writes public/assets/manifest.json + public/assets/CREDITS.md
// usage: node scripts/assets/build_manifest.mjs [--table] [--credits]
// Merges into an existing manifest: entries for files this pipeline did not produce (other agents' procedural props,
// texture dirs without meta.json) are kept as-is. CREDITS.md is only regenerated with --credits.
import fs from 'fs';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { getBounds } from '@gltf-transform/functions';

const A = fileURLToPath(new URL('../..', import.meta.url)).replace(/\\/g, '/').replace(/\/$/, '') + '/public/assets';
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
const list = JSON.parse(fs.readFileSync(new URL('./models.json', import.meta.url)));
const byName = (n) => list.find(m => m.name === n) || list.find(m => n.startsWith(m.name + '_'));
const ls = (d) => fs.existsSync(d) ? fs.readdirSync(d) : []; // a source may be absent (e.g. download hosts unreachable)
const mb = (p) => +(fs.statSync(p).size / 1048576).toFixed(2);

const prev = fs.existsSync(A + '/manifest.json') ? JSON.parse(fs.readFileSync(A + '/manifest.json')) : {};
const manifest = { ...prev, generated: new Date().toISOString(), license: 'CC0 (all assets)', conventions: {
  textures: 'maps are JPEG, OpenGL normals (+Y). color = sRGB; normal/roughness/ao = linear. scale_m = real-world metres covered by one texture repeat.',
  models: 'one self-contained GLB each; Y-up, metres, origin at base centre (bbox centre XZ, min Y = 0). Textures WebP (EXT_texture_webp) <= 1024px (512px for props < 0.5 m); geometry KHR_mesh_quantization. dims = [x,y,z] metres. If "variants" is present, each listed top-level child is a separate variant centred at the origin: pick one by name (root.getObjectByName) instead of adding the whole scene.',
  hdri: 'Radiance .hdr equirectangular, 1k and 2k.' }, textures: { ...(prev.textures || {}) }, models: { ...(prev.models || {}) }, hdri: { ...(prev.hdri || {}) } };

for (const d of ls(A + '/textures').sort()) {
  if (!fs.existsSync(`${A}/textures/${d}/meta.json`)) continue;
  const m = JSON.parse(fs.readFileSync(`${A}/textures/${d}/meta.json`));
  const maps = {}; for (const [k, f] of Object.entries(m.maps)) maps[k] = `textures/${d}/${f}`;
  manifest.textures[d] = { maps, scale_m: m.scale_m, resolution: m.resolution, source: m.source, description: m.description, ...(m.recolour ? { recolour: m.recolour } : {}), ...(m.ao_note ? { ao_note: m.ao_note } : {}) };
}

const rows = [];
for (const f of ls(A + '/models').filter(f => f.endsWith('.glb')).sort()) {
  const name = f.slice(0, -4);
  if (!byName(name)) continue; // not produced by dl_models.mjs
  const doc = await io.read(`${A}/models/${f}`);
  const scene = doc.getRoot().listScenes()[0];
  const b = getBounds(scene);
  const uses = new Map(); for (const n of doc.getRoot().listNodes()) { const me = n.getMesh(); if (me) uses.set(me, (uses.get(me) || 0) + 1); }
  let tris = 0; for (const [me, u] of uses) for (const p of me.listPrimitives()) { const i = p.getIndices(); tris += (i ? i.getCount() : p.getAttribute('POSITION').getCount()) / 3 * u; }
  const ex = doc.getRoot().getAsset().extras || {};
  const src = byName(name) || {};
  const entry = { file: `models/${f}`, dims: [0, 1, 2].map(i => +(b.max[i] - b.min[i]).toFixed(3)), tris: Math.round(tris), mb: mb(`${A}/models/${f}`),
    category: src.cat, use: src.need, source: ex.source || ('https://polyhaven.com/a/' + src.id) };
  if (ex.variants) entry.variants = ex.variants;
  const masked = doc.getRoot().listMaterials().filter(m => m.getAlphaMode() === 'MASK').map(m => m.getName());
  if (masked.length) entry.alpha_mask = masked;
  manifest.models[name] = entry;
  rows.push([name, entry.tris, entry.mb]);
}

const hm = fs.existsSync(A + '/hdri/meta.json') ? JSON.parse(fs.readFileSync(A + '/hdri/meta.json')) : {};
for (const [k, v] of Object.entries(hm)) manifest.hdri[k] = { files: Object.fromEntries(Object.entries(v.files).map(([r, f]) => [r, 'hdri/' + f])), source: v.source, description: v.description };

fs.writeFileSync(A + '/manifest.json', JSON.stringify(manifest, null, 1));

// CREDITS.md
if (process.argv.includes('--credits')) {
let md = '# Asset credits\n\nAll third-party assets below are **CC0 1.0 (public domain)** — no attribution required; credited here as good practice.\n' +
  'Sources: [Poly Haven](https://polyhaven.com) and [ambientCG](https://ambientcg.com). Some textures were recoloured / resized and models were re-packed (GLB, WebP, quantized, thinned foliage) by `scripts/assets/*`.\n\n';
md += '## HDRIs\n\n| Name | Source | License |\n|---|---|---|\n';
for (const [k, v] of Object.entries(manifest.hdri)) md += `| ${k} | ${v.source} | CC0 |\n`;
md += '\n## Textures\n\n| Name | Source | License | Notes |\n|---|---|---|---|\n';
for (const [k, v] of Object.entries(manifest.textures)) md += `| ${k} | ${v.source} | CC0 | ${v.recolour ? 'recoloured ' + v.recolour.tint : ''}${v.ao_note ? (v.recolour ? '; ' : '') + 'AO derived' : ''} |\n`;
md += '\n## Models\n\n| Name | Source | License |\n|---|---|---|\n';
for (const [k, v] of Object.entries(manifest.models)) md += `| ${k} | ${v.source} | CC0 |\n`;
fs.writeFileSync(A + '/CREDITS.md', md);
}

console.log('textures', Object.keys(manifest.textures).length, 'models', Object.keys(manifest.models).length, 'hdri', Object.keys(manifest.hdri).length);
if (process.argv.includes('--table')) { console.log('name'.padEnd(32), 'tris'.padStart(8), 'MB'.padStart(6)); for (const r of rows) console.log(r[0].padEnd(32), String(r[1]).padStart(8), String(r[2]).padStart(6)); }
