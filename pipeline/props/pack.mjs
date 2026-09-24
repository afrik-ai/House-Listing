import { fileURLToPath } from 'url';
// Packs Blender-exported prop GLBs (pipeline/props/_build/<name>.glb) into public/assets/models/<name>.glb:
// alpha modes from <name>.json, dedup/prune, WebP textures (<=1024 or <=512), KHR_mesh_quantization,
// asset.extras.source (so scripts/assets/build_manifest.mjs keeps the right source if it is re-run).
// usage: node pipeline/props/pack.mjs <name> [name ...]
import fs from 'fs';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { dedup, prune, textureCompress, quantize, getBounds, weld, simplify } from '@gltf-transform/functions';
import { MeshoptSimplifier } from 'meshoptimizer';

// Triangle caps (P07 furniture budget: whole placed set <= 600k tris). Props over their cap are simplified
// with meshoptimizer (attribute seams kept; error bound 0.25-0.6% of the mesh extent). meta.maxTris overrides.
const MAXTRIS = {
  rug_rect_200x300: 6000, rug_round_160: 4000, bed_double_modern: 10000, toilet_wall_hung: 4000, armchair_modern: 7000,
  sun_lounger: 6000, bathroom_vanity: 5000, bathtub_freestanding: 6000, office_chair: 7000, towel_stack: 3000,
  towel_folded: 1500, washing_machine: 6000, lounge_chair_midcentury: 8000, hanging_egg_chair: 9000,
  sofa_fabric_3seat: 14000, sofa_leather_2seat: 12000, throw_pillows: 3000, vase_ceramic_tall: 1000,
  basket_wicker: 1500, laundry_basket_wicker: 2500, rubber_duck: 1200, candlesticks_brass: 5000, laptop: 2500,
  desk_lamp: 2200, gaming_console: 1800, fruit_bowl_wood: 1800, alarm_clock: 1500, cleaner_bottle: 1000,
  bookshelf_worn: 9000,
  pendant_lamp_modern: 1800,
  chess_set: 4000,
  bed_double_gothic: 8000,
};
await MeshoptSimplifier.ready;
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
  // GPU memory budget (SwiftShader holds ~1 GB): texture size follows the prop's size, not just meta.texres.
  const st = Object.values(meta.stats || {}); const maxDim = Math.max(0, ...st.flatMap((q) => q.dims || []));
  const res = Math.min(meta.texres || 1024, maxDim < 0.45 ? 256 : maxDim < 1.3 ? 512 : 1024);
  const P07 = !!process.env.P07_CAPS;   // P07 budget pass: size-based caps + untextured small props
  const st0 = Object.values(meta.stats || {}); const dim0 = Math.max(0, ...st0.flatMap((q) => q.dims || []));
  if (P07 && dim0 < 0.45) {
    // Small props: bake each texture to its mean colour so the prop merges into the shared vertex-colour buckets
    // at runtime (one draw call per room instead of one per material) and costs no GPU texture memory.
    for (const m of root.listMaterials()) {
      if (/photo|art|screen|dial|label|squares/i.test(m.getName())) continue;   // printed images stay
      const t = m.getBaseColorTexture();
      if (t) {
        const s = await sharp(Buffer.from(t.getImage())).stats();
        const f = m.getBaseColorFactor(); const lin = (c) => ((c / 255) <= 0.04045 ? (c / 255) / 12.92 : (((c / 255) + 0.055) / 1.055) ** 2.4);
        m.setBaseColorFactor([f[0] * lin(s.channels[0].mean), f[1] * lin(s.channels[1].mean), f[2] * lin(s.channels[2].mean), f[3]]);
      }
      m.setBaseColorTexture(null); m.setNormalTexture(null); m.setMetallicRoughnessTexture(null); m.setOcclusionTexture(null);
      if (m.getEmissiveTexture()) { m.setEmissiveTexture(null); }
    }
  }
  const cap = meta.maxTris || MAXTRIS[name] || (P07 ? (dim0 < 0.45 ? 900 : dim0 < 1.3 ? 4000 : 9000) : 0);
  if (cap) {
    let t0 = 0;
    for (const me of root.listMeshes()) for (const p of me.listPrimitives()) { const i = p.getIndices(); t0 += (i ? i.getCount() : p.getAttribute('POSITION').getCount()) / 3; }
    if (t0 > cap) {
      // Blender writes per-corner normals that differ in the last bits: snap them (and positions / UVs) to a grid
      // so weld() can share vertices, otherwise the simplifier sees a triangle soup and cannot collapse anything.
      const snap = { POSITION: 1e-5, NORMAL: 1 / 48, TEXCOORD_0: 1 / 4096, TEXCOORD_1: 1 / 4096 };
      for (const me of root.listMeshes()) for (const p of me.listPrimitives()) {
        const m = p.getMaterial();
        const textured = m && (m.getBaseColorTexture() || m.getNormalTexture() || m.getMetallicRoughnessTexture() || m.getEmissiveTexture() || m.getOcclusionTexture());
        if (!textured) for (const sem of p.listSemantics()) if (sem.startsWith('TEXCOORD')) p.setAttribute(sem, null);   // unused, and they split every vertex
      }
      for (const me of root.listMeshes()) for (const p of me.listPrimitives()) for (const sem of p.listSemantics()) {
        const a = p.getAttribute(sem), g = snap[sem]; if (!g) continue;
        const arr = a.getArray().slice(); for (let i = 0; i < arr.length; i++) arr[i] = Math.round(arr[i] / g) * g;
        if (sem === 'NORMAL') for (let i = 0; i < arr.length; i += 3) { const l = Math.hypot(arr[i], arr[i + 1], arr[i + 2]) || 1; arr[i] /= l; arr[i + 1] /= l; arr[i + 2] /= l; }
        a.setArray(arr);
      }
      await doc.transform(weld(), simplify({ simplifier: MeshoptSimplifier, ratio: cap / t0, error: t0 > cap * 2.5 ? 0.02 : 0.01 }));
      console.log('WARN simplified', name, Math.round(t0), '->', 'cap', cap);
    }
  }
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
