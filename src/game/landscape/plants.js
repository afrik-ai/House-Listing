import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { rng, fbm, GLSL_NOISE } from './util.js';

// ---- GLB models -> instanced parts -------------------------------------------------------------
// A "kind" = one model (or one named variant of it): list of {geometry, material, matrix} parts.
// Instances are added with add(kind, matrix); build() makes one InstancedMesh per part.
export class InstancedModels {
  constructor(ctx) { this.ctx = ctx; this.gltf = new Map(); this.kinds = new Map(); this.meshes = []; }

  async model(name) {
    if (!this.gltf.has(name)) this.gltf.set(name, this.ctx.game.loader.loadGLTF(`/assets/models/${name}.glb`, `garden: ${name}`));
    return this.gltf.get(name);
  }

  // Returns a kind key. `variant` = top-level child name (manifest "variants").
  async kind(name, variant = null, { alphaTest = 0.5, tint = null } = {}) {
    const key = `${name}:${variant || ''}`;
    if (this.kinds.has(key)) return key;
    const g = await this.model(name);
    const root = variant ? g.scene.getObjectByName(variant) : g.scene;
    if (!root) throw new Error(`model ${name} has no variant ${variant}`);
    root.updateWorldMatrix(true, true);
    const inv = root.matrixWorld.clone().invert();
    // variants are authored side by side: re-centre on the variant's own base
    const box = new THREE.Box3().setFromObject(root);
    const recentre = new THREE.Matrix4().makeTranslation(-(box.min.x + box.max.x) / 2 + root.matrixWorld.elements[12], -box.min.y + root.matrixWorld.elements[13], -(box.min.z + box.max.z) / 2 + root.matrixWorld.elements[14]);
    const byMat = new Map();
    root.traverse((o) => {
      if (!o.isMesh) return;
      const m = new THREE.Matrix4().multiplyMatrices(inv, o.matrixWorld).premultiply(recentre);
      // KHR_mesh_quantization: attributes are normalized int16/int8 — dequantise to float before
      // baking the node transform (applyMatrix4 on int arrays clamps everything to [-1, 1]).
      const geo = new THREE.BufferGeometry();
      for (const [name, a] of Object.entries(o.geometry.attributes)) {
        if (!['position', 'normal', 'uv'].includes(name)) continue;
        const f = new Float32Array(a.count * a.itemSize);
        for (let i = 0; i < a.count; i++) for (let c = 0; c < a.itemSize; c++) f[i * a.itemSize + c] = a.getComponent(i, c);
        geo.setAttribute(name, new THREE.BufferAttribute(f, a.itemSize));
      }
      if (o.geometry.index) geo.setIndex(o.geometry.index.clone());
      geo.applyMatrix4(m);
      if (!geo.attributes.uv) geo.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(geo.attributes.position.count * 2), 2));
      const mat = o.material;
      if (!byMat.has(mat)) byMat.set(mat, []);
      byMat.get(mat).push(geo.index ? geo : geo);
    });
    const parts = [];
    for (const [mat, geos] of byMat) {
      const nonIdx = geos.some((g) => !g.index);
      const geo = geos.length === 1 ? geos[0] : mergeGeometries(nonIdx ? geos.map((g) => (g.index ? g.toNonIndexed() : g)) : geos, false);
      const m2 = fixFoliage(mat, alphaTest, tint);
      parts.push({ geometry: geo, material: m2 });
    }
    const size = box.getSize(new THREE.Vector3());
    this.kinds.set(key, { parts, instances: [], size, name });
    return key;
  }

  size(key) { return this.kinds.get(key).size; }
  add(key, matrix) { this.kinds.get(key).instances.push(matrix.clone()); }

  build(group, { castShadow = true, receiveShadow = true, prefix = 'LS_plant' } = {}) {
    for (const [key, k] of this.kinds) {
      if (!k.instances.length) continue;
      for (const p of k.parts) {
        const im = new THREE.InstancedMesh(p.geometry, p.material, k.instances.length);
        k.instances.forEach((m, i) => im.setMatrixAt(i, m));
        im.instanceMatrix.needsUpdate = true;
        im.computeBoundingSphere();
        im.castShadow = castShadow; im.receiveShadow = receiveShadow;
        im.name = `${prefix}_${key}`;
        group.add(im);
        this.meshes.push(im);
      }
    }
  }
}

