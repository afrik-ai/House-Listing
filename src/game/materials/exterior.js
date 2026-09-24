import * as THREE from 'three';

// P03 — exterior material definitions for the P06 registry (see materials/index.js).
//   definitions[name](tex, ctx) -> THREE.Material, ctx = { game, THREE, name, surface, hide, lib }
// Shell names (P02 house.glb): wall_ext_white, wall_ext_anthracite, concrete_block_ext, wood_slats, frames,
// glass, roof_standing_seam, roof_membrane, concrete_pavers, handrail_black.
// Detail names (P03 exterior_detail.glb + node overrides): EXT_*.
// Time-of-day / inside-outside driven values (lamp lenses, wall washes, glass) live in EXT_STATE and are
// animated by src/game/plugins/20_exterior.js.

export const EXT_STATE = {
  glass: {
    uBase: { value: 0.3 },      // min. reflectance/opacity seen from outside (low-iron glass reads dark-reflective)
    uF0: { value: 0.2 },        // effective F0 (kept in sync with specularColor * 0.04)
    uRefl: { value: 1.0 },      // reflection scale (reduced from inside)
  },
  glassMats: [],                // glass materials (specularColor = reflectance scale, set by the plugin)
  glow: [],                     // emissive lamp lenses
  wash: [],                     // additive wall-wash materials
};
export const FIXTURE_RGB = [1.0, 0.72, 0.45];     // ~2700 K linear, same as engine/Lighting.js

const col = (hex) => new THREE.Color(hex);

// Desaturate + tint in the fragment shader (after the colour map). Also offsets the texture per instance for
// GPU-instanced boards, so no two instanced slats show the same grain.
function woodGrade(mat, { sat = 0.62, tint = [1.55, 1.55, 1.05] } = {}) {
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uWoodSat = { value: sat };
    sh.uniforms.uWoodTint = { value: new THREE.Vector3(...tint) };
    sh.vertexShader = sh.vertexShader.replace('#include <uv_vertex>', `#include <uv_vertex>
      #ifdef USE_INSTANCING
        vec3 ip = instanceMatrix[3].xyz;
        vec2 io = fract(sin(vec2(dot(ip, vec3(12.9898, 78.233, 37.719)), dot(ip, vec3(39.346, 11.135, 83.155)))) * 43758.5453) * 4.0;
        #ifdef USE_MAP
          vMapUv += io;
        #endif
        #ifdef USE_NORMALMAP
          vNormalMapUv += io;
        #endif
        #ifdef USE_ROUGHNESSMAP
          vRoughnessMapUv += io;
        #endif
      #endif`);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform float uWoodSat;\nuniform vec3 uWoodTint;')
      .replace('#include <map_fragment>', `#include <map_fragment>
        float wl = dot(diffuseColor.rgb, vec3(0.2126, 0.7152, 0.0722));
        diffuseColor.rgb = mix(vec3(wl), diffuseColor.rgb, uWoodSat) * uWoodTint;`);
  };
  mat.customProgramCacheKey = () => 'p03-wood-v1';
  return mat;
}

// Larch: warm honey. The texture is vertical cedar planks (grain along v); stretched 4x across the grain so
// plank seams rarely land on a 40-60 mm slat. `horizontal` rotates the grain onto u (boards running along u).
async function larch(tex, name, horizontal) {
  const t = await tex('larch_boards', horizontal ? { repeat: [1, 0.25], rotation: Math.PI / 2, maps: ['color', 'normal', 'roughness'] }
    : { repeat: [0.25, 1], maps: ['color', 'normal', 'roughness'] });
  const m = new THREE.MeshStandardMaterial({ name, ...t, roughness: 0.82, metalness: 0, normalScale: new THREE.Vector2(0.6, 0.6) });
  delete m.scale_m;
  return woodGrade(m);
}

