# Split-AC outdoor condenser 0.85 x 0.6 x 0.32 m: off-white steel casing, round fan grille (spiral wires),
# rear/side coil louvres, pipe connections at the right. Back (-Z) to the wall, grille faces +Z.
import sys, os; sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import helpers as H, _p04kit as K
from helpers import V, PI
import math, numpy as np
H.reset()
case = K.painted('ac_case', '#dcdbd5', 0.45, 0.1)
grill = K.painted('ac_grille', '#2a2b2c', 0.5, 0.5)
dark = K.painted('ac_dark', '#111111', 0.9)
W, Hh, D = 0.85, 0.6, 0.3
H.box('case', W, D, Hh, loc=(0, 0, 0.04 + Hh / 2), mat=case, bev=0.01)
cx = -0.1
H.cyl('hole', 0.22, 0.004, loc=(cx, -D / 2 - 0.001, 0.04 + Hh / 2), rot=(PI / 2, 0, 0), seg=40, mat=dark)
for r in np.linspace(0.04, 0.22, 7):
    H.lathe('ring', [(r - 0.003, 0), (r, 0.0), (r, 0.004), (r - 0.003, 0.004)], 40, grill, loc=(cx, -D / 2 - 0.004, 0.04 + Hh / 2), rot=(PI / 2, 0, 0))
for a in range(4):
    b = H.box('spoke', 0.44, 0.004, 0.006, loc=(cx, -D / 2 - 0.006, 0.04 + Hh / 2), mat=grill); b.rotation_euler = (0, a * PI / 4, 0)
for a in range(3):
    bl = H.box('blade', 0.19, 0.005, 0.07, loc=(cx, -D / 2 + 0.03, 0.04 + Hh / 2), mat=grill); bl.rotation_euler = (0.3, a * 2 * PI / 3, 0)
for i in range(12): H.box('louvre', 0.006, D - 0.04, 0.012, loc=(W / 2 + 0.001, 0, 0.1 + i * 0.04), mat=dark)
H.box('valve_cover', 0.1, 0.06, 0.16, loc=(W / 2 - 0.08, -D / 2 - 0.02, 0.25), mat=case, bev=0.005)
for sx in (-1, 1): H.box('foot', 0.06, D + 0.04, 0.04, loc=(sx * 0.3, 0, 0.02), mat=grill)
for z in (0.22, 0.28): K.rod('pipe', (W / 2 - 0.08, -D / 2 - 0.05, z), (W / 2 + 0.1, D / 2, z), 0.01, K.plastic('pipe_insul', '#efefea', 0.7))
H.finish('aircon_unit')
