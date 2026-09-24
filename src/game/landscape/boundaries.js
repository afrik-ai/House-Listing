import * as THREE from 'three';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { GeoBuilder, rng, alongPolyline, vnoise } from './util.js';
import { groundMaterial } from './materials.js';

// ---- foliage textures (generated once on a canvas) -------------------------------------------------
function leafCanvas(size, { opaque = false, seed = 3, count = 900, palette } = {}) {
  const R = rng(seed);
  const cv = document.createElement('canvas');
  cv.width = cv.height = size;
  const c = cv.getContext('2d');
  if (opaque) { c.fillStyle = '#16240d'; c.fillRect(0, 0, size, size); }
  const pal = palette || [[38, 64, 20], [52, 82, 26], [66, 98, 32], [30, 52, 16], [80, 110, 40], [58, 90, 34]];
  for (let i = 0; i < count; i++) {
    const x = R() * size, y = R() * size;
    const L = size * (0.025 + R() * 0.03), W = L * (0.45 + R() * 0.2);
    const a = R() * Math.PI * 2;
    const col = pal[Math.floor(R() * pal.length)];
    const k = 0.7 + R() * 0.5;
    const draw = (ox, oy) => {
      c.save(); c.translate(x + ox, y + oy); c.rotate(a);
      const g = c.createLinearGradient(-W, 0, W, 0);
      g.addColorStop(0, `rgb(${col[0] * k * 0.7 | 0},${col[1] * k * 0.7 | 0},${col[2] * k * 0.7 | 0})`);
      g.addColorStop(0.55, `rgb(${Math.min(255, col[0] * k * 1.15) | 0},${Math.min(255, col[1] * k * 1.15) | 0},${Math.min(255, col[2] * k * 1.1) | 0})`);
      g.addColorStop(1, `rgb(${col[0] * k * 0.85 | 0},${col[1] * k * 0.85 | 0},${col[2] * k * 0.85 | 0})`);
      c.fillStyle = g;
      c.beginPath(); c.ellipse(0, 0, W, L, 0, 0, Math.PI * 2); c.fill();
      c.strokeStyle = `rgba(20,30,10,0.35)`; c.lineWidth = Math.max(1, W * 0.12);
      c.beginPath(); c.moveTo(0, -L * 0.9); c.lineTo(0, L * 0.9); c.stroke();
      c.restore();
    };
    // wrap so the texture tiles
    for (const ox of [-size, 0, size]) for (const oy of [-size, 0, size]) {
      if (x + ox + L < 0 || x + ox - L > size || y + oy + L < 0 || y + oy - L > size) continue;
      draw(ox, oy);
    }
  }
  if (!opaque) {
    // soften: fade leaves toward the card border so cards never show a square edge
    const id = c.getImageData(0, 0, size, size);
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
      const dx = x / size - 0.5, dy = y / size - 0.5;
      const r = Math.hypot(dx, dy) * 2;
      const i = (y * size + x) * 4 + 3;
      id.data[i] = id.data[i] * Math.max(0, Math.min(1, (1 - r) * 2.2));
    }
    c.putImageData(id, 0, 0);
  }
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 8;
  return t;
}

