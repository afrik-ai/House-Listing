import { fileURLToPath } from 'url';
// Packs Blender-exported prop GLBs (pipeline/props/_build/<name>.glb) into public/assets/models/<name>.glb:
// alpha modes from <name>.json, dedup/prune, WebP textures (<=1024 or <=512), KHR_mesh_quantization,
// asset.extras.source (so scripts/assets/build_manifest.mjs keeps the right source if it is re-run).
// usage: node pipeline/props/pack.mjs <name> [name ...]
import fs from 'fs';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { dedup, prune, textureCompress, quantize, getBounds } from '@gltf-transform/functions';
import sharp from 'sharp';

const R = fileURLToPath(new URL('../..', import.meta.url)).replace(/\\/g, '/').replace(/\/$/, '');
const B = R + '/pipeline/props/_build';
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
const SOURCE = 'procedural (HouseListing pipeline/props)';

for (const name of process.argv.slice(2)) {
  const meta = JSON.parse(fs.readFileSync(`${B}/${name}.json`, 'utf8'));
  const doc = await io.read(`${B}/${name}.glb`);
  const root = doc.getRoot();
  for (const m of root.listMaterials()) {
    const a = meta.alpha?.[m.getName()] || 'OPAQUE';
    m.setAlphaMode(a);
    if (a === 'MASK') m.setAlphaCutoff(0.5);
  }
  const res = meta.texres || 1024;
  await doc.transform(dedup(), prune(),
    textureCompress({ encoder: sharp, targetFormat: 'webp', resize: [res, res], quality: meta.webpq || 86 }),
    quantize({ quantizePosition: 16, quantizeNormal: 10, quantizeTexcoord: 16 }));
  const extras = { source: SOURCE };
  if (meta.variants) extras.variants = meta.variants;
  root.getAsset().extras = extras;
  root.getAsset().generator = 'HouseListing pipeline/props (Blender 5.2 + glTF-Transform)';
  const out = `${R}/public/assets/models/${name}.glb`;
  fs.mkdirSync(`${R}/public/assets/models`, { recursive: true });
  await io.write(out, doc);
  // stats
  const scene = root.listScenes()[0];
  const b = getBounds(scene);
  let tris = 0;
  for (const n of root.listNodes()) { const me = n.getMesh(); if (!me) continue; for (const p of me.listPrimitives()) { const i = p.getIndices(); tris += (i ? i.getCount() : p.getAttribute('POSITION').getCount()) / 3; } }
  const mb = +(fs.statSync(out).size / 1048576).toFixed(2);
  const r = { name, dims: [0, 1, 2].map(i => +(b.max[i] - b.min[i]).toFixed(3)), minY: +b.min[1].toFixed(3), tris: Math.round(tris), mb,
    textures: root.listTextures().map(t => `${t.getName()}:${t.getSize()?.join('x')}`), materials: root.listMaterials().length,
    prims: root.listMeshes().reduce((s, m) => s + m.listPrimitives().length, 0) };
  fs.writeFileSync(`${B}/${name}.pack.json`, JSON.stringify(r, null, 1));
  console.log('PACKED', JSON.stringify(r));
}
