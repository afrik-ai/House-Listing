# 3-shelf steel service / tool cart 0.8 x 0.85 x 0.45 m: blue powder-coat trays with lips, round posts,
# push handle, castors. Length along X.
import sys, os; sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import helpers as H, _p04kit as K
from helpers import V, PI
import math, numpy as np
H.reset()
blue = K.painted('cart_blue', '#23508f', 0.4, 0.3)
W, D = 0.8, 0.45
for z in (0.14, 0.45, 0.78):
    H.box('tray', W, D, 0.004, loc=(0, 0, z), mat=blue)
    for sy in (-1, 1): H.box('lip', W, 0.004, 0.04, loc=(0, sy * D / 2, z + 0.02), mat=blue)
    for sx in (-1, 1): H.box('lip', 0.004, D, 0.04, loc=(sx * W / 2, 0, z + 0.02), mat=blue)
for sx in (-1, 1):
    for sy in (-1, 1): H.cyl('post', 0.012, 0.72, loc=(sx * (W / 2 - 0.02), sy * (D / 2 - 0.02), 0.1), seg=12, mat=blue)
H.tube('handle', [V((W / 2 - 0.02, -0.15, 0.8)), V((W / 2 + 0.08, -0.15, 0.85)), V((W / 2 + 0.08, 0.15, 0.85)), V((W / 2 - 0.02, 0.15, 0.8))], 0.012, 10, mat=K.rubber())
for sx in (-1, 1):
    for sy in (-1, 1): H.cyl('castor', 0.04, 0.025, loc=(sx * (W / 2 - 0.04) - 0.0125, sy * (D / 2 - 0.04), 0.04), rot=(0, PI / 2, 0), seg=16, mat=K.rubber())
H.finish('tool_cart')
