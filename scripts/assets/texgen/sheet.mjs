// Dev tool: contact sheet of generated maps tiled 2x2. usage: node scripts/assets/texgen/sheet.mjs out.jpg tile_px map [name...]
import sharp from 'sharp'; import fs from 'fs';
const [out, tp, map, ...names] = process.argv.slice(2); const T = +tp;
const D = '/home/user/House-Listing/public/assets/textures/';
const all = names.length ? names : fs.readdirSync(D).sort();
const cols = Math.min(all.length, 4), rows = Math.ceil(all.length / cols);
const comps = [];
for (let i = 0; i < all.length; i++) {
  const f = D + all[i] + '/' + map + '.jpg'; if (!fs.existsSync(f)) continue;
  const half = await sharp(f).resize(T / 2, T / 2).toBuffer();
  const tile = await sharp({ create: { width: T, height: T, channels: 3, background: '#000' } }).composite([
    { input: half, left: 0, top: 0 }, { input: half, left: T / 2, top: 0 }, { input: half, left: 0, top: T / 2 }, { input: half, left: T / 2, top: T / 2 }]).png().toBuffer();
  const label = Buffer.from(`<svg width="${T}" height="22"><rect width="100%" height="22" fill="black" opacity="0.6"/><text x="4" y="16" font-size="15" fill="white" font-family="sans-serif">${all[i]}</text></svg>`);
  comps.push({ input: await sharp(tile).composite([{ input: label, left: 0, top: 0 }]).png().toBuffer(), left: (i % cols) * T, top: Math.floor(i / cols) * T });
}
await sharp({ create: { width: cols * T, height: rows * T, channels: 3, background: '#333' } }).composite(comps).jpeg({ quality: 85 }).toFile(out);
