# HouseListing — Browser Home Catalog at House Flipper 2 quality

## Goal
A browser-based home catalog (Three.js) with ONE convincing, fully playable house ("Villa Nova", spec in
`houses/villa-nova/house.json`; reference: modern white/anthracite/larch villa with pool, covered
terrace, double garage; ground + first floor plans encoded in the spec) and a REPEATABLE pipeline for the next house.
Quality bar: side-by-side blind comparison against House Flipper 2 screenshots must be won or tied.

## Stack (fixed — do not swap)
- Vite 8 dev server on **http://127.0.0.1:5173** (already running; do NOT start another; HMR is on).
- Three.js **0.186** (`import * as THREE from 'three'`, addons from `three/addons/...`). WebGLRenderer.
- Blender 5.x headless. Every pipeline entry point reads the **`BLENDER`** env var (the executable), defaulting to
  `tools/blender-5.2.1-windows-x64/blender.exe` on Windows and `tools/blender/blender` elsewhere:
  `$BLENDER -b --factory-startup --python <script> -- <args>`. Where no Blender binary can be installed
  (restricted cloud containers), `pip install bpy` and set `BLENDER=pipeline/bin/blender-bpy`, a CLI-compatible
  shim that runs the same scripts through the `bpy` module. Scripts locate the repo from their own path (no
  hard-coded roots). Pipeline scripts live in `pipeline/blender/`. Output GLBs go to `public/assets/houses/<id>/`.
- Playwright (headless Chromium). On Windows it uses the real GPU via `--use-angle=d3d11`; on Linux without a GPU
  it falls back to SwiftShader (judge visuals from screenshots; fps is relative only). Harness env vars:
  `CHROMIUM_PATH` (use a pre-installed Chromium when Playwright's own build can't be downloaded) and
  `HARNESS_SLOW` (multiplies every harness timeout; ~6 for SwiftShader). Screenshot harness: `node scripts/shot.mjs`.
