# P07 shared kit for indoor props (imported by the prop scripts; make.mjs skips files starting with "_").
# Baked procedural materials (wood grain, fabric weave, ceramic glaze, brushed brass) + small builders
# (upholstered cushion with piping, turned legs, stitched seams). Conventions as helpers.py: Z-up, front -Y.
import sys, os; sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import helpers as H
from helpers import V, PI
import math, random, numpy as np, bpy

_M = {}

def wood(key='oak', light='#b8895c', mid='#96683f', dark='#6b4526', rings=22, seed=5, rough=0.55, N=1024, coat=0.0):
    """Baked straight-grain wood (colour + normal + roughness breakup). UV: 1 unit = 1 m via uv_box(ob, 1.0, along=...)."""
    if key in _M: return _M[key]
    col, h = H.tex_wood(N, seed, light, dark, mid, rings=int(rings * 2.6), contrast=0.32, warp=0.02)   # UV 1 m/tile: ~1.5 cm growth rings
    ci = H.save_img(col, f'{key}_col')
    ni = H.save_img(H.h2n(h, 2.0), f'{key}_n', True)
    r = np.clip(rough + H.fnoise(N, 120, 30, seed + 7) * 0.06 + h * 0.05, 0.2, 1)
    ri = H.save_img(H.orm(r), f'{key}_orm', True)
    _M[key] = H.pbr(key, '#ffffff', rough, base_tex=ci, normal_tex=ni, rough_tex=ri, nstr=0.5, coat=coat)
    return _M[key]

def fabric(key, color, threads=90, seed=1, twill=False, rough=0.92, strength=1.2, sheen=0.08):
    if key in _M: return _M[key]
    n = H.fabric_normal(f'{key}_n' if twill else f'weave{threads}_{int(twill)}_n', 1024, threads, seed, strength, twill)
    _M[key] = H.pbr(key, color, rough, normal_tex=n, nstr=1.0, sheen=sheen)
    return _M[key]

def glaze(key, color, rough=0.25, speck=0.0, seed=3, N=512, crackle=0.0):
    """Ceramic glaze: colour pooling noise + optional clay specks; subtle normal ripple."""
    if key in _M: return _M[key]
    c = np.array(H.hexc(color, False), np.float32)
    t = H.fbm(N, 60, 4, seed) * 0.5
    col = np.clip(c[None, None, :] * (1 + t[..., None] * 0.08), 0, 1)
    if speck:
        s = (H.fnoise(N, 0.7, 0.7, seed + 2) > 2.6).astype(np.float32)
        col = col * (1 - s[..., None] * speck)
    h = H.fnoise(N, 40, 40, seed + 4) * 0.4
    if crackle:
        h += (np.abs(H.fnoise(N, 12, 12, seed + 5)) < 0.05).astype(np.float32) * -crackle
    ci = H.save_img(col, f'{key}_col'); ni = H.save_img(H.h2n(h, 0.6), f'{key}_n', True)
    _M[key] = H.pbr(key, '#ffffff', rough, base_tex=ci, normal_tex=ni, nstr=0.4)
    return _M[key]

def brushed(key, color='#b8914a', rough=0.32, seed=11, N=512):
    if key in _M: return _M[key]
    b = H.tex_brushed(N, seed)
    ni = H.save_img(H.h2n(b * 0.8, 0.12), f'{key}_n', True)
    ri = H.save_img(H.orm(np.clip(rough + b * 0.05 + H.fnoise(N, 50, 50, seed + 1) * 0.04, 0.05, 1), np.ones((N, N), np.float32)), f'{key}_orm', True)
    _M[key] = H.pbr(key, color, rough, 1.0, normal_tex=ni, rough_tex=ri, nstr=0.5)
    return _M[key]

