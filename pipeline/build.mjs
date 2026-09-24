#!/usr/bin/env node
// House shell pipeline driver.
//   node pipeline/build.mjs villa-nova             build GLB + meta with Blender, then validate
//   node pipeline/build.mjs villa-nova --render    ... and render the Blender previews to reviews/p02-blender/
//   node pipeline/build.mjs villa-nova --validate  only validate the existing GLB/meta
// Exit code != 0 when Blender fails or validation finds errors.
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const id = args.find(a => !a.startsWith('--')) || 'villa-nova';
const flag = f => args.includes(f);
const BLENDER = process.env.BLENDER || (process.platform === 'win32'
  ? path.join(ROOT, 'tools', 'blender-5.2.1-windows-x64', 'blender.exe') : path.join(ROOT, 'tools', 'blender', 'blender'));
const OUT = path.join(ROOT, 'public', 'assets', 'houses', id);
const GLB = path.join(OUT, 'house.glb');
const META = path.join(OUT, 'house.meta.json');
const SPEC = path.join(ROOT, 'houses', id, 'house.json');

function blender(script, extra = []) {
  const t = Date.now();
  const r = spawnSync(BLENDER, ['-b', '--factory-startup', '--python', path.join(ROOT, 'pipeline', 'blender', script), '--', id, ...extra],
    { cwd: ROOT, encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 });
  const out = (r.stdout || '') + (r.stderr || '');
  for (const line of out.split(/\r?\n/)) {
    if (/\[build_house|rendered|Traceback|Error(?!: Shadow)|Exception|^\s+File "/.test(line)) console.log('  ' + line);
  }
  if (r.status !== 0 || /Traceback/.test(out)) { console.error(`blender ${script} failed (exit ${r.status})`); process.exit(1); }
  console.log(`  ${script}: ${((Date.now() - t) / 1000).toFixed(1)} s`);
}

function readGlb(file) {
  const b = fs.readFileSync(file);
  if (b.readUInt32LE(0) !== 0x46546c67) throw new Error('not a GLB');
  const jsonLen = b.readUInt32LE(12);
  return { json: JSON.parse(b.subarray(20, 20 + jsonLen).toString('utf8')), size: b.length };
}

if (!flag('--validate')) {
  console.log(`> building ${id} with Blender`);
  blender('build_house.py');
}

// ------------------------------------------------------------------ validation
const { json: g, size } = readGlb(GLB);
const meta = JSON.parse(fs.readFileSync(META, 'utf8'));
const spec = JSON.parse(fs.readFileSync(SPEC, 'utf8'));
const errors = [], warns = [];
const nodes = g.nodes || [];
const byName = new Map(nodes.map((n, i) => [n.name, i]));
const parentOf = new Map();
nodes.forEach((n, i) => (n.children || []).forEach(c => parentOf.set(c, i)));

// triangles
let tris = 0, trisInst = 0, drawPrims = 0;
const meshTris = (g.meshes || []).map(m => m.primitives.reduce((s, p) => {
  const idx = p.indices !== undefined ? g.accessors[p.indices].count : g.accessors[p.attributes.POSITION].count;
  return s + idx / 3;
}, 0));
for (const n of nodes) {
  if (n.mesh === undefined) continue;
  const inst = n.extensions?.EXT_mesh_gpu_instancing;
  const count = inst ? g.accessors[inst.attributes.TRANSLATION].count : 1;
  const t = meshTris[n.mesh];
  if (n.name.startsWith('COL_')) continue;
  tris += t; trisInst += t * count; drawPrims += g.meshes[n.mesh].primitives.length;
}
const colTris = nodes.filter(n => n.mesh !== undefined && n.name.startsWith('COL_')).reduce((s, n) => s + meshTris[n.mesh], 0);

// names vs meta
for (const r of meta.rooms) {
  const i = byName.get('ROOM_' + r.id);
  if (i === undefined) errors.push(`missing ROOM_${r.id}`);
  else { const ex = nodes[i].extras || {}; if (ex.level === undefined || ex.name === undefined || ex.area === undefined) errors.push(`ROOM_${r.id} extras incomplete`); }
  if (!r.exterior && !nodes.some(n => n.name.startsWith('SURF_') && n.name.endsWith('_' + r.id))) errors.push(`room ${r.id} has no SURF_*_${r.id} floor`);
  if (!r.exterior && !nodes.some(n => n.name === 'CEIL_' + r.id)) warns.push(`room ${r.id} has no CEIL_${r.id}`);
}
for (const d of meta.doors) {
  const i = byName.get('DOOR_' + d.id);
  if (i === undefined) { errors.push(`missing DOOR_${d.id}`); continue; }
  const leaf = byName.get(`LEAF_${d.id}`), col = byName.get('COL_DOOR_' + d.id);
  if (leaf === undefined || parentOf.get(leaf) !== i) errors.push(`LEAF_${d.id} not a child of DOOR_${d.id}`);
  if (col === undefined || parentOf.get(col) !== leaf) errors.push(`COL_DOOR_${d.id} not a child of the leaf`);
  const t = nodes[i].translation || [0, 0, 0];
  if (Math.hypot(t[0] - d.hinge[0], t[1] - d.hinge[1], t[2] - d.hinge[2]) > 1e-3) errors.push(`DOOR_${d.id} pivot != meta hinge`);
  if (!d.room_b) errors.push(`door ${d.id} has no swing room`);
}
for (const l of meta.lights) if (!byName.has('LIGHT_' + l.id)) errors.push(`missing LIGHT_${l.id}`);
const sp = byName.get('SPAWN');
if (sp === undefined) errors.push('missing SPAWN'); else if ((nodes[sp].extras || {}).yaw === undefined) errors.push('SPAWN has no yaw');
for (const need of ['COL_structure', 'COL_stair', 'GLASS', 'FRAMES']) if (!byName.has(need)) errors.push(`missing ${need}`);
// room ids unique + inside bounds
const ids = meta.rooms.map(r => r.id); if (new Set(ids).size !== ids.length) errors.push('duplicate room ids');
// materials
const allowed = new Set([...Object.keys(spec.materials || {}), ...Object.keys(spec.extra_materials || {})]);
for (const m of g.materials || []) if (!allowed.has(m.name)) errors.push(`material "${m.name}" not declared in house.json`);
if ((g.images || []).length || (g.textures || []).length) errors.push('GLB embeds images/textures');
// UV2 on visible meshes
for (const n of nodes) {
  if (n.mesh === undefined || n.name.startsWith('COL_')) continue;
  for (const p of g.meshes[n.mesh].primitives) {
    if (p.attributes.TEXCOORD_0 === undefined) errors.push(`${n.name}: no UV0`);
    if (p.attributes.TEXCOORD_1 === undefined) errors.push(`${n.name}: no UV2 (TEXCOORD_1)`);
  }
}
// COL meshes have no material (runtime hides COL_*)
for (const n of nodes) if (n.name.startsWith('COL_') && n.mesh !== undefined && g.meshes[n.mesh].primitives.some(p => p.material !== undefined)) warns.push(`${n.name} has a material`);
if (size > 40e6) errors.push(`GLB too large: ${(size / 1e6).toFixed(1)} MB`);
// room area sanity vs. spec target
for (const r of meta.rooms) {
  if (r.exterior || !r.area_src) continue;
  const dev = (r.area - r.area_src) / r.area_src;
  if (Math.abs(dev) > 0.10) warns.push(`area ${r.id}: ${r.area} m2 vs spec ${r.area_src} (${(dev * 100).toFixed(0)}%)`);
}

const kinds = {};
for (const n of nodes) { const k = n.name.split('_')[0]; kinds[k] = (kinds[k] || 0) + 1; }
console.log(`\n${id}: ${path.relative(ROOT, GLB)}  ${(size / 1e6).toFixed(2)} MB`);
console.log(`  nodes ${nodes.length}  meshes ${(g.meshes || []).length}  materials ${(g.materials || []).length}  visible primitives ${drawPrims}`);
console.log(`  triangles: ${Math.round(tris)} unique, ${Math.round(trisInst)} incl. GPU instances, collision ${Math.round(colTris)}`);
console.log(`  rooms ${meta.rooms.length}  doors ${meta.doors.length}  lights ${meta.lights.length}  spawn ${JSON.stringify(meta.spawn.pos)} yaw ${meta.spawn.yaw}`);
console.log('  node prefixes: ' + Object.entries(kinds).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k}:${v}`).join(' '));
console.log(`  bounds ${JSON.stringify(meta.bounds)}`);
for (const w of warns) console.log('  warn: ' + w);
for (const e of errors) console.log('  ERROR: ' + e);
console.log(errors.length ? `\nFAILED (${errors.length} errors)` : '\nOK - node names match meta');

if (flag('--render') && !errors.length) {
  console.log('\n> rendering previews');
  const extra = [];
  const vi = args.indexOf('--views'); if (vi >= 0) extra.push('--only', args[vi + 1]);
  blender('render_previews.py', extra);
}
process.exit(errors.length ? 1 : 0);
