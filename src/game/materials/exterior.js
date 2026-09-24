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
function woodGrade(mat, { sat = 0.5, tint = [1.5, 1.62, 1.12] } = {}) {
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
// `member`: beams / surround pieces (100-180 mm faces): no cross-grain stretch (that blew the figure up into swirls),
// stretched 2.2x ALONG the grain instead, so it reads as straight-grained sawn larch.
async function larch(tex, name, horizontal, member = false) {
  const rep = member ? [1.0, 0.45] : [0.5, 0.6];
  const t = await tex('larch_boards', horizontal ? { repeat: [rep[1], rep[0]], rotation: Math.PI / 2, maps: ['color', 'normal', 'roughness'] }
    : { repeat: rep, maps: ['color', 'normal', 'roughness'] });
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

// ---------------------------------------------------------------------------------------------
// White render: box-UV'd render texture at 1 m + a second plaster normal octave (anti-tiling), albedo mottling,
// roughness 0.75-0.95, a darker splash/grime band just above grade, and the fascia bands drawn in the shader
// (8 mm shadow groove at the band bottom + 5 mm panel joints every ~2.4 m), anti-aliased with fwidth.
// Band zones come from house.json (flat-roof parapets, thin elevated slabs).
// ---------------------------------------------------------------------------------------------
const MAX_BANDS = 12;
export function fasciaBands(spec) {
  const out = [];
  if (!spec) return out;
  for (const rf of spec.roofs || []) {
    if (rf.type !== 'flat' || !rf.parapet) continue;
    const top = rf.top + rf.parapet;
    for (const [x, z, w, d] of rf.rects || []) out.push([[x - 0.2, top - 0.5, z - 0.2], [x + w + 0.2, top + 0.001, z + d + 0.2]]);
  }
  for (const bx of spec.structure?.boxes || []) {
    const [y0, y1] = bx.y;
    if (y0 < 1 || y1 - y0 > 0.6) continue;
    const [x, z, w, d] = bx.rect;
    out.push([[x - 0.02, y0 - 0.001, z - 0.02], [x + w + 0.02, y1 + 0.001, z + d + 0.02]]);
  }
  return out.slice(0, MAX_BANDS);
}

const RENDER_GLSL = /* glsl */`
varying vec3 vRW;
varying vec3 vRN;
uniform sampler2D uN2;
uniform float uN2k;
uniform float uGrade;
uniform vec3 uBandMin[${MAX_BANDS}];
uniform vec3 uBandMax[${MAX_BANDS}];
uniform int uBands;
float rHash(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
float rNoise(vec2 p) { vec2 i = floor(p), f = fract(p); vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(rHash(i), rHash(i + vec2(1.0, 0.0)), u.x), mix(rHash(i + vec2(0.0, 1.0)), rHash(i + vec2(1.0, 1.0)), u.x), u.y); }
float rFbm(vec2 p) { return 0.5 * rNoise(p) + 0.3 * rNoise(p * 2.07 + 5.3) + 0.2 * rNoise(p * 4.31 + 1.7); }
float rLine(float d, float hw) { float w = max(fwidth(d), 1e-5); return 1.0 - smoothstep(hw - w, hw + w, abs(d)); }
`;

async function renderWhite(tex, ctx, name, { color = '#eeede8', grime = 0.2, bands = true, scale = 1.0 } = {}) {
  const t = await tex('render_white_ext', { scale, maps: ['color', 'normal', 'roughness'] });
  const n2 = await ctx.lib.base('plaster_white_ext_alt', 'normal');
  const m = new THREE.MeshStandardMaterial({ name, map: t.map, normalMap: t.normalMap, roughnessMap: t.roughnessMap,
    color: col(color), roughness: 1, metalness: 0, normalScale: new THREE.Vector2(0.9, 0.9) });
  const zones = bands ? fasciaBands(ctx.game?.house?.spec) : [];
  const zmin = Array.from({ length: MAX_BANDS }, (_, i) => new THREE.Vector3(...(zones[i]?.[0] || [0, -99, 0])));
  const zmax = Array.from({ length: MAX_BANDS }, (_, i) => new THREE.Vector3(...(zones[i]?.[1] || [0, -99, 0])));
  const grade = ctx.game?.house?.spec?.site?.grade_y ?? -0.3;
  m.userData.renderZones = zones;
  const gk = (grime / 0.2).toFixed(3);
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, {
      uN2: { value: n2 }, uN2k: { value: 0.7 }, uGrade: { value: grade },
      uBandMin: { value: zmin }, uBandMax: { value: zmax }, uBands: { value: zones.length },
    });
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vRW;\nvarying vec3 vRN;')
      .replace('#include <worldpos_vertex>', `#include <worldpos_vertex>
        vRW = (modelMatrix * vec4(transformed, 1.0)).xyz;
        vRN = normalize(mat3(modelMatrix) * objectNormal);`);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\n' + RENDER_GLSL)
      .replace('#include <map_fragment>', `#include <map_fragment>
        vec3 rn = abs(normalize(vRN));
        bool rVert = rn.y < 0.5;
        vec2 rP = rVert ? vec2(rn.x > rn.z ? vRW.z : vRW.x, vRW.y) : vRW.xz;
        float rM = rFbm(rP / 2.6) - 0.5;
        float rF = rNoise(rP * 7.0) - 0.5;
        diffuseColor.rgb *= 1.0 + rM * 0.075 + rF * 0.02;
        float rG = 1.0 - smoothstep(uGrade + 0.02, uGrade + 0.55, vRW.y);
        rG *= 0.55 + 0.45 * rNoise(vec2(rP.x * 2.3, vRW.y * 9.0));
        rG *= rVert ? 1.0 : 0.0;
        diffuseColor.rgb *= mix(vec3(1.0), vec3(0.8, 0.77, 0.72), clamp(rG * ${gk}, 0.0, 1.0));
        float rJ = 0.0;
        float rRough = 0.0;
        if (rVert) {
          for (int i = 0; i < ${MAX_BANDS}; i++) {
            if (i >= uBands) break;
            if (all(greaterThanEqual(vRW, uBandMin[i])) && all(lessThanEqual(vRW, uBandMax[i]))) {
              float a = rn.x > rn.z ? vRW.z - uBandMin[i].z : vRW.x - uBandMin[i].x;
              float L = rn.x > rn.z ? uBandMax[i].z - uBandMin[i].z : uBandMax[i].x - uBandMin[i].x;
              float nP = max(1.0, floor(L / 2.4 + 0.5));
              float pw = L / nP;
              float da = a - pw * floor(a / pw + 0.5);
              float edge = min(a, L - a);
              rJ = max(rJ, rLine(da, 0.0025) * step(0.3, edge));
              float gy = vRW.y - uBandMin[i].y;
              rJ = max(rJ, rLine(gy - 0.004, 0.004));
              rRough = 1.0;
            }
          }
        }
        diffuseColor.rgb *= 1.0 - 0.6 * rJ;`)
      .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
        roughnessFactor = mix(0.75, 0.95, clamp(roughnessFactor, 0.0, 1.0)) - rRough * 0.12;`)
      .replace('#include <normal_fragment_maps>', `
        vec3 mapN = texture2D(normalMap, vNormalMapUv).xyz * 2.0 - 1.0;
        vec3 mapN2 = texture2D(uN2, vNormalMapUv * 0.43 + vec2(0.31, 0.77)).xyz * 2.0 - 1.0;
        mapN.xy = (mapN.xy + mapN2.xy * uN2k) * normalScale;
        normal = normalize(tbn * mapN);`);
  };
  m.customProgramCacheKey = () => 'p03-render-v1';
  return m;
}

// RAL 7016 anthracite, satin (fibre-cement panels, garage door): #383E42, roughness ~0.45, light normal + sheen.
async function ral7016(tex, name, rough = 0.45) {
  const t = await tex('concrete_smooth_light', { scale: 1.6, maps: ['normal', 'roughness'] });
  const m = new THREE.MeshPhysicalMaterial({ name, color: col('#383e42'), roughness: rough, metalness: 0,
    normalMap: t.normalMap, normalScale: new THREE.Vector2(0.18, 0.18), roughnessMap: t.roughnessMap,
    clearcoat: 0.25, clearcoatRoughness: 0.35 });
  m.onBeforeCompile = (sh) => {     // light roughness breakup from the texture, centred on `rough`
    sh.fragmentShader = sh.fragmentShader.replace('#include <roughnessmap_fragment>', `
      float roughnessFactor = roughness;
      #ifdef USE_ROUGHNESSMAP
        roughnessFactor = clamp(roughness + (texture2D(roughnessMap, vRoughnessMapUv).g - 0.5) * 0.12, 0.3, 0.7);
      #endif`);
  };
  m.customProgramCacheKey = () => 'p03-ral7016-v1';
  return m;
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

// Low-iron glass. Reflections come from 4 box-projected cube probes (east / south / west / north of the house,
// captured once per time of day by 20_exterior.js), so panes mirror the garden, terrace and street with correct
// parallax instead of a sky cube with clouds at floor height. Fresnel (F0 0.04 x specScale), a faint green-grey
// body, and more opacity with distance so glass never reads as a hole from across the garden.
// Premultiplied output: result = reflection + body + background * (1 - alpha).
export const PROBE_RES = 256;
function probeTargets() {
  if (!EXT_STATE.probeRT) {
    EXT_STATE.probeRT = [0, 1, 2, 3].map(() => new THREE.WebGLCubeRenderTarget(PROBE_RES, {
      type: THREE.HalfFloatType, generateMipmaps: true, minFilter: THREE.LinearMipmapLinearFilter, magFilter: THREE.LinearFilter }));
  }
  return EXT_STATE.probeRT;
}
EXT_STATE.probe = {
  uProbePos: { value: [0, 1, 2, 3].map(() => new THREE.Vector3()) },
  uBoxMin: { value: [0, 1, 2, 3].map(() => new THREE.Vector3(-50, -1, -50)) },
  uBoxMax: { value: [0, 1, 2, 3].map(() => new THREE.Vector3(50, 50, 50)) },
  uProbeK: { value: 0 },           // 0 until the first capture
  uDistK: { value: 0.28 },         // extra opacity far away
  uBody: { value: new THREE.Color().setRGB(0.05, 0.065, 0.06) },
};

const GLASS_GLSL = /* glsl */`
uniform float uBase;
uniform float uF0;
uniform float uRefl;
uniform samplerCube uProbe0;
uniform samplerCube uProbe1;
uniform samplerCube uProbe2;
uniform samplerCube uProbe3;
uniform vec3 uProbePos[4];
uniform vec3 uBoxMin[4];
uniform vec3 uBoxMax[4];
uniform float uProbeK;
uniform float uDistK;
uniform vec3 uBody;
varying vec3 vGW;
varying vec3 vGN;
vec3 gBox(vec3 R, vec3 P, vec3 bmin, vec3 bmax, vec3 C) {
  vec3 t1 = (bmax - P) / R, t2 = (bmin - P) / R;
  vec3 tf = max(t1, t2);
  float t = min(min(tf.x, tf.y), tf.z);
  return normalize(P + R * max(t, 0.0) - C);
}
`;

function glassMaterial() {
  const rt = probeTargets();
  const m = new THREE.MeshPhysicalMaterial({
    name: 'glass', color: col('#1c2422'), roughness: 0.03, metalness: 0, ior: 1.52, specularIntensity: 1,
    transparent: true, premultipliedAlpha: true, depthWrite: false, envMapIntensity: 1.0, side: THREE.FrontSide,
  });
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, EXT_STATE.glass, EXT_STATE.probe, {
      uProbe0: { value: rt[0].texture }, uProbe1: { value: rt[1].texture }, uProbe2: { value: rt[2].texture }, uProbe3: { value: rt[3].texture },
    });
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vGW;\nvarying vec3 vGN;')
      .replace('#include <worldpos_vertex>', `#include <worldpos_vertex>
        vGW = (modelMatrix * vec4(transformed, 1.0)).xyz;
        vGN = normalize(mat3(modelMatrix) * objectNormal);`);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\n' + GLASS_GLSL)
      .replace('#include <opaque_fragment>', `
        float gNoV = clamp(abs(dot(normalize(normal), normalize(vViewPosition))), 0.0, 1.0);
        float gF = uF0 + (1.0 - uF0) * pow(1.0 - gNoV, 5.0);
        vec3 gN = normalize(vGN);
        vec3 gV = normalize(vGW - cameraPosition);
        vec3 gR = reflect(gV, gN);
        vec3 gEnv = vec3(0.0);
        if (uProbeK > 0.0) {
          vec3 an = abs(gN);
          if (an.x > an.z) {
            if (gN.x > 0.0) gEnv = textureLod(uProbe0, gBox(gR, vGW, uBoxMin[0], uBoxMax[0], uProbePos[0]), 0.0).rgb;
            else gEnv = textureLod(uProbe2, gBox(gR, vGW, uBoxMin[2], uBoxMax[2], uProbePos[2]), 0.0).rgb;
          } else {
            if (gN.z > 0.0) gEnv = textureLod(uProbe1, gBox(gR, vGW, uBoxMin[1], uBoxMax[1], uProbePos[1]), 0.0).rgb;
            else gEnv = textureLod(uProbe3, gBox(gR, vGW, uBoxMin[3], uBoxMax[3], uProbePos[3]), 0.0).rgb;
          }
        }
        float gDist = length(vViewPosition);
        float gA = clamp(uBase + (1.0 - uBase) * gF + uDistK * smoothstep(8.0, 30.0, gDist) * (1.0 - uBase), 0.0, 1.0);
        // built-in env specular is replaced by the probe when captured (uProbeK blends)
        vec3 gSpec = mix(reflectedLight.indirectSpecular, gEnv * gF, uProbeK);
        vec3 gOut = totalDiffuse + reflectedLight.directSpecular + gSpec * uRefl + uBody * gA;
        gl_FragColor = vec4(gOut, gA);`)
      .replace('#include <premultiplied_alpha_fragment>', '');
  };
  m.customProgramCacheKey = () => 'p03-glass-v2';
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
  wall_ext_white: (tex, ctx) => renderWhite(tex, ctx, 'wall_ext_white'),
  wall_ext_anthracite: (tex) => ral7016(tex, 'wall_ext_anthracite'),
  concrete_block_ext: (tex, ctx) => formworkConcrete(ctx, 'concrete_block_ext'),
  wood_slats: (tex) => larch(tex, 'wood_slats', false),
  frames: () => new THREE.MeshStandardMaterial({ name: 'frames', color: col('#1c1d1e'), roughness: 0.48, metalness: 0.1 }),
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
  EXT_larch_member: (tex) => larch(tex, 'EXT_larch_member', false, true),
  EXT_anthracite_backing: () => new THREE.MeshStandardMaterial({ name: 'EXT_anthracite_backing', color: col('#0c0e0f'), roughness: 0.9, metalness: 0 }),
  EXT_fascia: (tex, ctx) => renderWhite(tex, ctx, 'EXT_fascia', { bands: false }),
  EXT_joint: () => new THREE.MeshStandardMaterial({ name: 'EXT_joint', color: col('#6d6e6b'), roughness: 0.9, metalness: 0 }),
  EXT_coping: () => new THREE.MeshStandardMaterial({ name: 'EXT_coping', color: col('#efeee9'), roughness: 0.32, metalness: 0 }),
  EXT_metal_anthracite: (tex) => powderCoat(tex, 'EXT_metal_anthracite', '#3c4246', 0.42, 0.0),
  EXT_batten: () => new THREE.MeshStandardMaterial({ name: 'EXT_batten', color: col('#0e0e0f'), roughness: 0.9, metalness: 0 }),
  EXT_garage_door: (tex) => ral7016(tex, 'EXT_garage_door', 0.42),
  EXT_groove: () => new THREE.MeshStandardMaterial({ name: 'EXT_groove', color: col('#0b0c0d'), roughness: 0.85, metalness: 0 }),
  EXT_front_door: async (tex) => {
    const t = await tex('metal_dark_painted', { repeat: 1.5, maps: ['normal'] });
    return new THREE.MeshPhysicalMaterial({ name: 'EXT_front_door', color: col('#1a1b1d'), roughness: 0.45, metalness: 0,
      normalMap: t.normalMap, normalScale: new THREE.Vector2(0.15, 0.15), clearcoat: 0.35, clearcoatRoughness: 0.28 });
  },
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
