# P04 vegetation kit for procedural props (trees, shrubs, grasses, flowers, potted plants, rocks).
#  - Leaf / blade / flower atlases are PAINTED procedurally (numpy) into RGBA textures (alpha-masked clusters,
#    per-leaf hue/value jitter, midrib + veins, inner-cluster shading, colour bleed into transparent texels so
#    mip-maps do not get dark fringes).
#  - Branch skeletons grow recursively (tapered tubes with bark UVs, root flare) and end in leaf CARDS
#    (bent 3x3-vertex quads) whose normals are blended towards the crown's ellipsoid normal, which is what
#    makes card foliage light as a soft volume instead of a pile of planes.
# Blender Z-up while building (helpers.finish exports Y-up).
import math, numpy as np, bpy
import helpers as H
from helpers import V, PI

# ------------------------------------------------------------------------------------------ painting
def _hsv_jit(rgb, rng, dh=0.03, ds=0.12, dv=0.18):
    import colorsys
    h, s, v = colorsys.rgb_to_hsv(*rgb)
    h = (h + rng.uniform(-dh, dh)) % 1.0
    s = min(1, max(0, s * (1 + rng.uniform(-ds, ds))))
    v = min(1, max(0, v * (1 + rng.uniform(-dv, dv))))
    return np.array(colorsys.hsv_to_rgb(h, s, v), np.float32)

def _hex(h):
    return np.array(H.hexc(h, False), np.float32)

def _line(img, a, b, w0, w1, col, S):
    """Thick tapered line (twig / stem) a->b in pixel coords."""
    a = np.array(a, np.float32); b = np.array(b, np.float32)
    mn = np.floor(np.minimum(a, b) - max(w0, w1) - 2).astype(int); mx = np.ceil(np.maximum(a, b) + max(w0, w1) + 2).astype(int)
    mn = np.clip(mn, 0, S - 1); mx = np.clip(mx, 0, S - 1)
    if mx[0] <= mn[0] or mx[1] <= mn[1]: return
    yy, xx = np.mgrid[mn[1]:mx[1] + 1, mn[0]:mx[0] + 1].astype(np.float32)
    d = b - a; L2 = max(float(d @ d), 1e-6)
    t = np.clip(((xx - a[0]) * d[0] + (yy - a[1]) * d[1]) / L2, 0, 1)
    px = a[0] + t * d[0]; py = a[1] + t * d[1]
    dist = np.hypot(xx - px, yy - py)
    w = w0 + (w1 - w0) * t
    m = dist <= w
    sub = img[mn[1]:mx[1] + 1, mn[0]:mx[0] + 1]
    sh = (1 - 0.35 * (dist / np.maximum(w, 1e-3)))[..., None]
    c = np.concatenate([np.broadcast_to(col, sub.shape[:2] + (3,)) * sh, np.ones(sub.shape[:2] + (1,), np.float32)], -1)
    sub[m] = c[m]

def _leaf(img, base, ang, L, aspect, col, S, rng, shape='ovate', shade=1.0, vein=0.10, tipcol=None, serr=0.0):
    """One leaf: base point (px), direction ang (rad), length L (px). Writes RGBA in place."""
    d = np.array([math.cos(ang), math.sin(ang)], np.float32); n = np.array([-d[1], d[0]], np.float32)
    base = np.array(base, np.float32)
    W = L * aspect * 0.5
    corners = [base, base + d * L, base + n * W - n * 0 + d * L * 0.5, base - n * W + d * L * 0.5]
    mn = np.floor(np.min(corners, 0) - W - 2).astype(int); mx = np.ceil(np.max(corners, 0) + W + 2).astype(int)
    mn = np.clip(mn, 0, S - 1); mx = np.clip(mx, 0, S - 1)
    if mx[0] <= mn[0] or mx[1] <= mn[1]: return
    yy, xx = np.mgrid[mn[1]:mx[1] + 1, mn[0]:mx[0] + 1].astype(np.float32)
    rx, ry = xx - base[0], yy - base[1]
    u = (rx * d[0] + ry * d[1]) / L
    v = (rx * n[0] + ry * n[1]) / L
    uc = np.clip(u, 0, 1)
    bend = 0.06 * aspect * np.sin(PI * uc) * rng.uniform(-1, 1)   # leaf curls a little sideways
    v = v - bend
    if shape == 'ovate':        # widest ~40 %, pointed tip
        wu = (np.power(uc, 0.55) * np.power(1 - uc, 0.9)) * 1.9
    elif shape == 'lance':      # narrow, long taper (olive, willow, grass-like)
        wu = (np.power(uc, 0.45) * np.power(1 - uc, 1.1)) * 2.0
    elif shape == 'round':      # birch / round leaves
        wu = (np.power(uc, 0.5) * np.power(1 - uc, 0.6)) * 1.75
    elif shape == 'heart':      # clover leaflet: widest at the tip, notch
        wu = np.power(uc, 0.8) * 1.15 * (1 - 0.55 * np.exp(-((1 - uc) / 0.12) ** 2) * (np.abs(v) < 0.08 * aspect))
    elif shape == 'blade':      # grass blade
        wu = np.power(1 - uc, 0.7) * 0.9 + 0.1 * (1 - uc)
    else:
        wu = np.sin(PI * uc)
    half = aspect * 0.5 * wu
    if serr > 0:
        half = half * (1 - serr * (0.5 + 0.5 * np.sin(uc * 70)))
    inside = (u >= 0) & (u <= 1) & (np.abs(v) <= half)
    if not inside.any(): return
    t = np.abs(v) / np.maximum(half, 1e-4)                  # 0 midrib -> 1 edge
    c = np.broadcast_to(col, u.shape + (3,)).copy()
    if tipcol is not None:
        c = c * (1 - uc[..., None] ** 2 * 0.6) + tipcol * (uc[..., None] ** 2 * 0.6)
    lum = shade * (0.88 + 0.18 * np.sign(v) * np.power(t, 0.7) * rng.choice([-1, 1]))   # fake curvature: one half catches light
    lum = lum * (1 - 0.18 * np.power(t, 6))                   # darker rim
    rib = np.exp(-(np.abs(v) / (0.012 + 0.01 * aspect)) ** 2) * (1 - uc) * 0.9
    veins = np.clip(1 - np.abs(((uc - np.abs(v) * 1.6) * 7.0) % 1.0 - 0.5) * 12, 0, 1) * (t > 0.08) * (t < 0.9)
    lum = lum * (1 + vein * veins)
    c = c * lum[..., None]
    pale = np.array([0.75, 0.8, 0.55], np.float32)
    c = c * (1 - rib[..., None] * 0.35) + pale * c.mean(-1, keepdims=True) * 1.6 * rib[..., None] * 0.35
    c = c * (1 + 0.05 * rng.standard_normal(u.shape).astype(np.float32)[..., None])
    sub = img[mn[1]:mx[1] + 1, mn[0]:mx[0] + 1]
    rgba = np.concatenate([np.clip(c, 0, 1), np.ones(u.shape + (1,), np.float32)], -1)
    sub[inside] = rgba[inside]

