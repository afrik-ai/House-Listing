# Modern upholstered double bed (160 x 200 mattress): channel-tufted headboard, upholstered base on a recessed
# plinth, draped duvet with turned-down fold and soft folds (analytic cloth wrap + displacement), 2 sleeping
# pillows, 2 cushions, knitted throw across the foot. ~1.80 x 1.20 x 2.18 m; headboard at glTF -Z (the wall).
import sys; sys.path.insert(0, __import__('os').path.dirname(__import__('os').path.abspath(__file__)))
import helpers as H
from helpers import V, PI
import math, numpy as np, bpy

H.reset()
twill = H.fabric_normal('uph_twill_n', 1024, 90, seed=31, strength=1.6, twill=True)
fine = H.fabric_normal('percale_n', 1024, 160, seed=32, strength=0.8)
knit_h = H.tex_weave(512, 16, 33, 1.0, 0.2, False)
knit = H.save_img(H.h2n(knit_h, 3.0), 'knit_n', True)
uph = H.pbr('upholstery_greige', '#b3aca1', 0.9, normal_tex=twill, nstr=1.0)
duvet_m = H.pbr('duvet_cotton_white', '#f2f1ed', 0.85, normal_tex=fine, nstr=0.6)
pillow_m = H.pbr('pillow_cotton_white', '#f5f4f1', 0.85, normal_tex=fine, nstr=0.6)
cush_a = H.pbr('cushion_anthracite', '#44464a', 0.9, normal_tex=twill, nstr=1.0)
cush_b = H.pbr('cushion_sage', '#8b957f', 0.9, normal_tex=twill, nstr=1.0)
throw_m = H.pbr('throw_knit_charcoal', '#3b3c3f', 0.95, normal_tex=knit, nstr=1.0)
plinth = H.pbr('plinth_black', '#161616', 0.6)
mat_m = H.pbr('mattress_white', '#eeeeea', 0.85, normal_tex=fine, nstr=0.5)

HX, YF, YH = 0.80, -1.0, 1.0        # mattress half width, foot y, head y
ZB0, ZB1 = 0.08, 0.34               # upholstered base
ZM = 0.56                           # mattress top
# ---- plinth + base + mattress
H.box_minmax('plinth', (-0.78, -0.95, 0.0), (0.78, 0.95, ZB0 + 0.01), mat=plinth, bev=0.004, seg=2)
base = H.superellipsoid('base', 0.87, 1.07, (ZB1 - ZB0) / 2, e=14, n=10, nu=64, nv=10, mat=uph)
base.location = (0, 0.0, (ZB0 + ZB1) / 2); H.uv_box(base, 0.3)
mat = H.superellipsoid('mattress', HX, (YH - YF) / 2, (ZM - ZB1) / 2, e=16, n=7, nu=64, nv=10, mat=mat_m)
mat.location = (0, (YH + YF) / 2, (ZB1 + ZM) / 2); H.uv_box(mat, 0.3)
# ---- headboard: backing panel + 9 vertical channels
HY = YH + 0.07
back = H.box_minmax('head_back', (-0.9, HY, ZB0), (0.9, HY + 0.07, 1.16), mat=uph)
H.uv_box(back, 0.3); H.bevel(back, 0.015, 3)
NCH = 9
cw = 1.8 / NCH
for i in range(NCH):
    cx = -0.9 + cw * (i + 0.5)
    ch = H.superellipsoid('channel', cw / 2 + 0.004, 0.045, 0.43, e=2.4, n=9, nu=24, nv=12, mat=uph)
    ch.location = (cx, HY - 0.01, ZB1 - 0.02 + 0.43 + 0.36 * 0 + 0.0)
    ch.location.z = 1.2 - 0.43
    H.uv_box(ch, 0.3)
# ---- duvet: analytic drape of a flat sheet over the mattress (+ turned-down fold at the head end)
T = 0.035                         # duvet thickness (solidify, mid-surface)
Z0 = ZM + T / 2 + 0.003
RR = 0.07                         # edge roll radius
F = 0.28                          # fold line (y)
RF = T / 2                        # fold radius so the layers touch
FOLD = 0.34                       # turned-down length
HS, HF = 0.34, 0.30               # side / foot overhang
rng = np.random.default_rng(4)
nz = H.fbm(128, 24, 3, seed=41)
wr = H.fnoise(128, 10, 3, seed=42)
def drape(px, py, ztop, hx=HX, yf=YF, rr=RR):
    dx = max(abs(px) - hx, 0.0); dy = max(yf - py, 0.0)
    qx = max(min(px, hx), -hx); qy = max(py, yf)
    d = math.hypot(dx, dy)
    if d < 1e-9: return V((px, py, ztop)), 0.0, None
    dirx, diry = math.copysign(dx, px) / d, -dy / d
    a = min(d, rr * PI / 2)
    x = qx + dirx * rr * math.sin(a / rr); y = qy + diry * rr * math.sin(a / rr)
    z = ztop - rr * (1 - math.cos(a / rr))
    d2 = max(0.0, d - rr * PI / 2)
    x += dirx * d2 * 0.07; y += diry * d2 * 0.07; z -= d2
    # hanging folds: displacement along the outward direction, stronger lower down and at the corners
    corner = 1.0 if (dx > 0 and dy > 0) else 0.0
    tang = py if dx > 0 else px
    amp = min(d2 / 0.18, 1.0) * (0.012 + 0.02 * corner)
    f = math.sin(tang * 2 * PI / 0.33 + 1.7 * math.sin(tang * 3.1)) + 0.5 * wr[int((tang + 2) * 30) % 128, int(d2 * 200) % 128]
    x += dirx * amp * f; y += diry * amp * f
    return V((x, y, z)), d2, (dirx, diry)
