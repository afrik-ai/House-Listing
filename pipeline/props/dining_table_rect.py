# Rectangular oak dining table 2.0 x 0.95 m, 40 mm top with eased edges, trestle legs with stretcher. ~0.75 m tall.
import sys; sys.path.insert(0, __import__('os').path.dirname(__import__('os').path.abspath(__file__)))
import helpers as H, _kit as K
from helpers import V, PI
import math, random, numpy as np
H.reset()
oak = K.wood('table_oak', seed=77)
blk = K.plain('table_steel', '#1a1a1a', 0.5, 0.6)
W, D, Hh = 2.0, 0.95, 0.75
t = H.box('top', W, D, 0.04, loc=(0, 0, Hh - 0.02), mat=oak, bev=0.006); H.uv_box(t, 1.0, along='x')
for s in (-1, 1):
    x = s * (W / 2 - 0.25)
    H.box('trestle', 0.07, D - 0.2, 0.05, loc=(x, 0, Hh - 0.065), mat=oak, bev=0.004)
    l = H.box('leg', 0.08, 0.08, Hh - 0.09, loc=(x, 0, (Hh - 0.09) / 2), mat=oak, bev=0.006); H.uv_box(l, 1.0, along='z')
    H.box('foot', 0.08, D - 0.25, 0.05, loc=(x, 0, 0.025), mat=oak, bev=0.006)
H.box('stretcher', W - 0.5, 0.04, 0.04, loc=(0, 0, 0.3), mat=blk, bev=0.003)
H.finish('dining_table_rect', extras={'texres': 1024})
