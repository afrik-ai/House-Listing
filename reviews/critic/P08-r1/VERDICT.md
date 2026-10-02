# P08 Player controller & collision — critic round 1

Method: my own Playwright probes (probe.mjs, probe2.mjs) drive the real Player/Physics with `game._step(1/120)` and `P.simKeys`. Raw data is in metrics.json and metrics2.json, frames are f1-f7.png. I opened every frame with Read. There are no HF2 images (reviews/hf2 is empty), so the blind pairs are **description-based** against HF2_REFERENCE.md §5 and rubric criterion 8.

## Measurements
| Item | Ours | HF2 (reference) |
|---|---|---|
| Eye height | 1.65 m | ~1.65 m |
| Default FOV | **62°** (vertical) | 75-80 |
| Walk speed | 2.6 m/s. 0 to 2.34 in 0.2 s | ~2.5-3 m/s, snappy |
| Sprint | 4.2 m/s (1.6x). FOV kick measured +0.3° before blocking, spec says +4° | ~1.6x |
| Stop | instant against walls (release decay not isolated, see note) | instant stop |
| Crouch | eye 1.05 m, ~0.35 s ease down and ~0.4 s up, 1.3 m/s | n/a |
| Jump | 0.54 m apex, no bunny hop | **no jump** |
| Head bob (flat) | cam-feet oscillates 1.647-1.660 (about ±6 mm) | "a few mm" |
| Strafe roll | 0.6° | turning does not roll |
| Stairs up (3.15 m) | 3.2 s, smooth ramp, max per-tick cam delta 17 mm, no pops | smooth |
| Stairs down | 3.3 s, max per-tick delta 32 mm (at 120 Hz, i.e. continuous), no up-ticks | smooth |
| Wall slide | 30° into the kitchen island/wall: slides at 1.3-1.75 m/s, no sticking | slides |
| Corners / furniture | 20 sprint-into-corner tests: max penetration 7 mm, all escaped | clean |
| Fixed glass | blocked at x=0.31 | blocked |
| Closed door (office) | blocked at z=2.88 with 0 penetration | blocked |
| Footsteps | fire every stride. Hall tile/oak and upstairs oak correct, street concrete correct | per-surface audio |

## Blind pairs (description-based, coin flip decided A/B)
HF2 frame description used for all pairs (§5): "eye ~1.65 m, FOV 75-80 mild wide-angle, rooms feel roomy, walk ~2.5-3 m/s, sprint 1.6x, instant stop, capsule slides along furniture, step-up, no jump, subtle few-mm bob, no roll."

1. **Mid-stairs climb** (flip=false, so A=HF2 and B=ours f4_midstairs_up). A: 8. B: 7. Our stair motion is smooth and has no pops, but the 62° FOV makes the stairwell read as a narrow tunnel with a wall filling half the frame. **HF2 wins.**
2. **Mid-sprint in the hall** (flip=true, so A=ours f2_sprint_fov and B=HF2). A: 5. B: 8. Our frame looks cramped and zoomed-in, and the FOV kick is invisible in the frame. **HF2 wins.**
3. **Pressing into a wall / sliding** (flip=true, so A=ours f6_wall_press and B=HF2). Collision is solid in both: no clipping and a clean slide. Our framing is again tele: a bare wall fills the view. A: 7. B: 8. **HF2 wins.**
4. **Terrace walk with footsteps** (context: A=ours). Ours plays *grass* steps on a pale stone-tile terrace (f7) and on the upstairs balcony. HF2 has matching surface audio. **HF2 wins.**

Result: 0/4 for ours.

## What is genuinely good
- The collision core is solid. It had no penetration, no stuck points in 20 corner rams, glass and closed doors block, and dynamic door colliders work.
- Stairs are smooth in both directions with eased camera height, and they take a sensible ~3.2 s.
- Acceleration is snappy, crouch has a proper eased transition, jump spam is guarded, and head-bob is subtle.

## Ranked problems (with repro)
1. **Default FOV is 62° vertical.** HF2 reads at 75-80 and the frames look zoomed and claustrophobic in every interior. Repro: `__game.game.player.info().fov` returns 62. See f2, f4 and f6.
2. **Terrace and balcony report `grass` footsteps.** Repro: teleport feet to (-1.3, 0, 5) or (-1.3, 3.15, 5.16) and call `house.surfaceAt(P.feet)`. It returns 'grass', and walking emits `footstep{surface:'grass'}` on tile/stone decking (f7). Point (-5,-0.3,0.8) in the garden reports 'stone'.
3. **Sprint FOV kick is barely perceptible and slow to build.** It was +0.3° after 0.15 s, and it is imperceptible on top of a 62° base. Scale the kick to the base FOV and reach it within ~0.25 s.
4. **Jump and strafe roll (0.6°) contradict HF2**, which has no jump and no roll. Default jump off, or at least roll off.
5. **Probe caveat / possible issue:** walking east from (20,0,-4) stopped dead after ~0.3 m in open garden. Check whether invisible colliders (fence, boundary or hedge) sit there without matching visuals.

WINNER: HF2
BIGGEST_GAP: The camera defaults to a 62° vertical FOV (HF2 is 75-80), so every walk, stair and sprint frame looks zoomed-in and claustrophobic and the sprint FOV kick is invisible, despite solid collision underneath.
NEXT_FIXES: 1) Raise the default FOV to ~75 (Player setFov default / camera in Game.js) and make the sprint kick ~+5° reached in 0.25 s; 2) fix surfaceAt for terrace/balcony decking (house.surfaces / exterior floor typing) so footsteps say stone/tile, not grass; 3) turn off strafe roll and default jump to off to match HF2; 4) audit the collider near (20.3,0,-4) in the east garden for invisible blocking; 5) add a player.mjs assertion that surface type matches the visible floor material at terrace/balcony/garden spots.
