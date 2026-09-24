# Day bed: oak frame with low back + sides, linen mattress, bolster pillows and throw. ~2.05 x 0.95 x 0.75 m, back at -Z.
import sys; sys.path.insert(0, __import__('os').path.dirname(__import__('os').path.abspath(__file__)))
import helpers as H, _kit as K
from helpers import V, PI
import math, random, numpy as np
H.reset()
oak = K.wood('daybed_oak', seed=194); lin = K.fabric('daybed_linen', '#d3cbbb', threads=80, seed=195); pipe = K.fabric('daybed_pipe', '#b9b09f', threads=140, seed=196)
bol = K.fabric('daybed_bolster', '#6b7a8a', threads=100, seed=197, twill=True, sheen=0.0); knit = K.fabric('daybed_throw', '#b4683f', threads=24, seed=198, strength=2.5, sheen=0.0)
W, D = 2.05, 0.95
for s in (-1, 1):
    for y in (-D / 2 + 0.03, D / 2 - 0.03):
        H.uv_box(H.box('post', 0.05, 0.05, 0.65 if y > 0 else 0.55, loc=(s * (W / 2 - 0.025), y, (0.65 if y > 0 else 0.55) / 2), mat=oak, bev=0.006), 1.0, along='z')
    for z in (0.3, 0.5):
        H.uv_box(H.box('side_rail', 0.03, D - 0.06, 0.04, loc=(s * (W / 2 - 0.025), 0, z), mat=oak, bev=0.004), 1.0, along='y')
for z in (0.3, 0.45, 0.6):
    H.uv_box(H.box('back_rail', W - 0.06, 0.03, 0.05, loc=(0, D / 2 - 0.03, z), mat=oak, bev=0.004), 1.0, along='x')
H.uv_box(H.box('front_rail', W - 0.06, 0.03, 0.08, loc=(0, -D / 2 + 0.03, 0.26), mat=oak, bev=0.004), 1.0, along='x')
K.cushion('mattress', W - 0.1, D - 0.1, 0.16, lin, loc=(0, 0, 0.38), crown=0.12, pipe=pipe)
for x in (-0.55, 0.0, 0.55):
    b = H.superellipsoid('bolster', 0.25, 0.1, 0.1, e=2.5, n=2, nu=32, nv=12, mat=bol, loc=(x, D / 2 - 0.16, 0.56)); b.rotation_euler = (0, 0, 0); H.uv_box(b, 0.2)
t = H.box('throw', 0.5, D - 0.05, 0.02, loc=(W / 2 - 0.4, 0, 0.475), mat=knit, bev=0.008); H.uv_box(t, 0.3)
H.finish('day_bed', extras={'texres': 1024})
