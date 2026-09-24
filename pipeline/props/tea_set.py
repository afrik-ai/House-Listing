# Tea set on a round wooden tray: white porcelain teapot with bamboo handle, 2 cups on saucers, sugar bowl,
# teaspoons. Built ~0.46 m tray (placed at x0.7).
import sys; sys.path.insert(0, __import__('os').path.dirname(__import__('os').path.abspath(__file__)))
import helpers as H, _kit as K
from helpers import V, PI
import math, random, numpy as np
H.reset()
por = K.glaze('porcelain_white', '#f4f2ee', rough=0.12, seed=40)
tea = K.plain('tea_liquid', '#6a3a14', 0.05)
bam = K.plain('bamboo', '#b4905a', 0.55)
tray_w = K.wood('tray_ash', light='#d0b184', mid='#b89868', dark='#8d6f48', seed=41)
spoon = K.brushed('spoon_steel', '#d0d0d0', 0.2)
t = H.lathe('tray', [(0.0, 0.0), (0.22, 0.0), (0.23, 0.005), (0.232, 0.03), (0.222, 0.03), (0.218, 0.008), (0.0, 0.008)], 72, tray_w, sharp=40); H.uv_planar(t, 1.0)
px, py = -0.07, 0.05
H.lathe('teapot', [(0.0, 0.008), (0.05, 0.008), (0.085, 0.04), (0.09, 0.08), (0.07, 0.12), (0.045, 0.13)], 48, por, loc=(px, py, 0))
H.lathe('lid', [(0.047, 0.128), (0.04, 0.14), (0.01, 0.148), (0.012, 0.16), (0.0, 0.162)], 32, por, loc=(px, py, 0))
H.sweep('spout', [V((px - 0.08, py, 0.05)), V((px - 0.12, py, 0.08)), V((px - 0.14, py, 0.12))], H.circle2d(0.012, 10), por, caps=True, scale=[1.4, 0.9, 0.6], up=(0, 1, 0))
H.tube('bamboo_handle', [V((px - 0.04, py, 0.13)), V((px, py, 0.23)), V((px + 0.04, py, 0.13))], 0.006, 8, bam)
for (cx, cy) in ((0.1, -0.04), (0.05, 0.12)):
    H.lathe('saucer', [(0.0, 0.008), (0.05, 0.009), (0.065, 0.016), (0.062, 0.018), (0.0, 0.013)], 40, por, loc=(cx, cy, 0))
    H.lathe('cup', [(0.0, 0.015), (0.025, 0.015), (0.04, 0.03), (0.045, 0.07), (0.042, 0.07), (0.037, 0.03), (0.0, 0.02)], 40, por, loc=(cx, cy, 0))
    H.cyl('tea', 0.04, 0.001, loc=(cx, cy, 0.058), seg=24, mat=tea)
    H.tube('cup_handle', [V((cx + 0.042, cy, 0.06)), V((cx + 0.06, cy, 0.05)), V((cx + 0.044, cy, 0.035))], 0.004, 8, por)
    H.box('spoon', 0.08, 0.008, 0.002, loc=(cx, cy - 0.045, 0.02), mat=spoon, bev=0.001, seg=1)
H.lathe('sugar', [(0.0, 0.008), (0.03, 0.008), (0.04, 0.04), (0.035, 0.05), (0.0, 0.052)], 32, por, loc=(-0.1, -0.12, 0))
H.finish('tea_set', extras={'texres': 512})