// Flat paint-like surfaces through P06's world-space kit (anti-tiling macro variation + fine normal).
async function painted(ctx, name, { color, rough, normalSet, normalK = 0.25, scale = 1.4, macro = [0.035, 3.5, 0.04], metalness = 0, physical = null }) {
  const plaster = normalSet ? await ctx.lib.base(normalSet, 'normal') : null;
  const m = physical ? new THREE.MeshPhysicalMaterial({ name, metalness, ...physical }) : new THREE.MeshStandardMaterial({ name, metalness });
  return ctx.surface(m, { mode: 'paint', paintColor: color, paintRough: rough, paintNormalK: normalK, paintScale: scale, macro, maps: { plaster } });
}

// Fair-faced concrete: plywood formwork panels (per-panel tone), thin panel joints, tie holes.
async function formworkConcrete(ctx, name) {
  const [color, normal, roughness] = await Promise.all(['color', 'normal', 'roughness'].map((m) => ctx.lib.base('concrete_smooth_light', m)));
  const m = new THREE.MeshStandardMaterial({ name, metalness: 0 });
  ctx.surface(m, {
    mode: 'grid', sample: 'offset', tile: [1.3, 1.2], grout: 0.0035, origin: [10.85, 2.45], floorY: 3.3, texLen: 1.1,
    maps: { color, normal, roughness }, normalK: 0.7,
    tint: [0.97, 0.965, 0.93], sat: 0.25, contrast: 0.75, texMean: 0.47, tintVar: 0.09,
    roughRange: [0.72, 0.95], roughVar: 0.08, groutColor: [0.2, 0.2, 0.195], groutRough: 0.95, bevel: 0.0,
    macro: [0.05, 2.5, 0.04], ao: 0.6,
  });
  // tie holes: 4 per panel, 12 mm, darker with a faint lighter rim (vertical faces only)
  const base = m.onBeforeCompile;
  m.onBeforeCompile = function (sh, r) {
    base.call(this, sh, r);
    sh.fragmentShader = sh.fragmentShader.replace('SfOut sfo = sfEval();', `SfOut sfo = sfEval();
      {
        vec3 tn = abs(normalize(vSfN));
        if (tn.y < 0.5) {
          vec2 tp = tn.x > tn.z ? vec2(vSfW.z - sfOrigin.y, vSfW.y - sfFloorY) : vec2(vSfW.x - sfOrigin.x, vSfW.y - sfFloorY);
          vec2 tf = mod(tp, sfTile);
          vec2 hx = vec2(0.3, sfTile.x - 0.3), hy = vec2(0.3, sfTile.y - 0.3);
          float dx = min(abs(tf.x - hx.x), abs(tf.x - hx.y));
          float dy = min(abs(tf.y - hy.x), abs(tf.y - hy.y));
          float d = length(vec2(dx, dy));
          float pw = max(fwidth(d), 1e-4);
          float hole = 1.0 - smoothstep(0.012 - pw, 0.012 + pw, d);
          float rim = (1.0 - smoothstep(0.016, 0.022, d)) * (1.0 - hole);
          sfo.albedo *= mix(1.0, 0.38, hole) * (1.0 + 0.06 * rim);
          sfo.rough = mix(sfo.rough, 0.95, hole);
        }
      }`);
  };
  m.customProgramCacheKey = () => 'p03-formwork-v1';
  return m;
}

function metalBlack(name, { color = '#161718', rough = 0.45, metal = 0.2 } = {}) {
  return new THREE.MeshStandardMaterial({ name, color: col(color), roughness: rough, metalness: metal });
}

async function powderCoat(tex, name, color, rough, metal = 0.15) {
  const t = await tex('metal_dark_painted', { repeat: 2, maps: ['normal'] });
  return new THREE.MeshStandardMaterial({ name, color: col(color), roughness: rough, metalness: metal, normalMap: t.normalMap, normalScale: new THREE.Vector2(0.12, 0.12) });
}

