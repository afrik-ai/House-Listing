# P02 House shell: critic verdict, round 1

**Scope.** Only the architecture as experienced in the running game: massing, proportions, wall thickness, reveals, trims, stairs and handrail, roofs, fascias, parapets, terrace frame, pergola, balcony, entrance steps, garage door, joints and walkability.
Lighting, colour and materials are ignored. Another agent was retuning lighting during this review, so some later shots have grass and a different exposure.

**Method.**
- Ran the standard tour, saved in `tour/`.
- Took 40+ targeted shots at 1600x900 on ultra (`shots.mjs`, `walk3.mjs`, `pairs.mjs`).
- Scanned every visible opaque mesh for coplanar overlaps (`zfight.mjs`).
- Checked collider bounding boxes (`bbox.mjs`).
- Ran scripted `__game.teleport` + `__game.move` traversal tests: every door in both directions, the stairs, the terrace, the balcony and the street approach (`walk.mjs`, `walk2.mjs`, `walk3.mjs`, `walk2.json`).
- The whole house is 39.8k triangles and 156 meshes.

## Scores (0-10; 10 = HF2-level geometry or better)

| Area | Score | Evidence |
|---|---|---|
| Architectural detail (rubric 5) | **4** | Real wall thickness, window reveals and interior sills (`tour/08_office.png`, `bed2_window_int.png`), and skirting everywhere. But there is no ceiling trim, no bevel on any wall or slab edge, no sockets or switches, and no threshold or sill on any sliding door. The window frames are flat black extrusions with no sash profile. The whole house is 40k triangles. |
| Massing and proportions | **5** | Staggered white boxes with a recessed anthracite band read as a modern villa, and storey heights and walkable scale feel right. But the white boxes are sharp-edged monoliths with 20 cm parapets and no coping, so they look like a massing model (`ours_ext_garden.png`). |
| Openings (reveals, sills, frames) | **5** | The best area. The larch box surrounds on the south windows have real depth and a black sill with a drip (`window_reveal_s.png`). The office and bedroom windows have a plaster reveal and a sill. But the big sliders sit on the floor with no threshold, track or sill (`living_slide_int.png`), and the garage opening is a bare hole with a flat slab door. |
| Trims (skirting, casings) | **5** | Skirting runs along every wall-floor junction, and door casings have a head with a small projection (`door_casing.png`). But the door leaves are flat slabs with no panel or stile, and there is no crown, shadow gap or any ceiling trim. The garage has no skirting. |
| Stairs and handrail | **2** | The balusters float: they end in mid-air above and between the treads, with no base rail or shoe, and some pass in front of the nosings (`stair_open_side.png`, `stair_side.png`). On the landing the stair's baluster rail runs 5 cm inside the glass void balustrade, so two rails clash (`hall1_void.png`, `tour/16_hall1.png`). The stair cannot be climbed (see Walkability). |
| Roofs, fascias, parapets | **4** | The standing-seam hip roofs have seams and a thin fascia (`hip_fascia.png`). But the flat-roof parapets are thin 20 cm upstands with no coping or flashing (`roof_parapet.png`, `aerial_ne.png`). The hips sit on top of the walls with overhanging eaves instead of hiding behind parapets. The eave overhang over the garage on the street side is a floating black slab edge (`garage_door.png`, top right). |
| Exterior elements (pergola, canopy, steps, garage door, balcony) | **3** | There is no pergola at all (no mesh exists). The entrance "canopy" is only a slatted soffit, with no deep white canopy slab or fascia (`canopy_soffit.png`, `front_door.png`). The entrance steps are two raw boxes. The garage door is a flat slab with a light slit along the bottom and uneven panel seams (`garage_door.png`), and its inside face is a featureless black plane (`garage_int.png`). The balcony glass is clean, with a proper base shoe (`balcony_south.png`). The terrace frame and pillars are present but plain. |
| Joint integrity (z-fighting, gaps, floating parts) | **6** | The automated coplanar scan found no overlapping coplanar faces, and I saw no z-fighting flicker. Defects: floating stair balusters, a light gap under the garage door, a larch sliver visible on the inside edge of the bed2 reveal (`bed2_window_int.png`, left jamb), and two balustrades overlapping at the stair head. |
| Walkability | **2** | 34 of 36 door passes work. But **the stairs cannot be climbed.** The player stops dead at x=8.08, y=0.84 (the fifth riser, directly under the first-floor slab edge at x=8.05) in 3 of 3 runs (`stuck_stairs.png`). **The terrace cannot be reached:** the living-room sliders are solid colliders and cannot be opened, and from the garden the terrace is a 0.31 m plinth with no step (blocked at z=10.77 and x=-2.9). **The balcony cannot be reached:** the master slider is solid. **You cannot walk in from the street:** the player is blocked at the entrance step, x=14.17, in 3 of 4 runs (`stuck_front_step.png`). Meanwhile the visually closed door leaves have no collision, so you walk straight through a closed door (`door_midpass.png` is the inside of a door leaf). |
| **Fidelity to client photos** | **3** | See the list below. The garden side is about 50% there. The street side misses most of its defining features. |

