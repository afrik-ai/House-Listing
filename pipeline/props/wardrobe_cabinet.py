# Two-door oak wardrobe with panelled (raised centre, recessed frame) doors, long brass pulls, plinth + cornice.
# ~1.10 x 0.60 x 2.10 m, front +Z.
import sys; sys.path.insert(0, __import__('os').path.dirname(__import__('os').path.abspath(__file__)))
import helpers as H, _kit as K
from helpers import V, PI
import math, random, numpy as np
H.reset()
oak = K.wood('ward_oak', seed=96); br = K.brushed('ward_brass', '#c19a55', 0.3); void = K.plain('ward_void', '#130d08', 0.9)
W, D, Hh = 1.10, 0.60, 2.10
H.uv_box(H.box('carcass', W, D, Hh - 0.1, loc=(0, 0, 0.08 + (Hh - 0.1) / 2), mat=oak, bev=0.003), 1.0, along='z')
H.box('plinth', W - 0.04, D - 0.04, 0.08, loc=(0, 0.01, 0.04), mat=void)
H.uv_box(H.box('cornice', W + 0.04, D + 0.03, 0.05, loc=(0, -0.015, Hh - 0.025), mat=oak, bev=0.008), 1.0, along='x')
H.box('split', 0.004, 0.004, Hh - 0.2, loc=(0, -D / 2 - 0.001, 0.08 + (Hh - 0.1) / 2), mat=void)
for s in (-1, 1):
    x = s * W / 4
    dw, dh = W / 2 - 0.03, Hh - 0.2
    zc = 0.08 + (Hh - 0.1) / 2
    for (sx, sz, lx, lz) in ((dw, 0.08, 0, dh / 2 - 0.04), (dw, 0.08, 0, -dh / 2 + 0.04), (0.08, dh - 0.16, dw / 2 - 0.04, 0), (0.08, dh - 0.16, -dw / 2 + 0.04, 0)):
        H.uv_box(H.box('stile', sx, 0.022, sz, loc=(x + lx, -D / 2 - 0.011, zc + lz), mat=oak, bev=0.004, seg=2), 1.0, along='z' if sz > sx else 'x')
    H.uv_box(H.box('panel', dw - 0.17, 0.014, dh - 0.17, loc=(x, -D / 2 - 0.009, zc), mat=oak, bev=0.012, seg=3), 1.0, along='z')
    H.cyl('pull', 0.007, 0.3, loc=(-s * 0.035, -D / 2 - 0.04, zc - 0.15), seg=12, mat=br, bev=0.002)
    for z in (zc - 0.12, zc + 0.12): H.cyl('post', 0.004, 0.022, loc=(-s * 0.035, -D / 2 - 0.018, z), rot=(PI / 2, 0, 0), seg=8, mat=br)
H.finish('wardrobe_cabinet', extras={'texres': 1024})
