import * as THREE from 'three';

// P05 shadow helpers.
//
// 1) Contact-hardening sun shadows (PCSS-style) on top of three's PCF path, installed once by patching
//    ShaderChunk.shadowmap_pars_fragment before any program compiles. three r186 PCF = 5 Vogel taps
//    rotated by interleaved gradient noise, which reads grainy at radius > 1.5 texels.
//    * A light whose shadow.radius is NEGATIVE uses the contact-hardening path: |radius| = shadow-map
//      texels per metre. The blocker search uses hardware comparisons at three depth offsets (the
//      comparison sampler cannot return raw depth), which gives a piecewise blocker-distance estimate;
//      penumbra = distance x tan(SUN_SOFT_ANGLE). Needs the ortho camera depth range == SUN_DEPTH.
//    * Positive radius (spot lights): 10-tap Vogel PCF (smoother than the stock 5 taps).
// 2) fitSunShadow(): fits the sun's orthographic shadow camera to a receiver box, pushes the near
//    plane toward the sun so off-box casters still cast, and snaps the frustum to the texel grid.
export const SUN_DEPTH = 120;            // metres between the sun shadow camera near and far planes
export const SUN_SOFT_TAN = 0.03;        // tan(~1.7 deg): effective sun + sky softening (real sun 0.26 deg)
const D1 = 0.35, D2 = 1.4;               // blocker distance bands (m)
const L0 = 0.1, L1 = 0.8, L2 = 2.6;      // representative blocker distance per band (m)
const MAX_BLOCKER = 3.2;                 // search disc covers the penumbra of blockers up to this far

const GLSL = /* glsl */`
		float getShadow( sampler2DShadow shadowMap, vec2 shadowMapSize, float shadowIntensity, float shadowBias, float shadowRadius, vec4 shadowCoord ) {

			float shadow = 1.0;
			shadowCoord.xyz /= shadowCoord.w;
			shadowCoord.z += shadowBias;
			bool inFrustum = shadowCoord.x >= 0.0 && shadowCoord.x <= 1.0 && shadowCoord.y >= 0.0 && shadowCoord.y <= 1.0;
			bool frustumTest = inFrustum && shadowCoord.z <= 1.0;

			if ( frustumTest ) {

				vec2 texelSize = vec2( 1.0 ) / shadowMapSize;
				float phi = interleavedGradientNoise( gl_FragCoord.xy ) * PI2;

				if ( shadowRadius < 0.0 ) {

					// P05 contact-hardening sun shadow
					float tpm = - shadowRadius;
					float searchR = max( 2.0, ${(SUN_SOFT_TAN * MAX_BLOCKER).toFixed(4)} * tpm );
					float nAny = 0.0; float nMid = 0.0; float nFar = 0.0;
					for ( int i = 0; i < 8; i ++ ) {
						vec2 uv = shadowCoord.xy + vogelDiskSample( i, 8, phi ) * searchR * texelSize;
						nAny += 1.0 - texture( shadowMap, vec3( uv, shadowCoord.z ) );
						nMid += 1.0 - texture( shadowMap, vec3( uv, shadowCoord.z - ${(D1 / SUN_DEPTH).toExponential(6)} ) );
						nFar += 1.0 - texture( shadowMap, vec3( uv, shadowCoord.z - ${(D2 / SUN_DEPTH).toExponential(6)} ) );
					}
					if ( nAny < 0.02 ) return 1.0;
					if ( nAny > 7.98 && nFar < 0.02 ) return mix( 1.0, 0.0, shadowIntensity );
					float dEst = ( nAny * ${L0.toFixed(3)} + nMid * ${(L1 - L0).toFixed(3)} + nFar * ${(L2 - L1).toFixed(3)} ) / nAny;
					float r = max( 1.3, dEst * ${SUN_SOFT_TAN.toFixed(4)} * tpm );
					float s = 0.0;
					for ( int i = 0; i < 12; i ++ ) {
						s += texture( shadowMap, vec3( shadowCoord.xy + vogelDiskSample( i, 12, phi ) * r * texelSize, shadowCoord.z ) );
					}
					shadow = s / 12.0;

				} else {

					float radius = max( shadowRadius, 1.0 ) * texelSize.x;
					float s = 0.0;
					for ( int i = 0; i < 10; i ++ ) {
						s += texture( shadowMap, vec3( shadowCoord.xy + vogelDiskSample( i, 10, phi ) * radius, shadowCoord.z ) );
					}
					shadow = s * 0.1;

				}

			}

			return mix( 1.0, shadow, shadowIntensity );

		}
`;

