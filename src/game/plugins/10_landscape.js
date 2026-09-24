import { Landscape } from '../landscape/Landscape.js';

// P04 Landscape & sky: lawn + blades, pool, paving, beds, planting, hedges, fence, gabions, bollards,
// street, trees and terrain to the horizon, all from houses/<id>/site.json. Exposed as game.landscape.
export class Plugin {
  constructor(game) {
    this.game = game;
    this.landscape = new Landscape(game);
    game.landscape = this.landscape;
  }
  async init() { await this.landscape.init(); }
  update(dt) { this.landscape.update(dt); }
  onTimeOfDay(mode) { this.landscape.onTimeOfDay(mode); }
  onQuality(tier) { this.landscape.onQuality(tier); }
}