def bleed(img, it=6):
    """Fill transparent texels with the blurred colour of nearby opaque ones (mip-safe cutouts)."""
    a = img[..., 3:4]
    col = img[..., :3] * a
    acc = col.copy(); w = a.copy()
    def blur(x, s):
        F = np.fft.rfft2(x, axes=(0, 1))
        fy = np.fft.fftfreq(x.shape[0])[:, None, None]; fx = np.fft.rfftfreq(x.shape[1])[None, :, None]
        g = np.exp(-2 * PI ** 2 * ((fx * s) ** 2 + (fy * s) ** 2))
        return np.fft.irfft2(F * g, s=x.shape[:2], axes=(0, 1))
    num = blur(col, 6) + blur(col, 24) * 0.3; den = blur(a, 6) + blur(a, 24) * 0.3
    fill = num / np.maximum(den, 1e-4)
    avg = (col.sum((0, 1)) / max(a.sum(), 1))
    fill = np.where(den > 1e-3, fill, avg)
    img[..., :3] = np.where(a > 0.5, img[..., :3], np.clip(fill, 0, 1))
    return img

def paint_cluster_cell(S, rng, sp):
    """One S x S atlas cell: a twig carrying a spray of leaves. sp = species dict."""
    img = np.zeros((S, S, 4), np.float32)
    twig = _hex(sp.get('twig', '#5a4632'))
    base_col = _hex(sp['leaf'])
    tip = _hex(sp['tip']) if sp.get('tip') else None
    # twig: from bottom centre, curving up, with forks (spray fills the cell like a real leaf cluster)
    segs = 6
    Ltw = S * sp.get('twig_len', 0.78)
    def chain(x0, y0, ang, L, segs):
        pts = [(x0, y0)]
        for i in range(segs):
            ang += rng.uniform(-0.15, 0.15)
            x, y = pts[-1]
            pts.append((x + math.cos(ang) * L / segs, y + math.sin(ang) * L / segs))
        return pts
    chains = [chain(S * (0.5 + rng.uniform(-0.05, 0.05)), 2, PI / 2 + rng.uniform(-0.15, 0.15), Ltw, segs)]
    for k in range(sp.get('forks', 0)):
        src = chains[0]; t = rng.uniform(0.2, 0.55); i0 = int(t * segs)
        side = 1 if k % 2 == 0 else -1
        a = PI / 2 + side * rng.uniform(0.45, 0.8)
        chains.append(chain(src[i0][0], src[i0][1], a, Ltw * rng.uniform(0.45, 0.62) * (1 - t * 0.3), 4))
    pts = chains[0]
    nl = sp.get('n', 26)
    leaves = []
    tot = sum(len(c) - 1 for c in chains)
    for ci, ch in enumerate(chains):
        cs = len(ch) - 1
        nlc = max(3, int(nl * cs / tot))
        for k in range(nlc):
            t = (k + rng.uniform(0, 1)) / nlc
            t = 0.12 + 0.88 * t
            fi = t * cs; i0 = min(int(fi), cs - 1); f = fi - i0
            bx = ch[i0][0] + (ch[i0 + 1][0] - ch[i0][0]) * f; by = ch[i0][1] + (ch[i0 + 1][1] - ch[i0][1]) * f
            tdir = math.atan2(ch[i0 + 1][1] - ch[i0][1], ch[i0 + 1][0] - ch[i0][0])
            side = 1 if k % 2 == 0 else -1
            spread = sp.get('spread', 0.9) * (1.1 - 0.5 * t)
            a = tdir + side * spread * rng.uniform(0.6, 1.2)
            if k == nlc - 1: a = tdir + rng.uniform(-0.15, 0.15)
            L = S * sp['len'] * rng.uniform(0.7, 1.1) * (0.8 + 0.3 * (1 - abs(t - 0.6))) * (1 if ci == 0 else 0.9)
            pl = L * sp.get('petiole', 0.12)
            px, py = bx + math.cos(a) * pl, by + math.sin(a) * pl
            leaves.append((t * (1 if ci == 0 else 0.9), (bx, by), (px, py), a, L))
    # leaves near the base first (behind), tip leaves on top
    for ci, ch in enumerate(chains):
        cs = len(ch) - 1; w0 = S * (0.010 if ci == 0 else 0.006)
        for x in range(cs):
            _line(img, ch[x], ch[x + 1], max(1.2, w0 * (1 - x / cs) + 1), max(1.0, w0 * (1 - (x + 1) / cs) + 0.8), twig, S)
    rng.shuffle(leaves)
    leaves.sort(key=lambda l: l[0] + rng.uniform(0, 0.35))
    for t, b, p, a, L in leaves:
        _line(img, b, p, 1.2, 1.0, twig * 1.2, S)
        col = _hsv_jit(base_col, rng, *sp.get('jit', (0.025, 0.12, 0.16)))
        shade = (0.62 + 0.45 * t) * rng.uniform(0.85, 1.12)   # inner leaves in the cluster's own shade
        _leaf(img, p, a, L, sp['aspect'], col, S, rng, sp.get('shape', 'ovate'), shade, sp.get('vein', 0.1), tip, sp.get('serr', 0))
    return img

