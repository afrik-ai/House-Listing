# Pair of garden gloves lying flat (0.26 x 0.035 x 0.2 m): green nitrile palms, grey knit backs.
import sys, os; sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import helpers as H, _p04kit as K
from helpers import V, PI
import math, numpy as np
H.reset()
knit = K.fabric('glove_knit', '#8d9094')
nit = K.plastic('glove_nitrile', '#3f7a3a', 0.45)
def glove(ox, oy, rot, name):
    parts = []
    parts.append(H.superellipsoid(name + 'palm', 0.05, 0.065, 0.012, e=3, n=2.5, nu=24, nv=8, mat=knit, loc=(0, 0, 0.012)))
    parts.append(H.superellipsoid(name + 'cuff', 0.048, 0.035, 0.013, e=4, n=2.5, nu=20, nv=6, mat=K.fabric('glove_cuff', '#3f7a3a'), loc=(0, -0.09, 0.013)))
    for i, (x, L) in enumerate([(-0.036, 0.06), (-0.012, 0.075), (0.012, 0.072), (0.034, 0.062)]):
        parts.append(K.rod(name + 'f', (x, 0.05, 0.01), (x * 1.2, 0.05 + L, 0.01), 0.011, nit, 10))
    parts.append(K.rod(name + 'th', (0.05, 0.0, 0.01), (0.1, 0.05, 0.01), 0.012, nit, 10))
    for p in parts:
        H.xform_about([p], (0, 0, 0), (0, 0, rot))
        p.location = V(tuple(p.location)) + V((ox, oy, 0))
    return parts
glove(-0.05, 0, 0.2, 'l'); glove(0.07, 0.02, -0.4, 'r')
H.finish('garden_gloves')
