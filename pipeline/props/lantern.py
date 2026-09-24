# Candle lantern: black powder-coated steel frame with glass panes, ring handle, pillar candle inside
# (warm emissive flame). ~0.20 x 0.42 m
import sys; sys.path.insert(0, __import__('os').path.dirname(__import__('os').path.abspath(__file__)))
import helpers as H, _kit as K
from helpers import V, PI
import math, random, numpy as np
H.reset()
blk = K.plain('lantern_black', '#1a1a1a', 0.55, 0.5)
glass = H.pbr('lantern_glass', '#ffffff', 0.04, alpha=0.12, spec=0.9, blend='BLEND')
wax = H.pbr('lantern_wax', '#efe6d2', 0.45, sheen=0.2)
flame = H.pbr('lantern_flame', '#ffcf7a', 0.5, emit='#ffb050', emit_str=8.0)
W, Hh = 0.20, 0.34
H.box('base', W, W, 0.03, loc=(0, 0, 0.015), mat=blk, bev=0.004)
for sx in (-1, 1):
    for sy in (-1, 1):
        H.box('post', 0.012, 0.012, Hh - 0.03, loc=(sx * (W / 2 - 0.006), sy * (W / 2 - 0.006), 0.03 + (Hh - 0.03) / 2), mat=blk)
for s in (-1, 1):
    H.box('pane', W - 0.012, 0.003, Hh - 0.05, loc=(0, s * (W / 2 - 0.006), 0.03 + (Hh - 0.05) / 2 + 0.005), mat=glass)
    H.box('pane', 0.003, W - 0.012, Hh - 0.05, loc=(s * (W / 2 - 0.006), 0, 0.03 + (Hh - 0.05) / 2 + 0.005), mat=glass)
H.lathe('roof', [(W * 0.72, Hh), (W * 0.72, Hh + 0.01), (0.03, Hh + 0.06), (0.0, Hh + 0.06)], 4, blk, rot=(0, 0, PI / 4))
H.tube('ring', [V((math.cos(a / 24 * 2 * PI) * 0.04, 0, Hh + 0.1 + math.sin(a / 24 * 2 * PI) * 0.04)) for a in range(24)], 0.004, 6, blk, closed=True, up=(0, 1, 0))
H.cyl('candle', 0.035, 0.12, loc=(0, 0, 0.03), seg=24, mat=wax, bev=0.006)
H.superellipsoid('flame', 0.007, 0.007, 0.018, e=2, n=2, nu=10, nv=8, mat=flame, loc=(0, 0, 0.17), zfn=lambda x, y, z: z + (0.006 if z > 0 else 0))
H.finish('lantern', extras={'texres': 256})
