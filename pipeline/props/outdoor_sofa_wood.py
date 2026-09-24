# Painted wooden garden sofa (2-seat, 1.5 x 0.75 x 0.82 m): sage-grey painted frame with vertical back
# slats and arms, linen seat + back cushions. Front +Z.
import sys, os; sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import helpers as H, _p04kit as K
from helpers import V, PI
import math, numpy as np
H.reset()
pw = K.painted('sofa_paint', '#8e9a8a', 0.6)
cush = K.fabric('sofa_linen', '#e4ded2')
W, D = 1.5, 0.75
for sx in (-1, 1):
    for sy in (-1, 1):
        K.plank('leg', (sx * W / 2 - (0.06 if sx > 0 else 0), sy * D / 2 - (0.06 if sy > 0 else 0), 0), (sx * W / 2 + (0.06 if sx < 0 else 0), sy * D / 2 + (0.06 if sy < 0 else 0), 0.62 if sy < 0 else 0.82), pw, 'z')
    K.plank('arm', (sx * W / 2 - (0.08 if sx > 0 else -0.0) - (0 if sx > 0 else 0.02), -D / 2 - 0.02, 0.6), (sx * W / 2 + (0.02 if sx > 0 else 0.08), D / 2, 0.64), pw, 'y')
    for i in range(4):
        y = -D / 2 + 0.1 + i * 0.14
        K.plank('armslat', (sx * W / 2 - 0.02, y, 0.3), (sx * W / 2 + 0.02, y + 0.05, 0.6), pw, 'z')
for sy in (-1, 1): K.plank('rail', (-W / 2, sy * D / 2 - 0.02, 0.28), (W / 2, sy * D / 2 + 0.02, 0.36), pw, 'x')
for i in range(12):
    x = -W / 2 + 0.1 + i * (W - 0.2) / 11
    K.plank('bslat', (x - 0.025, D / 2 - 0.04, 0.36), (x + 0.025, D / 2 - 0.02, 0.8), pw, 'z')
K.plank('btop', (-W / 2, D / 2 - 0.05, 0.8), (W / 2, D / 2 + 0.01, 0.84), pw, 'x')
for i in range(7): K.plank('seat', (-W / 2 + 0.06, -D / 2 + 0.02 + i * 0.1, 0.34), (W / 2 - 0.06, -D / 2 + 0.1 + i * 0.1, 0.36), pw, 'x')
for sx in (-1, 1):
    c = H.superellipsoid('scush', (W - 0.2) / 4 - 0.01, (D - 0.1) / 2, 0.05, e=10, n=3, nu=40, nv=10, mat=cush, loc=(sx * (W - 0.2) / 4, -0.02, 0.41)); H.uv_box(c, 0.3)
    b = H.superellipsoid('bcush', (W - 0.2) / 4 - 0.01, 0.06, 0.19, e=10, n=3, nu=40, nv=10, mat=cush, loc=(sx * (W - 0.2) / 4, D / 2 - 0.12, 0.62)); H.uv_box(b, 0.3)
    b.rotation_euler = (-0.15, 0, 0)
H.finish('outdoor_sofa_wood')