// ---- hedges & topiary balls: leafy solid + instanced leaf cards breaking the silhouette ----------
export function buildHedges(ctx, shapes) {
  const { group, site } = ctx;
  const G = site.grade_y;
  const surfTex = leafCanvas(512, { opaque: true, seed: 5, count: 2600 });
  const cardTex = leafCanvas(256, { seed: 9, count: 170 });
  const bodyMat = new THREE.MeshStandardMaterial({ map: surfTex, roughness: 0.85, metalness: 0, color: new THREE.Color(0.95, 1.0, 0.92) });
  const cardMat = new THREE.MeshStandardMaterial({ map: cardTex, alphaTest: 0.5, roughness: 0.8, metalness: 0, side: THREE.DoubleSide });
  cardMat.customProgramCacheKey = () => 'ls-card-1';
  cardMat.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nattribute vec3 aFaceN;')
      .replace('#include <beginnormal_vertex>', 'vec3 objectNormal = transpose(mat3(instanceMatrix)) * aFaceN;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <normal_fragment_begin>', '#include <normal_fragment_begin>\nnormal *= faceDirection;');
  };

  const body = new GeoBuilder();
  const cards = [];   // {pos, n, size}
  const R = rng(17);
  const S = 0.65;     // texture metres
  for (const s of shapes) {
    const dens = 30 * (s.cards ?? 1);
    if (s.rect) {
      const [x, z, w, d] = s.rect;
      const h = s.height, y0 = G - 0.05, y1 = G + h;
      // slightly battered sides are typical for clipped hedges; a straight box reads fine at this scale
      body.box(x, y0, z, x + w, y1, z + d, S, { skip: ['-y'], uvOffset: [R() * 3, R() * 3] });
      const faces = [
        { n: [0, 1, 0], area: w * d, pt: () => [x + R() * w, y1, z + R() * d] },
        { n: [1, 0, 0], area: d * h, pt: () => [x + w, y0 + 0.1 + R() * (h - 0.1), z + R() * d] },
        { n: [-1, 0, 0], area: d * h, pt: () => [x, y0 + 0.1 + R() * (h - 0.1), z + R() * d] },
        { n: [0, 0, 1], area: w * h, pt: () => [x + R() * w, y0 + 0.1 + R() * (h - 0.1), z + d] },
        { n: [0, 0, -1], area: w * h, pt: () => [x + R() * w, y0 + 0.1 + R() * (h - 0.1), z] },
      ];
      for (const f of faces) {
        const n = Math.round(f.area * dens);
        for (let i = 0; i < n; i++) cards.push({ p: f.pt(), n: f.n, size: 0.2 + R() * 0.14, out: 0.01 + R() * 0.05 });
      }
      // edges: extra cards to round the corners
      for (let i = 0; i < w * 8 + d * 8; i++) {
        const onX = R() < w / (w + d);
        const p = onX ? [x + R() * w, y1, R() < 0.5 ? z : z + d] : [R() < 0.5 ? x : x + w, y1, z + R() * d];
        const nn = onX ? [0, 0.7, p[2] === z ? -0.7 : 0.7] : [p[0] === x ? -0.7 : 0.7, 0.7, 0];
        cards.push({ p, n: nn, size: 0.22 + R() * 0.12, out: 0.0 });
      }
      ctx.colliderBoxes.push([x, G - 0.3, z, x + w, G + Math.max(h, 1.3), z + d]);
    } else if (s.ball) {
      const [cx, cz, r] = s.ball;
      const sq = s.squash ?? 1;
      const cy = G + r * 0.85 * sq;
      const sg = new THREE.SphereGeometry(r, 12, 8);
      sg.scale(1, sq, 1);
      sg.translate(cx, cy, cz);
      const pa = sg.attributes.position, na = sg.attributes.normal, ua = sg.attributes.uv;
      const idx = sg.index.array;
      for (let i = 0; i < idx.length; i += 3) {
        const v = [idx[i], idx[i + 1], idx[i + 2]];
        for (const k of v) {
          body.p.push(pa.getX(k), pa.getY(k), pa.getZ(k));
          body.n.push(na.getX(k), na.getY(k), na.getZ(k));
          body.uv.push(ua.getX(k) * 2 * Math.PI * r / 0.5, ua.getY(k) * Math.PI * r / 0.5);
        }
      }
      const n = Math.round(4 * Math.PI * r * r * dens * 1.2);
      for (let i = 0; i < n; i++) {
        const u = R() * 2 - 1, a = R() * Math.PI * 2;
        const q = Math.sqrt(1 - u * u);
        const nn = [q * Math.cos(a), Math.abs(u) * (u > -0.3 ? 1 : -1), q * Math.sin(a)];
        const L = Math.hypot(...nn);
        const nrm = nn.map((v) => v / L);
        if (cy + nrm[1] * r * sq < G + 0.02) continue;
        cards.push({ p: [cx + nrm[0] * r, cy + nrm[1] * r * sq, cz + nrm[2] * r], n: nrm, size: 0.13 + R() * 0.08, out: R() * 0.025 });
      }
    }
  }
  const bodyMesh = new THREE.Mesh(body.build(), bodyMat);
  bodyMesh.name = 'LS_hedge_body'; bodyMesh.castShadow = true; bodyMesh.receiveShadow = true;
  group.add(bodyMesh);

  const cg = new THREE.PlaneGeometry(1, 1);
  const im = new THREE.InstancedMesh(cg, cardMat, cards.length);
  const faceN = new Float32Array(cards.length * 3);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), v = new THREE.Vector3();
  cards.forEach((c, i) => {
    const n = new THREE.Vector3(...c.n).normalize();
    // card faces roughly outward, tilted up to ~65 deg, random spin
    const base = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), n);
    e.set((R() - 0.5) * 2.2, (R() - 0.5) * 2.2, R() * Math.PI * 2);
    q.copy(base).multiply(new THREE.Quaternion().setFromEuler(e));
    v.set(...c.p).addScaledVector(n, c.out);
    m.compose(v, q, new THREE.Vector3(c.size, c.size, c.size));
    im.setMatrixAt(i, m);
    faceN.set([n.x, n.y, n.z], i * 3);
  });
  cg.setAttribute('aFaceN', new THREE.InstancedBufferAttribute(faceN, 3));
  im.instanceMatrix.needsUpdate = true;
  im.computeBoundingSphere();
  im.castShadow = false; im.receiveShadow = true;
  im.name = 'LS_hedge_cards';
  group.add(im);
  return { bodyMesh, cards: im };
}

