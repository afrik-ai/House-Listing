import * as THREE from 'three';

// P07 furniture material palette. Procedural furniture uses metric box UVs (1 UV unit = 1 m), so each
// textured material scales its maps by 1/scale_m via texture.repeat on a per-material texture clone
// (clones share the image Source, i.e. one GPU upload per image).
//
// Palette keys are referenced from generators (proc/*.js) and from furniture.json `tint`/`material` fields.

const TEX_ROOT = '/assets/textures';

// Deterministic PRNG (mulberry32) so procedural textures/clutter are stable between loads.
export function rng(seed = 1) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export class Materials {
  constructor(game, manifest) {
    this.game = game;
    this.manifest = manifest;
    this.m = {};
    this._texJobs = new Map();
  }

  async _tex(name, map, repeatM, { color = false, rotation = 0 } = {}) {
    const info = this.manifest?.textures?.[name];
    const url = `${TEX_ROOT}/${name}/${map}.jpg`;
    if (!info?.maps?.[map]) return null;
    const base = await this.game.loader.loadTexture(url, { colorSpace: color ? THREE.SRGBColorSpace : THREE.NoColorSpace });
    const t = base.clone();
    const s = 1 / (repeatM ?? info.scale_m ?? 1);
    t.repeat.set(s, s);
    t.rotation = rotation;
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.anisotropy = this.game.renderer?.settings?.anisotropy || 8;
    t.needsUpdate = true;
    return t;
  }

  // Textured MeshStandardMaterial from a manifest texture set (+ optional tint / overrides).
  async textured(key, texName, { tint, scale, rough = 1, normalScale = 1, rotation = 0, ao = false, ...rest } = {}) {
    const [map, normalMap, roughnessMap, aoMap] = await Promise.all([
      this._tex(texName, 'color', scale, { color: true, rotation }),
      this._tex(texName, 'normal', scale, { rotation }),
      this._tex(texName, 'roughness', scale, { rotation }),
      ao ? this._tex(texName, 'ao', scale, { rotation }) : null,
    ]);
    const mat = new THREE.MeshStandardMaterial({
      name: `P07_${key}`, map, normalMap, roughnessMap, aoMap, roughness: rough,
      color: tint ? new THREE.Color(tint) : 0xffffff, ...rest,
    });
    if (normalMap) mat.normalScale.set(normalScale, normalScale);
    this.m[key] = mat;
    return mat;
  }

  plain(key, color, roughness = 0.6, metalness = 0, extra = {}) {
    const mat = new THREE.MeshStandardMaterial({ name: `P07_${key}`, color: new THREE.Color(color), roughness, metalness, ...extra });
    this.m[key] = mat;
    return mat;
  }

  get(key) {
    const m = this.m[key];
    if (!m) { console.warn(`[furnish] unknown material "${key}", using grey`); return this.m.grey || (this.m.grey = this.plain('grey', '#888888')); }
    return m;
  }

  async init() {
    const P = [];
    // --- matte anthracite lacquer (RAL 7016): soft plaster normal breaks up the CG flatness
    P.push(this.textured('anthracite', 'concrete_smooth_light', { tint: '#3a3f44', scale: 1.6, rough: 0.62, normalScale: 0.18 }).then((m) => { m.roughnessMap = null; m.roughness = 0.58; }));
    P.push(this.textured('anthracite_dark', 'concrete_smooth_light', { tint: '#26292c', scale: 1.6, rough: 0.6, normalScale: 0.15 }).then((m) => { m.roughnessMap = null; m.roughness = 0.55; }));
    // --- oak veneer: generated rift-sawn grain (straight, fine), tiles every 1.2 m along the grain
    const oak = makeGrainTexture({ seed: 7, base: [196, 150, 104], dark: [150, 104, 64], light: [214, 172, 126] });
    this.m.oak = new THREE.MeshStandardMaterial({ name: 'P07_oak', map: oak.map, roughnessMap: oak.rough, roughness: 1 });
    this.m.oak_dark = new THREE.MeshStandardMaterial({ name: 'P07_oak_dark', map: oak.map, roughnessMap: oak.rough, roughness: 1, color: new THREE.Color('#6b4a33') });
    this.m.walnut = new THREE.MeshStandardMaterial({ name: 'P07_walnut', map: oak.map, roughnessMap: oak.rough, roughness: 1, color: new THREE.Color('#8a6448') });
    this.m.teak = new THREE.MeshStandardMaterial({ name: 'P07_teak', map: oak.map, roughnessMap: oak.rough, roughness: 1, color: new THREE.Color('#a8825e') });
    // --- whites / lacquers
    this.plain('white_lacquer', '#eceae6', 0.38);
    this.plain('white_matte', '#e9e7e2', 0.8);
    this.plain('greige', '#b9b1a5', 0.75);
    // --- metals
    P.push(this.textured('black_metal', 'metal_brushed_black', { tint: '#5a5a5a', scale: 0.4, metalness: 0.85, rough: 1, normalScale: 0.4 }));
    P.push(this.textured('steel', 'metal_brushed', { scale: 0.35, metalness: 1, rough: 1, normalScale: 0.4 }));
    this.plain('chrome', '#dcdcdc', 0.08, 1);
    this.plain('brass', '#b8914f', 0.3, 1);
    this.plain('black_matte', '#161616', 0.55);
    this.plain('black_plastic', '#121212', 0.4);
    this.plain('rubber', '#0d0d0d', 0.85);
    // --- worktops / stone
    P.push(this.textured('quartz', 'marble_white', { tint: '#e4e2dd', scale: 1.5, rough: 0.6, normalScale: 0.2 }).then((m) => { m.roughnessMap = null; m.roughness = 0.28; }));
    P.push(this.textured('marble', 'marble_white', { scale: 1.2, rough: 1, normalScale: 0.3 }));
    P.push(this.textured('concrete', 'concrete_smooth_light', { tint: '#9d9a95', scale: 1.1, rough: 1, normalScale: 0.5 }));
    // --- glass / screens / mirror
    this.plain('glass_black', '#050607', 0.08, 0, { envMapIntensity: 1.2 });
    this.plain('screen', '#030405', 0.12, 0, { envMapIntensity: 1.0 });
    this.plain('mirror', '#c9cdd0', 0.02, 1, { envMapIntensity: 1.0 });
    this.m.glass = new THREE.MeshPhysicalMaterial({ name: 'P07_glass', color: 0xf4f8f6, roughness: 0.05, metalness: 0, transmission: 0.92, thickness: 0.008, ior: 1.5, transparent: true, opacity: 0.35, depthWrite: false });
    this.m.glass_frosted = new THREE.MeshStandardMaterial({ name: 'P07_glass_frosted', color: 0xf2f4f3, roughness: 0.35, transparent: true, opacity: 0.55, depthWrite: false });
    // --- fabrics
    P.push(this.textured('fabric_grey', 'fabric_linen_natural', { tint: '#b3aea6', scale: 0.35, rough: 1, normalScale: 0.8 }));
    P.push(this.textured('fabric_dark', 'fabric_linen_natural', { tint: '#6e6a65', scale: 0.35, rough: 1, normalScale: 0.8 }));
    P.push(this.textured('fabric_outdoor', 'fabric_woven_light', { tint: '#e6e2da', scale: 0.4, rough: 1, normalScale: 0.6 }));
    P.push(this.textured('fabric_bed', 'fabric_linen_natural', { tint: '#f1eee8', scale: 0.3, rough: 1, normalScale: 0.7 }));
    P.push(this.textured('fabric_natural', 'fabric_linen_natural', { scale: 0.3, rough: 1, normalScale: 0.8 }));
    P.push(this.textured('fabric_rust', 'fabric_linen_natural', { tint: '#b86a45', scale: 0.3, rough: 1, normalScale: 0.8 }));
    P.push(this.textured('fabric_sage', 'fabric_linen_natural', { tint: '#8c9a80', scale: 0.3, rough: 1, normalScale: 0.8 }));
    P.push(this.textured('fabric_navy', 'fabric_linen_natural', { tint: '#4a5668', scale: 0.3, rough: 1, normalScale: 0.8 }));
    P.push(this.textured('fabric_ochre', 'fabric_linen_natural', { tint: '#c79a4a', scale: 0.3, rough: 1, normalScale: 0.8 }));
    P.push(this.textured('fabric_light', 'fabric_woven_light', { scale: 0.4, rough: 1, normalScale: 0.7 }));
    P.push(this.textured('felt_dark', 'fabric_linen_grey', { tint: '#2a2a2a', scale: 0.5, rough: 1, normalScale: 0.6 }));
    P.push(this.textured('leather_cognac', 'leather_dark', { tint: '#e0a070', scale: 0.5, rough: 1 }));
    P.push(this.textured('rug_wool', 'rug_wool_beige', { scale: 1.2, rough: 1 }));
    P.push(this.textured('rug_grey', 'rug_grey', { scale: 0.6, rough: 1 }));
    // --- ceramics / misc
    this.plain('ceramic_white', '#f3f2ee', 0.15);
    this.plain('ceramic_black', '#1d1d1d', 0.3);
    this.plain('terracotta', '#b0654a', 0.8);
    this.plain('paper', '#efe9dc', 0.9);
    this.plain('pages', '#ece4d2', 0.95);
    this.plain('book_cover', '#ffffff', 0.7);          // tinted per instance (instanceColor)
    this.plain('soil', '#3b2c22', 1.0);
    this.plain('leaf', '#4f6b3a', 0.6, 0, { side: THREE.DoubleSide });
    this.plain('cloth', '#ffffff', 0.9);                // tinted per instance
    this.plain('plastic_white', '#eeeeee', 0.35);
    this.plain('led', '#fff4e0', 0.4, 0, { emissive: new THREE.Color('#ffd9a8'), emissiveIntensity: 0.0 }).userData.night = 2.5;
    this.m.flame = new THREE.MeshBasicMaterial({ name: 'P07_flame', color: new THREE.Color(2.2, 1.0, 0.35), transparent: true, opacity: 0.85, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
    await Promise.all(P);
    // Tiny helpers for art canvases (generated per call).
    return this;
  }

  // Abstract art canvas (CanvasTexture) — muted modern palettes, deterministic by seed.
  artMaterial(seed, style = 'shapes', aspect = 0.75) {
    const key = `art_${style}_${seed}_${aspect}`;
    if (this.m[key]) return this.m[key];
    const W = 512, H = Math.round(512 / aspect);
    const c = document.createElement('canvas'); c.width = W; c.height = H;
    const g = c.getContext('2d');
    const R = rng(seed * 7919 + 13);
    const palettes = [
      ['#e9e2d5', '#c7683f', '#2f3a40', '#d9b98b', '#8a9a86'],
      ['#efe9df', '#1f2a33', '#b9a58a', '#7b8c93', '#d8cbb5'],
      ['#f1ece4', '#9c4a2f', '#e0b36a', '#3d4a3f', '#c9bba5'],
      ['#e6e3dc', '#26303a', '#a7b3ad', '#c4a47c', '#6f5143'],
    ];
    const pal = palettes[Math.floor(R() * palettes.length)];
    g.fillStyle = pal[0]; g.fillRect(0, 0, W, H);
    if (style === 'shapes') {
      for (let i = 0; i < 5; i++) {
        g.fillStyle = pal[1 + Math.floor(R() * 4)];
        g.globalAlpha = 0.85 + R() * 0.15;
        const x = R() * W, y = R() * H, r = (0.12 + R() * 0.28) * W;
        g.beginPath();
        if (R() < 0.5) g.arc(x, y, r, 0, Math.PI * 2);
        else if (R() < 0.5) g.rect(x - r, y - r * 0.5, r * 1.6, r);
        else { g.arc(x, y, r, Math.PI, 0); g.closePath(); }
        g.fill();
      }
    } else if (style === 'lines') {
      g.strokeStyle = pal[2]; g.lineWidth = 3;
      for (let i = 0; i < 9; i++) {
        g.beginPath();
        const y0 = H * (0.2 + 0.6 * R());
        g.moveTo(0, y0);
        for (let x = 0; x <= W; x += 16) g.lineTo(x, y0 + Math.sin(x * 0.012 + i) * 30 * R());
        g.stroke();
      }
      g.fillStyle = pal[1]; g.beginPath(); g.arc(W * (0.3 + 0.4 * R()), H * 0.35, W * 0.12, 0, Math.PI * 2); g.fill();
    } else if (style === 'landscape') {
      const grd = g.createLinearGradient(0, 0, 0, H);
      grd.addColorStop(0, '#d9dcd8'); grd.addColorStop(0.55, '#c9c5b9'); grd.addColorStop(1, '#9aa196');
      g.fillStyle = grd; g.fillRect(0, 0, W, H);
      for (let k = 0; k < 3; k++) {
        g.fillStyle = ['#8c968f', '#6d7a74', '#4d5a55'][k];
        g.beginPath(); g.moveTo(0, H);
        const base = H * (0.5 + k * 0.12);
        for (let x = 0; x <= W; x += 8) g.lineTo(x, base - Math.abs(Math.sin(x * 0.006 * (k + 1) + R() * 0.2 + k)) * H * 0.16);
        g.lineTo(W, H); g.fill();
      }
      g.fillStyle = '#e8d8b8'; g.beginPath(); g.arc(W * 0.7, H * 0.28, W * 0.07, 0, Math.PI * 2); g.fill();
    } else if (style === 'photo_bw') {
      const grd = g.createLinearGradient(0, 0, W, H);
      grd.addColorStop(0, '#d0d0ce'); grd.addColorStop(1, '#4a4a4a');
      g.fillStyle = grd; g.fillRect(0, 0, W, H);
      g.fillStyle = '#2a2a2a'; g.fillRect(W * 0.15, H * 0.55, W * 0.7, H * 0.06);
      g.fillStyle = '#eeeeec'; g.beginPath(); g.arc(W * 0.5, H * 0.32, W * 0.16, 0, Math.PI * 2); g.fill();
    }
    // subtle canvas grain
    const img = g.getImageData(0, 0, W, H);
    for (let i = 0; i < img.data.length; i += 4) { const n = (R() - 0.5) * 10; img.data[i] += n; img.data[i + 1] += n; img.data[i + 2] += n; }
    g.putImageData(img, 0, 0);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 4;
    const mat = new THREE.MeshStandardMaterial({ name: `P07_${key}`, map: t, roughness: 0.85 });
    this.m[key] = mat;
    return mat;
  }
}

// Straight-grain wood (rift oak) generated on a canvas: colour map + roughness + bump.
// Grain runs along U. 1024 x 256 px covering 1.2 m x 0.3 m (repeat set by the metric UVs).
function makeGrainTexture({ seed = 1, base, dark, light }) {
  const W = 1024, H = 256;
  const R = rng(seed);
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const g = c.getContext('2d');
  const img = g.createImageData(W, H);
  const rc = document.createElement('canvas'); rc.width = W; rc.height = H;
  const rg = rc.getContext('2d');
  const rimg = rg.createImageData(W, H);
  // 1D line field across V: sum of sines with jitter -> fine parallel lines of varying density
  const lines = new Float32Array(H);
  const phases = Array.from({ length: 6 }, () => R() * 6.28);
  for (let y = 0; y < H; y++) {
    const v = y / H;
    let s = 0;
    s += Math.sin(v * 6.28 * 37 + phases[0] + Math.sin(v * 6.28 * 3 + phases[1]) * 2.0) * 0.5;
    s += Math.sin(v * 6.28 * 91 + phases[2] + Math.sin(v * 6.28 * 5 + phases[3]) * 3.0) * 0.3;
    s += Math.sin(v * 6.28 * 13 + phases[4]) * 0.25;
    lines[y] = s;
  }
  // low-frequency along-grain variation (seamless in U: integer frequencies)
  const uvar = new Float32Array(W);
  const up = [R() * 6.28, R() * 6.28];
  for (let x = 0; x < W; x++) { const u = x / W; uvar[x] = Math.sin(u * 6.28 * 2 + up[0]) * 0.5 + Math.sin(u * 6.28 * 5 + up[1]) * 0.3; }
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const u = x / W;
      // slight waviness of lines along U
      const yy = (y + Math.round(Math.sin(u * 6.28 * 3 + y * 0.05) * 2) + H) % H;
      let t = lines[yy] * 0.6 + uvar[x] * 0.15 + (R() - 0.5) * 0.12;
      t = Math.max(-1, Math.min(1, t));
      const k = t * 0.5 + 0.5;               // 0 dark .. 1 light
      const col = k < 0.5 ? mix(dark, base, k * 2) : mix(base, light, (k - 0.5) * 2);
      const i = (y * W + x) * 4;
      img.data[i] = col[0]; img.data[i + 1] = col[1]; img.data[i + 2] = col[2]; img.data[i + 3] = 255;
      const r = 150 + (1 - k) * 60 + (R() - 0.5) * 12;   // pores (dark lines) rougher
      rimg.data[i] = rimg.data[i + 1] = rimg.data[i + 2] = r; rimg.data[i + 3] = 255;
    }
  }
  g.putImageData(img, 0, 0);
  rg.putImageData(rimg, 0, 0);
  const map = new THREE.CanvasTexture(c);
  map.colorSpace = THREE.SRGBColorSpace;
  const rough = new THREE.CanvasTexture(rc);
  rough.colorSpace = THREE.NoColorSpace;
  for (const t of [map, rough]) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(1 / 1.2, 1 / 0.3); t.anisotropy = 8; }
  const bump = rough.clone();
  return { map, rough, bump };
}

function mix(a, b, t) { return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]; }
