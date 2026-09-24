import * as THREE from 'three';
import {
  EffectComposer, RenderPass, EffectPass,
  SMAAEffect, SMAAPreset, EdgeDetectionMode,
  BloomEffect, VignetteEffect, HueSaturationEffect, BrightnessContrastEffect,
  ToneMappingEffect, ToneMappingMode, Effect, BlendFunction,
} from 'postprocessing';
import { N8AOPostPass } from 'n8ao';

// Post pipeline:  (RenderPass | N8AO) -> [bloom, grade, vignette, tone map] -> [SMAA] -> screen.
//
// Colour management (the one place it is decided — keep it that way):
//  * The scene is rendered LINEAR/HDR into half-float buffers. three.js only applies its own
//    tone mapping + sRGB encode when drawing to the canvas, so nothing is tone-mapped early.
//  * ToneMappingEffect is the single tone-mapping step (it reads renderer.toneMappingExposure).
//  * The last EffectPass drawing to the screen encodes to renderer.outputColorSpace (sRGB).
//  * N8AO's own gamma correction MUST stay off (it defaults to true in N8AOPostPass and would
//    double-encode -> washed-out image).
//  * N8AOPostPass reads the RenderPass colour + the composer's depth texture (no second scene draw).
export const TONE_MAPPERS = {
  agx: ToneMappingMode.AGX,
  aces: ToneMappingMode.ACES_FILMIC,
  neutral: ToneMappingMode.NEUTRAL,
};

// N8AO per tier (P05). aoRadius in metres; distanceFalloff relative to it. aoSamples/denoise are
// also set by setQualityMode, so they are re-applied after it.
const AO_TIERS = {
  low: { aoRadius: 0.5, distanceFalloff: 0.4, intensity: 3.5, aoSamples: 8, denoiseSamples: 4, denoiseRadius: 8 },
  medium: { aoRadius: 0.55, distanceFalloff: 0.4, intensity: 4.0, aoSamples: 12, denoiseSamples: 6, denoiseRadius: 8 },
  high: { aoRadius: 0.6, distanceFalloff: 0.35, intensity: 4.6, aoSamples: 16, denoiseSamples: 8, denoiseRadius: 8 },
  ultra: { aoRadius: 0.6, distanceFalloff: 0.35, intensity: 4.6, aoSamples: 24, denoiseSamples: 8, denoiseRadius: 8 },
};

// Linear-light colour balance (white balance / tint), applied before tone mapping.
class WhiteBalanceEffect extends Effect {
  constructor() {
    super('WhiteBalanceEffect', /* glsl */`
      uniform vec3 tint;
      void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
        outputColor = vec4(inputColor.rgb * tint, inputColor.a);
      }`, { blendFunction: BlendFunction.NORMAL, uniforms: new Map([['tint', new THREE.Uniform(new THREE.Vector3(1, 1, 1))]]) });
  }
  get tint() { return this.uniforms.get('tint').value; }
}

export class PostFX {
  constructor(renderer, scene, camera) {
    this.renderer = renderer;
    this.scene = scene;
    this.camera = camera;
    this.enabled = true;

    const gl = renderer.gl;
    this.composer = new EffectComposer(gl, {
      frameBufferType: THREE.HalfFloatType, multisampling: 0, depthBuffer: true, stencilBuffer: false,
    });

    this.renderPass = new RenderPass(scene, camera);

    this.ao = new N8AOPostPass(scene, camera, renderer.width, renderer.height);
    // No transparency-aware mode: it re-renders every transparent-flagged mesh (many props, glass) twice
    // per frame into extra targets (measured ~2x furniture triangles). AO reuses the main depth buffer.
    this.ao.autoDetectTransparency = false;
    // P05: tight contact term (furniture feet, skirting, corners) rather than a broad room-scale dirt.
    Object.assign(this.ao.configuration, {
      ...AO_TIERS.high, screenSpaceRadius: false, halfRes: false, color: new THREE.Color(0x000000),
      gammaCorrection: false, transparencyAware: false,
    });

    this.bloom = new BloomEffect({
      mipmapBlur: true, luminanceThreshold: 0.92, luminanceSmoothing: 0.4, intensity: 0.7, radius: 0.8,
    });
    this.grade = new HueSaturationEffect({ saturation: 0.08 });
    this.contrast = new BrightnessContrastEffect({ brightness: 0.0, contrast: 0.06 });
    this.vignette = new VignetteEffect({ offset: 0.3, darkness: 0.42 });
    this.whiteBalance = new WhiteBalanceEffect();
    this.toneMapName = 'aces';
    this.toneMap = new ToneMappingEffect({ mode: TONE_MAPPERS[this.toneMapName] });
    this.smaa = new SMAAEffect({ preset: SMAAPreset.ULTRA, edgeDetectionMode: EdgeDetectionMode.COLOR });

    this.settings = null;
    this._build(renderer.settings);
    renderer.onQuality((s) => this.applyQuality(s));
    renderer.onResize((w, h) => this.setSize(w, h));
  }

