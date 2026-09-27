# Adding a new house

From a client's floor plans and photos to a walkable, critic-approved house. Every step names who does it (a
builder agent, a critic agent, or the orchestrator) and what must be true before moving on. The build/critic loop
itself is described in `docs/LOOP.md`.

```
houses/<id>/input/ (plans, photos, brief)
   │  1. intake agent
   ▼
houses/<id>/{house.json, site.json, furniture.json, budget.json}  +  input/REFERENCE.md (written description)
   │  2. Blender build                         node pipeline/build.mjs <id>
   ▼
public/assets/houses/<id>/{house.glb, house.meta.json, exterior_detail.glb}
   │  3. gates                                 npm run check -- --id <id>      (must be PASS)
   ▼
   4. critic loop per piece (docs/LOOP.md): plan fidelity, photo fidelity, HF2 quality
   │
   ▼
   5. catalog card + commit
```

## 0. Setup (once per machine)
- `npm install`, `npx playwright install chromium`.
- Blender 5.2: `tools/blender-5.2.1-windows-x64/` on Windows, or set `BLENDER` (see docs/CLOUD_SESSION.md on Linux).
- Assets on a fresh clone (`public/assets/` is not in git):
  ```
  node scripts/assets/dl_hdri.mjs
  node scripts/assets/dl_textures.mjs         # or gen_textures.mjs where Poly Haven is unreachable
  node scripts/assets/gen_textures.mjs concrete_aggregate rock_limestone    # procedural-only sets
  node scripts/assets/dl_models.mjs
  node pipeline/props/make.mjs --no-render
  node scripts/assets/build_manifest.mjs --credits && node pipeline/props/manifest_add.mjs
  ```
- Start the dev server: `npm run dev` (port 5174; set PORT to change it). The tools find it on ports 5173-5176
  automatically (or set `HOUSE_BASE`).

## 1. Intake (intake agent)
1. `cp -r houses/_template houses/<id>` and put the client material into `houses/<id>/input/`
   (see `houses/_template/input/README.md`).
2. The intake agent reads every image with the Read tool and writes:
   - `input/REFERENCE.md`: a precise written description of every plan and photo (room names, areas and
     dimensions exactly as printed, and per photo: massing, materials, colours, openings, landscaping, lighting,
     camera position). Critics use it when they cannot open the images, so it must be concrete.
     `houses/villa-nova/input/REFERENCE.md` is the model to follow.
   - `house.json`: levels, rooms (rects on wall centre-lines, tiling without gaps), openings, stairs, roofs,
     facade zones, cladding, materials, spawn. Format: "Reference: house.json" below. Start from
     `houses/villa-nova/house.json`.
   - `site.json`: plot, paving, pool, beds, hedges, fences, trees, street, lights, terrain, taken from the site plan
     and environment photos. Start from `houses/villa-nova/site.json`.
   - `furniture.json`: per-room placements. Start from the room of the same type in `houses/villa-nova/furniture.json`
     and follow the placement rules below.
   - `budget.json`: copy the template unless the house is much bigger.
3. Record every assumption (unreadable dimension, guessed height, missing plan) at the top of `input/REFERENCE.md`
   under "Assumptions". A critic checks each one.

### Furniture placement rules (these came from real bugs)
- Keep a clear 0.9 m walkway through every door, sliding door, stair foot and landing. Never place floor items in
  the lane between a stair and the opposite wall. The check's walk gate fails if a door cannot be crossed.
- Doors are exported open by default; keep their swing arcs clear.
- `snap` pushes an item until its bounding box touches a wall. For items with offset foliage (plants), or where the
  wall is short, set `pos` explicitly instead: the snap ray may pass the end of the wall and slide the item across
  the room.
- Large items (cars, beds, sofas) must leave every door on that wall reachable.

## 2. Build the house (builder)
```
node pipeline/build.mjs <id>              # Blender build, stats, node-name validation (warns on area differences > 10 %)
node pipeline/build.mjs <id> --render     # plus previews, including a plan view for the plan-fidelity check
$BLENDER -b --factory-startup --python pipeline/blender/exterior_build.py -- <id>
```
Fix every validation error. Look at the previews.

