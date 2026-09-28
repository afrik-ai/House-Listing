import * as THREE from 'three';

// P05 contact AO decals: a soft dark blob on the floor under every floor-standing furniture piece
// (sofa, table, bed, dresser, lamp base, chairs), as one InstancedMesh. Screen-space AO alone is too
// weak / too wide at SwiftShader-friendly sample counts to ground feet and bases.
//
// buildContactAO(placed, opts) -> THREE.InstancedMesh | null
//   placed: [{ wrap: Object3D (matrixWorld valid), box: Box3 (wrap-local), floorY, small }]
//   (Furnisher.placed has exactly this shape). Items whose underside is > 0.06 m above floorY
//   (wall-hung, on a surface) and small props are skipped.
//   surfaceY(x, yFrom, z): optional, returns the walkable surface height below (finished floor, rug);
//   the structural floorY can sit under the floor finish, which hides the decal.
// Call again after moving furniture; dispose the old mesh (geometry + material are per call).

let _tex = null;
function blobTexture() {
  if (_tex) return _tex;
  const S = 128, c = document.createElement('canvas');
  c.width = c.height = S;
  const g = c.getContext('2d');
  const img = g.createImageData(S, S);
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    // rounded-rect distance field: 0 inside the inner rect (60%), fading to the edge
    const u = Math.abs((x + 0.5) / S * 2 - 1), v = Math.abs((y + 0.5) / S * 2 - 1);
    const dx = Math.max(0, u - 0.4) / 0.6, dy = Math.max(0, v - 0.4) / 0.6;
    const d = Math.min(1, Math.hypot(dx, dy));
    const a = Math.pow(1 - d, 1.8) * (0.75 + 0.25 * (1 - Math.max(u, v)));
    const i = (y * S + x) * 4;
    img.data[i] = img.data[i + 1] = img.data[i + 2] = Math.round(a * 255); img.data[i + 3] = 255;   // alphaMap reads green
  }
  g.putImageData(img, 0, 0);
  _tex = new THREE.CanvasTexture(c);
  _tex.colorSpace = THREE.NoColorSpace;
  return _tex;
}

const _v = new THREE.Vector3(), _q = new THREE.Quaternion(), _s = new THREE.Vector3(), _p = new THREE.Vector3();
const _e = new THREE.Euler();

export function buildContactAO(placed, { opacity = 0.8, pad = 0.22, maxLift = 0.06, surfaceY = null } = {}) {
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
    list.push({ x: _v.x, z: _v.z, y: (sy ?? Math.max(p.floorY, minY)) + 0.004 /* on the finished floor / rug */, w: w + pad * 2, d: d + pad * 2, yaw: _e.y, k: Math.min(1, 0.45 + h * 0.4) });
  }
  if (!list.length) return null;
  const geo = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
  const mat = new THREE.MeshBasicMaterial({
    color: 0x000000, alphaMap: blobTexture(), transparent: true, opacity, depthWrite: false,
    polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2, toneMapped: false, fog: false,
  });
  mat.name = 'P05_contactAO';
  const im = new THREE.InstancedMesh(geo, mat, list.length);
  im.name = 'P05_contactAO';
  im.castShadow = false; im.receiveShadow = false;
  im.renderOrder = 10;   // after other transparent surfaces (a transparent-sorted floor would paint over it)
  im.userData.cannotReceiveAO = true;
  const M = new THREE.Matrix4();
  list.forEach((b, i) => {
    M.compose(_p.set(b.x, b.y, b.z), _q.setFromEuler(_e.set(0, b.yaw, 0)), _s.set(b.w, 1, b.d));
    im.setMatrixAt(i, M);
  });
  im.instanceMatrix.needsUpdate = true;
  im.frustumCulled = false;
  im.userData.count = list.length;
  return im;
}
