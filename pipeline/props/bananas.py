# Bunch of 5 ripe bananas with brown-tipped ends and a shared crown. ~0.22 x 0.08 m
import sys; sys.path.insert(0, __import__('os').path.dirname(__import__('os').path.abspath(__file__)))
import helpers as H, _kit as K
from helpers import V, PI
import math, random, numpy as np
H.reset()
N = 256
y, x = np.mgrid[0:N, 0:N].astype(np.float32) / N
sp = (H.fnoise(N, 2, 2, 3) > 2.2).astype(np.float32)
col = H.colmix(np.clip(sp * 0.8 + H.fnoise(N, 40, 4, 4) * 0.05, 0, 1), '#e8c440', '#5a3b17')
peel = H.pbr('banana_peel', '#ffffff', 0.5, base_tex=H.save_img(col, 'banana_c'))
tip = K.plain('banana_tip', '#3a2a14', 0.7)
for i in range(5):
    off = (i - 2) * 0.02
    pts = [V((-0.1 + 0.2 * t, off * (1 - 0.3 * t), 0.02 + 0.05 * (1 - (2 * t - 1) ** 2) + abs(off) * 0.3)) for t in np.linspace(0, 1, 12)]
    b = H.sweep('banana', pts, [(math.cos(a) * 0.017, math.sin(a) * 0.017) for a in np.linspace(0, 2 * PI, 6, endpoint=False)], peel, caps=True, scale=[0.35, 0.8, 1, 1, 1, 1, 1, 1, 1, 0.9, 0.7, 0.4], up=(0, 0, 1))
    H.uv_box(b, 0.1)
    H.cyl('stem', 0.005, 0.02, loc=(-0.105, off, 0.02), rot=(0, PI / 2, 0), seg=6, mat=tip)
H.finish('bananas', extras={'texres': 256})
