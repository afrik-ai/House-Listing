# Oscillating lawn sprinkler 0.36 x 0.1 x 0.12 m: green plastic sled base, aluminium spray bar with nozzles.
import sys, os; sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import helpers as H, _p04kit as K
from helpers import V, PI
import math, numpy as np
H.reset()
g = K.plastic('sprinkler_green', '#3b8a3a', 0.5)
al = K.steel('alu_bar', '#c3c7ca', 0.3)
for sy in (-1, 1): K.rod('skid', (-0.17, sy * 0.045, 0.01), (0.17, sy * 0.045, 0.01), 0.01, g)
H.box('housing', 0.08, 0.1, 0.06, loc=(-0.12, 0, 0.04), mat=g, bev=0.01)
H.box('end', 0.02, 0.1, 0.06, loc=(0.16, 0, 0.04), mat=g, bev=0.006)
H.tube('bar', [V((-0.12, 0, 0.09)), V((0.0, 0, 0.115)), V((0.16, 0, 0.09))], 0.008, 10, mat=al)
for i in range(12): H.cyl('noz', 0.0025, 0.01, loc=(-0.1 + i * 0.022, 0, 0.1 + 0.02 * math.sin(PI * (i + 1) / 13)), seg=6, mat=K.rubber())
H.cyl('inlet', 0.012, 0.04, loc=(-0.16, 0, 0.04), rot=(0, -PI / 2, 0), seg=12, mat=g)
H.finish('garden_sprinkler')
