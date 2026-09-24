# Metal-frame desk 1.4 x 0.7 m: black steel sled legs, oak top with eased edges, hanging steel drawer unit + cable tray.
# 0.75 m, user side +Z.
import sys; sys.path.insert(0, __import__('os').path.dirname(__import__('os').path.abspath(__file__)))
import helpers as H, _kit as K
from helpers import V, PI
import math, random, numpy as np
H.reset()
oak = K.wood('desk_oak', seed=193); stl = K.plain('desk_steel', '#1c1c1c', 0.45, 0.7); void = K.plain('desk_void', '#0f0f10', 0.9)
W, D, Hh = 1.4, 0.7, 0.75
H.uv_box(H.box('top', W, D, 0.03, loc=(0, 0, Hh - 0.015), mat=oak, bev=0.005), 1.0, along='x')
for s in (-1, 1):
    x = s * (W / 2 - 0.06)
    H.tube('sled', [V((x, -D / 2 + 0.04, Hh - 0.03)), V((x, -D / 2 + 0.04, 0.01)), V((x, D / 2 - 0.04, 0.01)), V((x, D / 2 - 0.04, Hh - 0.03))], 0.014, 8, stl)
    H.box('rail', 0.03, D - 0.08, 0.03, loc=(x, 0, Hh - 0.045), mat=stl)
H.box('beam', W - 0.14, 0.03, 0.05, loc=(0, D / 2 - 0.08, Hh - 0.055), mat=stl)
K.drawer_case(0.4, 0.5, 0.2, 2, 1, stl, stl, stl, void, z0=Hh - 0.23, top_over=0.0)
import bpy
for o in list(bpy.context.scene.objects):
    if o.name.startswith(('top.', 'carcass', 'void', 'front', 'handle')) and o.location.x == 0 and o.location.z < Hh - 0.02:
        o.location.x += W / 2 - 0.3; o.location.y += 0.1
H.finish('desk_metal', extras={'texres': 1024})
