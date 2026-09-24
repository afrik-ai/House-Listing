# Slatted pine crate 0.6 x 0.4 x 0.36 m (open top), corner posts, three slats per side.
import sys, os; sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import helpers as H, _p04kit as K
from helpers import V, PI
import math, numpy as np
H.reset()
w = K.wood('pine', '#d2b183', '#c19d6d', '#a47e50', 0.8, seed=31)
W, D, Hh = 0.6, 0.4, 0.36
for sx in (-1, 1):
    for sy in (-1, 1):
        x0 = sx * (W / 2 - 0.013); x1 = x0 - sx * 0.035; y0 = sy * (D / 2 - 0.013); y1 = y0 - sy * 0.035
        K.plank('post', (min(x0, x1), min(y0, y1), 0), (max(x0, x1), max(y0, y1), Hh), w, 'z')
for i in range(3):
    z0 = 0.01 + i * 0.12
    for sy in (-1, 1): K.plank('slat', (-W / 2, min(sy * D / 2, sy * D / 2 - sy * 0.012), z0), (W / 2, max(sy * D / 2, sy * D / 2 - sy * 0.012), z0 + 0.09), w, 'x')
    for sx in (-1, 1): K.plank('slat', (min(sx * W / 2, sx * W / 2 - sx * 0.012), -D / 2 + 0.035, z0), (max(sx * W / 2, sx * W / 2 - sx * 0.012), D / 2 - 0.035, z0 + 0.09), w, 'y')
for i in range(4): K.plank('floor', (-W / 2 + 0.02, -D / 2 + 0.02 + i * 0.09, 0.0), (W / 2 - 0.02, -D / 2 + 0.1 + i * 0.09, 0.012), w, 'x')
H.finish('crate_wood')