// Foliage from Poly Haven GLBs is alpha BLEND (sorting artefacts, no depth write): make it cutout.
const fixed = new Map();
function fixFoliage(mat, alphaTest, tint) {
  const key = `${mat.uuid}:${alphaTest}:${tint || ''}`;
  if (fixed.has(key)) return fixed.get(key);
  const m = mat.clone();
  if (mat.transparent || mat.alphaTest > 0 || /leaf|leaves|grass|plant|shrub|flower/i.test(mat.name)) {
    m.transparent = false; m.depthWrite = true; m.alphaTest = alphaTest; m.side = THREE.DoubleSide;
    m.alphaToCoverage = false;
  }
  if (tint) m.color.multiply(new THREE.Color().setRGB(...tint));
  fixed.set(key, m);
  return m;
}

// ---- procedural ornamental grasses ---------------------------------------------------------------
// 'feather': upright Calamagrostis-like clump with tan plume stalks (~1.4 m);
// 'pampas' : arching mound of fine blades with cream fluffy plumes (~1.0 m).
function ornamentalGeometry(type, seed) {
  const R = rng(seed);
  const P = [], N = [], C = [], idx = [];
  const leaf = type === 'feather' ? { n: 70, len: [0.5, 0.9], arch: 0.3, spread: 0.4, w: 0.016 } : { n: 90, len: [0.45, 0.85], arch: 0.6, spread: 0.75, w: 0.014 };
  const plume = type === 'feather' ? { n: 22, len: [1.1, 1.5], head: 0.3, w: 0.02, spread: 0.12 } : { n: 11, len: [0.9, 1.2], head: 0.3, w: 0.05, spread: 0.5 };
  const green = type === 'feather' ? [0.07, 0.13, 0.03] : [0.09, 0.14, 0.05];
  const tip = type === 'feather' ? [0.2, 0.22, 0.08] : [0.24, 0.26, 0.14];
  const plumeCol = type === 'feather' ? [0.36, 0.27, 0.15] : [0.52, 0.47, 0.37];
  const strip = (pts, widthAt, colAt, faceDir) => {
    const base = P.length / 3;
    for (let i = 0; i < pts.length; i++) {
      const p = pts[i], t = i / (pts.length - 1);
      const w = widthAt(t);
      for (const s of [-1, 1]) {
        P.push(p[0] + faceDir[0] * s * w, p[1], p[2] + faceDir[1] * s * w);
        const out = [p[0], 0.0, p[2]]; const L = Math.hypot(out[0], out[2]) || 1;
        N.push(out[0] / L * 0.5, 0.85, out[2] / L * 0.5);
        const c = colAt(t); C.push(c[0], c[1], c[2]);
      }
    }
    for (let i = 0; i < pts.length - 1; i++) {
      const a = base + i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
  };
  const lerp3 = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
  for (let i = 0; i < leaf.n; i++) {
    const az = R() * Math.PI * 2;
    const tilt = Math.pow(R(), 0.7) * leaf.spread;
    const len = leaf.len[0] + R() * (leaf.len[1] - leaf.len[0]);
    const dx = Math.cos(az), dz = Math.sin(az);
    const r0 = R() * 0.06;
    const pts = [];
    for (let s = 0; s <= 6; s++) {
      const t = s / 6;
      const horiz = Math.sin(tilt) * len * t + leaf.arch * len * t * t * (0.4 + tilt);
      const up = Math.cos(tilt) * len * t - leaf.arch * 0.5 * len * t * t * t * (0.3 + tilt);
      pts.push([dx * (r0 + horiz), Math.max(0, up), dz * (r0 + horiz)]);
    }
    const shade = 0.8 + R() * 0.4;
    strip(pts, (t) => leaf.w * (1 - t * 0.9), (t) => lerp3(green, tip, Math.pow(t, 1.6)).map((v) => v * shade * (0.55 + 0.45 * t)), [-dz, dx]);
  }
  for (let i = 0; i < plume.n; i++) {
    const az = R() * Math.PI * 2;
    const tilt = R() * plume.spread;
    const len = plume.len[0] + R() * (plume.len[1] - plume.len[0]);
    const dx = Math.cos(az), dz = Math.sin(az);
    const stem = [], head = [];
    for (let s = 0; s <= 5; s++) {
      const t = s / 5;
      const L = len * t;
      const p = [dx * (Math.sin(tilt) * L + 0.02), Math.cos(tilt) * L, dz * (Math.sin(tilt) * L + 0.02)];
      if (L >= len - plume.head) head.push(p);
      if (L <= len - plume.head + 0.01) stem.push(p);
    }
    const hc = plumeCol.map((v) => v * (0.85 + R() * 0.3));
    strip(stem, () => 0.0025, () => [0.26, 0.26, 0.12], [-dz, dx]);
    // plume: a spray of thin strands from the head base (tight spike for feather reed, fanned
    // duster for pampas), each slightly curved and thinning to the tip
    if (head.length >= 1) {
      const a = head[0];
      const top = [dx * (Math.sin(tilt) * len + 0.02), Math.cos(tilt) * len, dz * (Math.sin(tilt) * len + 0.02)];
      const axis = [top[0] - a[0], top[1] - a[1], top[2] - a[2]];
      const nStr = type === 'feather' ? 9 : 22;
      for (let k = 0; k < nStr; k++) {
        const fa = R() * Math.PI * 2, fan = (type === 'feather' ? 0.05 : 0.22) * (0.4 + R() * 0.6);
        const off = [Math.cos(fa) * fan, 0, Math.sin(fa) * fan];
        const startT = R() * 0.45, sl = 0.55 + R() * 0.45;
        const pts = [];
        for (let s = 0; s <= 4; s++) {
          const t = startT + (1 - startT) * sl * (s / 4);
          const spread = (s / 4);
          pts.push([a[0] + axis[0] * t + off[0] * spread * plume.head, a[1] + axis[1] * t - (type === 'pampas' ? 0.04 * spread * spread : 0), a[2] + axis[2] * t + off[2] * spread * plume.head]);
        }
        const c = hc.map((v) => v * (0.8 + R() * 0.35));
        const w0 = type === 'feather' ? 0.0045 : 0.0045;
        strip(pts, (t) => w0 * (1 - 0.6 * t), () => c, R() < 0.5 ? [-dz, dx] : [dx, dz]);
      }
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(N, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(C, 3));
  g.setIndex(idx);
  g.computeBoundingSphere();
  return g;
}

export function windMaterial(opts = {}) {
  const m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.75, metalness: 0, side: THREE.DoubleSide, ...opts });
  const uniforms = { uTime: { value: 0 } };
  m.customProgramCacheKey = () => 'ls-wind-1';
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, uniforms);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', `#include <common>\nuniform float uTime;\n${GLSL_NOISE}`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        {
          vec3 ip = vec3(0.0);
          #ifdef USE_INSTANCING
            ip = instanceMatrix[3].xyz;
          #endif
          float hgt = max(transformed.y, 0.0);
          float w = (lsNoise(ip.xz * 0.3 + uTime * 0.35) - 0.5) * 2.0 + sin(uTime * 1.7 + ip.x + ip.z * 0.7) * 0.35;
          transformed.xz += vec2(0.9, 0.45) * w * 0.07 * hgt * hgt;
        }`);
    sh.fragmentShader = sh.fragmentShader.replace('#include <normal_fragment_begin>', '#include <normal_fragment_begin>\nnormal *= faceDirection;');
  };
  m.userData.uniforms = uniforms;
  return m;
}

export function buildOrnamentals(placements, group) {
  const types = { feather: [ornamentalGeometry('feather', 11), ornamentalGeometry('feather', 23)], pampas: [ornamentalGeometry('pampas', 5), ornamentalGeometry('pampas', 41)] };
  const mat = windMaterial();
  const meshes = [];
  for (const [type, geos] of Object.entries(types)) {
    geos.forEach((geo, vi) => {
      const list = placements.filter((p) => p.type === type && p.variant % geos.length === vi);
      if (!list.length) return;
      const im = new THREE.InstancedMesh(geo, mat, list.length);
      const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3();
      list.forEach((p, i) => {
        q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), p.rot);
        s.set(p.scale * (0.9 + (i % 3) * 0.08), p.scale, p.scale * (0.9 + (i % 2) * 0.12));
        im.setMatrixAt(i, m.compose(new THREE.Vector3(p.x, p.y, p.z), q, s));
      });
      im.instanceMatrix.needsUpdate = true;
      im.computeBoundingSphere();
      im.castShadow = false; im.receiveShadow = true;
      im.name = `LS_ornamental_${type}_${vi}`;
      group.add(im);
      meshes.push(im);
    });
  }
  return { meshes, material: mat };
}

// ---- trees: full meshes near the camera, baked billboard impostors beyond ------------------------
export class Trees {
  constructor(ctx) {
    this.ctx = ctx;
    this.models = new Map();   // name -> {parts, size, impostor:{tex, w, h}}
    this.fixed = [];           // always-full garden trees
    this.dynamic = [];         // LOD'd trees {model, pos, scale, rot, m}
    this.far = [];             // impostor-only
    this._t = 0;
    this._lastCam = new THREE.Vector3(1e9, 0, 0);
  }

  async load(names, instanced) {
    for (const n of names) {
      const key = await instanced.kind(n, null, { alphaTest: 0.45 });
      const k = instanced.kinds.get(key);
      this.models.set(n, { parts: k.parts, size: k.size, impostor: this._bake(k) });
    }
  }

  // Orthographic side render of the tree (albedo-ish, soft top light) into a half-float texture.
  _bake(kind) {
    const gl = this.ctx.game.renderer.gl;
    const { size } = kind;
    const S = 512;
    const w = Math.max(size.x, size.z) * 1.02, h = size.y * 1.02;
    const rt = new THREE.WebGLRenderTarget(S, Math.round(S * Math.min(2, h / w)), { type: THREE.HalfFloatType, generateMipmaps: true, minFilter: THREE.LinearMipmapLinearFilter, magFilter: THREE.LinearFilter });
    const scene = new THREE.Scene();
    for (const p of kind.parts) scene.add(new THREE.Mesh(p.geometry, p.material));
    scene.add(new THREE.AmbientLight(0xffffff, Math.PI * 0.62));
    const dl = new THREE.DirectionalLight(0xffffff, Math.PI * 0.55); dl.position.set(0.3, 1, 0.8); scene.add(dl);
    const cam = new THREE.OrthographicCamera(-w / 2, w / 2, h, 0, -50, 50);
    cam.position.set(0, 0, 10); cam.lookAt(0, 0, 0);
    cam.top = h; cam.bottom = 0; cam.updateProjectionMatrix();
    const prevRT = gl.getRenderTarget(), prevClear = gl.getClearColor(new THREE.Color()), prevAlpha = gl.getClearAlpha();
    const prevTM = gl.toneMapping;
    gl.toneMapping = THREE.NoToneMapping;
    gl.setRenderTarget(rt);
    gl.setClearColor(0x000000, 0);
    gl.clear(true, true, true);
    gl.render(scene, cam);
    gl.setRenderTarget(prevRT);
    gl.setClearColor(prevClear, prevAlpha);
    gl.toneMapping = prevTM;
    return { tex: rt.texture, w, h, rt };
  }

  addFixed(t) { this.fixed.push(t); }
  addDynamic(t) { this.dynamic.push(t); }
  addFar(t) { this.far.push(t); }

  // All trees share one LOD: the `maxFull` nearest within `fullDist` use the real mesh (casts
  // shadows); every other tree is a camera-facing impostor whose shadow pass faces the sun instead,
  // so distant trees still drop a tree-shaped shadow.
  build(group, { maxFull = 3, fullDist = 24 } = {}) {
    this.maxFull = maxFull; this.fullDist = fullDist;
    this.lod = [...this.fixed, ...this.dynamic];
    for (const t of [...this.lod, ...this.far]) {
      t.m = new THREE.Matrix4().compose(new THREE.Vector3(t.x, t.y, t.z), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), t.rot), new THREE.Vector3(t.scale, t.scale, t.scale));
    }
    this.full = new Map(); this.imp = new Map();
    this.sunFace = { value: new THREE.Vector3(1, 0, 0) };
    for (const [name, M] of this.models) {
      const cap = Math.max(1, Math.min(maxFull, this.lod.filter((t) => t.model === name).length));
      const meshes = M.parts.map((p) => {
        const b = new THREE.InstancedMesh(p.geometry, p.material, cap);
        b.castShadow = true; b.receiveShadow = true; b.name = `LS_tree_${name}`; b.count = 0;
        group.add(b);
        return b;
      });
      this.full.set(name, meshes);
      const impCount = [...this.lod, ...this.far].filter((t) => t.model === name).length;
      const imp = this._impostorMesh(M, Math.max(1, impCount));
      imp.name = `LS_tree_impostor_${name}`;
      group.add(imp);
      this.imp.set(name, imp);
    }
    this.update(this.ctx.game.camera, true);
  }

  _impostorMesh(M, count) {
    const { tex, w, h } = M.impostor;
    const geo = new THREE.PlaneGeometry(w, h).translate(0, h / 2, 0);
    const billboard = (faceExpr) => `
      vec3 lsC = (modelMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
      float lsS = length(instanceMatrix[0].xyz);
      vec3 lsTo = ${faceExpr}; lsTo.y = 0.0; lsTo = normalize(lsTo + vec3(1e-4, 0.0, 0.0));
      vec3 lsRight = normalize(cross(vec3(0.0, 1.0, 0.0), lsTo));
      vec3 lsW = lsC + lsRight * position.x * lsS + vec3(0.0, position.y * lsS, 0.0);`;
    const mat = new THREE.MeshStandardMaterial({ map: tex, alphaTest: 0.42, roughness: 0.9, metalness: 0, side: THREE.DoubleSide, transparent: false });
    mat.customProgramCacheKey = () => 'ls-impostor-2';
    mat.onBeforeCompile = (sh) => {
      sh.vertexShader = sh.vertexShader
        .replace('#include <beginnormal_vertex>', `${billboard('cameraPosition - lsC')}
          vec3 objectNormal = normalize(lsTo * 0.55 + vec3(0.0, 0.8, 0.0));`)
        .replace('#include <defaultnormal_vertex>', 'vec3 transformedNormal = normalize((viewMatrix * vec4(objectNormal, 0.0)).xyz);')
        .replace('#include <project_vertex>', 'vec4 mvPosition = viewMatrix * vec4(lsW, 1.0);\ngl_Position = projectionMatrix * mvPosition;')
        .replace('#include <worldpos_vertex>', 'vec4 worldPosition = vec4(lsW, 1.0);');
      // un-premultiply the mip-filtered colour (transparent texels are black)
      sh.fragmentShader = sh.fragmentShader.replace('#include <map_fragment>', `
        vec4 lsTex = texture2D(map, vMapUv);
        diffuseColor.rgb *= lsTex.rgb / max(lsTex.a, 0.05);
        diffuseColor.a *= smoothstep(0.0, 1.0, lsTex.a * 1.25);`);
    };
    // shadow pass: same billboard, turned to face the sun (uniform, set every frame)
    const depth = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, map: tex, alphaTest: 0.42, side: THREE.DoubleSide });
    depth.customProgramCacheKey = () => 'ls-impostor-depth-1';
    depth.onBeforeCompile = (sh) => {
      sh.uniforms.uSunFace = this.sunFace;
      sh.vertexShader = sh.vertexShader
        .replace('#include <common>', '#include <common>\nuniform vec3 uSunFace;')
        .replace('#include <begin_vertex>', `#include <begin_vertex>\n${billboard('uSunFace')}`)
        .replace('#include <project_vertex>', 'vec4 mvPosition = viewMatrix * vec4(lsW, 1.0);\ngl_Position = projectionMatrix * mvPosition;');
    };
    const im = new THREE.InstancedMesh(geo, mat, count);
    im.customDepthMaterial = depth;
    im.count = 0; im.castShadow = true; im.receiveShadow = false; im.frustumCulled = false;
    return im;
  }

  update(camera, force = false, sun = null) {
    if (sun) {
      this.sunFace.value.copy(sun.position).sub(sun.target.position);
      // low sun (golden hour): impostor trees 20-300 m away would shade the whole garden; only the
      // real near trees keep their (long) shadows so the lawn still catches the evening light
      const high = this.sunFace.value.y / (this.sunFace.value.length() || 1) > 0.3;
      for (const im of this.imp.values()) im.castShadow = high;
    }
    const cam = camera.position;
    if (!force && cam.distanceToSquared(this._lastCam) < 1.0) return;
    this._lastCam.copy(cam);
    const near = this.lod.map((t) => ({ t, d: Math.hypot(t.x - cam.x, t.z - cam.z) })).sort((a, b) => a.d - b.d);
    const fullSet = new Set();
    for (const { t, d } of near) {
      if (d > this.fullDist || fullSet.size >= this.maxFull) break;
      fullSet.add(t);
    }
    for (const [name, meshes] of this.full) {
      const list = this.lod.filter((t) => t.model === name && fullSet.has(t)).slice(0, meshes[0]?.instanceMatrix.count ?? 0);
      for (const im of meshes) { list.forEach((t, i) => im.setMatrixAt(i, t.m)); im.count = list.length; im.instanceMatrix.needsUpdate = true; im.computeBoundingSphere(); }
    }
    for (const [name, im] of this.imp) {
      const list = [...this.lod.filter((t) => t.model === name && !fullSet.has(t)), ...this.far.filter((t) => t.model === name)];
      list.forEach((t, i) => im.setMatrixAt(i, t.m));
      im.count = list.length;
      im.instanceMatrix.needsUpdate = true;
    }
  }
}


