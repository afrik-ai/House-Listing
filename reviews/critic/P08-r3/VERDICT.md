# P08 Player controller & collision, critic round 3

I drove the real controller (`game._step` at a fixed 120 Hz, plus `__game.move`) with my own scripts: probe.mjs, probe2.mjs and probe3.mjs, which wrote metrics*.json.
Frames: f*, g*, h*, seq_down_*.png. The judgement is against HF2_REFERENCE.md §5 "First-person feel" and §7 footsteps. reviews/hf2/ is empty, so every pair below is **description-based**.

## Measurements (ours vs HF2 as described)
| Aspect | Ours (measured) | HF2 (described) |
|---|---|---|
| Eye / FOV | 1.65 m / 75 deg vertical | ~1.65 m / 75-80 |
| Walk | 2.60 m/s, 95% at ~0.25 s | 2.5-3 m/s |
| Sprint | 4.20 m/s (1.62x), FOV 75 to 80 (+5 deg, 95% at 0.25 s), release eases back in ~0.3 s | ~1.6x |
| Stop | 2.6 to 0 in ~0.075 s (walk), 4.2 to 0 in ~0.075 s (sprint) | instant stop |
| Crouch | eye 1.05 m, 1.3 m/s, stand-up eases in ~0.3 s | n/a (fine) |
| Head-bob | walk 4.9 mm p-p, roll 0 | a few mm |
| Main stair, 3 lanes (z 2.92/3.16/3.40) up | ok, 3.1-3.3 s, max cam Δ/tick 1.53 cm | smooth |
| Main stair down (walk), incl. last step | max cam Δ/tick 1.78 cm, 0 ticks > 1.8 cm; the r2 10.6 cm pop is **gone** | smooth |
| Stair down sprint | 2.35-2.48 cm/tick for 128 ticks (the ramp's own motion at 4.2 m/s) | smooth |
| Doorways (17 hinged) | front, wc, storage_n, cloak, storage_e, wardrobe_b, bath2, bath3 and laundry traversed; the rest pass the door and stop on furniture at room centre | passable |
| Wall slide / corners | 4/4 slides tangential; 28 sprint rams at 7 spots, 0 penetration (depth 0); 1 frozen spot (see #3) | slides, never stuck |
| Glass / closed door | blocks at 0.31 m / door plane z=2.88 | blocks |
| Footsteps | hall tile+oak, living oak, terrace/balcony tile light, garden stone_path, stairs stair_tread(wood), upstairs oak, bath tile, driveway pavers(stone), garage concrete(stone) | material matched |

## Blind pairs (description-based; coins false/true/true)
HF2 side, quoted from §5: "walk ~2.5-3 m/s, sprint roughly 1.6x, instant stop, capsule collision that slides along furniture, step-up onto low objects, no jump... Head bob is subtle (a few mm)... FOV 75-80... no fish-eye". Per the protocol, every listed property is present at full quality.
- **Pair 1, open-ground sprint (ours = B, h3).** A (HF2): 9. B: 1.62x sprint, +5 deg kick that reads cleanly with straight lines at 80 deg, instant stop, 5 mm bob. I score this 9, which is a tie, and a tie goes to HF2. **A wins (HF2).**
- **Pair 2, descending main stair to the hall (ours = A, seq_down_0..3).** A: smooth descent with no pop. At the foot, though, the open front-door leaf stands edge-on in the middle of the view (seq_down_3/f5) and physically fences the stair foot. The collider LEAF_D_front sits 0.25 m from (10.3, 3.03), so walking off the stair toward the spawn/front door dead-stops. I score this 7.5. B (HF2): 9. **B wins.**
- **Pair 3, driveway approach (ours = A, h1).** A: the paving looks continuous, but walking north at x=17.5 dead-stops at z=2.78, an invisible wall. The house driveway slab (SURF_concrete_pavers_driveway_2, top y=-0.15) sits 15 cm above the landscape paving the player stands on (y=-0.3). The 0.25 m step-up does not climb it, and nothing visible explains the stop. I score this 5. B (HF2): "step-up onto low objects", 9. **B wins.**

Result: 0/3 for ours.

## Scores (ours, 0-10)
Movement curves 9 · Sprint/FOV 9 · Crouch 8 · Head-bob 9 · Stairs 8.5 · Wall slide/corners 8.5 · Step-ups/outdoor seams **5** · Doors (dynamic leaves) 7 · Footstep surfaces 8.5 · **Overall feel 8.0** (HF2 = 9)

## Genuinely good
All the r2 findings are fixed. The stair last-step pop is gone (max 1.78 cm/tick on every lane), release-to-stop is ~75 ms, and bob is ~5 mm. Sprint speed and the FOV kick are on-spec. Collision inside the house is robust: no penetration in 28 sprint rams, glass and closed doors block, and walls slide cleanly. Footstep types follow the visible floor at every tested spot.

## Ranked problems (repro)
1. **Invisible 15 cm lip on the driveway.** teleport feet (17.5,-0.3,3.2), yaw 0, hold W. The player stops at z=2.78 on paving that looks continuous (h1). The horizontal ray at y=-0.2 hits the edge face of `SURF_concrete_pavers_driveway_2` at z≈2.55, and downward rays find no house mesh for z≥2.6 (the player stands on landscape at -0.3). The step-up (0.25) fails on a 0.15 m ledge. Check Physics.moveCapsule step logic against thin slab edges and landscape/house seams, or make the landscape paving flush.
2. **Open front-door leaf fences the stair foot and the vestibule.** Walk down the stair centreline to (10.3,3.03), then head +z toward the spawn. The player dead-stops, because LEAF_D_front/COL_DOOR_D_front is 0.25 m ahead (f5, seq_down_3). The door's default open pose swings the leaf into the circulation path. It should open against the wall (P09 pose/hinge side), or its collider should let the player slide.
3. **Frozen after resolving out of furniture.** teleport feet to the office centre (1.75,0,1.3). The player is pushed to (1.82,1.34) and then cannot move in ANY direction: 4 sprint directions for 3 s each moved 0 m, and `overlaps()` reports false. The same happens at the master bedroom centre (pushed to 1.27,3.15,7.38/7.57, frozen). Normal walking cannot reach this state, but a teleport, load or photo-mode exit can, and HF2 never soft-locks.
4. **Sprint descent** moves the camera 2.35-2.48 cm per tick for about 1 s. That is legal per the contract, but it reads as a ski-slope glide, not steps. A mild per-step cadence would read better.
5. Garage floor footstep `type` leaks a material key (`P07_plain_0.25|1|0|false`). The surface is correct (stone), but the raw type is junk for audio and debugging.

WINNER: HF2
BIGGEST_GAP: Outdoors the controller hits invisible walls on seams that look walkable. Walking north on the driveway at x=17.5 dead-stops at z=2.78 against a 15 cm slab edge (SURF_concrete_pavers_driveway_2) that the 0.25 m step-up should climb, and the open front-door leaf fences the stair foot, so movement is not HF2's "never stuck, step onto low objects".
NEXT_FIXES: 1) Physics.moveCapsule/Player step-up: climb any ledge up to 0.25 m, including slab edges where the player stands on landscape (repro 17.5,-0.3,3.2 yaw 0), and add this to scripts/tests/player.mjs; 2) make landscape paving and house driveway/entrance slabs flush (landscape plugin 10_landscape / driveway COL); 3) P09 door default pose: D_front leaf must rest against the wall, not across the vestibule/stair foot (or make leaf colliders thin and slide-friendly); 4) Player/Physics: when stuck but not overlapping for N ticks, run a depenetration and unstick pass (office/master centre freeze); 5) sanitize footstep `type` to the floor type, not the material key (surfaces.js).
