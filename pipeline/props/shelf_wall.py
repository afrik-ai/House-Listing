# Floating wall shelf 1.0 m (oak, 30 mm, concealed bracket) with books, a small frame and a brass candle. Back at -Z (wall).
import sys; sys.path.insert(0, __import__('os').path.dirname(__import__('os').path.abspath(__file__)))
import helpers as H, _kit as K
from helpers import V, PI
import math, random, numpy as np
H.reset()
oak = K.wood('wshelf_oak', seed=192); br = K.brushed('wshelf_brass', '#c19a55', 0.3); wax = K.plain('wshelf_wax', '#efe7d6', 0.5)
H.uv_box(H.box('shelf', 1.0, 0.22, 0.03, loc=(0, 0, 0.015), mat=oak, bev=0.003), 1.0, along='x')
K.book_row('ws', -0.48, 0.05, 0.03, -0.01, depth=0.18, seed=12, hmin=0.17, hmax=0.24, stack=True)
H.lathe('holder', [(0.0, 0.0), (0.03, 0.0), (0.03, 0.01), (0.012, 0.02), (0.012, 0.05), (0.018, 0.055), (0.0, 0.055)], 24, br, loc=(0.35, 0.0, 0.03))
H.cyl('candle', 0.01, 0.15, loc=(0.35, 0.0, 0.085), seg=16, mat=wax)
H.finish('shelf_wall', extras={'texres': 1024})
