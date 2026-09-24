# Wave 2: ownership and integration rules

The house shell GLB (P02) and assets are in. Wave 2 dresses the house. Every wave-2 piece plugs in through
**`src/game/plugins/*.js`**, which Game.js auto-loads after the house loads (see the P01 section of CONTRACTS.md).
If the hook is not there yet when you start, P01 is adding it now. Do your research and asset prep first, then
check again with `grep -n plugins src/game/Game.js`. Never edit Game.js, House.js, Lighting.js or other P01 files.
If you need an engine change, append a request under "Requests to P01" at the bottom of docs/CONTRACTS.md.

| Piece | Owns (create/edit only these) |
|---|---|
| P03 Exterior finish | `src/game/plugins/20_exterior.js`, `src/game/materials/exterior.js`, `pipeline/blender/exterior_*.py` (additive detail meshes exported to `public/assets/houses/villa-nova/exterior_detail.glb`) |
| P04 Landscape & sky | `src/game/plugins/10_landscape.js`, `src/game/landscape/**`, `houses/villa-nova/site.json` |
| P06 Interior surfaces | `src/game/plugins/15_materials.js` (material registry: maps every GLB material name to a textured MeshPhysical/StandardMaterial), `src/game/materials/index.js`, `src/game/materials/interior.js`, `src/game/materials/textures.js` |
| P07 Furniture & props | `src/game/plugins/30_furnish.js`, `src/game/furnish/**`, `houses/villa-nova/furniture.json` (per-room placements, data-driven so the next house is just a new JSON) |

Material registry contract (P06 owns it, P03 contributes): `src/game/materials/index.js` imports every
`src/game/materials/*.js` except itself and textures.js. Each exports `definitions = { <glbMaterialName>: async (tex) => THREE.Material }`,
where `tex(name, {repeat, rotation})` loads `public/assets/textures/<name>/{color,normal,roughness,ao}.jpg` with the
correct colour spaces and anisotropy, using the texture's `scale_m` from manifest.json. The GLB uses 1 m box UVs, so
`repeat = 1/scale_m`. P06 defines interior names, P03 defines exterior names (wall_ext_white, wall_ext_anthracite,
wood_slats, frames, glass, roof_standing_seam, concrete_pavers, handrail_black and anything with an EXT_ prefix).
Use `uv1` (the second UV set) for aoMap/lightMap.

Asset budget: public/assets is at 146 MB. Do not add large new downloads. P12 will compress everything to
KTX2/WebP later. If you truly need a new texture, keep it at 1K JPG and note it in CREDITS.md.

Every wave-2 builder must verify in the real browser with `node scripts/tour.mjs` and targeted `scripts/shot.mjs`
shots, looking at every image with the Read tool, with zero console errors and fps at or above 60 on 'high'.
Log milestones with `node scripts/progress.mjs log "<piece>: ..."`. When done, run
`node scripts/progress.mjs set <piece> status=critic round=1` and report in under 300 words.
