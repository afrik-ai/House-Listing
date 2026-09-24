# Modern pendant: smoked-brass dome shade (0.36 m) with white inner reflector + opal diffuser (emissive),
# braided black cord to a ceiling canopy. Origin: shade bottom at y=0, canopy top at y=0.97 (hung 1.9 m above
# floor under a 2.85 m ceiling).
import sys; sys.path.insert(0, __import__('os').path.dirname(__import__('os').path.abspath(__file__)))
import helpers as H, _kit as K
from helpers import V, PI
import math, random, numpy as np
H.reset()
br = K.brushed('pendant_brass', '#8c6c3c', 0.3, seed=60)
wh = K.plain('pendant_inner', '#f2efe8', 0.6)
opal = H.pbr('pendant_opal', '#fff6e6', 0.4, emit='#ffd9a8', emit_str=6.0)
cord = K.plain('pendant_cord', '#151515', 0.8)
Hc = 0.97
sh = H.lathe('shade', [(0.18, 0.0), (0.178, 0.03), (0.16, 0.12), (0.11, 0.2), (0.04, 0.24), (0.02, 0.25)], 64, br); H.solidify(sh, 0.002)
H.lathe('inner', [(0.176, 0.002), (0.157, 0.118), (0.108, 0.196), (0.0, 0.235)], 64, wh)
H.lathe('diffuser', [(0.0, 0.06), (0.09, 0.07), (0.12, 0.09)], 48, opal)
H.cyl('socket', 0.022, 0.05, loc=(0, 0, 0.24), seg=20, mat=br, bev=0.004)
H.cyl('cord', 0.003, Hc - 0.32, loc=(0, 0, 0.29), seg=8, mat=cord)
H.lathe('canopy', [(0.0, Hc - 0.03), (0.06, Hc - 0.03), (0.065, Hc - 0.02), (0.065, Hc), (0.0, Hc)], 40, br)
H.finish('pendant_lamp_modern', extras={'texres': 512})
