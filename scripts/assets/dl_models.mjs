// Downloads Poly Haven models (1k glTF) listed in models.json and packs each into ONE self-contained GLB:
//   public/assets/models/<name>.glb  — Y-up, metres, origin at base centre (bbox centre XZ, min Y = 0), textures <= 1024.
// usage: node scripts/assets/dl_models.mjs [name ...]      (env: CONC=6 parallel downloads, FORCE=1 re-pack)
import fs from 'fs';
import crypto from 'crypto';
import path from 'path';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { dedup, prune, weld, simplify, textureCompress, getBounds, quantize, simplifyPrimitive } from '@gltf-transform/functions';
import { MeshoptSimplifier } from 'meshoptimizer';
import sharp from 'sharp';

const ROOT = 'C:/Users/Owner/HouseListing';
const OUT = ROOT + '/public/assets/models';
const TMP = 'C:/Users/Owner/AppData/Local/Temp/claude/C--Users-Owner-HouseListing/6f4200f6-d6d1-4f63-a08e-32106c165318/scratchpad/models';
fs.mkdirSync(OUT, { recursive: true }); fs.mkdirSync(TMP, { recursive: true });
const list = JSON.parse(fs.readFileSync(new URL('./models.json', import.meta.url)));
const only = process.argv.slice(2);
const CONC = Number(process.env.CONC || 6);
const UA = { 'User-Agent': 'Mozilla/5.0 HouseListing-asset-bot' };
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);

async function dl(url, dest, md5) {
  if (fs.existsSync(dest) && fs.statSync(dest).size > 0) {
    if (!md5 || crypto.createHash('md5').update(fs.readFileSync(dest)).digest('hex') === md5) return;
  }
  for (let a = 0; a < 3; a++) {
    try {
      const r = await fetch(url, { headers: UA });
      if (!r.ok) throw new Error(url + ' -> ' + r.status);
      const b = Buffer.from(await r.arrayBuffer());
      if (md5 && crypto.createHash('md5').update(b).digest('hex') !== md5) throw new Error('md5 mismatch ' + url);
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      fs.writeFileSync(dest, b); return;
    } catch (e) { if (a === 2) throw e; await new Promise(r => setTimeout(r, 1500)); }
  }
}

async function fetchModel(m) {
  const f = await (await fetch('https://api.polyhaven.com/files/' + m.id, { headers: UA })).json();
  const g = f.gltf?.['1k']?.gltf || f.gltf?.['2k']?.gltf;
  if (!g) throw new Error('no gltf');
  const d = TMP + '/' + m.id;
  const main = d + '/' + path.basename(g.url);
  await Promise.all(Object.entries(g.include || {}).map(([p, v]) => dl(v.url, d + '/' + p, v.md5)));
  await dl(g.url, main, g.md5);
  // Poly Haven's JPG glTF drops alpha: fetch the separate alpha/opacity maps and map them to the diffuse file they belong to.
  const base = (u) => path.basename(u || '');
  const keys = Object.keys(f);
  const alphaFor = {};
  for (const k of keys) {
    const diffUrl = f[k]?.['1k']?.jpg?.url; if (!diffUrl || !/(diff|diffuse)$/i.test(k)) continue;
    const cands = [k.replace(/diff(use)?$/i, 'alpha'), k.replace(/diff(use)?$/i, 'opacity')];
    const ak = keys.find(x => cands.some(c => c.toLowerCase() === x.toLowerCase()));
    const a = ak && f[ak]['1k']?.jpg; if (!a) continue;
    const p = d + '/_alpha/' + ak + '.jpg';
    await dl(a.url, p, a.md5);
    alphaFor[base(diffUrl)] = p;
  }
  fs.writeFileSync(d + '/_alpha.json', JSON.stringify(alphaFor, null, 1));
  return main;
}

function countTris(doc) {
  let t = 0;
  for (const mesh of doc.getRoot().listMeshes()) for (const p of mesh.listPrimitives()) {
    const idx = p.getIndices(), pos = p.getAttribute('POSITION');
    const n = idx ? idx.getCount() : pos ? pos.getCount() : 0;
    if (p.getMode() === 4) t += n / 3;
  }
  // account for instancing by node reuse
  let inst = 0; const uses = new Map();
  for (const node of doc.getRoot().listNodes()) { const me = node.getMesh(); if (me) uses.set(me, (uses.get(me) || 0) + 1); }
  for (const [mesh, u] of uses) for (const p of mesh.listPrimitives()) { const idx = p.getIndices(), pos = p.getAttribute('POSITION'); inst += (idx ? idx.getCount() : pos.getCount()) / 3 * u; }
  return Math.round(inst || t);
}