def paint_tuft_cell(S, rng, sp):
    """Grass tuft: blades from the bottom centre fanning up."""
    img = np.zeros((S, S, 4), np.float32)
    base_col = _hex(sp['leaf']); tip = _hex(sp['tip'])
    nb = sp.get('n', 40)
    bl = []
    for k in range(nb):
        x0 = S * (0.5 + rng.normal(0, 0.09))
        a = PI / 2 + rng.normal(0, sp.get('fan', 0.35))
        L = S * rng.uniform(0.55, 0.97) * sp.get('len', 1.0)
        bl.append((rng.uniform(), x0, a, L))
    bl.sort()
    for _, x0, a, L in bl:
        # curved blade = chain of short leaf segments (so it can bend)
        segs = 5; x, y = x0, 1.0; w = S * sp.get('w', 0.016) * rng.uniform(0.7, 1.3)
        col = _hsv_jit(base_col, rng, 0.03, 0.15, 0.2)
        curl = rng.uniform(-0.25, 0.25) + (0.2 if a < PI / 2 else -0.2) * sp.get('arch', 1.0)
        for s in range(segs):
            t0, t1 = s / segs, (s + 1) / segs
            a2 = a - curl * t1 * 1.5 * (1 if a < PI / 2 else 1)
            L2 = L / segs
            x2, y2 = x + math.cos(a2) * L2, y + math.sin(a2) * L2
            cc = col * (1 - t1) + tip * t1 * (0.7 + 0.3 * rng.uniform())
            sh = 0.55 + 0.5 * t1
            _line(img, (x, y), (x2, y2), w * (1 - t0 * 0.85), w * (1 - t1 * 0.85) + 0.4, cc * sh, S)
            x, y = x2, y2
    return img

def paint_flower_cell(S, rng, sp):
    img = paint_cluster_cell(S, rng, sp)
    petal = _hex(sp['petal']); centre = _hex(sp['centre'])
    for hd in range(sp.get('heads', 0)):      # mophead: many 4-petal florets packed in a dome
        hx, hy = S * rng.uniform(0.3, 0.7), S * rng.uniform(0.45, 0.75)
        HR = S * sp.get('head_r', 0.2) * rng.uniform(0.85, 1.1)
        hc = _hsv_jit(petal, rng, 0.03, 0.1, 0.08)
        for f in range(int(sp.get('florets', 60))):
            rr = HR * math.sqrt(rng.uniform()); a0 = rng.uniform(0, 2 * PI)
            cx, cy = hx + math.cos(a0) * rr, hy + math.sin(a0) * rr
            R = S * sp.get('fr', 0.04) * rng.uniform(0.8, 1.2)
            sh = 1.05 - 0.45 * (rr / HR) ** 2          # dome shading
            rot = rng.uniform(0, PI)
            for p in range(4):
                _leaf(img, (cx, cy), rot + p * PI / 2, R, 0.95, hc * sh, S, rng, 'round', 1.0, 0.05)
    for k in range(sp.get('flowers', 5)):
        cx, cy = S * rng.uniform(0.2, 0.8), S * rng.uniform(0.35, 0.9)
        R = S * sp.get('fr', 0.09) * rng.uniform(0.8, 1.15)
        np_ = sp.get('petals', 12)
        pc = _hsv_jit(petal, rng, 0.02, 0.1, 0.1)
        for p in range(np_):
            a = 2 * PI * p / np_ + rng.uniform(-0.1, 0.1)
            _leaf(img, (cx, cy), a, R, sp.get('petal_aspect', 0.38), pc, S, rng, 'ovate', 1.0, 0.25,
                  _hex(sp['petal_base']) if sp.get('petal_base') else None)
        yy, xx = np.mgrid[0:S, 0:S].astype(np.float32)
        m = (xx - cx) ** 2 + (yy - cy) ** 2 < (R * 0.28) ** 2
        img[m, :3] = centre * (0.8 + 0.2 * rng.uniform()); img[m, 3] = 1
    return img

def atlas(name, sp, grid=2, S=512, kind='cluster', seed=1):
    """Paint a grid x grid atlas -> (bpy image, grid)."""
    rng = np.random.default_rng(seed)
    N = S * grid
    img = np.zeros((N, N, 4), np.float32)
    fn = {'cluster': paint_cluster_cell, 'tuft': paint_tuft_cell, 'flower': paint_flower_cell}[kind]
    for gy in range(grid):
        for gx in range(grid):
            cell = fn(S, rng, sp)
            img[gy * S:(gy + 1) * S, gx * S:(gx + 1) * S] = cell
    img = bleed(img)
    return H.save_img(img, name), grid

def leaf_mat(name, img, rough=0.62, spec=0.35):
    m = H.pbr(name, '#ffffff', rough, base_tex=img, alpha_tex=True, cull=False, spec=spec)
    return m

