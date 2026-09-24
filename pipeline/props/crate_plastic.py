# Stackable grey plastic crate 0.6 x 0.4 x 0.3 m with vented sides and hand-hold cut-outs (length along X).
import sys, os; sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import helpers as H, _p04kit as K
from helpers import V, PI
import math, numpy as np
H.reset()
pl = K.plastic('crate_grey', '#6c7176', 0.6)
W, D, Hh, t = 0.6, 0.4, 0.3, 0.012
H.box('floor', W - 0.02, D - 0.02, 0.01, loc=(0, 0, 0.005), mat=pl)
for sy in (-1, 1):
    for i in range(7):
        H.box('rib', t, t, Hh - 0.02, loc=(-W / 2 + 0.01 + i * (W - 0.02) / 6, sy * (D / 2 - t / 2), (Hh - 0.02) / 2), mat=pl)
    for z in (0.01, 0.1, 0.19, Hh - 0.02):
        H.box('rail', W, t, 0.03 if z > 0.25 else 0.02, loc=(0, sy * (D / 2 - t / 2), z + 0.01), mat=pl, bev=0.003)
for sx in (-1, 1):
    for i in range(5):
        H.box('ribx', t, t, Hh - 0.02, loc=(sx * (W / 2 - t / 2), -D / 2 + 0.01 + i * (D - 0.02) / 4, (Hh - 0.02) / 2), mat=pl)
    for z in (0.01, 0.1, 0.17):
        H.box('railx', t, D, 0.02, loc=(sx * (W / 2 - t / 2), 0, z + 0.01), mat=pl, bev=0.003)
    H.box('grip_lo', t, D, 0.03, loc=(sx * (W / 2 - t / 2), 0, Hh - 0.015), mat=pl, bev=0.004)
    for sy in (-1, 1): H.box('grip_side', t, 0.1, 0.07, loc=(sx * (W / 2 - t / 2), sy * (D / 2 - 0.05), Hh - 0.05), mat=pl)
H.finish('crate_plastic')