// Leaf-card thinning: foliage made of thousands of disconnected cards cannot be simplified; keep a
// deterministic fraction of connected components (and scale kept cards up slightly to preserve coverage).
function thinPrimitive(doc, prim, keep) {
  const idx = prim.getIndices(), pos = prim.getAttribute('POSITION');
  if (!idx || !pos) return;
  const I = idx.getArray(), n = pos.getCount();
  const par = new Int32Array(n).map((_, i) => i);
  const find = (x) => { while (par[x] !== x) { par[x] = par[par[x]]; x = par[x]; } return x; };
  for (let t = 0; t < I.length; t += 3) { const a = find(I[t]), b = find(I[t + 1]), c = find(I[t + 2]); par[b] = a; par[find(c)] = a; }
  const comps = new Map();
  for (let t = 0; t < I.length; t += 3) { const r = find(I[t]); if (!comps.has(r)) comps.set(r, []); comps.get(r).push(t); }
  if (comps.size < 400) return false;
  const P = pos.getArray().slice(); const out = [];
  const grow = Math.pow(1 / keep, 0.25);
  let k = 0; const moved = new Set();
  for (const [r, tris] of comps) {
    // deterministic hash-based pick
    const h = ((r * 2654435761) >>> 0) / 4294967296;
    if (h > keep) continue;
    const vs = new Set(); for (const t of tris) { vs.add(I[t]); vs.add(I[t + 1]); vs.add(I[t + 2]); out.push(I[t], I[t + 1], I[t + 2]); }
    let cx = 0, cy = 0, cz = 0; for (const v of vs) { cx += P[v * 3]; cy += P[v * 3 + 1]; cz += P[v * 3 + 2]; }
    cx /= vs.size; cy /= vs.size; cz /= vs.size;
    for (const v of vs) { if (moved.has(v)) continue; moved.add(v); P[v * 3] = cx + (P[v * 3] - cx) * grow; P[v * 3 + 1] = cy + (P[v * 3 + 1] - cy) * grow; P[v * 3 + 2] = cz + (P[v * 3 + 2] - cz) * grow; }
    k++;
  }
  pos.setArray(P);
  idx.setArray(new Uint32Array(out));
  return true;
}

const FOLIAGE = /plant|shrub|grass|flower|tree|fern|pachira|calathea|anthurium|periwinkle|succulent|sorrel|gazania/i;
// Merge the separate PH alpha map into the base-colour texture (RGBA) and set alphaMode MASK (0.5).
// Glass materials that were BLEND stay BLEND (alpha now comes from the texture).
async function applyAlpha(doc, m, src) {
  const af = path.dirname(src) + '/_alpha.json';
  if (!fs.existsSync(af)) return;
  const alphaFor = JSON.parse(fs.readFileSync(af));
  const done = new Map();
  for (const mat of doc.getRoot().listMaterials()) {
    const tex = mat.getBaseColorTexture(); if (!tex) continue;
    const ap = alphaFor[path.basename(tex.getURI() || '')]; if (!ap) continue;
    const mode = mat.getAlphaMode();
    if (mode === 'OPAQUE' && !FOLIAGE.test(m.name)) continue;
    if (!done.has(tex)) {
      const st = await sharp(ap).greyscale().stats();
      if (st.channels[0].min >= 250) { done.set(tex, false); continue; } // alpha map fully opaque
      const meta = await sharp(tex.getImage()).metadata();
      const alpha = await sharp(ap).greyscale().resize(meta.width, meta.height, { fit: 'fill' }).raw().toBuffer();
      const png = await sharp(await sharp(tex.getImage()).removeAlpha().png().toBuffer()).joinChannel(alpha, { raw: { width: meta.width, height: meta.height, channels: 1 } }).png().toBuffer();
      tex.setImage(new Uint8Array(png)).setMimeType('image/png').setURI(tex.getURI().replace(/.jpe?g$/i, '.png'));
      done.set(tex, true);
    }
    if (!done.get(tex)) continue;
    if (mode === 'BLEND' && /glass/i.test(mat.getName())) continue;
    mat.setAlphaMode('MASK').setAlphaCutoff(0.5).setDoubleSided(true);
    ALPHA_LOG.push(m.name + ':' + mat.getName());
  }
}
export const ALPHA_LOG = [];

function baseCentre(doc, node) {
  const b = getBounds(node);
  const t = node.getTranslation();
  node.setTranslation([t[0] - (b.min[0] + b.max[0]) / 2, t[1] - b.min[1], t[2] - (b.min[2] + b.max[2]) / 2]);
  return b;
}

