import * as THREE from 'three';

// P06 — texture library + world-space surface shader kit (shared by interior.js and exterior.js).
//
//  TextureLibrary.tex(name, opts) -> Promise<{ map, normalMap, roughnessMap, aoMap, scale_m }>
//    Loads public/assets/textures/<name>/{color,normal,roughness,ao}.jpg (paths from manifest.json).
//    colour = sRGB, data maps = NoColorSpace; RepeatWrapping; anisotropy of the current quality tier.
//    Every returned texture is a clone sharing ONE GPU upload per file (three.js shares by Source).
//    opts: repeat  multiplier on 1/scale_m (number or [x,y]; 1 = real-world scale on the 1 m box UVs)
//          scale   metres per repeat (absolute; overrides manifest scale_m)
//          rotation (radians), offset [x,y], maps: subset of ['color','normal','roughness','ao'],
//          maxSize: px cap (number, or per map {color:2048, normal:1024}) — downscaled once, shared.
//    aoMap uses channel 0 (it tiles with the colour map); uv1 is reserved for baked AO / lightmaps.
//  TextureLibrary.base(name, map) -> Promise<THREE.Texture> (the raw shared texture, repeat 1).
//
//  applySurface(material, cfg) — world-space procedural surfaces (see bottom of this file).

const MAP_FILES = ['color', 'normal', 'roughness', 'ao'];
const MAP_PROPS = { color: 'map', normal: 'normalMap', roughness: 'roughnessMap', ao: 'aoMap' };

export class TextureLibrary {
  constructor(game) {
    this.game = game;
    this.loader = game.loader;
    this.manifest = null;
    this._bases = new Map();   // url -> Promise<Texture>
    this.textures = new Set(); // every texture handed out (for anisotropy updates / stats)
  }

  async init() {
    if (!this.manifest) {
      const m = await this.loader.json('/assets/manifest.json', 'texture manifest');
      this.manifest = m.textures || {};
    }
    return this;
  }

  get anisotropy() {
    const r = this.game.renderer;
    return r?.settings?.anisotropy || r?._settings?.anisotropy || 8;
  }

  info(name) {
    const t = this.manifest?.[name];
    if (!t) throw new Error(`[materials] texture set "${name}" not in manifest.json`);
    return t;
  }

  // maxSize: downscale larger images once at load (GPU budget); cached per (url, size).
  base(name, map = 'color', maxSize = 0) {
    const t = this.info(name);
    const rel = t.maps?.[map];
    if (!rel) return Promise.resolve(null);
    const url = '/assets/' + rel.replace(/^\/?(assets\/)?/, '');
    if (maxSize) {
      const key = `${url}@${maxSize}`;
      if (!this._bases.has(key)) {
        this._bases.set(key, this.base(name, map).then((src) => {
          const img = src.image;
          if (!img || img.width <= maxSize) return src;
          const k = maxSize / Math.max(img.width, img.height);
          const cv = document.createElement('canvas');
          cv.width = Math.round(img.width * k); cv.height = Math.round(img.height * k);
          const ctx = cv.getContext('2d');
          ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
          ctx.drawImage(img, 0, 0, cv.width, cv.height);
          const tex = new THREE.Texture(cv);
          tex.colorSpace = src.colorSpace;
          tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
          tex.anisotropy = this.anisotropy;
          tex.name = `${name}/${map}@${maxSize}`;
          tex.needsUpdate = true;
          return tex;
        }));
      }
      return this._bases.get(key);
    }
    if (!this._bases.has(url)) {
      const colorSpace = map === 'color' ? THREE.SRGBColorSpace : THREE.NoColorSpace;
      const job = this.loader.loadTexture(url, { colorSpace, anisotropy: this.anisotropy }).then((tex) => {
        tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
        tex.anisotropy = this.anisotropy;
        tex.name = `${name}/${map}`;
        return tex;
      });
      this._bases.set(url, job);
    }
    return this._bases.get(url);
  }

