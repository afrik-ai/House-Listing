# TEX critic r3 - surface materials (description-based; reviews/hf2/ empty)

Captured in one boot, 1280x720, quality high, day: living, kitchen, master_bed, bath_master, bath2(+_close), bath_master_close, entrance_a/b, driveway, gravel, gabion, ext_front_east, pool_coping, pool_surround, lawn, ext_garden_sw, living_floor.

## Scores (0-10, material realism only)
| Surface | Ours | HF2 (described) |
|---|---|---|
| Wood floors | 6 | 8 |
| Bathroom tiles/grout | 4 | 8 |
| Walls/ceilings/plaster | 5 | 8 |
| Kitchen worktop / stone | 3 | 8 |
| Exterior render/panels | 5 | 7 |
| Entrance slabs/steps | 4 | 7 |
| Driveway/paving | 5 | 7 |
| Gravel | 5 | 7 |
| Gabion stone | 5 | 7 |
| Pool coping/deck | 6 | 7 |
| Lawn | 4 | 8 |
| Fabrics/leather/metal | 5 | 8 |
| **Mean** | **4.8** | **7.5** |

## Blind pairs (description-based)
Pair 1 - bathroom (coin=true: A=ours bath_master.png, B=HF2 `hf2-bathroom-shower-cleaning-hud-prompts.png`: "subway tiles ~7.5x15 cm, tile grout is darker and recessed", "ceramic, chrome, glass read distinctly"). A: large-format wall tile with thin, black, painted-looking grout lines of uniform width, zero per-tile tint, no edge bevel/specular breakup; floor tile a flat grey with sparse dot speckle. B (as described): recessed darker grout, glazed ceramic reflection. A 4 / B 8. **HF2 wins.**

Pair 2 - kitchen (coin=false: A=HF2 `hf2-kitchen-dining-farmhouse-day.png`: "wood shows grain, gloss breakup and dull patches; painted cabinet doors satin sheen; counters have a thickness edge; herringbone ~15 cm planks"; B=ours kitchen.png). B: island worktop still reads as woven/canvas fabric (bumpy white knit pattern on top AND sides), black cabinets are featureless unlit voids; oak floor plank scale plausible but uniform gloss. A 8 / B 3.5. **HF2 wins.**

Pair 3 - street facade (coin=false: A=HF2 `hf2-modern-villa-exterior-night-neon.png`/daytime villa class: modern render, "brick has per-brick colour variation", "nothing visibly repeats"; B=ours ext_front_east.png). B: render now has faint mottling and panel joints (improvement), slatted wood cladding decent; but gabion rocks are identical sharp-cornered wedge/slab shapes in a regular jumble with one repeated brown-grey texture, entrance slabs flat pale beige, lawn a low-contrast noise with sparse card blades. A 7 / B 5. **HF2 wins.**

Result: HF2 3/3.

## Genuinely good / improved since r2
- Gabion now has real textured rock with multiple tones (r2: grey boxes) - biggest visible step up.
- Exposed-aggregate concrete on the driveway pads reads correctly at 5 m; paver herringbone/running bond at a believable scale.
- Pool coping has a dark granite-like speckle distinct from the pale deck tiles; slatted cedar cladding at entrance has good grain and per-board tone variation.
- Master bedroom oak floor, headboard fabric, rug weave all plausible at 3-5 m.

## Ranked problems
1. **Kitchen worktop** is still a woven-fabric normal/albedo pattern (Kitchen.png) - fixed-in-r2-list item not done; instantly wrong at any distance.
2. **Bathroom tiles**: grout is a thin painted black line, not a recessed lighter/darker mortar band; no per-tile tint/roughness jitter, no bevel highlight; floor tile is flat grey with dotted noise (bath_master, bath2_close).
3. **Entrance slabs/steps** (entrance_a): landing and treads still flat uniform pale concrete with barely visible texture, no edge wear/staining; step nosings are dead-black shadow bands with no concrete face texture.
4. **Gabion rocks** are faceted slab-shaped cards with obvious repeated form; too angular/regular, and cage rocks don't vary in size.
5. **Lawn** (lawn.png) is a smooth dark-green noise with isolated bright blades; no clumping, colour variation or soil patches at 1-5 m.
6. **Gravel** still near-white at the bed (gravel.png, entrance_a) and the gravel-path strips beside pavers look like salt; driveway joints are pitch-black grooves.
7. Walls/ceilings interior still read as flat paint at 5 m; outdoor coffee table wood is oversaturated orange with uniform stripe grain.

WINNER: HF2
BIGGEST_GAP: The kitchen worktop still renders as woven fabric and bathroom tiles still have thin painted black grout with no per-tile variation, so the two most material-critical interior rooms read as CG at a glance.
NEXT_FIXES: 1) Replace the kitchen worktop material with a real quartz/marble set (soft veining albedo, near-flat normal, roughness ~0.2 with breakup) - check the counter material binding in the kitchen/furniture material map and textures.json. 2) Regenerate bathroom tile sets (gen_textures.mjs) with 2-3 mm grout that is light grey mortar recessed via normal+AO, per-tile tint (+-4%) and roughness jitter, and a subtle bevel highlight; give the floor tile a stone/porcelain pattern not dot noise. 3) Entrance slabs/steps: stronger aggregate + large-scale mottling, darker edge wear and a textured riser face instead of black. 4) Gabion: randomize rock scale/rotation and round the edges (fewer slab-cards), add 2 more shapes. 5) Lawn: add macro colour variation (yellow/dark patches) and denser clumped blades near camera; darken gravel albedo to ~0.55 and lift paver/drive joint colour from black to dark sand. 6) Desaturate outdoor furniture wood and add grain variation.
