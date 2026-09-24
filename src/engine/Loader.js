import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { KTX2Loader } from 'three/addons/loaders/KTX2Loader.js';
import { HDRLoader } from 'three/addons/loaders/HDRLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { EventEmitter } from './EventEmitter.js';

// Aggregate asset loader. Every request is a "task"; progress is the mean of per-task
// fractions (bytes-based while downloading, 1 when parsed). Emits:
//   'progress' {fraction, bytes, total, items, done, label}
//   'idle'      when every task has finished
export class Loader extends EventEmitter {
  constructor({ renderer } = {}) {
    super();
    this.gl = renderer?.gl ?? null;
    this.manager = new THREE.LoadingManager();
    this.tasks = new Map();
    this._nextId = 1;
    this.textures = new Map();

    this.draco = new DRACOLoader().setDecoderPath('/draco/');
    this.ktx2 = new KTX2Loader().setTranscoderPath('/basis/');
    if (this.gl) this.ktx2.detectSupport(this.gl);

    this.gltf = new GLTFLoader(this.manager)
      .setDRACOLoader(this.draco)
      .setKTX2Loader(this.ktx2)
      .setMeshoptDecoder(MeshoptDecoder);
    this.rgbe = new HDRLoader(this.manager);
    this.tex = new THREE.TextureLoader(this.manager);
  }

  // ---- progress bookkeeping -------------------------------------------------

  _begin(label) {
    const id = this._nextId++;
    this.tasks.set(id, { label, loaded: 0, total: 0, done: false });
    this._emitProgress(label);
    return id;
  }
  _update(id, loaded, total) {
    const t = this.tasks.get(id); if (!t) return;
    t.loaded = loaded; t.total = total || t.total;
    this._emitProgress(t.label);
  }
  _end(id) {
    const t = this.tasks.get(id); if (!t) return;
    t.done = true; if (t.total) t.loaded = t.total;
    this._emitProgress(t.label);
    if (this.isIdle) this.emit('idle');
  }
  get isIdle() { for (const t of this.tasks.values()) if (!t.done) return false; return true; }

  // Byte-weighted: a task with a known size counts its bytes; unknown-size tasks count 64 KB each.
  get progress() {
    const UNKNOWN = 65536;
    let num = 0, den = 0, bytes = 0, total = 0, done = 0;
    for (const t of this.tasks.values()) {
      const w = t.total > 0 ? t.total : (t.expected || UNKNOWN);
      den += w;
      num += t.done ? w : (t.total > 0 ? Math.min(t.loaded, t.total) : 0);
      bytes += t.loaded; total += t.total; if (t.done) done++;
    }
    return { fraction: den ? num / den : 0, bytes, total, items: this.tasks.size, done };
  }
  _emitProgress(label) { this.emit('progress', { ...this.progress, label }); }

  // Wrap an arbitrary async job so it participates in the aggregate progress.
  async track(label, promiseOrFn) {
    const id = this._begin(label);
    try { return await (typeof promiseOrFn === 'function' ? promiseOrFn() : promiseOrFn); }
    finally { this._end(id); }
  }

  _load(loader, url, label = url) {
    const id = this._begin(label);
    return new Promise((resolve, reject) => {
      loader.load(url,
        (res) => { this._end(id); resolve(res); },
        (ev) => this._update(id, ev.loaded, ev.lengthComputable ? ev.total : 0),
        (err) => { this._end(id); reject(err instanceof Error ? err : new Error(`failed to load ${url}`)); });
    });
  }

  // ---- public loaders -------------------------------------------------------

  // Existence probe. A 1-byte ranged GET instead of HEAD: Chromium aborts HEAD bodies on some
  // dev-server responses (shows up as failed requests). Vite answers unknown paths with index.html
  // (200 text/html), so an HTML content-type counts as "missing" for non-HTML assets.
  async exists(url) {
    if (this._exists?.has(url)) return this._exists.get(url);
    this._exists = this._exists || new Map();
    const job = (async () => {
      try {
        const r = await fetch(url, { headers: { Range: 'bytes=0-0' }, cache: 'no-store' });
        const type = r.headers.get('content-type') || '';
        await r.arrayBuffer().catch(() => {});
        return r.ok && (url.endsWith('.html') || !type.includes('text/html'));
      } catch { return false; }
    })();
    this._exists.set(url, job);
    return job;
  }

  // Cached per URL: several modules asking for the same JSON share one request.
  json(url, label = url) {
    this._json = this._json || new Map();
    if (!this._json.has(url)) {
      const job = this.track(label, async () => {
        const r = await fetch(url);
        const type = r.headers.get('content-type') || '';
        if (!r.ok || type.includes('text/html')) throw new Error(`${url}: missing (HTTP ${r.status})`);
        return r.json();
      });
      job.catch(() => {});
      this._json.set(url, job);
    }
    return this._json.get(url);
  }

  loadGLTF(url, label = url) { return this._load(this.gltf, url, label); }

  async loadTexture(url, { colorSpace = THREE.SRGBColorSpace, repeat = null, wrap = THREE.RepeatWrapping, anisotropy = 8 } = {}) {
    const key = `${url}|${colorSpace}`;
    if (this.textures.has(key)) return this.textures.get(key);
    const p = this._load(this.tex, url).then((t) => {
      t.colorSpace = colorSpace;
      t.wrapS = t.wrapT = wrap;
      t.anisotropy = anisotropy;
      if (repeat) t.repeat.set(repeat[0], repeat[1]);
      t.needsUpdate = true;
      return t;
    });
    this.textures.set(key, p);
    return p;
  }

  async loadHDRI(url, label = url) {
    this._hdr = this._hdr || new Map();
    if (!this._hdr.has(url)) {
      const job = this._load(this.rgbe, url, label).then((t) => { t.mapping = THREE.EquirectangularReflectionMapping; return t; });
      job.catch(() => this._hdr.delete(url));
      this._hdr.set(url, job);
    }
    return this._hdr.get(url);
  }

  // Loads /assets/houses/<id>/house.glb (+ house.meta.json). One request per file: the meta is
  // fetched first (small); the GLB is then loaded directly (no existence probe). A missing GLB
  // (Vite answers with index.html) fails to parse -> {kind:'procedural'} fallback.
  async house(id) {
    const base = `/assets/houses/${id}`;
    const meta = await this.json(`${base}/house.meta.json`, 'house metadata').catch(() => null);
    try {
      const gltf = await this.loadGLTF(`${base}/house.glb`, 'house geometry');
      return { kind: 'glb', id, gltf, meta };
    } catch {
      return { kind: 'procedural', id };
    }
  }

  dispose() { this.draco.dispose(); this.ktx2.dispose(); }
}