  async tex(name, opts = {}) {
    await this.init();
    const t = this.info(name);
    const scale = opts.scale || t.scale_m || 1;
    const mul = opts.repeat ?? 1;
    const rep = Array.isArray(mul) ? [mul[0] / scale, mul[1] / scale] : [mul / scale, mul / scale];
    const wanted = opts.maps || MAP_FILES;
    const out = { map: null, normalMap: null, roughnessMap: null, aoMap: null };
    // non-enumerable so `{ ...await tex(...) }` can be spread straight into material parameters
    Object.defineProperty(out, 'scale_m', { value: scale, enumerable: false });
    const maxOf = (m) => (typeof opts.maxSize === 'object' ? opts.maxSize?.[m] : opts.maxSize) || 0;
    await Promise.all(wanted.map(async (m) => {
      const b = await this.base(name, m, maxOf(m));
      if (!b) return;
      const c = b.clone();            // shares b.source -> no extra GPU memory
      c.repeat.set(rep[0], rep[1]);
      if (opts.offset) c.offset.set(opts.offset[0], opts.offset[1]);
      if (opts.rotation) { c.rotation = opts.rotation; c.center.set(0.5, 0.5); }
      c.channel = 0;
      c.anisotropy = this.anisotropy;
      c.needsUpdate = true;
      this.textures.add(c);
      out[MAP_PROPS[m]] = c;
    }));
    return out;
  }

  setAnisotropy(level) {
    for (const t of this.textures) if (t.anisotropy !== level) { t.anisotropy = level; t.needsUpdate = true; }
  }

  // Approximate GPU memory of the unique images handed out (RGBA8 + mip chain).
  stats() {
    const seen = new Set(); let bytes = 0;
    for (const t of this.textures) {
      const img = t.source?.data; if (!img || seen.has(t.source)) continue;
      seen.add(t.source);
      bytes += (img.width || 0) * (img.height || 0) * 4 * 4 / 3;
    }
    return { images: seen.size, textures: this.textures.size, gpuMB: Math.round(bytes / 1048576) };
  }
}

// ---------------------------------------------------------------------------------------------
// World-space surface shader kit.
//
// The house GLB uses 1 m box UVs; for floors/walls we instead map in WORLD space (static meshes),
// which gives exact real-world scale, continuity across rooms (no seams at thresholds) and lets
// the shader lay out planks / tiles procedurally:
//   mode 'plank' — boards of `board` metres across, sampled from a random board column of a plank
//                  texture (texBoards columns, texLen metres along the grain), random 180° flips,
//                  random offsets along the grain -> no 2D repetition anywhere in the house.
//   mode 'grid'  — tiles of `tile` [u,v] metres, `grout` joint width, `stagger` row offset; each
//                  tile samples the texture at a random offset ('offset') or picks a random cell of
//                  a tile-grid texture ('cells', `cells` per side, optional 90° rotations), per-tile
//                  tint/roughness jitter, grout colour/roughness, bevelled tile edges, box-filtered
//                  (anti-aliased) grout lines that fade to their average far away (no moiré).
//   mode 'paint' — flat paint colour with a subtle plaster normal + low-frequency variation.
//   zones        — (grid only) world boxes where the grid applies; everywhere else is 'paint'.
// Planes: horizontal faces use (x, z); walls use (horizontal, y - floorY). Tile rows start at the
// floor; horizontal origin = cfg.origin [x0, z0].
// ---------------------------------------------------------------------------------------------

