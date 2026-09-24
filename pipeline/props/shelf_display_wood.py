# Open oak display shelf (ladder style, 4 shelves) 0.8 x 0.35 x 1.6 m with books, baskets and ceramics. Back at -Z.
import sys; sys.path.insert(0, __import__('os').path.dirname(__import__('os').path.abspath(__file__)))
import helpers as H, _kit as K
from helpers import V, PI
import math, random, numpy as np
H.reset()
oak = K.wood('disp_oak', seed=190); wk = K.wicker('disp_wicker', n=20); cer = K.glaze('disp_cer', '#d9d2c4', rough=0.4, speck=0.5, seed=191)
W, D, Hh = 0.8, 0.35, 1.6
for s in (-1, 1):
    for y in (-D / 2 + 0.02, D / 2 - 0.02):
        H.uv_box(H.box('post', 0.035, 0.035, Hh, loc=(s * (W / 2 - 0.018), y, Hh / 2), mat=oak, bev=0.004), 1.0, along='z')
lv = [0.08, 0.5, 0.92, 1.34]
for z in lv: H.uv_box(H.box('shelf', W, D, 0.022, loc=(0, 0, z), mat=oak, bev=0.003), 1.0, along='x')
K.book_row('ds', -W / 2 + 0.05, 0.1, lv[2] + 0.011, 0.0, depth=0.24, seed=7, stack=False)
K.book_row('ds', -W / 2 + 0.05, W / 2 - 0.05, lv[3] + 0.011, 0.0, depth=0.24, seed=8)
for x in (-0.18, 0.18):
    b = H.loft('basket', [H.ring_se(0.16, 0.14, 0.0, 6, 48, cx=x), H.ring_se(0.17, 0.15, 0.24, 6, 48, cx=x)], wk, cap0=True); H.solidify(b, 0.006); H.uv_box(b, 0.3); b.location.z = lv[0] + 0.011
H.lathe('vase', [(0.0, 0.0), (0.06, 0.0), (0.08, 0.08), (0.05, 0.16), (0.03, 0.2), (0.035, 0.22), (0.0, 0.22)], 32, cer, loc=(0.25, 0.0, lv[2] + 0.011))
H.lathe('bowl', [(0.0, 0.0), (0.05, 0.0), (0.09, 0.05), (0.085, 0.052), (0.0, 0.01)], 32, cer, loc=(-0.1, 0.0, lv[1] + 0.011))
H.finish('shelf_display_wood', extras={'texres': 1024})
