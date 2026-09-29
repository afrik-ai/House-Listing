import * as THREE from 'three';

// P05 contact AO: a soft dark footprint on the floor under every floor-standing furniture piece
// (sofa, table, bed, dresser, lamp base, chairs). Screen-space AO alone is too weak / too wide at
// SwiftShader-friendly sample counts to ground feet and bases.
//
// The footprints are BAKED top-down into one occlusion texture per floor level (bakeContactAO) and
// multiplied into the lighting of every upward-facing surface at that level (patchContactAO: floors,
// rugs), like a lightmap AO term. A blended decal mesh in the scene did not survive this post chain
// (black-over-floor blends never reached the final frame), and a dithered decal read as halftone noise.
//
// buildContactAO(placed, opts) -> THREE.InstancedMesh | null
//   placed: [{ wrap: Object3D (matrixWorld valid), box: Box3 (wrap-local), floorY, small }]
//   (Furnisher.placed has exactly this shape). Items whose underside is > 0.06 m above floorY
//   (wall-hung, on a surface) and small props are skipped.
//   surfaceY(x, yFrom, z): optional, returns the walkable surface height below (finished floor, rug);
//   the structural floorY can sit under the floor finish, which hides the decal.
// Call again after moving furniture; dispose the old mesh (geometry + material are per call).

const _v = new THREE.Vector3(), _q = new THREE.Quaternion(), _s = new THREE.Vector3(), _p = new THREE.Vector3();
const _e = new THREE.Euler();

export function buildContactAO(placed, { opacity = 0.6, pad = 0.3, maxLift = 0.06, surfaceY = null } = {}) {
  const list = [];
  for (const p of placed || []) {
    if (!p?.wrap || !p.box || p.small) continue;
    const m = p.wrap.matrixWorld;
    m.decompose(_p, _q, _s);
    const minY = _p.y + p.box.min.y * _s.y;
    if (p.floorY === undefined || minY - p.floorY > maxLift || minY - p.floorY < -0.2) continue;
    const w = (p.box.max.x - p.box.min.x) * Math.abs(_s.x), d = (p.box.max.z - p.box.min.z) * Math.abs(_s.z);
    const h = (p.box.max.y - p.box.min.y) * Math.abs(_s.y);
    if (w * d < 0.01 || h < 0.05) continue;
    _v.set((p.box.min.x + p.box.max.x) / 2, 0, (p.box.min.z + p.box.max.z) / 2).applyMatrix4(m);
    _e.setFromQuaternion(_q, 'YXZ');
    const sy = surfaceY?.(_v.x, Math.max(p.floorY, minY) + 0.15, _v.z);
    list.push({ x: _v.x, z: _v.z, y: (sy ?? Math.max(p.floorY, minY)) + 0.015 /* on the finished floor / rug */, w: w + pad * 2, d: d + pad * 2, yaw: _e.y, k: Math.min(1, 0.45 + h * 0.4) });
  }
  if (!list.length) return null;
  const geo = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
  // Shade in METRES: full strength inside the footprint, fading to 0 over `pad` beyond it (a texture
  // profile scaled per instance faded out under the piece and was invisible around it).
  const size = new Float32Array(list.length * 2);
  list.forEach((b, i) => { size[i * 2] = b.w; size[i * 2 + 1] = b.d; });
  geo.setAttribute('aSize', new THREE.InstancedBufferAttribute(size, 2));
  const mat = new THREE.ShaderMaterial({
    name: 'P05_contactAO_bake', depthTest: false, depthWrite: false,
    // dst *= (1 - a): overlapping footprints multiply, the target is cleared to white
    blending: THREE.CustomBlending, blendEquation: THREE.AddEquation,
    blendSrc: THREE.ZeroFactor, blendDst: THREE.OneMinusSrcAlphaFactor,
    blendSrcAlpha: THREE.ZeroFactor, blendDstAlpha: THREE.OneFactor,
    uniforms: { uOpacity: { value: opacity }, uPad: { value: pad }, uLevel: { value: 0 } },
    vertexShader: /* glsl */`
      uniform float uLevel; varying vec2 vP; varying vec2 vSize;
      void main() {
        vP = position.xz; vSize = vec2(length(instanceMatrix[0].xyz), length(instanceMatrix[2].xyz));
        vec4 w = modelMatrix * instanceMatrix * vec4(position, 1.0);
        gl_Position = abs(instanceMatrix[3].y - uLevel) > 0.25 ? vec4(2.0, 2.0, 2.0, 1.0) : projectionMatrix * viewMatrix * w;
      }`,
    fragmentShader: /* glsl */`
      uniform float uOpacity; uniform float uPad; varying vec2 vP; varying vec2 vSize;
      void main() {
        vec2 q = abs(vP) * vSize;                       // metres from the centre
        vec2 inner = max(vSize * 0.5 - uPad, vec2(0.0));
        float d = length(max(q - inner, 0.0)) / max(uPad, 1e-3);   // 0 at the footprint edge, 1 at the decal edge
        float a = pow(clamp(1.0 - d, 0.0, 1.0), 1.3) * uOpacity;
        gl_FragColor = vec4(0.0, 0.0, 0.0, a);
      }`,
  });
  const im = new THREE.InstancedMesh(geo, mat, list.length);
  im.name = 'P05_contactAO';
  const M = new THREE.Matrix4();
  list.forEach((b, i) => {
    M.compose(_p.set(b.x, b.y, b.z), _q.setFromEuler(_e.set(0, b.yaw, 0)), _s.set(b.w, 1, b.d));
    im.setMatrixAt(i, M);
  });
  im.instanceMatrix.needsUpdate = true;
  im.frustumCulled = false;
  im.userData.count = list.length;
  const levels = [];   // cluster floor heights (rugs sit a few cm above the slab)
  for (const y of list.map((b) => b.y).sort((x, y) => x - y)) if (!levels.length || y - levels[levels.length - 1] > 0.5) levels.push(y);
  im.userData.levels = levels;
  im.userData.list = list;
  return im;
}

