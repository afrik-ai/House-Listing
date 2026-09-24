# Spray cleaner bottle: translucent blue liquid in a white-cap trigger sprayer, printed label band. ~0.10 x 0.28 m
import sys; sys.path.insert(0, __import__('os').path.dirname(__import__('os').path.abspath(__file__)))
import helpers as H, _kit as K
from helpers import V, PI
import math, random, numpy as np
H.reset()
body = H.pbr('cleaner_plastic', '#3f8fd0', 0.25, alpha=0.9, blend='BLEND')
wh = K.plain('trigger_white', '#f0f0ee', 0.45); lab = K.plain('cleaner_label', '#f7f2e4', 0.6); lg = K.plain('cleaner_label_ink', '#1e5f9a', 0.6)
b = H.superellipsoid('bottle', 0.05, 0.03, 0.09, e=4, n=6, nu=40, nv=12, mat=body, loc=(0, 0, 0.09))
H.box('label', 0.086, 0.062, 0.08, loc=(0, 0, 0.085), mat=lab, bev=0.02, seg=4)
H.box('band', 0.087, 0.063, 0.012, loc=(0, 0, 0.1), mat=lg, bev=0.02, seg=4)
H.lathe('neck', [(0.0, 0.18), (0.02, 0.18), (0.016, 0.2), (0.0, 0.2)], 24, body)
H.cyl('collar', 0.02, 0.02, loc=(0, 0, 0.195), seg=24, mat=wh, bev=0.003)
H.box('head', 0.03, 0.09, 0.035, loc=(0, -0.025, 0.232), mat=wh, bev=0.008)
H.box('nozzle', 0.018, 0.02, 0.018, loc=(0, -0.078, 0.238), mat=wh, bev=0.004)
t = H.box('trigger', 0.016, 0.012, 0.05, loc=(0, -0.05, 0.195), mat=wh, bev=0.004); t.rotation_euler = (0.3, 0, 0)
H.finish('cleaner_bottle', extras={'texres': 256})
