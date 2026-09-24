# Round farmhouse dining table 1.1 m: pine plank top with breadboard ring, four turned legs + apron. 0.76 m.
import sys; sys.path.insert(0, __import__('os').path.dirname(__import__('os').path.abspath(__file__)))
import helpers as H, _kit as K
from helpers import V, PI
import math, random, numpy as np
H.reset()
pine = K.wood('farm_pine', light='#c9a576', mid='#b08a5a', dark='#86653d', seed=180)
R, Hh = 0.55, 0.76
t = H.lathe('top', [(0.0, Hh - 0.035), (R - 0.006, Hh - 0.035), (R, Hh - 0.028), (R, Hh - 0.006), (R - 0.006, Hh), (0.0, Hh)], 72, pine, sharp=30); H.uv_planar(t, 1.0)
H.lathe('apron', [(0.4, Hh - 0.12), (0.4, Hh - 0.035), (0.38, Hh - 0.035), (0.38, Hh - 0.12)], 48, pine, uvscale=1.0)
for k in range(4):
    a = PI / 4 + k * PI / 2
    H.lathe('leg', [(0.0, 0.0), (0.03, 0.0), (0.035, 0.05), (0.025, 0.1), (0.04, 0.3), (0.028, 0.5), (0.035, Hh - 0.035), (0.0, Hh - 0.035)], 16, pine, loc=(math.cos(a) * 0.36, math.sin(a) * 0.36, 0))
H.finish('dining_table_round_02', extras={'texres': 1024})
