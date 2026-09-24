// Build -> pack -> review-render props.  usage: node pipeline/props/make.mjs [name ...] [--no-render]
// (no names = every <name>.py in pipeline/props except helpers/render)
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawnSync } from 'child_process';
const R = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const P = R + '/pipeline/props';
// Blender executable: BLENDER env var wins (see SPEC.md "Stack"). pipeline/bin/blender-bpy runs the same
// scripts through the PyPI `bpy` module when no Blender binary can be installed.
const BL = process.env.BLENDER || (process.platform === 'win32'
  ? R + '/tools/blender-5.2.1-windows-x64/blender.exe' : R + '/tools/blender/blender');
const args = process.argv.slice(2);
const noRender = args.includes('--no-render');
let names = args.filter(a => !a.startsWith('--'));
if (!names.length) names = fs.readdirSync(P).filter(f => f.endsWith('.py') && !['helpers.py', 'render.py'].includes(f)).map(f => f.slice(0, -3));
const run = (cmd, a) => {
  const r = spawnSync(cmd, a, { encoding: 'utf8', maxBuffer: 1 << 28 });
  const all = (r.stdout || '') + (r.stderr || '');
  const tb = all.indexOf('Traceback');
  if (tb >= 0 || r.status) throw new Error(all.slice(tb >= 0 ? tb : -3000).slice(0, 4000));
  return all.split(/\r?\n/).filter(l => /BUILT|PACKED|RENDERED|WARN/.test(l)).join('\n');
};
for (const n of names) {
  const t = Date.now();
  try {
    console.log(run(BL, ['-b', '--factory-startup', '--python-exit-code', '1', '--python', `${P}/${n}.py`]));
    console.log(run('node', [`${P}/pack.mjs`, n]));
    if (!noRender) console.log(run(BL, ['-b', '--factory-startup', '--python-exit-code', '1', '--python', `${P}/render.py`, '--', n]));
  } catch (e) { console.log('FAILED', n, e.message); }
  console.log(n, ((Date.now() - t) / 1000).toFixed(1) + 's');
}
