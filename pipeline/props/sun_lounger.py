# Teak sun lounger with raised slatted backrest, rear wheels and a white piped outdoor cushion (seat + back).
# 0.72 x 0.90 x 2.00 m; length along Z in glTF (foot end = +Z front, backrest at -Z).
import sys; sys.path.insert(0, __import__('os').path.dirname(__import__('os').path.abspath(__file__)))
import helpers as H
from helpers import V, PI
import math, numpy as np, bpy

H.reset()
N = 1024
tc, th = H.tex_wood(N, seed=81, light='#b48d62', mid='#977049', dark='#735236', rings=30, warp=0.02, contrast=0.45, pores=0.8)
teak_c = H.save_img(tc, 'teak_c'); teak_n = H.save_img(H.h2n(th, 0.35), 'teak_n', True)
teak = H.pbr('teak', '#ffffff', 0.62, base_tex=teak_c, normal_tex=teak_n, nstr=0.8)
weave = H.fabric_normal('canvas_n', 1024, 96, seed=3, strength=1.4)
canvas = H.pbr('cushion_canvas', '#efece6', 0.9, normal_tex=weave, nstr=0.9)
pip = H.pbr('cushion_piping', '#e6e2da', 0.85, normal_tex=weave, nstr=0.6)
steel = H.pbr('stainless', '#c8c8c8', 0.25, 1.0)
rubber = H.pbr('wheel_rubber', '#2a2a2a', 0.8)

W, L = 0.70, 2.00
RX = W / 2 - 0.0225           # rail centre x
RZ0, RZ1 = 0.23, 0.33         # rail bottom/top
HINGE_Y = 0.22
_k = [0]
def plank(name, mn, mx, along, b=0.004):
    o = H.box_minmax(name, mn, mx, mat=teak)
    _k[0] += 1
    H.uv_box(o, 1.0, along=along, offset=(_k[0] * 0.137 % 1, _k[0] * 0.291 % 1))
    H.bevel(o, b, 3)
    return o
parts = []
for sx in (-1, 1):
    parts.append(plank('rail', (sx * RX - 0.0225, -L / 2, RZ0), (sx * RX + 0.0225, L / 2 - 0.06, RZ1), 'y'))
    # foot legs
    parts.append(plank('leg_front', (sx * RX - 0.025 - sx * 0.0, -L / 2 + 0.03, 0.0), (sx * RX + 0.025, -L / 2 + 0.085, RZ0 + 0.02), 'z'))
    # rear legs + wheels
    parts.append(plank('leg_rear', (sx * RX - 0.025, L / 2 - 0.2, 0.09), (sx * RX + 0.025, L / 2 - 0.145, RZ0 + 0.02), 'z'))
    wx = sx * (RX + 0.05)
    w = H.lathe('wheel', [(0.0, -0.016), (0.085, -0.016), (0.092, -0.01), (0.093, 0.0), (0.092, 0.01), (0.085, 0.016), (0.0, 0.016)], 48, teak,
                loc=(wx, L / 2 - 0.172, 0.093), rot=(0, PI / 2, 0))
    H.uv_box(w, 1.0)
    H.cyl('axle', 0.012, 0.05, loc=(sx * (RX + 0.02), L / 2 - 0.172, 0.093), rot=(0, PI / 2, 0), seg=16, mat=steel)
    H.lathe('tyre', [(0.088, -0.012), (0.094, -0.01), (0.096, 0.0), (0.094, 0.01), (0.088, 0.012)], 48, rubber, loc=(wx, L / 2 - 0.172, 0.093), rot=(0, PI / 2, 0))