def sheet_point(px, py):
    # longitudinal fold: py beyond F turns over and comes back towards the foot on top
    if py <= F:
        yy, zt = py, Z0
        p, d2, _ = drape(px, yy, zt)
    elif py <= F + PI * RF:
        th = (py - F) / RF
        yy = F + RF * math.sin(th); zt = Z0 + RF * (1 - math.cos(th))
        p, d2, _ = drape(px, yy, zt)
    else:
        yy = F - (py - F - PI * RF); zt = Z0 + 2 * RF
        p, d2, _ = drape(px, yy, zt, rr=RR + T)
    # top-surface softness (only where the sheet lies on the mattress)
    p.z += soft(px, yy)
    return p
def soft(px, yy):
    if abs(px) < HX and YF < yy:
        k = max(0.0, 1 - max(abs(px) / HX, 0) ** 6)
        return (0.013 * nz[int((px + 1.2) * 50) % 128, int((yy + 1.5) * 50) % 128] * k
                + 0.007 * math.sin(px * 7.3 + yy * 1.2) * k * (0.5 + 0.5 * math.sin(yy * 2.1)))
    return 0.0
us = np.linspace(-(HX + HS), HX + HS, 46)
v_lo = YF - HF
vs_ = list(np.linspace(v_lo, F, 50)) + list(F + np.linspace(0, PI * RF, 10)[1:]) + list(F + PI * RF + np.linspace(0, FOLD, 10)[1:])
verts, faces = [], []
nu_ = len(us)
for py in vs_:
    for px in us:
        verts.append(tuple(sheet_point(px, py)))
for j in range(len(vs_) - 1):
    for i in range(nu_ - 1):
        a = j * nu_ + i
        faces.append((a, a + 1, a + nu_ + 1, a + nu_))
duv = H.obj('duvet', verts, faces, duvet_m)
H.recalc(duv)
H.solidify(duv, T, offset=0)
duv = H.apply_mods(duv)
H.uv_box(duv, 0.25)
# ---- knitted throw across the foot (same drape, on top of the duvet)
tu = np.linspace(-(HX + 0.28), HX + 0.28, 40)
tv = np.linspace(-0.62, YF - 0.2, 20)
tvs, tfs = [], []
for py in tv:
    for px in tu:
        p, d2, _ = drape(px, py, Z0 + T / 2 + 0.011, hx=HX + 0.035, yf=YF - 0.035, rr=RR + T / 2)
        p.z += soft(px, py) * 0.9
        tvs.append(tuple(p))
for j in range(len(tv) - 1):
    for i in range(len(tu) - 1):
        a = j * len(tu) + i
        tfs.append((a, a + 1, a + len(tu) + 1, a + len(tu)))
thr = H.obj('throw', tvs, tfs, throw_m)
H.recalc(thr)
H.solidify(thr, 0.01, offset=0)
thr = H.apply_mods(thr)
H.uv_box(thr, 0.12)
# ---- pillows (pinched-edge superellipsoids) leaning on the headboard
def pillow(name, a, b, c, mat, loc, tilt, yaw=0.0, seed=0):
    rn = np.random.default_rng(seed)
    ph = rn.uniform(0, 6)
    def zf(x, y, z):
        return z * (1 - 0.18 * (abs(x) / a) ** 3) + 0.004 * math.sin(x * 23 + ph) * math.sin(y * 17)
    p = H.superellipsoid(name, a, b, c, e=4.5, n=1.7, nu=48, nv=14, mat=mat, zfn=zf)
    H.uv_box(p, 0.25)
    p.rotation_euler = (tilt, 0, yaw); p.location = loc
    return p
for sx, sd in ((-0.41, 1), (0.41, 2)):
    pillow('pillow', 0.37, 0.25, 0.075, pillow_m, (sx, YH - 0.12, ZM + 0.24), 1.2, sx * 0.03, sd)
pillow('cushion', 0.23, 0.23, 0.07, cush_a, (-0.28, YH - 0.27, ZM + 0.22), 1.25, 0.05, 5)
pillow('cushion', 0.23, 0.23, 0.07, cush_b, (0.26, YH - 0.28, ZM + 0.22), 1.25, -0.06, 6)
H.finish('bed_double_modern')
