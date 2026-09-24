# Painted nightstand (satin sage lacquer, slightly rougher edges), one drawer + open niche, oak top, leather tab pull.
# ~0.45 x 0.38 x 0.55 m, front +Z.
import sys; sys.path.insert(0, __import__('os').path.dirname(__import__('os').path.abspath(__file__)))
import helpers as H, _kit as K
from helpers import V, PI
import math, random, numpy as np
H.reset()
paint = K.plain('ns_paint_sage', '#9aa58f', 0.42, coat=0.2); oak = K.wood('ns2_oak', seed=93); lea = K.leather('ns_tab', '#6e4527', seed=94); void = K.plain('ns2_void', '#1c1f1a', 0.9)
W, D, Hh = 0.45, 0.38, 0.55
H.box('body', W, D, Hh - 0.03, loc=(0, 0, (Hh - 0.03) / 2), mat=paint, bev=0.006)
t = H.box('top', W + 0.01, D + 0.01, 0.03, loc=(0, 0, Hh - 0.015), mat=oak, bev=0.004); H.uv_box(t, 1.0, along='x')
H.box('niche', W - 0.04, 0.3, 0.2, loc=(0, -D / 2 + 0.14, 0.14), mat=void)
H.box('front', W - 0.04, 0.02, 0.16, loc=(0, -D / 2 - 0.008, 0.40), mat=paint, bev=0.003)
H.box('gap', W - 0.036, 0.004, 0.164, loc=(0, -D / 2 - 0.0005, 0.40), mat=void)
H.box('tab', 0.05, 0.004, 0.035, loc=(0, -D / 2 - 0.02, 0.43), mat=lea, bev=0.001, seg=1)
K.book('nb', 0.15, 0.22, 0.03, K.fabric('ns_book', '#3c4c63', threads=120, seed=95), K.plain('ns_pages', '#eee6d6', 0.9), loc=(0.02, 0.0, 0.04), rotz=0.1)
H.finish('nightstand_painted', extras={'texres': 1024})
