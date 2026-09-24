# Small portable CRT TV: cream plastic housing, dark curved screen, carry handle, dial tuner. ~0.36 x 0.32 x 0.34 m, front +Z.
import sys; sys.path.insert(0, __import__('os').path.dirname(__import__('os').path.abspath(__file__)))
import helpers as H, _kit as K
from helpers import V, PI
import math, random, numpy as np
H.reset()
pl = K.plain('crt_cream', '#ddd3bd', 0.45); scr = K.plain('crt_small_glass', '#2e3431', 0.08, coat=1.0); blk = K.plain('crt_black', '#1b1b1b', 0.5)
H.box('housing', 0.36, 0.3, 0.3, loc=(0, 0.0, 0.15), mat=pl, bev=0.025, seg=3)
H.box('back', 0.26, 0.12, 0.22, loc=(0, 0.18, 0.13), mat=pl, bev=0.03, seg=3)
H.superellipsoid('screen', 0.12, 0.02, 0.1, e=5, n=5, nu=32, nv=10, mat=scr, loc=(-0.04, -0.15, 0.16))
H.box('panel', 0.07, 0.01, 0.22, loc=(0.13, -0.151, 0.15), mat=blk, bev=0.004)
for z in (0.2, 0.12): H.cyl('dial', 0.018, 0.015, loc=(0.13, -0.158, z), rot=(PI / 2, 0, 0), seg=20, mat=pl, bev=0.004)
H.tube('handle', [V((-0.14, 0.0, 0.3)), V((-0.12, 0.0, 0.34)), V((0.12, 0.0, 0.34)), V((0.14, 0.0, 0.3))], 0.008, 8, blk)
H.finish('tv_crt_small', extras={'texres': 256})
