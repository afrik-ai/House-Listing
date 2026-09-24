# Two-wheel hand truck (sack barrow) 0.5 x 1.2 x 0.45 m: red tubular steel frame, toe plate, pneumatic wheels.
import sys, os; sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import helpers as H, _p04kit as K
from helpers import V, PI
import math, numpy as np
H.reset()
red = K.painted('truck_red', '#b0231c', 0.4, 0.4)
for sx in (-1, 1):
    H.tube('rail', [V((sx * 0.18, 0.0, 0.05)), V((sx * 0.18, 0.02, 1.0)), V((sx * 0.14, 0.06, 1.18))], 0.013, 10, mat=red)
K.rod('grip', (-0.14, 0.06, 1.18), (0.14, 0.06, 1.18), 0.014, K.rubber())
for z in (0.35, 0.65, 0.95): K.rod('cross', (-0.18, 0.01, z), (0.18, 0.01, z), 0.009, red)
H.box('toe', 0.38, 0.22, 0.008, loc=(0, -0.11, 0.004), mat=K.steel())
K.rod('axle', (-0.24, 0.08, 0.13), (0.24, 0.08, 0.13), 0.01, K.steel())
for sx in (-1, 1):
    H.lathe('tyre', [(0.08, -0.03), (0.115, -0.035), (0.13, 0), (0.115, 0.035), (0.08, 0.03)], 32, K.rubber(), loc=(sx * 0.22, 0.08, 0.13), rot=(0, PI / 2, 0))
    H.cyl('hub', 0.06, 0.05, loc=(sx * 0.22 - 0.025, 0.08, 0.13), rot=(0, PI / 2, 0), seg=20, mat=K.painted('hub_grey', '#8c8c8c', 0.5, 0.5))
H.finish('hand_truck')