def marble(key='marble_white', N=1024, seed=21, base='#ece9e3', vein='#7d7a76'):
    if key in _M: return _M[key]
    y, x = np.mgrid[0:N, 0:N].astype(np.float32) / N
    w = H.fbm(N, 180, 5, seed) * 0.35
    v = np.abs(np.sin((x * 3 + y * 1.4 + w) * PI * 2))
    veins = np.clip(1 - v / 0.05, 0, 1) ** 2 * 0.8 + np.clip(1 - np.abs(np.sin((x * 7 - y * 2 + w * 1.7) * PI * 2)) / 0.03, 0, 1) * 0.35
    cloud = H.fbm(N, 120, 4, seed + 3) * 0.04
    col = H.colmix(np.clip(veins + cloud, 0, 1), base, vein)
    ci = H.save_img(col, f'{key}_col')
    ri = H.save_img(H.orm(np.clip(0.12 + veins * 0.1 + H.fnoise(N, 80, 80, seed + 4) * 0.03, 0, 1)), f'{key}_orm', True)
    _M[key] = H.pbr(key, '#ffffff', 0.15, base_tex=ci, rough_tex=ri)
    return _M[key]

def wicker(key='wicker', color_a='#b58d5a', color_b='#8a6538', N=512, seed=7, n=20):
    """Basket weave: vertical stakes + horizontal weavers (colour + normal)."""
    if key in _M: return _M[key]
    y, x = np.mgrid[0:N, 0:N].astype(np.float32) / N
    tu, tv = x * n, y * n * 2
    iu, iv = np.floor(tu), np.floor(tv)
    fu, fv = tu - iu, tv - iv
    over = ((iu + iv) % 2) < 1
    hw = np.sin(PI * fv) ** 0.6 * (0.7 + 0.3 * np.sin(PI * fu))
    hs = np.sin(PI * fu) ** 0.6
    h = np.where(over, hw, hs * 0.8)
    t = np.clip(h * 0.8 + H.fnoise(N, 40, 2, seed) * 0.1, 0, 1)
    col = H.colmix(t, color_b, color_a)
    col *= (0.6 + 0.4 * np.clip(h, 0, 1))[..., None]
    ci = H.save_img(col, f'{key}_col'); ni = H.save_img(H.h2n(h, 3.0), f'{key}_n', True)
    _M[key] = H.pbr(key, '#ffffff', 0.8, base_tex=ci, normal_tex=ni, nstr=1.0)
    return _M[key]

def plain(key, color, rough=0.5, metal=0.0, **kw):
    if key in _M: return _M[key]
    _M[key] = H.pbr(key, color, rough, metal, **kw)
    return _M[key]

def leather(key, color, seed=13, N=512):
    if key in _M: return _M[key]
    h = H.fnoise(N, 3, 3, seed) * 0.5 + H.fnoise(N, 9, 9, seed + 1) * 0.3
    ni = H.save_img(H.h2n(h, 0.5), f'{key}_n', True)
    ri = H.save_img(H.orm(np.clip(0.5 + h * 0.06 + H.fnoise(N, 80, 80, seed + 2) * 0.06, 0, 1)), f'{key}_orm', True)
    _M[key] = H.pbr(key, color, 0.5, normal_tex=ni, rough_tex=ri, nstr=0.6, coat=0.1)
    return _M[key]

