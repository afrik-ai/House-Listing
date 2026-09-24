# Round wicker laundry hamper with lid (ajar) and a towel spilling over the rim. ~0.45 x 0.58 m
import sys; sys.path.insert(0, __import__('os').path.dirname(__import__('os').path.abspath(__file__)))
import helpers as H, _kit as K
from helpers import V, PI
H.reset()
wk = K.wicker('wicker_hamper', '#a88457', '#6e4f2c', n=32)
R, Hh = 0.21, 0.55
b = H.lathe('body', [(0.0, 0.0), (R - 0.03, 0.0), (R - 0.02, 0.01), (R, Hh)], 64, wk, uvscale=0.35); H.solidify(b, 0.01)
H.tube('rim', [V((__import__('math').cos(a / 32 * 6.2832) * R, __import__('math').sin(a / 32 * 6.2832) * R, Hh)) for a in range(32)], 0.012, 8, wk, closed=True, up=(0, 0, 1))
lid = H.lathe('lid', [(0.0, 0.035), (R * 0.6, 0.03), (R + 0.015, 0.0), (R + 0.015, -0.015)], 64, wk, uvscale=0.35)
lid.location = (0.0, 0.03, Hh + 0.02); lid.rotation_euler = (0.14, 0.0, 0.0)
H.cyl('lid_knob', 0.02, 0.03, loc=(0, 0.03 - 0.005, Hh + 0.055), mat=wk, seg=16, bev=0.006)
mats = H.terry_mats('towel_spill', '#8ea0ad', '#7e909e', seed=31)
import math
# towel hanging over the front rim: sheet swept over the rim then down the outside
path = []
for i in range(14):
    t = i / 13
    a = -0.3 + t * 3.4
    path.append((0.0, -R + 0.03 * math.cos(a) - (0.0 if t < 0.5 else 0.02 * (t - 0.5)), Hh + 0.018 * math.sin(a) - max(0, t - 0.45) * 0.32))
vs, fs = [], []
for i, (x, y, z) in enumerate(path):
    for j in range(9):
        u = (j / 8 - 0.5) * 0.30
        vs.append((u, y - 0.004 * math.sin(j * 1.7 + i) , z + 0.003 * math.sin(j * 2.1)))
for i in range(13):
    for j in range(8):
        fs.append((i * 9 + j, i * 9 + j + 1, (i + 1) * 9 + j + 1, (i + 1) * 9 + j))
tw = H.obj('towel', vs, fs, mats[0]); H.solidify(tw, 0.008, 0); H.uv_box(tw, 0.3); H.subsurf(tw, 1)
H.finish('laundry_basket_wicker', extras={'texres': 512})