# end rails
parts.append(plank('end_front', (-RX + 0.02, -L / 2, RZ0 + 0.02), (RX - 0.02, -L / 2 + 0.04, RZ1), 'x'))
parts.append(plank('end_rear', (-RX + 0.02, L / 2 - 0.1, RZ0 + 0.02), (RX - 0.02, L / 2 - 0.06, RZ1), 'x'))
# seat slats (across X) resting on inner battens
for sx in (-1, 1):
    parts.append(plank('batten', (sx * (RX - 0.0225) - (0.02 if sx > 0 else 0), -L / 2 + 0.04, RZ1 - 0.05), (sx * (RX - 0.0225) + (0 if sx > 0 else 0.02), HINGE_Y + 0.05, RZ1 - 0.02), 'y', 0.002))
y = -L / 2 + 0.05
while y < HINGE_Y - 0.06:
    parts.append(plank('slat', (-RX + 0.0225, y, RZ1 - 0.022), (RX - 0.0225, y + 0.07, RZ1 - 0.002), 'x', 0.003))
    y += 0.085
# backrest (built flat from the hinge along +Y, then rotated up 40 deg about X at the hinge)
BL = 0.78
back = []
for sx in (-1, 1):
    back.append(plank('stile', (sx * (RX - 0.05) - 0.0175, HINGE_Y, RZ1 - 0.05), (sx * (RX - 0.05) + 0.0175, HINGE_Y + BL, RZ1 - 0.002), 'y'))
y = HINGE_Y + 0.02
while y < HINGE_Y + BL - 0.07:
    back.append(plank('bslat', (-RX + 0.035, y, RZ1 - 0.002), (RX - 0.035, y + 0.07, RZ1 + 0.018), 'x', 0.003))
    y += 0.085
back.append(plank('btop', (-RX + 0.035, HINGE_Y + BL - 0.06, RZ1 - 0.002), (RX - 0.035, HINGE_Y + BL, RZ1 + 0.018), 'x', 0.003))
ANG = math.radians(42)
H.xform_about(back, (0, HINGE_Y, RZ1 - 0.02), (ANG, 0, 0))
# support strut under the backrest
strut_top = V((0, HINGE_Y + 0.45 * math.cos(ANG), RZ1 - 0.02 + 0.45 * math.sin(ANG))) - V((0, 0, 0.03))
for sx in (-1, 1):
    s = H.box_minmax('strut', (-0.02, -0.02, 0.0), (0.02, 0.02, 0.36), mat=teak)
    H.uv_box(s, 1.0, along='z'); H.bevel(s, 0.003, 2)
    s.location = (sx * (RX - 0.1), HINGE_Y + 0.50, RZ1 - 0.06); s.rotation_euler = (0.52, 0, 0)
# cushions
T = 0.07
def cushion(name, w, l, cx, cy, cz, rotx=0.0, pivot=None):
    def zf(x, y, z):
        dome = 0.006 * max(0, 1 - (2 * x / w) ** 4) * max(0, 1 - (2 * y / l) ** 4)
        return z + (dome if z > 0 else -dome * 0.3)
    c = H.superellipsoid(name, w / 2, l / 2, T / 2, e=12, n=3.2, nu=96, nv=14, mat=canvas, zfn=zf)
    H.uv_box(c, 0.2)
    c.location = (cx, cy, cz)
    # piping along the equator
    pts = [V((x, y, 0.0)) for x, y in H.rrect2d(w + 0.003, l + 0.003, 0.035, 8)]
    p = H.sweep(name + '_piping', pts, H.circle2d(0.0045, 8), pip, closed=True, up=(0, 0, 1))
    H.uv_box(p, 0.2)
    p.location = (cx, cy, cz)
    objs = [c, p]
    if rotx: H.xform_about(objs, pivot, (rotx, 0, 0))
    return objs
seat_len = HINGE_Y - (-L / 2 + 0.04) - 0.01
cushion('seat_cushion', W - 0.07, seat_len, 0, (-L / 2 + 0.045 + HINGE_Y) / 2, RZ1 + T / 2 - 0.002)
cushion('back_cushion', W - 0.09, BL - 0.03, 0, HINGE_Y + (BL - 0.03) / 2 + 0.03, RZ1 + 0.018 + T / 2, ANG, (0, HINGE_Y, RZ1 - 0.02))
H.finish('sun_lounger')
