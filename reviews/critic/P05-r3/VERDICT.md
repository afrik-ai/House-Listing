# P05 Lighting & atmosphere: critic round 3

Captured at high quality, 1280x720, SwiftShader. There were two boots: `cap.mjs`, then `cap2.mjs`. The second boot was needed because the scripted kitchen pose is blocked by a black slab and the scripted "feet" poses did not show feet. Per-view `__game.stats()` are in `stats.json` and `stats2.json`. The fps readings are 0 because this is SwiftShader. Frames used about 380-690 draw calls and 0.64-1.2M triangles; gpuTex was 1020 MB.

## Scores (HF2 = described reference at full marks)
| Criterion | Ours | HF2 |
|---|---|---|
| Sun, shadows, window patches | 8 | 9 |
| Bounce / GI (no black, coloured bleed) | 4 | 9 |
| Contact AO feet | 4 | 9 |
| Exposure / bloom | 7 | 9 |
| Sky / golden hour | 6 | 9 |
| Night interiors | 7 | 9 |
| Night exteriors | 7 | 9 |
| Fixtures (emissive bulbs, pools) | 6 | 9 |
| **Overall** | **6.1** | **9** |

Improvement since r2: the night living room no longer blows out. The table and candles are readable, bloom is restrained, and the pendants and arc lamp show emissive bulbs. The master bedroom at night is warm and has separate lamp pools.

## Blind pairs (all description-based; coin flip true means A = ours)
1. **Day living room** vs `hf2-loft-living-room-brick-daylight.png` (crisp window patches, warm bounce under the chairs, readable shadow side, ceiling gradient). Flip=false, so B=ours.
   B: the long diagonal window patches are good. The ceiling is flat cream with no gradient toward the glass. The table and chairs get no warm underside bounce. The chair legs have no contact darkening. A 9, B 6.5. **HF2 wins.**
2. **Night living room** vs `hf2-living-room-fireplace-evening-modio.png` (several distinct pools, orange near fixtures and cool toward the windows, visible bulbs, subtle bloom). Flip=false, so B=ours.
   B: the blow-out is fixed and the bulbs are visible. But the whole room is one uniform warm wash. The pendant shades are mirror-bright bronze. There is no cool blue-grey falloff toward the glazing, and the pools do not separate. A 9, B 6.5. **HF2 wins.**
3. **Night exterior** vs `hf2-modern-villa-exterior-night-neon.png` (starry sky, moon with bloom, warm lit interiors, path lamps with ground pools). Flip=true, so A=ours.
   A: moon, stars, a glowing pool and lit furnished interiors, a strong frame. But the bollards still throw almost no pool on the lawn or paving, and the upper facade and soffit are near-black. A 7.5, B 9. **HF2 wins.**
4. **Kitchen day** vs `hf2-kitchen-cottage-day-cluttered.png` (warm floor bounce on the lower walls, no black anywhere). Flip=false, so B=ours.
   B: from the scripted pose and from `kitchen_c`, a tall unit or panel renders as a pure 0-black slab across 30-45% of the frame. It gets zero ambient at noon, and the plant leaves beside it are also near-black. From the clear pose (`kitchen_b`) the lighting is decent but flat, with no floor-to-wall colour bleed. A 9, B 3.5. **HF2 wins.**

Result: HF2 wins 4 of 4.

## Genuinely good
- The sun shafts and window patches on floor, rug and sofa are crisp and correctly shaped (living_day, feet_sofa, feet_dining).
- Night interior exposure is now sane. The bedroom night view (master_bed_night) is the best interior frame.
- Night exteriors: moon, stars, a milky-way hint, lit glass, pool glow.
- Golden hour ext0: the sun flare through the trees and warm grazing light read convincingly.

## Ranked problems
1. **Pure-black surfaces with no ambient floor.** The kitchen tall unit (`kitchen_day`, `kitchen_night`, `kitchen_c_day`) and the black base cabinets, window mullion sides and garage door all render at about 0. Interior plants are near-black in shade. This breaks the "no black corners" rule.
2. **Contact AO is still missing.** In feet_dining_day and feet_lamp_day, the chair and table legs meet the floor with no darkening. The marble lamp base has only a directional shadow and no occlusion foot. The sofa skirt (feet_sofa_b) and the bed base get barely any. Objects float.
3. **No colour bleed / GI tint.** White walls beside warm oak floors stay neutral, ceilings are uniformly flat, and furniture undersides get no bounce.
4. **Golden-hour and day skies/backgrounds.** In ext3_golden_hour a bright orange blurred blob (the distant tree billboard or impostor catching sun) sits behind the house. In ext1_golden_hour a smoky dark smear appears at the right edge. The ext3_day sky blows to white. The background conifers are soft and low-res.
5. **Night exterior fixtures lack ground pools.** The bollards are dots of light only, and the upper facade, soffit and front canopy go black (ext0_night, ext2_night).
6. **Night interior is a single warm key.** There is no warm/cool contrast toward the windows, and the pendant shades read as mirror-chrome hotspots.
7. **The day exterior is sun-flat.** The ext0 and ext2 facades barely separate sun from shade, and the foliage lacks translucency.

WINNER: HF2
BIGGEST_GAP: There is no indirect or ambient light floor: dark-albedo surfaces and anything out of direct light (kitchen tall unit and black cabinets, plant leaves, night soffits) render as pure 0-black, and nothing gets contact AO or coloured bounce, so objects float and rooms lack HF2's always-present GI.
NEXT_FIXES: 1) Add a per-room irradiance or hemisphere fill (light probes or baked lightmap indirect) with a minimum ambient so no lit-room surface drops below about 3-5% luminance; check the kitchen tall-unit and cabinet materials for a near-zero albedo or a broken envMap/normal (lighting setup / kitchen materials). 2) Contact AO: raise the SSAO/GTAO intensity at a small radius (about 0.2-0.4 m) at high quality, and add baked blob-AO decals under chair and table legs, the lamp base, the sofa, the bed and the dresser. 3) Warm floor-bounce tint on the lower walls and a ceiling gradient toward the windows (probe colour or lightmap). 4) Fix the distant-tree impostors that glow orange or smear at golden hour, and cap the day sky exposure (ext3). 5) Night exteriors: spot or decal ground pools for the bollards, uplight or downlight wash on the soffits and canopy, and a little moon fill on the facade. 6) Night interiors: add a cool fill near the glazing, and roughen or darken the pendant shade exterior so it stops mirroring.
