# Copper-brass saute pan with tin-lined interior, riveted cast brass handle. ~0.46 x 0.07 m (handle -> +X)
import sys; sys.path.insert(0, __import__('os').path.dirname(__import__('os').path.abspath(__file__)))
import helpers as H, _kit as K
from helpers import V, PI
import math, random, numpy as np
H.reset()
cu = K.brushed('pan_copper', '#c07a4c', 0.25, seed=14)
tin = K.brushed('pan_tin', '#b9b8b3', 0.35, seed=15)
br = K.brushed('pan_brass_handle', '#b89149', 0.3, seed=16)
H.lathe('pan', [(0.0, 0.0), (0.1, 0.0), (0.12, 0.006), (0.125, 0.06), (0.128, 0.065), (0.122, 0.065)], 56, cu, uvscale=0.2)
H.lathe('lining', [(0.0, 0.004), (0.118, 0.008), (0.121, 0.063)], 48, tin)
H.sweep('handle', [V((0.12, 0, 0.05)), V((0.18, 0, 0.065)), V((0.30, 0, 0.085)), V((0.34, 0, 0.09))], H.rrect2d(0.02, 0.012, 0.005, 3), br, caps=True, scale=[1.2, 1.0, 0.9, 1.1], up=(0, 0, 1))
for z in (0.035, 0.05):
    H.superellipsoid('rivet', 0.005, 0.005, 0.003, e=2, n=2, nu=10, nv=6, mat=br, loc=(0.126, 0, z)).rotation_euler = (0, PI / 2, 0)
H.finish('pan_brass', extras={'texres': 512})
