# Garden spade 1.0 m: steel blade (weathered, rust-brown edges), ash shaft, black D-grip. Built standing, blade down.
import sys, os; sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import helpers as H, _p04kit as K
from helpers import V, PI
import math, numpy as np
H.reset()
st = K.painted('spade_steel', '#595955', 0.55, 0.8)
w = K.wood('ash_shaft', '#c9a878', '#b8966a', '#9a7a52', 0.6, seed=62)
bl = H.box('blade', 0.19, 0.008, 0.28, loc=(0, 0, 0.14), mat=st, bev=0.003)
for v in bl.data.vertices:
    if v.co.z < -0.1: v.co.x *= 0.92
H.cyl('socket', 0.022, 0.14, loc=(0, 0, 0.26), seg=14, mat=st, r2=0.018)
s = H.cyl('shaft', 0.018, 0.62, loc=(0, 0, 0.36), seg=14, mat=w); H.uv_cyl(s, 0.3)
blk = K.plastic('grip_black', '#1c1c1c', 0.6)
H.tube('dgrip', [V((-0.02, 0, 0.97)), V((-0.06, 0, 1.03)), V((-0.05, 0, 1.08)), V((0.05, 0, 1.08)), V((0.06, 0, 1.03)), V((0.02, 0, 0.97))], 0.013, 10, mat=blk)
H.finish('spade')
