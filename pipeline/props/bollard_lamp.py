# Garden bollard light 0.8 m: anthracite aluminium square post (0.12 m), frosted light window near the top
# (emissive, reads at night), cap plate. Light faces +Z.
import sys, os; sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import helpers as H, _p04kit as K
from helpers import V, PI
import math, numpy as np
H.reset()
al = K.painted('bollard_anthracite', '#2f3134', 0.45, 0.6)
H.box('post', 0.12, 0.12, 0.62, loc=(0, 0, 0.31), mat=al, bev=0.004)
H.box('window', 0.1, 0.1, 0.12, loc=(0, 0, 0.68), mat=K.emissive('bollard_led', '#fff0d8', 3.0))
for sx in (-1, 1):
    for sy in (-1, 1): H.box('mullion', 0.012, 0.012, 0.12, loc=(sx * 0.054, sy * 0.054, 0.68), mat=al)
H.box('cap', 0.13, 0.13, 0.04, loc=(0, 0, 0.76), mat=al, bev=0.004)
H.box('base', 0.16, 0.16, 0.02, loc=(0, 0, 0.01), mat=al, bev=0.003)
H.finish('bollard_lamp')
