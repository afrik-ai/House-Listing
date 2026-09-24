# Cedar-plank planter box 0.8 x 0.5 x 0.5 m with corner posts and top cap, soil-filled.
import sys, os; sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import helpers as H, _p04kit as K
from helpers import V, PI
import math, numpy as np
H.reset()
w = K.wood('cedar', '#b27a52', '#9a6443', '#744a31', 0.75, seed=71)
W, D, Hh = 0.8, 0.5, 0.5
for i in range(4):
    z = i * 0.115
    for sy in (-1, 1): K.plank('b', (-W / 2, min(sy * D / 2, sy * (D / 2 - 0.02)), z), (W / 2, max(sy * D / 2, sy * (D / 2 - 0.02)), z + 0.11), w, 'x')
    for sx in (-1, 1): K.plank('b', (min(sx * W / 2, sx * (W / 2 - 0.02)), -D / 2 + 0.02, z), (max(sx * W / 2, sx * (W / 2 - 0.02)), D / 2 - 0.02, z + 0.11), w, 'y')
for sy in (-1, 1): K.plank('cap', (-W / 2 - 0.02, min(sy * (D / 2 + 0.02), sy * (D / 2 - 0.04)), Hh - 0.04), (W / 2 + 0.02, max(sy * (D / 2 + 0.02), sy * (D / 2 - 0.04)), Hh), w, 'x')
for sx in (-1, 1): K.plank('cap', (min(sx * (W / 2 + 0.02), sx * (W / 2 - 0.04)), -D / 2 + 0.04, Hh - 0.04), (max(sx * (W / 2 + 0.02), sx * (W / 2 - 0.04)), D / 2 - 0.04, Hh), w, 'y')
H.box('soil', W - 0.04, D - 0.04, 0.01, loc=(0, 0, Hh - 0.07), mat=K.soil(), uv=0.4)
H.finish('planter_box_02')