# ------------------------------------------------------------------------------------------ bark
def bark_mat(name, kind='rough', seed=3, N=512):
    y, x = np.mgrid[0:N, 0:N].astype(np.float32) / N
    if kind == 'birch':
        base = H.fnoise(N, 60, 6, seed) * 0.5 + H.fnoise(N, 12, 3, seed + 1) * 0.3
        col = H.ramp(0.55 + base * 0.12, [(0, '#b9b4a8'), (0.5, '#e2ded4'), (1, '#f1eee6')])
        marks = H.fnoise(N, 5, 70, seed + 2)          # horizontal lenticels / black patches
        blot = np.clip((H.fnoise(N, 40, 22, seed + 3) - 1.1) * 2.5, 0, 1)
        dark = np.clip((marks - 1.5) * 2.0, 0, 1) * 0.8 + blot * 0.9
        col = col * (1 - np.clip(dark, 0, 0.92)[..., None]) + np.array([0.08, 0.07, 0.06]) * np.clip(dark, 0, 0.92)[..., None]
        h = -dark * 1.5 + base * 0.3
        rough = 0.75
    elif kind == 'olive':
        f = H.fnoise(N, 3, 40, seed) * 0.8 + H.fnoise(N, 10, 90, seed + 1) * 0.6 + H.fnoise(N, 30, 30, seed + 2) * 0.4
        cr = np.clip(np.abs(H.fnoise(N, 6, 60, seed + 3)) < 0.18, 0, 1) * 1.0
        t = np.clip(0.5 + f * 0.18 - cr * 0.3, 0, 1)
        col = H.ramp(t, [(0, '#2e2a24'), (0.35, '#5b5549'), (0.7, '#857d6d'), (1, '#a39a88')])
        h = f * 1.0 - cr * 1.8
        rough = 0.9
    else:  # ridged deciduous bark: vertical furrows, plates
        f = np.abs(H.fnoise(N, 5, 70, seed)) * 1.0 + np.abs(H.fnoise(N, 12, 110, seed + 1)) * 0.5
        plates = H.fnoise(N, 25, 25, seed + 2) * 0.3
        ridge = np.clip(1.4 - f, 0, None) + plates
        t = np.clip(0.25 + ridge * 0.35, 0, 1)
        col = H.ramp(t, [(0, '#241d17'), (0.45, '#4d4237'), (0.8, '#71685b'), (1, '#8d857a')])
        lich = np.clip((H.fnoise(N, 30, 30, seed + 5) - 1.2) * 1.5, 0, 1) * np.clip(ridge, 0, 1)
        col = col * (1 - lich[..., None] * 0.5) + np.array([0.45, 0.5, 0.35]) * lich[..., None] * 0.5
        h = ridge * 2.0
        rough = 0.92
    c = H.save_img(col.astype(np.float32), f'{name}_c')
    n = H.save_img(H.h2n(h.astype(np.float32), 2.5), f'{name}_n', True)
    return H.pbr(name, '#ffffff', rough, base_tex=c, normal_tex=n, nstr=1.0)

# ------------------------------------------------------------------------------------------ geometry
class Mesh:
    """Accumulates verts/faces/uvs (+ optional custom normals) for one material."""
    def __init__(s): s.v, s.f, s.uv, s.n = [], [], [], []
    def build(s, name, mat, smooth=True):
        if not s.f: return None
        ob = H.obj(name, s.v, s.f, mat, s.uv, smooth=smooth)
        if s.n and len(s.n) == len(s.v):
            me = ob.data
            try:
                me.normals_split_custom_set_from_vertices([tuple(x) for x in s.n])
            except Exception as e:
                print('WARN custom normals', e)
        return ob

def _perp(d):
    a = V((0, 0, 1)) if abs(d.z) < 0.9 else V((1, 0, 0))
    return d.cross(a).normalized()

def tube(M, pts, radii, sides, uv_tile=0.35, flare=0.0, lobes=0, seed=0):
    """Tapered tube along pts (Vectors) into Mesh M. Parallel-transport frames, bark UVs, open ends."""
    fr = H.frames(pts)
    base = len(M.v)
    L = 0.0
    circ = max(1, round(2 * PI * radii[0] / uv_tile))
    for i, (p, (T, N, B)) in enumerate(zip(pts, fr)):
        if i: L += (pts[i] - pts[i - 1]).length
        r = radii[i]
        for j in range(sides + 1):
            a = 2 * PI * j / sides
            rr = r
            if flare > 0:
                zf = max(0.0, 1 - L / flare)
                rr = r * (1 + 0.9 * zf ** 2.5 + (0.22 * zf * math.sin(lobes * a + seed) if lobes else 0))
            off = N * math.cos(a) + B * math.sin(a)
            M.v.append(tuple(p + off * rr))
    # faces (per-face uvs as H.obj expects)
    Ls = [0.0]
    for i in range(1, len(pts)): Ls.append(Ls[-1] + (pts[i] - pts[i - 1]).length)
    n = sides + 1
    for i in range(len(pts) - 1):
        for j in range(sides):
            a = base + i * n + j
            M.f.append((a, a + 1, a + n + 1, a + n))
    if not hasattr(M, 'fuv'): M.fuv = []
    for i in range(len(pts) - 1):
        for j in range(sides):
            u0, u1 = j / sides * circ, (j + 1) / sides * circ
            v0, v1 = Ls[i] / uv_tile, Ls[i + 1] / uv_tile
            M.fuv.append([(u0, v0), (u1, v0), (u1, v1), (u0, v1)])