const GLSL_PARS = /* glsl */`
varying vec3 vSfW;
varying vec3 vSfN;
uniform sampler2D sfColorMap;
uniform sampler2D sfNormalMap;
uniform sampler2D sfRoughMap;
uniform sampler2D sfPlasterMap;
uniform vec2 sfTile;        // tile size (u,v) metres | plank: (board width, -)
uniform float sfGrout;      // joint width metres
uniform float sfStagger;    // row offset as a fraction of tile u
uniform vec2 sfOrigin;      // grid origin (x0, z0)
uniform float sfFloorY;     // wall rows start here
uniform float sfTexLen;     // metres per texture repeat (offset mode / plank along-grain length)
uniform float sfCells;      // cells per side (cells mode) | plank: board columns in the texture
uniform float sfTexOffset;  // plank: first groove position in board-column units
uniform float sfInset;      // cells / plank: fraction of the cell/column trimmed on each side
uniform float sfNormalK;    // texture normal strength
uniform vec3 sfTint;
uniform float sfSat;
uniform float sfContrast;
uniform float sfTexMean;    // linear luminance the contrast pivots on
uniform float sfTintVar;    // per tile/board brightness jitter (+-)
uniform vec2 sfRoughRange;  // texture roughness 0..1 remapped to [min,max]
uniform float sfRoughLumK;  // darker texels -> rougher (grain pores)
uniform float sfRoughVar;   // per tile roughness jitter
uniform vec3 sfGroutColor;
uniform float sfGroutRough;
uniform float sfBevel;      // tile edge round-over width metres
uniform float sfGridVertical; // 0 = grid only on horizontal faces (vertical faces get plain texture)
uniform vec3 sfGrainAxis;   // plank: world grain direction (unit, horizontal)
uniform float sfSeedRise;   // plank: extra seed = floor(y / rise + 0.5) (stair treads / levels)
uniform vec3 sfPaintColor;
uniform float sfPaintRough;
uniform float sfPaintNormalK;
uniform float sfPaintScale;
uniform vec3 sfMacro;       // (albedo amount, scale m, roughness amount)
uniform float sfCoat;       // clearcoat on tile faces (0 on grout)
uniform float sfAO;         // grout cavity occlusion strength
uniform vec3 sfGrime;       // paint: (amount, floor level 1 y, floor level 2 y) base-of-wall grime
#if SF_ZONES > 0
uniform vec3 sfZoneMin[SF_ZONES];
uniform vec3 sfZoneMax[SF_ZONES];
#endif

struct SfOut { vec3 albedo; float rough; vec3 nW; float coat; float ao; };

float sfHash(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
vec2 sfHash2(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * vec3(0.1031, 0.1030, 0.0973)); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.xx + p3.yz) * p3.zy); }
float sfNoise(vec2 p) { vec2 i = floor(p), f = fract(p); vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(sfHash(i), sfHash(i + vec2(1.0, 0.0)), u.x), mix(sfHash(i + vec2(0.0, 1.0)), sfHash(i + vec2(1.0, 1.0)), u.x), u.y); }
float sfFbm(vec2 p) { return 0.55 * sfNoise(p) + 0.3 * sfNoise(p * 2.13 + 7.1) + 0.15 * sfNoise(p * 4.37 + 3.3); }

vec3 sfGrade(vec3 c) {
  float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
  c = mix(vec3(l), c, sfSat);
  c = max(vec3(0.0), mix(vec3(sfTexMean), c, sfContrast));
  return c * sfTint;
}
// box-filtered coverage of a joint of half-width hg centred at distance 0, pixel footprint ps at distance d
float sfLine(float d, float hg, float ps) {
  return clamp((min(d + 0.5 * ps, hg) - max(d - 0.5 * ps, -hg)) / ps, 0.0, 1.0);
}

SfOut sfEval() {
  SfOut o;
  vec3 W = vSfW;
  vec3 Ng = normalize(vSfN);
  vec3 an = abs(Ng);
  float isY = step(max(an.x, an.z), an.y);
  float isX = (1.0 - isY) * step(an.z, an.x);
  float isZ = (1.0 - isY) * (1.0 - isX);
  // plane coordinates, origin-relative: floors (x-x0, z-z0); x-facing walls (z-z0, y-floorY); z-facing walls (x-x0, y-floorY)
  vec2 P = isY * (W.xz - sfOrigin) + isX * vec2(W.z - sfOrigin.y, W.y - sfFloorY) + isZ * vec2(W.x - sfOrigin.x, W.y - sfFloorY);
  vec3 Tu = isY * vec3(1.0, 0.0, 0.0) + isX * vec3(0.0, 0.0, 1.0) + isZ * vec3(1.0, 0.0, 0.0);
  vec3 Tv = isY * vec3(0.0, 0.0, 1.0) + (1.0 - isY) * vec3(0.0, 1.0, 0.0);
  vec3 N = isY * vec3(0.0, sign(Ng.y), 0.0) + isX * vec3(sign(Ng.x), 0.0, 0.0) + isZ * vec3(0.0, 0.0, sign(Ng.z));
  vec2 dPx = dFdx(P), dPy = dFdy(P);
  // quads straddling a plane change get huge derivatives: clamp to a sane footprint
  dPx *= min(1.0, 0.2 / max(length(dPx), 1e-6));
  dPy *= min(1.0, 0.2 / max(length(dPy), 1e-6));
  float ps = max(max(length(vec2(dPx.x, dPy.x)), length(vec2(dPx.y, dPy.y))), 1e-5);
  float macro = sfFbm(P / sfMacro.y) - 0.5;

  o.albedo = sfPaintColor; o.rough = sfPaintRough; o.nW = N; o.coat = 0.0; o.ao = 1.0;
  bool inGrid = true;
#if SF_ZONES > 0
  inGrid = false;
  for (int i = 0; i < SF_ZONES; i++) {
    if (all(greaterThanEqual(W, sfZoneMin[i])) && all(lessThanEqual(W, sfZoneMax[i]))) inGrid = true;
  }
#endif
#if defined(SF_PAINT)
  inGrid = false;
#endif

#if defined(SF_PLANK)
  {
    // along = grain axis; across = other horizontal axis on floors, height on vertical faces
    vec3 G = sfGrainAxis;
    vec3 C = isY * normalize(cross(vec3(0.0, 1.0, 0.0), G)) + (1.0 - isY) * vec3(0.0, 1.0, 0.0);
    C *= sign(dot(C, vec3(1.0, 1.0, 1.0)) + 1e-4);
    float along = dot(W, G);
    float across = dot(W, C) - dot(vec3(sfOrigin.x, 0.0, sfOrigin.y), C);
    vec2 dAx = vec2(dot(dFdx(W), C), dot(dFdx(W), G));
    vec2 dAy = vec2(dot(dFdy(W), C), dot(dFdy(W), G));
    float ac = across / sfTile.x;
    float col = floor(ac);
    float fu = ac - col;
    float seed2 = sfSeedRise > 0.0 ? floor(W.y / sfSeedRise + 0.5) : 0.0;
    vec2 r = sfHash2(vec2(col * 1.37 + 0.5, seed2 * 7.13 + 3.1));
    float r3 = sfHash(vec2(col + 17.0, seed2 - 5.0));
    float tcol = floor(r.x * sfCells);
    float flip = step(0.5, r.y);
    float fuu = mix(fu, 1.0 - fu, flip);
    float span = 1.0 - 2.0 * sfInset;
    vec2 uv = vec2((sfTexOffset + tcol + sfInset + fuu * span) / sfCells,
                   mix(along, -along, flip) / sfTexLen + r3 * 17.0);
    float su = span / (sfTile.x * sfCells), sv = 1.0 / sfTexLen;
    vec2 gx = vec2(dAx.x * su, dAx.y * sv), gy = vec2(dAy.x * su, dAy.y * sv);
    vec3 c = textureGrad(sfColorMap, uv, gx, gy).rgb;
    float lum = dot(c, vec3(0.2126, 0.7152, 0.0722));
    o.albedo = sfGrade(c) * (1.0 + (r3 - 0.5) * sfTintVar) * (1.0 + macro * sfMacro.x);
    float tr = textureGrad(sfRoughMap, uv, gx, gy).g;
    o.rough = mix(sfRoughRange.x, sfRoughRange.y, tr) + (sfTexMean - lum) * sfRoughLumK
            + (sfHash(vec2(col, seed2 + 9.0)) - 0.5) * sfRoughVar + macro * sfMacro.z;
    vec3 n = textureGrad(sfNormalMap, uv, gx, gy).xyz * 2.0 - 1.0;
    n.xy *= sfNormalK * (1.0 - 2.0 * flip);
    o.nW = normalize(C * n.x + G * n.y + N * max(n.z, 0.2));
    inGrid = false;
  }
#endif

  if (inGrid) {
#if defined(SF_GRID)
    vec2 q = P;
    float row = floor(q.y / sfTile.y) * mix(isY, 1.0, sfGridVertical);
    q.x += row * sfStagger * sfTile.x;
    // sfGridVertical = 0: vertical faces get one continuous, joint-free cell
    vec2 cell = floor(q / sfTile) * mix(isY, 1.0, sfGridVertical);
    vec2 f = q - cell * sfTile;
    vec2 e = min(f, sfTile - f);
    float hg = 0.5 * sfGrout * mix(sfGridVertical, 1.0, isY);
    float gx = sfLine(e.x, hg, max(length(vec2(dPx.x, dPy.x)), 1e-5));
    float gy = sfLine(e.y, hg, max(length(vec2(dPx.y, dPy.y)), 1e-5));
    float grout = max(gx, gy);
    float avgG = 1.0 - (1.0 - 2.0 * hg / sfTile.x) * (1.0 - 2.0 * hg / sfTile.y);
    grout = mix(grout, avgG, smoothstep(0.06, 0.3, ps / min(sfTile.x, sfTile.y)));
    vec2 h = sfHash2(cell + vec2(3.7, 11.3));
    float h3 = sfHash(cell * 1.31 + 5.7);
    vec2 uv; vec2 g1, g2; vec2 nrot = vec2(1.0, 0.0);   // (cos, sin) applied to texture normals
  #if defined(SF_CELLS)
      vec2 lf = f / sfTile;
    #if defined(SF_ROT90)
      float k = floor(h3 * 4.0);
      vec2 cs = k < 1.0 ? vec2(1.0, 0.0) : (k < 2.0 ? vec2(0.0, 1.0) : (k < 3.0 ? vec2(-1.0, 0.0) : vec2(0.0, -1.0)));
    #else
      vec2 cs = h3 < 0.5 ? vec2(1.0, 0.0) : vec2(-1.0, 0.0);
    #endif
      vec2 cl = lf - 0.5;
      lf = vec2(cs.x * cl.x - cs.y * cl.y, cs.y * cl.x + cs.x * cl.y) + 0.5;
      nrot = cs;
      float span = 1.0 - 2.0 * sfInset;
      uv = (floor(h * sfCells) + sfInset + lf * span) / sfCells;
      vec2 sc = span / (sfTile * sfCells);
      g1 = dPx * sc; g2 = dPy * sc;
      g1 = vec2(cs.x * g1.x - cs.y * g1.y, cs.y * g1.x + cs.x * g1.y);
      g2 = vec2(cs.x * g2.x - cs.y * g2.y, cs.y * g2.x + cs.x * g2.y);
  #else
      float fl = step(0.5, h3);
      vec2 ff = mix(f, sfTile - f, fl);
      nrot = vec2(1.0 - 2.0 * fl, 0.0);
      uv = ff / sfTexLen + h * 7.31;
      g1 = dPx / sfTexLen; g2 = dPy / sfTexLen;
  #endif
  #if defined(SF_FLAT)
      o.albedo = sfTint;
      float tr = 0.5;
      vec3 n = vec3(0.0, 0.0, 1.0);
    #if defined(SF_GLAZE_NORMAL)
      // glazed tiles: faint low-frequency waviness from the plaster normal
      n = textureGrad(sfPlasterMap, uv * 0.5 + h, g1 * 0.5, g2 * 0.5).xyz * 2.0 - 1.0;
      n.xy *= sfNormalK;
    #endif
  #else
      vec3 c = textureGrad(sfColorMap, uv, g1, g2).rgb;
      o.albedo = sfGrade(c);
      float tr = textureGrad(sfRoughMap, uv, g1, g2).g;
      vec3 n = textureGrad(sfNormalMap, uv, g1, g2).xyz * 2.0 - 1.0;
      n.xy *= sfNormalK;
  #endif
    n.xy = vec2(nrot.x * n.x + nrot.y * n.y, -nrot.y * n.x + nrot.x * n.y);
    float lum = dot(o.albedo, vec3(0.2126, 0.7152, 0.0722));
    o.albedo *= (1.0 + (h.x - 0.5) * sfTintVar) * (1.0 + macro * sfMacro.x);
    o.rough = mix(sfRoughRange.x, sfRoughRange.y, tr) + (h.y - 0.5) * sfRoughVar + macro * sfMacro.z;
    // bevelled tile edges: tilt the normal toward the nearest joint
    vec2 toE = vec2(f.x < 0.5 * sfTile.x ? -1.0 : 1.0, f.y < 0.5 * sfTile.y ? -1.0 : 1.0);
    float bf = (1.0 - smoothstep(sfBevel * 0.6, sfBevel * 2.5, ps)) * step(1e-5, hg);
    vec2 tilt = vec2(toE.x * (1.0 - smoothstep(hg, hg + sfBevel, e.x)), toE.y * (1.0 - smoothstep(hg, hg + sfBevel, e.y))) * 0.7 * bf;
    vec3 nT = normalize(Tu * (n.x + tilt.x) + Tv * (n.y + tilt.y) + N * max(n.z, 0.2));
    o.nW = normalize(mix(nT, N, grout));
    o.albedo = mix(o.albedo, sfGroutColor * (1.0 + macro * sfMacro.x), grout);
    o.rough = mix(o.rough, sfGroutRough, grout);
    o.coat = sfCoat * (1.0 - grout);
    o.ao = 1.0 - sfAO * grout;
#endif
  } else {
#if !defined(SF_PLANK)
    // paint: plaster normal + very low-frequency variation
    vec2 pp = P / sfPaintScale;
    vec3 n = textureGrad(sfPlasterMap, pp, dPx / sfPaintScale, dPy / sfPaintScale).xyz * 2.0 - 1.0;
    n.xy *= sfPaintNormalK;
    o.nW = normalize(Tu * n.x + Tv * n.y + N * max(n.z, 0.2));
    // roller/trowel tone + gloss breakup (mid/fine noise, slope of the plaster normal)
    float mid = sfFbm(P / 0.45) - 0.5, fine = sfFbm(P / 0.06) - 0.5;
    float slope = clamp(length(n.xy) * 3.0, 0.0, 1.0);
    o.albedo = sfPaintColor * (1.0 + macro * sfMacro.x + mid * 0.035 + fine * 0.015 - slope * 0.02);
    o.rough = sfPaintRough + macro * sfMacro.z + mid * 0.06 + fine * 0.05 - slope * 0.06;
    // grime / scuffs just above the floor on walls (both storeys)
    if (isY < 0.5 && sfGrime.x > 0.0) {
      float hy = W.y - sfGrime.y; if (W.y >= sfGrime.z - 0.05) hy = W.y - sfGrime.z;
      float g = (1.0 - smoothstep(0.06, 0.45, hy)) * step(-0.05, hy);
      g *= 0.5 + 0.9 * sfFbm(vec2((isX * W.z + isZ * W.x) * 3.0, W.y * 14.0));
      o.albedo *= 1.0 - sfGrime.x * clamp(g, 0.0, 1.0) * vec3(1.0, 1.05, 1.15);
      o.rough += 0.04 * g;
      o.ao *= 1.0 - 0.25 * (1.0 - smoothstep(0.0, 0.3, hy)) * step(-0.05, hy);
    }
#endif
  }
  o.rough = clamp(o.rough, 0.04, 1.0);
  return o;
}
`;

