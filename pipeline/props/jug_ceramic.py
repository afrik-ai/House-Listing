# Stoneware milk jug: reactive speckled glaze (cream to rust at the rim), pulled spout, strap handle. ~0.14 x 0.18 m
import sys; sys.path.insert(0, __import__('os').path.dirname(__import__('os').path.abspath(__file__)))
import helpers as H, _kit as K
from helpers import V, PI
import math, random, numpy as np
H.reset()
g = K.glaze('jug_glaze', '#e2d6c0', rough=0.35, speck=0.7, seed=120)
rim = K.glaze('jug_rim', '#8a4a2a', rough=0.3, seed=121)
H.lathe('jug', [(0.0, 0.0), (0.045, 0.0), (0.055, 0.01), (0.06, 0.08), (0.05, 0.14), (0.046, 0.165), (0.043, 0.165), (0.047, 0.14), (0.055, 0.08)], 40, g, uvscale=0.1)
H.lathe('rimband', [(0.0475, 0.155), (0.049, 0.168), (0.044, 0.168)], 40, rim)
H.sweep('handle', [V((0.055, 0, 0.14)), V((0.09, 0, 0.13)), V((0.09, 0, 0.06)), V((0.058, 0, 0.04))], H.rrect2d(0.008, 0.022, 0.003, 2), g, caps=True, up=(0, 1, 0))
H.superellipsoid('spout', 0.022, 0.015, 0.012, e=2, n=2, nu=16, nv=6, mat=g, loc=(-0.05, 0, 0.162))
H.finish('jug_ceramic', extras={'texres': 512})
