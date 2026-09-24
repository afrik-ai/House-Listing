# TEX critic r2 — surface materials vs House Flipper 2

Captured in two boots (1280x720, quality high, day, SwiftShader). Images in this folder:
Living room + Dining, living_floor, Kitchen, WC, Master bedroom, Master bathroom, bath_master_close, bath2, bath2_close,
ext_front_east, gabion, gravel, driveway, pool_surround, lawn. (ext_garden_sw did not finish before the boot ended.)
All blind pairs are **description-based** (reviews/hf2/ is empty).

## Scores (material fidelity, 0-10)
| Surface | Ours | HF2 (described) | Notes |
|---|---|---|---|
| Oak floors (living, bedroom) | 6 | 8 | Plank scale OK, some tone variation; gloss is uniform matte, no clearcoat breakup, grain soft |
| Interior walls/ceilings | 5 | 8 | New: fine stucco/roller noise visible on WC wall (r1 fix landed). Ceilings still flat |
| Bathroom tiles + grout | 3 | 8 | Large-format wall tiles are flat white, grout is a 1 px dark line, no recess, no per-tile tint/gloss jitter; floor is flat dark grey with sparse speckles |
| Subway tile (WC) | 5 | 8 | Correct ~7.5x15 scale, bevel reads, but identical tiles, grout uniform |
| Kitchen worktop | 3 | 7 | White top shows a woven/canvas pattern - reads as fabric, not stone/quartz |
| Wood furniture/vanity | 4 | 7 | Vanity/nightstand grain is a loud repeating straight stripe, saturated orange |
| Exterior render + panels | 5 | 7 | Panel joints and faint mottling; no base grime, no weathering |
| Concrete slabs/steps | 2 | 7 | Entrance slabs are flat untextured beige, no aggregate, no edge wear |
| Driveway pavers | 5 | 7 | Brick pattern visible but low-contrast, washed out |
| Pool coping/deck | 4 | 7 | Tile grid present; coping flat grey band, no wet darkening |
| Gravel | 6 | 7 | Real pebble texture at 1 m now; albedo too white (~0.85) |
| Lawn | 5 | 8 | Noisy green albedo + sparse blades; HF2 has dense 3D blades |
| Gabion stones | 1 | 7 | Stones are untextured grey CUBES/boxes - worse than r1's facets |
| Fabrics (bed, rug, sofa) | 6 | 7 | Rug weave and bed linen OK; cushions plasticky |
| **Overall** | **4.3** | **7.5** | |

## Blind pairs (description-based, coin flips recorded)
1. **Bathroom vs `hf2-bathroom-shower-cleaning-hud-prompts.png`** ("subway tiles ~7.5x15 cm; tile grout is darker and recessed; ceramic, chrome, glass read distinctly"). Flip=false -> A=HF2, B=ours (bath2_close.png).
   A: tile scale 8, grout 8, ceramic 8. B: tile scale 6 (large format, fine), grout 2 (hairline, not recessed), ceramic 6 (tub gloss OK). **Winner A = HF2.**
2. **Living room vs `hf2-loft-living-room-brick-daylight.png`** ("brick with variation and rough mortar; tile floor; materials read distinctly; no visible repeat"). Flip=false -> A=HF2, B=ours (Living room + Dining.png).
   A: 8/8/8. B: floor 6, walls 5 (flat white with little noise), slat panel 6, roughness variation 3. **Winner A = HF2.**
3. **Exterior vs `hf2-coffee-shop-interior-day.png` / `hf2-aframe-cabin-exterior-forest-day.png`** ("grass is 3D blades, not a texture; stepping stones; silhouettes never box-with-a-texture"). Flip=true -> A=ours (ext_front_east.png), B=HF2.
   A: lawn 5, paving 3, gabion 1, render 5. B: 8/7/7/7. **Winner B = HF2.**

Result: HF2 3-0.

## Genuinely good
- Interior wall plaster now has visible fine stucco noise (WC) - r1's top fix partly landed.
- Gravel beds finally have a pebble texture at the right 2-4 cm scale.
- Subway tile scale and bevel in the WC are right; rug weaves and bed linen read as fabric.
- Pool deck has a real tile grid; oak floor plank scale and tone are plausible at 5 m.

## Ranked problems
1. **Gabion wall** (most visible from the street, ext_front_east/gabion.png): stones are untextured grey boxes - no rock albedo/normal, identical cube shapes. Instantly reads as CG.
2. **Concrete entrance slabs/steps** (driveway.png): flat uniform beige, zero aggregate, stains or edge wear.
3. **Bathroom tiles** (bath2_close, Master bathroom): 1 px painted grout, no recess/AO, no per-tile tint or roughness jitter; walls look like a grid drawn on white paint.
4. **Kitchen worktop** reads as canvas/woven fabric (Kitchen.png) - wrong normal/albedo pattern for stone.
5. **Wood furniture grain** is a loud, repeating, oversaturated stripe (WC vanity, bedroom nightstand); floor has no gloss variation.
6. **Gravel albedo too bright** (near white) and pavers too washed out; lawn relies on a noise texture with sparse blades.

WINNER: HF2
BIGGEST_GAP: Hardscape materials are still untextured - gabion stones are plain grey boxes and the concrete entrance slabs/steps are flat beige with no aggregate or wear - so the street view reads as CG boxes before anything else is seen.
NEXT_FIXES: 1) Replace gabion fill with varied rounded/irregular rock meshes using a rock albedo+normal set with 3-4 tone variants (src/game/landscape/boundaries.js buildGabions). 2) Give concrete slabs/steps/coping an aggregate albedo+normal+roughness set with edge darkening and faint stains (slab_paths material in site.json / ground.js, textures.json). 3) Rebuild bathroom tile sets with 2-3 mm recessed grout (normal+AO), per-tile tint and roughness jitter, and a real stone/terrazzo floor (gen_textures.mjs). 4) Swap the kitchen worktop texture for a quartz/marble set (no woven pattern). 5) Tone down furniture wood grain (lower contrast, less saturated, random offset per piece) and add roughness breakup to the oak floor. 6) Darken gravel albedo to ~0.6 and raise paver contrast.
