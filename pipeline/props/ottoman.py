# Round upholstered ottoman/pouf, sage boucle with piping at top and bottom seams, recessed black base. ~0.55 x 0.42 m
import sys; sys.path.insert(0, __import__('os').path.dirname(__import__('os').path.abspath(__file__)))
import helpers as H, _kit as K
from helpers import V, PI
import math, random, numpy as np
H.reset()
up = K.fabric('ottoman_sage', '#8a9277', threads=70, seed=72, strength=2.0)
pipe = K.fabric('ottoman_pipe', '#747c63', threads=140, seed=73)
blk = K.plain('ottoman_base', '#141414', 0.6)
R = 0.275
H.uv_box(H.superellipsoid('body', R, R, 0.18, e=2, n=6, nu=64, nv=14, mat=up, loc=(0, 0, 0.23), zfn=lambda x, y, z: z + (0.02 * (1 - (x * x + y * y) / R / R) if z > 0 else 0)), 0.25)
for z in (0.40, 0.06):
    H.tube('pipe', [V((math.cos(a / 64 * 2 * PI) * (R - 0.004), math.sin(a / 64 * 2 * PI) * (R - 0.004), z)) for a in range(64)], 0.005, 6, pipe, closed=True, up=(0, 0, 1))
H.cyl('base', R - 0.03, 0.05, loc=(0, 0, 0), seg=48, mat=blk)
H.finish('ottoman', extras={'texres': 1024})
