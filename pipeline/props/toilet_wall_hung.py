# Wall-hung rimless WC (white ceramic, slim soft-close seat, lid closed) + matte-black dual flush plate.
# FLOOR-REFERENCED: y=0 is the finished floor (bowl floats 0.10 m above it); back face (-Z in glTF) goes to the wall.
import sys; sys.path.insert(0, 'C:/Users/Owner/HouseListing/pipeline/props')
import helpers as H
from helpers import V, PI
import math, numpy as np, bpy

H.reset()
ceramic = H.pbr('ceramic_white', '#f4f4f2', 0.08, spec=0.6)
seat_m = H.pbr('seat_white', '#f2f2f0', 0.22)
chrome = H.pbr('chrome', '#e0e0e0', 0.08, 1.0)
plate = H.pbr('flush_plate_black', '#181818', 0.4, 0.7)
btn = H.pbr('flush_button_black', '#222222', 0.3, 0.7)

YW = 0.27  # wall plane (Blender +Y = back)
def outline(a, yf, z, yb=YW, nf=2.3, nb=7.0, cnt=64):
    """Plan outline: superellipse front half (towards -Y), squarer back half (towards the wall)."""
    yc = (yf + yb) / 2; hf = (yb - yf) / 2
    pts = []
    for i in range(cnt):
        t = 2 * PI * i / cnt
        c, s = math.cos(t), math.sin(t)
        n = nf if s < 0 else nb
        x = a * math.copysign(abs(c) ** (2 / n), c)
        y = yc + hf * math.copysign(abs(s) ** (2 / n), s)
        pts.append(V((x, y, z)))
    return pts

rings = [outline(0.095, 0.03, 0.10), outline(0.14, -0.09, 0.14), outline(0.165, -0.21, 0.22), outline(0.178, -0.258, 0.32),
         outline(0.180, -0.27, 0.378), outline(0.177, -0.267, 0.395), outline(0.168, -0.258, 0.400)]
bowl = H.loft('bowl', rings, ceramic, cap0=True, cap1=True)
H.subsurf(bowl, 2)
# seat ring and lid (closed)
def slab(name, a, yf, yb, z0, z1, mat, r=0.004):
    rs = [outline(a - r, yf + r, z0, yb - r), outline(a, yf, z0 + r, yb), outline(a, yf, z1 - r, yb), outline(a - r * 1.5, yf + r * 1.5, z1, yb - r * 1.5)]
    o = H.loft(name, rs, mat, cap0=True, cap1=True)
    H.subsurf(o, 1)
    return o
slab('seat', 0.176, -0.268, 0.235, 0.401, 0.417, seat_m, 0.005)
slab('lid', 0.178, -0.272, 0.232, 0.4185, 0.437, seat_m, 0.007)
# hinges
for x in (-0.075, 0.075):
    H.cyl('hinge', 0.011, 0.034, loc=(x - 0.017, 0.245, 0.418), rot=(0, PI / 2, 0), seg=24, mat=chrome, bev=0.003)
    H.box('hinge_block', 0.03, 0.03, 0.012, loc=(x, 0.252, 0.404), mat=chrome, bev=0.004, seg=2)
# dual flush plate at 1.0 m on the wall
pz = 1.0
H.box('plate', 0.247, 0.006, 0.164, loc=(0, YW - 0.003, pz), mat=plate, bev=0.0025, seg=3)
H.box('btn_big', 0.150, 0.004, 0.140, loc=(0.035, YW - 0.0075, pz), mat=btn, bev=0.002, seg=3)
H.box('btn_small', 0.05, 0.004, 0.140, loc=(-0.075, YW - 0.0075, pz), mat=btn, bev=0.002, seg=3)
H.finish('toilet_wall_hung', floor_ref=True)