const DEFAULTS = {
  tile: [0.6, 0.6], grout: 0.002, stagger: 0, origin: [0, 0], floorY: 0,
  texLen: 1, cells: 1, texOffset: 0, inset: 0, normalK: 1,
  tint: [1, 1, 1], sat: 1, contrast: 1, texMean: 0.5, tintVar: 0,
  roughRange: [0.5, 0.5], roughLumK: 0, roughVar: 0,
  groutColor: [0.5, 0.5, 0.5], groutRough: 0.85, bevel: 0.0015, gridVertical: 1,
  grainAxis: [1, 0, 0], seedRise: 0,
  paintColor: [0.85, 0.84, 0.82], paintRough: 0.9, paintNormalK: 0.2, paintScale: 1.2,
  macro: [0.03, 3.0, 0.03], coat: 0, ao: 0.5, grime: [0.1, 0.0, 3.15],
};

let _dummy = null;
function dummyTexture() {
  if (!_dummy) {
    _dummy = new THREE.DataTexture(new Uint8Array([128, 128, 255, 255]), 1, 1);
    _dummy.needsUpdate = true;
  }
  return _dummy;
}

const toVec = (a) => (a.length === 2 ? new THREE.Vector2(a[0], a[1]) : new THREE.Vector3(a[0], a[1], a[2]));
const colorVec = (c) => {
  if (Array.isArray(c)) return new THREE.Vector3(c[0], c[1], c[2]);
  const col = new THREE.Color(c);            // hex / css -> linear working space
  return new THREE.Vector3(col.r, col.g, col.b);
};

