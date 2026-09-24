import * as THREE from 'three';
import { GeoBuilder, GLSL_NOISE } from './util.js';
import { groundMaterial } from './materials.js';

// Pool: waterline tile band (with a moving wet line), the water surface and a night glow light.
//
// The water is a MeshPhysicalMaterial (black diffuse, IOR 1.333) so sun glints, IBL reflection with
// Fresnel, shadows and fog come from three's own lighting. onBeforeCompile adds:
//   * animated normals: three octaves of gradient noise with analytic derivatives, faded with distance;
//   * the whole pool interior, RAY-TRACED per pixel: the refracted view ray is intersected with the
//     basin (sloped floor + four walls), the mosaic tile is sampled at the hit, lit by the refracted
//     sun (analytic wall shadow + the surface's shadow-map term) with animated caustics, sky
//     irradiance from the IBL, and the underwater lamps at night;
//   * Beer-Lambert absorption along the in-water path (depth tint) plus in-scattering;
//   * a thin broken foam/wet line where the water meets the walls.
// Result: (1 - F) * underwater + three's specular reflection. One draw call, no extra passes.
export async function buildPool(ctx) {
  const { site, textures, group } = ctx;
  const p = site.pool;
  const [x0, z0, w, d] = p.rect;
  const x1 = x0 + w, z1 = z0 + d;
  const wy = p.water_y;

  // ---- waterline tile band (above water, below the coping) ---------------------------------------
  const tileDef = site.materials.pool_tile;
  const bandMat = await groundMaterial(textures, { ...tileDef, antitile: false, macro: 0.05, roughness: 0.25, wet: true });
  bandMat.userData.lsUniforms.uWetY.value = wy;
  const top = wy + 0.06, bot = wy - 0.1;
  const s = tileDef.scale;
  const gb = new GeoBuilder();
  gb.quad([x0, bot, z0], [x1, bot, z0], [x1, top, z0], [x0, top, z0], [0, 0, 1], [[x0 / s, bot / s], [x1 / s, bot / s], [x1 / s, top / s], [x0 / s, top / s]]);
  gb.quad([x1, bot, z1], [x0, bot, z1], [x0, top, z1], [x1, top, z1], [0, 0, -1], [[x1 / s, bot / s], [x0 / s, bot / s], [x0 / s, top / s], [x1 / s, top / s]]);
  gb.quad([x0, bot, z1], [x0, bot, z0], [x0, top, z0], [x0, top, z1], [1, 0, 0], [[z1 / s, bot / s], [z0 / s, bot / s], [z0 / s, top / s], [z1 / s, top / s]]);
  gb.quad([x1, bot, z0], [x1, bot, z1], [x1, top, z1], [x1, top, z0], [-1, 0, 0], [[z0 / s, bot / s], [z1 / s, bot / s], [z1 / s, top / s], [z0 / s, top / s]]);
  const band = new THREE.Mesh(gb.build(), bandMat);
  band.name = 'LS_pool_band'; band.receiveShadow = true;
  group.add(band);

  // ---- water ------------------------------------------------------------------------------------
  const tile = (await textures.set(tileDef.tex)).map;
  const uniforms = {
    uTime: { value: 0 },
    uRect: { value: new THREE.Vector4(x0, z0, x1, z1) },
    uWaterY: { value: wy },
    uDepth: { value: new THREE.Vector2(p.shallow_depth ?? p.depth, p.depth) },   // (east/shallow, west/deep)
    uTile: { value: tile },
    uTileScale: { value: tileDef.scale },
    uTileTint: { value: new THREE.Vector3(...(tileDef.tint || [1, 1, 1])) },
    uSunDir: { value: new THREE.Vector3(0, 1, 0) },
    uSunCol: { value: new THREE.Color(0, 0, 0) },
    uAbsorb: { value: new THREE.Vector3(...p.absorption) },
    uScatter: { value: new THREE.Vector3(...p.water_color) },
    uLamps: { value: (p.lights || []).slice(0, 4).map(([lx, lz]) => new THREE.Vector3(lx, p.light_y ?? wy - 0.5, lz)) },
    uLampCol: { value: new THREE.Color(0, 0, 0) },
    uAmbientBoost: { value: 1.0 },
  };
  while (uniforms.uLamps.value.length < 4) uniforms.uLamps.value.push(new THREE.Vector3(0, -100, 0));

  const mat = new THREE.MeshPhysicalMaterial({ color: 0x000000, roughness: 0.035, metalness: 0, ior: 1.333, specularIntensity: 1, envMapIntensity: 1.0 });
  mat.name = 'LS_water';
  mat.customProgramCacheKey = () => 'ls-water-1';
  mat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, uniforms);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vLsWorld;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvLsWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
        varying vec3 vLsWorld;
        uniform float uTime, uWaterY, uTileScale, uAmbientBoost;
        uniform vec4 uRect;
        uniform vec2 uDepth;
        uniform sampler2D uTile;
        uniform vec3 uTileTint, uSunDir, uSunCol, uAbsorb, uScatter, uLampCol;
        uniform vec3 uLamps[4];
        ${GLSL_NOISE}
        vec3 lsNoised(vec2 x) {
          vec2 i = floor(x); vec2 f = fract(x);
          vec2 u = f * f * f * (f * (f * 6.0 - 15.0) + 10.0);
          vec2 du = 30.0 * f * f * (f * (f - 2.0) + 1.0);
          float a = lsHash(i), b = lsHash(i + vec2(1.0, 0.0)), c = lsHash(i + vec2(0.0, 1.0)), d = lsHash(i + vec2(1.0, 1.0));
          float k1 = b - a, k2 = c - a, k4 = a - b - c + d;
          return vec3(a + k1 * u.x + k2 * u.y + k4 * u.x * u.y, du * (vec2(k1, k2) + k4 * u.yx));
        }
        // gradient (dh/dx, dh/dz) of the water height field
        vec2 lsWaveGrad(vec2 p, float t, float fade) {
          vec2 g = vec2(0.0);
          g += lsNoised(p * 0.9 + vec2(t * 0.22, t * 0.13)).yz * 0.9 * 0.030;
          g += lsNoised(mat2(0.8, -0.6, 0.6, 0.8) * p * 2.3 - vec2(t * 0.31, -t * 0.27)).yz * 2.3 * 0.011;
          g += lsNoised(mat2(0.6, 0.8, -0.8, 0.6) * p * 5.7 + vec2(-t * 0.52, t * 0.46)).yz * 5.7 * 0.0035 * fade;
          g += lsNoised(p * 13.0 + vec2(t * 0.9, t * 0.7)).yz * 13.0 * 0.0011 * fade * fade;
          return g;
        }
        // Tileable water caustic (after joltz0r / Dave Hoskins), 0..~1
        float lsCaustic(vec2 uv, float time) {
          vec2 p = mod(uv * 6.28318, 6.28318) - 250.0;
          vec2 i = p; float c = 1.0; float inten = 0.005;
          for (int n = 0; n < 4; n++) {
            float t = time * (1.0 - (3.5 / float(n + 1)));
            i = p + vec2(cos(t - i.x) + sin(t + i.y), sin(t - i.y) + cos(t + i.x));
            c += 1.0 / length(vec2(p.x / (sin(i.x + t) / inten), p.y / (cos(i.y + t) / inten)));
          }
          c /= 4.0;
          c = 1.17 - pow(c, 1.4);
          return clamp(pow(abs(c), 8.0), 0.0, 3.0);
        }
        float lsRectSD(vec2 q) { return min(min(q.x - uRect.x, uRect.z - q.x), min(q.y - uRect.y, uRect.w - q.y)); }
      `)
      .replace('#include <normal_fragment_maps>', `
        float lsDist = length(vLsWorld - cameraPosition);
        float lsFade = 1.0 - smoothstep(4.0, 22.0, lsDist);
        vec2 lsG = lsWaveGrad(vLsWorld.xz, uTime, lsFade);
        vec3 lsN = normalize(vec3(-lsG.x, 1.0, -lsG.y));
        normal = normalize((viewMatrix * vec4(lsN, 0.0)).xyz);
      `)
      .replace('#include <opaque_fragment>', `
        {
          vec3 V = normalize(vLsWorld - cameraPosition);
          vec3 Nw = lsN;
          float cosV = clamp(dot(-V, Nw), 0.0, 1.0);
          float F = 0.02 + 0.98 * pow(1.0 - cosV, 5.0);
          vec3 Rr = refract(V, Nw, 1.0 / 1.333);
          vec3 P = vec3(vLsWorld.x, uWaterY, vLsWorld.z);
          // basin: floor y = A + b x (deep at west / uRect.x, shallow at east / uRect.z)
          float bS = (uDepth.y - uDepth.x) / (uRect.z - uRect.x);
          float A = uWaterY - uDepth.x - bS * uRect.z;
          float tx = Rr.x > 0.0 ? (uRect.z - P.x) / Rr.x : (uRect.x - P.x) / min(Rr.x, -1e-5);
          float tz = Rr.z > 0.0 ? (uRect.w - P.z) / Rr.z : (uRect.y - P.z) / min(Rr.z, -1e-5);
          float tf = (A + bS * P.x - P.y) / min(Rr.y - bS * Rr.x, -1e-5);
          float t = min(tf, min(tx, tz));
          vec3 H = P + Rr * t;
          vec3 n; vec2 tuv;
          if (t == tf) { n = normalize(vec3(-bS, 1.0, 0.0)); tuv = H.xz; }
          else if (t == tx) { n = vec3(Rr.x > 0.0 ? -1.0 : 1.0, 0.0, 0.0); tuv = vec2(H.z, H.y); }
          else { n = vec3(0.0, 0.0, Rr.z > 0.0 ? -1.0 : 1.0); tuv = vec2(H.x, H.y); }
          vec3 alb = texture2D(uTile, tuv / uTileScale).rgb * uTileTint;
          // lane line on the floor: a darker blue stripe along the pool axis
          if (t == tf) alb *= 1.0 - 0.45 * (1.0 - smoothstep(0.07, 0.09, abs(H.z - 0.5 * (uRect.y + uRect.w)))) * step(uRect.x + 0.6, H.x) * step(H.x, uRect.z - 0.6);

          // ---- sun under water: refracted direction, analytic wall shadow, caustics
          vec3 Ls = refract(-uSunDir, vec3(0.0, 1.0, 0.0), 1.0 / 1.333);          // travel direction (down)
          float sUp = (uWaterY - H.y) / max(-Ls.y, 0.05);
          vec3 Q = H - Ls * sUp;                                                    // entry point at the surface
          float wallLit = smoothstep(-0.02, 0.03, lsRectSD(Q.xz));
          float surfShadow = 1.0;
          #if defined( USE_SHADOWMAP ) && NUM_DIR_LIGHT_SHADOWS > 0
            surfShadow = getShadow( directionalShadowMap[ 0 ], directionalLightShadows[ 0 ].shadowMapSize, directionalLightShadows[ 0 ].shadowIntensity, directionalLightShadows[ 0 ].shadowBias, directionalLightShadows[ 0 ].shadowRadius, vDirectionalShadowCoord[ 0 ] );
          #endif
          float caus = lsCaustic(Q.xz * 0.42 + lsG * 0.6, uTime * 0.55) + 0.6 * lsCaustic(Q.xz * 0.61 + 3.7, uTime * 0.43 + 1.3);
          vec3 Esun = uSunCol * max(dot(n, -Ls), 0.0) * wallLit * surfShadow * exp(-uAbsorb * sUp) * (0.35 + 1.25 * caus);

          // ---- sky light under water (IBL irradiance from above), darker toward the floor corners
          vec3 Esky = vec3(0.35, 0.4, 0.45);
          #ifdef USE_ENVMAP
            Esky = getIBLIrradiance(normalize((viewMatrix * vec4(0.0, 1.0, 0.0, 0.0)).xyz));
          #endif
          Esky *= uAmbientBoost;
          float edgeD = min(lsRectSD(H.xz), H.y - (A + bS * H.x));
          float ao = 0.55 + 0.45 * smoothstep(0.0, 0.45, edgeD);
          float depthH = uWaterY - H.y;
          vec3 Eamb = Esky * (t == tf ? 0.85 : 0.6) * ao * exp(-uAbsorb * depthH * 1.2);

          // ---- underwater lamps (night)
          vec3 Elamp = vec3(0.0);
          float lampDisc = 0.0;
          for (int i = 0; i < 4; i++) {
            vec3 dl = uLamps[i] - H;
            float d2 = dot(dl, dl);
            float dist = sqrt(d2);
            Elamp += uLampCol * max(dot(n, dl / max(dist, 1e-3)), 0.0) / (0.15 + d2) * exp(-uAbsorb * dist);
            lampDisc += 1.0 - smoothstep(0.05, 0.075, dist);
          }
          vec3 floorCol = alb * RECIPROCAL_PI * (Esun + Eamb + Elamp) + uLampCol * lampDisc * 0.06;

          // ---- view path through the water: absorption + in-scattering
          vec3 T = exp(-uAbsorb * t);
          vec3 lampGlow = vec3(0.0);
          for (int i = 0; i < 4; i++) {
            float dd = length(uLamps[i] - (P + Rr * min(t, 1.2) * 0.5));
            lampGlow += uLampCol / (0.6 + dd * dd);
          }
          vec3 inscat = uScatter * (1.0 - T) * RECIPROCAL_PI * (Esky * 0.8 + uSunCol * 0.12 * surfShadow + lampGlow * 0.5);
          vec3 under = floorCol * T + inscat;

          // ---- foam / wet line where the water meets the walls
          float eP = lsRectSD(P.xz);
          float foamN = lsNoise(P.xz * 9.0 + uTime * 0.4) * lsNoise(P.xz * 23.0 - uTime * 0.7);
          float foam = (1.0 - smoothstep(0.0, 0.045, eP + (foamN - 0.3) * 0.03)) * (0.35 + 0.65 * foamN);
          vec3 foamCol = vec3(0.9) * RECIPROCAL_PI * (Esky + uSunCol * max(uSunDir.y, 0.0) * surfShadow);
          under = mix(under, foamCol, clamp(foam * 0.55, 0.0, 1.0));

          outgoingLight += (1.0 - F) * under;
        }
        #include <opaque_fragment>`);
  };
  const geo = new THREE.PlaneGeometry(w, d, 1, 1).rotateX(-Math.PI / 2);
  const water = new THREE.Mesh(geo, mat);
  water.position.set(x0 + w / 2, wy, z0 + d / 2);
  water.name = 'WATER_pool';
  water.receiveShadow = true; water.castShadow = false;
  water.userData.noCollide = true;
  group.add(water);

  // Night glow: one soft cyan PointLight above the water (intensity 0 by day, constant light count).
  const glow = new THREE.PointLight(new THREE.Color(0.35, 0.78, 1.0), 0, 9, 2);
  glow.position.set(x0 + w / 2, wy + 0.35, z0 + d / 2);
  glow.name = 'LS_pool_glow';
  glow.castShadow = false;
  group.add(glow);

  ctx.colliderBoxes.push([x0 + 0.02, wy - 1.5, z0 + 0.02, x1 - 0.02, 2.2, z1 - 0.02]);

  return {
    water, uniforms, glow, band, bandMat,
    update(dt, sun, night) {
      uniforms.uTime.value += dt;
      bandMat.userData.lsUniforms.uTime.value = uniforms.uTime.value;
      if (sun) {
        uniforms.uSunDir.value.copy(sun.position).sub(sun.target.position).normalize();
        uniforms.uSunCol.value.copy(sun.color).multiplyScalar(sun.intensity);
      }
    },
    setNight(k) {
      uniforms.uLampCol.value.setRGB(0.5, 0.88, 1.0).multiplyScalar(3.4 * k);
      glow.intensity = 3.2 * k;
    },
  };
}
