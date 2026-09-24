# House Flipper 2 — Visual & Feel Reference for Blind Critics

Target: our Three.js first-person house walkthrough is judged blind, side by side, against
House Flipper 2 (Frozen District, released 14 Dec 2023). This document tells a critic what
HF2 actually looks and feels like so they can score both builds against the same bar.

Reference screenshots: `reviews/hf2/` (20 PNGs, 1600 px wide, captured through a headless
browser from the official Steam gallery and press/review images; every file was visually
verified as a real HF2 in-game render).

**Engine correction (important).** The brief described HF2 as "Unreal Engine 5 / Lumen".
PCGamingWiki lists HF2 as a **Unity** title (Unity 6000.x build, HDRP-class renderer) with no
ray tracing, no HDR output, DLSS 2 / FSR 3 upscaling, uncapped frame rate and a 60–100 FOV
slider. Nothing below depends on the engine name; judge the *result*: soft global illumination,
bounced colour, clean shadows, restrained bloom. Do not award or deduct points for "Lumen".

---

## 1. Lighting (the single biggest quality driver)

What the reference shots show, concretely:

- **Global illumination is always present.** No black corners, no flat-grey ambient. In
  `hf2-loft-living-room-brick-daylight.png` the sun through the mullioned windows throws crisp
  window-shaped patches on the tile floor, and the rest of the room is lit by *bounce*: the
  underside of the green chairs is warm from the floor, the brick wall is evenly readable in
  shadow, the concrete ceiling has a soft gradient toward the windows. Colour bleeds: warm wood
  floors tint the lower third of white walls (`hf2-kitchen-cottage-day-cluttered.png`).
- **Soft, contact-hardening shadows.** Sun shadows are sharp near contact (chair legs on tile)
  and soften with distance (beam shadows on the ceiling in `hf2-kitchen-dining-farmhouse-day.png`).
  Every prop has a small ambient-occlusion "foot": books on shelves, cushions on sofas, the
  fridge against the wall. Nothing floats.
- **Exposure is tone-mapped, mid-key.** Interiors sit around middle grey; windows during day
  blow out gently to near-white with a soft halo (`hf2-empty-room-paint-roller-fpv-day.png`,
  `hf2-derelict-concrete-interior-beach-day.png`), but the exterior is still legible through the
  glass (trees, sea, neighbouring houses). Bloom is subtle: a thin glow on window panes, neon
  tubes, fluorescent fixtures, candle flames. Never a milky full-screen haze.
- **Night / evening interiors are warm and multi-source.** `hf2-living-room-fireplace-evening-modio.png`:
  fireplace, candles, sconces and a chandelier each cast their own pool; walls go orange near
  fixtures and cool blue-grey toward the windows, where dusk sky is visible. Fixtures show
  visible emissive bulbs/flames, not just an invisible point light.
- **Night exteriors** (`hf2-diner-exterior-night-neon.png`, `hf2-modern-villa-exterior-night-neon.png`,
  `hf2-beach-house-exterior-dusk-warm-interior-modio.png`): dark blue sky with stars and cloud
  detail, a bright moon disc with bloom, interiors glowing warm through glass, neon signs and
  strip lights casting coloured light onto adjacent walls and ground, small path lamps with
  visible ground pools. Interiors seen through windows are actually lit and furnished.
- **Screen-space reflections** on glossy floors (wet concrete, polished parquet, glazed tile),
  on TV screens and glass shower panels. Matte materials do not reflect.
- **Sky and sun**: blue sky with volumetric-looking cumulus, sun disc with lens haze, foliage
  with translucency (bright leaf edges against the sun in `hf2-aframe-cabin-exterior-forest-day.png`).

A 10/10 lighting score means: no unlit corner, coloured bounce visible, window patches on the
floor, AO under every object, gentle bloom only where the source is bright, warm/cool contrast
at night.

## 2. Materials