/**
 * Turns a MeshStandardMaterial / MeshPhysicalMaterial into a world-space procedural surface.
 * cfg: { mode: 'plank'|'grid'|'paint', sample: 'offset'|'cells'|'flat', rot90, glazeNormal,
 *        maps: {color, normal, roughness, plaster} (THREE.Texture, raw repeat-1 textures),
 *        zones: [[minXYZ],[maxXYZ]][], and any key of DEFAULTS }
 * Colours (tint, groutColor, paintColor) accept hex numbers/strings (sRGB) or linear [r,g,b].
 * Returns the material; its live uniforms are in material.userData.surface.uniforms.
 */
export function applySurface(material, cfg) {
  const c = { ...DEFAULTS, ...cfg };
  const u = {};
  const set = (k, v) => { u[k] = { value: v }; };
  set('sfColorMap', c.maps?.color || dummyTexture());
  set('sfNormalMap', c.maps?.normal || dummyTexture());
  set('sfRoughMap', c.maps?.roughness || dummyTexture());
  set('sfPlasterMap', c.maps?.plaster || dummyTexture());
  set('sfTile', toVec(c.tile)); set('sfGrout', c.grout); set('sfStagger', c.stagger);
  set('sfOrigin', toVec(c.origin)); set('sfFloorY', c.floorY); set('sfTexLen', c.texLen);
  set('sfCells', c.cells); set('sfTexOffset', c.texOffset); set('sfInset', c.inset); set('sfNormalK', c.normalK);
  set('sfTint', colorVec(c.tint)); set('sfSat', c.sat); set('sfContrast', c.contrast); set('sfTexMean', c.texMean);
  set('sfTintVar', c.tintVar); set('sfRoughRange', toVec(c.roughRange)); set('sfRoughLumK', c.roughLumK);
  set('sfRoughVar', c.roughVar); set('sfGroutColor', colorVec(c.groutColor)); set('sfGroutRough', c.groutRough);
  set('sfBevel', c.bevel); set('sfGridVertical', c.gridVertical);
  set('sfGrainAxis', new THREE.Vector3(...c.grainAxis).normalize()); set('sfSeedRise', c.seedRise);
  set('sfPaintColor', colorVec(c.paintColor)); set('sfPaintRough', c.paintRough);
  set('sfPaintNormalK', c.paintNormalK); set('sfPaintScale', c.paintScale);
  set('sfMacro', toVec(c.macro)); set('sfCoat', c.coat); set('sfAO', c.ao); set('sfGrime', toVec(c.grime));
  const zones = c.zones || [];
  if (zones.length) {
    set('sfZoneMin', zones.map((z) => new THREE.Vector3(...z[0])));
    set('sfZoneMax', zones.map((z) => new THREE.Vector3(...z[1])));
  }

  const defines = material.defines || (material.defines = {});
  defines.SF_ZONES = zones.length;
  if (c.mode === 'plank') defines.SF_PLANK = '';
  else if (c.mode === 'grid') defines.SF_GRID = '';
  else defines.SF_PAINT = '';
  if (c.sample === 'cells') defines.SF_CELLS = '';
  if (c.sample === 'flat') defines.SF_FLAT = '';
  if (c.rot90) defines.SF_ROT90 = '';
  if (c.glazeNormal) defines.SF_GLAZE_NORMAL = '';

  material.color?.set(0xffffff);
  material.userData.surface = { cfg: c, uniforms: u };
  material.onBeforeCompile = surfaceOnBeforeCompile;
  material.customProgramCacheKey = surfaceCacheKey;
  material.needsUpdate = true;
  return material;
}

