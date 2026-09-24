# P03 Exterior finish: critic round 1 verdict

Critic: fresh P03 r1 critic. I judged only the running game at `http://127.0.0.1:5173/house.html?id=villa-nova` (quality `high`, 1600x900, real RTX GPU through Playwright). I did not read builder notes or `reviews/p03/`.
Scope: facade finish only. Massing, landscape, furniture and overall exposure were not scored.

Capture notes: the machine was heavily loaded. One cold load took 17 minutes, and concurrent HMR reloads killed the stock harness three times. My capture script blocked the Vite HMR socket so the page stayed stable, and every per-shot wait had a 60 s timeout. All 27 shots rendered with no console errors.

## Shots (all in this folder)
- Day: `d01_street`, `d02_garden_sw`, `d03_south`, `d04_northwest`, `d05_entrance`, `d06_door_handle` (1 m), `d07_garage_door`, `d08_garage_close` (2 m), `d09_block_reveals`, `d10_south_upper_close`, `d11_south_upper_far`, `d12_living_glass` (2.5 m), `d13_kitchen_window` (2 m slat screen), `d14_pergola`, `d15_balustrade`, `d16_balcony_roofs`, `d17_street_close_fascia`
- Golden hour: `g01_street`, `g02_entrance`, `g03_garden_sw`, `g04_south_upper`
- Night: `n01_street`, `n02_entrance`, `n03_entrance_far`, `n04_garden_sw`, `n05_south`, `n06_pergola`

## Scores (0-10, facade scope)

| # | Criterion | Ours | Evidence |
|---|---|---|---|
| 1 | Material fidelity: white render | 3 | Reads as a flat, untextured CG white with no grain, trowel noise or dirt at the base, whether at 2 m or 20 m (`d10`, `d15`, `d17`). |
| 2 | Material fidelity: anthracite panels | 4 | Near-black (not RAL 7016 blue-grey), roughness 1 with no sheen, and the vertical joints are barely legible. At night it becomes a black void (`d01`, `d07`, `n03`). |
| 3 | Material fidelity: concrete-look block | 7 | Good formwork panels with tie holes and a believable scale (`d09`). The best facade surface. |
| 4 | Material fidelity: larch | 7 | Real slat depth and gaps, grain, warm tone. The entrance recess reads more red cedar/teak than honey larch (`d05`). Reveal returns and pergola beams show large swirly rotary-cut/burl grain, which is the wrong orientation and too large in scale (`d10` right reveal, `d14`, `d15`). |
| 5 | Glass | 4 | Front-on at eye level the panes mirror a sky cube with clouds at floor height, never the garden, terrace or house opposite (`d12`, `d16`). At oblique and far views, and at golden hour, they are fully clear holes with no Fresnel sheen (`d02`, `d11`, `g04`). |
| 6 | Frames, door, garage door | 5 | The slim black frames and sills are right. The front door is a flat matte black slab with a good long pull (`d06`). The garage door is ribbed black plastic, not a flush anthracite panel, and flat-shaded with no sheen (`d08`). The mullion of the south upper window shows a dashed, stretched texture artefact (`d10`, blind pair 3). |
| 7 | Edge crispness / joints | 6 | Fascia panel joints and copings exist and are crisp by day (`d07`, `d09`). But the coping/joint strips render as dotted/dashed lines along every parapet (`d01`, `d10`), and at night these become glowing dashed seams across the fascias (`n01`, `n03`). |
| 8 | Architectural detail density | 7 | Deep larch reveal boxes with sills, the slat screen on brackets, a soffit of slats, a frameless balustrade with a base channel, square wall lights, and the entrance canopy all read. Missing: visible standing-seam roofs and hip caps, flashing detail, drips under sills, fixings. |
| 9 | Holds up at 2 m | 5 | The larch and concrete block survive. The render, garage door, anthracite and door leaf fall apart into flat colour (`d06`, `d08`, `d15`). |
| 10 | Holds up across the garden | 7 | The composition and palette are clean and convincing at 15-25 m (`d02`, `d11`). |
| 11 | Wall lights, golden hour and night | 6 | The up/down washes beside the garage and on the balcony wall are the nicest thing at dusk (`g01`, `n01`, `n06`). The fixture lens itself never glows, and the washes are fake quads that light nothing around them. The south and garden facades have no wall lights, so the white render goes to murky grey-blue. The soffit downlights at the entrance are warm and good (`n02`, `n03`). |
| 12 | Fidelity to client reference | 5 | Present: white render with fascia joints, larch recess, larch reveal boxes, concrete block, slim black frames, a long pull on a tall black door, white pergola with wood beams, square black wall lights. Wrong or missing: the anthracite has no sheen and is too black; the glass does not reflect sky and garden believably; the garage door is ribbed rather than flush; there are no dark standing-seam roofs peeking over the parapets from any ground view (`d01`, `d04`, `d11`); the larch is too red at the recess. |

Rows 1 (render, 3) and 5 (glass, 4) are at or near the auto-fail line. The render is the largest visible surface on the house.

## Blind side-by-side (5 pairs, coin-flipped, sharp-resized to 1600x900, key sealed until after scoring)

