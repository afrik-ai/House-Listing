# Industrial metal bar stool: powder-coated anthracite, perforated round seat, 4 splayed legs with rings. ~0.40 x 0.76 m
import sys; sys.path.insert(0, __import__('os').path.dirname(__import__('os').path.abspath(__file__)))
import helpers as H, _kit as K
from helpers import V, PI
import math, random, numpy as np
H.reset()
m = K.plain('barstool_anthracite', '#2f3236', 0.45, 0.8)
Hh = 0.76
H.lathe('seat', [(0.0, Hh - 0.02), (0.17, Hh - 0.02), (0.18, Hh - 0.035), (0.185, Hh - 0.035), (0.175, Hh), (0.0, Hh - 0.004)], 48, m)
for k in range(4):
    a = PI / 4 + k * PI / 2
    H.tube('leg', [V((math.cos(a) * 0.12, math.sin(a) * 0.12, Hh - 0.03)), V((math.cos(a) * 0.22, math.sin(a) * 0.22, 0.0))], 0.012, 8, m)
for z, rr in ((0.25, 0.195), (0.5, 0.16)):
    H.tube('ring', [V((math.cos(t / 40 * 2 * PI) * rr, math.sin(t / 40 * 2 * PI) * rr, z)) for t in range(40)], 0.007, 8, m, closed=True, up=(0, 0, 1))
H.finish('bar_stool_metal', extras={'texres': 256})
