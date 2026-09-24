# Brass sputnik chandelier: central sphere, 12 arms with glowing frosted bulbs, drop rod to canopy. Origin at
# bottom; canopy at y~0.75. ~0.80 m wide.
import sys; sys.path.insert(0, __import__('os').path.dirname(__import__('os').path.abspath(__file__)))
import helpers as H, _kit as K
from helpers import V, PI
import math, random, numpy as np
H.reset()
br = K.brushed('chand_brass', '#c09a50', 0.28); bulb = H.pbr('chand_bulb', '#fff3e0', 0.3, emit='#ffd9a0', emit_str=5.0)
H.superellipsoid('hub', 0.06, 0.06, 0.06, e=2, n=2, nu=32, nv=16, mat=br, loc=(0, 0, 0.12))
for i in range(12):
    ph = (i % 3 - 1) * 0.5; th = i * 2 * PI / 12 + (i % 3) * 0.3
    d = V((math.cos(th) * math.cos(ph), math.sin(th) * math.cos(ph), math.sin(ph)))
    p0 = V((0, 0, 0.12)) + d * 0.05; p1 = V((0, 0, 0.12)) + d * 0.36
    H.tube('arm', [p0, p1], 0.005, 8, br)
    H.superellipsoid('bulb', 0.022, 0.022, 0.022, e=2, n=2, nu=16, nv=8, mat=bulb, loc=tuple(V((0, 0, 0.12)) + d * 0.38))
H.cyl('rod', 0.008, 0.55, loc=(0, 0, 0.18), seg=12, mat=br)
H.lathe('canopy', [(0.0, 0.72), (0.06, 0.72), (0.065, 0.74), (0.0, 0.75)], 32, br)
H.finish('chandelier', extras={'texres': 256})
