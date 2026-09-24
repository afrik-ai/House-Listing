# Straight wooden ladder 2.4 m, 0.45 m wide, 8 round rungs. Built standing (use rotY / lean in placement).
import sys, os; sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import helpers as H, _p04kit as K
from helpers import V, PI
import math, numpy as np
H.reset()
w = K.weathered_wood('ladder_wood')
for sx in (-1, 1): K.plank('rail', (sx * 0.225 - 0.025, -0.035, 0), (sx * 0.225 + 0.025, 0.035, 2.4), w, 'z')
for i in range(8):
    z = 0.25 + i * 0.29
    r = K.rod('rung', (-0.2, 0, z), (0.2, 0, z), 0.016, w, 10); H.uv_cyl(r, 0.3)
H.finish('ladder_wood')
