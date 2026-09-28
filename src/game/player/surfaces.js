import * as THREE from 'three';
// Maps house floor types (house.json `floor`, glTF `surface` extras, landscape zones) to the seven
// footstep categories P11 audio plays: wood | tile | stone | grass | gravel | carpet | metal.
const RULES = [
  [/carpet|rug|wool/i, 'carpet'],
  [/gravel|pebble|shingle/i, 'gravel'],
  [/grass|lawn|turf|garden|soil|planting/i, 'grass'],
  [/metal|steel|grate|iron|alu/i, 'metal'],
  [/oak|wood|plank|parquet|larch|timber|deck|tread|stair/i, 'wood'],
  [/tile|ceramic|porcelain|marble|terrazzo/i, 'tile'],
  [/stone|concrete|screed|paver|paving|slab|asphalt|drive|gabion|step/i, 'stone'],
];

export function footstepSurface(type) {
  if (!type) return 'stone';
  for (const [re, cat] of RULES) if (re.test(type)) return cat;
  return 'stone';
}

// What the player is standing on, from the VISIBLE floor: a short downward ray against the house and
// landscape meshes. Decals / transparent / contact-shadow overlays are skipped. Type priority:
// Everything in the scene is tested (rugs count as carpet). glTF `surface` extra -> SURF_<type> name -> material name -> object name (LS_deck etc.).
// Falls back to house.surfaceAt(). Returns { type, surface }.
const _rc = new THREE.Raycaster();
const _o = new THREE.Vector3(), _d = new THREE.Vector3(0, -1, 0);
const LS_MAP = { deck: 'limestone_tile', stone: 'stone_path', concrete: 'concrete', coping: 'concrete_coping', asphalt: 'asphalt', gravel: 'gravel', lawn: 'grass', meadow: 'grass', mulch: 'soil', rug: 'carpet' };

function typeOf(o) {
  const n = o.name || '';
  const m = [].concat(o.material)[0];
  if (o.userData?.surface) return o.userData.surface;
  if (o.parent?.userData?.surface) return o.parent.userData.surface;
  if (n.startsWith('SURF_')) return n.slice(5);
  const ls = /^LS_([a-z]+)/i.exec(n);
  if (ls && LS_MAP[ls[1].toLowerCase()]) return LS_MAP[ls[1].toLowerCase()];
  return m?.name || n || null;
}

function skip(o) {
  if (!o.visible || !o.isMesh || o.isInstancedMesh) return true;
  const m = [].concat(o.material)[0];
  if (!m || m.transparent || m.depthWrite === false || m.visible === false) return true;
  return /contactAO|decal|shadow|water|grass_blades|grass_clump|hedge_cards/i.test((o.name || '') + ' ' + (m.name || ''));
}

export function floorSurfaceAt(game, feet) {
  const roots = (game.scene?.children || []).filter((o) => !o.isLight && !o.isCamera);
  _o.set(feet.x, feet.y + 0.3, feet.z);
  _rc.set(_o, _d); _rc.near = 0; _rc.far = 0.7;
  let type = null;
  if (roots.length) {
    const hits = _rc.intersectObjects(roots, true);
    for (const h of hits) { if (skip(h.object)) continue; type = typeOf(h.object); if (type) break; }
  }
  if (!type) { try { type = game.house?.surfaceAt(feet) || 'stone'; } catch { type = 'stone'; } }
  return { type, surface: footstepSurface(type) };
}