// Scatter helpers
export function scatterRing(site, cfg, avoid = []) {
  const R = rng(cfg.seed);
  const [px, pz, pw, pd] = site.plot;
  const out = [];
  let guard = 0;
  while (out.length < cfg.count && guard++ < cfg.count * 60) {
    const x = px - cfg.outer + R() * (pw + 2 * cfg.outer), z = pz - cfg.outer + R() * (pd + 2 * cfg.outer);
    const dx = Math.max(px - x, 0, x - (px + pw)), dz = Math.max(pz - z, 0, z - (pz + pd));
    const d = Math.hypot(dx, dz);
    if (d < cfg.inner || d > cfg.outer) continue;
    if (avoid.some(([ax, az, aw, ad]) => x > ax && x < ax + aw && z > az && z < az + ad)) continue;
    if (out.some((o) => Math.hypot(o.x - x, o.z - z) < 5.5)) continue;
    out.push({ x, z, r: R(), r2: R() });
  }
  return out;
}

export function scatterFar(site, cfg, heightFn, avoidX) {
  const R = rng(cfg.seed);
  const [px, pz, pw, pd] = site.plot;
  const cx = px + pw / 2, cz = pz + pd / 2;
  const out = [];
  let guard = 0;
  while (out.length < cfg.count && guard++ < cfg.count * 80) {
    const a = R() * Math.PI * 2, r = cfg.inner + Math.sqrt(R()) * (cfg.outer - cfg.inner);
    const x = cx + Math.cos(a) * r, z = cz + Math.sin(a) * r;
    if (avoidX && x > avoidX[0] && x < avoidX[1]) continue;
    // forests/tree lines: keep where a low-frequency noise is high (clumps), always some near
    const f = fbm(x / 70 + 4, z / 70 - 7, 3);
    if (f < 0.47 && R() > 0.12) continue;
    out.push({ x, z, y: heightFn(x, z) - 0.1, r: R(), r2: R() });
  }
  return out;
}
