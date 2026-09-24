# Hand trowel 0.31 m: pointed stainless blade, ash-wood handle with hang hole. Lies flat, tip +X.
import sys, os; sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import helpers as H, _p04kit as K
from helpers import V, PI
import math, numpy as np
H.reset()
st = K.steel()
w = K.wood('ash_handle', '#c9a878', '#b8966a', '#9a7a52', 0.6, seed=61)
bl = H.extrude_poly('blade', [(0.0, -0.035), (0.08, -0.04), (0.15, -0.02), (0.18, 0.0), (0.15, 0.02), (0.08, 0.04), (0.0, 0.035)], 0.004, 0.006, mat=st)
bl.location = (0.02, 0, 0)
for v in bl.data.vertices: v.co.z += 0.01 * (abs(v.co.y) / 0.04)
K.rod('neck', (-0.02, 0, 0.016), (0.03, 0, 0.006), 0.006, st, 8)
h = K.rod('handle', (-0.14, 0, 0.018), (-0.02, 0, 0.018), 0.016, w, 14); H.uv_cyl(h, 0.2)
H.finish('trowel')
