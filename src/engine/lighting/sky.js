import * as THREE from 'three';

// P05 sky grading, done once per HDRI on the CPU (equirect data, texture frame):
//  * removeSun: the HDRI's own sun/moon blob is flattened into the surrounding sky, because the
//    lighting sun sits at a different elevation (golden hour 8-12 deg, day 36 deg, moon 30 deg);
//  * disc: a sun (or moon) disc + glow painted where the shadow-casting light really is, so the
//    visible disc, the shadows and the specular highlights agree;
//  * tint / add: vertical gradients (multiply, then add) to warm a golden-hour sky or lift a night
//    horizon, optionally stronger toward the sun azimuth (`sunSide`).
// Pixel directions follow three's equirect lookup (u = atan(z, x) / 2PI + 0.5, row 0 = +Y).
export function dirToTexel(az, el) {
  const a = THREE.MathUtils.degToRad(az), e = THREE.MathUtils.degToRad(el);
  return new THREE.Vector3(Math.sin(a) * Math.cos(e), Math.sin(e), -Math.cos(a) * Math.cos(e));
}

export function gradeSky(img, f, t, spec) {
  const { data, width: W, height: H } = img;
  const ch = data.length / (W * H);
  const lum = (r, g, b) => 0.2126 * r + 0.7152 * g + 0.0722 * b;
  const pixDir = (x, y, out) => {
    const phi = ((x + 0.5) / W - 0.5) * Math.PI * 2;
    const el = (0.5 - (y + 0.5) / H) * Math.PI;
    return out.set(Math.cos(phi) * Math.cos(el), Math.sin(el), Math.sin(phi) * Math.cos(el));
  };
  const d = new THREE.Vector3();
  const rowOf = (el) => Math.round((0.5 - THREE.MathUtils.degToRad(el) / Math.PI) * H);

  // 1) flatten the HDRI's own sun: pixels within R deg -> capped at the ring luminance.
  if (spec.removeSun) {
    const { az, el, radiusDeg = 4 } = spec.removeSun;
    const s = dirToTexel(az, el);
    const cosR = Math.cos(THREE.MathUtils.degToRad(radiusDeg)), cosR2 = Math.cos(THREE.MathUtils.degToRad(radiusDeg * 1.6));
    const y0 = Math.max(0, rowOf(el + radiusDeg * 1.7)), y1 = Math.min(H - 1, rowOf(el - radiusDeg * 1.7));
    let ring = 0, n = 0;
    const idx = [];
    for (let y = y0; y <= y1; y++) for (let x = 0; x < W; x++) {
      const c = pixDir(x, y, d).dot(s);
      if (c < cosR2) continue;
      const i = (y * W + x) * ch;
      if (c < cosR) { ring += lum(f(data[i]), f(data[i + 1]), f(data[i + 2])); n++; } else idx.push(i, c);
    }
    const cap = n ? ring / n : 1;
    for (let k = 0; k < idx.length; k += 2) {
      const i = idx[k];
      const r = f(data[i]), g = f(data[i + 1]), b = f(data[i + 2]);
      const l = lum(r, g, b);
      const lim = cap * 1.15;
      if (l > lim) { const q = lim / l; data[i] = t(r * q); data[i + 1] = t(g * q); data[i + 2] = t(b * q); }
    }
  }

  // 2) gradients (upper hemisphere + a little below the horizon).
  if (spec.tint || spec.add) {
    const sd = spec.disc ? dirToTexel(spec.disc.az, 0).setY(0).normalize() : null;
    const tz = spec.tint?.zenith || [1, 1, 1], th = spec.tint?.horizon || [1, 1, 1];
    const az = spec.add?.zenith || [0, 0, 0], ah = spec.add?.horizon || [0, 0, 0];
    const side = spec.sunSide || 0;
    for (let y = 0; y < H; y++) {
      const el = (0.5 - (y + 0.5) / H) * 180;
      if (el < -3) break;
      const k = Math.pow(1 - THREE.MathUtils.clamp(el / 90, 0, 1), 3);   // 1 at the horizon -> 0 at the zenith
      for (let x = 0; x < W; x++) {
        let s = 0;
        if (sd && side) { pixDir(x, y, d); d.y = 0; s = Math.max(0, d.normalize().dot(sd)); s = s * s * side * k; }
        const i = (y * W + x) * ch;
        for (let c = 0; c < 3; c++) {
          const tm = tz[c] + (th[c] - tz[c]) * Math.min(1, k * (1 + s));
          const ad = az[c] + (ah[c] - az[c]) * k;
          data[i + c] = t(f(data[i + c]) * tm + ad);
        }
      }
    }
  }

  // 3) the disc + glow where the light really is.
  if (spec.disc) {
    const { az, el, radiusDeg = 0.6, radiance, glow = [0, 0, 0], glowDeg = 6, glow2 = null, glow2Deg = 25 } = spec.disc;
    const s = dirToTexel(az, el);
    const rr = THREE.MathUtils.degToRad(radiusDeg);
    const span = Math.max(glowDeg * 4, glow2 ? glow2Deg * 3 : 0, radiusDeg * 2);
    const y0 = Math.max(0, rowOf(el + span)), y1 = Math.min(H - 1, rowOf(el - span));
    for (let y = y0; y <= y1; y++) for (let x = 0; x < W; x++) {
      const c = pixDir(x, y, d).dot(s);
      const ang = Math.acos(THREE.MathUtils.clamp(c, -1, 1));
      if (ang > THREE.MathUtils.degToRad(span)) continue;
      const i = (y * W + x) * ch;
      const aDeg = THREE.MathUtils.radToDeg(ang);
      const disc = THREE.MathUtils.clamp((rr - ang) / (rr * 0.18) + 0.5, 0, 1);   // AA edge
      const limb = 1 - 0.35 * Math.pow(Math.min(1, ang / rr), 2);
      const g1 = Math.exp(-aDeg / glowDeg);
      const g2 = glow2 ? Math.exp(-aDeg / glow2Deg) : 0;
      for (let c = 0; c < 3; c++) {
        let v = f(data[i + c]) + glow[c] * g1 + (glow2 ? glow2[c] * g2 : 0);
        v = v * (1 - disc) + radiance[c] * limb * disc;
        data[i + c] = t(v);
      }
    }
  }
}
