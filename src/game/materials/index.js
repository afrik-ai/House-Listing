import * as THREE from 'three';
import { TextureLibrary, applySurface, applyHideBoxes } from './textures.js';

// P06 — material registry.
//
// Every src/game/materials/*.js except index.js and textures.js is a definition module:
//   export const definitions = { <glbMaterialName | extraName>: async (tex, ctx) => THREE.Material }
//   export const overrides   = [{ node: RegExp, material?: string, use: string }]   (optional)
// `tex(name, opts)` = TextureLibrary.tex (see textures.js). `ctx` = { game, THREE, name, surface, hide, lib }.
// Name clashes: exterior.js wins over every other module (P03 owns exterior names), then later
// files (alphabetical) win over earlier ones.
// overrides: a mesh whose own name or any ancestor's name matches `node` (and whose current material
// is named `material`, when given) gets definition `use` instead of the one named after its material.
//
// Registry API (game.materials === game.plugins.get('15_materials').registry):
//   await registry.apply(root)  replace every registered material under root (shared instances,
//                               userData.registry = true); meshes whose material has userData.p03
//                               are left alone.
//   await registry.get(name)    the shared material for a definition name.
//   registry.has(name), registry.names(), registry.stats()

const MODULES = import.meta.glob(['./*.js', '!./index.js', '!./textures.js'], { eager: true });

function collect() {
  const order = Object.keys(MODULES).sort((a, b) => {
    const ea = /exterior\.js$/.test(a) ? 1 : 0, eb = /exterior\.js$/.test(b) ? 1 : 0;
    return ea - eb || a.localeCompare(b);
  });
  const defs = new Map();
  const overrides = [];
  for (const path of order) {
    const mod = MODULES[path];
    for (const [name, fn] of Object.entries(mod.definitions || {})) {
      if (typeof fn === 'function') defs.set(name, { fn, source: path.replace(/^\.\//, '') });
    }
    for (const o of mod.overrides || []) overrides.push({ ...o, source: path });
  }
  return { defs, overrides };
}

export class MaterialRegistry {
  constructor(game) {
    this.game = game;
    this.lib = new TextureLibrary(game);
    const { defs, overrides } = collect();
    this.defs = defs;
    this.overrides = overrides;
    this.cache = new Map();   // name -> Promise<Material>
    this.applied = new Map(); // name -> mesh count
    this.tex = (name, opts) => this.lib.tex(name, opts);
  }

  has(name) { return this.defs.has(name); }
  names() { return [...this.defs.keys()]; }

  get(name) {
    if (!this.cache.has(name)) {
      const d = this.defs.get(name);
      if (!d) return Promise.resolve(null);
      const ctx = { game: this.game, THREE, name, surface: applySurface, hide: applyHideBoxes, lib: this.lib };
      const job = (async () => {
        await this.lib.init();
        const m = await d.fn(this.tex, ctx);
        if (!m) return null;
        if (!m.name) m.name = name;
        m.userData.registry = true;
        m.userData.def = name;
        m.userData.defSource = d.source;
        return m;
      })();
      job.catch((err) => console.error(`[materials] definition "${name}" (${d.source}) failed`, err));
      this.cache.set(name, job);
    }
    return this.cache.get(name);
  }

  // Which definition should this mesh/material slot use? null = keep the GLB material.
  resolve(mesh, mat) {
    if (!mat || mat.userData?.p03 || mat.userData?.registry) return null;
    const matName = mat.name || '';
    for (const o of this.overrides) {
      if (o.material && o.material !== matName) continue;
      for (let n = mesh; n; n = n.parent) {
        if (n.name && o.node.test(n.name)) return this.defs.has(o.use) ? o.use : null;
      }
    }
    return this.defs.has(matName) ? matName : null;
  }

  async apply(root) {
    if (!root) return 0;
    const slots = [];
    root.traverse((o) => {
      if (!o.isMesh || !o.material) return;
      const mats = Array.isArray(o.material) ? o.material : [o.material];
      mats.forEach((m, i) => {
        const name = this.resolve(o, m);
        if (name) slots.push({ mesh: o, index: Array.isArray(o.material) ? i : -1, name });
      });
    });
    const names = [...new Set(slots.map((s) => s.name))];
    const built = new Map();
    await Promise.all(names.map(async (n) => {
      try { built.set(n, await this.get(n)); } catch { built.set(n, null); }
    }));
    let count = 0;
    for (const s of slots) {
      const m = built.get(s.name);
      if (!m) continue;
      if (s.index >= 0) s.mesh.material[s.index] = m; else s.mesh.material = m;
      this.applied.set(s.name, (this.applied.get(s.name) || 0) + 1);
      count++;
    }
    return count;
  }

  setAnisotropy(level) { this.lib.setAnisotropy(level); }

  stats() {
    return { definitions: this.defs.size, built: this.cache.size, applied: Object.fromEntries(this.applied), textures: this.lib.stats() };
  }
}
