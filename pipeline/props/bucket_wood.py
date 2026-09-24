# Coopered oak bucket (0.3 m dia, 0.28 m): staves, two dark iron hoops, rope handle.
import sys, os; sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import helpers as H, _p04kit as K
from helpers import V, PI
import math, numpy as np
H.reset()
w = K.wood('oak_bucket', '#a77b4f', '#8d653e', '#6a4a2c', 0.8, seed=41)
iron = K.painted('iron_black', '#262422', 0.6, 0.6)
n = 16
for i in range(n):
    a0 = 2 * PI * i / n; a1 = 2 * PI * (i + 0.95) / n
    prof = []
    st = H.lathe('stave', [(0.13, 0.0), (0.15, 0.28), (0.138, 0.28), (0.118, 0.0)], 4, w, arc=a1 - a0, close=False)
    st.rotation_euler = (0, 0, a0); H.uv_cyl(st, 0.3)
H.cyl('bottom', 0.12, 0.02, loc=(0, 0, 0.02), seg=24, mat=w)
for z, r in ((0.05, 0.1345), (0.22, 0.1475)):
    H.lathe('hoop', [(r, z), (r + 0.004, z), (r + 0.004, z + 0.025), (r, z + 0.025)], 32, iron)
H.tube('rope', [V((-0.15, 0, 0.24))] + [V((-0.15 * math.cos(t), 0, 0.24 + 0.12 * math.sin(t))) for t in np.linspace(0.1, PI - 0.1, 10)] + [V((0.15, 0, 0.24))], 0.007, 8, mat=K.fabric('rope', '#b39f7a'))
H.finish('bucket_wood')
