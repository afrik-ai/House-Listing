# Modular street / garden seating: two cast-concrete blocks carrying a hardwood slat seat, 2.0 x 0.5 x 0.46 m.
import sys, os; sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import helpers as H, _p04kit as K
from helpers import V, PI
import math, numpy as np
H.reset()
con = K.concrete()
w = K.wood('bench_iroko', '#9a6b43', '#835a37', '#62432a', 0.65, seed=91)
for sx in (-1, 1): H.box('block', 0.4, 0.5, 0.4, loc=(sx * 0.7, 0, 0.2), mat=con, bev=0.01, uv=0.6)
for i in range(6):
    y = -0.24 + i * 0.08
    K.plank('slat', (-1.0, y, 0.4), (1.0, y + 0.065, 0.46), w, 'x', 0.004)
H.finish('outdoor_bench_modular')
