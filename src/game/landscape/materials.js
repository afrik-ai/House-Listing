import * as THREE from 'three';
import { GLSL_NOISE } from './util.js';

// Texture sets from public/assets/manifest.json: textures/<name>/{color,normal,roughness,ao}.jpg.
// Geometry built by the landscape carries world-planar UVs in metres / scale, so repeat stays 1.
export class LandscapeTextures {
  constructor(game) {
    this.game = game;
    this.sets = new Map();
  }

  set(name) {
    if (!this.sets.has(name)) {
      const L = this.game.loader;
      const base = `/assets/textures/${name}`;
      const aniso = this.game.renderer.settings.anisotropy || 8;
      const job = Promise.all([
        L.loadTexture(`${base}/color.jpg`, { colorSpace: THREE.SRGBColorSpace, anisotropy: aniso }),
        L.loadTexture(`${base}/normal.jpg`, { colorSpace: THREE.NoColorSpace, anisotropy: aniso }),
        L.loadTexture(`${base}/roughness.jpg`, { colorSpace: THREE.NoColorSpace, anisotropy: aniso }),
      ]).then((ts) => {
        // Private clones (same GPU source): other pieces may set repeat/offset on the cached originals.
        const [map, normalMap, roughnessMap] = ts.map((t) => {
          const c = t.clone(); c.repeat.set(1, 1); c.offset.set(0, 0); c.rotation = 0;
          c.wrapS = c.wrapT = THREE.RepeatWrapping; c.needsUpdate = true; return c;
        });
        return { map, normalMap, roughnessMap };
      });
      this.sets.set(name, job);
    }
    return this.sets.get(name);
  }
}

// Ground/paving material: MeshStandardMaterial + (optional) desaturation, second rotated sample of
// the colour map blended by low-frequency world noise (kills visible tiling), macro brightness
// variation, and mower stripes for the lawn.
export async function groundMaterial(textures, def, extra = {}) {
  const t = await textures.set(def.tex);
  const m = new THREE.MeshStandardMaterial({
    map: t.map, normalMap: t.normalMap, roughnessMap: t.roughnessMap,
    roughness: def.roughness ?? 1, metalness: 0,
    color: new THREE.Color().setRGB(...(def.tint || [1, 1, 1])),
    normalScale: new THREE.Vector2(def.normalScale ?? 1, def.normalScale ?? 1),
    ...extra,
  });
  const t2 = def.tex2 ? await textures.set(def.tex2) : null;
  const opts = {
    desat: def.desat ?? 0, macro: def.macro ?? 0.22, antitile: def.antitile ?? true, stripes: def.stripes ?? 0,
    stripeDir: def.stripeDir ?? 0, map2: t2?.map || null, wet: !!def.wet,
  };
  patchGround(m, opts);
  m.userData.landscape = def;
  return m;
}

// Night path lights (bollards), shared by every landscape material (ground, grass): up to 16
// small lights evaluated only in landscape shaders (no real three.js lights, no recompiles).
export const PATH_LIGHTS = {
  uPath: { value: Array.from({ length: 16 }, () => new THREE.Vector3(0, -100, 0)) },
  uPathCol: { value: new THREE.Color(0, 0, 0) },
};
export const GLSL_PATH_LIGHTS = /* glsl */`
uniform vec3 uPath[16];
uniform vec3 uPathCol;
vec3 lsPathLight(vec3 p, vec3 n) {
  vec3 e = vec3(0.0);
  for (int i = 0; i < 16; i++) {
    vec3 d = uPath[i] - p;
    float d2 = max(dot(d, d), 0.02);
    float c = max(dot(n, d) * inversesqrt(d2), 0.0);
    e += c / (d2 + 0.04) * smoothstep(3.2, 1.2, sqrt(d2));
  }
  return e * uPathCol;
}`;

export function patchGround(m, o) {
  m.userData.lsUniforms = {
    uDesat: { value: o.desat }, uMacro: { value: o.macro }, uStripes: { value: o.stripes },
    uMap2: { value: o.map2 }, uWetY: { value: -999 }, uTime: { value: 0 },
    ...PATH_LIGHTS,
  };
  const key = `lsground:${o.antitile ? 1 : 0}${o.map2 ? 1 : 0}${o.stripes ? 1 : 0}${o.wet ? 1 : 0}`;
  m.customProgramCacheKey = () => key;
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, m.userData.lsUniforms);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vLsWorld;')
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        vec4 lsW = vec4(transformed, 1.0);
        #ifdef USE_INSTANCING
          lsW = instanceMatrix * lsW;
        #endif
        vLsWorld = (modelMatrix * lsW).xyz;`);
    let frag = sh.fragmentShader
      .replace('#include <common>', `#include <common>
        varying vec3 vLsWorld;
        uniform float uDesat, uMacro, uStripes, uWetY, uTime;
        ${GLSL_PATH_LIGHTS}
        ${o.map2 ? 'uniform sampler2D uMap2;' : ''}
        ${GLSL_NOISE}`);
    frag = frag.replace('#include <map_fragment>', `
      #ifdef USE_MAP
        vec4 lsTex = texture2D(map, vMapUv);
        ${o.antitile ? `
        float lsBl = smoothstep(0.3, 0.7, lsFbm(vLsWorld.xz * 0.16 + 3.1));
        vec2 lsUv2 = mat2(0.8, -0.6, 0.6, 0.8) * vMapUv * 0.87 + vec2(0.37, 0.61);
        lsTex = mix(lsTex, texture2D(map, lsUv2), lsBl * 0.85);` : ''}
        ${o.map2 ? `
        float lsB2 = smoothstep(0.35, 0.8, lsFbm(vLsWorld.xz * 0.07 + 11.0));
        lsTex.rgb = mix(lsTex.rgb, texture2D(uMap2, vMapUv * 0.93 + 0.21).rgb * vec3(0.95, 1.0, 0.85), lsB2 * 0.55);` : ''}
        float lsL = dot(lsTex.rgb, vec3(0.2126, 0.7152, 0.0722));
        lsTex.rgb = mix(lsTex.rgb, vec3(lsL), uDesat);
        float lsM = lsFbm(vLsWorld.xz * 0.11) - 0.5;
        lsTex.rgb *= 1.0 + uMacro * lsM * 2.0;
        ${o.stripes ? `
        // mower stripes: 0.9 m bands along X, alternating blade direction (lighter / darker)
        float lsS = sin(vLsWorld.x * 3.14159 / 0.9);
        lsTex.rgb *= 1.0 + uStripes * smoothstep(-0.25, 0.25, lsS) - uStripes * 0.5;` : ''}
        diffuseColor *= lsTex;
      #endif`);
    if (o.wet) {
      // Wet line on the pool walls: a darker, glossier band just above the (moving) water level.
      frag = frag.replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
        float lsWave = 0.012 * sin(uTime * 1.3 + vLsWorld.x * 2.1 + vLsWorld.z * 1.7);
        float lsWet = 1.0 - smoothstep(uWetY + 0.015 + lsWave, uWetY + 0.05 + lsWave, vLsWorld.y);
        roughnessFactor = mix(roughnessFactor, 0.12, lsWet);
        diffuseColor.rgb *= mix(1.0, 0.62, lsWet);`);
    }
    frag = frag.replace('#include <opaque_fragment>', `outgoingLight += diffuseColor.rgb * RECIPROCAL_PI * lsPathLight(vLsWorld, normalize((vec4(normal, 0.0) * viewMatrix).xyz));
      #include <opaque_fragment>`);
    sh.fragmentShader = frag;
  };
  return m;
}
