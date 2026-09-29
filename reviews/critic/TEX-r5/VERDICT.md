# TEX critic r5 — surface materials vs HF2

27 views captured in one boot (1280x720, quality high, day), all opened and judged. `cap.mjs` / `cap.log` in this folder.

## Scores (0-10, material realism only)
| Surface | Ours | HF2 (described) | Notes |
|---|---|---|---|
| Living wood floor | 6 | 8 | Plausible oak tone and plank scale; no gloss breakup or dull patches at 1 m |
| Slatted walnut wall / wardrobe veneer | 7 | 8 | Good grain; wardrobe veneer flat, no edge sheen change |
| Kitchen worktop (marble) | 6 | 8 | Veining visible on waterfall edge; top reads matte-flat, no reflection breakup |
| Kitchen floor tile | 5 | 8 | Large grey format, grout barely visible, no per-tile variation |
| Master bath wall/floor tiles | 5 | 8 | Large format, grout dark-painted, identical tiles, slight AO only |
| Bath2 tiles | 5 | 8 | Same material as master; no roughness variation, grout not recessed |
| Bath3 subway | 4 | 9 | Grout ~8 mm, dark and uniform — reads like brick wallpaper, not ceramic; one specular hit only |
| WC subway + mosaic floor | 6 | 8 | r4 diagonal UV bug FIXED, courses horizontal; grout still painted and too thick |
| Wall plaster / paint | 6 | 7 | Fine roller noise present, good |
| Exterior render + panels | 6 | 7 | Panel joints read; render too clean, no weathering/streaks |
| Entrance slabs / steps | 5 | 8 | Terrazzo-aggregate slab reads as speckle noise at uniform scale; risers pure black |
| Driveway slabs | 5 | 8 | Same speckle, identical across slabs, black joints |
| Gravel | 4 | 8 | Nearly white, uniform, no pebble relief |
| Lawn | 5 | 8 | Better macro colour than r4, but sparse stray blade cards on flat texture |
| Gabion | 4 | 8 | Still angular cube cards; in driveway close-up clearly identical pale blocks |
| Pool coping / patio | 6 | 8 | Coping granite speckle ok; patio tiles clean but uniform |
| Fabrics (outdoor cushions) | 7 | 8 | Weave visible, good |
| **Overall TEX** | **5.4** | **8.0** | |

## Blind pairs (description-based — reviews/hf2 is empty)
Coin flips: true / false / true (true = ours is A).

**Pair 1 — bathroom tiles.** Ref `hf2-bathroom-shower-cleaning-hud-prompts.png`: "subway tiles ~7.5 x 15 cm; tile grout is darker and recessed; ceramic reads distinctly at a glance; nothing visibly repeats". A = ours (bath3). A: tiles ~10x20 cm ok, but grout is thick, painted-dark and flat, every tile identical, ceramic gloss only in one spot. B (HF2 as described): recessed grout, ceramic reads instantly. Scores A 4 / B 9. **HF2 wins.**

**Pair 2 — living room materials.** Ref `hf2-loft-living-room-brick-daylight.png`: "wood shows grain, gloss breakup and dull patches; brick per-brick colour variation, rough mortar; wall paint fine roller noise". B = ours (living). B: slat wall grain good, floor has grain but uniform sheen, paint noise present. A (HF2): full roughness breakup. Scores A 8 / B 6. **HF2 wins.**

**Pair 3 — exterior/hardscape.** Ref `hf2-kitchen-dining-farmhouse-day.png` material clause "PBR with roughness variation... nothing visibly repeats" applied to exterior. A = ours (street facade). A: gabion repetitive blocks, slabs identical speckle, black joints, render spotless. B (HF2): varied, weathered. Scores A 5 / B 8. **HF2 wins.**

Ours: 0/3.

## Genuinely good
- WC subway UV now horizontal (r4 #1 fixed).
- Wood slat wall and cladding grain convincing; outdoor cushion weave reads as fabric.
- Plaster has roller noise; pool water and coping reasonable.

## Ranked problems
1. All tiles (bath3 subway worst, master/bath2 large format, kitchen floor): grout painted flat and too thick/dark, zero per-tile tint/roughness jitter, no bevel highlight.
2. Gabion fill still reads as cube cards, visibly repeating pale blocks at close range.
3. Aggregate slabs (entrance, driveway): uniform high-frequency speckle with no large-scale mottling, identical per slab, pure-black joints/risers.
4. Gravel too white and flat, no pebble normal/AO.
5. Lawn: flat base texture + sparse stray blade cards, no clumping.
6. No roughness breakup on wood floor, marble top or exterior render; no wear layer outdoors.

WINNER: HF2
BIGGEST_GAP: Every tiled wet-room surface still uses flat, identical tiles with thick painted-dark grout and no per-tile colour/roughness variation or recessed bevel, so bathrooms (especially the bath3 subway wall) read like brick wallpaper instead of ceramic.
NEXT_FIXES: 1) scripts/assets/gen_textures.mjs tile sets: grout 2-3 mm light grey, recessed via normal + AO, per-tile tint +-4% and roughness jitter, bevel highlight; apply to subway, large-format and mosaic. 2) Gabion: replace cube cards with rounded irregular rock meshes at random scale/rotation/tint. 3) Aggregate slabs: add low-frequency mottling, per-slab UV offset/tint, sand-coloured joints and textured (not black) risers. 4) Gravel: albedo down to ~0.5, pebble normal + AO. 5) Lawn: clumped denser blades near camera, drop sparse single cards. 6) Roughness breakup maps for wood floor, marble worktop and exterior render plus an outdoor edge-darkening/drip wear layer.
