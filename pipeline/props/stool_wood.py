# Simple beech work stool: round 0.32 m seat at 0.46 m, four splayed legs, rung ring.
import sys, os; sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import helpers as H, _p04kit as K
from helpers import V, PI
import math, numpy as np
H.reset()
w = K.wood('beech', '#d6b48a', '#c5a074', '#a98458', 0.65, seed=51)
s = H.cyl('seat', 0.16, 0.03, loc=(0, 0, 0.43), seg=40, mat=w, bev=0.008); H.uv_planar(s, 0.4)
for i in range(4):
    a = PI / 4 + i * PI / 2
    l = K.rod('leg', (math.cos(a) * 0.19, math.sin(a) * 0.19, 0), (math.cos(a) * 0.1, math.sin(a) * 0.1, 0.43), 0.017, w, 12); H.uv_cyl(l, 0.3)
    b = a + PI / 2
    K.rod('rung', (math.cos(a) * 0.162, math.sin(a) * 0.162, 0.15), (math.cos(b) * 0.162, math.sin(b) * 0.162, 0.15), 0.01, w, 8)
H.finish('stool_wood')
