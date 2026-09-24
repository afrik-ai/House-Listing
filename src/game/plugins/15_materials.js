import { MaterialRegistry } from '../materials/index.js';

// P06 — material registry plugin. Replaces every house-GLB material that has a definition in
// src/game/materials/*.js (interior.js = P06, exterior.js = P03) with a shared textured material.
// Exposes the registry as game.materials (see materials/index.js for the API).
export class Plugin {
  constructor(game) {
    this.game = game;
    this.registry = new MaterialRegistry(game);
    game.materials = this.registry;
  }

  // Same API on the plugin instance (game.plugins.get('15_materials').apply(root)).
  apply(root) { return this.registry.apply(root); }
  get(name) { return this.registry.get(name); }

  async init() {
    const root = this.game.house?.root;
    const t0 = performance.now();
    const n = await this.registry.apply(root);
    const s = this.registry.stats();
    console.info(`[materials] ${n} slots -> ${s.built} materials (${Object.keys(s.applied).join(', ')}); `
      + `${s.textures.images} images ~${s.textures.gpuMB} MB GPU; ${Math.round(performance.now() - t0)} ms`);
  }

  onQuality() {
    const a = this.game.renderer?.settings?.anisotropy || this.game.renderer?._settings?.anisotropy;
    if (a) this.registry.setAnisotropy(a);
  }
}
