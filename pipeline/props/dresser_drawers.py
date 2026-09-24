# Chest of drawers: oak carcass, 2 small + 3 graduated wide drawers with brushed-brass bar pulls, tapered legs;
# on top a tray with perfume bottle and a jewellery dish. ~1.00 x 0.48 x 0.92 m, front +Z.
import sys; sys.path.insert(0, __import__('os').path.dirname(__import__('os').path.abspath(__file__)))
import helpers as H, _kit as K
from helpers import V, PI
import math, random, numpy as np
H.reset()
oak = K.wood('dresser_oak', seed=90); br = K.brushed('dresser_brass', '#c19a55', 0.3); void = K.plain('dresser_void', '#140e09', 0.9)
glass = H.pbr('perfume_glass', '#e8d8b8', 0.05, alpha=0.6, blend='BLEND'); cer = K.glaze('dish_ceramic', '#e9e3d6', 0.3, seed=91)
W, D, Hh = 1.0, 0.48, 0.78
K.drawer_case(W, D, Hh, [0.8, 1, 1.1, 1.2], 1, oak, oak, br, void, z0=0.14)
for sx in (-1, 1):
    for sy in (-1, 1):
        K.tapered_leg('leg', 0.022, 0.015, 0.14, (sx * (W / 2 - 0.05), sy * (D / 2 - 0.05), 0.0), oak)
H.lathe('perfume', [(0.0, 0.0), (0.03, 0.0), (0.032, 0.06), (0.012, 0.07), (0.01, 0.085), (0.0, 0.085)], 24, glass, loc=(0.3, 0.05, 0.92))
H.cyl('cap', 0.013, 0.025, loc=(0.3, 0.05, 1.005), seg=16, mat=br)
H.lathe('dish', [(0.0, 0.0), (0.05, 0.0), (0.07, 0.018), (0.066, 0.019), (0.0, 0.006)], 32, cer, loc=(0.18, -0.02, 0.92))
H.finish('dresser_drawers', extras={'texres': 1024})
