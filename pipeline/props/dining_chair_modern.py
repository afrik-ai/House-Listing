# Modern dining chair: solid oak frame with curved back rail, upholstered seat pad in oat fabric with piping. ~0.48 x 0.52 x 0.80 m, front +Z.
import sys; sys.path.insert(0, __import__('os').path.dirname(__import__('os').path.abspath(__file__)))
import helpers as H, _kit as K
from helpers import V, PI
import math, random, numpy as np
H.reset()
oak = K.wood('chair_oak', seed=74)
up = K.fabric('chair_oat', '#b8ab94', threads=90, seed=75)
pipe = K.fabric('chair_pipe', '#9f927b', threads=140, seed=76)
W, D, SH = 0.46, 0.48, 0.46
for sx in (-1, 1):
    K.tapered_leg('front_leg', 0.018, 0.014, SH - 0.02, (sx * (W / 2 - 0.03), -D / 2 + 0.04, 0), oak, splay=(0.03, 0))
    H.tube('back_leg', [V((sx * (W / 2 - 0.03), D / 2 - 0.03, 0.0)), V((sx * (W / 2 - 0.03), D / 2 - 0.05, SH)), V((sx * (W / 2 - 0.035), D / 2 - 0.01, 0.80))], 0.016, 10, oak)
H.uv_box(H.box('apron', W - 0.04, D - 0.06, 0.05, loc=(0, 0, SH - 0.05), mat=oak, bev=0.004), 1.0, along='x')
K.cushion('seat', W - 0.02, D - 0.02, 0.05, up, loc=(0, -0.01, SH), crown=0.3, pipe=pipe, pipe_r=0.003)
pts = [V((math.sin(t) * 0.22, D / 2 - 0.01 + (1 - math.cos(t)) * 0.12, 0.72)) for t in np.linspace(-1.1, 1.1, 20)]
H.sweep('back_rail', pts, H.rrect2d(0.018, 0.1, 0.008, 3), oak, caps=True, up=(0, 0, 1))
for sx in (-1, 1): H.tube('stretcher', [V((sx * (W / 2 - 0.03), -D / 2 + 0.05, 0.15)), V((sx * (W / 2 - 0.03), D / 2 - 0.04, 0.15))], 0.009, 8, oak)
H.finish('dining_chair_modern', extras={'texres': 1024})
