# Push broom 1.4 m: 0.45 m wooden stock with stiff black bristles, painted steel handle + bracket. Standing, head down.
import sys, os; sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import helpers as H, _p04kit as K
from helpers import V, PI
import math, numpy as np
H.reset()
w = K.wood('broom_stock', '#b8905f', '#a47d4f', '#7e5c38', 0.7, seed=63)
K.plank('stock', (-0.225, -0.03, 0.08), (0.225, 0.03, 0.13), w, 'x')
br = K.plastic('bristle', '#161616', 0.8)
H.box('bristles', 0.44, 0.05, 0.08, loc=(0, 0, 0.04), mat=br)
h = H.cyl('handle', 0.012, 1.3, loc=(0, 0, 0.13), seg=12, mat=K.painted('broom_red', '#b3261e', 0.4, 0.3))
H.box('brkt', 0.08, 0.04, 0.03, loc=(0, 0, 0.145), mat=K.steel())
H.finish('broom')