// Bakes the footprints of `im` (from buildContactAO) into one R8 occlusion texture per level.
// Returns [{ y, tex, rect: Vector4(minX, maxZ, sizeX, sizeZ) }] (max 2 levels).
export function bakeContactAO(gl, im, { texel = 0.02, maxSize = 2048 } = {}) {
  const out = [];
  const levels = (im.userData.levels || []).slice(0, 2);
  for (const y of levels) {
    const items = im.userData.list.filter((b) => Math.abs(b.y - y) < 0.25);
    const box = new THREE.Box2();
    for (const b of items) { const r = Math.hypot(b.w, b.d) / 2; box.expandByPoint(new THREE.Vector2(b.x - r, b.z - r)); box.expandByPoint(new THREE.Vector2(b.x + r, b.z + r)); }
    box.expandByScalar(0.5);
    const sx = box.max.x - box.min.x, sz = box.max.y - box.min.y;
    const W = Math.min(maxSize, Math.ceil(sx / texel)), H = Math.min(maxSize, Math.ceil(sz / texel));
    const rt = new THREE.WebGLRenderTarget(W, H, { depthBuffer: false, magFilter: THREE.LinearFilter, minFilter: THREE.LinearFilter });
    const cam = new THREE.OrthographicCamera(-sx / 2, sx / 2, sz / 2, -sz / 2, 0.1, 100);
    cam.position.set((box.min.x + box.max.x) / 2, y + 50, (box.min.y + box.max.y) / 2);
    cam.up.set(0, 0, -1); cam.lookAt(cam.position.x, y, cam.position.z); cam.updateMatrixWorld(); cam.updateProjectionMatrix();
    const scene = new THREE.Scene(); const parent = im.parent; scene.add(im);
    im.material.uniforms.uLevel.value = y;
    const prevRT = gl.getRenderTarget(), prevColor = gl.getClearColor(new THREE.Color()), prevAlpha = gl.getClearAlpha(), prevTM = gl.toneMapping;
    gl.toneMapping = THREE.NoToneMapping;
    gl.setRenderTarget(rt); gl.setClearColor(0xffffff, 1); gl.clear(true, false, false);
    gl.render(scene, cam);
    gl.setRenderTarget(prevRT); gl.setClearColor(prevColor, prevAlpha); gl.toneMapping = prevTM;
    if (parent) parent.add(im); else scene.remove(im);
    out.push({ y, tex: rt.texture, rt, rect: new THREE.Vector4(box.min.x, box.max.y, sx, sz) });
  }
  return out;
}

