# P04 Landscape & sky — critic round 2

All views captured in ONE boot, 1280x720, quality high, SwiftShader. reviews/hf2/ does not exist, so all blind pairs are **description-based** against HF2_REFERENCE.md.

## Triangles per exterior view (budget < 1.5M)
| view | triangles | draw calls |
|---|---|---|
| ext_front_east | 3,396,749 | 1970 |
| ext_garden_sw | 3,305,129 | 1964 |
| ext_south | 3,338,605 | 1954 |
| ext_north_west | 3,398,285 | 1974 |
| street_approach | 3,398,285 | 1974 |
| garden_south_lawn | 2,383,977 | 1026 |
| garden_from_terrace | 1,314,921 | 615 |
| pool_close | 1,280,625 | 609 |
| tree_close | 1,221,774 | 583 |
| golden/night variants | 3.32–3.44M | ~1980 |
**All four standard exteriors are 2.2x over the 1.5M budget.** Fail.

## Scores (0-10, ours vs HF2-as-described)
| criterion | ours | HF2 |
|---|---|---|
| Sun / cast shadows outdoors (day) | 3 | 9 |
| Sky (clouds, sun disc, HDRI quality) | 6 | 9 |
| Lawn / 3D grass | 6 | 8 |
| Pool water (reflection, caustics, edge) | 5 | 8 |
| Paving / hardscape | 7 | 8 |
| Trees & foliage (translucency, close-up) | 5 | 9 |
| Hedges / shrubs / boundaries | 4 | 8 |
| Outdoor furniture & clutter density | 6 | 8 |
| Golden hour | 6 | 8 |
| Night exterior | 6 | 9 |
| Performance budget | 2 | — |

## Blind pairs (description-based; coin flips: true,true,true,false)
1. **Exterior day lawn** vs `hf2-aframe-cabin-exterior-forest-day.png` ("grass blades, foliage translucency", "blue sky with volumetric-looking cumulus, sun disc with lens haze, bright leaf edges against the sun"). A = ours (ext_South_facade), B = HF2. A: grass blades yes (7), foliage translucency no — leaves are uniformly lit (3), no sun disc/haze (3), olive tree casts no visible shadow on the lawn (2). B scores full on all. **B wins → HF2.**
2. **Exterior approach** vs rubric framing 4 + `hf2-coffee-shop-interior-day.png` ("cottage behind picket fence, flowers") and 3.Density ("shrubs, fallen logs, stepping stones, fences with individual pickets, mailbox, garden lamps, tyres, bins, a car in the drive"). A = ours (ext_Front_street_east). A: stepping stones, bollards, gabion wall, grasses present; no mailbox, no bins, no car, no flowers with colour; gabion stones are low-poly grey blocks; hard noon-less flat light, soft/no shadows under shrubs. Density 5, material 6. B full. **B wins → HF2.**
3. **Night exterior** vs `hf2-modern-villa-exterior-night-neon.png` / `hf2-diner-exterior-night-neon.png` ("dark blue sky with stars and cloud detail, bright moon disc with bloom, interiors glowing warm through glass, strip lights casting coloured light onto walls and ground, path lamps with visible ground pools"). A = ours (ext_Front_night). A: stars yes, warm interior glow yes, wall sconce washes yes (good), no moon disc, bollards show a bulb but almost no ground pool, no strip/accent lighting, sky purple-grey not deep blue. 6 vs 9. **B wins → HF2.**
4. **Close-up foliage** vs framing 6 + aframe foliage description. A = HF2, B = ours (tree_close). B: branches read as bare tapered sticks poking out of the crown, leaf cards acceptable, but the hedge is an obvious box with a tiled, oversized-leaf texture (leaves ~10 cm wide at 1 m, flat faces, hard top edge), fence OK with ivy. 4 vs 9. **A wins → HF2.**

Result: HF2 4 / ours 0.

## Genuinely good
- Composition of the garden: pool + deck + loungers + umbrella + sofa + planted beds + gravel circle + fire pit reads as a designed villa garden (ext_Garden_pool_south-west, garden_from_terrace).
- Paving tiles with joints and the dark pool coping look clean; pool water has a tiled floor, lane stripe and ripple normal.
- Golden hour front (ext_Front_street_east_golden_hour) is the best frame: warm rim light, long shadows, bollard glow, sun bloom through trees.
- Looking out of the living room (living_window_out) the exterior is fully populated — pool, terrace, hedge, trees — no void.
- Night: warm interiors, sconce wall-washes, stars.

## Ranked problems
1. **No readable sun shadows in daytime.** Trees, umbrella, sofa, loungers, hedge cast essentially nothing on lawn/paving in every day view (ext_South_facade tree, garden_south_lawn sofa/umbrella, pool_close). The day looks overcast-flat; HF2 exteriors are defined by crisp tree/object shadows. Golden hour proves the shadow path works — day sun is too weak vs sky/ambient or shadow map range/bias kills it.
2. **Triangle budget blown: 3.3–3.4M on every standard exterior (2.2x).** Likely 3D grass + tree ring/far trees without LOD.
3. **Hedges are textured boxes** (tree_close, garden_from_terrace): flat sides, oversized tiled leaf texture, hard straight top. Needs leaf cards / displaced shell / smaller leaf scale.
4. **Far trees / background conifers are blurred smears** (DOF or low-res billboards) in ext_Garden, ext_South, ext_North-west, tree_close — the tall pines look like out-of-focus photos pasted in.
5. **North-west view is a milky white haze** (ext_North-west_corner): sky blows out to white and the lawn is washed — the "never a milky full-screen haze" rule is violated.
6. **HDRI artefacts in golden hour**: a power pylon in the sky (garden golden) and streaks plus a hard vertical seam at x≈1110 in the front golden sky.
7. **Pool water**: no reflection of the umbrella/house/sky, no visible caustics on the floor, reads as a textured blue plane.
8. **Foliage has no translucency** — leaves are uniformly lit green, no bright back-lit edges.
9. **Night**: no moon disc, bollard ground pools too faint, no accent/strip lighting; garden night lawn is pure black.
10. **Clutter**: no mailbox, bins, car in the drive, flowers with colour; gabion stones are faceted low-poly blocks.

WINNER: HF2
BIGGEST_GAP: Daytime exteriors have no readable sun shadows — trees, umbrella, furniture and hedges cast nothing on lawn or paving, so every day view looks flat and overcast, while also running at 3.3-3.4M triangles (2.2x the 1.5M budget).
NEXT_FIXES: 1) Raise day sun intensity vs hemisphere/env ambient and fix the sun shadow camera extent/bias so trees, umbrella and furniture cast crisp shadows on lawn and deck (src/engine/Lighting.js); 2) Cut exterior triangles below 1.5M with grass density/distance LOD and tree-ring/far-tree impostors (src/game/landscape/grass.js, plants.js); 3) Replace box hedges with leaf-card or shell hedges with realistic leaf scale and an irregular top (src/game/landscape); 4) Remove DOF/blur from far conifers and fix the washed-out NW sky exposure, plus swap/mask the golden-hour HDRI with the pylon and seam; 5) Pool water: add sky/env + SSR reflection and animated caustics on the floor (src/game/landscape/pool.js); 6) Night: moon disc with bloom, stronger bollard ground pools, and add mailbox, bins, car in the drive and coloured flowers.
