# Two-seat cognac leather sofa: welted cushions, tufted back, slim black steel frame legs. ~1.60 x 0.88 x 0.80 m, front +Z.
import sys; sys.path.insert(0, __import__('os').path.dirname(__import__('os').path.abspath(__file__)))
import helpers as H, _kit as K
from helpers import V, PI
import math, random, numpy as np
H.reset()
lea = K.leather('leather_cognac', '#8a4f2a', seed=71)
blk = K.plain('sofa_steel', '#171717', 0.45, 0.7)
W, D = 1.60, 0.88
H.uv_box(H.superellipsoid('base', W / 2, D / 2, 0.09, e=14, n=8, nu=64, nv=10, mat=lea, loc=(0, 0, 0.26)), 0.25)
for s in (-1, 1):
    H.uv_box(H.superellipsoid('arm', 0.08, D / 2, 0.2, e=10, n=6, nu=40, nv=12, mat=lea, loc=(s * (W / 2 - 0.08), 0, 0.4)), 0.25)
H.uv_box(H.superellipsoid('back', W / 2 - 0.02, 0.09, 0.28, e=12, n=6, nu=64, nv=14, mat=lea, loc=(0, D / 2 - 0.09, 0.5)), 0.25)
for i in range(2):
    x = (i - 0.5) * (W - 0.32) / 2
    K.cushion('seat', (W - 0.32) / 2 - 0.01, D - 0.26, 0.14, lea, loc=(x, -0.07, 0.42), crown=0.15, pipe=lea, pipe_r=0.004, e=6)
    K.cushion('back', (W - 0.34) / 2, 0.42, 0.13, lea, loc=(x, D / 2 - 0.22, 0.66), crown=0.2, pipe=lea, pipe_r=0.004, rot=(PI / 2 - 0.2, 0, 0), e=6, tuft=3)
for s in (-1, 1):
    H.tube('frame', [V((s * (W / 2 - 0.06), -D / 2 + 0.06, 0.18)), V((s * (W / 2 - 0.06), -D / 2 + 0.06, 0.0)), V((s * (W / 2 - 0.06), D / 2 - 0.06, 0.0)), V((s * (W / 2 - 0.06), D / 2 - 0.06, 0.18))], 0.012, 8, blk)
H.finish('sofa_leather_2seat', extras={'texres': 1024})