// Shared uniforms for every patched material (updated in place when the bake is redone).
export const CAO_UNIFORMS = {
  p05CAO0: { value: null }, p05CAO1: { value: null },
  p05CAOR0: { value: new THREE.Vector4(0, 0, 1, 1) }, p05CAOR1: { value: new THREE.Vector4(0, 0, 1, 1) },
  p05CAOY: { value: new THREE.Vector2(-999, -999) }, p05CAOK: { value: 1 },
};
let _white = null;
export function setContactAO(bakes) {
  _white ||= new THREE.DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1);
  _white.needsUpdate = true;
  const b0 = bakes[0], b1 = bakes[1];
  CAO_UNIFORMS.p05CAO0.value = b0?.tex || _white; CAO_UNIFORMS.p05CAO1.value = b1?.tex || _white;
  if (b0) CAO_UNIFORMS.p05CAOR0.value.copy(b0.rect);
  if (b1) CAO_UNIFORMS.p05CAOR1.value.copy(b1.rect);
  CAO_UNIFORMS.p05CAOY.value.set(b0 ? b0.y : -999, b1 ? b1.y : -999);
}

// Multiplies the baked occlusion into upward-facing surfaces at a level (floor finish, rugs).
export function patchContactAO(m) {
  if (!m?.isMeshStandardMaterial || m.userData.p05cao) return false;
  if (!CAO_UNIFORMS.p05CAO0.value) setContactAO([]);
  m.userData.p05cao = true;
  const prev = m.onBeforeCompile, prevKey = m.customProgramCacheKey;
  m.onBeforeCompile = function (sh, r) {
    if (prev) prev.call(this, sh, r);
    Object.assign(sh.uniforms, CAO_UNIFORMS);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vP05W; varying float vP05Ny;')
      .replace('#include <worldpos_vertex>', `#include <worldpos_vertex>
        #ifdef USE_INSTANCING
          vP05W = (modelMatrix * instanceMatrix * vec4(transformed, 1.0)).xyz; vP05Ny = normalize(mat3(modelMatrix) * mat3(instanceMatrix) * objectNormal).y;
        #else
          vP05W = (modelMatrix * vec4(transformed, 1.0)).xyz; vP05Ny = normalize(mat3(modelMatrix) * objectNormal).y;
        #endif`);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
        varying vec3 vP05W; varying float vP05Ny;
        uniform sampler2D p05CAO0; uniform sampler2D p05CAO1; uniform vec4 p05CAOR0; uniform vec4 p05CAOR1; uniform vec2 p05CAOY; uniform float p05CAOK;
        float p05Cao() {
          if (vP05Ny < 0.7) return 1.0;
          vec4 r; float c = 1.0;
          if (abs(vP05W.y - p05CAOY.x) < 0.09) { r = p05CAOR0; vec2 uv = vec2((vP05W.x - r.x) / r.z, (r.y - vP05W.z) / r.w); if (uv == clamp(uv, 0.0, 1.0)) c = texture2D(p05CAO0, uv).r; }
          else if (abs(vP05W.y - p05CAOY.y) < 0.09) { r = p05CAOR1; vec2 uv = vec2((vP05W.x - r.x) / r.z, (r.y - vP05W.z) / r.w); if (uv == clamp(uv, 0.0, 1.0)) c = texture2D(p05CAO1, uv).r; }
          return mix(1.0, c, p05CAOK);
        }`)
      .replace('#include <aomap_fragment>', `#include <aomap_fragment>
        { float p05c = p05Cao(); reflectedLight.indirectDiffuse *= p05c; reflectedLight.directDiffuse *= mix(1.0, p05c, 0.7); reflectedLight.indirectSpecular *= p05c; }`);
  };
  m.customProgramCacheKey = function () { return (prevKey ? prevKey.call(this) : '') + '|p05cao'; };
  m.needsUpdate = true;
  return true;
}
