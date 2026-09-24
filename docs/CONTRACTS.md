# Cross-module contracts (append-only; each agent adds its own section)

## Game events (src/game/Game.js)
- `game.on('ready')`, `game.on('room-enter', {id,name,level})`, `game.on('interact', {target,type})`,
  `game.on('tod', mode)`, `game.on('quality', tier)`, `game.on('footstep', {surface})`, `game.on('pause', bool)`.
- `game.player`, `game.house`, `game.lighting`, `game.audio`, `game.hud`, `game.renderer`, `game.scene`, `game.camera`.

## House GLB metadata (public/assets/houses/<id>/house.glb + house.meta.json)
- Node naming: `ROOM_<id>` (empty at room center), `DOOR_<id>` (pivot at hinge, child mesh), `LIGHT_<id>` (empty + type),
  `COL_*` (invisible collision meshes), `SPAWN` (player start), `SURF_<type>` prefix on floor meshes for footsteps.
- house.meta.json: `{rooms:[...], doors:[...], lights:[...], spawn:{pos,yaw}, bounds}`.
- Coordinates: see `houses/villa-nova/house.json` `coords`. glTF export must use Y-up (Blender exporter default).

## P01 — Foundation & engine API (src/engine/*, src/game/{Game,main,Player,House,ProceduralHouse}.js, src/ui/Loading.js)

### Boot
- `house.html?id=<houseId>[&quality=low|medium|high|ultra][&tod=day|golden_hour|night][&harness=1]`.
  `harness` (default: `navigator.webdriver`) skips the title screen/pointer lock; the game starts in `playing`.