class Tree:
    """Recursive branch grower. P = params dict. Produces bark Mesh + list of cards."""
    def __init__(s, P, seed):
        s.P = P; s.rng = np.random.default_rng(seed)
        s.bark = Mesh(); s.bark.fuv = []
        s.cards = []   # (pos, dir, size, depth)
        s.seed = seed

    def grow(s, p, d, L, r0, depth):
        P, rng = s.P, s.rng
        lv = P['levels'][depth]
        nseg = max(2, int(L / lv.get('seg', 0.25)))
        pts = [p.copy()]
        dd = d.normalized()
        for i in range(nseg):
            t = (i + 1) / nseg
            wig = V((rng.normal(), rng.normal(), rng.normal())) * lv.get('wiggle', 0.12)
            dd = (dd + wig + V((0, 0, lv.get('up', 0.0) - lv.get('droop', 0.0) * t))).normalized()
            pts.append(pts[-1] + dd * (L / nseg))
        r1 = r0 * lv.get('taper', 0.35)
        radii = [r0 + (r1 - r0) * (i / nseg) ** 0.8 for i in range(nseg + 1)]
        tube(s.bark, pts, radii, lv.get('sides', 6), P.get('bark_tile', 0.4),
             flare=P.get('flare', 0.0) if depth == 0 and lv.get('root', True) else 0.0, lobes=5 if depth == 0 else 0, seed=s.seed)
        # leaves on this level?
        if lv.get('cards', 0):
            nc = lv['cards']
            for k in range(nc):
                t = lv.get('card_t0', 0.35) + (1 - lv.get('card_t0', 0.35)) * (k + rng.uniform()) / nc
                fi = t * nseg; i0 = min(int(fi), nseg - 1); f = fi - i0
                pos = pts[i0].lerp(pts[i0 + 1], f)
                dirc = (pts[i0 + 1] - pts[i0]).normalized()
                side = _perp(dirc)
                side.rotate(__import__('mathutils').Quaternion(dirc, rng.uniform(0, 2 * PI)))
                cd = (dirc * 0.7 + side * rng.uniform(0.3, 0.9) + V((0, 0, P.get('card_up', 0.25)))).normalized()
                if k == nc - 1 and t > 0.9: cd = (dirc + V((0, 0, 0.2))).normalized()
                s.cards.append((pos, cd, P['card'] * rng.uniform(0.8, 1.15), depth))
        # children
        if depth + 1 < len(P['levels']):
            ch = P['levels'][depth + 1]
            nch = ch['n'] if isinstance(ch['n'], int) else int(rng.integers(ch['n'][0], ch['n'][1] + 1))
            az = rng.uniform(0, 2 * PI)
            for k in range(nch):
                t = ch.get('t0', 0.3) + (ch.get('t1', 1.0) - ch.get('t0', 0.3)) * (k + rng.uniform(0.1, 0.9)) / nch
                fi = t * nseg; i0 = min(int(fi), nseg - 1); f = fi - i0
                pos = pts[i0].lerp(pts[i0 + 1], f)
                pd = (pts[i0 + 1] - pts[i0]).normalized()
                az += 2.39996 + rng.uniform(-0.3, 0.3)
                ang = math.radians(ch.get('angle', 45) + rng.uniform(-1, 1) * ch.get('angle_var', 12))
                side = _perp(pd)
                import mathutils
                side.rotate(mathutils.Quaternion(pd, az))
                cdir = (pd * math.cos(ang) + side * math.sin(ang)).normalized()
                cL = L * ch.get('ratio', 0.6) * (1.0 - ch.get('shrink', 0.4) * t) * rng.uniform(0.8, 1.15)
                cr = max(radii[i0] * ch.get('rratio', 0.6), ch.get('rmin', 0.006))
                s.grow(pos, cdir, cL, cr, depth + 1)

def cards_mesh(cards, grid, centre, radii, fold=0.12, droop=0.25, normal_blend=0.75, rng=None, cell_weights=None):
    """Leaf cards -> Mesh with per-vertex custom normals blended to the crown ellipsoid normal."""
    rng = rng or np.random.default_rng(5)
    M = Mesh(); M.fuv = []
    C = V(centre); Rx, Ry, Rz = radii
    import mathutils
    for (pos, d, size, depth) in cards:
        d = d.normalized()
        side = _perp(d)
        side.rotate(mathutils.Quaternion(d, rng.uniform(0, 2 * PI)))
        # prefer cards facing outward/up (more visible leaf area)
        radial = V(((pos.x - C.x) / Rx, (pos.y - C.y) / Ry, (pos.z - C.z) / Rz))
        if radial.length < 1e-4: radial = V((0, 0, 1))
        fn = side.cross(d)
        if fn.dot(radial) < 0: side = -side; fn = -fn
        cell = int(rng.integers(0, grid * grid)) if cell_weights is None else int(rng.choice(len(cell_weights), p=cell_weights))
        cx, cy = cell % grid, cell // grid
        w = size; h = size
        base = len(M.v)
        start = pos - d * h * 0.04
        for r in range(3):
            tv = r / 2
            for c in range(3):
                tu = c / 2 - 0.5
                p = start + d * (h * tv) + side * (w * tu)
                p = p + fn * (fold * w * (1 - abs(tu) * 2) * 0.5)   # V fold along the midline
                p = p + V((0, 0, -droop * h * tv * tv))
                M.v.append(tuple(p))
                rn = V(((p.x - C.x) / Rx ** 2, (p.y - C.y) / Ry ** 2, (p.z - C.z) / Rz ** 2))
                rn = rn.normalized() if rn.length > 1e-6 else V((0, 0, 1))
                nn = (rn * normal_blend + fn * (1 - normal_blend) + V((0, 0, 0.15))).normalized()
                M.n.append(tuple(nn))
        uvs = [((cx + c / 2) / grid, (cy + r / 2) / grid) for r in range(3) for c in range(3)]
        for r in range(2):
            for c in range(2):
                a = base + r * 3 + c
                M.f.append((a, a + 1, a + 4, a + 3))
                M.fuv.append([uvs[r * 3 + c], uvs[r * 3 + c + 1], uvs[r * 3 + c + 4], uvs[r * 3 + c + 3]])
    return M

