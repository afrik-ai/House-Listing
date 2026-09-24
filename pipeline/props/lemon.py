# Lemon with pitted peel (normal map) and pointed ends, lying on its side. ~0.09 m
import sys; sys.path.insert(0, __import__('os').path.dirname(__import__('os').path.abspath(__file__)))
import helpers as H, _kit as K
from helpers import V, PI
import math, random, numpy as np
H.reset()
h = -np.abs(H.fnoise(256, 1.5, 1.5, 7))
m = H.pbr('lemon_peel', '#e8c428', 0.45, normal_tex=H.save_img(H.h2n(h, 1.5), 'lemon_n', True), coat=0.2)
l = H.superellipsoid('lemon', 0.045, 0.032, 0.032, e=2, n=2, nu=32, nv=16, mat=m, loc=(0, 0, 0.032))
H.displace_fn(l, lambda c: V((c.x * (1 + 0.25 * max(0, abs(c.x) / 0.045 - 0.7) ** 2 * 0 ), c.y, c.z)))
for s in (-1, 1): H.superellipsoid('tip', 0.008, 0.008, 0.008, e=2, n=2, nu=12, nv=6, mat=m, loc=(s * 0.046, 0, 0.032))
H.uv_box(l, 0.05)
H.finish('lemon', extras={'texres': 256})
