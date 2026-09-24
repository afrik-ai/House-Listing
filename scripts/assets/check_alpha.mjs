import { fileURLToPath } from 'url';
// Reports, per GLB, materials with alphaMode != OPAQUE and whether their baseColor image really has alpha (sharp hasAlpha).
// usage: node scripts/assets/check_alpha.mjs [name ...]
import fs from 'fs'; import sharp from 'sharp';
import { NodeIO } from '@gltf-transform/core'; import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
const D = fileURLToPath(new URL('../..', import.meta.url)).replace(/\\/g, '/').replace(/\/$/, '') + '/public/assets/models/';
const names = process.argv.slice(2).length ? process.argv.slice(2) : fs.readdirSync(D).filter(f => f.endsWith('.glb')).map(f => f.slice(0, -4));
let bad = 0;
for (const n of names) {
  const doc = await io.read(D + n + '.glb');
  for (const mat of doc.getRoot().listMaterials()) {
    const t = mat.getBaseColorTexture(); const mode = mat.getAlphaMode();
    if (mode === 'OPAQUE') continue;
    let info = 'no-texture';
    if (t) { const md = await sharp(t.getImage()).metadata(); const st = md.hasAlpha ? await sharp(t.getImage()).extractChannel(3).stats() : null;
      info = `${t.getMimeType()} ${md.width}px hasAlpha=${md.hasAlpha}${st ? ' alphaMin=' + st.channels[0].min : ''}`;
      if (mode === 'MASK' && !md.hasAlpha) bad++; }
    console.log(n.padEnd(28), mat.getName().padEnd(34), mode, mode === 'MASK' ? mat.getAlphaCutoff() : '', info);
  }
}
console.log('MASK materials without alpha:', bad);
