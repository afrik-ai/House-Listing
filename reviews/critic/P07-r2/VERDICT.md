# P07 Furniture & props — critic round 2

Captured in one boot (1280x720, high, day), 21 rooms from `__game.views().rooms` + close-ups of sofa (x2), kitchen hob run (x2), master bed (x2), garage. Frames grabbed with teleport -> render -> canvas.toDataURL (page.screenshot timed out under load). The first kitchen close-up and both "car" close-ups were aimed badly (they show window glass and cladding) and are not scored.

## Numbers
- `__game.stats()`: 406 draw calls / 1.059M tris at boot; 375 dc / 1.055M tris after the tour. **Whole scene is over the 350 draw-call budget.** Furniture tris aren't split out, so the <=600k furniture budget can't be checked; the report has no tri count.
- `__furnish.report`: 285 items, 149 instanced, 382 meshes, 98 merged (241 dc saved). No overlaps and no door blocks. 4 wall pokes: `kitchen/run` 12.7 cm x2 and `terrace/planter` 4.2 cm x2. 12.7 cm is a visible intersection, not rounding.

## Scores (0-10, HF2 = 10)
| Criterion | Ours |
|---|---|
| Coverage (every room furnished) | 7 |
| Lived-in density | 4 |
| Realism of individual pieces | 5 |
| Placement / no clipping / floating | 5 |
| Openings clear (doors, sliders) | 6 |
| Garage | 4 |
| **Overall P07** | **5** |

## Blind pairs (description-based; no HF2 images in this env). Coin flips: true/true/true -> ours = A in all three
1. **Kitchen density.** B = `hf2-kitchen-cottage-day-cluttered.png` as described: well over 100 discrete objects, jars, mugs, framed prints, fruit bowl, towels on hooks, plants, books. A = `close_kitchen_b.png` plus `room_kitchen.png`: toaster, kettle, pot, pan, 2 plants, a cutting board, a fruit bowl, a tea tray, a wine bottle. That's about 12 objects in total. The toaster and kettle are soft low-poly blobs, and the pot and pan crowd each other on the hob. Density A 3 / B 10; piece realism A 5 / B 9. **B wins. B = HF2.**
2. **Living room (framing 1/2).** B = `hf2-loft-living-room-brick-daylight.png` / section 3: tufted upholstery, turned legs, rugs, books, remote, cushions, candles, plants, no box silhouettes. A = `room_living.png` + `close_sofa*.png`: the sectional has a good woven fabric, and the room has a coffee table with books and candles, an arc lamp, a TV console and a rug. But the sofa is a set of rounded boxes with no seams, piping or legs. The cushions are slabs, and one bolster sinks into the back cushion. The room view itself opens with the camera buried inside a potted plant's leaves. Silhouette detail A 5 / B 9; density A 5 / B 9; placement A 4 / B 9. **B wins. B = HF2.**
3. **Bedroom.** B = HF2 section 3 bedroom norms: detailed silhouettes, clutter that tells a story (books, clothes, lamps, art). A = `room_master.png`, `room_bed2.png`, `room_bed3.png`, `close_bed*.png`: master is the best frame we have (channel-tufted headboard, lamps, dresser, art, plant). But **all three bedrooms use the identical bed with the identical black throw and pillow set**. The duvet is a smooth extruded slab with no wrinkles. The round "mirrors" render as flat black disks. Nightstands are bare. Realism A 5 / B 9; density A 4 / B 9. **B wins. B = HF2.**

Result: HF2 wins 3/3.

## Genuinely good
- Every room is furnished, including boiler, storage, laundry and wardrobes. The master bedroom and office (`room_office.png`: bookcase with varied book spines, laptop, desk lamp, clock, task chair) are convincing at a glance.
- Fabric and wood materials read well, and the rugs are good. No door is blocked, and the office and bath doors swing clear.
- The laundry machines are nicely detailed, with lit displays.

## Ranked problems
1. **Density is far below HF2.** The kitchen has about 12 props against 100+ in HF2. Bedrooms have 2-3 decor items. The hall and landing each hold one console plus a vase. Storage and boiler shelves are 70% empty. The bathrooms have one soap bottle and one towel.
2. **Repetition.** The same `bed_double_modern` appears in all bedrooms with the same bedding. The same vase with dried pampas is on every console. The same mountain print is in the office and the master.
3. **Box silhouettes.** Hanging clothes in the wardrobes (`room_wardrobe_a/b.png`) are rounded rectangles with no hangers or sleeves. Folded stacks are slabs. The cloak-room coats are flat panels. Toaster and kettle are blobby. Sofa and duvet are unseamed rounded boxes.
4. **Placement errors.** In bath3 the round mirror hangs in front of the window (`room_bath3.png`). The `kitchen/run` pokes 12.7 cm into the wall. In the kitchen view a tall black block fills the right half of the frame (`room_kitchen.png`). The living spawn view sits inside a plant. In the boiler room a red cylinder hangs on the wall with no bracket. In the WC the open door leaf sits right against the vanity.
5. **Garage is weak** (`room_garage.png`). The SUV has a blown-out white hood / black body material, and there are only a fridge, a bin, a red cabinet and a bike. There are no tools on the wall, no pegboard, no shelving clutter, no oil stains and no cardboard.
6. **Performance.** 375-406 draw calls for the scene, which is over the 350 budget. Furniture tris aren't reported, so the 600k budget can't be verified.
7. **The round mirrors are flat black discs.** No reflection is visible in the bedrooms and bath2.

WINNER: HF2
BIGGEST_GAP: Rooms are furnished but not lived-in: each room holds a handful of hero pieces with almost no small clutter (kitchen ~12 props vs HF2's 100+; bare nightstands, half-empty shelves, one soap per bathroom), and the pieces themselves are repeated, box-silhouetted and unseamed.
NEXT_FIXES: (1) Add a per-room clutter pass in src/game/furnish (kitchen: jars, utensil crock, mugs, knife block, dish rack, towels on the oven bar, cookbooks, spice rack; bedrooms: books, glasses, phone, clothes on a chair; baths: towels, toiletries, bath mat, plant; shelves filled to at least 70%) with a target of 60+ small props in the kitchen and living room. (2) Vary beds and bedding per bedroom (different frame, throw colour and pillow count) and add wrinkle/fold geometry to duvets. (3) Replace the slab clothes and coats in the wardrobe/cloak generators with hanger + garment silhouettes (shoulders, sleeves), and add a seam/piping/leg pass on the sofa. (4) Fix placements: the bath3 mirror over the window, the 12.7 cm kitchen/run wall poke, the living-room view spawning inside a plant, the red wall cylinder with no bracket, and the tall black block in the kitchen view. (5) Garage: fix the car's hood material, and add a pegboard with tools, a workbench with clutter, shelving with boxes and cans, a floor stain and a hose reel. (6) Merge or instance more to get the scene under 350 draw calls, and add furniture tri/dc counts to __furnish.report.