def mesh_obj(M, name, mat, smooth=True):
    if not M.f: return None
    ob = H.obj(name, M.v, M.f, mat, M.fuv, smooth=smooth)
    if M.n and len(M.n) == len(M.v):
        try: ob.data.normals_split_custom_set_from_vertices([tuple(x) for x in M.n])
        except Exception as e: print('WARN custom normals', e)
    return ob

def crown_of(cards):
    P = np.array([tuple(c[0]) for c in cards]) if cards else np.zeros((1, 3))
    mn, mx = P.min(0), P.max(0)
    c = (mn + mx) / 2
    r = np.maximum((mx - mn) / 2, 0.05)
    return tuple(c), tuple(r)

def build_tree(name, P, seed, bark, leaves, grid, start=(0, 0, 0), direction=(0, 0, 1), stems=None):
    """Grow one plant (optionally multi-stem) -> [bark_obj, leaf_obj]."""
    T = Tree(P, seed)
    rng = T.rng
    if stems:
        for (off, dirv, L, r) in stems:
            T.grow(V(start) + V(off), V(dirv), L, r, 0)
    else:
        T.grow(V(start), V(direction), P['trunk_len'], P['trunk_r'], 0)
    c, r = crown_of(T.cards)
    CM = cards_mesh(T.cards, grid, c, r, P.get('fold', 0.12), P.get('droop', 0.2), P.get('nblend', 0.75), rng)
    b = T.bark
    out = []
    if b.f:
        ob = H.obj(name + '_bark', b.v, b.f, bark, b.fuv, smooth=True)
        out.append(ob)
    lo = mesh_obj(CM, name + '_leaves', leaves)
    if lo: out.append(lo)
    print('TREE', name, 'cards', len(T.cards), 'bark faces', len(b.f), 'crown', [round(x, 2) for x in r])
    return out

# ------------------------------------------------------------------------------------------ grass / ground cover
def tuft(name, mat, grid, n=10, h=0.35, w=0.3, lean=0.35, seed=1, cells=None):
    """Radial crossed cards (tuft sprites) leaning outward; normals mostly up (like lit grass)."""
    rng = np.random.default_rng(seed)
    M = Mesh(); M.fuv = []
    for k in range(n):
        a = 2 * PI * k / n + rng.uniform(-0.3, 0.3)
        out = V((math.cos(a), math.sin(a), 0))
        side = V((-math.sin(a), math.cos(a), 0))
        r0 = rng.uniform(0.0, 0.05)
        hh = h * rng.uniform(0.75, 1.15); ww = w * rng.uniform(0.8, 1.2)
        le = lean * rng.uniform(0.5, 1.2)
        cell = int(rng.integers(0, grid * grid)) if cells is None else int(rng.choice(cells))
        cx, cy = cell % grid, cell // grid
        base = len(M.v)
        for r in range(3):
            tv = r / 2
            for c in range(2):
                tu = c - 0.5
                p = out * r0 + side * (ww * tu) + out * (le * hh * tv * tv) + V((0, 0, hh * tv * (1 - 0.25 * le * tv)))
                M.v.append(tuple(p))
                M.n.append(tuple((V((0, 0, 1)) + out * 0.35).normalized()))
        for r in range(2):
            a0 = base + r * 2
            M.f.append((a0, a0 + 1, a0 + 3, a0 + 2))
            M.fuv.append([((cx + 0) / grid, (cy + r / 2) / grid), ((cx + 1) / grid, (cy + r / 2) / grid),
                          ((cx + 1) / grid, (cy + (r + 1) / 2) / grid), ((cx + 0) / grid, (cy + (r + 1) / 2) / grid)])
    return mesh_obj(M, name, mat)

# ------------------------------------------------------------------------------------------ rocks
def rock_mats(prefix='rock', seed=11, moss=True, col=('#4a4640', '#6d685f', '#8c867b')):
    N = 1024
    h = H.fbm(N, 180, 5, seed) * 1.0 + np.abs(H.fnoise(N, 8, 8, seed + 9)) * -0.4
    cracks = np.clip(1 - np.abs(H.fnoise(N, 30, 30, seed + 5)) * 6, 0, 1) ** 3
    h = h - cracks * 0.7
    t = np.clip(0.5 + H.fbm(N, 120, 4, seed + 1) * 0.25 + h * 0.08 - cracks * 0.1, 0, 1)
    c = H.ramp(t, [(0, col[0]), (0.55, col[1]), (1, col[2])])
    spk = np.clip(H.fnoise(N, 1.5, 1.5, seed + 3) - 1.8, 0, 1)
    c = c * (1 - spk[..., None] * 0.3)
    lich = np.clip((H.fnoise(N, 20, 20, seed + 7) - 1.4) * 2, 0, 1)
    c = c * (1 - lich[..., None] * 0.35) + np.array([0.62, 0.64, 0.5]) * lich[..., None] * 0.35
    rough = np.clip(0.85 + h * 0.05, 0.6, 1)
    ci = H.save_img(c.astype(np.float32), f'{prefix}_c'); ni = H.save_img(H.h2n(h, 3.0), f'{prefix}_n', True)
    ri = H.save_img(H.orm(rough.astype(np.float32)), f'{prefix}_orm', True)
    rock = H.pbr(prefix, '#ffffff', 0.9, base_tex=ci, normal_tex=ni, rough_tex=ri, nstr=1.0)
    if not moss: return rock, None
    mh = H.fbm(N, 40, 4, seed + 20) + H.fnoise(N, 2, 2, seed + 21) * 0.6
    mc = H.ramp(np.clip(0.5 + mh * 0.3, 0, 1), [(0, '#262c14'), (0.5, '#3c4a1c'), (1, '#66722e')])
    mci = H.save_img(mc.astype(np.float32), f'{prefix}_moss_c'); mni = H.save_img(H.h2n(mh, 4.0), f'{prefix}_moss_n', True)
    mossm = H.pbr(prefix + '_moss', '#ffffff', 0.97, base_tex=mci, normal_tex=mni, nstr=1.0)
    return rock, mossm

