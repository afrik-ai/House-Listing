# Closed corrugated cardboard box 0.5 x 0.35 x 0.35 m with brown tape strip over the top seam and flap lines.
import sys, os; sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import helpers as H, _p04kit as K
from helpers import V, PI
import math, numpy as np
H.reset()
cb = K.cardboard()
tape = K.plastic('packing_tape', '#b08a55', 0.3)
b = H.box('box', 0.5, 0.35, 0.35, loc=(0, 0, 0.175), mat=cb, bev=0.004, seg=2); H.uv_box(b, 0.6)
H.box('tape_top', 0.06, 0.352, 0.001, loc=(0, 0, 0.3505), mat=tape)
for sy in (-1, 1): H.box('tape_side', 0.06, 0.001, 0.08, loc=(0, sy * 0.1755, 0.31), mat=tape)
H.finish('box_cardboard')
