# Steel jerrycan 20 l (0.35 x 0.47 x 0.165 m): olive-green, X-pressed sides, triple top handle, spout cap.
import sys, os; sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import helpers as H, _p04kit as K
from helpers import V, PI
import math, numpy as np
H.reset()
gr = K.painted('jerry_green', '#4b5a33', 0.5, 0.3)
b = H.box('body', 0.35, 0.165, 0.43, loc=(0, 0, 0.215), mat=gr, bev=0.02, seg=3)
for sy in (-1, 1):
    for s in (-1, 1):
        x = H.box('x', 0.42, 0.012, 0.03, loc=(0, sy * 0.083, 0.215), mat=gr, bev=0.004); x.rotation_euler = (0, s * 0.9, 0)
for i in (-1, 0, 1): H.box('handle', 0.02, 0.03, 0.05, loc=(0.06 + i * 0.05, 0, 0.455), mat=gr, bev=0.005)
H.box('hbar', 0.14, 0.03, 0.015, loc=(0.06, 0, 0.475), mat=gr, bev=0.005)
H.cyl('spout', 0.024, 0.05, loc=(-0.12, 0, 0.42), seg=16, mat=gr, rot=(0, -0.5, 0))
H.finish('jerrycan')
