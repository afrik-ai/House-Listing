# Spare LED A60 bulb (E27): frosted glass, white plastic neck, aluminium screw base. ~0.06 x 0.11 m (lying on side)
import sys; sys.path.insert(0, __import__('os').path.dirname(__import__('os').path.abspath(__file__)))
import helpers as H, _kit as K
from helpers import V, PI
import math, random, numpy as np
H.reset()
fr = H.pbr('led_frost', '#f4f3ef', 0.4, alpha=0.9, blend='BLEND'); pl = K.plain('led_neck', '#eeeeea', 0.4); al = K.plain('led_base', '#c8c8c8', 0.3, 1.0)
parts = [H.lathe('glass', [(0.0, 0.11), (0.02, 0.108), (0.03, 0.09), (0.029, 0.065), (0.017, 0.045)], 32, fr),
         H.lathe('neck', [(0.017, 0.045), (0.016, 0.03)], 24, pl),
         H.lathe('screw', [(0.0, 0.0), (0.008, 0.0), (0.013, 0.006)] + [(0.0135 + 0.001 * (i % 2), 0.008 + i * 0.0025) for i in range(9)] + [(0.016, 0.03)], 24, al)]
H.xform_about(parts, (0, 0, 0.03), (PI / 2, 0, 0))
H.finish('lightbulb_led', extras={'texres': 256})