async function finalize(doc, m, outName, extra = {}) {
  const scene = doc.getRoot().listScenes()[0];
  await doc.transform(prune(), dedup());
  const b = getBounds(scene);
  const root = doc.createNode(outName);
  for (const c of scene.listChildren()) { scene.removeChild(c); root.addChild(c); }
  scene.addChild(root);
  if (!m.variants) root.setTranslation([-(b.min[0] + b.max[0]) / 2, -b.min[1], -(b.min[2] + b.max[2]) / 2]);
  const nb = getBounds(scene);
  const dims = [0, 1, 2].map(i => +(nb.max[i] - nb.min[i]).toFixed(3));
  doc.getRoot().getAsset().extras = { source: 'https://polyhaven.com/a/' + m.id, license: 'CC0', name: outName, ...extra };
  const out = OUT + '/' + outName + '.glb';
  await io.write(out, doc);
  return { name: outName, file: 'models/' + outName + '.glb', dims, tris: countTris(doc), mb: +(fs.statSync(out).size / 1048576).toFixed(2), ...extra };
}

async function prep(m, src) {
  const doc = await io.read(src);
  const scene = doc.getRoot().getDefaultScene() || doc.getRoot().listScenes()[0];
  for (const s2 of doc.getRoot().listScenes()) if (s2 !== scene) s2.dispose();
  if (m.drop) for (const n of scene.listChildren()) if (new RegExp(m.drop).test(n.getName())) n.dispose();
  await applyAlpha(doc, m, src);
  if (m.splitKey) for (const n of scene.listChildren()) if ((n.getName().match(new RegExp(m.split)) || [])[1] !== m.splitKey) n.dispose();
  await doc.transform(dedup(), weld());
  await MeshoptSimplifier.ready;
  for (const mesh of doc.getRoot().listMeshes()) for (const p of mesh.listPrimitives()) {
    const leaf = /lea(f|ves)|foliage|needle/i.test(p.getMaterial()?.getName() || '');
    if (leaf && m.thin) thinPrimitive(doc, p, m.thin);
    const ratio = leaf ? (m.leafSimplify ?? m.simplify) : (m.branchSimplify && /branch/i.test(p.getMaterial()?.getName() || '') ? m.branchSimplify : m.simplify);
    if (ratio && ratio < 1) simplifyPrimitive(p, { simplifier: MeshoptSimplifier, ratio, error: m.simplifyError ?? 0.02, lockBorder: false });
  }
  // small props (< 0.5 m) get 512px textures; everything else 1024px
  const bb = getBounds(scene), maxDim = Math.max(...[0, 1, 2].map(i => bb.max[i] - bb.min[i]));
  const texres = m.texres || (maxDim < 0.5 || (m.variants && !m.texres) ? 512 : 1024);
  await doc.transform(prune(),
    textureCompress({ encoder: sharp, targetFormat: 'webp', resize: [texres, texres], quality: 82 }),
    quantize({ quantizePosition: 14, quantizeNormal: 10, quantizeTexcoord: 12 }));
  return doc;
}

async function pack(m, src) {
  if (!m.split) {
    const doc = await prep(m, src);
    let variants;
    if (m.variants) { const sc = doc.getRoot().listScenes()[0]; for (const n of sc.listChildren()) baseCentre(doc, n); variants = sc.listChildren().map(n => n.getName()); }
    return [await finalize(doc, m, m.name, variants ? { variants } : {})];
  }
  // split: one GLB per group key captured by m.split regex on top-level node names
  const probe = await io.read(src);
  const keys = [...new Set(probe.getRoot().listScenes()[0].listChildren().map(n => (n.getName().match(new RegExp(m.split)) || [])[1]).filter(Boolean))].sort();
  const res = [];
  for (const key of keys) {
    const doc = await prep({ ...m, splitKey: key }, src);
    res.push(await finalize(doc, m, m.name + '_' + key));
  }
  return res;
}

const results = {};
const queue = list.filter(m => !only.length || only.includes(m.name));
async function worker() {
  while (queue.length) {
    const m = queue.shift();
    const out = OUT + '/' + m.name + '.glb';
    try {
      if ((fs.existsSync(out) || fs.existsSync(OUT + '/' + m.name + '_a.glb')) && !process.env.FORCE) { console.log('SKIP', m.name); continue; }
      const src = await fetchModel(m);
      for (const r of await pack(m, src)) {
        results[r.name] = { ...r, source: 'https://polyhaven.com/a/' + m.id, id: m.id, cat: m.cat, need: m.need };
        console.log('OK', r.name, r.tris, 'tris', r.mb, 'MB', r.dims.join('x'));
      }
    } catch (e) { console.log('FAIL', m.name, e.message); results[m.name] = { error: e.message }; }
  }
}
await Promise.all(Array.from({ length: CONC }, worker));
console.log('ALPHA', ALPHA_LOG.length, [...new Set(ALPHA_LOG.map(x => x.split(':')[0]))].join(' '));
const logf = TMP + '/results_' + Date.now() + '.json';
fs.writeFileSync(logf, JSON.stringify(results, null, 1));
console.log('results ->', logf);