def rock(name, size, seed, rock_mat, moss_mat=None, sub=4, flat=0.6, moss_amt=0.5):
    """Displaced subdivided cube (chunky boulder silhouette), UV box, moss on up-facing faces."""
    rng = np.random.default_rng(seed)
    import bmesh
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    bmesh.ops.subdivide_edges(bm, edges=bm.edges[:], cuts=sub, use_grid_fill=True)
    # spherify partially
    for v in bm.verts:
        co = v.co.copy()
        sph = co.normalized() * 0.62
        v.co = co.lerp(sph, 0.45)
    me = bpy.data.meshes.new(name); bm.to_mesh(me); bm.free()
    ob = H.link(bpy.data.objects.new(name, me))
    ob.data.materials.append(rock_mat)
    if moss_mat: ob.data.materials.append(moss_mat)
    # low-freq lumps + planar facets (chipped look)
    planes = [(V(tuple(rng.normal(size=3))).normalized(), rng.uniform(0.26, 0.44)) for _ in range(13)]
    ph = rng.uniform(0, 10, 3)
    sx, sy, sz = size
    for v in me.vertices:
        p = v.co.copy()
        n = p.normalized()
        lump = 0.08 * math.sin(3.1 * p.x + ph[0]) * math.cos(2.7 * p.y + ph[1]) + 0.05 * math.sin(5.3 * p.z + ph[2] + p.x * 2)
        p = p * (1 + lump)
        for pn, d in planes:
            dist = p.dot(pn)
            if dist > d: p = p - pn * (dist - d) * 0.97
        v.co = V((p.x * sx, p.y * sy, p.z * sz))
    # flatten bottom (sits in soil)
    zs = [v.co.z for v in me.vertices]; zmin = min(zs); zmax = max(zs)
    cut = zmin + (zmax - zmin) * 0.12
    for v in me.vertices:
        if v.co.z < cut: v.co.z = cut + (v.co.z - cut) * 0.15
    me.update()
    sub_m = ob.modifiers.new('s', 'SUBSURF'); sub_m.levels = 1; sub_m.render_levels = 1
    ob = H.apply_mods(ob)
    me = ob.data
    # fine displacement
    for v in me.vertices:
        p = v.co
        d = 0.012 * (math.sin(p.x * 23 + p.z * 7) + math.sin(p.y * 19 - p.z * 11)) * max(sx, sy, sz)
        v.co = p + p.normalized() * d
    me.update()
    H.uv_box(ob, 0.9)
    if moss_mat:
        zmin = min(v.co.z for v in me.vertices); zmax = max(v.co.z for v in me.vertices)
        for poly in me.polygons:
            c = poly.center
            nz = poly.normal.z
            hz = (c.z - zmin) / max(zmax - zmin, 1e-3)
            noise = 0.5 + 0.5 * math.sin(c.x * 9.1 + seed) * math.cos(c.y * 8.3 - seed)
            if nz + 0.35 * noise + 0.3 * hz > 1.25 - moss_amt * 0.6: poly.material_index = 1
    me.shade_smooth()
    return ob

# ------------------------------------------------------------------------------------------ shrubs / multi-output
def shrub(name, P, seed, bark, leaves, grid, nstems=6, height=1.0, spread=0.35, lean=0.5):
    """Multi-stem shrub: stems fan out from a small root crown; the rest follows P['levels'][1:]."""
    rng = np.random.default_rng(seed)
    stems = []
    for k in range(nstems):
        a = 2 * PI * k / nstems + rng.uniform(-0.4, 0.4)
        off = (math.cos(a) * spread * 0.15 * rng.uniform(0.3, 1), math.sin(a) * spread * 0.15 * rng.uniform(0.3, 1), 0)
        l = lean * rng.uniform(0.5, 1.1)
        stems.append((off, (math.cos(a) * l, math.sin(a) * l, 1), height * rng.uniform(0.75, 1.05), P.get('stem_r', 0.012)))
    return build_tree(name, P, seed, bark, leaves, grid, stems=stems)

def outputs(script, names):
    """Declare the GLBs a multi-output script writes (make.mjs packs/renders them)."""
    import json
    json.dump(list(names), open(f'{H.BUILD}/{script}.outputs.json', 'w'))

_IMG = {}
def cached_atlas(name, sp, **kw):
    """atlas() but re-uses the PNG painted earlier in this process (after H.reset())."""
    import os
    p = f'{H.TEXD}/{name}.png'
    if name in _IMG and os.path.exists(p):
        return bpy.data.images.load(p), _IMG[name]
    img, g = atlas(name, sp, **kw); _IMG[name] = g
    return img, g