# ------------------------------------------------------------------ builders
def cushion(name, w, d, h, mat, loc=(0, 0, 0), crown=0.25, pipe=None, pipe_r=0.0045, e=10, rot=None, sag=0.0, tuft=0):
    """Box cushion: superellipsoid body (crowned top/bottom), piping cord swept round the top and bottom seams,
    optional tufts (buttons pressed in). Size w (X) x d (Y) x h (Z), loc = centre."""
    hz = h / 2
    def zfn(x, y, z):
        u = 1 - min(1, (abs(x) / (w / 2)) ** 4 + (abs(y) / (d / 2)) ** 4)
        k = 1 + crown * u
        z2 = z * k
        if sag and z > 0: z2 -= sag * u
        if tuft:
            for tx in tuft_pts:
                dd = ((x - tx[0]) ** 2 + (y - tx[1]) ** 2) / (0.025 ** 2)
                if z > 0: z2 -= 0.012 * math.exp(-dd)
        return z2
    tuft_pts = []
    if tuft:
        for i in range(tuft):
            for j in (1,):
                tuft_pts.append(((i + 0.5) / tuft * w - w / 2, 0))
    b = H.superellipsoid(name, w / 2, d / 2, hz, e=e, n=6, nu=56, nv=12, mat=mat, zfn=zfn)
    b.location = loc
    if rot: b.rotation_euler = rot
    H.uv_box(b, 0.25)
    out = [b]
    if pipe is not None:
        for zz in (hz * 0.93, -hz * 0.93):
            pts = [V((p.x, p.y, zz + loc[2])) for p in H.ring_se(w / 2 - 0.001, d / 2 - 0.001, 0, e, 64)]
            for p in pts: p.x += loc[0]; p.y += loc[1]
            t = H.tube(name + '_pipe', pts, pipe_r, 6, pipe, closed=True, up=(0, 0, 1))
            if rot: H.xform_about([t], loc, rot)
            out.append(t)
    for tx in tuft_pts:
        bt = H.cyl(name + '_btn', 0.008, 0.005, loc=(loc[0] + tx[0], loc[1] + tx[1], loc[2] + hz * (1 + crown) - 0.014), seg=10, mat=pipe or mat)
        out.append(bt)
    return out

def stitch(name, pts, mat, r=0.0012, dash=0.008, gap=0.005, up=(0, 0, 1)):
    """Dashed seam stitches along a polyline (tiny boxes)."""
    out = []
    acc = 0.0
    for a, b in zip(pts[:-1], pts[1:]):
        L = (b - a).length
        if L < 1e-6: continue
        d = (b - a) / L
        t = acc
        while t < L:
            p = a + d * t
            q = a + d * min(t + dash, L)
            c = (p + q) / 2
            s = H.box(name, (q - p).length, r * 2, r * 2, loc=tuple(c), mat=mat)
            s.rotation_euler = (0, 0, math.atan2(d.y, d.x))
            out.append(s)
            t += dash + gap
        acc = t - L
    return out

def tapered_leg(name, r0, r1, h, loc, mat, splay=(0, 0), seg=16):
    l = H.cyl(name, r0, h, loc=(0, 0, 0), seg=seg, mat=mat, r2=r1)
    H.uv_cyl(l, 1.0)
    l.location = loc
    l.rotation_euler = (splay[0], splay[1], 0)
    return l

def rounded_panel(name, w, d, t, r, mat, loc=(0, 0, 0), bev=0.003, seg=8):
    """Flat slab with rounded plan corners (w x d, thickness t), bevelled edge. loc = bottom centre."""
    ring0 = [V((x, y, 0)) for x, y in H.rrect2d(w, d, r, seg)]
    ring1 = [V((x, y, t)) for x, y in H.rrect2d(w, d, r, seg)]
    ob = H.loft(name, [ring0, ring1], mat, cap0=True, cap1=True)
    ob.location = loc
    H.sharpen(ob, 40)
    if bev: H.bevel(ob, bev, 2)
    return ob

def book(name, w, d, h, cover, page, loc, rotz=0.0, roty=0.0):
    """Hardback: cover box slightly larger than a page block inset at the fore-edge."""
    c = H.box(name, w, d, h, loc=(0, 0, h / 2), mat=cover, bev=0.0015, seg=2)
    p = H.box(name + '_pg', w - 0.004, d - 0.006, h - 0.006, loc=(0, 0.0035, h / 2), mat=page)
    for o in (c, p):
        H.apply_mods(o)
        o.data.transform(__import__('mathutils').Matrix.Rotation(roty, 4, 'Y'))
        o.rotation_euler = (0, 0, rotz); o.location = loc
    return [c, p]

