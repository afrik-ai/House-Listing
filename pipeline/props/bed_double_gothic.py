# Gothic-revival double bed: dark carved oak with pointed-arch headboard panels and finial posts, white bedding
# with a burgundy quilt. ~1.75 x 2.20 x 1.60 m, headboard at -Z (wall).
import sys; sys.path.insert(0, __import__('os').path.dirname(__import__('os').path.abspath(__file__)))
import helpers as H, _kit as K
from helpers import V, PI
import math, random, numpy as np
H.reset()
oak = K.wood('goth_oak', light='#5a3e28', mid='#46301f', dark='#2a1c12', seed=199, coat=0.2)
sheet = K.fabric('goth_sheet', '#f1efe9', threads=160, seed=201, strength=0.8)
quilt = K.fabric('goth_quilt', '#6b1f26', threads=90, seed=202, twill=True, sheen=0.2)
W, L = 1.7, 2.1
K.cushion('mattress', W - 0.1, L - 0.1, 0.24, sheet, loc=(0, 0, 0.5), crown=0.08)
K.cushion('quilt', W - 0.02, L * 0.62, 0.05, quilt, loc=(0, -L * 0.19, 0.64), crown=0.2, pipe=quilt)
for x in (-0.38, 0.38):
    K.cushion('pillow', 0.65, 0.4, 0.14, sheet, loc=(x, L / 2 - 0.3, 0.69), crown=0.8, e=4)
for s in (-1, 1):
    for y, h in ((L / 2, 1.55), (-L / 2, 0.95)):
        H.uv_box(H.box('post', 0.09, 0.09, h, loc=(s * (W / 2), y, h / 2), mat=oak, bev=0.01), 1.0, along='z')
        H.lathe('finial', [(0.0, 0.0), (0.05, 0.0), (0.03, 0.04), (0.045, 0.08), (0.0, 0.16)], 8, oak, loc=(s * W / 2, y, h))
    H.uv_box(H.box('side_rail', 0.05, L - 0.09, 0.2, loc=(s * (W / 2 - 0.02), 0, 0.32), mat=oak, bev=0.006), 1.0, along='y')
for y, top in ((L / 2, 1.35), (-L / 2, 0.8)):
    H.uv_box(H.box('rail', W - 0.09, 0.05, 0.08, loc=(0, y, top), mat=oak, bev=0.006), 1.0, along='x')
    H.uv_box(H.box('rail_lo', W - 0.09, 0.05, 0.2, loc=(0, y, 0.32), mat=oak, bev=0.006), 1.0, along='x')
    n = 4; pw = (W - 0.09) / n
    for i in range(n):
        cx = -W / 2 + 0.045 + pw * (i + 0.5); z0 = 0.42; z1 = top - 0.04
        pts = [(cx - pw / 2 + 0.02, z0), (cx + pw / 2 - 0.02, z0), (cx + pw / 2 - 0.02, z1 - pw * 0.6)]
        for k in range(1, 8): t = k / 8; pts.append((cx + (pw / 2 - 0.02) * (1 - t) ** 1.3, z1 - pw * 0.6 * (1 - math.sin(t * PI / 2))))
        pts.append((cx, z1))
        for k in range(1, 8): t = k / 8; pts.append((cx - (pw / 2 - 0.02) * t ** 1.3 if False else cx - (pw / 2 - 0.02) * (t) ** 0.77, z1 - pw * 0.6 * (1 - math.cos(t * PI / 2))))
        pts.append((cx - pw / 2 + 0.02, z1 - pw * 0.6))
        pan = H.extrude_poly('arch', pts, y - 0.02, y + 0.02, oak, plane='XZ'); H.uv_box(pan, 1.0, along='z'); H.bevel(pan, 0.004, 2)
H.finish('bed_double_gothic', extras={'texres': 1024})
