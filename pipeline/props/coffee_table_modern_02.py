# Nesting coffee tables: two rounded-square black-steel frames with smoked glass / travertine tops. ~0.80 x 0.38 m
import sys; sys.path.insert(0, __import__('os').path.dirname(__import__('os').path.abspath(__file__)))
import helpers as H, _kit as K
from helpers import V, PI
import math, random, numpy as np
H.reset()
stl = K.plain('nest_steel', '#1a1a1a', 0.4, 0.7); tra = K.marble('travertine', base='#d9cbb3', vein='#b59f7c', seed=176)
glass = H.pbr('nest_glass', '#3a3530', 0.05, alpha=0.6, blend='BLEND')
for (x, y, s, h, m) in ((0.0, 0.0, 0.7, 0.38, tra), (0.35, -0.2, 0.5, 0.32, glass)):
    t = K.rounded_panel('top', s, s, 0.02, 0.08, m, loc=(x, y, h - 0.02)); H.uv_planar(t, 1.0)
    for sx in (-1, 1):
        H.tube('frame', [V((x + sx * (s / 2 - 0.03), y - s / 2 + 0.03, 0.0)), V((x + sx * (s / 2 - 0.03), y - s / 2 + 0.03, h - 0.02)), V((x + sx * (s / 2 - 0.03), y + s / 2 - 0.03, h - 0.02)), V((x + sx * (s / 2 - 0.03), y + s / 2 - 0.03, 0.0))], 0.008, 8, stl)
H.finish('coffee_table_modern_02', extras={'texres': 1024})
