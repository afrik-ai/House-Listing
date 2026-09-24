# Game plugins

Every `*.js` file here is auto-loaded by `src/game/Game.js` (sorted by filename): export `class Plugin { constructor(game); async init?(); update?(dt); onTimeOfDay?(mode); onQuality?(tier); dispose?() }` or a default export of that shape. See docs/CONTRACTS.md (P01 section, "Plugins").
