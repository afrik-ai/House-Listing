import * as THREE from 'three';
import { applySurface, applyHideBoxes } from './textures.js';

// P06 — interior surface definitions (floors, walls, ceilings, tiles, trim, stair).
// All floors/walls are WORLD-space procedural surfaces (see textures.js applySurface): exact scale,
// continuous across rooms, no texture repetition. Rooms/levels come from houses/villa-nova/house.json.

const G = 0.0;     // ground floor finished level
const F1 = 3.15;   // first floor finished level

// --- shared texture bundles -------------------------------------------------------------------
const plaster = async (tex) => (await tex('plaster_white_int', { maps: ['normal'] })).normalMap;
const set = async (tex, name, maps = ['color', 'normal', 'roughness'], maxSize = 0) => {
  const t = await tex(name, { maps, maxSize });
  return { color: t.map, normal: t.normalMap, roughness: t.roughnessMap };
};

// --- paint ------------------------------------------------------------------------------------
const WALL_PAINT = { paintColor: 0xefebe4, paintRough: 0.9, paintNormalK: 0.6, paintScale: 1.1, macro: [0.04, 3.5, 0.05] };
const CEIL_PAINT = { paintColor: 0xf3f2ef, paintRough: 0.93, paintNormalK: 0.35, paintScale: 1.3, macro: [0.03, 4.0, 0.04], grime: [0, 0, 0] };

// --- glazed white wall tiles --------------------------------------------------------------------
async function wallTiles(tex, name, { tile, stagger = 0, origin, floorY, zones, gloss = true, tint = [0.86, 0.86, 0.845] }) {
  const m = new THREE.MeshPhysicalMaterial({
    name, metalness: 0, clearcoat: gloss ? 1 : 0.35, clearcoatRoughness: gloss ? 0.05 : 0.18,
  });
  return applySurface(m, {
    mode: 'grid', sample: 'flat', glazeNormal: true,
    maps: { plaster: await plaster(tex) },
    tile, stagger, origin, floorY, zones,
    grout: 0.0035, groutColor: [0.42, 0.415, 0.40], groutRough: 0.92, bevel: 0.003, ao: 0.65,
    tint, tintVar: 0.06, normalK: 0.22, roughRange: gloss ? [0.16, 0.16] : [0.3, 0.3], roughVar: 0.14,
    coat: 1,
    ...WALL_PAINT,
  });
}

// --- oak ----------------------------------------------------------------------------------------
// oak_plank texture (Poly Haven laminate_floor_03): 11 board columns per 2048 px, first groove at
// x = 99 px, pitch 186.2 px -> 0.19 m boards when one repeat = 2.09 m.
const OAK = {
  mode: 'plank', cells: 11, texOffset: 99 / 186.18, texLen: 0.19 * 11,
  sat: 0.64, tint: [1.42, 1.38, 1.28], texMean: 0.19, tintVar: 0.07,
  roughRange: [0.46, 0.46], roughLumK: 1.1, roughVar: 0.07, normalK: 0.6,
  macro: [0.05, 2.2, 0.05],
};

