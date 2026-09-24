# P01 Foundation & engine — Critic verdict, round 1

Judged only the engine layer as a player experiences it: the loading and entry flow, the image pipeline, the three times of day, frame pacing, load time, console output and quality tiers.
The house geometry is a placeholder, so furniture, room contents and architecture are not scored.

All captures are 1600x900 at `ultra` unless noted. GPU: RTX 3080 via ANGLE/D3D11.
Scripts used: `probe.mjs`, `flow.mjs` (the real user flow with `harness=0`), `batch.mjs`, `inspect.mjs`, `glass.mjs`, `ao.mjs`, `perf.mjs`, `tiers.mjs`, all in this folder.

## Scores (0-10; 10 = matches HF2 presentation or better)

| Area | Score | Evidence |
|---|---|---|
| GI & bounce (rubric 1) | **3** | No bounce anywhere. The white ceiling renders as a muddy taupe (#7d7068) and the white walls read lavender-grey. AO exists but is weak and mostly dims flat walls, with little corner darkening (`ao_compare.png`). At night the ceiling is black except one blob above the fixture. |
| Direct light & shadows (rubric 2) | **1** | **No sunlight reaches any interior at any time of day.** Every mesh is a shadow caster (157/157), including `GLASS` (transmission 1) and the `COL_glass_*` collision proxies, so the glazing blocks the sun completely. Turning off castShadow on those meshes at runtime brings the sun patches back (`diag_living_glass_noshadow.png`). Outside, the terrace canopy casts no readable shadow on the facade and there is no ground to receive one. Where the sun does land (in the diagnostic shot), the patch edge is hard, stair-stepped PCF with no contact-hardening. |
| Exposure, tone mapping & bloom (rubric 3) | **4** | AgX with a low-contrast grade gives a washed-out, grey-mush frame. Peak pixel values: day office max 186/255, day living max 210. Nothing is ever white, windows never blow out, and there is no bloom halo on any daylight window. Through every window the "view" is the HDRI's lower hemisphere, a blurred mirror of the clouds, so the glass looks fake and frosted (worst in the kitchen). |
| Atmosphere, golden hour & night (rubric 10) | **4** | Golden hour has no low warm sun raking through the glass, which is the point of that time of day, so interiors just turn beige. Night interiors show one hot ceiling ellipse, a crushed black ceiling, and no emissive fixture you can see. From outside at night, windows glow a sickly green-white rather than warm, with no halo and no light spill. The entrance soffit downlights are the one nice touch. |
| Anti-aliasing & edge stability | **5** | SMAA only. Stair balusters stair-step and throw bright single-pixel sparkles (`crop_day_stairs.png`). A bright dashed line of light-leak pixels runs along the top of the skirting in day and night views (`crop_night_skirting.png`), which will crawl when the camera moves. `ultra` asks for pixelRatio 2, but the renderer clamps to the display's DPR, so on a 1x monitor ultra has no extra AA over high. |
| Loading screen & entry flow | **7** | The best part. The blueprint line-drawing loader is elegant, the title card over a slow attract camera works, and the "Click to enter" ring and key hints look good. Faults: the loader tells the player "Loading sky (night)" when they are entering at day; the bar stalls at 85-93% for about 3.5 s and then jumps; the attract shot is a house floating in a void over mirrored clouds; "LOT 01 · VILLA NOVA" is nearly invisible over the sky; clicking hard-cuts under a fade from the aerial shot to a first view of a blank wall and a staircase (`flow_after_click_0.png`) instead of flying the camera in. |
| Load time | **7** | Real user flow on a cold context: "Click to enter" appears at 5.0 s. But **every heavy asset is requested twice**: `house.glb`, `house.meta.json`, `house.json` and all three 2k HDRIs, about 21 MB wasted. All three HDRIs (15 MB) also load before entry, even though only one is needed. |
| Frame pacing (10 s scripted walk, 1920x1080) | **8** | W/D/S/A plus sprint while yaw swings ±80° and pitch sways. At every tier: 599 frames, p50/p95/p99 = 16.7/16.8/16.8 ms, max 16.8, 0 frames over 20 ms. GPU `benchmark(120)`: low 7.0 ms, medium 9.4, high 7.2, ultra 10.0. No main-thread hitches. Caveat: rAF in headless Chromium is vsync-paced, so GPU-side hitches may be hidden. |
| Quality-tier switching | **5** | Switching works and is fast (35-380 ms) with no errors. But the tiers make little sense. **Medium is slower than high** (9.4 vs 7.2 ms). High and ultra look identical at DPR 1. Low's settings say `ao:false`, yet `postfx.ao.enabled` stays true after switching to low. The visual difference between tiers is barely visible (`tiers_sheet.png`). |
| Console | **9** | No errors or request failures. Two D3D shader-compiler warnings (X4122 precision, X3595 gradient-in-loop). |

Four of the rendering criteria score 3 or below (GI 3, shadows 1). Under the rubric that is an automatic HF2 win.

## Blind pairs (coin-flip A/B, both resized to 1600x900, scored before the reveal)

Scores are GI / Shadows / Exposure (/ Atmosphere).

| Pair | Situation | A | B | Winner | Ours was |
|---|---|---|---|---|---|
| 1 | Daylight living interior vs `hf2-loft-living-room-brick-daylight` | 3/1/4 | 8/9/8 | B | A (lost) |
| 2 | Exterior day vs `hf2-aframe-cabin-exterior-forest-day` | 8/9/8 | 4/2/6 | A | B (lost) |
| 3 | Evening interior vs `hf2-living-room-fireplace-evening-modio` | 3/3/5/4 | 9/8/8/10 | B | A (lost) |
| 4 | Night exterior vs `hf2-modern-villa-exterior-night-neon` | 4/3/5/5 | 8/7/8/9 | B | A (lost) |
| 5 | Bright-window interior vs `hf2-empty-room-paint-roller-fpv-day` | 3/1/4 | 8/7/8 | B | A (lost) |

**Result: 0 of 5.** Ours lost every pair on light alone, before content is even considered. In each HF2 frame the sun reaches the floor and bounces, windows blow out gently, and fixtures glow. Ours has no sun indoors, no highlights and no bounce.

## What is genuinely good
- The loading screen and title-card design is tasteful, typographically clean, and already better than a default web loader.
- Frame pacing is rock-solid at 60 fps, with 2-3x GPU headroom at 1080p on every tier.
- There are no console errors, and the `__game` API and harness are complete and reliable.
- The sun shadow map is 4096 px with a tight frustum, and when light actually reaches the floor (diagnostic shot) the window-mullion shadows are crisp, with no acne and no peter-panning.
- The entrance soffit downlights at night give a real warm pool of light.

## Problems, ranked
1. **Glass and collision proxies cast shadows, so no interior ever gets sunlight.** Set `castShadow=false` on `GLASS`. `COL_*` meshes should never render or cast at all. Every day and golden-hour interior loses its most important lighting cue.
2. **Washed-out, highlight-free tone curve.** Peak around 186-210/255, no whites, no bloom on windows, and a cool-lavender wall tint against a brown ceiling. Needs exposure, contrast and white-balance retuning (AgX punchy look or ACES), with window and sky luminance high enough to bloom.
3. **No bounce or GI and a crushed night ceiling.** Hemisphere at 0.3 plus env 0.8 gives flat light. Add baked or probe irradiance, or at least a stronger, correctly tinted fill. Point lights need a wider falloff or an indirect term so night ceilings are not black.
4. **The environment's lower hemisphere is shown as mirrored clouds** through every window and under the house. Use a ground-projected skybox or a placeholder ground plus horizon until P04, so windows show a believable exterior and exterior shadows have something to land on.
5. **Night and golden-hour identity is weak.** No low warm sun shafts at golden hour; windows glow green-white at night; no emissive fixtures and no window halo.
6. **Every heavy asset is requested twice** (about 21 MB), and all three HDRIs load up front. The progress bar stalls and the label shows the wrong sky.
7. **The tiers make little sense.** Medium is slower than high, ultra equals high at DPR 1 (no supersampling), and low does not actually disable AO.
8. **Aliasing and sparkle** on thin geometry (balusters) and a light-leak dashed line along the skirting tops. SMAA alone is not enough; add TAA or MSAA render targets, or supersampling on ultra.
9. **The entry transition is a hard cut** from the aerial attract shot to a first view of a wall. There is no camera fly-in, and the spawn composition is poor.

WINNER: HF2
BIGGEST_GAP: No sunlight ever enters the house because every mesh casts shadows, including the GLASS (transmission) mesh and the COL_* collision proxies, so all day and golden-hour interiors are flat and sunless; set castShadow=false on glass and never render or cast COL_* proxies.
NEXT_FIXES: 1) House/Lighting load hook: castShadow=false on GLASS and any transmissive/transparent material, hide COL_* proxy meshes (visible=false, castShadow=false) — verify sun patches appear in living/master at day and golden_hour; 2) Renderer/PostFX grade: retune AgX exposure/contrast/white balance so white walls read neutral white, windows and sky reach bloom threshold with a soft halo, and remove the lavender-wall/brown-ceiling cast; 3) Lighting.js: add indirect fill (baked AO/irradiance, light probes or per-room hemisphere) and widen the fixture falloff so night ceilings are not crushed black, add visible emissive bulbs and a warm window glow at night; 4) Lighting.js environment: use a GroundedSkybox or placeholder ground/horizon instead of showing the HDRI's mirrored lower hemisphere through windows and under the house; 5) Loader.js: remove the duplicate fetches (GLB, meta, house.json and HDRIs are each requested twice), lazy-load the non-current HDRIs after entry, and fix the stalled progress bar and wrong "Loading sky (night)" label; 6) Renderer.js tiers: make ultra supersample at DPR 1 (or add TAA or MSAA), make medium cheaper than high, and have low actually disable AO.