// Low-iron glass: reflects the environment with Fresnel, keeps a minimum reflectance so the facade reads as
// dark glass from outside (not a hole), and lets interiors glow through at night. Premultiplied output:
// result = reflection + background * (1 - alpha).
function glassMaterial() {
  const m = new THREE.MeshPhysicalMaterial({
    name: 'glass', color: col('#1c2422'), roughness: 0.03, metalness: 0, ior: 1.52, specularIntensity: 1,
    transparent: true, premultipliedAlpha: true, depthWrite: false, envMapIntensity: 1.0, side: THREE.FrontSide,
  });
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, EXT_STATE.glass);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform float uBase;\nuniform float uF0;\nuniform float uRefl;')
      .replace('#include <opaque_fragment>', `
        float gNoV = clamp(abs(dot(normalize(normal), normalize(vViewPosition))), 0.0, 1.0);
        float gF = uF0 + (1.0 - uF0) * pow(1.0 - gNoV, 5.0);
        float gA = clamp(uBase + (1.0 - uBase) * gF, 0.0, 1.0);
        gl_FragColor = vec4(outgoingLight * uRefl, gA);`)
      .replace('#include <premultiplied_alpha_fragment>', '');
  };
  m.customProgramCacheKey = () => 'p03-glass-v1';
  m.userData.p03glass = true;
  EXT_STATE.glassMats.push(m);
  return m;
}

// Wall-wash texture of an up/down light: u = metres across (0.5 = lamp axis, 1 unit = 1 m), v = distance / 2 m.
let _washTex = null;
function washTexture() {
  if (_washTex) return _washTex;
  const W = 128, Hh = 256;
  const cv = document.createElement('canvas');
  cv.width = W; cv.height = Hh;
  const g = cv.getContext('2d');
  const img = g.createImageData(W, Hh);
  for (let j = 0; j < Hh; j++) {
    const d = (j + 0.5) / Hh * 2.0;               // metres from the lamp
    const w = 0.035 + d * Math.tan(THREE.MathUtils.degToRad(15));
    const fall = 1 / (1 + (d / 0.55) ** 2) * Math.min(1, d / 0.03);
    const hot = 0.6 * Math.exp(-(((d - 0.08) / 0.1) ** 2));
    for (let i = 0; i < W; i++) {
      const x = Math.abs((i + 0.5) / W - 0.5);    // metres off-axis
      const r = x / w;
      const edge = 1 - THREE.MathUtils.smoothstep(r, 0.75, 1.05);
      const core = Math.exp(-r * r * 1.6);
      const v = Math.max(0, (0.55 * edge + 0.45 * core) * (fall + hot));
      const k = (j * W + i) * 4;
      const c = Math.min(255, Math.round(255 * Math.pow(Math.min(1, v), 1 / 2.2)));
      img.data[k] = img.data[k + 1] = img.data[k + 2] = c; img.data[k + 3] = 255;
    }
  }
  g.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
  _washTex = t;
  return t;
}

