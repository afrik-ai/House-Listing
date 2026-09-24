# Drain cleaner bottle: squat HDPE bottle in orange with child-lock cap and warning label. ~0.10 x 0.24 m
import sys; sys.path.insert(0, __import__('os').path.dirname(__import__('os').path.abspath(__file__)))
import helpers as H, _kit as K
from helpers import V, PI
import math, random, numpy as np
H.reset()
b = K.plain('drain_orange', '#e0782a', 0.4); cap = K.plain('drain_cap', '#1d1d1d', 0.5); lab = K.plain('drain_label', '#f3efe5', 0.6)
H.superellipsoid('bottle', 0.05, 0.035, 0.09, e=5, n=7, nu=36, nv=10, mat=b, loc=(0, 0, 0.09))
H.box('label', 0.09, 0.072, 0.09, loc=(0, 0, 0.08), mat=lab, bev=0.025, seg=4)
H.lathe('shoulder', [(0.03, 0.17), (0.02, 0.2), (0.02, 0.21)], 24, b)
H.cyl('cap', 0.024, 0.035, loc=(0, 0, 0.205), seg=24, mat=cap, bev=0.004)
H.finish('drain_cleaner', extras={'texres': 256})
