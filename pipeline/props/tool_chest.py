# Rolling mechanic's tool chest 0.68 x 1.0 x 0.46 m: red powder-coat cabinet with 6 drawers, brushed
# aluminium bar pulls, black ribbed top mat, side handle, 4 castors. Front +Z.
import sys, os; sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import helpers as H, _p04kit as K
from helpers import V, PI
import math, numpy as np
H.reset()
red = K.painted('toolchest_red', '#a81c18', 0.35, 0.3)
alu = K.steel('alu_pull', '#c9cdd0', 0.3)
blk = K.rubber()
W, D, Hh = 0.68, 0.46, 1.0
body = H.box('body', W, D, Hh - 0.12, loc=(0, 0, 0.12 + (Hh - 0.12) / 2), mat=red, bev=0.008)
H.box('mat', W - 0.02, D - 0.02, 0.008, loc=(0, 0, Hh + 0.004), mat=blk, bev=0.002)
z = 0.14
for i, dh in enumerate([0.26, 0.2, 0.12, 0.1, 0.08, 0.08]):
    H.box('drawer', W - 0.03, 0.012, dh - 0.012, loc=(0, -D / 2 - 0.006, z + dh / 2), mat=red, bev=0.003)
    K.rod('pull', (-W / 2 + 0.06, -D / 2 - 0.03, z + dh - 0.03), (W / 2 - 0.06, -D / 2 - 0.03, z + dh - 0.03), 0.008, alu)
    for sx in (-1, 1):
        K.rod('pullpost', (sx * (W / 2 - 0.07), -D / 2 - 0.012, z + dh - 0.03), (sx * (W / 2 - 0.07), -D / 2 - 0.034, z + dh - 0.03), 0.006, alu)
    z += dh
K.rod('handle', (W / 2 + 0.05, -0.15, 0.85), (W / 2 + 0.05, 0.15, 0.85), 0.012, alu)
for sy in (-1, 1): K.rod('hpost', (W / 2, sy * 0.15, 0.85), (W / 2 + 0.05, sy * 0.15, 0.85), 0.01, alu)
for sx in (-1, 1):
    for sy in (-1, 1):
        H.box('bracket', 0.05, 0.05, 0.03, loc=(sx * (W / 2 - 0.05), sy * (D / 2 - 0.05), 0.105), mat=K.steel())
        w = H.cyl('wheel', 0.045, 0.03, loc=(sx * (W / 2 - 0.05) - 0.015, sy * (D / 2 - 0.05), 0.045), rot=(0, PI / 2, 0), seg=16, mat=blk)
H.finish('tool_chest')
