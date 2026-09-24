// Offline procedural generator for every texture set in textures.json (for machines that cannot reach
// Poly Haven / ambientCG). Writes public/assets/textures/<name>/{color,normal,roughness,ao}.jpg + meta.json
// with the same layout as dl_textures.mjs, so the runtime needs no changes.
// usage: node scripts/assets/gen_textures.mjs [name ...] [--jobs N]
// Recipes live in scripts/assets/texgen/recipes.mjs (tileable pure-JS noise, no network).
import fs from 'fs';
import os from 'os';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';

const ROOT = fileURLToPath(new URL('../..', import.meta.url)).replace(/\\/g, '/').replace(/\/$/, '');
const OUT = ROOT + '/public/assets/textures';
const list = JSON.parse(fs.readFileSync(new URL('./textures.json', import.meta.url)));
const args = process.argv.slice(2);

if (args[0] === '--one') {
  const { RECIPES } = await import('./texgen/recipes.mjs');
  const { save } = await import('./texgen/lib.mjs');
  const e = list.find((x) => x.name === args[1]);
  const px = /2/.test(e.res) ? 2048 : 1024;
  const t0 = Date.now();
  const { t, mm, opts } = RECIPES[e.name](px, e);
  const dir = OUT + '/' + e.name;
  const maps = await save(t, dir, { mmPerPx: mm, ...opts });
  const meta = { name: e.name, source: 'procedural (scripts/assets/gen_textures.mjs)', source_id: e.id, license: 'CC0', scale_m: e.scale_m,
    resolution: px, maps, normal: 'OpenGL (+Y up)', description: e.desc, ...(e.post ? { recolour: e.post } : {}),
    ao_note: 'procedural: cavity AO from generated height' };
  fs.writeFileSync(dir + '/meta.json', JSON.stringify(meta, null, 1));
  console.log('OK', e.name, Object.keys(maps).join(','), px, ((Date.now() - t0) / 1000).toFixed(1) + 's');
  process.exit(0);
}

const ji = args.indexOf('--jobs');
const jobs = ji >= 0 ? Number(args[ji + 1]) : Math.max(1, Math.min(3, os.cpus().length - 1));
const names = args.filter((a, i) => !a.startsWith('--') && (ji < 0 || i !== ji + 1));
const todo = list.filter((e) => !names.length || names.includes(e.name));
const T0 = Date.now(); let fail = 0;
const run = (e) => new Promise((res) => {
  const p = spawn(process.execPath, [fileURLToPath(import.meta.url), '--one', e.name], { stdio: ['ignore', 'pipe', 'pipe'] });
  let out = ''; p.stdout.on('data', (d) => (out += d)); p.stderr.on('data', (d) => (out += d));
  const to = setTimeout(() => p.kill('SIGKILL'), 10 * 60 * 1000);
  p.on('close', (code) => { clearTimeout(to); if (code) { fail++; console.log('FAIL', e.name, out.trim().split('\n').slice(-6).join('\n')); } else process.stdout.write(out); res(); });
});
const q = [...todo];
await Promise.all(Array.from({ length: jobs }, async () => { while (q.length) await run(q.shift()); }));
console.log(`done ${todo.length - fail}/${todo.length} in ${((Date.now() - T0) / 1000).toFixed(0)}s`);
process.exit(fail ? 1 : 0);
