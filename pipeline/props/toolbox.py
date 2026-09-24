# Red steel cantilever toolbox 0.5 x 0.24 x 0.24 m: lid with folding carry handle, two latches. Length along X.
import sys, os; sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import helpers as H, _p04kit as K
from helpers import V, PI
import math, numpy as np
H.reset()
red = K.painted('toolbox_red', '#b52019', 0.35, 0.35)
st = K.steel()
H.box('body', 0.5, 0.22, 0.16, loc=(0, 0, 0.08), mat=red, bev=0.006)
lid = H.box('lid', 0.505, 0.225, 0.06, loc=(0, 0, 0.19), mat=red, bev=0.01)
H.box('seam', 0.508, 0.228, 0.004, loc=(0, 0, 0.16), mat=K.painted('slot_dark', '#1a1a1a', 0.8))
for sx in (-1, 1):
    H.box('latch', 0.03, 0.01, 0.05, loc=(sx * 0.17, -0.117, 0.155), mat=st, bev=0.002)
    K.rod('hpost', (sx * 0.12, 0, 0.22), (sx * 0.12, 0, 0.245), 0.006, st)
K.rod('handle', (-0.12, 0, 0.245), (0.12, 0, 0.245), 0.011, K.rubber())
H.finish('toolbox')