Walkability (2), stairs (2) and exterior elements (3) are all 3 or below, which is an automatic HF2 win.

### Fidelity checklist against the client's photos

**Street (east) side**
- MISSING: the projecting ground-floor white band on the left with a wide, low, dark-framed window. The ground floor on the left is a blank wall.
- MISSING: the tall light-grey concrete-look block with one narrow vertical window in the centre.
- WRONG: the first floor should have one large window beside an anthracite panel, with larch reveals. Ours has a small square window in a white box plus two small windows in an all-anthracite band, and no larch reveal on this side.
- WRONG: the front-door recess slats are vertical, and the client's are horizontal. The deep white flat canopy is missing; ours is a flush slatted soffit.
- WRONG: the client has a flat white roof band over the garage. Ours has a black hipped roof with overhanging eaves.
- WRONG: the client has low hipped roofs peeking above flat parapets. Ours has a hip roof sitting on the anthracite storey with eaves, which reads as a pitched second storey.
- WEAK: instead of wide stepped paving to the door, there is one 35 cm step block and a platform. There is no gabion wall.
- OK: a double garage with a flush dark door on the right, and a tall door in a timber-clad recess.

**Garden (west/south-west) side**
- OK: the white cantilevered roof over the terrace on two square white pillars. It is a solid slab rather than a frame.
- MISSING: the pergola of wood beams on the right.
- OK: full-height sliding glass along the ground floor.
- MISSING: the larch slat screen and vertical wood fins on the garden side. The only slat screen is on the kitchen window.
- OK: the first-floor balcony with a frameless glass balustrade.
- MISSING: dark anthracite panels between the big windows on the garden side, which is all white. There is no larch reveal on the master's west slider (the three south windows do have larch surrounds).

## Blind pairs (coin flip, both cropped to 1280x720, scored before the reveal)

Criterion: geometric richness and believability only (rubric 5 applied to the architecture).

| Pair | Framing | A | B | Winner | Ours was |
|---|---|---|---|---|---|
| 1 | Exterior day vs `hf2-aframe-cabin-exterior-forest-day` | 8 (exposed rafters, mullions, balcony rail, deck) | 4 (plain boxes, no pergola or fins) | A | B, lost |
| 2 | Empty room with window vs `hf2-empty-room-paint-roller-fpv-day` | 8 (sash window with mullions, casing, sill with nosing, radiator) | 5 (plain reveal, single black frame, thin sill) | A | B, lost |
| 3 | Living room with big glazing vs `hf2-loft-living-room-brick-daylight` | 8.5 (steel mullions, ceiling beams, concrete feature wall) | 4.5 (large frames, downlights, no threshold or trim) | A | B, lost |
| 4 | Stair or mezzanine interior vs `hf2-cottage-exterior-garden-picket-fence-day` (actually a café with a mezzanine) | 4 (stair with floating balusters, orphan wall block) | 9 (arches, curved counters, mezzanine beam, open stair, niches) | B | A, lost |
| 5 | Front exterior vs `hf2-modern-villa-exterior-night-neon` (geometry only) | 8.5 (canopy on columns, round openings, stepped entrance) | 5 (clean staggered boxes, slatted recess, bare steps) | A | B, lost |

**Result: 0 of 5.** Every HF2 frame layers secondary geometry (beams, mullions, sills with nosings, casings, rails that land on something). Ours stops at the primary volumes.