- **PBR with roughness variation.** Wood shows grain, gloss breakup and dull patches; painted
  cabinet doors have a satin sheen with slightly rougher edges; brick has per-brick colour
  variation and rough mortar; tile grout is darker and recessed. Ceramic, chrome, glass, fabric,
  leather all read distinctly at a glance (`hf2-kitchen-dining-farmhouse-day.png`,
  `hf2-loft-living-room-brick-daylight.png`).
- **Tiling scale is realistic.** Floor planks ~15 cm wide and 1–2 m long (herringbone in the
  cottage kitchen), subway tiles ~7.5 x 15 cm (`hf2-bathroom-shower-cleaning-hud-prompts.png`),
  bricks ~20 x 6 cm. Wall paint has fine noise / roller texture, not a flat colour. Nothing
  visibly repeats within a single wall.
- **Dirt and wear are separate layers**: drywall with joint tape and screw spots, stains on the
  shower tray, mud footprints on rugs, paint splatter on floors, rust streaks on tile
  (`hf2-derelict-bathroom-tiles-fluorescent.png`). The "before" state is filthy, the "after"
  state is clean; both use the same base materials.
- **Trim and bevels**: door and window frames have a visible profile, cabinet doors are
  panelled (raised centre, recessed frame), counters have a thickness edge and slight round-over,
  skirting runs along every wall-floor junction and is a different sheen from the wall.

## 3. Geometry density and set dressing

- Every wall-floor edge has **skirting**; every opening has a **door frame / architrave**; windows
  have **reveals, sills and mullions** with real glass thickness. Ceilings have crown moulding,
  exposed beams or recessed spot cans. Light switches and sockets exist on walls.
- **Props are abundant and small-scale**: books, jars, plants, mugs, framed prints, cushions,
  rugs, a remote on the TV stand, fruit in a bowl, candles, hooks with towels
  (`hf2-kitchen-cottage-day-cluttered.png` has well over 100 discrete objects). Empty rooms
  still have radiators, outlets, a paint bucket, cardboard on the floor.
- Exteriors: grass is 3D blades, not a texture; shrubs, fallen logs, stepping stones, fences with
  individual pickets, mailbox, garden lamps, tyres, bins, a car in the drive.
- Furniture silhouettes are detailed (turned legs, tufted upholstery, visible hinges/handles).
  Silhouettes are never "box with a texture".

## 4. Interaction feedback

- **Hover highlight**: looking at an interactive object draws a **golden-yellow outline / rim glow**
  (poster in `hf2-hud-sell-tool-hover-outline-quests.png`). Trash items get a solid **yellow
  tint fill** (`hf2-hud-trash-bag-yellow-outline-cabin.png`). Paintable wall segments show a
  **cyan grid overlay** with a blue selection frame (`hf2-paint-roller-wall-grid-selection.png`).
  Build-mode wall previews are **translucent green** with metric dimensions labelled
  (`hf2-build-mode-wall-placement-ui.png`).
- **Prompt pills**: bottom-centre, blue rounded rectangles, white text, with a key badge
  (white rounded square with the key letter or a mouse icon): "R Spray", "Shift + Enter Finish job",
  "Hold LMB Clean", "LMB Sell". They appear only when relevant.
- **Doors** swing open with a short eased animation (~0.5 s) and a handle-click sound; you can
  walk through mid-animation. Opened doors stay open.
- **Tools are visible first-person props** held by gloved hands (yellow/white work gloves, red
  flannel sleeve): paint roller, sledgehammer, spray bottle + scrubber, garbage bag, sell scanner
  with a screen showing the price and a green tick. Tool actions have particles (paint droplets,
  plaster chips, dust) and leave persistent marks (paint strokes, rubble).
- **Feedback loops**: quest counter decrements in the top-right, a coin/cash sound plays, an
  item count ticks, and a star rating fills as the room improves.

## 5. First-person feel

- **Camera height** ~1.65 m (eye level; counters at about waist-chest of frame, door handles
  slightly below centre). A slight downward pitch is common when working.
