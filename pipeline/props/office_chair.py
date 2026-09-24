# Ergonomic office chair: polished aluminium 5-star base, twin-wheel casters, gas lift, black fabric seat with
# waterfall edge, S-curved black frame with see-through mesh back, lumbar pad, T-armrests. ~0.66 x 1.10 x 0.66 m
import sys; sys.path.insert(0, 'C:/Users/Owner/HouseListing/pipeline/props')
import helpers as H
from helpers import V, PI
import math, numpy as np, bpy

H.reset()
# mesh back texture: fine woven mesh with holes (alpha), 512 px per 4 cm
M = 512
y, x = np.mgrid[0:M, 0:M].astype(np.float32) / M
cells = 24
fx = (x * cells) % 1; fy = (y * cells) % 1
sx = np.abs(fx - 0.5); sy = np.abs(fy - 0.5)
hole = np.clip((np.minimum(0.5 - sx, 0.5 - sy) - 0.12) / 0.06, 0, 1)   # 1 inside hole
strand = 1 - hole
alpha = np.clip(strand * 0.95 + 0.12, 0, 1)
hgt = strand * (np.cos((fx - 0.5) * PI) + np.cos((fy - 0.5) * PI)) * 0.5
mc = np.concatenate([H.colmix(strand * 0 + H.fnoise(M, 2, 2, 3) * 0.05 + 0.5, '#1b1c1e', '#232427'), alpha[..., None]], -1)
mesh_c = H.save_img(mc, 'chair_mesh_c'); mesh_n = H.save_img(H.h2n(hgt, 2.0), 'chair_mesh_n', True)
meshm = H.pbr('back_mesh', '#ffffff', 0.7, base_tex=mesh_c, alpha_tex=True, normal_tex=mesh_n, cull=False, blend='BLEND')
weave = H.fabric_normal('seat_weave_n', 1024, 120, seed=12, strength=1.6, twill=True)
fabric = H.pbr('seat_fabric_black', '#1e1f21', 0.9, normal_tex=weave, nstr=1.0)
plastic = H.pbr('black_plastic', '#161617', 0.45)
pu = H.pbr('armpad_pu', '#1a1a1a', 0.55)
alu = H.pbr('polished_aluminium', '#d4d5d7', 0.16, 1.0)
chrome = H.pbr('chrome', '#e2e2e2', 0.07, 1.0)
nylon = H.pbr('caster_nylon', '#141414', 0.5)

# ---- 5-star base
for k in range(5):
    a = PI / 2 + 2 * PI * k / 5
    d = V((math.cos(a), math.sin(a), 0))
    pts = [V((0, 0, 0.13)) + d * 0.03, V((0, 0, 0.128)) + d * 0.15, V((0, 0, 0.112)) + d * 0.26, V((0, 0, 0.098)) + d * 0.325]
    arm = H.sweep('star_arm', pts, [(p[1], p[0]) for p in H.rrect2d(0.034, 0.042, 0.012, 3)], alu, caps=True, scale=[1.0, 0.92, 0.8, 0.72], up=(0, 0, 1))
    H.bevel(arm, 0.002, 2)
    tip = V((0, 0, 0)) + d * 0.325
    # caster: stem, housing, twin wheels
    H.cyl('caster_stem', 0.006, 0.03, loc=(tip.x, tip.y, 0.068), seg=12, mat=chrome)
    hs = H.box('caster_housing', 0.034, 0.05, 0.03, loc=(tip.x, tip.y, 0.052), rot=(0, 0, a), mat=nylon, bev=0.01, seg=3)
    for s in (-1, 1):
        off = V((-math.sin(a), math.cos(a), 0)) * 0.0
        wc = tip + V((math.cos(a + PI / 2), math.sin(a + PI / 2), 0)) * (s * 0.021)
        H.cyl('caster_wheel', 0.025, 0.014, loc=(wc.x - math.cos(a + PI / 2) * 0.007 * (1 if s > 0 else 0) + math.cos(a + PI / 2) * 0.007 * (0 if s > 0 else 1) * 0,
                                                wc.y, 0.025), rot=(PI / 2, 0, a), seg=24, mat=nylon, bev=0.004)