## 3. Gates (builder, before reporting done; orchestrator, before every commit)
```
npm run check -- --id <id>                 # all gates, about 5-10 min on a GPU machine
npm run check -- --id <id> --only walk     # just the walkability tests
```
`scripts/check.mjs` boots the real game once and runs:
- **boot**: no console errors, no failed plugin, no 404 or failed asset request, every furniture model exists.
- **walk**: spawn is in free space facing an open view. Every door and the front door are crossed both ways,
  every sliding door in and out, every stair up and down, all generated from house.json. A failure names what is
  around the stuck player.
- **perf**: triangles, draw calls and GPU frame time on standard views vs `houses/<id>/budget.json`.
  WARN by default, FAIL with `--strict`.
- **views**: standard screenshots with a contact sheet, and a list of views that changed a lot since the last run.
Reports: `reviews/check/<id>/<timestamp>/REPORT.md` and `reviews/check/<id>/latest.json`.
**A FAIL blocks everything**: builders fix it before reporting done, and critics do not start on a failing build.

## 4. Critic loop (docs/LOOP.md)
For a new house, the first critic rounds are fidelity rounds:
- **Plan fidelity**: plan-view render vs `input/plans/*` (room layout, door positions, dimensions).
- **Photo fidelity**: our matching exterior views vs every `input/photos/exterior/*` and `photos/environment/*`,
  blind, per reviews/CRITIC_PROTOCOL.md.
Then the House Flipper 2 quality rounds per piece, as for Villa Nova.