- Assets: CC0 only (Poly Haven models/textures/HDRIs via https://polyhaven.com/api, ambientCG). Keep every
  texture <= 2048px and prefer 1024px. Total shipped assets target < 150 MB. Record every downloaded asset
  in `public/assets/CREDITS.md` (name, source URL, license).
- No git repo. Do not create one. Do not delete other agents' files.

## Pages
- `/` (index.html) — Catalog: hero, house cards (only Villa Nova real; 2 "coming soon" cards), Enter House.
- `/house.html?id=villa-nova` — The game. Loading screen -> first-person walkthrough.
- `/progress/` — Live progress page (orchestrator-owned; reads `/progress/status.json`).

## Runtime architecture (src/)
```
src/engine/   Renderer.js      WebGLRenderer, color mgmt (AgX/ACES tone mapping), resize, pixel-ratio cap, quality tiers
              PostFX.js        EffectComposer: SMAA, N8AO/SSAO, subtle bloom, vignette, color grade
              Loader.js        GLTF (+Draco/KTX2/Meshopt ready), texture cache, HDRI, progress events
              Lighting.js      sun (CSM or high-res shadow), sky, IBL from HDRI, interior fixtures, time-of-day
              Physics.js       collision: capsule vs. static BVH (three-mesh-bvh), stair stepping, ground snap
src/game/     Player.js        first-person: WASD, mouse look (PointerLock), sprint, crouch, head-bob, footstep events
              Interact.js      raycast center-screen; hover outline; E to interact; doors, lights, taps, blinds, TV
              House.js         loads house GLB + meta (rooms, doors, lights, spawn); builds interactables
              Audio.js         Web Audio: footsteps per surface, doors, ambient exterior/interior, room reverb, UI
              Game.js          orchestrates; exposes window.__game debug API (see below)
              main.js          entry for house.html
src/ui/       HUD.js           crosshair, interaction prompt, room-name toast, controls hint, FPS (dev)
              Menus.js         pause menu (Esc), settings (quality, FOV, sensitivity, audio), photo mode
              Loading.js       loading screen with progress bar + house hero
              ui.css
src/catalog/  Catalog.js, catalog.css   index page
```
Ownership: each agent edits ONLY the files it owns (named in its prompt) plus new files under its folder.
Cross-module contracts go through `src/game/Game.js` events — document in `docs/CONTRACTS.md`
(append a section; never delete others' sections).

### window.__game debug API (REQUIRED — used by critics and the screenshot harness)
```
__game.ready            // Promise resolved once everything (GLB, textures, HDRI) is loaded and first frame rendered
__game.teleport(x,y,z, yawDeg, pitchDeg)   // eye position + look direction (no pointer lock needed)
__game.setTimeOfDay('day'|'golden_hour'|'night')
__game.setQuality('low'|'medium'|'high'|'ultra')
__game.hideUI(bool)
__game.stats()          // {fps, drawCalls, triangles, textures, memoryMB}
__game.rooms()          // [{id,name,level,center:[x,y,z]}]
__game.interact()       // triggers interaction on the current center-screen target
__game.move(dir, seconds)  // simulate held WASD ('w','a','s','d') for tests
__game.render()         // force one frame (harness calls this after teleport)
```
yaw 0 = looking toward -Z (north); yaw 90 = looking toward -X (west). pitch positive = up.

### Screenshot harness (scripts/, owned by P01)
`node scripts/shot.mjs --pos "x,y,z" --yaw 0 --pitch 0 --tod day --out reviews/x.png [--w 1920 --h 1080] [--quality ultra] [--ui]`
`node scripts/tour.mjs --out reviews/tour-<name>/` takes the standard tour (every room + 4 exteriors) and writes
`index.html` contact sheet + `stats.json`. Both wait for `__game.ready`, hide UI unless `--ui`, print `__game.stats()`.

## Pieces (each judged on its own; each has a builder loop and a fresh critic each round)
P01 Foundation & engine (renderer, loader, postFX, quality tiers, loading screen, stats, harness)
P02 House shell (Blender pipeline: walls/floors/ceilings/roofs/openings/stairs -> GLB + UV2 + rooms metadata)
P03 Exterior finish (facade materials, window frames, doors, garage door, fascias, pergola, balcony glass)
P04 Landscape & sky (lawn, pool water, paving, gabion wall, planting, trees, HDRI sky, surroundings)
P05 Lighting & atmosphere (sun/shadows, IBL, interior fixtures, time-of-day, baked AO/lightmaps)
P06 Interior surfaces (floors, walls, ceilings, tiles, skirting, trim, kitchen/bath finishes)
P07 Furniture & props (every room furnished with CC0 assets, lived-in density, garage cars)
P08 Player controller & collision (movement feel, stairs, head-bob, FOV, sprint/crouch, no clipping)
P09 Interactions (doors with animation, light switches, blinds, taps, TV, hover outline, prompts)
P10 HUD, menus & catalog (crosshair, prompts, room toast, pause, settings, photo mode, catalog page)
P11 Audio (footsteps per surface, doors, ambient, reverb by room size, UI)
P12 Performance & polish (60 fps at 1080p high, LODs, instancing, texture budget, no pop-in, no z-fighting)
P13 Pipeline repeatability (`docs/NEW_HOUSE.md`: from plans -> house.json -> Blender -> GLB -> catalog)

## Quality bar (what "wins" against House Flipper 2)
- Materials read as real: micro-roughness variation, correct scale (tile 60 cm, plank 19 cm), no visible tiling.
- Lighting: soft shadows, bounce light, contact AO, bright windows with subtle bloom, warm fixtures at night.
- Geometry: bevelled edges on trims, skirting boards, door frames, window reveals, real thickness on everything.
- Density: rooms feel lived-in (rugs, books, plants, art, cushions, kitchen items, towels).
- Feel: smooth 60 fps, subtle head-bob, gentle FOV kick on sprint, doors swing with sound, footsteps change on tile.
- UI: crisp, minimal, game-like typography; nothing looks like a default browser element.
