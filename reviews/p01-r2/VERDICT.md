# P01 Foundation & engine, round 2: critic verdict

Critic: fresh critic, round 2. I did not read the builder's notes or the r1 review. The files already in `reviews/p01-r2/` (numbered PNGs, `flow_*`, `tier_*`, `spawn_*`, `stats.json`, `index.html`) were not made by me and I did not use them.
My evidence is in `reviews/P01-r2/critic/`: `tour/`, `flow/`, `walk/`, `ours_*.png`, `tier_*.png` and the crops. The blind pairs are in `reviews/P01-r2/blind/`.
Scope: only the engine layer (tone mapping, exposure, colour, AA, shadows, GI/AO, bloom, time of day, frame pacing, load, entry flow, tiers). Other builders changed the scene several times during the review, with HMR reloads and plugin syntax errors from P02, P03, P04 and P06 files. I did not count their content against P01.

## Scores (engine-relevant rubric criteria, 0-10)

| Criterion | Ours | HF2 | Evidence (ours) |
|---|---|---|---|
| 1 GI & bounce | 5 | 9 | Interiors are evenly lit and never black, but there is no coloured bounce. The sunlit wood floor does not warm the walls, sofa or ceiling. Furniture has weak contact AO: the sofa and dining chairs float in `ours_living_day.png`. SSAO leaves dirty dark bands in empty small rooms (`tour/13_wardrobe_a`, `03_cloak`). |
| 2 Direct light & shadows | 4 | 9 | Window-mullion sun patches on floors and walls are good, with soft penumbra (`12_master`). But furniture in or near the sun casts no visible shadow. At night no fixture casts shadows. The hero exterior views are lit from the front, so facades read flat and no cast shadows show (`ours_ext_front_east_day.png`). The penumbra is grainy, and there is dotted acne-like striping on the window frame (`crop_living_day.png`, bottom right). |
| 3 Exposure, tone map & bloom | 6 | 9 | Interiors sit mid-key and bloom is restrained. Faults: a hot white sun-specular star on the inside of the glass in every sunlit interior. Black cabinets are crushed to featureless black (`ours_kitchen_day.png`). The exterior seen from inside is milky or blurred (`tier_crop.png`). Night exteriors crush the whole foreground to 0 (`ours_ext_front_east_night.png`, lower third). |
| 10 Atmosphere & night / time of day | 5 | 9 | Night is the best mode: warm downlights, path bollards with ground pools, wall washers, stars (pair 4 was the closest pair). There is no moon or moonlight fill, and night interiors are one flat warm key with no pools or falloff. Golden hour reads as overcast dusk: a pale grey-blue sky, no sun disc, no long warm shadows, and a lawn that stays dark and cold (`ours_ext_garden_sw_golden_hour.png`). |
| AA / edge crawl | 7 | 8 | SMAA-level edges. Balusters and chair legs are clean at 1600x900. Mullion edges soften slightly. I saw no serious crawl in the recorded walk. |
| Frame pacing (10 s walk) | 6 | 8 | See below: p50/p95/p99 are 16.7/16.7/16.8 ms (locked 60), but every run has a 0.4-0.7 s freeze about 1.4 s after entry. |
| Load & entry flow | 7 | 8 | See below. |
| Quality-tier switching | 5 | 8 | Each tier switch freezes the frame for 650-800 ms. Low, medium, high and ultra look almost identical apart from pixel ratio (`tier_sheet.png`). |

**Total on the four rubric criteria: ours 20/40, HF2 36/40.** Criterion 2 (shadows) is at 4, only just above the automatic-fail line of 3.

## Blind side-by-side (framing and time of day matched; judged on rendering qualities only)

| Pair | Framing | A | B | Winner (blind) | Ours was |
|---|---|---|---|---|---|
| 1 | Interior day, living room three-quarter | GI 8 / Sh 9 / Exp 8 | GI 6 / Sh 5 / Exp 6 | **A** | B, so we **lost** |
| 2 | Exterior day approach | GI 8 / Sh 8 / Exp 8 | GI 5 / Sh 3 / Exp 6 | **A** | B, so we **lost** |
| 3 | Evening/night living room | GI 6 / Sh 4 / Exp 7 / Atm 6 | GI 9 / Sh 8 / Exp 9 / Atm 10 | **B** | A, so we **lost** |
| 4 | Night exterior | GI 5 / Sh 5 / Exp 6 / Atm 7 | GI 8 / Sh 7 / Exp 8 / Atm 9 | **B** | A, so we **lost** (closest pair) |

HF2 won 4 of 4. The recurring tell was the same in every pair: HF2 frames have strong local contrast from light and shadow (dappled sun, shadowed furniture, pools of light). Ours look evenly and softly lit, as if under an overcast sky.

## Measurements

- **Load:** the harness `loadMs` was 1.65 s on a warm, stable server. In player mode (`harness=0`) the title card was ready at 1.57 s on the first run. Later runs took 7.8-64 s because Vite was re-transforming files other agents were editing. I did not blame P01 for that.
- **Loading screen:** the dark title card with the elevation line drawing, stats row and gold progress bar is elegant and game-like. Faults:
  - A pure-white page shows for about 70 ms before CSS arrives (`flow/load_00072.png`), because `house.html` has no inline dark background.
  - In one run the status read "READY" while the bar sat at 91% (`walk/video/fr/f39.png`).
  - During the title cross-fade the blueprint drawing ghosts over the 3D render (`flow/load_03242.png`).
