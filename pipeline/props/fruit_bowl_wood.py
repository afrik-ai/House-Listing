# Wide low teak fruit bowl with 3 oranges and 2 pears. ~0.34 x 0.14 m
import sys; sys.path.insert(0, __import__('os').path.dirname(__import__('os').path.abspath(__file__)))
import helpers as H, _kit as K
from helpers import V, PI
import math, random, numpy as np
H.reset()
w = K.wood('teak_bowl', light='#a4744a', mid='#8a5d37', dark='#5a3a20', seed=36, coat=0.3)
org = K.leather('orange_peel', '#e58a1f', seed=37); pear = K.leather('pear_skin', '#b9b64a', seed=38); stem = K.plain('fruit_stem', '#4a3a22', 0.8)
b = H.lathe('bowl', [(0.0, 0.0), (0.06, 0.0), (0.07, 0.01), (0.15, 0.05), (0.17, 0.075), (0.166, 0.078), (0.145, 0.058), (0.065, 0.02), (0.0, 0.018)], 64, w); H.uv_box(b, 0.3, along='x')
rnd = random.Random(4)
for i, (x, y) in enumerate(((-0.05, -0.03), (0.04, -0.04), (0.0, 0.05))):
    H.superellipsoid('orange', 0.037, 0.037, 0.035, e=2, n=2, nu=24, nv=12, mat=org, loc=(x, y, 0.055))
for i, (x, y, rz) in enumerate(((0.06, 0.05, 0.4), (-0.07, 0.05, -0.6))):
    p = H.lathe('pear', [(0.0, 0.0), (0.03, 0.005), (0.036, 0.03), (0.026, 0.06), (0.015, 0.08), (0.008, 0.09), (0.0, 0.092)], 20, pear)
    p.location = (x, y, 0.08); p.rotation_euler = (0.9, 0, rz)
    H.tube('pstem', [V((x, y, 0.08)) + V((0, -math.sin(0.9), math.cos(0.9))) * 0.09, V((x, y, 0.08)) + V((0, -math.sin(0.9), math.cos(0.9))) * 0.11], 0.0018, 5, stem)
H.finish('fruit_bowl_wood', extras={'texres': 512})
