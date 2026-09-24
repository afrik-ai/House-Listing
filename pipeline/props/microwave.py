# Countertop microwave: black glass door with see-through dark window, stainless body, control strip with
# display (emissive clock) and dial. ~0.50 x 0.29 x 0.38 m, front +Z.
import sys; sys.path.insert(0, __import__('os').path.dirname(__import__('os').path.abspath(__file__)))
import helpers as H, _kit as K
from helpers import V, PI
import math, random, numpy as np
H.reset()
st = K.brushed('mw_steel', '#c3c5c7', 0.3); bg = K.plain('mw_glass', '#0d0d0f', 0.08); disp = H.pbr('mw_display', '#101010', 0.3, emit='#5ad07a', emit_str=2.0); blk = K.plain('mw_black', '#161616', 0.45)
W, D, Hh = 0.50, 0.38, 0.29
H.box('body', W, D, Hh, loc=(0, 0, Hh / 2 + 0.01), mat=st, bev=0.008)
H.box('door', W * 0.74, 0.012, Hh - 0.03, loc=(-W * 0.12, -D / 2 - 0.005, Hh / 2 + 0.01), mat=bg, bev=0.004)
H.box('panel', W * 0.22, 0.01, Hh - 0.03, loc=(W * 0.38, -D / 2 - 0.004, Hh / 2 + 0.01), mat=blk, bev=0.003)
H.box('display', 0.07, 0.002, 0.022, loc=(W * 0.38, -D / 2 - 0.01, Hh - 0.04), mat=disp)
H.cyl('dial', 0.022, 0.018, loc=(W * 0.38, -D / 2 - 0.01, Hh * 0.45), rot=(PI / 2, 0, 0), seg=24, mat=st, bev=0.004)
for i in range(4): H.box('btn', 0.03, 0.004, 0.012, loc=(W * 0.38, -D / 2 - 0.01, Hh - 0.08 - i * 0.022), mat=st, bev=0.002, seg=1)
for sx in (-1, 1):
    for sy in (-1, 1): H.cyl('foot', 0.012, 0.01, loc=(sx * (W / 2 - 0.04), sy * (D / 2 - 0.04), 0), seg=12, mat=blk)
H.finish('microwave', extras={'texres': 512})