## 5. Catalog and commit (orchestrator)
- Add the catalog card (hero image from the check's views) and set the house live.
- Commit when the check passes and the critic round is recorded. Push to `main`, or to a branch cut from `main`.

---

## Reference: house.json

Pipeline: **plans → `houses/<id>/house.json` → Blender (`pipeline/blender/build_house.py`) → `public/assets/houses/<id>/house.glb` + `house.meta.json` → runtime / catalog.**
It is fully data-driven. Nothing in the builder is specific to Villa Nova.

### Commands
```
node pipeline/build.mjs <id>                 # build with Blender (about 2 s), print stats, validate node names against meta
node pipeline/build.mjs <id> --render        # + EEVEE previews -> reviews/p02-blender/*.png
node pipeline/build.mjs <id> --validate      # validate existing output only
tools/blender-5.2.1-windows-x64/blender.exe -b --factory-startup --python pipeline/blender/render_previews.py -- <id> \
    --only 01,04 [--engine workbench] [--doors open] [--interior 0] [--cam "name:x,y,z:tx,ty,tz:lens"]
```
Add `--blend` after the id when running build_house.py directly to also save `pipeline/blender/out/<id>.blend`.

### Coordinates
X = east, Y = up, Z = south, metres. Ground finished floor is y = 0. Blender objects are created at (x, -z, y), so the glTF
Y-up export gives back exactly these coordinates. The runtime, meta and house.json all use the same numbers.

### Transcribing the plans
1. **levels**: `elevation`, `clear_height`, `slab` (0.30). Ceiling = elevation + clear height. The next level must start at ceiling + slab.
2. **`<level>_rooms`**: `rect: [x, z, w, d]` on **wall centre-lines**, or `rects: [...]` for L-shaped rooms. Rooms on one level
   must **tile without gaps or overlaps**. The wall graph turns every edge between two different rooms into ONE wall
   (0.12 m interior). Every edge between a room and nothing becomes an exterior wall (0.30 m, centred on the edge).
   Keep the original transcription in `rect_src`. `build.mjs` warns when an area differs by more than 10 % from `area`.
3. **`walls.open[level]`**: room pairs with no wall between them (open-plan living/kitchen/hall).
4. **`<level>_exterior`**: walkable outside areas (`y`, `floor`), e.g. terrace, balcony, steps. `y_far` makes a sloped area (driveway).
5. **structure**: `boxes` (pergola slab, pillars, platforms, steps: `rect` + `y:[y0,y1]`), `canopies[level]` (roof slab over
   a recess), `voids` (stair holes through a slab, `level` = the upper level).
6. **roofs**: `flat` (rects + `parapet` height; `parapet_skip` rects where a higher wall/roof abuts) and `hip`
   (`outline` = final eave rectangle incl. overhang, `base`, `pitch`, `thickness`, `seam_spacing`).
7. **facade_zones**: boxes that give exterior wall faces another material (default `wall_ext_white`). `panels: true` adds
   fibre-cement panels with 8 mm joints.
8. **openings**: `at: [x, z]` = a point on the wall centre-line; the builder finds the wall. The types are:
   `window` (sill, panes), `slide` (full-height sliding glass, also gets `COL_glass_slide_<id>`), `door`, `front_door`
   (`hinge: min|max` along the wall axis, `swing_into: <room>`), `garage`. Optional `reveal: <material>` (larch reveals)
   and `surround: true` (projecting larch box). The check's walk gate uses `at` and `swing_into` for every door.
9. **stairs**: `first_riser [x,z]`, `dir`, `side` (width direction), risers/riser/tread/width. Put a matching `void` in
   `structure` that covers the whole flight (plus headroom). A stair whose foot sits in a small room (a vestibule)
   leaves little turning space: keep that room free of furniture.
10. **balustrades** (`glass` or `glass_rail` along a path), **cladding** (`slats` on a wall plane, `soffit_slats`, `screen`).
11. **lighting**: `downlight_grid`, `single_light_rooms`, `fixtures` (absolute positions). **spawn**: floor position + yaw.
    The check fails a spawn inside geometry or facing a wall closer than 1.5 m.
12. **materials** / **extra_materials**: every material name used in the GLB must be a key here. `build.mjs` enforces this.

### What the builder does
* Foundations, slabs, walls, parapets and boxes are unioned into one solid on a non-uniform grid. Openings and voids
  are carved out, and only boundary faces are emitted, greedy-merged into rectangles. This gives real thickness with no
  double walls, no hidden faces and no coplanar duplicates.
* Each face is classified by the empty cell in front of it:
  `SURF_<floor>_<room>` (floors, footsteps), `CEIL_<room>`, `WALL_<room>` (interior faces including reveals), `EXT_<material>`.
* Added on top (back faces omitted or embedded in the wall, so nothing z-fights): skirting (80 mm, chamfered, embedded 5 mm),
  door linings, chamfered casings, `LEAF_<id>` under the `DOOR_<id>` hinge empty with `COL_DOOR_<id>`, 60 mm black frames +
  `GLASS`, sills, the stair (body, oak treads, black balusters/handrail), glass balustrades, hip roofs with real standing seams,
  larch slats (`SLATS_*`, EXT_mesh_gpu_instancing), the garage sectional door and the driveway.
* UV0 is a box projection (1 unit = 1 m, continuous in world space). UV1 (`TEXCOORD_1`) is a per-face shelf-packed,
  non-overlapping atlas for lightmaps/AO.
* Collision: `COL_structure` is the same solid with only door and sliding openings carved (windows stay solid). Also
  `COL_stair` (ramp), `COL_glass_*`, `COL_driveway`. COL meshes have no material; the runtime hides every `COL_*`.

### Runtime contract (house.meta.json)
`rooms[{id,name,level,center,area,area_src,bounds,rects,floor,exterior}]`,
`doors[{id,room_a,room_b,hinge,width,height,swing,open_angle,node}]`. To open a door, rotate node `DOOR_<id>` about +Y by
`swing * angle`; it swings into `room_b`. Also `lights[{id,type,pos,room}]`, `slides[{id,axis,open_range,...}]`,
`spawn{pos (feet), yaw, eye_height}`, `bounds`, `levels`, `grade_y`. Every ROOM_/DOOR_/LIGHT_/SPAWN node carries the same data as glTF extras.
Room ids may contain `_`, so read the footstep surface from the SURF node's `extras.surface`, not by splitting the name.
