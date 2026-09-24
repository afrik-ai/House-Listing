# Toilet plunger: red rubber cup, varnished beech handle. ~0.15 x 0.45 m
import sys; sys.path.insert(0, __import__('os').path.dirname(__import__('os').path.abspath(__file__)))
import helpers as H, _kit as K
from helpers import V, PI
import math, random, numpy as np
H.reset()
r = K.plain('plunger_rubber', '#9d1d1a', 0.55); w = K.wood('plunger_beech', light='#d9b98a', mid='#c29f6e', dark='#9a7a4f', seed=130)
H.lathe('cup', [(0.0, 0.07), (0.03, 0.068), (0.065, 0.04), (0.075, 0.0), (0.07, 0.0), (0.06, 0.035), (0.0, 0.055)], 40, r)
h = H.cyl('handle', 0.012, 0.38, loc=(0, 0, 0.065), seg=12, mat=w, bev=0.005); H.uv_box(h, 1.0, along='z')
H.finish('plunger', extras={'texres': 256})
