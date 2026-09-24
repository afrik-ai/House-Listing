# Wall-mounted LED floodlight with PIR sensor: black die-cast body 0.2 x 0.16 x 0.12, tilted down 20 deg,
# on a wall bracket. Back (-Z) to the wall, light face emissive.
import sys, os; sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import helpers as H, _p04kit as K
from helpers import V, PI
import math, numpy as np
H.reset()
bl = K.painted('flood_black', '#1d1e20', 0.5, 0.4)
H.box('plate', 0.08, 0.02, 0.1, loc=(0, 0.1, 0.05), mat=bl, bev=0.003)
K.rod('arm', (0, 0.09, 0.05), (0, 0.04, 0.05), 0.01, bl)
parts = [H.box('body', 0.2, 0.05, 0.16, loc=(0, 0, 0.08), mat=bl, bev=0.006)]
for i in range(7): parts.append(H.box('fin', 0.004, 0.02, 0.14, loc=(-0.09 + i * 0.03, 0.03, 0.08), mat=bl))
parts.append(H.box('lens', 0.17, 0.004, 0.13, loc=(0, -0.026, 0.08), mat=K.emissive('flood_led', '#f4f6ff', 2.0)))
H.xform_about(parts, (0, 0.03, 0.05), (-0.35, 0, 0))
s = H.lathe('pir', [(0, -0.03), (0.02, -0.03), (0.022, 0), (0.015, 0.018), (0, 0.022)], 16, K.plastic('pir_white', '#e8e8e6', 0.4))
s.location = (0, 0.02, -0.02)
H.finish('security_light')
