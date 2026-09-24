# Wall-hung oak bathroom vanity (2 drawers, black edge pulls), light quartz top, white ceramic vessel basin,
# tall matte-black mixer, round black-framed mirror above.
# FLOOR-REFERENCED: y=0 is the finished floor (cabinet underside at 0.40 m, top at 0.85 m); back goes to the wall.
import sys; sys.path.insert(0, __import__('os').path.dirname(__import__('os').path.abspath(__file__)))
import helpers as H
from helpers import V, PI
import math, numpy as np, bpy

H.reset()
N = 1024
oc, oh = H.tex_wood(N, seed=71, light='#dcc09a', mid='#c9a678', dark='#a98356', rings=38, warp=0.012, contrast=0.5)
oak_c = H.save_img(oc, 'vanity_oak_c'); oak_n = H.save_img(H.h2n(oh, 0.2), 'vanity_oak_n', True)
oak = H.pbr('oak_veneer', '#ffffff', 0.55, base_tex=oak_c, normal_tex=oak_n, nstr=0.6)
q = H.fnoise(N, 1.2, 1.2, 61); q3 = H.fnoise(N, 60, 60, 63)
spk = np.clip((q - 2.0) * 2, 0, 1) * 0.6
qc = H.colmix(np.clip(0.5 + q3 * 0.15, 0, 1), '#dddbd7', '#e5e3df') * (1 - spk[..., None] * 0.4)
quartz = H.pbr('quartz_light', '#ffffff', 0.3, base_tex=H.save_img(qc, 'vanity_quartz_c'))
ceramic = H.pbr('ceramic_white', '#f5f5f3', 0.08, spec=0.6)
black = H.pbr('matte_black', '#1a1a1a', 0.42, 0.75)
mirror = H.pbr('mirror', '#f2f4f5', 0.02, 1.0)
chrome = H.pbr('chrome', '#dddddd', 0.08, 1.0)

W, D = 1.0, 0.46
YW = D / 2          # wall plane
Z0, ZT = 0.40, 0.83  # cabinet bottom / top of carcass
car = H.box_minmax('carcass', (-W / 2, -D / 2 + 0.02, Z0), (W / 2, YW, ZT), mat=oak)
H.uv_box(car, 1.0, along='x'); H.bevel(car, 0.002, 2)
gap = 0.003
hz = (ZT - Z0 - gap) / 2
for i in range(2):
    z0 = Z0 + i * (hz + gap); z1 = z0 + hz
    f = H.box_minmax(f'drawer{i}', (-W / 2 + 0.0015, -D / 2, z0 + 0.0015), (W / 2 - 0.0015, -D / 2 + 0.019, z1 - 0.0015), mat=oak)
    H.uv_box(f, 1.0, along='x', offset=(0.13 * i, 0.31 * i)); H.bevel(f, 0.0015, 2)
    # black L-profile edge pull on the top edge
    H.box_minmax('pull', (-0.14, -D / 2 - 0.018, z1 - 0.004), (0.14, -D / 2 + 0.006, z1 - 0.001), mat=black, bev=0.0008, seg=2)
    H.box_minmax('pull_lip', (-0.14, -D / 2 - 0.018, z1 - 0.022), (0.14, -D / 2 - 0.015, z1 - 0.001), mat=black, bev=0.0008, seg=2)
top = H.box_minmax('top', (-W / 2, -D / 2 - 0.002, ZT), (W / 2, YW, ZT + 0.02), mat=quartz)
H.uv_box(top, 0.6); H.bevel(top, 0.002, 2)
ZC = ZT + 0.02
# vessel basin (rounded rectangle)
bw, bd, bh, t = 0.52, 0.36, 0.12, 0.009
yb = -0.03
def rr(w, d, r, z):
    return [V((x, y + yb, z)) for x, y in H.rrect2d(w, d, r, 8)]
rings = [rr(bw - 0.03, bd - 0.03, 0.08, ZC), rr(bw - 0.012, bd - 0.012, 0.09, ZC + 0.006), rr(bw, bd, 0.1, ZC + 0.04),
         rr(bw, bd, 0.1, ZC + bh - 0.004), rr(bw - t * 0.5, bd - t * 0.5, 0.1 - t * 0.25, ZC + bh),
         rr(bw - 2 * t, bd - 2 * t, 0.1 - t, ZC + bh - 0.004), rr(bw - 2 * t - 0.004, bd - 2 * t - 0.004, 0.09 - t, ZC + 0.04),
         rr(bw - 0.07, bd - 0.07, 0.07, ZC + 0.016), rr(bw - 0.16, bd - 0.16, 0.05, ZC + 0.012)]
basin = H.loft('basin', rings, ceramic, cap0=True, cap1=True)
H.recalc(basin); H.subsurf(basin, 1)
H.lathe('basin_drain', [(0.0, 0.0), (0.02, 0.0), (0.021, 0.002), (0.017, 0.004), (0.0, 0.005)], 32, chrome, loc=(0, yb, ZC + 0.011))
# tall vessel mixer
tx, ty = 0.0, 0.17
H.lathe('tap_base', [(0.0, 0.0), (0.024, 0.0), (0.024, 0.004), (0.02, 0.01), (0.0, 0.01)], 40, black, loc=(tx, ty, ZC))
H.cyl('tap_body', 0.0155, 0.30, loc=(tx, ty, ZC + 0.008), seg=32, mat=black, bev=0.004)
sp = H.sweep('tap_spout', [V((tx, ty, ZC + 0.27)), V((tx, ty - 0.12, ZC + 0.27)), V((tx, ty - 0.165, ZC + 0.27))],
             [(p[0], p[1]) for p in H.rrect2d(0.022, 0.03, 0.009, 4)], black, caps=True, up=(0, 0, 1))
H.bevel(sp, 0.002, 2)
H.cyl('tap_aerator', 0.009, 0.004, loc=(tx, ty - 0.15, ZC + 0.253), seg=20, mat=chrome)
H.cyl('tap_lever_boss', 0.0158, 0.012, loc=(tx, ty, ZC + 0.308), seg=32, mat=black, bev=0.003)
H.tube('tap_lever', [V((tx, ty, ZC + 0.318)), V((tx, ty + 0.03, ZC + 0.33)), V((tx, ty + 0.065, ZC + 0.335))], 0.005, 12, black)
# round mirror, 0.70 m, thin black frame, 2 cm off the wall
mz, mr = 1.48, 0.35
ym = YW - 0.02
frame = H.lathe('mirror_frame', [(mr - 0.004, 0.0), (mr + 0.012, 0.0), (mr + 0.012, 0.025), (mr - 0.004, 0.025)], 96, black,
                loc=(0, YW, mz), rot=(PI / 2, 0, 0))
H.sharpen(frame, 40); H.bevel(frame, 0.0015, 2)
H.cyl('mirror_glass', mr, 0.004, loc=(0, ym + 0.001, mz), rot=(-PI / 2, 0, 0), seg=96, mat=mirror)
H.finish('bathroom_vanity', floor_ref=True)