let installed = null;
export function installShadowChunk() {
  if (installed !== null) return installed;
  const src = THREE.ShaderChunk.shadowmap_pars_fragment;
  const start = src.indexOf('float getShadow( sampler2DShadow shadowMap');
  const end = src.indexOf('#elif defined( SHADOWMAP_TYPE_VSM )', start);
  if (start < 0 || end < 0) {
    console.warn('[lighting] shadow chunk layout changed; keeping stock PCF');
    return (installed = false);
  }
  THREE.ShaderChunk.shadowmap_pars_fragment = src.slice(0, start) + GLSL.trim() + '\n\n\t' + src.slice(end);
  return (installed = true);
}
export const contactHardening = () => installed === true;

const _m = new THREE.Matrix4();
const _v = new THREE.Vector3();
const _x = new THREE.Vector3(), _y = new THREE.Vector3(), _z = new THREE.Vector3();
const UP = new THREE.Vector3(0, 1, 0), ALT_UP = new THREE.Vector3(0, 0, -1);

// Fits `light` (DirectionalLight, castShadow) to `box` for direction `dir` (unit, toward the light).
// casterReach: how far beyond the box (toward the light) casters are still captured.
// Returns {size, texel} (metres).
export function fitSunShadow(light, box, dir, casterReach = 40) {
  const cam = light.shadow.camera;
  const mapSize = light.shadow.mapSize.x;
  const center = box.getCenter(new THREE.Vector3());
  const up = Math.abs(dir.y) > 0.995 ? ALT_UP : UP;
  // Basis exactly as the shadow camera will have it (Object3D.lookAt from the light to its target).
  _m.lookAt(dir, new THREE.Vector3(0, 0, 0), up);  // camera looks along -dir
  _x.setFromMatrixColumn(_m, 0); _y.setFromMatrixColumn(_m, 1); _z.setFromMatrixColumn(_m, 2);  // _z == dir
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity, minZ = Infinity, maxZ = -Infinity;
  for (let i = 0; i < 8; i++) {
    _v.set(i & 1 ? box.max.x : box.min.x, i & 2 ? box.max.y : box.min.y, i & 4 ? box.max.z : box.min.z).sub(center);
    const px = _v.dot(_x), py = _v.dot(_y), pz = _v.dot(_z);
    minX = Math.min(minX, px); maxX = Math.max(maxX, px);
    minY = Math.min(minY, py); maxY = Math.max(maxY, py);
    minZ = Math.min(minZ, pz); maxZ = Math.max(maxZ, pz);
  }
  // Square frustum (uniform texels), padded by 4 texels for the PCF kernel, centred on the box.
  let size = Math.max(maxX - minX, maxY - minY);
  const texel = size / (mapSize - 8);
  size = texel * mapSize;
  const cx = (minX + maxX) / 2, cy = (minY + maxY) / 2;
  // Snap the frustum origin to the texel grid (world-stable shadow edges when the fit changes).
  const ox = center.dot(_x) + cx, oy = center.dot(_y) + cy;
  const sx = Math.round(ox / texel) * texel - center.dot(_x);
  const sy = Math.round(oy / texel) * texel - center.dot(_y);
  const target = center.clone().addScaledVector(_x, sx).addScaledVector(_y, sy);
  const dist = maxZ + casterReach;
  light.position.copy(target).addScaledVector(dir, dist);
  light.target.position.copy(target);
  light.target.updateMatrixWorld();
  light.updateMatrixWorld();
  cam.left = -size / 2; cam.right = size / 2; cam.bottom = -size / 2; cam.top = size / 2;
  cam.near = 0.5;
  cam.far = cam.near + SUN_DEPTH;
  if (dist - minZ > SUN_DEPTH - 1) cam.far = dist - minZ + 1;   // (breaks contact-hardening scale; never happens for a house)
  cam.updateProjectionMatrix();
  return { size, texel, far: cam.far };
}
