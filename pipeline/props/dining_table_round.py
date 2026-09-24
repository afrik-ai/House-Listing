# Round pedestal dining table, 1.2 m oak top on a tulip-style white base. 0.75 m.
import sys; sys.path.insert(0, __import__('os').path.dirname(__import__('os').path.abspath(__file__)))
import helpers as H, _kit as K
from helpers import V, PI
import math, random, numpy as np
H.reset()
oak = K.wood('rtable_oak', seed=78)
wh = K.plain('tulip_white', '#eeeeea', 0.35)
R, Hh = 0.6, 0.75
t = H.lathe('top', [(0.0, Hh - 0.035), (R - 0.006, Hh - 0.035), (R, Hh - 0.028), (R, Hh - 0.006), (R - 0.006, Hh), (0.0, Hh)], 96, oak, sharp=30); H.uv_planar(t, 1.0)
H.lathe('base', [(0.0, 0.0), (0.3, 0.0), (0.3, 0.01), (0.18, 0.05), (0.07, 0.2), (0.05, 0.4), (0.07, Hh - 0.05), (0.2, Hh - 0.035), (0.0, Hh - 0.035)], 64, wh)
H.finish('dining_table_round', extras={'texres': 1024})