// ---- pale horizontal-slat boundary fence ------------------------------------------------------------
export async function buildFences(ctx) {
  const { site, group, textures } = ctx;
  const G = site.grade_y;
  const mat = await groundMaterial(textures, { tex: 'larch_boards', scale: 1.2, tint: [1.55, 1.52, 1.45], desat: 0.82, macro: 0.12, roughness: 0.8 });
  for (const k of ['map', 'normalMap', 'roughnessMap']) {   // grain along the boards
    mat[k] = mat[k].clone(); mat[k].rotation = Math.PI / 2; mat[k].center.set(0.5, 0.5); mat[k].needsUpdate = true;
  }
  const postMat = new THREE.MeshStandardMaterial({ color: 0x9a9892, roughness: 0.5, metalness: 0.4 });
  const boards = new GeoBuilder(), posts = new GeoBuilder();
  const R = rng(29);
  for (const f of site.fences || []) {
    for (let i = 0; i < f.points.length - 1; i++) {
      const [ax, az] = f.points[i], [bx, bz] = f.points[i + 1];
      const L = Math.hypot(bx - ax, bz - az);
      const n = Math.max(1, Math.round(L / 1.9));
      const ang = Math.atan2(bx - ax, bz - az);
      const nb = Math.max(3, Math.round((f.height - 0.08) / 0.19));
      const bh = 0.145, gap = (f.height - 0.08 - nb * bh) / Math.max(1, nb - 1);
      for (let k = 0; k < n; k++) {
        const t0 = k / n, t1 = (k + 1) / n;
        const cx = ax + (bx - ax) * (t0 + t1) / 2, cz = az + (bz - az) * (t0 + t1) / 2;
        const len = L / n - 0.075;
        for (let j = 0; j < nb; j++) {
          const y0 = G + 0.06 + j * (bh + gap);
          boards.rotBox(cx, cz, 0.022, len, y0, y0 + bh, ang, 1.2, [R() * 4, R() * 4]);
        }
        const px = ax + (bx - ax) * t0, pz = az + (bz - az) * t0;
        posts.rotBox(px, pz, 0.07, 0.07, G - 0.1, G + f.height + 0.02, ang, 1);
      }
      posts.rotBox(bx, bz, 0.07, 0.07, G - 0.1, G + f.height + 0.02, ang, 1);
      // collider along the segment
      const minX = Math.min(ax, bx) - 0.06, maxX = Math.max(ax, bx) + 0.06, minZ = Math.min(az, bz) - 0.06, maxZ = Math.max(az, bz) + 0.06;
      ctx.colliderBoxes.push([minX, G - 0.3, minZ, maxX, G + 2.0, maxZ]);
    }
  }
  const bm = new THREE.Mesh(boards.build(), mat); bm.name = 'LS_fence_boards'; bm.castShadow = true; bm.receiveShadow = true;
  const pm = new THREE.Mesh(posts.build(), postMat); pm.name = 'LS_fence_posts'; pm.castShadow = true; pm.receiveShadow = true;
  group.add(bm, pm);
}

