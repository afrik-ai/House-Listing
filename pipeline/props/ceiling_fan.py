# Ceiling fan: 5 walnut blades on brushed-nickel motor housing with opal light kit. Origin bottom; mount at y~0.45. ~1.3 m span
import sys; sys.path.insert(0, __import__('os').path.dirname(__import__('os').path.abspath(__file__)))
import helpers as H, _kit as K
from helpers import V, PI
import math, random, numpy as np
H.reset()
ni = K.brushed('fan_nickel', '#b9bbbd', 0.3); wal = K.wood('fan_walnut', light='#7e5a3e', mid='#654530', dark='#3e2819', seed=112)
opal = H.pbr('fan_opal', '#fff7ea', 0.35, emit='#ffe0b0', emit_str=4.0)
H.superellipsoid('light', 0.09, 0.09, 0.05, e=2, n=2, nu=32, nv=12, mat=opal, loc=(0, 0, 0.05))
H.lathe('motor', [(0.0, 0.08), (0.12, 0.09), (0.13, 0.13), (0.1, 0.18), (0.0, 0.19)], 48, ni)
H.cyl('down', 0.012, 0.25, loc=(0, 0, 0.19), seg=12, mat=ni)
H.lathe('canopy', [(0.0, 0.40), (0.07, 0.40), (0.08, 0.45), (0.0, 0.45)], 32, ni)
for i in range(5):
    a = i * 2 * PI / 5
    b = H.box('blade', 0.5, 0.12, 0.008, loc=(0, 0, 0), mat=wal, bev=0.003); H.uv_box(b, 1.0, along='x')
    b.location = (math.cos(a) * 0.4, math.sin(a) * 0.4, 0.12); b.rotation_euler = (0.12, 0, a)
    H.box('iron', 0.14, 0.03, 0.008, loc=(math.cos(a) * 0.14, math.sin(a) * 0.14, 0.125), mat=ni).rotation_euler = (0, 0, a)
H.finish('ceiling_fan', extras={'texres': 512})