export const definitions = {
  // Wide-plank natural oak, 190 mm boards running east-west, satin lacquer.
  oak_plank: async (tex) => applySurface(new THREE.MeshStandardMaterial({ name: 'oak_plank', metalness: 0 }), {
    ...OAK, maps: await set(tex, 'oak_plank', ['color', 'normal']), tile: [0.19, 1], inset: 0,
    grainAxis: [1, 0, 0], origin: [0, 0.15], seedRise: 3.0,
  }),

  // Solid oak treads, glued from 135 mm staves, grain along the tread (z); one random set per tread.
  stair_tread: async (tex) => applySurface(new THREE.MeshStandardMaterial({ name: 'stair_tread', metalness: 0 }), {
    ...OAK, maps: await set(tex, 'oak_plank', ['color', 'normal']), tile: [0.135, 1], inset: 0.1, tintVar: 0.1,
    grainAxis: [0, 0, 1], origin: [9.02, 0], seedRise: 0.185,
  }),

  // 600x1200 concrete-look porcelain, 1/3 bond, 2 mm grout (hall, vestibule, kitchen, baths, storage).
  large_format_tile_grey: async (tex) => applySurface(new THREE.MeshStandardMaterial({ name: 'large_format_tile_grey', metalness: 0 }), {
    mode: 'grid', sample: 'offset', maps: await set(tex, 'concrete_smooth_light', ['color', 'normal']),
    tile: [1.2, 0.6], stagger: 1 / 3, grout: 0.002, origin: [1.56, 2.66], texLen: 3.0,
    sat: 1, contrast: 1.3, texMean: 0.48, tint: [0.70, 0.685, 0.655], tintVar: 0.07, normalK: 0.07,
    roughRange: [0.44, 0.44], roughVar: 0.06, groutColor: [0.19, 0.185, 0.175], groutRough: 0.92, bevel: 0.0015, ao: 0.5,
    macro: [0.03, 4.0, 0.03],
  }),

  // 600x600 light limestone (terrace, balcony, entrance): random cells of the 6x6 texture, rotated.
  large_format_tile_light: async (tex) => applySurface(new THREE.MeshStandardMaterial({ name: 'large_format_tile_light', metalness: 0 }), {
    mode: 'grid', sample: 'cells', rot90: true, maps: await set(tex, 'limestone_tile_light', undefined, { normal: 1024, roughness: 1024 }),
    tile: [0.6, 0.6], cells: 6, inset: 0.014, grout: 0.003, origin: [-2.6, -0.15],
    sat: 0.62, tint: [1.12, 1.12, 1.14], texMean: 0.36, tintVar: 0.05, normalK: 1.0,
    roughRange: [0.5, 0.82], roughVar: 0.05, groutColor: [0.30, 0.285, 0.26], groutRough: 0.95, bevel: 0.002, ao: 0.5,
    macro: [0.04, 3.0, 0.04], gridVertical: 0,
  }),

  // 100x100 white glazed mosaic floor (WC; bath3 has its own origin below).
  small_tile_white: async (tex) => smallTile(tex, 'small_tile_white', [0.15, 2.66]),
  small_tile_white_bath3: async (tex) => smallTile(tex, 'small_tile_white_bath3', [9.26, 2.66]),

  // Sealed concrete with saw-cut control joints every 2.9 m (garage, boiler, entrance steps, plinth).
  concrete_screed: async (tex) => applySurface(new THREE.MeshStandardMaterial({ name: 'concrete_screed', metalness: 0 }), {
    mode: 'grid', sample: 'offset', maps: await set(tex, 'concrete_screed', undefined, 1024),
    tile: [2.9, 2.9], grout: 0.004, origin: [7.75, -3.08], texLen: 2.0, gridVertical: 0,
    sat: 0.55, contrast: 1.25, texMean: 0.31, tint: [0.92, 0.92, 0.93], tintVar: 0.06, normalK: 0.7,
    roughRange: [0.3, 0.8], roughVar: 0.06, groutColor: [0.06, 0.06, 0.06], groutRough: 0.95, bevel: 0.0, ao: 0.7,
    macro: [0.06, 3.0, 0.06],
  }),

  // Warm-white matte paint with a faint plaster/roller texture.
  wall_int: async (tex) => applySurface(new THREE.MeshStandardMaterial({ name: 'wall_int', metalness: 0 }), {
    mode: 'paint', maps: { plaster: await plaster(tex) }, ...WALL_PAINT,
  }),
  ceiling: async (tex) => applySurface(new THREE.MeshStandardMaterial({ name: 'ceiling', metalness: 0 }), {
    mode: 'paint', maps: { plaster: await plaster(tex) }, ...CEIL_PAINT,
  }),

  // Tiled bathroom walls (per room, see overrides).
  wall_tile_bath_master: (tex) => wallTiles(tex, 'wall_tile_bath_master', { tile: [0.6, 0.3], origin: [0.15, 0.15], floorY: F1, gloss: false, tint: [0.84, 0.835, 0.815] }),
  wall_tile_bath2: (tex) => wallTiles(tex, 'wall_tile_bath2', { tile: [0.6, 0.3], origin: [6.06, 0.15], floorY: F1, gloss: false, tint: [0.84, 0.835, 0.815] }),
  wall_tile_bath3: (tex) => wallTiles(tex, 'wall_tile_bath3', { tile: [0.15, 0.075], stagger: 0.5, origin: [9.26, 2.66], floorY: F1 }),
  wall_tile_wc: (tex) => wallTiles(tex, 'wall_tile_wc', {
    tile: [0.15, 0.075], stagger: 0.5, origin: [0.15, 2.66], floorY: G,
    zones: [[[0.0, -0.1, 2.55], [1.56, 1.2, 4.9]]],
  }),
  // Kitchen: 100x300 gloss splashback between worktop (0.90) and wall units (1.50) on the EAST wall.
  wall_kitchen: (tex) => wallTiles(tex, 'wall_kitchen', {
    tile: [0.3, 0.1], stagger: 0, origin: [8.11, 6.52], floorY: G,
    zones: [[[11.7, 0.9, 6.4], [11.95, 1.5, 10.4]]],
  }),

  // 80 mm white MDF skirting, satin; hidden in the fully tiled bathrooms / WC.
  skirting_white: async () => applyHideBoxes(new THREE.MeshStandardMaterial({ name: 'skirting_white', color: 0xf1f0ec, roughness: 0.42, metalness: 0 }), [
    [[0.0, F1 - 0.1, 0.0], [3.37, F1 + 0.3, 2.6]],     // bath_master
    [[6.0, F1 - 0.1, 0.0], [11.0, F1 + 0.3, 2.6]],     // bath2
    [[9.2, F1 - 0.1, 2.6], [11.0, F1 + 0.3, 4.82]],    // bath3
    [[0.0, G - 0.1, 2.6], [1.5, G + 0.3, 4.82]],       // wc
  ]),
  // Flush door leaves and chamfered casings: satin white lacquer.
  door_leaf_white: async () => new THREE.MeshStandardMaterial({ name: 'door_leaf_white', color: 0xf2f1ed, roughness: 0.34, metalness: 0 }),
  // Door handles + stair handrail: black powder-coated steel.
  int_metal_black: async () => new THREE.MeshStandardMaterial({ name: 'int_metal_black', color: 0x0b0b0c, roughness: 0.42, metalness: 0.5 }),
};

