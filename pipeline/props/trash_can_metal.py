# Galvanised steel dustbin 0.48 m dia x 0.68 m with ribbed body, domed lid with handle, side handles.
import sys, os; sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import helpers as H, _p04kit as K
from helpers import V, PI
import math, numpy as np
H.reset()
g = K.galvanized()
prof = [(0, 0), (0.2, 0), (0.205, 0.01)]
for i in range(6):
    z = 0.03 + i * 0.1
    prof += [(0.212 + i * 0.003, z), (0.22 + i * 0.003, z + 0.02), (0.212 + i * 0.003, z + 0.04)]
prof += [(0.232, 0.62), (0.232, 0.625), (0.226, 0.625), (0.226, 0.03), (0, 0.03)]
H.lathe('can', prof, 40, g)
H.lathe('lid', [(0, 0.69), (0.08, 0.685), (0.2, 0.655), (0.245, 0.63), (0.245, 0.615), (0.235, 0.615), (0, 0.65)], 40, g)
H.tube('lidhandle', [V((-0.07, 0, 0.685)), V((-0.06, 0, 0.72)), V((0.06, 0, 0.72)), V((0.07, 0, 0.685))], 0.009, 8, mat=g)
for sx in (-1, 1): H.tube('side', [V((sx * 0.23, -0.06, 0.52)), V((sx * 0.27, -0.05, 0.52)), V((sx * 0.27, 0.05, 0.52)), V((sx * 0.23, 0.06, 0.52))], 0.008, 8, mat=g)
H.finish('trash_can_metal')
