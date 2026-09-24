# Glazed ceramic egg planter 0.44 m dia x 0.48 m, deep blue-green reactive glaze, soil-filled.
import sys, os; sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import helpers as H, _p04kit as K
from helpers import V, PI
import math, numpy as np
H.reset()
import _p04veg as G
gl = H.pbr('glaze_teal', '#2f5e62', 0.18, spec=0.6, coat=0.6)
p = H.lathe('pot', [(0, 0), (0.12, 0), (0.18, 0.05), (0.215, 0.18), (0.22, 0.3), (0.2, 0.42), (0.17, 0.48), (0.155, 0.48), (0.17, 0.42), (0.19, 0.3), (0.12, 0.05), (0, 0.05)], 48, gl)
H.cyl('soil', 0.165, 0.004, loc=(0, 0, 0.45), seg=32, mat=K.soil())
H.finish('planter_ceramic')
