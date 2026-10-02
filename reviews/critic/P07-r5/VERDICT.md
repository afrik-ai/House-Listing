# P07 Furniture & props: critic round 5

All captures come from one high-quality boot at 1280x720, plus a second short boot for the car's front three-quarter, because the first script's "car" regex matched `hedge_cards`/`cardboard`. I opened every image.

**Stats** (`__game.stats()`, living view): 300 draw calls, 721k tris in frame, 228 textures.
**`__furnish.report`**:
- budget: furniture 598,919 tris and 339 draw calls. Both are under the targets of 600k and 350, with 1.1k tris of headroom.
- view: 401k tris and 206 draw calls.
- clutter: 649 items in total. Per room: office 140, bed3 58, kitchen 46, living 37, bath2 36, storage_n 32, cloak 31, dining 29, bed2 28, laundry 25, hall 24, bath_master 22, master 20, garage 20, storage_e 20, wc 18, boiler 18, bath3 17, hall1 16, vestibule 12.
- mirrorsOverWindows: [] (empty, so none).

## Scores (0-10, HF2 = the written reference at full quality)
| Criterion | Ours | HF2 |
|---|---|---|
| Every room furnished | 7 | 9 |
| Lived-in density / clutter | 6 | 9 |
| Piece realism / silhouette detail | 5 | 8 |
| Variety | 6 | 8 |
| Placement (no float/clip/blocking/silly) | 5 | 9 |
| Garage (car + workbench) | 6 | 8 |
| **Mean** | **5.8** | **8.5** |

## Blind pairs (all description-based, coin flip: true means ours is A)
1. **Kitchen** vs `hf2-kitchen-cottage-day-cluttered.png`. The reference is described as "well over 100 discrete objects": jars, mugs, fruit bowl, candles, hooks with towels, plants. Coin flip: true, so ours is A.
   - A: the island holds wine bottles, a fruit bowl, a teapot tray, mugs and books. Pots, plants and jars sit along the counter, and a row of jars runs along the cabinet tops. About 45 objects in all. The walls are bare apart from one print, and there are no hanging utensils, towels, hooks, rails or open shelves.
   - B: 100+ objects, hooks with towels, lived-in chaos.
   - Scores: A 6, B 9. **B (HF2) wins.**
2. **Living room** vs `hf2-loft-living-room-brick-daylight.png`. The reference is described as having distinct materials, tufted upholstery, turned legs and dense props. Coin flip: true, so ours is A.
   - A: an L-sofa with coloured cushions, a marble coffee table with books, candles and a vase, an arc lamp, a Berber-style rug and a well-dressed console. The sofa is a soft block: no visible legs, no seams or piping, no tufting. The ~1 m close-up shows smooth bolster rolls only. The living room also has no side tables, throws or magazine clutter.
   - B: tufted upholstery with turned legs.
   - Scores: A 6.5, B 8.5. **B (HF2) wins.**
3. **Bathroom** vs `hf2-bathroom-shower-cleaning-hud-prompts.png`. The reference is described as subway tile, hooks with towels and full dressing. Coin flip: false, so ours is B.
   - A: HF2 per the description.
   - B: ours. The vanity is dressed only with an open caddy crammed with 8 bottles. In the wc view the bottles appear to sit in the basin, which is a silly placement. There is one towel rail with a flat folded slab, a bath mat and a lone rubber duck in an empty tub. The walls hold no hooks or robes, and there is no plant, laundry basket or shelf.
   - Scores: A 9, B 5. **A (HF2) wins.**

Result: HF2 wins 3 of 3.

## Genuinely good
- The living room, dining, kitchen, office, bed2 and bed3 are pleasant and coherent.
- The office bookshelf is rich.
- The boiler room and storage shelving are credible.
- The garage now has a pegboard with tools, a workbench, a red tool chest, a shelf with a drill, a bin and a fridge.
- The SUV front three-quarter (garage_car_2) has a credible silhouette, rims, roof rails and separate glass.
- The budget is met.

## Ranked problems
1. **Wardrobe and cloak garments are still flat slabs.** In room_cloak and room_master they are 2D cut-outs with no hanger, shoulder or sleeve volume, rendered dark and textureless, and they read as cardboard.
2. **Bathrooms and wc are thin.** Clutter counts: bath3 17, wc 18, bath_master 22.
   - The wc/bath3 basin is filled with bottles, which is a silly placement.
   - Towels are single flat slabs on ladder rails, with no drape.
   - The empty tub holds only a rubber duck.
3. **Several view poses show only a door or the inside of a wardrobe:** master, cloak, storage_e, wc, bath3, laundry and one wardrobe. In these rooms the furnishing cannot be judged from the standard views, and in some of them the pose is inside the furniture volume.
4. **Car hood material has a white blotchy "sheet" artefact.** Dark rear shapes (a door slab and a black post) sit next to the car in garage_car_3. The bike behind the car appears tucked against the wall, with no oil stain and no floor clutter.
5. **Sofa realism.** No legs, seams or piping (see close_sofa).
6. **Hall and vestibule** carry placeholder white block "slippers" and very few props (vestibule has 12). hall1 is a bare corridor with one console.
7. **Budget headroom is only 1.1k tris.** This blocks adding detail unless something else is decimated.

WINNER: HF2
BIGGEST_GAP: Soft goods are placeholder-grade: flat slab garments in the wardrobes and cloak, flat towel slabs, and a leg-less, seamless sofa, together with thin bathrooms whose basins are filled with bottles, make the house read as blocked-in rather than lived-in.
NEXT_FIXES: (1) Replace the garment slabs in cloak, master and wardrobes with hanger, shoulder and sleeve meshes (instanced, with fabric texture and lighter values). (2) Move the toiletries out of the wc and bath3 basins onto the vanity tops or shelves. Add hooks with robes, draped towels, a plant, a laundry basket and a wall shelf to bath_master, bath2, bath3 and wc (aim for 25 or more each). (3) Fix the standard view poses for master, cloak, storage_e, wc, bath3, laundry and wardrobe_a/b so they face the room's content and are not inside furniture or facing a door. (4) Give the sofa visible legs, seams and piping, and decimate hidden or offscreen props to make room in the budget. (5) Fix the white blotch on the car hood material, remove or position the dark slab next to the car in the garage, and add an oil stain and floor clutter. (6) Replace the white block slippers in the hall and vestibule, and add a key bowl, coats on hooks and a bench.