def drawer_case(W, D, Hh, rows, cols, body, front, handle, void, z0=0.0, gap=0.003, inset=0.018, knob=False, top_over=0.01):
    """Carcass with a grid of drawer fronts (3 mm reveals, dark void behind the gaps) and bar handles/knobs.
    Occupies x +-W/2, y +-D/2 (front at -Y), z z0..z0+Hh. rows may be a list of relative heights."""
    rows = rows if isinstance(rows, (list, tuple)) else [1] * rows
    t = H.box('top', W + top_over * 2, D + top_over, 0.025, loc=(0, top_over / 2 * -1, z0 + Hh - 0.0125), mat=body, bev=0.004); H.uv_box(t, 1.0, along='x')
    c = H.box('carcass', W, D, Hh - 0.025, loc=(0, 0, z0 + (Hh - 0.025) / 2), mat=body, bev=0.002); H.uv_box(c, 1.0, along='x')
    H.box('void', W - 2 * inset + 0.004, 0.004, Hh - 0.025 - 2 * inset + 0.004, loc=(0, -D / 2 - 0.001, z0 + (Hh - 0.025) / 2), mat=void)
    tot = sum(rows); aw = W - 2 * inset; ah = Hh - 0.025 - 2 * inset
    z = z0 + inset + ah
    for r in rows:
        h = ah * r / tot
        z -= h
        fw = aw / cols
        for ci in range(cols):
            x = -aw / 2 + fw * (ci + 0.5)
            f = H.box('front', fw - gap, 0.02, h - gap, loc=(x, -D / 2 - 0.009, z + h / 2), mat=front, bev=0.002, seg=2)
            H.uv_box(f, 1.0, along='x')
            if knob:
                H.lathe('knob', [(0.0, 0.0), (0.007, 0.0), (0.005, 0.012), (0.013, 0.02), (0.012, 0.026), (0.0, 0.027)], 20, handle, loc=(x, -D / 2 - 0.019, z + h / 2), rot=(PI / 2, 0, 0))
            else:
                hw = min(0.16, fw * 0.4)
                H.tube('handle', [V((x - hw / 2, -D / 2 - 0.019, z + h * 0.6)), V((x - hw / 2, -D / 2 - 0.045, z + h * 0.6)), V((x + hw / 2, -D / 2 - 0.045, z + h * 0.6)), V((x + hw / 2, -D / 2 - 0.019, z + h * 0.6))], 0.005, 8, handle)

BOOK_COLS = ['#7a2e26', '#2d4a6b', '#d8cfb8', '#3f5a3c', '#b8892f', '#1f1f22', '#8c6d5a', '#5a6b7a', '#a8543a', '#e3ddd0', '#40324a', '#6f7b5a']
def book_row(prefix, x0, x1, z, y, depth=0.2, seed=1, hmin=0.18, hmax=0.27, lean_end=True, stack=True):
    """Row of books standing on a shelf (spines toward -Y) from x0 to x1 at height z; varied heights, widths,
    colours (8 shared cover materials), occasional gap, last book leaning, optional lying stack at the end."""
    rnd = random.Random(seed)
    covs = [fabric(f'{prefix}_cov{i}', c, threads=140, seed=200 + i, sheen=0.0) for i, c in enumerate(BOOK_COLS[:8])]
    page = plain('book_pages', '#ece4d0', 0.9)
    x = x0; end = x1 - (0.2 if stack else 0.0)
    while x < end - 0.03:
        t = rnd.uniform(0.018, 0.045); h = rnd.uniform(hmin, hmax); d = min(depth, h * 0.72)
        if x + t > end: break
        c = covs[rnd.randrange(len(covs))]
        book(f'{prefix}_b', t, d, h, c, page, loc=(x + t / 2, y + rnd.uniform(-0.01, 0.01), z))
        x += t + (0.001 if rnd.random() > 0.08 else rnd.uniform(0.02, 0.05))
    if stack:
        zz = z
        for i in range(rnd.randint(2, 4)):
            w = rnd.uniform(0.16, 0.2); h = rnd.uniform(0.025, 0.045)
            book(f'{prefix}_s', w, min(depth, 0.24), h, covs[rnd.randrange(len(covs))], page, loc=(x1 - 0.11 + rnd.uniform(-0.01, 0.01), y, zz), rotz=rnd.uniform(-0.12, 0.12))
            zz += h
import random
