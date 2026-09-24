# Floor (track) bicycle pump 0.62 m: steel barrel, T-handle, round gauge, tripod base, coiled black hose.
import sys, os; sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import helpers as H, _p04kit as K
from helpers import V, PI
import math, numpy as np
H.reset()
blk = K.plastic('pump_black', '#1d1d1f', 0.5)
st = K.steel()
red = K.painted('pump_red', '#b0231c', 0.4, 0.2)
for a in (0, 2.1, 4.2):
    b = H.box('foot', 0.14, 0.03, 0.02, loc=(math.cos(a) * 0.07, math.sin(a) * 0.07, 0.01), mat=blk, bev=0.005); b.rotation_euler = (0, 0, a)
H.cyl('barrel', 0.022, 0.5, loc=(0, 0, 0.02), seg=20, mat=red)
H.cyl('rod', 0.006, 0.08, loc=(0, 0, 0.52), seg=10, mat=st)
K.rod('thandle', (-0.1, 0, 0.61), (0.1, 0, 0.61), 0.015, blk)
g = H.cyl('gauge', 0.035, 0.025, loc=(0, -0.03, 0.08), rot=(PI / 2, 0, 0), seg=24, mat=blk)
H.cyl('gface', 0.03, 0.002, loc=(0, -0.056, 0.08), rot=(PI / 2, 0, 0), seg=24, mat=K.plastic('gauge_white', '#eeeeea', 0.3))
pts = [V((0.02 + 0.07 * math.cos(t) * (1 - t / 20), 0.02 + 0.05 * math.sin(t), 0.06 + t * 0.018)) for t in np.linspace(0, 14, 60)]
H.tube('hose', pts, 0.005, 8, mat=blk)
H.finish('tire_pump')
