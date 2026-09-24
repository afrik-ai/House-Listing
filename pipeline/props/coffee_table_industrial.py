# Industrial coffee table: reclaimed pine plank top (3 planks, gaps, nail heads) on black steel X-frame. 1.1 x 0.6 x 0.45 m
import sys; sys.path.insert(0, __import__('os').path.dirname(__import__('os').path.abspath(__file__)))
import helpers as H, _kit as K
from helpers import V, PI
import math, random, numpy as np
H.reset()
pine = K.wood('reclaimed_pine', light='#b08658', mid='#936b43', dark='#5e4228', seed=177, rough=0.7)
stl = K.plain('ind_steel', '#1d1d1d', 0.5, 0.8)
W, D, Hh = 1.1, 0.6, 0.45
for i in range(3):
    p = H.box('plank', W, D / 3 - 0.006, 0.04, loc=(0, -D / 3 + i * D / 3, Hh - 0.02), mat=pine, bev=0.005); H.uv_box(p, 1.0, along='x', offset=(i * 0.37, i * 0.21))
    for x in (-W / 2 + 0.05, W / 2 - 0.05):
        H.cyl('nail', 0.004, 0.001, loc=(x, -D / 3 + i * D / 3, Hh), seg=8, mat=stl)
for sx in (-1, 1):
    x = sx * (W / 2 - 0.08)
    H.tube('x1', [V((x, -D / 2 + 0.04, 0.0)), V((x, D / 2 - 0.04, Hh - 0.04))], 0.012, 6, stl)
    H.tube('x2', [V((x, D / 2 - 0.04, 0.0)), V((x, -D / 2 + 0.04, Hh - 0.04))], 0.012, 6, stl)
    H.box('rail', 0.03, D - 0.06, 0.02, loc=(x, 0, Hh - 0.05), mat=stl)
H.box('stretcher', W - 0.16, 0.025, 0.025, loc=(0, 0, Hh / 2 - 0.02), mat=stl)
H.finish('coffee_table_industrial', extras={'texres': 1024})
