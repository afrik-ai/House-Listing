import { Furnisher } from '../furnish/Furnisher.js';

// P07 Furniture & props. Data: houses/<id>/furniture.json (per-room placements); code: src/game/furnish/**.
// Debug: window.__furnish = { furnisher, report, root }.
export class Plugin {
  constructor(game) { this.game = game; this.furnisher = new Furnisher(game); }

  async init() {
    const f = this.furnisher;
    await f.load(this.game.houseId || this.game.house.id);
    f.setNight(this.game.lighting?.mode === 'night');
    window.__furnish = { furnisher: f, report: f.report, root: f.root, plugin: this };
  }

  onTimeOfDay(mode) { this.furnisher.setNight(mode === 'night'); }
}