function surfaceCacheKey() { return 'p06-surface-v1'; }

function surfaceOnBeforeCompile(shader) {
  const u = this.userData.surface.uniforms;
  Object.assign(shader.uniforms, u);
  shader.vertexShader = shader.vertexShader
    .replace('#include <common>', '#include <common>\nvarying vec3 vSfW;\nvarying vec3 vSfN;')
    .replace('#include <worldpos_vertex>', `#include <worldpos_vertex>
      vec4 sfWP = vec4( transformed, 1.0 );
      #ifdef USE_INSTANCING
        sfWP = instanceMatrix * sfWP;
      #endif
      sfWP = modelMatrix * sfWP;
      vSfW = sfWP.xyz;
      vSfN = normalize( mat3( modelMatrix ) * objectNormal );`);
  shader.fragmentShader = shader.fragmentShader
    .replace('#include <common>', '#include <common>\n' + GLSL_PARS)
    .replace('#include <map_fragment>', '#include <map_fragment>\n  SfOut sfo = sfEval();\n  diffuseColor.rgb *= sfo.albedo;')
    .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\n  roughnessFactor = sfo.rough;')
    .replace('#include <normal_fragment_maps>', '#include <normal_fragment_maps>\n  normal = normalize( ( viewMatrix * vec4( sfo.nW, 0.0 ) ).xyz );')
    .replace('#include <lights_physical_fragment>', '#include <lights_physical_fragment>\n  #ifdef USE_CLEARCOAT\n  material.clearcoat *= sfo.coat;\n  #endif')
    .replace('#include <aomap_fragment>', '#include <aomap_fragment>\n  reflectedLight.indirectDiffuse *= sfo.ao;');
}

