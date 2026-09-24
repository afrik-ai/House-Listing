// Tiled surfaces: square/rect grids (optionally staggered) and hex mosaics, recessed grout, bevelled
// edges, per-tile tint / tilt / lippage. `face(u,v,tile,out)` fills the tile body (colour, height, roughness).
import { Tex, rng, hash, hashi, fbm, gnoise, smooth, mix, fract, mod, sat, clamp } from './lib.mjs';

const SQ3 = Math.sqrt(3);

// layout: {kind:'grid', nx, ny, stagger} | {kind:'hex', nx, ny}  (hex: pointy-top, ny even)
export function tiles(res, o) {
  const t = new Tex(res), S = o.sizeMM, mm = S / res;
  const L = o.layout, out = { r: 0, g: 0, b: 0, h: 0, rough: 0.5 };
  const g2 = o.groutMM / 2;
  t.each((u, v, k) => {
    let id, lx, ly, e, tw, th; // e = distance to tile edge (mm), lx,ly local -0.5..0.5
    if (L.kind === 'grid') {
      const y = v * L.ny, row = Math.floor(y), x = u * L.nx + row * (L.stagger || 0), col = mod(Math.floor(x), L.nx);
      id = hashi(col, row, o.seed); tw = S / L.nx; th = S / L.ny;
      lx = fract(x) - 0.5; ly = fract(y) - 0.5;
      e = Math.min((0.5 - Math.abs(lx)) * tw, (0.5 - Math.abs(ly)) * th);
    } else {
      // hex lattice in cell units: column pitch 1 (=sqrt3 r), row pitch 1 (=1.5 r); odd rows shifted 0.5
      const x = u * L.nx, y = v * L.ny; let best = 1e9, bi = 0, bj = 0, bx = 0, by = 0;
      const j0 = Math.floor(y);
      for (let j = j0 - 1; j <= j0 + 1; j++) { const sh = mod(j, 2) ? 0.5 : 0; const i0 = Math.floor(x - sh);
        for (let i = i0 - 1; i <= i0 + 1; i++) { const cx = i + 0.5 + sh, cy = j + 0.5; const dx = (x - cx) * SQ3, dy = (y - cy) * 1.5, d = dx * dx + dy * dy;
          if (d < best) { best = d; bi = i; bj = j; bx = dx; by = dy; } } }
      id = hashi(mod(bi, L.nx), mod(bj, L.ny), o.seed);
      const r = 1; // circumradius in r units; apothem = sqrt3/2
      const d = Math.max(Math.abs(bx), Math.abs(bx * 0.5 + by * SQ3 / 2), Math.abs(bx * 0.5 - by * SQ3 / 2));
      const rMM = S / L.nx / SQ3; e = (SQ3 / 2 - d) * rMM; lx = bx / 2; ly = by / 2; tw = th = rMM * 2;
    }
    const hr = (n) => ((id >>> (n * 4)) & 255) / 255;
    // tile face
    o.face(u, v, id, hr, out, lx, ly, tw, th);
    const tint = 1 + (hr(0) - 0.5) * 2 * o.tintVar;
    const edge = smooth(0, o.bevelMM, e - g2); // 0 at grout line -> 1 on flat face
    const tilt = ((hr(1) - 0.5) * lx * tw + (hr(2) - 0.5) * ly * th) * (o.tilt ?? 0.004) + (hr(3) - 0.5) * (o.lip ?? 0.2);
    if (e > g2) {
      const prof = Math.sqrt(edge);
      t.r[k] = out.r * tint; t.g[k] = out.g * tint; t.b[k] = out.b * tint;
      t.h[k] = out.h + tilt + (prof - 1) * o.bevelDepth;
      t.rough[k] = out.rough + (1 - edge) * 0.08 + (hr(5) - 0.5) * (o.roughVar ?? 0.06);
    } else {
      const sand = gnoise(u * res / 3, v * res / 3, res / 3, res / 3, 77) * 0.5 + fbm(u, v, 12, 12, 3, 78) * 0.5;
      const dirt = fbm(u, v, 6, 6, 3, 79);
      const gc = o.grout, gk = 1 + sand * 0.12 + dirt * (o.groutDirt ?? 0.15);
      t.r[k] = gc[0] * gk; t.g[k] = gc[1] * gk; t.b[k] = gc[2] * gk;
      t.h[k] = -o.groutDepth - o.bevelDepth + sand * 0.05 + (e / g2) * 0.1;
      t.rough[k] = o.groutRough + sand * 0.04;
    }
  });
  return { t, mm };
}
