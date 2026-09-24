import * as THREE from 'three';
import { GLSL_NOISE, rng } from './util.js';
import { PATH_LIGHTS, GLSL_PATH_LIGHTS } from './materials.js';

// Lawn blades near the camera: one InstancedMesh of "cells" (CELL x CELL m, BLADES per cell) laid
// out in a disc around the camera. The mesh follows the camera, snapped to the cell size, so every
// blade is anchored to a fixed world spot (its look is hashed from world position).
// Per blade (vertex shader): lawn mask lookup (no blades on paths/beds/deck), distance LOD (blade
// count thins out, remaining blades shrink into the textured lawn so there is no visible edge),
// random lean/facing/height/colour, and wind. MeshStandardMaterial underneath: shadows, IBL and
// fog as everything else, plus a back-lit translucency term and night path-light pools.
const CELL = 0.5;
const SEG = 3;   // segments per blade

function patchGeometry(seed, BLADES) {
  const R = rng(seed);
  const vertsPerBlade = SEG * 2 + 1;
  const n = BLADES * vertsPerBlade;
  const pos = new Float32Array(n * 3);      // root x, t (0..1 along blade), root z
  const aSide = new Float32Array(n);        // -1 / 0 / +1
  const aRnd = new Float32Array(n * 4);     // per-blade randoms
  const idx = [];
  let v = 0;
  for (let b = 0; b < BLADES; b++) {
    const rx = R() * CELL, rz = R() * CELL;
    const r = [R(), R(), R(), R()];
    const base = v;
    for (let s = 0; s <= SEG; s++) {
      const t = s / SEG;
      const sides = s === SEG ? [0] : [-1, 1];
      for (const sd of sides) {
        pos.set([rx, t, rz], v * 3);
        aSide[v] = sd;
        aRnd.set(r, v * 4);
        v++;
      }
    }
    for (let s = 0; s < SEG; s++) {
      const a = base + s * 2, b2 = a + 1, c = a + 2, d = a + 3;
      if (s === SEG - 1) idx.push(a, b2, c);
      else idx.push(a, b2, c, b2, d, c);
    }
  }
  const g = new THREE.InstancedBufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(n * 3).fill(0), 3));
  g.setAttribute('aSide', new THREE.BufferAttribute(aSide, 1));
  g.setAttribute('aRnd', new THREE.BufferAttribute(aRnd, 4));
  g.setIndex(idx);
  return g;
}

// Two tiers: a dense near disc (48 blades / cell) that thins to ~30 % by its edge, and a sparse ring
// (14 blades / cell) continuing that density and fading to nothing (blades also shrink into the
// textured lawn), so there is no visible boundary. ~260k triangles in total.
const TIERS = [
  { name: 'near', blades: 48, r0: -1, r1: 6.5, dens: [4.0, 6.5, 0.3] },
  { name: 'far', blades: 14, r0: 6.5, r1: 13.5, dens: [6.5, 13.0, 0.0] },
];

