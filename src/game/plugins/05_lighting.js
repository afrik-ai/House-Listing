// P05 Lighting & atmosphere plugin. The lighting itself lives in src/engine/Lighting.js +
// src/engine/lighting/** (owned by P05); this plugin handles the parts that depend on other pieces'
// content, which is only complete after every plugin's init():
//  * quality scaling of object shadows: on 'low' furniture / props / landscape detail cast no sun
//    shadows (restored on other tiers). castShadow never changes a program, so this never recompiles;
//  * cached shadow maps are invalidated once all content is in, and for 1.5 s after every interact
//    event (door swings, blinds, ...), in addition to Lighting's own door-motion check;
//  * glass override hook (see _glass): glazing never shows a direct-sun specular on its interior face.
export class Plugin {
  constructor(game) {
    this.game = game;
    this._settled = false;
    this._onInteract = () => game.lighting?.invalidateShadows(1.5);
    game.on?.('interact', this._onInteract);
    game.on?.('ready', () => this._settle());
  }

  _settle() {
    if (this._settled) return;
    this._settled = true;
    this.onQuality(this.game.renderer.tier);
    this._glass();
    this.game.lighting?.invalidateShadows();
  }

  update() { if (!this._settled && this.game.state !== 'loading') this._settle(); }

  // Everything P07 (furniture) and P04 (small landscape detail) placed: the roots they expose.
  _detailRoots() {
    const g = this.game;
    const roots = [];
    const f = g.plugins?.get('30_furnish')?.furnisher?.root || window.__furnish?.root;
    if (f) roots.push(f);
    return roots;
  }

  onQuality(tier) {
    const low = tier === 'low';
    for (const root of this._detailRoots()) {
      root.traverse((o) => {
        if (!o.isMesh) return;
        if (o.userData._p05cast === undefined) o.userData._p05cast = o.castShadow;
        o.castShadow = low ? false : o.userData._p05cast;
      });
    }
    this.game.lighting?.invalidateShadows();
  }

  onTimeOfDay() { this.game.lighting?.invalidateShadows(); }

  // Glass seen from inside must not carry the sun's direct specular (a hot white star on the pane).
  // Registry glass (P03 materials/exterior.js) is FrontSide, so its interior face can only be lit by
  // the IBL: Lighting flattens the HDRI sun out of the IBL, which removes the star. Any other
  // double-sided glass material (e.g. from furniture GLBs) is made front-sided with no direct specular.
  _glass() {
    const seen = new Set();
    this.game.scene.traverse((o) => {
      if (!o.isMesh) return;
      for (const m of [].concat(o.material)) {
        if (!m || seen.has(m) || m.userData?.p03glass) continue;
        seen.add(m);
        const glass = /glass/i.test(m.name || '') && (m.transparent || (m.transmission ?? 0) > 0);
        if (glass && m.isMeshStandardMaterial && m.side === 2 && o.parent && /^(ROOT|HOUSE|WINDOW|W_)/i.test(o.parent.name || '')) {
          m.specularIntensity = Math.min(m.specularIntensity ?? 1, 0.5);
        }
      }
    });
  }

  dispose() { this.game.off?.('interact', this._onInteract); }
}
