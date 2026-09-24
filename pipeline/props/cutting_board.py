# End-used oak chopping board with rounded handle + hole, knife scars, half a baguette and a chef knife. ~0.50 x 0.25 m (long axis X)
import sys; sys.path.insert(0, __import__('os').path.dirname(__import__('os').path.abspath(__file__)))
import helpers as H, _kit as K
from helpers import V, PI
import math, random, numpy as np
H.reset()
oak = K.wood('board_oak', light='#c9a06c', mid='#ad8250', dark='#7e5a34', seed=33)
bread = K.leather('baguette_crust', '#b87a3c', seed=34)
crumb = K.plain('bread_crumb', '#ead7ae', 0.9)
steel = K.brushed('knife_steel', '#d2d4d6', 0.2)
blk = K.plain('knife_handle', '#1a1714', 0.5)
pts = [(-0.18, -0.12), (0.18, -0.12), (0.22, -0.05), (0.31, -0.035), (0.33, 0.0), (0.31, 0.035), (0.22, 0.05), (0.18, 0.12), (-0.18, 0.12), (-0.2, 0.0)]
b = K.rounded_panel('board', 0.40, 0.25, 0.022, 0.03, oak, loc=(-0.05, 0, 0)); H.uv_box(b, 1.0, along='x')
hnd = K.rounded_panel('handle', 0.14, 0.07, 0.022, 0.03, oak, loc=(0.2, 0, 0)); H.uv_box(hnd, 1.0, along='x')
H.cyl('hole', 0.011, 0.001, loc=(0.24, 0, 0.0225), seg=20, mat=blk)
bg = H.superellipsoid('baguette', 0.13, 0.03, 0.028, e=2.5, n=2.2, nu=24, nv=10, mat=bread, loc=(-0.1, 0.04, 0.05))
H.cyl('cut_face', 0.027, 0.002, loc=(0.03, 0.04, 0.05), rot=(0, PI / 2, 0), seg=16, mat=crumb)
H.box('blade', 0.2, 0.035, 0.002, loc=(-0.06, -0.07, 0.024), mat=steel, bev=0.0008, seg=1)
H.box('knife_hnd', 0.11, 0.022, 0.016, loc=(0.1, -0.07, 0.031), mat=blk, bev=0.006, seg=2)
H.finish('cutting_board', extras={'texres': 512})
