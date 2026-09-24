import { fileURLToPath } from 'url';
// Adds/updates the procedural props in public/assets/manifest.json (same schema as the other model entries)
// and the one-line procedural-props credit in public/assets/CREDITS.md.  usage: node pipeline/props/manifest_add.mjs
import fs from 'fs';
const R = fileURLToPath(new URL('../..', import.meta.url)).replace(/\\/g, '/').replace(/\/$/, '');
const B = R + '/pipeline/props/_build';
const SOURCE = 'procedural (HouseListing pipeline/props)';
const FR = 'FLOOR-REFERENCED: y=0 is the finished floor (geometry floats), back (-Z) face goes flush to the wall. ';
const PROPS = {
  fridge_modern: ['kitchen', 'tall stainless fridge-freezer, bar handles, door display; front +Z, back against wall'],
  kitchen_sink: ['kitchen', 'undermount steel sink + black gooseneck mixer. variants: sink_worktop (1.2x0.62 m quartz worktop module, top at y=0.23), sink_bowl (bowl only, flange top = max Y, needs a 0.54x0.40 cut-out), mixer_tap'],
  toaster: ['kitchen', 'brushed-steel 2-slice toaster (worktop prop)'],
  toilet_wall_hung: ['bath', FR + 'wall-hung WC (lid closed) + black dual flush plate at 1.0 m'],
  bathtub_freestanding: ['bath', 'freestanding oval white bathtub, 1.70 m (length along X)'],
  bathroom_vanity: ['bath', FR + 'wall-hung oak vanity (top at 0.85 m), vessel basin, black mixer, round black mirror (centre 1.48 m)'],
  towel_folded: ['bath', 'single folded white bath towel (shelf/vanity/bed prop)'],
  towel_stack: ['bath', 'stack of 4 folded towels (2 white, 2 anthracite)'],
  washing_machine: ['laundry', 'front-loading washing machine, glass porthole door; front +Z'],
  sun_lounger: ['outdoor', 'teak sun lounger with white cushions, backrest up; foot end +Z'],
  parasol_cantilever: ['outdoor', 'cantilever parasol, 3x3 m off-white canopy, anthracite mast on slab base (mast at -X)'],
  bicycle: ['garage', 'city bike 700c, sage frame, gumwall tyres, on kickstand (length along X)'],
  office_chair: ['office', 'mesh-back office chair, 5-star aluminium base; front +Z'],
  floor_lamp_arc: ['lighting', 'arc floor lamp, marble base at -X, shade reaches +X (emissive LED disc)'],
  hanging_egg_chair: ['outdoor', 'rattan hanging egg chair on black C-stand (alpha-masked weave); opening faces +Z'],
  bed_double_modern: ['bedroom', 'modern upholstered double bed 160x200, duvet, pillows, throw; headboard at -Z (wall)'],
  rug_rect_200x300: ['decor', 'low-pile wool rug 2x3 m, ivory with charcoal lattice, fringed short ends'],
  rug_round_160: ['decor', 'round low-pile rug 1.6 m, warm grey tone-on-tone, charcoal bound edge'],
  car_suv: ['garage', 'graphite metallic SUV (XC90-like massing), stylised-realistic; nose +Z'],
};
const mf = JSON.parse(fs.readFileSync(R + '/public/assets/manifest.json', 'utf8'));
for (const [name, [cat, use]] of Object.entries(PROPS)) {
  const pk = JSON.parse(fs.readFileSync(`${B}/${name}.pack.json`, 'utf8'));
  const meta = JSON.parse(fs.readFileSync(`${B}/${name}.json`, 'utf8'));
  const e = { file: `models/${name}.glb`, dims: pk.dims, tris: pk.tris, mb: pk.mb, category: cat, use, source: SOURCE };
  if (meta.variants) e.variants = meta.variants;
  mf.models[name] = e;
}
mf.models = Object.fromEntries(Object.entries(mf.models).sort(([a], [b]) => a.localeCompare(b)));
fs.writeFileSync(R + '/public/assets/manifest.json', JSON.stringify(mf, null, 1));
const cp = R + '/public/assets/CREDITS.md';
let md = fs.readFileSync(cp, 'utf8');
const line = `- Procedural props (CC0, built in Blender 5.2 by \`pipeline/props/*.py\`, no third-party data): ${Object.keys(PROPS).join(', ')}.`;
md = md.replace(/\n## Procedural models[\s\S]*$/, '');
md = md.trimEnd() + '\n\n## Procedural models\n\n' + line + '\n';
fs.writeFileSync(cp, md);
console.log('manifest models:', Object.keys(mf.models).length, '| added/updated', Object.keys(PROPS).length);