export const definitions = {
  // ---- shell materials ----------------------------------------------------------------------
  wall_ext_white: (tex, ctx) => painted(ctx, 'wall_ext_white', { color: '#ecebe6', rough: 0.88, normalSet: 'render_white_ext', normalK: 0.45, scale: 1.8, macro: [0.03, 4.0, 0.05] }),
  wall_ext_anthracite: (tex, ctx) => painted(ctx, 'wall_ext_anthracite', { color: '#4a5156', rough: 0.42, normalSet: 'concrete_smooth_light', normalK: 0.18, scale: 1.2, macro: [0.06, 2.4, 0.06] }),
  concrete_block_ext: (tex, ctx) => formworkConcrete(ctx, 'concrete_block_ext'),
  wood_slats: (tex) => larch(tex, 'wood_slats', false),
  frames: (tex) => powderCoat(tex, 'frames', '#1c1d1e', 0.52, 0.1),
  handrail_black: (tex) => powderCoat(tex, 'handrail_black', '#151617', 0.4, 0.3),
  glass: async () => glassMaterial(),
  roof_standing_seam: (tex, ctx) => painted(ctx, 'roof_standing_seam', { color: '#33383b', rough: 0.36, normalSet: 'metal_dark_painted', normalK: 0.12, scale: 1.0, macro: [0.05, 3.0, 0.06], metalness: 0.25 }),
  roof_membrane: async (tex) => {
    const t = await tex('gravel', { maps: ['color', 'normal', 'roughness'] });
    return new THREE.MeshStandardMaterial({ name: 'roof_membrane', map: t.map, normalMap: t.normalMap, roughnessMap: t.roughnessMap, color: col('#c9c7c2'), roughness: 1, metalness: 0 });
  },
  concrete_pavers: async (tex) => {
    const t = await tex('concrete_pavers');
    return new THREE.MeshStandardMaterial({ name: 'concrete_pavers', map: t.map, normalMap: t.normalMap, roughnessMap: t.roughnessMap, aoMap: t.aoMap, roughness: 1, metalness: 0 });
  },

  // ---- node overrides / detail ----------------------------------------------------------------
  EXT_larch_h: (tex) => larch(tex, 'EXT_larch_h', true),
  EXT_anthracite_backing: () => new THREE.MeshStandardMaterial({ name: 'EXT_anthracite_backing', color: col('#1d2124'), roughness: 0.8, metalness: 0 }),
  EXT_fascia: (tex, ctx) => painted(ctx, 'EXT_fascia', { color: '#efeee9', rough: 0.6, normalSet: 'render_white_ext', normalK: 0.15, scale: 1.8, macro: [0.02, 4.0, 0.03] }),
  EXT_joint: () => new THREE.MeshStandardMaterial({ name: 'EXT_joint', color: col('#6d6e6b'), roughness: 0.9, metalness: 0 }),
  EXT_coping: () => new THREE.MeshStandardMaterial({ name: 'EXT_coping', color: col('#efeee9'), roughness: 0.32, metalness: 0 }),
  EXT_metal_anthracite: (tex) => powderCoat(tex, 'EXT_metal_anthracite', '#3c4246', 0.42, 0.0),
  EXT_batten: () => new THREE.MeshStandardMaterial({ name: 'EXT_batten', color: col('#0e0e0f'), roughness: 0.9, metalness: 0 }),
  EXT_garage_door: (tex) => powderCoat(tex, 'EXT_garage_door', '#4d5459', 0.42, 0.0),
  EXT_groove: () => new THREE.MeshStandardMaterial({ name: 'EXT_groove', color: col('#0b0c0d'), roughness: 0.85, metalness: 0 }),
  EXT_front_door: (tex) => powderCoat(tex, 'EXT_front_door', '#161718', 0.4, 0.1),
  EXT_handle_steel: async (tex) => {
    const t = await tex('metal_brushed', { maps: ['normal', 'roughness'], repeat: 2 });
    return new THREE.MeshStandardMaterial({ name: 'EXT_handle_steel', color: col('#d9d8d4'), metalness: 1, roughness: 0.62, roughnessMap: t.roughnessMap, normalMap: t.normalMap, normalScale: new THREE.Vector2(0.4, 0.4) });
  },
  EXT_lamp_body: () => metalBlack('EXT_lamp_body', { color: '#141516', rough: 0.55, metal: 0.2 }),
  EXT_lamp_lens: () => {
    const m = new THREE.MeshStandardMaterial({ name: 'EXT_lamp_lens', color: col('#f4efe6'), roughness: 0.3, metalness: 0,
      emissive: new THREE.Color().setRGB(...FIXTURE_RGB), emissiveIntensity: 0 });
    EXT_STATE.glow.push(m);
    return m;
  },
  EXT_light_wash: () => {
    const m = new THREE.MeshBasicMaterial({ name: 'EXT_light_wash', map: washTexture(), color: new THREE.Color().setRGB(...FIXTURE_RGB),
      transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2, fog: false });
    m.userData.baseColor = m.color.clone();
    m.visible = false;
    EXT_STATE.wash.push(m);
    return m;
  },
};

// Node-level overrides (first match wins, see materials/index.js). Shell parts whose look differs from
// their GLB material name.
export const overrides = [
  { node: /^LEAF_D_front$/, material: 'wood_slats', use: 'EXT_front_door' },          // tall black front door
  { node: /^LEAF_D_front$/, material: 'handrail_black', use: 'EXT_handle_steel' },    // long stainless pull bar
  { node: /^SLATS_(recess_|canopy_soffit)/, material: 'wood_slats', use: 'EXT_larch_h' }, // boards running horizontally
  { node: /^EXT_wall_ext_anthracite$/, material: 'wall_ext_anthracite', use: 'EXT_anthracite_backing' }, // joints read dark
];
