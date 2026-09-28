# P05 Lighting & atmosphere: critic round 2

All frames come from one boot at 1280x720, quality=high (cap.mjs, run.log). Per-view `__game.stats()` is in stats.json: 205-716 draw calls, 0.63-1.22M tris, 1020 MB GPU textures. fps reads 0 on SwiftShader, so it means nothing here.
Views: ext0-3 (front E, garden SW, south, NW) at day, golden_hour and night; living, kitchen and master_bed at day and night; feet_sofa, feet_sofa_b and living_floor as daylight close-ups.

## Scores (0-10, HF2 = written reference sec.1 at full quality)
| Criterion | Ours | HF2 |
|---|---|---|
| GI / bounce (no black corners, colour bleed) | 5 | 9 |
| Sun shadows (crisp + contact hardening) | 7 | 8 |
| AO feet / contact | 4 | 9 |
| Window light patches on floor | 7 | 9 |
| Exposure / bloom restraint | 4 | 9 |
| Sky / sun / golden hour | 6 | 8 |
| Night interior (warm, multi-pool, warm/cool contrast) | 4 | 9 |
| Night exterior (moon, stars, glowing interiors, path pools) | 7 | 9 |
| Fixtures (visible emissive sources) | 6 | 8 |
| **Overall** | **5.5** | **8.7** |

## Blind pairs (description-based, coin flips logged)
1. **Day living room** vs `hf2-loft-living-room-brick-daylight.png` (window-shaped patches on the floor, warm bounce under the chairs, shadow side readable, soft ceiling gradient). Flip=true, so A=ours.
   A: sun patches from the glazing are crisp and good. The ceiling is flat white with no gradient. The furniture undersides get no warm bounce, and the sofa and table sit on the floor with no contact darkening. A 6, B 9. **B wins (HF2).**
2. **Night living room** vs `hf2-living-room-fireplace-evening-modio.png` (several pools, orange near fixtures and cool toward the windows, visible bulbs, subtle bloom). Flip=false, so B=ours.
   B: bloom is milky and blown. The dining table, plates and candles burn to near-white, and a large halo covers the pendant and the ceiling. The whole room is one flat warm key with no cool falloff toward the glass. Pools do not read as separate. A 9, B 4. **A wins (HF2).**
3. **Night exterior** vs `hf2-modern-villa-exterior-night-neon.png` / beach-house dusk (starry blue sky, moon disc with bloom, warm furnished interiors through the glass, path lamps with ground pools). Flip=false, so B=ours.
   B: this is the best frame we have. It has a moon with bloom, stars, warm lit interiors, bollards and a glowing pool. Against HF2, the bollards leave almost no ground pool, the lawn foreground is crushed to pure black, and the wall washers throw little coloured light onto the ground. A 9, B 7. **A wins (HF2).**
4. **Kitchen night / day** vs `hf2-kitchen-cottage-day-cluttered.png` (warm floor bounce on the lower walls, nothing black). Flip=true, so A=ours.
   A: the right 45% of the frame is a pure-black slab (the tall unit or wall nearest the camera). It gets zero ambient or bounce by day and by night. The recessed-downlight halos on the ceiling at night are oversized. A 3, B 9. **B wins (HF2).**

Result: HF2 wins 4 of 4.

## What is genuinely good
- The sun shadows and window patches in the living room and on the sofa close-ups are crisp and correctly shaped. The rug shows leaf-dappled shadow.
- The night exteriors have real atmosphere: moon, stars, warm glowing glass, pool glow, bollards.
- Golden hour gives a warm facade key against a blue-gradient sky, and it reads well (ext1).
- The master bedroom at night is the best interior: the lamps are visibly emissive and the exposure is sane.

## Ranked problems
1. **Night interior bloom and exposure blow-out** (living_night, kitchen_night). Bloom threshold and strength are too high, and the pendants and candles saturate whole surfaces to white. It is exactly the "milky full-screen haze" HF2 never shows.
2. **Surfaces in shadow go to pure black** (kitchen_day and kitchen_night, right half; ext3_night foreground lawn; ext0_night gabion). There is no ambient or bounce floor, which breaks the "no black corners" rule.
3. **Weak contact AO.** The sofa, table legs and floor lamp base show no grounding darkening in feet_sofa, feet_sofa_b and living_day, so objects float. SSAO is either absent or too weak or small in radius at `high`.
4. **No coloured bounce.** Walls under warm wood floors stay neutral, and the ceilings are flat and uniform with no gradient toward the windows.
5. **Daytime exteriors look flat and overcast-lit.** The facades show almost no sun-versus-shade contrast (ext0, ext2), and the trees lack translucency.
6. **Night exteriors:** the bollards and wall washers make almost no light pools on the paving or lawn, and there is no cool/warm spill.
7. The fixtures' downlight halos are oversized (kitchen_night ceiling).

WINNER: HF2
BIGGEST_GAP: Night interiors blow out under heavy, low-threshold bloom and overexposure (dining table and ceiling burn to white) while unlit surfaces fall to pure black (kitchen tall unit, night lawn), so there is neither HF2's restrained mid-key exposure nor its always-present bounce fill.
NEXT_FIXES: 1) Raise the bloom threshold (to about 1.0 or more in linear space), cut its strength by about half, and lower the night exposure and point-light intensities on the pendants and candles (postFX/lighting). 2) Add an ambient/bounce floor: a hemisphere or irradiance probe per room, or lightmap/AO-baked indirect light, so no surface renders at 0 (kitchen tall unit, night lawn). 3) Strengthen contact AO: increase the SSAO/GTAO intensity and use a small radius at high quality, plus baked or decal AO blobs under the sofa, tables, lamps and beds. 4) Add warm floor-bounce tint and a ceiling gradient in interiors (lightmap or probe colour). 5) Night exteriors: give the bollards and wall washers visible ground pools (spot or decal) and lift the moonlight fill on the lawn. 6) Daytime exterior: increase the sun-to-sky ratio so the facades show clear sun and shade contrast.
