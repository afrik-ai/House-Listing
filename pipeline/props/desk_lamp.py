# Architect desk lamp: weighted black base, two-arm linkage with springs, conical shade with warm LED.
# Built 0.60 m tall (placed at x0.7). Shade points toward +Z/down.
import sys; sys.path.insert(0, __import__('os').path.dirname(__import__('os').path.abspath(__file__)))
import helpers as H, _kit as K
from helpers import V, PI
import math, random, numpy as np
H.reset()
blk = K.plain('lamp_black', '#191919', 0.45, 0.4)
steel = K.plain('spring_steel', '#bdbdbd', 0.25, 1.0)
led = H.pbr('lamp_led', '#fff4dc', 0.4, emit='#ffd9a0', emit_str=4.0)
brass = K.brushed('lamp_brass_joint', '#c09a55', 0.3)
H.lathe('base', [(0.0, 0.0), (0.09, 0.0), (0.095, 0.01), (0.085, 0.03), (0.02, 0.035), (0.0, 0.035)], 48, blk)
j0 = V((0, 0.02, 0.05)); j1 = V((0, 0.12, 0.34)); j2 = V((0, -0.14, 0.52))
for s in (-1, 1):
    H.tube('arm1', [j0 + V((s * 0.012, 0, 0)), j1 + V((s * 0.012, 0, 0))], 0.005, 8, blk)
    H.tube('arm2', [j1 + V((s * 0.012, 0, 0)), j2 + V((s * 0.012, 0, 0))], 0.005, 8, blk)
for j in (j0, j1, j2):
    H.cyl('joint', 0.012, 0.036, loc=(j.x - 0.018, j.y, j.z), rot=(0, PI / 2, 0), seg=16, mat=brass, bev=0.002)
for a, b in ((j0, j1), (j1, j2)):
    d = b - a; pts = []
    for i in range(80):
        t = 0.2 + 0.6 * i / 79; c = a + d * t + V((0.025, 0, 0))
        pts.append(c + V((0.006 * math.cos(i * 1.6), 0, 0.006 * math.sin(i * 1.6))))
    H.tube('spring', pts, 0.0012, 5, steel)
H.cyl('pivot', 0.025, 0.03, loc=(0, 0.02, 0.03), seg=24, mat=blk)
sh = H.lathe('shade', [(0.018, 0.0), (0.024, -0.03), (0.075, -0.13), (0.078, -0.135)], 40, blk)
sh.location = tuple(j2 + V((0, -0.03, 0))); sh.rotation_euler = (0.55, 0, 0)
H.solidify(sh, 0.0015)
dsk = H.cyl('led', 0.06, 0.002, loc=(0, 0, -0.12), seg=32, mat=led)
dsk.parent = sh
H.finish('desk_lamp', extras={'texres': 256})