// ---- gabion walls: galvanised wire cage + packed stones ---------------------------------------------
// Split limestone: a jittered icosahedron (12 verts, 20 facets), flat shaded -> angular quarried look.
function stoneGeometry(seed) {
  let g = new THREE.BoxGeometry(1.7, 1.1, 1.4);
  g.deleteAttribute('uv'); g.deleteAttribute('normal');
  g = mergeVertices(g);
  const p = g.attributes.position;
  const R = rng(seed * 7 + 3);
  for (let i = 0; i < p.count; i++) {
    p.setXYZ(i, p.getX(i) * (0.86 + R() * 0.2) + (R() - 0.5) * 0.12, p.getY(i) * (0.85 + R() * 0.2), p.getZ(i) * (0.86 + R() * 0.2) + (R() - 0.5) * 0.12);
  }
  g = g.toNonIndexed();
  g.computeVertexNormals();
  const q = g.attributes.position;
  const uv = new Float32Array(q.count * 2);
  for (let i = 0; i < q.count; i++) { uv[i * 2] = (q.getX(i) + q.getZ(i) * 0.7) * 1.6; uv[i * 2 + 1] = (q.getY(i) + q.getZ(i) * 0.4) * 1.6; }
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  return g;
}

export async function buildGabions(ctx) {
  const { site, group, game } = ctx;
  const G = site.grade_y;
  if (!site.gabions?.length) return;
  // procedural rock set (scripts/assets/gen_textures.mjs: rock_limestone); per-instance tone variants below
  const rock = await ctx.textures.set('rock_limestone').catch(() => null);
  const stoneMat = new THREE.MeshStandardMaterial({
    map: rock?.map || null, normalMap: rock?.normalMap || null, roughnessMap: rock?.roughnessMap || null, aoMap: rock?.aoMap || null,
    normalScale: new THREE.Vector2(1.2, 1.2), roughness: 1, metalness: 0, color: 0xffffff,
  });
  const geos = [stoneGeometry(1), stoneGeometry(2), stoneGeometry(3), stoneGeometry(4)];
  const lists = [[], [], [], []];
  const R = rng(41);
  const wire = new GeoBuilder();
  const cols = [];
  for (const gb of site.gabions) {
    const [x, z, w, d] = gb.rect;
    const y0 = G - 0.02, y1 = G + gb.height;
    const sp = 0.155;
    // stones on the five visible faces (inset so the cage sits just outside)
    const facePts = [];
    for (let a = x + sp / 2; a < x + w; a += sp) for (let yy = y0 + sp / 2; yy < y1; yy += sp * 0.8) { facePts.push([a, yy, z + 0.07, 0, 0, -1]); facePts.push([a, yy, z + d - 0.07, 0, 0, 1]); }
    for (let b = z + sp / 2; b < z + d; b += sp) for (let yy = y0 + sp / 2; yy < y1; yy += sp * 0.8) { facePts.push([x + 0.07, yy, b, -1, 0, 0]); facePts.push([x + w - 0.07, yy, b, 1, 0, 0]); }
    for (let a = x + sp / 2; a < x + w; a += sp) for (let b = z + sp / 2; b < z + d; b += sp) facePts.push([a, y1 - 0.07, b, 0, 1, 0]);
    for (const [px, py, pz] of facePts) {
      const jx = (R() - 0.5) * 0.05, jy = (R() - 0.5) * 0.04, jz = (R() - 0.5) * 0.05;
      const s = 0.056 + R() * 0.03;
      const m = new THREE.Matrix4().compose(
        new THREE.Vector3(Math.min(x + w - 0.06, Math.max(x + 0.06, px + jx)), Math.min(y1 - 0.06, py + jy), Math.min(z + d - 0.06, Math.max(z + 0.06, pz + jz))),
        new THREE.Quaternion().setFromEuler(new THREE.Euler((R() - 0.5) * 0.7, R() * 6.28, (R() - 0.5) * 0.7)),
        new THREE.Vector3(s * (1.1 + R() * 0.5), s * (0.75 + R() * 0.3), s * (0.95 + R() * 0.4)));
      const k = Math.floor(R() * 4);
      const tone = [0.78, 0.92, 1.05, 1.18][Math.floor(R() * 4)]; // 4 tone variants
      lists[k].push({ m, c: tone * (0.94 + R() * 0.12), warm: R() * 2 - 0.6 });
    }
    // cage: 5 mm wires on a 100 x 100 mm grid, heavier frame edges
    const t = 0.005, eO = 0.004;
    const X0 = x - eO, X1 = x + w + eO, Z0 = z - eO, Z1 = z + d + eO;
    for (let a = X0; a <= X1 + 1e-6; a += 0.1) { wire.box(a - t / 2, y0, Z0 - t, a + t / 2, y1, Z0); wire.box(a - t / 2, y0, Z1, a + t / 2, y1, Z1 + t); wire.box(a - t / 2, y1, Z0, a + t / 2, y1 + t, Z1); }
    for (let b = Z0; b <= Z1 + 1e-6; b += 0.1) { wire.box(X0 - t, y0, b - t / 2, X0, y1, b + t / 2); wire.box(X1, y0, b - t / 2, X1 + t, y1, b + t / 2); wire.box(X0, y1, b - t / 2, X1, y1 + t, b + t / 2); }
    for (let yy = y0 + 0.1; yy <= y1 + 1e-6; yy += 0.1) {
      wire.box(X0, yy - t / 2, Z0 - t, X1, yy + t / 2, Z0); wire.box(X0, yy - t / 2, Z1, X1, yy + t / 2, Z1 + t);
      wire.box(X0 - t, yy - t / 2, Z0, X0, yy + t / 2, Z1); wire.box(X1, yy - t / 2, Z0, X1 + t, yy + t / 2, Z1);
    }
    cols.push([x - 0.02, G - 0.3, z - 0.02, x + w + 0.02, y1, z + d + 0.02]);
  }
  ctx.colliderBoxes.push(...cols);
  lists.forEach((list, k) => {
    if (!list.length) return;
    const im = new THREE.InstancedMesh(geos[k], stoneMat, list.length);
    const col = new THREE.Color();
    list.forEach((s, i) => { im.setMatrixAt(i, s.m); im.setColorAt(i, col.setRGB(s.c * (1 + s.warm * 0.06), s.c, s.c * (1 - s.warm * 0.07))); });
    im.instanceMatrix.needsUpdate = true;
    im.computeBoundingSphere();
    im.castShadow = false; im.receiveShadow = true;
    im.name = `LS_gabion_stones_${k}`;
    group.add(im);
  });
  const wm = new THREE.Mesh(wire.build(), new THREE.MeshStandardMaterial({ color: 0x8d9296, roughness: 0.38, metalness: 0.85 }));
  wm.name = 'LS_gabion_cage'; wm.castShadow = false; wm.receiveShadow = true;
  group.add(wm);
  // shadow proxy: the walls' solid volume casts the sun shadow (stones/wires would cost thousands of
  // tiny shadow-map triangles); invisible in the colour pass
  const sp = new GeoBuilder();
  for (const c of cols) sp.box(c[0] + 0.03, c[1] + 0.25, c[2] + 0.03, c[3] - 0.03, c[4] - 0.03, c[5] - 0.03);
  const proxy = new THREE.Mesh(sp.build(), new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false }));
  proxy.name = 'LS_gabion_shadow'; proxy.castShadow = true; proxy.receiveShadow = false;
  group.add(proxy);
}
