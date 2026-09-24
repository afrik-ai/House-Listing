# Classic wooden picnic table with attached benches, 1.8 x 1.5 x 0.75 m, A-frame legs (length along X).
import sys, os; sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import helpers as H, _p04kit as K
from helpers import V, PI
import math, numpy as np
H.reset()
w = K.weathered_wood()
L = 1.8
for i in range(5): K.plank('top', (-L / 2, -0.35 + i * 0.14, 0.72), (L / 2, -0.35 + i * 0.14 + 0.13, 0.76), w, 'x', 0.004)
for sy in (-1, 1):
    for i in range(2): K.plank('bench', (-L / 2, sy * 0.6 - 0.13 + i * 0.13, 0.43), (L / 2, sy * 0.6 - 0.13 + i * 0.13 + 0.12, 0.46), w, 'x', 0.004)
for sx in (-0.6, 0.6):
    for sy in (-1, 1):
        l = H.box('leg', 0.05, 0.1, 0.85, loc=(sx, sy * 0.33, 0.38), mat=w); l.rotation_euler = (sy * 0.55, 0, 0); H.uv_box(l, 1.0, along='z')
    K.plank('cross', (sx - 0.025, -0.75, 0.38), (sx + 0.025, 0.75, 0.43), w, 'y')
    K.plank('ctop', (sx - 0.025, -0.4, 0.66), (sx + 0.025, 0.4, 0.72), w, 'y')
H.finish('picnic_table')
