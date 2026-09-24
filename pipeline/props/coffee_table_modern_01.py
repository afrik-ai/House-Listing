# Rectangular oak coffee table 1.2 x 0.6 m with lower slatted shelf, rounded corners, a tray + magazines. 0.40 m.
import sys; sys.path.insert(0, __import__('os').path.dirname(__import__('os').path.abspath(__file__)))
import helpers as H, _kit as K
from helpers import V, PI
import math, random, numpy as np
H.reset()
oak = K.wood('ct1_oak', seed=175); tray = K.plain('ct1_tray', '#1c1c1c', 0.4); mag = K.plain('ct1_mag', '#c8b89c', 0.4)
W, D, Hh = 1.2, 0.6, 0.40
t = K.rounded_panel('top', W, D, 0.035, 0.05, oak, loc=(0, 0, Hh - 0.035)); H.uv_box(t, 1.0, along='x')
for sx in (-1, 1):
    for sy in (-1, 1):
        l = H.box('leg', 0.05, 0.05, Hh - 0.035, loc=(sx * (W / 2 - 0.06), sy * (D / 2 - 0.06), (Hh - 0.035) / 2), mat=oak, bev=0.008); H.uv_box(l, 1.0, along='z')
for i in range(9):
    s = H.box('slat', W - 0.16, 0.035, 0.018, loc=(0, -D / 2 + 0.1 + i * (D - 0.2) / 8, 0.1), mat=oak, bev=0.003); H.uv_box(s, 1.0, along='x')
K.rounded_panel('tray', 0.4, 0.26, 0.02, 0.03, tray, loc=(0.25, 0.05, Hh))
for i in range(3): H.box('mag', 0.22, 0.29, 0.005, loc=(-0.05, 0.05 + i * 0.01, 0.1 + 0.009 + 0.005 * i), mat=mag).rotation_euler = (0, 0, 0.1 * i)
H.finish('coffee_table_modern_01', extras={'texres': 1024})