- `House.load()`: if `/assets/houses/<id>/house.glb` exists (1-byte ranged GET; Vite's HTML fallback = missing) it loads the
  GLB (+ `house.meta.json` if present), else builds `ProceduralHouse` from `houses/<id>/house.json` (fallback only).
  Draco (`/draco/`), KTX2 (`/basis/`) and Meshopt decoders are wired in `Loader`.
- `game.ready` / `__game.ready` resolve after: house + current-TOD HDRI/PMREM + all loader tasks + `compileAsync` + 2 frames.

### Game object (`window.__game.game`)
- Members: `renderer` (engine/Renderer: `.gl` WebGLRenderer, `.tier`, `.settings`, `onQuality(fn)`, `onResize(fn)`,
  `applyAnisotropy(obj)`), `scene`, `camera` (Perspective, vfov 62, rotation order YXZ, added to scene),
  `loader` (engine/Loader: `loadGLTF`, `loadTexture(url,{colorSpace,repeat})` (cached), `loadHDRI`, `json`, `exists`,
  `track(label, promise)` to join the loading bar), `postfx`, `physics`, `lighting`, `house`, `player`,
  optional `interaction` / `audio` / `hud` / `menus`.
- `state`: `'loading' | 'attract' | 'playing' | 'paused'`. Methods: `enter()`, `pause()`, `resume()`, `teleport()`,
  `setTimeOfDay(mode)` (Promise), `setQuality(tier)`, `hideUI(bool)`, `move(dir,s)` (Promise), `interact()`,
  `rooms()`, `views()`, `stats()`, `benchmark(n)`, `renderFrame(dt)`.
- Loop: fixed 120 Hz simulation (`player.update(1/120)`, emits `step`), render interpolation of the camera position,
  then per rendered frame: every optional module's `update(dt)`, `lighting.update(dt)`, emit `update`, render.
- Optional modules are auto-loaded when the file exists (import.meta.glob): `src/game/Interact.js` (export `Interact`
  -> `game.interaction`; if it has `interact()`, `__game.interact()` calls it), `src/game/Audio.js` (`Audio` -> `game.audio`),
  `src/ui/HUD.js` (`HUD` -> `game.hud`), `src/ui/Menus.js` (`Menus` -> `game.menus`). Shape:
  `class X { constructor(game); async init?(); update?(dt); dispose?() }` (or default export).

### Plugins (src/game/plugins/*.js) � the extension point for wave-2 pieces
- Every `src/game/plugins/*.js` is auto-loaded (import.meta.glob), **sorted by filename** (prefix `10_`, `20_` � to order).
- Shape: `export class Plugin { constructor(game); async init?(); update?(dt); onTimeOfDay?(mode); onQuality?(tier); dispose?() }`
  (or `export default` of that shape). Instances: `game.plugins.get('<filename without .js>')`.
- Order of boot: house loaded + current-TOD lighting ready + `lighting.buildFixtures` + physics colliders set + player
  spawned -> optional modules (Interact/Audio/HUD/Menus) -> **plugins: constructor, then `await init()`** (each init is
  joined to the loading bar via `loader.track('plugin <name>')`; use `game.loader.*` inside init so downloads show too)
  -> shader precompile -> first frames -> `ready`. So a plugin can add meshes/materials in `init()` and they are
  compiled before the player sees them.
- `update(dt)` runs every rendered frame after the fixed-step simulation; `onTimeOfDay(mode)` after the environment for
  the new mode is in place; `onQuality(tier)` after the tier settings are applied. Exceptions are caught and logged
  (a broken plugin never blocks boot).
- If a plugin adds collidable static geometry after boot, call
  `game.physics.setColliders([...game.house.colliders, game.lighting.ground, ...yourMeshes])`.

### Events (in addition to the list above)
- `progress {fraction, bytes, total, items, done, label}` during load; `ready`; `error`.
- `enter` (player clicked in), `pause bool` (pointer lock lost/regained while playing; if no Menus module exists the
  loading screen shows a "click to resume" gate), `pointerlock bool`, `hideui bool`, `step dt` (fixed), `update dt`.
- `room-enter {id,name,level}` — `{id:'outside'}` when leaving all rooms; 5 Hz check on feet position.
- `footstep {surface, sprint}` every 0.72 m (0.95 m sprinting) on the ground; `surface` = house.json floor type
  (`oak_plank`, `large_format_tile_grey`, …, `grass`). P08/P11 may take over by setting `player.emitsFootsteps = true`.
- `tod mode`, `quality tier`, `interact {target, type, distance}` (fallback raycast: nearest `DOOR_*`/`LIGHT_*` ancestor).

### House
- `house.rooms()` -> `[{id,name,level,center,eye,rect(bbox),rects,main,area,axis}]` (supports L-shaped `rects`).
- `house.roomAt(feetPos)`, `house.surfaceAt(feetPos)`, `house.exteriors()`, `house.spawn {pos(feet),yaw}`,
  `house.bounds` (Box3 of the building, used for the sun shadow frustum), `house.doors`, `house.lights`, `house.surfaces`.
- Collision: `COL_*` meshes if any exist, else every visible mesh except `userData.noCollide` / `WATER_*`.
  `userData.colliderOnly = true` = invisible, collides (e.g. stair ramps). Spawn priority: meta.spawn > `SPAWN` node > house.json `spawn`.

### Lighting / colour pipeline (engine/Lighting.js, engine/PostFX.js)
- TOD = HDRI (`/assets/hdri/<name>_<1k|2k>.hdr`) as background + PMREM IBL, rotated so the HDRI's detected sun sits at
  the preset azimuth (day 215°, golden 245°, night 140°; 0 = north/-Z, 90 = east/+X). The sun disc is clamped out of
  the IBL copy and re-emitted as the shadow-casting `lighting.sun` with the MEASURED irradiance (no double sun).
- Eye adaptation: inside a room (`roomAt`) the IBL is scaled down, hemi "bounce" fill and exposure go up, white balance
  warms (eases ~0.45 s; snaps on teleport). `lighting.setInterior(bool, snap)`.
- Night fixtures: one warm PointLight per room (>2.5 m²) + house.json exterior fixtures, intensity 0 by day (constant light
  count -> no shader recompiles). P05 may replace via `LIGHT_*` nodes (then used instead) or `lighting.buildFixtures(house)`.
- Tone mapping happens ONCE in PostFX (`ToneMappingEffect`, ACES by default; `postfx.setToneMapping('agx'|'aces'|'neutral')`),
  reading `renderer.gl.toneMappingExposure`; the last pass encodes sRGB. Never set N8AO `gammaCorrection` true.
  Materials: colour textures `SRGBColorSpace`, data maps (normal/roughness/ao) `NoColorSpace`.
- Quality tiers (Renderer.js): low (1024 shadow, no AO/bloom), medium (2048, half-res AO), high (4096 shadow, full AO,
  pixel ratio ≤1.5), ultra (4096, AO High, pixel ratio ≤2). HDRI 1k on low/medium, 2k on high/ultra.

### window.__game (SPEC + extras)
- SPEC: `ready, teleport(x,y,z,yawDeg,pitchDeg)` (EYE position; player floats until movement input), `setTimeOfDay`
  (Promise), `setQuality`, `hideUI`, `stats()` -> `{fps, drawCalls, triangles, textures, geometries, programs, memoryMB,
  gpuTexMB, quality, pixelRatio, resolution}` (drawCalls/triangles = whole frame incl. shadow + post passes),
  `rooms()`, `interact()`, `move(dir, seconds)` (Promise resolving to `state()`), `render()`.
- Extras: `state()` (eye, feet, yaw, pitch, room, tod, quality), `views()` -> `{rooms:[{id,pos,yaw,pitch}], exteriors:[…]}`
  (standard tour viewpoints), `benchmark(frames)` -> `{avgMs, fps}` GPU-bound (vsync-independent), `enter()`,
  `setToneMapping(name)`, `scene`, `camera`, `THREE`.

### Harness
- `node scripts/shot.mjs --pos "x,y,z" --yaw 0 --pitch 0 --tod day --out reviews/x.png [--w --h --quality --ui]
  [--room <id> | --view <ext_id>] [--bench]` -> prints JSON (stats, state, console errors). Exit 2 on console errors.
- `node scripts/tour.mjs --out reviews/tour-<name>/ [--w 1600 --h 900 --quality high --tod day --only a,b --no-variants --ui]`
  -> every room + 4 exteriors (`ext_front_east, ext_garden_sw, ext_south, ext_north_west`) + golden/night garden and night
  living variants; writes `NN_<id>.png`, `index.html` contact sheet, `stats.json` (per-shot stats + image luma stats and
  WASHED-OUT/BLOWN/CRUSHED flags, GPU benchmark on 5 views, console errors).

### P01 round 2 changes (supersede the matching lines above)
- House load hook: `COL_*` -> visible=false, castShadow/receiveShadow=false. Glass / transmissive / transparent
  materials -> castShadow=false, receiveShadow=false, no collision (their `COL_glass_*` collides); their tint is
  lightened 55% once (engine glass policy). Static collider = visible opaque meshes + `COL_*` (P02's COL_ only
  cover glass/stair/doors/structure), excluding door leaves (`COL_DOOR_*` -> `house.doorColliders` for P09),
  instanced meshes, and `*stair*` meshes when `COL_stair` exists. Doors = non-mesh nodes starting `DOOR_` (or
  `meta.doors[].node`). Footstep surface = glTF extra `surface` (name parsing is only a fallback).
  Meta rooms with `exterior:true` are not rooms (no eye adaptation on the terrace).
- Loader: one request per file (meta JSON first, then GLB; no existence probes); `loader.json`/`loadHDRI` cached per URL.
  Only the current time of day's HDRI loads before `ready`; the others prefetch 2.5 s after entry (or on demand).
- Lighting: HDRI lower hemisphere replaced (ground radiance in IBL, horizon colour in background); `lighting.ground`
  (`ENV_ground`, 900 m disc at grade, collides) + `scene.fog` fade to the horizon — P04 may hide/replace the disc.
  Per-room virtual lights (sun-patch bounce by day from ray-sampled lit floor area; ceiling fixtures at night) are
  mapped onto a POOL of 10 real PointLights by relevance to the camera (29 real lights cost ~3.4 s of first-frame
  shader compile on ANGLE). `lighting.roomLightInfo()` for inspection. Emissive bulbs at every LIGHT_* node.
- Tiers: low = 0.85x render scale, no AO/bloom, 1024 shadows, half-res transmission; medium = AO 'Performance',
  2048 shadows; high = full AO, 4096 shadows; ultra = 1.5x supersampling + AO High. SMAA ULTRA on all.
- Entry: title shot -> 0.6 s push-in under a veil -> 1.0 s settle into the eye. First view = `game.entryView`, searched
  up to 4 m along P02's spawn direction, +-80 deg, for the most open framing (spawn stays the anchor).

## P01 requests to P02
- Skirting: the dotted light line on the skirting tops seen in round 1 is no longer visible with the new lighting and
  SMAA ULTRA (checked at night, ultra). If it comes back, it is a gap/T-junction between the SKIRTING top face and
  WALL_*: please overlap the skirting 2 mm into the wall and weld its top edge.
- Stair balusters (HANDRAIL/BALUSTRADE_frames): 20 mm square bars are thinner than a pixel at 5 m on high; please
  bevel them (or use 25 mm) so they do not shimmer on the non-supersampled tiers.
- Please keep `surface` extras on every SURF_* node and `room`/`type` extras on LIGHT_* (both are consumed now).

## P06 — Material registry (src/game/materials/{index,textures,interior}.js, src/game/plugins/15_materials.js)
- Definition modules: every `src/game/materials/*.js` except index.js/textures.js exports
  `definitions = { <name>: async (tex, ctx) => THREE.Material }` and optionally
  `overrides = [{ node: RegExp, material?: '<glb material name>', use: '<definition name>' }]` (tested on the mesh and its
  ancestors; first match wins). Name clashes: exterior.js wins, then later files alphabetically.
- `tex(name, opts)` -> `{ map, normalMap, roughnessMap, aoMap }` (+ non-enumerable `scale_m`, so the result spreads into
  material params). Clones share one GPU upload per file; colour sRGB, data maps NoColorSpace, RepeatWrapping, tier anisotropy
  (updated on quality change). opts: `repeat` = MULTIPLIER on 1/scale_m, `scale` (m per repeat, absolute), `rotation`, `offset`,
  `maps` subset, `maxSize` (px cap, number or per map; downscaled once and shared). aoMap uses channel 0; uv1 stays for baked AO.
- `ctx = { game, THREE, name, surface: applySurface, hide: applyHideBoxes, lib }`.
- `game.materials` (= `game.plugins.get('15_materials').registry`): `apply(root)` (async; replaces registered materials,
  shared instances, `userData.registry = true`; skips materials flagged `userData.p03` or already registered), `get(name)`,
  `has(name)`, `names()`, `stats()`. The plugin applies itself to `house.root` in init().
- `applySurface(material, cfg)` (textures.js): WORLD-space procedural surfaces for static meshes. Modes: `plank` (random
  board columns / flips / offsets from a plank texture -> no repetition), `grid` (tiles w x h, grout, stagger, per-tile random
  texture offset or random cell of a tile-grid texture with 90° rotations, bevelled edges, box-filtered grout that fades to its
  average at distance = no moiré, optional clearcoat on tile faces only), `paint` (colour + plaster normal), `zones` (grid only
  inside world boxes, paint elsewhere). Horizontal faces map (x,z); walls map (horizontal, y - floorY).
- Interior finishes (P06): oak_plank 190 mm boards running E-W; stair_tread = solid oak, 135 mm staves; large_format_tile_grey
  = 600x1200 concrete-look porcelain, 1/3 bond, matte; small_tile_white = 100x100 glazed; large_format_tile_light = 600x600
  limestone (terrace/balcony/entrance); concrete_screed with 2.9 m saw cuts; wall_int / ceiling = warm-white matte paint;
  skirting_white / door_leaf_white = satin white; `int_metal_black` for the stair HANDRAIL and door handles (not LEAF_D_front).
- Wall tile zones (per-room overrides on WALL_<room>): bath_master + bath2 = 600x300 satin white, full height; bath3 = 150x75 gloss
  subway, full height; wc = subway to 1.20 m; kitchen EAST wall (x 11.85) = 300x100 gloss splashback, y 0.90-1.50, z 6.4-10.4
  (P07: worktop 0.90, wall units/window from 1.50). MDF skirting is discarded inside bath_master, bath2, bath3 and wc.

## P02 house shell (round 2) - anchors and rules for other pieces
- `house.meta.json.openings[]`: every opening with `run` (wall axis), `wall_c`, `wall_t`, `out` (+1/-1 = outward side), `face_out` (exterior face plane), `u` (range along the wall), `y` (sill..head). Use these to anchor fins, screens, blinds and lights instead of hard-coding them.
- `house.meta.json.slides[]`: one panel of W_living_w, W_living_s and W_master_w is exported OPEN as node `SLIDE_<id>` (parked behind its neighbour). Translate it by `closed_offset` along `axis` to close it. `open_range` is the walk-through gap along the wall, and `COL_glass_slide_<id>` covers only the closed panels. **P07: keep `open_range` plus 1.2 m inside/outside free of furniture.** Currently an item from 30_furnish.js sits at x 0.27-0.76, z 6.4-7.4 and blocks the living-room west slider.
- Doors are exported OPEN: node `DOOR_<id>` rotation about +Y = `default_open` (= swing x 92 deg). Closed = 0. Child `LEAF_<id>`, grandchild `COL_DOOR_<id>`.
- Walkability: `COL_stair` is a ramp through the nosings that meets the landing edge. `COL_ramps` are invisible ramps over every exterior step/threshold (entrance, terrace edges), because the capsule step-up cannot climb a vertical riser (it samples the ground under the capsule centre).
- Parapets carry a coping with a drip in the shell solid. P03 must not add its own copings. Parapet tops are 3.50 and 6.60 (cap tops 3.55 and 6.65).
- House.json exterior areas may carry `rects` (authoritative) plus a bounding `rect` (kept for House.js compatibility).

## P03 — Exterior finish (src/game/materials/exterior.js, src/game/plugins/20_exterior.js, pipeline/blender/exterior_*.py)
- Build: `tools/blender-5.2.1-windows-x64/blender.exe -b --factory-startup --python pipeline/blender/exterior_build.py -- <id>`
  -> `public/assets/houses/<id>/exterior_detail.glb` (~2.3k tris, 11 primitives, house coordinates). It reads ONLY house.json,
  so re-run it after every P02 spec change. It builds white fascia bands with 6 mm panel joints on parapets and thin elevated slabs
  (pergola, canopy), an aluminium edge trim on those slabs, larch pergola beams (bays centred on the terrace downlights), hip caps,
  flashings/drip edges on hips, the vertical larch screen in front of `W_kitchen_s` (OPTS.screens), larch window surrounds (grain along
  each piece), a slim top channel on `glass` balustrades, a grooved skin on the garage door (8 mm in front of P02's door plane), and
  square up/down wall lights at every exterior `sconce` fixture plus one each side of the garage door (lens + wall-wash quads).
  Copings are skipped where the roof has `"coping": true` (P02 builds them). Vertical 'slats' cladding is replaced only if `orient`
  is not `"h"`.
- GLB root `EXTERIOR_DETAIL` extras: `replaces` (JSON: shell nodes the plugin hides, currently `LARCH_surrounds`) and `lights`
  (JSON: id, face point, dir, wash extents). Empties `EXTLIGHT_<id>` sit at each lamp's wall face. All meshes: `userData.noCollide`.
- Materials (registry, exterior.js wins on clashes): wall_ext_white (world-space render, anti-tiling), wall_ext_anthracite
  (RAL 7016, slight sheen), concrete_block_ext (fair-faced concrete: 1.3 x 1.2 m formwork panels, per-panel tone, 4 tie holes per panel;
  grid origin x 10.85 / z 2.45, rows from y 3.3), wood_slats (honey larch; per-instance texture offset for GPU-instanced boards),
  frames, handrail_black, glass (custom Fresnel), roof_standing_seam, roof_membrane (light gravel), concrete_pavers, plus EXT_*.
  Node overrides: LEAF_D_front -> EXT_front_door (black) + EXT_handle_steel (pull bar); SLATS_recess_* / SLATS_canopy_soffit* ->
  EXT_larch_h (grain along the boards); EXT_wall_ext_anthracite (backing behind P02's panels) -> EXT_anthracite_backing (dark joints).
- Glass: `EXT_STATE.glass` uniforms + `glassMats[].specularColor` are driven by 20_exterior.js. Outside, it reflects the environment
  with an effective F0 of 0.2 plus a base opacity of 0.26 (day) / 0.08 (night), so it reads as dark reflective low-iron glass and
  interiors still glow through at night. Inside a room (`house.roomAt(player.feet)`), it is near-physical (F0 0.04, base 0.02),
  easing over 0.4 s and snapping on teleports.
- Night: lens emissive = 45 x `lighting.presets[mode].fixtures`, and wall washes are additive quads with the same factor (hidden by day).
  P05 may re-tune via `game.plugins.get('20_exterior')` (constants LENS_EMISSIVE / WASH_GAIN) or EXT_STATE.glow / EXT_STATE.wash.
- Instanced shell slats get per-board `instanceColor` (+-10 % tone). Debug: `?p03=0` disables the plugin, and
  `game.plugins.get('20_exterior').stats()` reports its state.

## Requests to P02
- (P03, open) `LARCH_surrounds`: box UVs run the larch grain vertically on the head and sill pieces. P03 currently hides the node and
  draws grain-correct copies with identical extents (face_out - 4 mm .. +180 mm, 100 mm wide). If you change the surround dimensions,
  tell P03, or give each piece grain-aligned UVs (v along the piece) and P03 will drop the replacement.
