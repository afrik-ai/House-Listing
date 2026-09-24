# Classic walnut nightstand: 2 drawers with round brass knobs, bevelled top, turned legs. ~0.50 x 0.40 x 0.62 m, front +Z.
import sys; sys.path.insert(0, __import__('os').path.dirname(__import__('os').path.abspath(__file__)))
import helpers as H, _kit as K
from helpers import V, PI
import math, random, numpy as np
H.reset()
w = K.wood('ns_walnut', light='#8a6246', mid='#6f4c34', dark='#4a3122', seed=92, coat=0.2); br = K.brushed('ns_brass', '#c49c52', 0.28); void = K.plain('ns_void', '#140e09', 0.9)
W, D = 0.50, 0.40
K.drawer_case(W, D, 0.40, 2, 1, w, w, br, void, z0=0.22, knob=True)
for sx in (-1, 1):
    for sy in (-1, 1):
        H.lathe('leg', [(0.0, 0.0), (0.014, 0.0), (0.018, 0.03), (0.013, 0.09), (0.02, 0.15), (0.022, 0.22), (0.0, 0.22)], 16, w, loc=(sx * (W / 2 - 0.03), sy * (D / 2 - 0.03), 0))
H.finish('nightstand_classic', extras={'texres': 1024})
