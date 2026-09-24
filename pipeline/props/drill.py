# Cordless drill-driver (18 V): teal/black body, battery pack base, keyless chuck, 0.24 x 0.25 x 0.08 m.
# Chuck points +X. Stands on its battery.
import sys, os; sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import helpers as H, _p04kit as K
from helpers import V, PI
import math, numpy as np
H.reset()
teal = K.plastic('drill_teal', '#1e7f86', 0.45)
blk = K.plastic('drill_black', '#1b1c1d', 0.6)
st = K.steel('chuck_steel', '#9ea2a5', 0.3)
bat = H.box('battery', 0.11, 0.075, 0.07, loc=(0.0, 0, 0.035), mat=blk, bev=0.01)
grip = H.box('grip', 0.05, 0.052, 0.13, loc=(0.0, 0, 0.13), mat=blk, bev=0.018); grip.rotation_euler = (0, -0.22, 0)
bodyo = H.cyl('motor', 0.034, 0.16, loc=(-0.065, 0, 0.215), rot=(0, PI / 2, 0), seg=24, mat=teal, bev=0.01)
H.box('trigger', 0.018, 0.018, 0.035, loc=(0.03, 0, 0.17), mat=teal, bev=0.004)
H.cyl('clutch', 0.03, 0.02, loc=(0.095, 0, 0.215), rot=(0, PI / 2, 0), seg=24, mat=blk)
H.cyl('chuck', 0.022, 0.05, loc=(0.115, 0, 0.215), rot=(0, PI / 2, 0), seg=20, mat=blk, r2=0.016)
H.cyl('bit', 0.003, 0.05, loc=(0.16, 0, 0.215), rot=(0, PI / 2, 0), seg=8, mat=st)
H.finish('drill')
