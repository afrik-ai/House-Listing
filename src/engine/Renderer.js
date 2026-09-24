import * as THREE from 'three';

export const QUALITY_TIERS = ['low', 'medium', 'high', 'ultra'];

// Per-tier settings. `pixelRatio` is a cap against window.devicePixelRatio.
// `anisotropy: 0` means "max supported by the GPU".
// PCFSoftShadowMap was removed in three r18x (PCFShadowMap + shadow.radius is the soft path now).
const TIERS = {
  low:    { shadowMap: 1024, shadowRadius: 1.5, pixelRatio: 1.0, supersample: 0.85, anisotropy: 4, shadowType: THREE.PCFShadowMap,
            ao: false, aoHalfRes: true,  aoQuality: 'Low',    bloom: false, vignette: false, grade: true,  smaa: true, hdriRes: '1k', transmissionScale: 0.5 },
  medium: { shadowMap: 2048, shadowRadius: 2.5, pixelRatio: 1.0, supersample: 1, anisotropy: 8, shadowType: THREE.PCFShadowMap,
            ao: true,  aoHalfRes: false, aoQuality: 'Performance', bloom: true,  vignette: true,  grade: true,  smaa: true, hdriRes: '1k', transmissionScale: 0.75 },
  high:   { shadowMap: 4096, shadowRadius: 3.0, pixelRatio: 1.5, supersample: 1, anisotropy: 0, shadowType: THREE.PCFShadowMap,
            ao: true,  aoHalfRes: false, aoQuality: 'Medium', bloom: true,  vignette: true,  grade: true,  smaa: true, hdriRes: '2k' },
  ultra:  { shadowMap: 4096, shadowRadius: 3.0, pixelRatio: 2.0, supersample: 1.5, anisotropy: 0, shadowType: THREE.PCFShadowMap,
            ao: true,  aoHalfRes: false, aoQuality: 'High',   bloom: true,  vignette: true,  grade: true,  smaa: true, hdriRes: '2k' },
};

const CANVAS_STYLE = { position: 'fixed', inset: '0', width: '100%', height: '100%', display: 'block', outline: 'none' };

export class Renderer {
  constructor(canvas, { quality = 'high' } = {}) {
    this.canvas = canvas;
    Object.assign(canvas.style, CANVAS_STYLE);

    this.gl = new THREE.WebGLRenderer({
      canvas, antialias: false, alpha: false, stencil: false, depth: true,
      powerPreference: 'high-performance', preserveDrawingBuffer: false,
    });
    this.gl.outputColorSpace = THREE.SRGBColorSpace;
    this.gl.toneMapping = THREE.AgXToneMapping;
    this.gl.toneMappingExposure = 1.0;
    this.gl.shadowMap.enabled = true;
    this.gl.shadowMap.type = THREE.PCFShadowMap;
    this.gl.setClearColor(0x0b0d10, 1);
    this.maxAnisotropy = this.gl.capabilities.getMaxAnisotropy();

    this._qualityListeners = new Set();
    this._resizeListeners = new Set();
    this.width = 1; this.height = 1;

    this.setQuality(quality);
    this._onWindowResize = () => this.resize();
    window.addEventListener('resize', this._onWindowResize);
    this.resize();
  }

  get tier() { return this._tier; }
  get settings() { return this._settings; }
  get exposure() { return this.gl.toneMappingExposure; }
  set exposure(v) { this.gl.toneMappingExposure = v; }
  get pixelRatio() { return this.gl.getPixelRatio(); }

  setQuality(tier) {
    if (!TIERS[tier]) throw new Error(`unknown quality tier "${tier}"`);
    const t = TIERS[tier];
    this._tier = tier;
    this._settings = { ...t, tier, anisotropy: t.anisotropy || this.maxAnisotropy };
    this.gl.shadowMap.type = t.shadowType;
    if ('transmissionResolutionScale' in this.gl) this.gl.transmissionResolutionScale = t.transmissionScale ?? 1;
    this.gl.shadowMap.needsUpdate = true;
    this._applyPixelRatio();
    for (const fn of this._qualityListeners) fn(this._settings);
    return this._settings;
  }

  onQuality(fn) { this._qualityListeners.add(fn); return () => this._qualityListeners.delete(fn); }
  onResize(fn) { this._resizeListeners.add(fn); return () => this._resizeListeners.delete(fn); }

  _applyPixelRatio() {
    // Device pixels (capped per tier) x supersample: ultra renders 1.5x (SSAA on top of SMAA, fixes
    // thin-geometry sparkle), low renders 0.85x.
    const pr = Math.min(window.devicePixelRatio || 1, this._settings.pixelRatio) * (this._settings.supersample ?? 1);
    if (pr !== this.gl.getPixelRatio()) this.gl.setPixelRatio(pr);
    this.gl.setSize(this.width, this.height, false);
    for (const fn of this._resizeListeners) fn(this.width, this.height, pr);
  }

  resize(width = window.innerWidth, height = window.innerHeight) {
    this.width = Math.max(1, width | 0);
    this.height = Math.max(1, height | 0);
    this._applyPixelRatio();
  }

  // Sets anisotropy on every texture under `root` (or on a single material/texture).
  applyAnisotropy(root) {
    const level = this._settings.anisotropy;
    const seen = new Set();
    const visitMaterial = (m) => {
      for (const v of Object.values(m)) {
        if (v && v.isTexture && !seen.has(v)) {
          seen.add(v);
          if (v.anisotropy !== level) { v.anisotropy = level; v.needsUpdate = true; }
        }
      }
    };
    if (root.isTexture) { root.anisotropy = level; root.needsUpdate = true; return; }
    if (root.isMaterial) { visitMaterial(root); return; }
    root.traverse((o) => {
      if (!o.material) return;
      const mats = Array.isArray(o.material) ? o.material : [o.material];
      mats.forEach(visitMaterial);
    });
  }

  render(scene, camera) { this.gl.render(scene, camera); }

  get info() { return this.gl.info; }

  dispose() {
    window.removeEventListener('resize', this._onWindowResize);
    this.gl.dispose();
  }
}