  _build(settings) {
    const c = this.composer;
    c.removeAllPasses();
    c.addPass(this.renderPass);
    this.ao.enabled = !!settings.ao;
    if (settings.ao) c.addPass(this.ao);
    const effects = [];
    if (settings.bloom) effects.push(this.bloom);
    if (settings.grade) effects.push(this.grade, this.contrast);
    if (settings.vignette) effects.push(this.vignette);
    effects.push(this.whiteBalance, this.toneMap);
    this.effectPass = new EffectPass(this.camera, ...effects);
    c.addPass(this.effectPass);
    this.smaaPass = null;
    if (settings.smaa) {
      this.smaaPass = new EffectPass(this.camera, this.smaa);
      c.addPass(this.smaaPass);
    }
    this.ao.configuration.gammaCorrection = false;
    this.settings = settings;
  }

  setToneMapping(name) {
    if (!TONE_MAPPERS[name]) throw new Error(`unknown tone mapper "${name}" (${Object.keys(TONE_MAPPERS).join('|')})`);
    this.toneMapName = name;
    this.toneMap.mode = TONE_MAPPERS[name];
    this.renderer.gl.toneMapping = { agx: THREE.AgXToneMapping, aces: THREE.ACESFilmicToneMapping, neutral: THREE.NeutralToneMapping }[name];
  }

  // Runtime AO override (debug / photo mode): postfx.setAO({ aoRadius, intensity, distanceFalloff }).
  setAO(cfg) { Object.assign(this.ao.configuration, cfg); }

  setWhiteBalance(r, g, b) { this.whiteBalance.tint.set(r, g, b); }

  // Grade knobs used by Lighting per time of day.
  setGrade({ saturation, contrast, bloom, bloomThreshold, vignette } = {}) {
    if (saturation !== undefined) this.grade.saturation = saturation;
    if (contrast !== undefined) this.contrast.contrast = contrast;
    if (bloom !== undefined) this.bloom.intensity = bloom;
    if (bloomThreshold !== undefined) this.bloom.luminanceMaterial.threshold = bloomThreshold;
    if (vignette !== undefined) this.vignette.darkness = vignette;
  }

  applyQuality(settings) {
    this.ao.configuration.halfRes = !!settings.aoHalfRes;
    this.ao.setQualityMode(settings.aoQuality || 'Medium');
    Object.assign(this.ao.configuration, AO_TIERS[settings.tier] || AO_TIERS.high);
    this.ao.configuration.gammaCorrection = false;
    this._build(settings);
    this.setSize(this.renderer.width, this.renderer.height);
  }

  setSize(w, h) {
    this.composer.setSize(w, h, false);
  }

  setCamera(camera) {
    this.camera = camera;
    this.renderPass.mainCamera = camera;
    this.ao.camera = camera;
    if (this.effectPass) this.effectPass.mainCamera = camera;
    if (this.smaaPass) this.smaaPass.mainCamera = camera;
  }

  render(dt = 1 / 60) {
    if (!this.enabled) { this.renderer.render(this.scene, this.camera); return; }
    this.composer.render(dt);
  }

  dispose() { this.composer.dispose(); }
}