| Pair | Framing | A | B | Winner | Ours was |
|---|---|---|---|---|---|
| 1 | Street approach, day (`d01` vs HF2 A-frame) | Mat 5 / Detail 7 | Mat 8 / Detail 7 | B | A: **lost** |
| 2 | Covered terrace/pergola, day (`d14` vs HF2 beach shack) | Mat 8 / Detail 8 | Mat 5 / Detail 7 | A | B: **lost** |
| 3 | Close-up window crop (`d10` vs HF2 A-frame crop) | Mat 5 / Detail 6 | Mat 7 / Detail 7 | B | A: **lost** |
| 4 | Night facade near (`n03` vs HF2 diner) | Mat 8 / Night 9 | Mat 4 / Night 6 | A | B: **lost** |
| 5 | Night street (`n01` vs HF2 modern villa) | Mat 7 / Night 9 | Mat 4 / Night 6 | A | B: **lost** |

Result: **0 of 5 won.** HF2's facades carry surface information everywhere: weathered clapboard, corrugated cladding, shingles, dirt layers, and dappled shadows breaking up the planes. Ours has clean, correct architecture on surfaces that read as untextured CG. That gap is the difference in every pair. Pair 5 was the closest: our restrained warm night reads as a more realistic villa, but the facade planes themselves disappear. Caveat: HF2's `hf2-cottage-exterior-garden-picket-fence-day.png` is actually a coffee-shop interior and `hf2-snowman-front-yard-winter-closeup.png` is a derelict bathroom (both mislabelled), so the exterior close-up pair had to be a crop.

## What is genuinely good
- The larch slat cladding at the entrance recess: real slat relief, shadow gaps, grain, and a lovely warm glow under the soffit downlights at night (`d05`, `n02`).
- The larch reveal boxes around the upper windows have real depth, cast soft shadows on the render, and are the signature of the facade (`d10`, `d11`).
- The concrete-look block with formwork joints and tie holes (`d09`).
- The kitchen slat screen on black brackets, with the window visible behind (`d13`).
- The up/down wall-light washes by the garage at golden hour and night (`g01`, `n01`).
- Slim black frames with real sills, and a tall black door with a full-height steel pull. The palette and proportions match the brief.

## Ranked problems
1. **The white render is a flat untextured colour.** No micro-normal, roughness noise, subtle tonal variation or ground-level dirt. It is most of the facade, and it is what makes every blind pair read as CG (`wall_ext_white`, roughness 1, no maps in the scene probe).
2. **The glass reflects only the sky cube.** At eye level you see clouds at floor height and never the garden or terrace. Obliquely, and at golden hour, the glass disappears into holes. It needs a local reflection source (a box-projected probe/cube camera per facade, or SSR) plus a Fresnel-driven reflectance so the glass reads as low-iron glass.
3. **The anthracite panels and garage door are near-black and dead matte.** RAL 7016 is a blue-grey around #383E42 with a slight satin sheen, and the brief calls for a flush garage door, not a ribbed one. Today both read as black plastic and vanish at night.
4. **Dotted/dashed seam artefacts on fascias and copings.** The joint strips (`EXT_joint`/`EXT_coping`) render as broken dashed lines by day and glowing dashes at night. The mullion on the south upper window shows a stretched dashed texture.
5. **Wood grain orientation and scale on the reveal returns and pergola beams.** Large swirly rotary/burl figure instead of straight larch grain running along the member. The entrance larch skews red-orange rather than honey.
6. **No standing-seam roofs or hip caps visible from any ground view**, and no flashing or sill-drip detail. The client photos show dark roofs peeking over the parapets.
7. **Night coverage.** The wall-light lenses are not emissive, the washes are fake and light no surroundings, and the south and garden facades have no wall lights.

WINNER: HF2
BIGGEST_GAP: The white render (and the anthracite panels) are flat untextured colours with roughness 1 and no maps, so the largest surfaces of the house read as clean CG next to HF2's detailed facades. Adding a fine render normal/roughness/albedo-variation set with base grime, and giving the anthracite a satin RAL 7016 finish, would close most of the gap.
NEXT_FIXES: 1) wall_ext_white: add a CC0 fine plaster/render texture set (albedo variation plus normal plus roughness 0.75-0.95 breakup, about 1 m tiling, triplanar or UV-safe) and a subtle darker splash/grime band on the bottom 30 cm; 2) glass: add a per-facade box-projected env probe (or CubeCamera or SSR) so the panes reflect the garden and terrace, add Fresnel reflectance and a faint green-grey low-iron tint, and stop the sky-cube clouds appearing at floor level; 3) wall_ext_anthracite and EXT_garage_door: RAL 7016 (#383E42) albedo, roughness about 0.45 with a light normal, crisp vertical panel joints, and a flush-panel garage door with a thin perimeter frame instead of ribs; 4) fix the dashed EXT_joint/EXT_coping strips (z-fight or broken UVs) and the stretched mullion texture on the south upper windows; 5) EXT_larch_h on reveal returns and pergola beams: rotate UVs so straight grain runs along each member at the correct scale, and shift the entrance larch toward honey; 6) make the wall-light lenses emissive with a real short-range spot/point light each, add wall lights on the garden/south facade, and show the standing-seam roofs and hip caps peeking over the parapets.