- **FOV**: slider 60–100; default sits near 75–80. Screenshots read as a mild wide-angle:
  straight lines stay straight, rooms feel roomy, no fish-eye.
- **Movement** (estimates from play footage): walk ~2.5–3 m/s, sprint on Shift roughly 1.6x,
  instant stop, capsule collision that slides along furniture, step-up onto low objects, no jump.
  Mouse look is smooth with no acceleration; turning does not roll the camera.
- **Head bob** is subtle (a few mm vertical sway at walk) and the held tool sways slightly on
  turn and settles with a short lag. No motion blur by default.
- **Crosshair**: a small white dot at screen centre, thin, semi-transparent, sometimes with a
  ring when hovering an interactable.

## 6. UI style

- **Palette**: saturated cobalt/royal blue panels (about #1F5FBF) with a slightly lighter blue
  header, white text, yellow/gold accents for money and stars, green for confirm. Panels have
  8–12 px rounded corners and a brush-stroke / torn-paper edge on some tabs.
- **Font**: a rounded geometric sans (Nunito-like), semi-bold, generous letter spacing; numbers
  are tabular. Sizes: ~18 px labels, ~26 px headers at 1080p.
- **Layout**: Budget top-right ("Budget 1,144" + coin icon). Quests panel below it with a 3-star
  rating and a "Tab" key badge, listing task name + remaining count. Tool selector bottom-left:
  eye/helmet icon ("Q" = tool wheel) and current tool icon ("R"). Contextual prompts
  bottom-centre. "F1 Controls" top-left in build mode. Dropdowns/toggles are pill-shaped.
- **Tablet-style menus**: shop and catalogue open as a full-screen "tablet" with a left column
  of categories (Furniture, Kitchen, Bathroom, Decor, Garden, Materials...), a grid of item cards
  with rendered thumbnails, name and price, filter chips at top, and a big blue "Buy" button.
  Items placed from the catalogue snap to floor/wall with a green (valid) / red (invalid) ghost.
- **Room labels**: when you look at a room threshold or in the overview, the room name appears
  as a small pill ("Kitchen", "Bathroom") with its cleanliness/completion percentage.

## 7. Audio

- Footsteps switch material: wood knock, tile click, carpet thud, gravel crunch outside, and
  are quieter indoors than outdoors.
- Ambience: birds and wind outdoors, muffled through walls indoors, fridge/AC hum in kitchens,
  fluorescent buzz in derelict interiors, crickets and distant traffic at night.
- Tool foley: roller squelch, spray hiss, scrubbing loop, sledgehammer crack + debris, vacuum
  motor, cash-register chime on sale. UI: soft clicks and a "pop" on prompt appear.
- Music: relaxed acoustic / lo-fi loops at low volume that duck under tool sounds.

## 8. Catalogue and house selection screens

- **Office / HQ hub**: the player's office with a laptop; e-mails act as job offers, each with a
  client photo, a short story, a before-photo, reward and a list of tasks.
- **House purchase list**: cards with a rendered exterior thumbnail, name, price, plot size, room
  count and a condition tag. Selecting shows a larger gallery and a floor plan.
- **Sandbox**: plot selection with terrain preview, then a blueprint-style top-down view for
  walls, with a live 3D preview.

## 9. Typical camera framings in HF2 screenshots

1. **Room corner three-quarter**: camera in a corner at eye height, ~20 deg yaw so two walls and the
   window are visible; horizon in the top third. (Most interior shots.)
2. **Straight-on hero wall**: TV wall or fireplace centred, sofa in foreground bottom, symmetric.
3. **Tool-in-hand action**: tool occupies bottom-right 30% of frame, work surface centred,
   slight downward pitch.
4. **Exterior approach**: standing on the path, house centred, trees framing left and right,
   sky top third, foreground grass/props at the bottom edge.
5. **Night exterior**: same as 4 at dusk/night with warm interior glow and neon.
6. **Close-up detail**: single prop (snowman, mailbox) filling half the frame to show material
   quality.

Our screenshots for comparison must use the same framings so the critic compares like with like.

---

## CRITIC RUBRIC (score each 0–10; 10 = indistinguishable from HF2 or better)

1. **Global illumination & bounce** — 10: no black corners, visible coloured bounce from
   floor/walls onto furniture, AO under every object, gradient on ceilings. 0: flat ambient,
   black shadows.
2. **Direct light & shadows** — 10: crisp sun patches through windows, contact-hardening soft
   shadows, correct shadow direction on all objects. 0: no shadows, or hard-edged aliased shadows.
3. **Exposure, tone mapping & bloom** — 10: mid-key interior, windows gently blown with a soft
   halo, exterior still readable, bloom only on bright sources. 0: clipped whites or grey mush,
   haze everywhere.
4. **Material fidelity** — 10: roughness variation, correct tiling scale, distinct wood / tile /
   fabric / metal / glass, no visible repeat. 0: flat colours or obviously tiled textures.
5. **Architectural detail** — 10: skirting, door frames, window reveals with sill and mullions,
   ceiling trim, switches/sockets, thickness on every edge. 0: box rooms with paper-thin openings.
6. **Set dressing density** — 10: 100+ small props in a furnished room, rugs, plants, books,
   wall art, clutter that tells a story; exterior grass blades, shrubs, fence pickets. 0: empty or
   three big blocks of furniture.
7. **Interaction feedback** — 10: hover outline/glow, context prompt with key badge, animated
   doors, tool visible in hand, particles and persistent marks. 0: nothing happens on look/click.
8. **First-person feel** — 10: eye height ~1.65 m, FOV 75–80, smooth mouse, ~2.7 m/s walk,
   sliding collision, subtle bob/tool sway, small dot crosshair. 0: wrong height, fish-eye or
   tunnel FOV, jitter, walking through walls.
9. **UI polish** — 10: rounded blue panels, rounded sans font, key badges, budget/quest panel,
   tablet-style catalogue, room labels; consistent margins and sizes. 0: default browser text,
   unstyled buttons.
10. **Atmosphere & night lighting** — 10: warm multi-source evening interiors, cool exterior
   dusk, emissive fixtures, neon casting colour, stars/moon, interiors glowing through windows.
   0: night is just "everything darker".

Total out of 100. Any single criterion at 3 or below is an automatic "HF2 wins" regardless of total.

## BLIND COMPARISON PROTOCOL

1. **Pair by framing.** Pick one HF2 reference from `reviews/hf2/` and one screenshot of our
   build with the *same framing type* (section 9) and the same time of day (e.g. day kitchen vs
   `hf2-kitchen-dining-farmhouse-day.png`; night exterior vs `hf2-modern-villa-exterior-night-neon.png`;
   HUD/prompt vs `hf2-bathroom-shower-cleaning-hud-prompts.png`). Both at 1600x900.
2. **Anonymise.** Flip a coin (e.g. `node -e "console.log(Math.random()<0.5?'A':'B')"`); copy the
   HF2 image to that letter and ours to the other, as `reviews/blind/A.png` and `reviews/blind/B.png`.
   Record the mapping in `reviews/blind/key.txt`, which the critic must not read until step 5.
3. **Score blind.** The critic opens A.png and B.png only, scores each on all 10 rubric criteria
   without knowing which is which, and writes one sentence of evidence per criterion citing what
   is visible in the image.
4. **Declare a winner** (A or B) and the total for each.
5. **Reveal** the key. If ours lost, the critic names the **single biggest gap** in ours: one
   criterion, one sentence, phrased as an actionable change (e.g. "no bounce light: walls
   facing away from the window are black; add probe/hemisphere GI and AO").
6. Log the result: `node scripts/progress.mjs set <piece> verdict="HF2 wins" gap="<gap>"` (or
   `verdict="ours wins"`), and `node scripts/progress.mjs shot reviews/blind/<ours>.png "<caption>"`.
7. Repeat with at least 3 framing types per round (interior day, exterior day, night or HUD)
   before declaring a round complete. A build passes a round only if it wins or ties on at least
   2 of 3 pairs and has no criterion at 3 or below.

## Screenshot index (reviews/hf2/)

| File | What it shows | Use for |
|---|---|---|
| hf2-loft-living-room-brick-daylight.png | Modern loft, brick, big windows, sun patches | GI, shadows, materials, framing 1 |
| hf2-kitchen-dining-farmhouse-day.png | Green cabinets, beams, parquet, dining set | Kitchen day, trim, tiling scale |
| hf2-kitchen-cottage-day-cluttered.png | Cottage kitchen full of props, broken chair | Set dressing density |
| hf2-living-room-fireplace-evening-modio.png | Evening living room, fireplace, candles, sconces | Night interior, warm fixtures |
| hf2-empty-room-paint-roller-fpv-day.png | Unfinished drywall room, roller in hand, window bloom | Tools, exposure/bloom |
| hf2-paint-roller-wall-grid-selection.png | Cyan grid overlay on wall, blue selection frame | Interaction feedback |
| hf2-sledgehammer-wall-demolition-fpv.png | Hammer in hand, plaster particles | Tools, particles |
| hf2-bathroom-shower-cleaning-hud-prompts.png | Subway-tile shower, spray + scrubber, prompt pills | Bathroom, HUD, prompts |
| hf2-hud-sell-tool-hover-outline-quests.png | Golden hover outline on poster, budget + quest panel | Hover outline, UI |
| hf2-hud-trash-bag-yellow-outline-cabin.png | Yellow-tinted trash, tool wheel icons | Highlight fill, UI |
| hf2-build-mode-wall-placement-ui.png | Green wall ghost with metric labels, F1 Controls | Build UI |
| hf2-derelict-concrete-interior-beach-day.png | Dirty "before" state, stains, sun through opening | Dirt layers, exposure |
| hf2-derelict-bathroom-tiles-fluorescent.png | Rusty tile bathroom under fluorescents | Interior artificial light |
| hf2-aframe-cabin-exterior-forest-day.png | A-frame in forest, grass blades, foliage translucency | Exterior day |
| hf2-cottage-exterior-garden-picket-fence-day.png | Cottage behind picket fence, flowers | Exterior lawn/garden |
| hf2-beach-shack-exterior-day-dirty.png | Shack on sand, tyres, tree shadows | Exterior shadows, clutter |
| hf2-beach-house-exterior-dusk-warm-interior-modio.png | Dusk, warm interior through glass, palms | Dusk / glow through windows |
| hf2-diner-exterior-night-neon.png | Night, moon bloom, OPEN neon, path lights | Night exterior |
| hf2-modern-villa-exterior-night-neon.png | Night villa, magenta/cyan strip lights | Night exterior, emissive |
| hf2-snowman-front-yard-winter-closeup.png | Close-up snowman, snow material, fence | Material close-up |

Files marked `-modio` carry a mod.io "Community Content" watermark (official Steam gallery
images of community builds rendered in-game).

## Sources

- Steam store page and screenshot gallery: https://store.steampowered.com/app/1190970/House_Flipper_2/
- Steam Community screenshots (top rated): https://steamcommunity.com/app/1190970/screenshots/
- PC Gamer review (HUD/tool screenshots): https://www.pcgamer.com/house-flipper-2-review/
- GamesRadar review (kitchen, paint-grid screenshots): https://www.gamesradar.com/house-flipper-2-review/
- PCGamingWiki (engine = Unity, FOV slider 60–100, DLSS 2 / FSR 3, no RT, no HDR): https://www.pcgamingwiki.com/wiki/House_Flipper_2
- Official site: https://www.houseflippergame.com/
- IGN review: https://www.ign.com/articles/house-flipper-2-review