- **Entry:** the click fades to black in about 0.7 s, then fades up with eye adaptation from dim to full in about 0.6 s, and the player is in `playing` at about 1.3-1.6 s. That is acceptable. Faults: in one run the camera had already cut inside before the fade (`flow/enter_0029.png`). The first spawn frame (`walk/video/fr/f409.png`) is flat and grey, with a milky, washed-out garden through the glass. It is an unflattering first impression.
- **10 s scripted walk** (living room; W, D, S, A with a ±52° yaw sweep; RTX 3080; 1600x900):

  | Tier | Frames | p50 | p95 | p99 | Max | Frames > 20 ms |
  |---|---|---|---|---|---|---|
  | High | 562 | 16.7 | 16.7 | 16.8 | **350** | 2 |
  | Ultra | 561 | 16.7 | 16.8 | 16.8 | **350** | 2 |
  | Low | 579 | 16.7 | 16.8 | 16.8 | **200** | 2 |

  The two back-to-back hitches reproduce on every tier. An idle test with no input (`hitch.mjs`) shows 333 ms + 350 ms stalls about 1.4-1.8 s after `playing` starts, so they come from a deferred post-entry task (shader compile or lazy upload), not from movement. Time-of-day switches caused no hitch. The GPU benchmark gave 161-276 fps.
- **Tier switch stalls:** to low 650 + 183 ms, to medium 783 ms, to ultra 800 ms.
- **Console:** there were no errors from engine files. The errors I saw came from other builders' in-progress plugins (House.js, 15_materials, 20_exterior, 10_landscape). The engine kept running when a plugin failed, which is good. `shot.mjs` and `tour.mjs` die on any HMR reload ("Execution context was destroyed"). Six of my captures failed this way.

## What is genuinely good
- Tone mapping is filmic and restrained. There is no milky full-screen haze and bloom stays on the bright sources (downlights, bollards).
- Sun through the glazing makes believable soft-edged mullion patches on floors and walls.
- The night exterior works: warm windows, lamp pools on the ground, wall washers, a starfield.
- The frame rate is locked at 60 with large GPU headroom, and time-of-day switches are instant and hitch-free.
- The loading and title card are the most polished part of the piece. They look like a real product.

## Ranked problems
1. **No local shadowing from objects and no bounce.** Furniture casts no sun or lamp shadows, contact AO is weak and there is no coloured GI. Every frame reads as soft overcast light, and this is what loses every blind pair.
2. **Golden hour does not read as golden hour.** There is no low warm sun and no long shadows, the sky is pale grey-blue and the lawn stays cold and dark.
3. **Night lacks fill and pools.** The foreground crushes to pure black with no moon or sky fill. Interior downlights give one flat warm key with no falloff or shadows.
4. **Post-entry freeze of 0.4-0.7 s** on every tier, about 1.4 s after the player gains control.
5. **Sun-specular star on the interior side of the glass**, plus a milky or blurred exterior seen through the windows.
6. **Tier switching** freezes for about 0.8 s and the tiers are visually almost indistinguishable.
7. **Loading/entry polish:** a white flash before CSS, "READY" shown at 91%, a flat and unflattering spawn view, and a harness that is not robust to HMR reloads.

WINNER: HF2
BIGGEST_GAP: Lighting is shadowless and evenly soft: furniture and fixtures cast no sun or lamp shadows, there is no coloured bounce and contact AO is weak. Every frame reads as overcast and flat next to HF2's contrasty sun shafts and light pools.
NEXT_FIXES: 1) Lighting.js: let furniture and props cast and receive sun shadows (castShadow on furnish meshes, fit the shadow camera to the room the player is in, raise the map to 4096 on high/ultra, lower normalBias to remove frame striping), and add 2-4 shadow-casting spot or point lights for the nearest night fixtures. 2) PostFX.js and Lighting.js: stronger, tighter N8AO contact radius for furniture feet, plus a cheap bounce term (hemisphere or probe tinted by the sunlit floor colour) so walls and ceilings near sun patches warm up. 3) Lighting.js time of day: golden hour needs a sun elevation of about 8-12° with a warm 2800-3200 K colour, a visible sun disc and a warm sky gradient; night needs a moon directional light with cool fill and a sky gradient so the foreground is not 0-black. 4) Game.js/Renderer.js: pre-compile all programs (renderer.compileAsync on the full scene, including night and tier variants) before the title card says READY, to remove the 0.4-0.7 s post-entry freeze and the 0.8 s tier-switch stalls; make the tiers actually differ (shadow resolution, AO samples, SSR). 5) Glass material and IBL: suppress the direct-sun specular on the interior face of the glazing and cut the blur/haze on the exterior seen through the glass. 6) house.html and Loading.js: inline `html{background:#0b0d10}`, show READY only at 100%, choose a flattering spawn yaw (toward the sunlit glazing), and make shot.mjs/tour.mjs retry after an HMR navigation.