## What is genuinely good
- The overall composition reads as a contemporary white, anthracite and larch villa at a believable scale. Ceiling height, door height and stair pitch (17 x 185 mm risers, 270 mm treads) are all right.
- Walls have real thickness everywhere, and punched windows have proper reveals with interior sills. The larch box surrounds on the south facade, with black sills and a drip, are the best detail in the build.
- Skirting runs along every wall-floor junction, and every hinged door has a casing, a flush leaf and a lever handle.
- The slatted entrance soffit and recess cladding are real 3D slats, not a texture.
- The balcony glass balustrade has a proper base shoe and panel joints.
- There is no z-fighting (automated coplanar scan: 0 hits), and 34 of 36 interior door passes work.

## Problems, ranked
1. **The stairs cannot be climbed.** The capsule stops at x=8.08, y=0.84, under the first-floor slab edge at x=8.05, so the first floor is unreachable on foot. Two fixes are possible. One is to extend `structure.voids.stair_void` east to about x=9.3, over the first riser, so headroom is at least 2.3 m for the whole run. The other is to make `COL_stair` a smooth ramp and make sure the step-up probe does not test against the slab soffit. Retest with `walk2.mjs`.
2. **The terrace, balcony and front door cannot be reached.** The `COL_glass_slide_*` colliders are always solid, and nothing opens them. The terrace slab is 0.31 m above grade with no step. The entrance step (0.16 m then 0.15 m) blocks the capsule. The fix: add terrace steps (or drop the terrace slab to grade), make the sliders openable or leave one panel open, and make the entrance steps pass the step-up.
3. **The stair balustrade is broken geometry.** Balusters float with no shoe, stringer or base rail, and they do not land on treads. The stair rail runs through the glass void balustrade at the stair head. The fix: give the open side a closed stringer, land each baluster on its tread (two per tread), and end the stair rail at a newel before the glass starts, or run the glass down the stair and drop the balusters.
4. **Client-photo features are missing on the street side.** Add the projecting ground-floor band with its wide low window, the tall grey concrete block with its narrow vertical window, and the first-floor large window with an anthracite panel and larch reveals. Add a deep white canopy slab with a fascia over the door, and turn the recess slats horizontal. Replace the garage and centre hip eaves with flat white roof bands and parapets, with the low hips set behind them.
5. **The garden-side pergola and wood fins do not exist.** Add a pergola of larch beams on the right of the terrace frame, and add the larch slat screen with vertical fins beside the sliders. Add anthracite panels between the first-floor windows.
6. **There is no secondary trim anywhere.** Add parapet copings with a drip (about 40 mm overhang), bevels or chamfers on slab and wall edges, and a threshold, track and sill profile on all sliders. Give the garage door a frame and reveal and close the bottom gap. Add a sash or glazing-bead profile to window frames. Add panels or a shadow gap to door leaves, plus sockets and switches.
7. **Door leaves are visually closed but have no collision.** Until P09 animates the doors, either render them ajar or give them collision.

WINNER: HF2
BIGGEST_GAP: The shell is not playable as architecture. The stair blocks the player at the fifth riser under the slab edge at x=8.05, the terrace, balcony and front door cannot be reached (solid sliders, a 0.31 m terrace plinth with no step, an entrance step the capsule cannot climb), and the balusters float and clash with the glass balustrade.
NEXT_FIXES: 1) Extend stair_void east to about x=9.3 (or make COL_stair a ramp) and verify the climb to hall1 with __game.move. 2) Add steps from the garden to the terrace, make one slider panel on W_living_w, W_living_s and W_master_w passable, and fix the entrance step so the capsule can climb it. 3) Rebuild the stair balustrade: a closed stringer on the open side, balusters landing on treads, and the rail ending at a newel before the glass void balustrade. 4) Street facade fidelity: the projecting ground-floor band with its wide low window, the grey concrete block with its narrow vertical window, a deep white canopy slab with horizontal larch slats, and flat white parapet bands over the garage and centre with the hips set behind them. 5) Garden-side fidelity: a larch-beam pergola on the right of the terrace frame, a slat screen with vertical fins, and anthracite panels between the first-floor windows. 6) Secondary trim: parapet copings with a drip, edge bevels, slider thresholds and tracks, a garage door reveal with the bottom gap closed, and sash profiles.