# ------------------------------------------------------------------------------------------ real (mesh) leaves for potted plants
def single_leaf_img(name, sp, n=4, S=512, seed=1):
    """n leaf variants side by side in one strip atlas (each cell: base at bottom centre, tip at top)."""
    rng = np.random.default_rng(seed)
    img = np.zeros((S, S * n, 4), np.float32)
    for k in range(n):
        cell = np.zeros((S, S, 4), np.float32)
        col = _hsv_jit(_hex(sp['leaf']), rng, 0.015, 0.08, 0.1)
        _leaf(cell, (S / 2, 1), PI / 2, S - 3, sp['aspect'], col, S, rng, sp.get('shape', 'ovate'), 1.0, sp.get('vein', 0.12),
              _hex(sp['tip']) if sp.get('tip') else None, sp.get('serr', 0))
        a = cell[..., 3] > 0.5
        yy, xx = np.mgrid[0:S, 0:S].astype(np.float32) / S
        u = yy; v = (xx - 0.5)
        if sp.get('stripes'):           # calathea: pale silver bands following the lateral veins
            band = np.abs(((u - np.abs(v) * 0.9) * sp['stripes']) % 1.0 - 0.5) < 0.12
            m = a & band & (np.abs(v) > 0.03)
            cell[m, :3] = cell[m, :3] * 0.45 + _hex(sp.get('stripe_col', '#b9c7a8')) * 0.55
        if sp.get('variegate'):         # snake plant: dark cross bands + yellow margins
            bands = (np.sin(u * 60 + np.sin(v * 30) * 2) > 0.4) & a
            cell[bands, :3] *= 0.65
        if sp.get('margin'):
            edge = a & (np.abs(v) > (sp['aspect'] * 0.5) * 0.78 * np.clip(np.sin(PI * np.clip(u, 0, 1)) ** 0.5, 0.1, 1))
            cell[edge, :3] = _hex(sp['margin'])
        img[:, k * S:(k + 1) * S] = cell
    img = bleed(img)
    return H.save_img(img, name), n

def leaf_geo(M, base, d, side, L, W, cell, ncell, arch=0.25, cup=0.2, twist=0.0, nu=3, nv=6):
    """Curved leaf blade as a grid (nu across x nv along) on a cell of a horizontal strip atlas.
    base: Vector; d: blade direction at base; side: across vector. arch: tip droop (fraction of L); cup: across."""
    import mathutils
    d = d.normalized(); side = (side - d * side.dot(d)).normalized()
    nrm = side.cross(d)
    if nrm.z < 0: side = -side; nrm = -nrm
    start = len(M.v)
    pos = base.copy(); dd = d.copy()
    for j in range(nv + 1):
        t = j / nv
        if j:
            dd = (dd - nrm * (arch * 2.2 / nv)).normalized()   # bend downward progressively (in the blade's normal plane)
            pos = pos + dd * (L / nv)
        sd = side.copy()
        if twist: sd.rotate(mathutils.Quaternion(dd, twist * t))
        nn = sd.cross(dd).normalized()
        for i in range(nu * 2 + 1):
            x = (i / (nu * 2)) - 0.5
            p = pos + sd * (x * W) + nn * (cup * W * (x * x * 4) * 0.5)
            M.v.append(tuple(p))
            M.n.append(tuple((nn * 0.9 + V((0, 0, 0.2))).normalized()))
    w = nu * 2 + 1
    for j in range(nv):
        for i in range(nu * 2):
            a = start + j * w + i
            M.f.append((a, a + 1, a + w + 1, a + w))
            u0, u1 = (cell + i / (nu * 2)) / ncell, (cell + (i + 1) / (nu * 2)) / ncell
            v0, v1 = j / nv, (j + 1) / nv
            M.fuv.append([(u0, v0), (u1, v0), (u1, v1), (u0, v1)])

def stem(M, pts, r0, r1, sides=5, uv_tile=0.1):
    radii = [r0 + (r1 - r0) * i / (len(pts) - 1) for i in range(len(pts))]
    tube(M, pts, radii, sides, uv_tile)

def curve(p0, d, L, n=6, droop=0.0, wig=0.0, rng=None):
    pts = [V(p0)]; dd = V(d).normalized()
    for i in range(n):
        if rng is not None and wig: dd = (dd + V(tuple(rng.normal(size=3))) * wig).normalized()
        dd = (dd + V((0, 0, -droop / n))).normalized()
        pts.append(pts[-1] + dd * (L / n))
    return pts

def pot(name, r, h, style='taper', mat=None, soil=None, rim=0.012):
    """Plant pot (lathe) with a soil disc; returns soil top z."""
    if style == 'taper': prof = [(0.0, 0.0), (r * 0.72, 0.0), (r * 0.74, 0.006), (r, h - rim), (r + 0.004, h - rim * 0.5), (r, h), (r - rim, h), (r * 0.72 - rim, 0.03), (0.0, 0.03)]
    elif style == 'bowl': prof = [(0.0, 0.0), (r * 0.5, 0.0), (r * 0.85, h * 0.3), (r, h * 0.75), (r, h), (r - rim, h), (r - rim, h * 0.75), (r * 0.5 - rim, 0.03), (0.0, 0.03)]
    else: prof = [(0.0, 0.0), (r - 0.004, 0.0), (r, 0.004), (r, h), (r - rim, h), (r - rim, 0.03), (0.0, 0.03)]
    p = H.lathe(name, prof, 40, mat); H.uv_cyl(p, 0.3); H.sharpen(p, 50) if False else None
    sz = h - 0.025
    if soil is not None:
        s = H.cyl(name + '_soil', r - rim - 0.002, 0.004, loc=(0, 0, sz - 0.004), seg=32, mat=soil); H.uv_planar(s, 0.2)
    return sz

def soil_mat():
    N = 256
    h = H.fnoise(N, 3, 3, 1) * 0.6 + H.fnoise(N, 1, 1, 2) * 0.4
    c = H.ramp(np.clip(0.5 + h * 0.25, 0, 1), [(0, '#1d1510'), (0.6, '#34261b'), (1, '#57442f')])
    return H.pbr('potting_soil', '#ffffff', 0.95, base_tex=H.save_img(c.astype(np.float32), 'soil_c'), normal_tex=H.save_img(H.h2n(h, 3), 'soil_n', True))
