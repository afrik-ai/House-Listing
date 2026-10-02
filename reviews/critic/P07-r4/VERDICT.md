# P07 Furniture & props — critic round 4

This was one boot at high quality, 1280x720, FOV 75. Every room in `__game.views()` was captured, plus the exterior `ext_front_east` and close-ups of the kitchen island, the living TV console and coffee table, and the sofa. The auto-picked "shelf" close-up landed on the exterior slat cladding, so it is not usable and I did not judge from it. Instead I judged shelving from room_office, room_storage_n and room_boiler.

## Stats
- `__game.stats()`: 249 draw calls, 675,602 triangles in the living/hall view.
- `__furnish.report` budget: furniture is 600,305 tris against a target of 600k or less, so it is **over by 305**. Draw calls are 335 against a target of 350 or less, which passes. Shadow: 425k tris and 236 draw calls.
- View budget: 388k tris and 203 draw calls. 539 clutter items in total.
- Clutter per room: office 121, bed3 62, kitchen 46. The low rooms are bath3 (8), wc (9), bath_master (9) and hall (11).
- doorBlocks and overlaps are both empty. The report says mirrors over windows were "removed" in wc and bath3, but both frames still show a black ring mirror frame across the window (see below).

## Scores (0-10, ours vs HF2 as described)
| Criterion | Ours | HF2 |
|---|---|---|
| Rooms furnished (coverage) | 7 | 9 |
| Lived-in density / clutter | 5 | 9 |
| Silhouette realism | 5 | 8 |
| Variety | 6 | 8 |
| Placement (no float/clip/block) | 5 | 9 |
| Garage | 3 | 8 |

## Blind pairs (description-based)
All pairs are scored against written descriptions in HF2_REFERENCE.md §3. Coin flips were false, false and true.

1. **Kitchen**: A=HF2 `hf2-kitchen-cottage-day-cluttered.png` ("well over 100 discrete objects", jars, mugs, fruit, plants), B=ours (room_kitchen).
   - A scores 9 on density and 8 on realism. B scores 6 on density and 6 on realism.
   - B has a real fruit bowl, bottles, a mug, a phone and jars on top of the cabinets. However, the cutting boards and books on the island read as flat stacked slabs, and the counter run is thin.
   - **A wins (HF2).**
2. **Living**: A=HF2 `hf2-loft-living-room-brick-daylight.png` (abundant small props, cushions, rugs, remote on the TV stand), B=ours (room_living and close_sofa).
   - A scores 9 on density. B scores 6 on density and 6 on silhouettes.
   - B's console shelf has books, a frame and a plant, and the coffee table has candles and a vase, which is good.
   - The weak points in B:
     - The sofa is smooth tubes with no seams, piping or visible legs.
     - The dining table has plates but no food.
     - There are no throws, magazines or remote.
   - **A wins.**
3. **Bathroom**: A=ours (room_bath_master), B=HF2 `hf2-bathroom-shower-cleaning-hud-prompts.png` (towels on hooks, toiletries, mat).
   - A scores 3 on density and 4 on placement. B scores 8.
   - A has one soap bottle, an empty ladder rail with a thin towel sliver and a bare floor. A black bar also floats on the wall above the door side.
   - **B wins (HF2).**

HF2 wins 3 of 3 pairs.

## What is genuinely good
- The office is the best frame (room_office.png). It has a full bookcase with frames and boxes, and a desk with a laptop, binders, a notebook, a pen pot and a plant. It reads as lived in.
- The kitchen island clutter includes a tea tray with a pot and cups, bottles and a fruit bowl.
- The master bedroom has a tufted headboard, lamps with glasses on the nightstand, and a rug.
- The laundry has a stacked washer and dryer with displays, plus a hamper.
- Storage and boiler shelving now carry boxes, cans and a toolbox.
- There are no door blocks, and no objects overlap.

## Ranked problems
1. **The garage is still the weakest room.**
   - The SUV is a blobby, low-detail shape, and the windscreen is a smeared translucent sheet.
   - A red cabinet is perched on top of a blue cart.
   - There is no pegboard, workbench, tools or oil stain.
   - The bicycle sits right in the camera pose.
2. **Bathrooms, WC and halls are near-empty**: 8 to 14 items each. There are no towels on the rails, no bath mats with thickness, no toiletry trays and no plants. The vestibule is bare.
3. **Mirror frames still cross windows in wc and bath3.** The black ring remains even though the report says the mirror was removed. A red/green object also hangs over the WC window.
4. **Wardrobe garments are flat slabs** in wardrobe_a and cloak, with no shoulders or sleeves.
5. **Clipping**: in storage_n a wire basket intersects the shelving upright. In the hall, the shoes and slippers and the white tub-like basket on the console look like placeholders.
6. **Soft silhouettes**: the sofa has no seams or legs. Bed2 is sparse, with a wall-sized wardrobe and a nearly bare dresser. Bed3's shelf holds blank white canvases.
7. **Budget**: furniture is 305 tris over 600k.

WINNER: HF2
BIGGEST_GAP: Wet rooms, halls and the garage are near-empty or placeholder-grade (bathrooms at 8-9 props, and a blobby SUV with no workbench or pegboard), so walking the house alternates between one rich room (the office) and bare boxes.
NEXT_FIXES: (1) Garage: model the SUV properly (separate glass, panel lines, less blobby body), add a workbench with a pegboard and tools, set the red cabinet on the floor and add an oil stain, and move the bike out of the view pose. (2) Bath_master, bath2, bath3, wc, hall and vestibule: bring each to 15 or more props (towels hung on the ladder rails and hooks, a thick bath mat, a toiletry tray, a plant, baskets, a key bowl on the hall console, a coat hook with a coat). (3) Actually delete the ring mirror frame over the windows in wc and bath3, and remove the object above the WC window; the furnish report check must cover the frame part, not only the glass. (4) Replace the slab garments with hanger, shoulder and sleeve silhouettes in wardrobe and cloak. (5) Fix the storage_n basket clipping through the shelving and replace the hall slippers and tub with real models. (6) Add seams, piping and visible legs to the sofa, and trim 1k+ tris to get furniture back under 600k.
