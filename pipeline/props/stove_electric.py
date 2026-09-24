# Freestanding electric range 60 cm: black ceramic hob with 4 printed zones, stainless body, oven door with
# glass window + bar handle, 5 knobs. ~0.60 x 0.60 x 0.90 m, front +Z.
import sys; sys.path.insert(0, __import__('os').path.dirname(__import__('os').path.abspath(__file__)))
import helpers as H, _kit as K
from helpers import V, PI
import math, random, numpy as np
H.reset()
st = K.brushed('stove_steel', '#c6c8ca', 0.3); hob = K.plain('stove_hob', '#0c0c0d', 0.1, coat=0.8); zone = K.plain('stove_zone', '#3a3a3c', 0.3)
bg = K.plain('stove_glass', '#101012', 0.08); blk = K.plain('stove_black', '#141414', 0.4)
W, D, Hh = 0.60, 0.60, 0.90
H.box('body', W, D, Hh - 0.01, loc=(0, 0, (Hh - 0.01) / 2), mat=st, bev=0.004)
H.box('hob', W - 0.01, D - 0.01, 0.008, loc=(0, 0, Hh - 0.004), mat=hob, bev=0.003)
for (x, y, r) in ((-0.14, -0.12, 0.09), (0.14, -0.12, 0.07), (-0.14, 0.13, 0.07), (0.14, 0.13, 0.1)):
    H.lathe('zone', [(r - 0.004, Hh + 0.0002), (r, Hh + 0.0002), (r, Hh + 0.0004), (r - 0.004, Hh + 0.0004)], 40, zone, loc=(x, y, 0))
H.box('door', W - 0.02, 0.02, 0.56, loc=(0, -D / 2 - 0.01, 0.38), mat=st, bev=0.004)
H.box('window', W - 0.14, 0.004, 0.3, loc=(0, -D / 2 - 0.021, 0.38), mat=bg)
H.tube('handle', [V((-0.22, -D / 2 - 0.02, 0.62)), V((-0.22, -D / 2 - 0.05, 0.62)), V((0.22, -D / 2 - 0.05, 0.62)), V((0.22, -D / 2 - 0.02, 0.62))], 0.009, 10, st)
H.box('fascia', W - 0.02, 0.01, 0.1, loc=(0, -D / 2 - 0.004, 0.8), mat=blk, bev=0.003)
for i in range(5): H.cyl('knob', 0.02, 0.022, loc=(-0.2 + i * 0.1, -D / 2 - 0.009, 0.8), rot=(PI / 2, 0, 0), seg=24, mat=st, bev=0.004)
H.box('drawer', W - 0.02, 0.018, 0.08, loc=(0, -D / 2 - 0.008, 0.05), mat=blk, bev=0.003)
H.finish('stove_electric', extras={'texres': 512})