export function buildGrass(ctx, { radius = 13.5 } = {}) {
  const { site, mask, group } = ctx;
  const [px, pz, pw, pd] = mask.rect;
  const shared = {
    uMask: { value: mask.tex },
    uMaskRect: { value: new THREE.Vector4(px, pz, pw, pd) },
    uTime: { value: 0 },
    uRadius: { value: radius },
    uDensityNear: { value: 1.0 },
    uSunDir: { value: new THREE.Vector3(0, 1, 0) },
    uSunCol: { value: new THREE.Color() },
    ...PATH_LIGHTS,
  };
  const uniforms = shared;
  const meshes = TIERS.map((tier) => makeTier(tier));

  function makeTier(tier) {
  const cells = [];
  const nr = Math.ceil(tier.r1 / CELL) + 1;
  for (let i = -nr; i < nr; i++) for (let j = -nr; j < nr; j++) {
    const d = Math.hypot((i + 0.5) * CELL, (j + 0.5) * CELL);
    if (d > tier.r0 && d <= tier.r1) cells.push([i * CELL, j * CELL]);
  }
  const geo = patchGeometry(1234 + tier.blades, tier.blades);
  const uniforms = { ...shared, uDens: { value: new THREE.Vector3(...tier.dens) } };
  const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.62, metalness: 0, side: THREE.DoubleSide });
  mat.name = 'LS_grass_blades';
  mat.customProgramCacheKey = () => 'ls-grass-1';
  mat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, uniforms);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', `#include <common>
        attribute float aSide;
        attribute vec4 aRnd;
        uniform sampler2D uMask;
        uniform vec4 uMaskRect;
        uniform float uTime, uRadius, uDensityNear;
        uniform vec3 uDens;
        varying vec3 vLsCol;
        varying float vLsT;
        varying vec3 vLsWorld;
        ${GLSL_NOISE}`)
      .replace('#include <beginnormal_vertex>', `
        // world root of this blade (mesh follows the camera; instance = cell offset)
        vec3 lsRootL = vec3(position.x, 0.0, position.z);
        vec4 lsRootW = modelMatrix * instanceMatrix * vec4(lsRootL, 1.0);
        vec2 wp = lsRootW.xz;
        // re-randomise per world cell so the pattern never repeats
        vec2 cellId = floor(wp / ${CELL.toFixed(2)});
        float h0 = lsHash(cellId * 1.37 + aRnd.xy * 17.0);
        float h1 = lsHash(cellId * 2.11 + aRnd.zw * 13.0);
        vec2 jit = (vec2(h0, h1) - 0.5) * 0.08;
        wp += jit;
        vec2 muv = (wp - uMaskRect.xy) / uMaskRect.zw;
        float lawn = texture2D(uMask, muv).r;
        if (muv.x < 0.0 || muv.y < 0.0 || muv.x > 1.0 || muv.y > 1.0) lawn = 0.0;
        float dist = length(wp - cameraPosition.xz);
        float rank = fract(h0 * 7.13 + h1 * 3.31);
        float dens = uDensityNear * mix(1.0, uDens.z, smoothstep(uDens.x, uDens.y, dist));
        float keep = step(rank, dens) * step(0.5 + (h1 - 0.5) * 0.3, lawn);
        float hFade = 1.0 - smoothstep(uRadius * 0.55, uRadius, dist);
        float patchy = lsFbm(wp * 0.35);
        float height = (0.045 + 0.075 * aRnd.x * aRnd.x + 0.03 * patchy) * keep * (0.35 + 0.65 * hFade);
        float width = (0.0045 + 0.0035 * aRnd.y) * (1.0 + 0.8 * smoothstep(3.0, 12.0, dist));
        float face = (aRnd.z + h0) * 6.2831;
        vec2 fdir = vec2(cos(face), sin(face));
        vec2 side = vec2(-fdir.y, fdir.x);
        float lean = (0.25 + 0.6 * aRnd.w) * height;
        float t = position.y;
        float wind = (lsNoise(wp * 0.6 + vec2(uTime * 0.9, uTime * 0.4)) - 0.5) * 0.9 + sin(uTime * 2.3 + wp.x * 1.7 + wp.y * 1.1) * 0.2;
        vec2 bend = fdir * lean * t * t + vec2(0.8, 0.5) * wind * 0.035 * t * t * (height / 0.1);
        float wT = width * (1.0 - t * 0.85);
        vec3 lsPos = vec3(wp.x, lsRootW.y, wp.y) + vec3(side.x, 0.0, side.y) * aSide * wT + vec3(bend.x, t * height, bend.y);
        // normal: blade face normal blended toward up (soft, lawn-like shading)
        vec3 fN = normalize(vec3(fdir.x, 0.35 + t, fdir.y));
        vec3 objectNormal = normalize(mix(fN, vec3(0.0, 1.0, 0.0), 0.6));
        vLsT = t;
        vec3 cA = vec3(0.10, 0.20, 0.035), cB = vec3(0.19, 0.29, 0.06), cC = vec3(0.28, 0.33, 0.10);
        vec3 col = mix(cA, cB, h1);
        col = mix(col, cC, smoothstep(0.62, 0.9, patchy) * 0.6 + step(0.965, h0) * 0.6);
        vLsCol = col * mix(0.45, 1.05, t);
        vLsWorld = lsPos;
      `)
      .replace('#include <begin_vertex>', `
        // local position = world blade position expressed in mesh/instance space
        vec3 transformed = lsPos - (modelMatrix * instanceMatrix)[3].xyz;
      `);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
        varying vec3 vLsCol;
        varying float vLsT;
        varying vec3 vLsWorld;
        uniform vec3 uSunDir, uSunCol;
        ${GLSL_PATH_LIGHTS}`)
      .replace('#include <normal_fragment_begin>', `#include <normal_fragment_begin>
        normal *= faceDirection;`)
      .replace('#include <color_fragment>', `#include <color_fragment>
        diffuseColor.rgb *= vLsCol * 1.55;`)
      .replace('#include <opaque_fragment>', `
        {
          // translucency: light through the blades when looking toward the sun
          vec3 Vw = normalize(vLsWorld - cameraPosition);
          float back = pow(max(dot(Vw, uSunDir), 0.0), 3.0);
          float sh = 1.0;
          #if defined( USE_SHADOWMAP ) && NUM_DIR_LIGHT_SHADOWS > 0
            sh = getShadow( directionalShadowMap[ 0 ], directionalLightShadows[ 0 ].shadowMapSize, directionalLightShadows[ 0 ].shadowIntensity, directionalLightShadows[ 0 ].shadowBias, directionalLightShadows[ 0 ].shadowRadius, vDirectionalShadowCoord[ 0 ] );
          #endif
          outgoingLight += diffuseColor.rgb * uSunCol * back * sh * vLsT * 0.35;
          // night path lights (bollards): warm pools on the grass
outgoingLight += diffuseColor.rgb * RECIPROCAL_PI * lsPathLight(vLsWorld + vec3(0.0, 0.05, 0.0), vec3(0.0, 1.0, 0.0)) * 1.3;
        }
        #include <opaque_fragment>`);
  };

  const mesh = new THREE.InstancedMesh(geo, mat, cells.length);
  const m = new THREE.Matrix4();
  cells.forEach(([x, z], i) => mesh.setMatrixAt(i, m.makeTranslation(x, 0, z)));
  mesh.instanceMatrix.needsUpdate = true;
  mesh.frustumCulled = false;
  mesh.castShadow = false;
  mesh.receiveShadow = true;
  mesh.name = `LS_grass_blades_${tier.name}`;
  mesh.position.y = site.grade_y;
  group.add(mesh);
  return mesh;
  }

  return {
    meshes, uniforms,
    update(dt, camera, sun) {
      uniforms.uTime.value += dt;
      for (const mesh of meshes) {
        mesh.position.x = Math.floor(camera.position.x / CELL) * CELL;
        mesh.position.z = Math.floor(camera.position.z / CELL) * CELL;
        mesh.visible = camera.position.y < 12;
      }
      if (sun) {
        uniforms.uSunDir.value.copy(sun.position).sub(sun.target.position).normalize();
        uniforms.uSunCol.value.copy(sun.color).multiplyScalar(sun.intensity);
      }
    },
    setQuality(tier) {
      uniforms.uDensityNear.value = tier === 'low' ? 0.35 : tier === 'medium' ? 0.65 : 1.0;
    },
  };
}
