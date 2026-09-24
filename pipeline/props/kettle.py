# Stovetop/electric-style kettle: brushed steel body, matte black handle + lid knob, spout, base ring. ~0.24 x 0.24 m, spout -> +Z
import sys; sys.path.insert(0, __import__('os').path.dirname(__import__('os').path.abspath(__file__)))
import helpers as H, _kit as K
from helpers import V, PI
import math, random, numpy as np
H.reset()
st = K.brushed('kettle_steel', '#cfd1d3', 0.22)
blk = K.plain('kettle_black', '#151515', 0.5)
b = H.lathe('body', [(0.0, 0.0), (0.085, 0.0), (0.095, 0.01), (0.1, 0.06), (0.095, 0.13), (0.07, 0.17), (0.045, 0.185), (0.0, 0.185)], 56, st, uvscale=0.2)
H.lathe('lid_knob', [(0.0, 0.185), (0.012, 0.185), (0.01, 0.2), (0.02, 0.21), (0.02, 0.22), (0.0, 0.222)], 24, blk)
H.cyl('base', 0.086, 0.008, loc=(0, 0, 0), seg=48, mat=blk, bev=0.002)
H.sweep('spout', [V((0, -0.08, 0.06)), V((0, -0.12, 0.10)), V((0, -0.15, 0.15))], H.circle2d(0.015, 12), st, caps=True, scale=[1.3, 0.9, 0.6], up=(1, 0, 0))
H.sweep('handle', [V((0, 0.08, 0.15)), V((0, 0.10, 0.2)), V((0, 0.02, 0.24)), V((0, -0.05, 0.2)), V((0, -0.055, 0.17))], H.rrect2d(0.014, 0.024, 0.006, 3), blk, caps=True, up=(1, 0, 0))
H.finish('kettle', extras={'texres': 512})