/**
 * Discards fragments inside world boxes (e.g. MDF skirting in fully tiled bathrooms).
 * boxes: [[minXYZ],[maxXYZ]][]
 */
export function applyHideBoxes(material, boxes) {
  if (!boxes?.length) return material;
  const u = {
    sfHideMin: { value: boxes.map((b) => new THREE.Vector3(...b[0])) },
    sfHideMax: { value: boxes.map((b) => new THREE.Vector3(...b[1])) },
  };
  material.defines = { ...(material.defines || {}), SF_HIDE: boxes.length };
  material.userData.hide = u;
  material.onBeforeCompile = function (shader) {
    Object.assign(shader.uniforms, this.userData.hide);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vSfHW;')
      .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\n  vSfHW = ( modelMatrix * vec4( transformed, 1.0 ) ).xyz;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vSfHW;\nuniform vec3 sfHideMin[SF_HIDE];\nuniform vec3 sfHideMax[SF_HIDE];')
      .replace('#include <clipping_planes_fragment>', `#include <clipping_planes_fragment>
        for (int i = 0; i < SF_HIDE; i++) {
          if (all(greaterThanEqual(vSfHW, sfHideMin[i])) && all(lessThanEqual(vSfHW, sfHideMax[i]))) discard;
        }`);
  };
  material.customProgramCacheKey = () => 'p06-hide-v1';
  material.needsUpdate = true;
  return material;
}