hub = H.lathe('hub', [(0.0, 0.10), (0.045, 0.10), (0.05, 0.12), (0.048, 0.15), (0.03, 0.16), (0.0, 0.16)], 40, alu)
H.cyl('lift_cover', 0.026, 0.13, loc=(0, 0, 0.155), seg=32, mat=plastic, bev=0.003)
H.cyl('lift_chrome', 0.014, 0.10, loc=(0, 0, 0.28), seg=24, mat=chrome)
# ---- mechanism + seat
H.box_minmax('mechanism', (-0.09, -0.12, 0.36), (0.09, 0.12, 0.405), mat=plastic, bev=0.01, seg=3)
H.tube('tilt_lever', [V((0.09, -0.02, 0.385)), V((0.18, -0.03, 0.385)), V((0.2, -0.06, 0.382))], 0.006, 10, plastic)
H.cyl('tension_knob', 0.03, 0.03, loc=(0, -0.12, 0.38), rot=(PI / 2, 0, 0), seg=24, mat=plastic, bev=0.005)
H.box_minmax('seat_shell', (-0.215, -0.19, 0.402), (0.215, 0.205, 0.425), mat=plastic, bev=0.012, seg=3)
SW, SD, ST = 0.50, 0.48, 0.075
def seat_z(xx, yy, zz):
    wf = max(0.0, (-yy - 0.12) / 0.12)          # waterfall front
    dish = 0.012 * max(0, 1 - (2 * xx / SW) ** 2) * max(0, 1 - (2 * (yy + 0.03) / SD) ** 2)
    z = zz - 0.03 * wf ** 2 * (1 if zz > -0.02 else 0.4)
    return z - (dish if zz > 0 else 0)
seat = H.superellipsoid('seat', SW / 2, SD / 2, ST / 2, e=5, n=3.0, nu=80, nv=16, mat=fabric, zfn=seat_z)
seat.location = (0, -0.01, 0.42 + ST / 2 - 0.004)
H.uv_box(seat, 0.12)
# ---- back: S-curved surface
BW = 0.46
Zb0, Zb1 = 0.56, 1.10
def back_pt(xx, zz):
    t = (zz - Zb0) / (Zb1 - Zb0)
    yy = 0.20 + (zz - Zb0) * 0.22 - 0.035 * math.exp(-((zz - 0.68) / 0.09) ** 2)   # recline + lumbar bulge
    yy -= 0.07 * (xx / (BW / 2)) ** 2                                               # wraps around the sitter
    return V((xx, yy, zz))
rr = H.rrect2d(BW, Zb1 - Zb0, 0.06, 6)
fpath = [back_pt(px, (Zb0 + Zb1) / 2 + pz) for px, pz in rr]
frame = H.sweep('back_frame', fpath, [(p[0], p[1]) for p in H.rrect2d(0.022, 0.032, 0.009, 3)], plastic, closed=True, up=(0, 1, 0))
nx, nz = 22, 30
vs, fs, uvs = [], [], []
for j in range(nz + 1):
    for i in range(nx + 1):
        xx = -BW / 2 + 0.008 + (BW - 0.016) * i / nx
        zz = Zb0 + 0.008 + (Zb1 - Zb0 - 0.016) * j / nz
        vs.append(tuple(back_pt(xx, zz)))
for j in range(nz):
    for i in range(nx):
        a = j * (nx + 1) + i
        fs.append((a, a + 1, a + nx + 2, a + nx + 1))
mesh = H.obj('back_mesh', vs, fs, meshm)
H.uv_planar(mesh, 0.04, axis='Y')
# lumbar pad behind the mesh
lp = [back_pt(x_, 0.70) + V((0, 0.03, 0)) for x_ in np.linspace(-0.17, 0.17, 12)]
H.sweep('lumbar', lp, [(p[1], p[0]) for p in H.rrect2d(0.018, 0.07, 0.008, 3)], plastic, caps=True, up=(0, 0, 1))
# spine
sp = [V((0, 0.10, 0.39)), V((0, 0.22, 0.40)), V((0, 0.28, 0.46)), V((0, 0.29, 0.55)), V((0, 0.285, 0.62))]
H.sweep('spine', H.bezier_pts(*sp[:4], 16) + [sp[4]], [(p[0], p[1]) for p in H.rrect2d(0.07, 0.03, 0.012, 3)], plastic, caps=True, up=(0, 1, 0))
# ---- armrests
for s in (-1, 1):
    post = [V((s * 0.12, 0.02, 0.385)), V((s * 0.24, 0.02, 0.39)), V((s * 0.27, 0.03, 0.44)), V((s * 0.27, 0.035, 0.63))]
    H.sweep('arm_post', H.bezier_pts(*post, 14), [(p[0], p[1]) for p in H.rrect2d(0.022, 0.05, 0.009, 3)], plastic, caps=True, up=(0, 1, 0))
    pad = H.superellipsoid('arm_pad', 0.042, 0.125, 0.016, e=4, n=3, nu=40, nv=10, mat=pu)
    pad.location = (s * 0.27, 0.0, 0.648)
H.finish('office_chair', extras={'texres': 1024})
