# TEX round 4 critic verdict (surface materials)

Capture: one boot, 27 views, 1280x720, quality high, day, FOV 75 (cap.mjs). All images opened and judged.
reviews/hf2/ is empty, so all blind pairs are description-based (HF2_REFERENCE.md section 2).

## Scores (0-10, ours vs HF2 as described)
| Surface | Ours | HF2 | Notes |
|---|---|---|---|
| Wood floor (living/beds) | 6 | 9 | plausible plank scale and colour; no gloss breakup / dull patches, reads uniform at 5 m |
| Walls / ceilings plaster | 5 | 9 | fine noise now visible close up (wc_wall), but reads flat at 5 m; ceilings slightly beige-flat |
| Kitchen worktop | 6 | 9 | FIXED since r3: now reads as white veined stone on the waterfall ends; top surface nearly featureless, no reflection breakup |
| Bath wall tiles (master, bath2) | 5 | 9 | large-format tiles with thin grey grout, zero per-tile tint/roughness variation, grout not recessed |
| WC / bath3 subway tile | 5 | 9 | scale ok (~7.5x15), but WC walls show tiles running DIAGONALLY (UV rotated) and uniform flat albedo |
| Bath floors (large grey porcelain / small white mosaic) | 5 | 8 | clean but CG-uniform; mosaic grout painted-looking |
| Exterior render / panels | 6 | 8 | readable panel joints; flat at distance, no weathering streaks |
| Wood cladding | 7 | 9 | best material: grain, per-board tone variation; slightly oversaturated orange |
| Entrance slabs + steps | 5 | 8 | step treads plausible; the terrazzo/aggregate slabs are high-frequency salt-and-pepper noise at uniform scale, black joints/risers |
| Paving / driveway pavers | 6 | 8 | good module scale; joints dark, no per-paver variation |
| Gravel | 6 | 8 | good scale, too bright white (albedo ~0.8) |
| Lawn | 4 | 8 | flat green texture + sparse sticker blades; no macro colour variation, no density |
| Gabion stones | 4 | 8 | rocks read as rectangular cards/cubes at one scale; wall looks like stacked bricks of noise |
| Pool coping | 5 | 8 | dark speckled granite ok at 5 m, uniform noise close |
| Fabrics / leather | 6 | 8 | outdoor cushions show weave; indoor sofa/bedding flat |
| Metals (black fittings, brass pendants) | 7 | 8 | pendants nice; black fittings flat matte |
| Outdoor table wood | 3 | 8 | saturated orange, uniform stripe grain (unchanged from r3) |

Average ours ~5.4 vs HF2 ~8.4.

## Blind pairs (description-based)
Coin flips: pair1 false (ours=B), pair2 true (ours=A), pair3 true (ours=A).

**Pair 1 - kitchen (description-based).** Ref `hf2-kitchen-dining-farmhouse-day.png`: "Wood shows grain, gloss breakup and dull patches; painted cabinet doors have a satin sheen with slightly rougher edges; ceramic, chrome, glass, fabric, leather all read distinctly at a glance; counters have a thickness edge and slight round-over." A = HF2 description, B = kitchen.png.
Roughness variation: A 9 / B 4 (floor, black cabinet doors uniform). Material distinction: A 9 / B 6 (worktop now stone, cabinets read as matte black flat). Edge detail: A 8 / B 5 (hard worktop edge, no round-over). Winner A. Reveal: A = HF2. Ours loses.

**Pair 2 - bathroom tiles (description-based).** Ref `hf2-bathroom-shower-cleaning-hud-prompts.png`: "subway tiles ~7.5 x 15 cm; tile grout is darker and recessed; nothing visibly repeats within a single wall." A = bath3_close.png, B = HF2 description.
Scale: A 7 / B 9. Grout depth/colour: A 4 / B 9 (thin painted lines, no recess, no AO). Per-tile variation: A 3 / B 8 (every tile identical). Winner B. Reveal: A = ours. Ours loses.

**Pair 3 - exterior hardscape (description-based).** Ref from section 2 + 3: "PBR with roughness variation; realistic tiling scale; nothing visibly repeats; dirt and wear as separate layers." A = driveway.png, B = HF2 description.
Albedo plausibility: A 6 / B 8. Repetition: A 5 / B 8 (aggregate noise identical on every slab). Wear layer: A 2 / B 8 (no dirt, edge wear, moss, water staining). Winner B. Reveal: A = ours. Ours loses.

Result: HF2 3 - 0.

## What is genuinely good
- Kitchen worktop no longer reads as fabric: veined white stone on the waterfall ends (r3 top fix landed).
- Façade wood cladding has real grain and board-to-board variation.
- Subway tile scale in WC/bath3 is correct; driveway paver module is right.
- Outdoor cushions show visible weave.

## Ranked problems
1. Tiles everywhere (master bath, bath2, bath3, WC) are uniform CG: no per-tile tint/roughness jitter, grout is a thin painted line with no recess/AO, zero edge bevel highlight.
2. WC wall subway tiles run diagonally (texture rotated ~30-40 deg on the WC walls, see wc.png / wc_floor.png) - an outright mapping bug.
3. Gabion fill reads as stacked cube cards at a single scale (gabion.png, gravel.png, driveway.png foreground).
4. Lawn is a flat green texture with sparse sticker blades; no macro tonal patches or density near camera.
5. Aggregate entrance/drive slabs: uniform salt-and-pepper noise identical on every slab, pure-black joints/risers.
6. No wear/dirt layer anywhere outdoors (no edge darkening, water streaks under sills, moss in joints).
7. Interior walls/ceilings read flat at 5 m; wood floor lacks gloss breakup; outdoor table wood oversaturated orange.
8. Gravel albedo too white; bath floor mosaic grout painted.

WINNER: HF2
BIGGEST_GAP: Every tiled surface (all bathrooms and the WC) renders as identical flat tiles with thin painted grout and no per-tile variation, and the WC wall tiles are even mapped diagonally, so the wet rooms read as CG at a glance.
NEXT_FIXES: 1) Fix the WC wall tile UV rotation so subway courses run horizontal (WC wall material/UV in the room build, pipeline/build or wall material mapping). 2) Regenerate tile sets in scripts/assets/gen_textures.mjs: 2-3 mm light-grey grout recessed via normal+AO, per-tile tint +-4% and roughness jitter, subtle bevel highlight; same for the floor mosaic. 3) Gabion: several rounded rock shapes at random scale/rotation instead of cube cards. 4) Lawn: macro colour variation (yellow/dark patches) + denser clumped blades near camera; drop gravel albedo to ~0.55. 5) Aggregate slabs: large-scale mottling, per-slab offset/tint, dark-sand joints and textured risers instead of black; add an outdoor wear layer (edge darkening, drip streaks). 6) Desaturate outdoor table wood and add gloss breakup to interior wood floor.
