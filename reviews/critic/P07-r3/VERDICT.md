# P07 Furniture & props: critic round 3

Build: http://127.0.0.1:5173/house.html?id=villa-nova, high quality, 1280x720, SwiftShader. I captured all 21 rooms from `__game.views()`, one exterior (`ext_front_east`), and close-ups of the kitchen island (`close_kitchen.png`), the master nightstand (`close_nightstand_b.png`) and the sofa (`close_sofa_a/b.png`). The shelf close-up only showed a wall, so I deleted it. For shelves, use `room_office.png`, `room_storage_n.png` and `room_boiler.png`.

## Stats
- `__game.stats()` at the spawn/views: **359-360 draw calls, 727-734k tris**. That is over the 350 draw-call target.
- `__furnish.report.budget`:
  - Furniture: **746k tris** against a 600k target (**FAIL**) and **511 draw calls** against 350 (**FAIL**).
  - Shadow pass: 535k tris, 280 draw calls.
- `view` (in:0): 501k tris, 337 draw calls, which is the only figure inside budget.
- Clutter: 505 items in total. Per room: office 126, bed3 54, kitchen 48, living 37, dining 26, hall 4, wc 6, bath3 6, bath_master 7, hall1 7.
- Warnings:
  - A mirror was "dropped" in front of an opening, but a mirror still hangs over the bath3 window.
  - terrace/planter pokes 4.2 cm into the wall.
  - No overlaps or door blocks were reported.

## Scores (0-10, HF2 = the written reference at full quality)
| Criterion | Ours | HF2 |
|---|---|---|
| Every room furnished | 8 | 9 |
| Lived-in density / clutter | 5 | 9 |
| Realism of each piece (silhouette, detail) | 5 | 8 |
| Variety | 6 | 8 |
| Placement (no float/clip/block) | 4 | 9 |
| Garage | 3 | 8 |
| Budget compliance | 3 | n/a |

## Blind pairs (description-based, coin flips: F, T, F)
**Pair 1: kitchen.** The reference is `hf2-kitchen-cottage-day-cluttered.png`: "well over 100 discrete objects", with jars, plants, mugs, framed prints, fruit bowl, towels and cookbooks. Warm wood floor bleeds colour onto the white walls. Cabinet doors are panelled and counters have a thickness edge. Coin flip: ours = B.
- A (HF2 as described): density 9, realism 8, composition 8.
- B: the curated kitchen view has a black slab filling the right 45% of the frame. It is the tall unit or plant seen from about 20 cm away. The island clutter (tea tray, wine, fruit, stools) is good in `close_kitchen.png`, but the back run holds only a toaster, kettle and two pans. B scores density 5, realism 6, composition 2.
- **A wins.** B was ours.

**Pair 2: bathroom.** The reference is `hf2-bathroom-shower-cleaning-hud-prompts.png` together with the §3 set-dressing list: "towels on hooks, toiletries, bath mat, plant". Coin flip: ours = A.
- A (`room_bath_master.png`): a large grey tile box. The only props are one soap bottle on a marble tray, one small towel on the rail and a bin. There are no bath mat, plant or baskets in frame. A scores density 3, realism 6.
- B (HF2 as described): density 8, realism 8.
- **B wins.** A was ours.

**Pair 3: garage.** The reference is §3 exteriors and utility: "tyres, bins, a car in the drive"; empty rooms still have "a paint bucket, cardboard on the floor". HF2 garages have workbenches and pegboards. Coin flip: ours = B.
- A (HF2 as described): density 8, realism 8.
- B (`room_garage.png`): an SUV whose black body is unlit and whose hood/windshield looks like a milky blown-out blob. The rest is a fridge, a bin, a red cabinet and part of a bike, on an otherwise empty grey box. There is no pegboard, workbench clutter or oil stain. B scores density 3, realism 3.
- **A wins.** B was ours.

**Result: HF2 wins 3/3.**

## Genuinely good
- The **master bedroom** (`room_master.png`) is the best view. It has a channel-tufted headboard, a varied pillow set, a throw, lamps, a rug, a dresser with books and a frame, a plant and a large print. The nightstand close-up has reading glasses, a glass of water and a small clock.
- **Bedding now varies** between rooms: bed2 has an orange throw, bed3 a green one, and the master a black and grey set.
- The **office** bookcase is dense and varied.
- The **kitchen island** close-up has real clutter (tea set, bottles, fruit, candle, cookbooks, stools).
- The **living/dining** area reads as lived-in, with a set table, candlesticks, a coffee table vignette and a styled media unit.

## Ranked problems
1. **Furniture is over budget: 746k tris and 511 draw calls, against 600k and 350.** The scene total is 360 draw calls. The builder is adding clutter without paying for it with merging or instancing.
2. **Placement bugs remain from r2 and were not fixed:**
   - The bath3 round mirror still hangs directly in front of the tall window (`room_bath3.png`), although the report claims it was dropped.
   - The kitchen curated view is still about 45% black slab (`room_kitchen.png`).
   - The WC door leaf still rests against the vanity (`room_wc.png`).
   - The boiler-room red cylinder still hangs with only a stub bracket.
3. **Clutter is badly uneven.** The office has 126 items, but the hall has 4, the wc 6, bath3 6, bath_master 7 and hall1 7. Bathrooms are nearly bare: one soap and one towel each, and bath3 has nothing on its vanity.
4. **Garage is unchanged and weak.** The car material is broken (a black unlit body with a milky hood), and there is no pegboard, tools, workbench clutter, boxes or floor stains.
5. **Box silhouettes are unchanged.**
   - The wardrobe garments are still flat rounded slabs with no hangers, shoulders or sleeves (`room_wardrobe_a.png`).
   - The cloak coats are dark planks, and the cloak room is mostly a bare wall.
   - Folded stacks are uniform cushions.
   - Storage and boiler boxes are plain boxes. The storage shelves are about 50% filled.
6. **Sofa is an unseamed rounded box.** Seen up close (`close_sofa_b.png`), there is no piping, seam or leg detail, and the bolster cushions look like pills.
7. **Island worktop material reads as woven fabric** rather than stone at close range (`close_kitchen.png`).

WINNER: HF2
BIGGEST_GAP: Placement and polish regressions persist from r2 and clutter is concentrated in a few rooms (office 126 items vs baths/halls 4-7). Worst cases: the bath3 mirror over the window, the black slab filling the kitchen view, the WC door on the vanity and the broken garage car. On top of this, the furniture budget is blown at 746k tris and 511 draw calls.
NEXT_FIXES: (1) Fix placements in src furnish:
  - Actually remove or relocate the bath3 mirror off the window.
  - Move the kitchen view camera, or the tall unit/plant blocking it.
  - Pull the WC vanity out of the door swing.
  - Add a real bracket/pipe to the boiler-room red cylinder.
(2) Bathrooms, halls and landing need 15+ props each: towels on hooks, bath mat, toiletries tray, plant, basket, shoes and keys bowl on the hall console. (3) Garage:
  - Fix the SUV material (lit body, glass separate from paint).
  - Add a pegboard with tools, a workbench with clutter, boxes and paint cans on the shelves, and an oil stain decal.
(4) Merge static clutter per room and instance repeated props, to get furniture to 600k tris or less and 350 draw calls or less. (5) Replace wardrobe and cloak slab garments with hanger and shoulder silhouettes, and add seams, piping and legs to the sofa. (6) Fix the island worktop material so it reads as polished stone (lower roughness, no weave normal).
