# Adding a new house (draft, P02)

Pipeline: **plans → `houses/<id>/house.json` → Blender (`pipeline/blender/build_house.py`) → `public/assets/houses/<id>/house.glb` + `house.meta.json` → runtime / catalog.**
It is fully data-driven. Nothing in the builder is specific to Villa Nova.

## 1. Commands
```
node pipeline/build.mjs <id>                 # build with Blender (about 2 s), print stats, validate node names against meta
node pipeline/build.mjs <id> --render        # + EEVEE previews -> reviews/p02-blender/*.png
node pipeline/build.mjs <id> --validate      # validate existing output only
tools/blender-5.2.1-windows-x64/blender.exe -b --factory-startup --python pipeline/blender/render_previews.py -- <id> \
    --only 01,04 [--engine workbench] [--doors open] [--interior 0] [--cam "name:x,y,z:tx,ty,tz:lens"]
```
Add `--blend` after the id when running build_house.py directly to also save `pipeline/blender/out/<id>.blend`.

## 2. Coordinates
X = east, Y = up, Z = south, metres. Ground finished floor is y = 0. Blender objects are created at (x, -z, y), so the glTF
Y-up export gives back exactly these coordinates. The runtime, meta and house.json all use the same numbers.

## 3. Transcribing the plans into house.json
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
   and `surround: true` (projecting larch box).
9. **stairs**: `first_riser [x,z]`, `dir`, `side` (width direction), risers/riser/tread/width. Put a matching `void` in `structure`.
10. **balustrades** (`glass` or `glass_rail` along a path), **cladding** (`slats` on a wall plane, `soffit_slats`, `screen`).
11. **lighting**: `downlight_grid`, `single_light_rooms`, `fixtures` (absolute positions). **spawn**: floor position + yaw.
12. **materials** / **extra_materials**: every material name used in the GLB must be a key here. `build.mjs` enforces this.

## 4. What the builder does
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

## 5. Runtime contract (house.meta.json)
`rooms[{id,name,level,center,area,area_src,bounds,rects,floor,exterior}]`,
`doors[{id,room_a,room_b,hinge,width,height,swing,open_angle,node}]`. To open a door, rotate node `DOOR_<id>` about +Y by
`swing * angle`; it swings into `room_b`. Also `lights[{id,type,pos,room}]`,
`spawn{pos (feet), yaw, eye_height}`, `bounds`, `levels`, `grade_y`. Every ROOM_/DOOR_/LIGHT_/SPAWN node carries the same data as glTF extras.
Room ids may contain `_`, so read the footstep surface from the SURF node's `extras.surface`, not by splitting the name.

## 6. Checklist for a new house
- [ ] Rooms tile (the build log prints the wall count; the plan view render `--cam "plan:6,30,4:6,0,4.01:20"` shows gaps)
- [ ] `node pipeline/build.mjs <id>` reports OK. Review the area warnings.
- [ ] Previews: exterior from 4 sides, aerial, every main room. Use `--doors open` to check hinge side and swing.
- [ ] Engine check: `node scripts/shot.mjs --id <id> --pos ... --tod night` (look for leaks at skirting and corners).
- [ ] Add the catalog card (P10) and textures per material name (P03/P06).