function smallTile(tex, name, origin) {
  return (async () => {
    const m = new THREE.MeshPhysicalMaterial({ name, metalness: 0, clearcoat: 0.7, clearcoatRoughness: 0.12 });
    return applySurface(m, {
      mode: 'grid', sample: 'flat', glazeNormal: true, maps: { plaster: await plaster(tex) },
      tile: [0.1, 0.1], grout: 0.0035, origin,
      tint: [0.79, 0.79, 0.775], tintVar: 0.04, normalK: 0.15, roughRange: [0.26, 0.26], roughVar: 0.14,
      groutColor: [0.34, 0.335, 0.32], groutRough: 0.92, bevel: 0.003, coat: 1, ao: 0.65, macro: [0.012, 2.0, 0.02],
    });
  })();
}

// Node-level overrides (first match wins). `node` is tested against the mesh and its ancestors.
export const overrides = [
  { node: /^HANDRAIL$/, material: 'handrail_black', use: 'int_metal_black' },
  { node: /^LEAF_(?!D_front)/, material: 'handrail_black', use: 'int_metal_black' },
  { node: /^WALL_bath_master$/, use: 'wall_tile_bath_master' },
  { node: /^WALL_bath2$/, use: 'wall_tile_bath2' },
  { node: /^WALL_bath3$/, use: 'wall_tile_bath3' },
  { node: /^WALL_wc$/, use: 'wall_tile_wc' },
  { node: /^WALL_kitchen$/, use: 'wall_kitchen' },
  { node: /^SURF_small_tile_white_bath3$/, use: 'small_tile_white_bath3' },
];
