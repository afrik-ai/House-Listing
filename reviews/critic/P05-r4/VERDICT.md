# P05 Lighting & atmosphere: critic round 4

Capture: one boot, 1280x720, quality high, FOV 75. Frames taken with teleport + render + ~10 s wait + page.screenshot. Script: `cap.mjs`, per-view `__game.stats()` in `stats.json` (240 to 1236k tris, 192 to 688 draw calls; fps reads 0 under SwiftShader, so it is relative only).
The capture completed before the container restart, and every frame was opened with Read.
Kitchen: the default pose (`kitchen_day/night`) has a black tall unit filling the right 45% of the frame right at the camera. The alternative `kitchen_c` pose is also blocked (unit plus a plant). The left half of `kitchen_day` (island + open plan) was judged as the kitchen view.

## Scores (0-10, HF2 described frame = reference)
| Criterion | Ours | HF2 (described) |
|---|---|---|
| Sun & shadows (day) | 8 | 9 |
| GI / bounce / colour bleed | 5 | 9 |
| AO / contact shadows | 5 | 9 |
| Window light patches | 8 | 9 |
| Exposure / bloom | 7 | 9 |
| No pure-black surfaces | 3 | 10 |
| Sky / golden hour | 6 | 9 |
| Night interior (multi-source, warm/cool) | 7 | 9 |
| Night exterior (pools, glow, moon) | 7 | 9 |
| **Overall** | **6.2** | **9** |

## Blind pairs (description-based, coin flip decides which is A)
1. **Living room day vs `hf2-loft-living-room-brick-daylight`** (flip=false, so A=HF2 and B=ours). The description lists crisp window patches on the floor, bounce lighting the shade side, a warm underside on the chairs from the floor, and a ceiling gradient toward the windows. A: 9. B: crisp sun patches, the table casts a window-shaped shadow, the room is readable, but the ceiling is flat and uniform, the white walls get no warm floor tint, the chair undersides are neutral, and the black window frames and base cabinet are near 0. B scores 7. **A wins, so HF2 wins.**
2. **Bedroom night vs `hf2-living-room-fireplace-evening-modio`** (flip=true, so A=ours). The description has multiple pools, orange walls near fixtures, cool blue-grey toward the windows, and visible emissive sources. A: the bedside lamps glow, there are downlight scallops on the wall above the dresser, and the window shows a dusk sky. But the room is one uniform warm-grey fill with no cool side near the glass, and the lamp pools on the walls are faint. A scores 6.5 against B at 9. **HF2 wins.**
3. **Rear exterior night vs `hf2-modern-villa-exterior-night-neon`** (flip=true, so A=ours). The description has a starry blue sky, a moon disc with bloom, interiors lit and furnished through the glass, strip lights washing adjacent walls and ground, and path lamps with ground pools. A: the moon has bloom, there are stars, the glazing is warm and furnished, and the wall sconces wash the facade. The bollards throw only tiny pools, the upper facade/soffit is solid black, and a smeared orange/green blob sits on the horizon at the right. A scores 7 against B at 9. **HF2 wins.**
4. **Chair/table legs close-up vs the contact-hardening/AO clause of `hf2-kitchen-dining-farmhouse-day`** (flip=true, so A=ours). A: the sun shadows of the chairs are crisp. Where legs and the bench meet the floor in shade there is no occlusion foot, the table trestle and chair feet look pasted, and the sofa base (`feet_sofa_b`) has only a faint skirt darkening. A scores 5 against B at 9. **HF2 wins.**

Result: HF2 wins 4 of 4.

## What is genuinely good
- Day sun: crisp window-shaped patches across the oak in the living room and bedroom, plus soft foliage-dappled shadows on the sofa. This is the strongest part.
- Night living room: pendants, candles, arc lamp, downlights and a lit pool through the glass make a warm, multi-source room.
- Night exteriors: moon with bloom, stars, warm lit furnished glazing, and a dusk gradient near the horizon.
- ext0 day: a pleasant cumulus sky and a mid-key exposure.

## Ranked problems
1. **Pure-black surfaces persist (3rd round running).** The kitchen tall unit and base cabinets, window mullions and reveals, garage door and the upper facade at night all render at about 0. There is no ambient floor on dark albedo. `kitchen_day`, `kitchen_c_day/night` and `ext2_night` show this.
2. **No contact AO foot.** Chair and table legs, the storage bench, the sofa base and the lamp base meet the floor without occlusion in shade (`feet_dining_day`, `feet_sofa_b_day`).
3. **No coloured bounce.** The ceilings are uniform and flat, and the white walls beside the warm oak stay neutral. Furniture undersides are not warmed.
4. **Golden-hour horizon artifacts.** `ext3_golden_hour` has a big blurred orange blob behind the house. `ext1_golden_hour` has a dark smoky smear at the right. The lawn goes near-black.
5. **Night interior lacks cool/warm contrast.** The bedroom is one warm-grey wash, and the pendant exteriors mirror hotspots.
6. **Night bollards give dot-sized pools.** The soffit and canopy have no wash, and there is a coloured blob on the horizon in `ext2_night`.
7. **The kitchen spawn pose is blocked** by the tall unit at the camera. This is a view and pose issue, but it makes the kitchen look black.

WINNER: HF2
BIGGEST_GAP: Dark-albedo and out-of-sun surfaces (kitchen tall unit/cabinets, mullions, night soffits, lawn at golden hour) still crush to pure black and nothing gets a contact-AO foot or warm bounce, so the scene lacks HF2's always-present GI.
NEXT_FIXES: 1) Enforce an ambient/irradiance floor so that no surface in a lit room falls below about 4% luminance. Use per-room light probes or hemisphere fill, and audit the near-zero albedo on the kitchen tall unit and cabinet materials. 2) Add contact AO: GTAO at a 0.2-0.4 m radius with higher intensity at high quality, plus baked blob-AO decals under the chair and table legs, the benches, the sofa, the bed and the lamp bases. 3) Add a warm floor-bounce tint on the lower walls and a ceiling gradient toward the glazing, using probe colour or lightmap. 4) Remove or fix the far-tree/impostor blobs that glow orange or smear at golden hour and night (ext1, ext2, ext3), and lift the golden-hour lawn shadow fill. 5) Night: give the bollards larger ground-pool decals or spots, add soffit/canopy downwash, add a cool fill near the interior glazing, and roughen the pendant exteriors. 6) Move the kitchen view pose off the tall unit.
