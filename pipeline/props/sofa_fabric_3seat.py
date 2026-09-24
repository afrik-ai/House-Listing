# Three-seat fabric sofa: charcoal-blue woven upholstery, piped seat + back cushions (3 each) with stitched seams,
# track arms, walnut plinth legs, two scatter cushions + folded throw. ~2.20 x 0.95 x 0.82 m, front +Z.
import sys; sys.path.insert(0, __import__('os').path.dirname(__import__('os').path.abspath(__file__)))
import helpers as H, _kit as K
from helpers import V, PI
import math, random, numpy as np
H.reset()
up = K.fabric('sofa_weave_slate', '#4d5663', threads=90, seed=61, twill=True, strength=1.6)
pipe = K.fabric('sofa_pipe_slate', '#3f4753', threads=140, seed=62)
c1 = K.fabric('scatter_mustard', '#b8892f', threads=110, seed=63, sheen=0.0)
c2 = K.fabric('scatter_linen', '#d6cdbb', threads=80, seed=64, sheen=0.0)
wal = K.wood('sofa_walnut', light='#7e5a3e', mid='#654530', dark='#3e2819', seed=65)
W, D = 2.20, 0.95
H.uv_box(H.superellipsoid('base', W / 2, D / 2, 0.1, e=14, n=8, nu=72, nv=10, mat=up, loc=(0, 0, 0.22)), 0.25)
for s in (-1, 1):
    H.uv_box(H.superellipsoid('arm', 0.09, D / 2, 0.23, e=12, n=6, nu=48, nv=14, mat=up, loc=(s * (W / 2 - 0.09), 0, 0.38)), 0.25)
    K.stitch('arm_seam', [V((s * (W / 2 - 0.09), -D / 2 + 0.04, 0.61)), V((s * (W / 2 - 0.09), D / 2 - 0.04, 0.61))], pipe)
H.uv_box(H.superellipsoid('back', W / 2 - 0.02, 0.1, 0.3, e=12, n=6, nu=72, nv=14, mat=up, loc=(0, D / 2 - 0.1, 0.5)), 0.25)
cw = (W - 0.36) / 3
for i in range(3):
    x = -W / 2 + 0.18 + cw * (i + 0.5)
    K.cushion('seat', cw - 0.01, D - 0.28, 0.15, up, loc=(x, -0.08, 0.395), crown=0.2, pipe=pipe)
    K.cushion('backc', cw - 0.02, 0.44, 0.16, up, loc=(x, D / 2 - 0.25, 0.66), crown=0.3, pipe=pipe, rot=(PI / 2 - 0.2, 0, 0))
K.cushion('scatter', 0.45, 0.45, 0.12, c1, loc=(-W / 2 + 0.36, D / 2 - 0.36, 0.66), crown=1.0, e=4, rot=(PI / 2 - 0.4, 0.3, 0.25))
K.cushion('scatter2', 0.42, 0.42, 0.11, c2, loc=(W / 2 - 0.38, D / 2 - 0.36, 0.64), crown=1.0, e=4, rot=(PI / 2 - 0.45, -0.2, -0.3))
for sx in (-1, 1):
    for sy in (-1, 1):
        l = H.box('leg', 0.05, 0.05, 0.12, loc=(sx * (W / 2 - 0.08), sy * (D / 2 - 0.08), 0.06), mat=wal, bev=0.006); H.uv_box(l, 1.0, along='z')
H.finish('sofa_fabric_3seat', extras={'texres': 1024})
