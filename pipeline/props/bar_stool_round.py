# Counter stool: round oak seat on black steel four-leg frame with footrest ring. ~0.40 x 0.66 m
import sys; sys.path.insert(0, __import__('os').path.dirname(__import__('os').path.abspath(__file__)))
import helpers as H, _kit as K
from helpers import V, PI
import math, random, numpy as np
H.reset()
oak = K.wood('stool_oak', seed=79); blk = K.plain('stool_steel', '#191919', 0.45, 0.7)
Hh = 0.66
s = H.lathe('seat', [(0.0, Hh - 0.03), (0.17, Hh - 0.03), (0.18, Hh - 0.02), (0.18, Hh - 0.005), (0.17, Hh), (0.0, Hh - 0.006)], 48, oak, sharp=40); H.uv_planar(s, 1.0)
for k in range(4):
    a = PI / 4 + k * PI / 2
    H.tube('leg', [V((math.cos(a) * 0.13, math.sin(a) * 0.13, Hh - 0.03)), V((math.cos(a) * 0.2, math.sin(a) * 0.2, 0.0))], 0.011, 8, blk)
H.tube('ring', [V((math.cos(t / 40 * 2 * PI) * 0.18, math.sin(t / 40 * 2 * PI) * 0.18, 0.22)) for t in range(40)], 0.009, 8, blk, closed=True, up=(0, 0, 1))
H.finish('bar_stool_round', extras={'texres': 512})
