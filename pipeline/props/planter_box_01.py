# Corten-steel raised planter box 1.2 x 0.4 x 0.45 m (weathered rust), soil-filled. Length along X.
import sys, os; sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import helpers as H, _p04kit as K
from helpers import V, PI
import math, numpy as np
H.reset()
c = K.corten()
W, D, Hh, t = 1.2, 0.4, 0.45, 0.006
for sy in (-1, 1): H.box('side', W, t, Hh, loc=(0, sy * (D / 2 - t / 2), Hh / 2), mat=c, uv=0.8)
for sx in (-1, 1): H.box('end', t, D - 2 * t, Hh, loc=(sx * (W / 2 - t / 2), 0, Hh / 2), mat=c, uv=0.8)
H.box('lip', W + 0.02, D + 0.02, 0.012, loc=(0, 0, Hh), mat=c, uv=0.8)
H.box('soil', W - 0.02, D - 0.02, 0.01, loc=(0, 0, Hh - 0.03), mat=K.soil(), uv=0.4)
H.finish('planter_box_01')
