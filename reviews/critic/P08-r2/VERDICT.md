# P08 Player controller & collision — critic round 2

Harness: my own Playwright probes (`probe.mjs`, `probe2.mjs`) drive the real Player at the fixed 120 Hz step, with a `__game.move('w',1)` sanity check (`move.json`: 0.40 m in 1 s against the east facade, grounded, no penetration). Raw data is in `metrics.json` and `metrics2.json`. I viewed frames f2-f10.

## Measurements
| Item | Ours | HF2 (written ref) |
|---|---|---|
| FOV | 75 vertical | 75-80 |
| Walk | 2.60 m/s, 90% in ~0.35 s | ~2.7 |
| Sprint | 4.20 m/s (1.62x), FOV 75 to 80 (+3.5 at 0.3 s) | ~1.6x, gentle kick |
| Stop | 2.6 to 0 in ~0.35 s (exp. glide) | "instant stop" |
| Crouch | eye 1.65 to 1.05 in ~0.4 s, 1.3 m/s, eased | n/a |
| Head bob | walk 21.8 mm p-p, sprint 30 mm p-p | "a few mm" |
| Roll / jump | 0 deg / off | none / no jump |
| Stairs up | 3.47 s, max per-tick cam delta 1.7 cm | smooth |
| Stairs down | 3.40 s, **one 10.6 cm camera drop in one tick at the bottom step** (feet 0.106 to 0 at x=9.72,z=3.24) | smooth |
| Wall slide | 4 of 4 angled walks slide tangentially, 0 penetration | slides |
| Corners | 20 sprint rams, 0 stuck, max depth 7 mm | no stuck |
| Glass / closed door | block (0.31 m from glass; door at z=2.88) | block |
| Footsteps | hall carpet (rug)/tile, living oak, terrace tile, garden stone_path, street/driveway concrete, upstairs oak | matches floor |

## Blind pairs (description-based, coin flips false/true/true)
Reference: HF2_REFERENCE.md sec. 5, "walk ~2.5-3 m/s, sprint roughly 1.6x, instant stop, capsule collision that slides along furniture... Head bob is subtle (a few mm vertical sway)... FOV 75-80... straight lines stay straight". Rubric 8.
- **Pair 1, sprint (ours = B, f2).** A (HF2 described): instant response, subtle bob, gentle kick, scored 9. B: 80-degree kick is readable in the frame and speed ratio is right, but the ~0.35 s glide at release and 3 cm sprint bob are clearly more than HF2 describes, scored 7.5. **A wins (HF2).**
- **Pair 2, mid-stairs (ours = A, f4).** A: good framing and a smooth climb, but the descent ends in a 10.6 cm one-tick camera snap, scored 7. B (HF2): stairs are smooth both ways, scored 9. **B wins (HF2).**
- **Pair 3, terrace / surface (ours = A, f7).** A: the terrace reads as pale tile, footstep = tile/large_format_tile_light, the view is roomy, and the lines are straight. That is a real match, scored 8.5. B (HF2): footsteps change on tile, scored 9. Per protocol, a tie or doubt goes to HF2. **B wins (HF2), but narrowly.**
Result: 0/3 for ours, and all three were close.

## Scores (0-10, ours)
Movement curves 8 · Sprint/FOV 8 · Crouch 8 · Head bob 6.5 · Stairs 6.5 · Collision/sliding 9 · Doors/glass 9 · Footstep surfaces 8.5 · **Overall feel 7.8** (HF2 = 9).

## Genuinely good
Round 1 fixes landed. FOV is 75, the kick is +5 deg in ~0.3 s, roll and jump are off, and terrace/balcony steps report tile. Collision is robust: there was no stuck point in 20 rams, sliding is clean, and glass and closed doors block. The east-garden block at (20.3,-4) is a visible hedge (f9), so it is legit.

## Ranked problems (repro)
1. **Stair-descent bottom pop.** Teleport feet to (4.0,3.15,5.2), follow waypoints (4.0,3.16), (4.4,3.16), (9.6,3.16), (10,3.6) holding W. At about tick 381 (x=9.72,z=3.24), feet.y goes 0.106 to 0 and cam.y goes 1.7586 to 1.6522 in one 1/120 s step. The step-down smoothing (`_stepOffset`) does not cover the last riser onto the hall floor, and possibly the stair collider ramp ends above floor level.
2. **Stop glide.** Releasing W decelerates exponentially over ~0.35 s (2.33, 1.22, 0.64, 0.33 m/s at 50 ms steps). HF2 stops instantly, so this feels floaty. Raise the ground friction/decel ~3x.
3. **Head-bob too large.** Walk is 21.8 mm peak-to-peak and sprint is 30 mm (Player.js bobY 0.022*a). HF2 is "a few mm". Halve it or more.
4. `house.surfaceAt()` still returns 'grass' on terrace, balcony and driveway, although the player's own `floorSurfaceAt` is right. Any other consumer (Audio fallback, tests) gets wrong data.

WINNER: HF2
BIGGEST_GAP: Walking down the main stair drops the camera 10.6 cm in a single tick at the last step (x≈9.72, z≈3.24, feet 0.106→0), a visible pop, and it comes with a floaty ~0.35 s stop glide and a ~2 cm head-bob, where HF2 is smooth, stops instantly, and bobs only a few mm.
NEXT_FIXES: 1) Player.js step-down smoothing: route every downward snap (incl. last riser onto floor) through _stepOffset easing, and/or extend COL_stair ramp flush to floor y=0; 2) make release decel near-instant (stop within ~0.08 s) in Player.js velocity damping; 3) cut head-bob amplitude (bobY 0.022 -> ~0.008, bobX 0.012 -> ~0.005) so walk p-p is ~5 mm; 4) make house.surfaceAt use the same downward-ray logic as player/surfaces.js floorSurfaceAt (terrace/balcony/driveway return grass); 5) add a player.mjs assertion: max per-tick camera Δy < 2 cm on both stair directions.
