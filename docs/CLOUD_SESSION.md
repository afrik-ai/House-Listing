# Running HouseListing in a Linux cloud container (no GPU, restricted network)

Every agent in a cloud session starts from this page. The Windows workstation setup in SPEC.md still applies there.

## Environment (export in every shell)
```
export BLENDER=$PWD/pipeline/bin/blender-bpy              # bpy module shim (pip install bpy==5.0.1)
export CHROMIUM_PATH=/opt/pw-browsers/chromium-1194/chrome-linux/chrome
export HARNESS_SLOW=6                                     # SwiftShader: one frame can take seconds
```
- Vite: one shared server on http://127.0.0.1:5173, started by the orchestrator. Never start another.
- Rendering is SwiftShader (CPU). A harness boot takes ~3-4 min. Judge visuals from screenshots; fps and
  frame times are RELATIVE only (compare before/after on this machine, never against the 60 fps target).
- 4 CPUs are shared by all agents. Batch views: one `tour.mjs` run or one custom script that captures many views
  per boot, instead of many `shot.mjs` calls. Use 1280x720 unless a detail needs more.
- Every Playwright script: block HMR (use `openGame()` from scripts/shot.mjs, which does it) and put a hard
  timeout on every wait.

## Network: what is reachable
- Reachable: registry.npmjs.org, pypi.org, github.com / raw.githubusercontent.com (public repos).
- Blocked: api.polyhaven.com, dl.polyhaven.org, ambientcg.com, download.blender.org, Steam / press image hosts.
- So in this environment:
  - HDRIs: `node scripts/assets/dl_hdri.mjs` falls back to CC0 Poly Haven HDRIs mirrored on GitHub.
  - Textures: `node scripts/assets/gen_textures.mjs` generates every set in textures.json procedurally
    (same folder layout and meta.json as dl_textures.mjs, so the runtime is unchanged).
  - Furniture: Blender-built procedural props (`pipeline/props/*.py`, `node pipeline/props/make.mjs`).
  - HF2 reference images cannot be fetched: critics use the description-based comparison in
    reviews/CRITIC_PROTOCOL.md ("No reference images").

## Rebuild public/assets from scratch
```
node scripts/assets/dl_hdri.mjs
node scripts/assets/gen_textures.mjs            # or dl_textures.mjs where Poly Haven/ambientCG are reachable
node pipeline/props/make.mjs --no-render
node pipeline/build.mjs villa-nova
$BLENDER -b --factory-startup --python pipeline/blender/exterior_build.py -- villa-nova
node scripts/assets/build_manifest.mjs --credits && node pipeline/props/manifest_add.mjs
```
