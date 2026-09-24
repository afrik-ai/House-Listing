# TEX critic r1: surface materials (villa-nova), judged against House Flipper 2

Captured with a custom one-boot script (medium quality, day, 1280x720, SwiftShader). The machine was very overloaded, so each frame took 3-6 minutes.
Views: living.png, kitchen.png, bath.png, bath2.png, bedroom.png, ext_front.png, ext_drive.png, ext_garden.png, ext_south.png, close_floor.png (~1 m), close_bath.png (~1 m).
There are no HF2 images in this environment, so every pair is **description-based** against reviews/HF2_REFERENCE.md section 2.

## Scores (0-10, rubric criterion 4 "Material fidelity" split by surface)
| Surface | Ours | HF2 (as described) |
|---|---|---|
| Wood floor (oak planks) | 7 | 8 |
| Wood furniture / slatted panel | 7 | 8 |
| Bathroom tile + grout | 3 | 8 |
| Wall paint / plaster | 2 | 7 |
| Exterior render / facade panels | 3 | 7 |
| Paving / concrete / driveway | 4 | 7 |
| Lawn | 6 | 8 (3D blades) |
| Gravel / white stone beds | 2 | 7 |
| Gabion stone | 3 | 7 |
| Fabrics (sofa, chair seats) | 7 | 8 |
| Metals (brass pendants, black taps) | 6 | 8 |
| **Overall material fidelity** | **4.5** | **8** |

## Blind pairs (description-based, coin-flip A/B)
**Pair 1: bathroom** (flip=true, so ours is A: blind/pair1_A.png) vs `hf2-bathroom-shower-cleaning-hud-prompts.png`. The reference is described as having subway tiles of ~7.5x15 cm, darker recessed grout, ceramic that reads distinctly, and roughness variation.
- A: large-format ~60x30 cm wall tiles with hairline grout drawn as thin dark lines. The grout is not recessed, has no width, and shows no bevel. The tiles are uniform flat light grey with no per-tile tone shift and no specular breakup. The floor is grey terrazzo with a sparse black speckle that reads like noise dots. The tub and basin are near-flat white.
- B (HF2): grout recessed and darker, ceramic reads glossy with reflections, per-tile variation.
- Scores: tile 3 vs 8, grout 2 vs 8, roughness 3 vs 8. **B wins. Ours was A.** HF2 wins.

**Pair 2: living room floor** (flip=false, so ours is B: blind/pair2_B.png) vs `hf2-kitchen-dining-farmhouse-day.png`. The reference is described as having ~15 cm planks 1-2 m long, grain, gloss breakup, dull patches, and nothing repeating.
- A (HF2): all listed properties present.
- B: this is the strongest surface we have. The oak shows clear grain, plausible plank width (~18-20 cm) and staggered ends. At ~1 m (close_floor.png) plank-to-plank tone shifts are visible. It is weaker in two ways: plank seams are barely there (no bevel or dark joint), and there is almost no gloss breakup or sun specular on the floor, so it reads matte-flat. The table and chairs share a near-identical grain, and the table top grain is a straight repeating stripe.
- Scores: scale 8 vs 8, grain 7 vs 8, roughness 4 vs 8. **A wins, narrowly.** HF2 wins.

**Pair 3: street facade** (flip=false, so ours is B: blind/pair3_B.png) vs `hf2-aframe-cabin-exterior-forest-day.png` plus the section 2 brick/render description, which lists per-unit colour variation, rough mortar, weathering, and nothing visibly repeating on a wall.
- A (HF2): all listed properties present.
- B: the white render is a flat, spotless off-white with faint panel lines and no stucco grain, weathering, drip staining or AO darkening at the ground. At 5 m it reads as an untextured Lambert box. The dark cladding panels are flat black. The wood slat entry is the best exterior material (grain, shadowed gaps). The driveway pavers have a correct small-unit scale but low contrast. The large concrete step slabs are flat grey planes with no aggregate or edge wear. The white gravel beds (ext_south, ext_garden) are pure white fills with no stones at all. The gabion stones are faceted low-poly grey chunks with one stone tone and no texture.
- Scores: 3 vs 7. **A wins.** HF2 wins.

Blind result: **HF2 3 of 3.**

## Genuinely good
- Oak floor and timber: believable grain, a correct plank scale, and no obvious repeat within a room (living, kitchen, bedroom).
- Fabric weave is visible on the sofa and dining seats at 1 m (close_floor.png), and the linen reads as linen.
- The wood slat feature wall and the entry cladding look right.
- The lawn has a grass-blade layer and mowing tonal variation, which is decent at 5 m.

## Ranked problems
1. **Walls and exterior render are flat colour.** There is no roller/stucco micro-texture, no roughness variation, and no dirt or AO layer, on every interior wall and the whole facade. This alone makes rooms read as CG boxes, and HF2 explicitly calls for "fine noise / roller texture, not a flat colour".
2. **Bathroom tiles have hairline painted grout.** The grout has no width, no recess and no normal bevel, and the tiles have no per-tile colour or gloss variation. The terrazzo floor looks like scattered black dots, not aggregate.
3. **Gravel beds are pure white planes** with zero stone detail (ext_south, ext_garden). Worst albedo in the scene: blown out and far too bright.
4. **Gabion stone** is low-poly faceted geometry in one flat grey, with no rock texture or colour variation.
5. **Concrete steps, slabs and pool coping** are flat grey with no aggregate, edge wear or water staining, and the pavers are low contrast.
6. **Wood roughness is uniform matte.** There is no clearcoat or gloss breakup on the floor or table, the table grain is a straight repeating stripe, and chairs, table and floor share one oak.
7. **Ceramics** (tub, basin, WC) are nearly flat white with weak reflections, so they don't read as glossy porcelain.

WINNER: HF2
BIGGEST_GAP: Walls, ceilings and the exterior render are flat untextured colour with uniform roughness (no stucco/roller normal, no tone noise, no ground-level dirt/AO), so every room and the facade read as plain CG boxes next to HF2's textured paint.
NEXT_FIXES: 1) Add a plaster/roller normal+roughness set with low-frequency albedo noise to all interior wall/ceiling materials and a coarser stucco set with base-of-wall grime to the exterior render (textures.json / gen_textures.mjs + material assignment). 2) Rebuild bathroom tiles with real grout width (3-4 mm), a recessed normal/AO in the grout, per-tile tint and gloss jitter, and replace the speckle terrazzo with a proper aggregate texture. 3) Give gravel beds an actual pebble albedo/normal at ~2-4 cm scale and pull the albedo down to ~0.6. 4) Texture the gabion stones (rock albedo/normal with 3-4 tone variants) and the concrete slabs/steps/coping (aggregate, edge wear, stains), and raise the paver contrast. 5) Add roughness variation (clearcoat breakup) to the oak floor and use distinct wood variants for the table and chairs.
