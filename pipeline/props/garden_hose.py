# Wall-mounted hose reel 0.42 x 0.48 x 0.26 m: green plastic drum on a grey bracket with crank, wound green
# hose (coils) and spray gun hanging on the front. Back (-Z) to the wall.
import sys, os; sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import helpers as H, _p04kit as K
from helpers import V, PI
import math, numpy as np
H.reset()
grey = K.plastic('reel_grey', '#5d6266', 0.55)
green = K.plastic('hose_green', '#2f7a2f', 0.45)
H.box('backplate', 0.3, 0.02, 0.4, loc=(0, 0.12, 0.24), mat=grey, bev=0.005)
for sx in (-1, 1): H.box('arm', 0.02, 0.2, 0.06, loc=(sx * 0.16, 0.03, 0.3), mat=grey, bev=0.004)
for sx in (-1, 1): H.cyl('flange', 0.16, 0.012, loc=(sx * 0.14, 0, 0.3), rot=(0, PI / 2, 0), seg=40, mat=green)
pts = []
for t in np.linspace(0, 1, 260):
    turns = 14; k = t * turns
    a = k * 2 * PI; layer = 0.07 + 0.012 * (k // 4.6)
    x = -0.12 + ((k % 4.6) / 4.6) * 0.24
    pts.append(V((x, math.cos(a) * layer, 0.3 + math.sin(a) * layer)))
H.tube('hose', pts, 0.0085, 8, mat=green)
H.tube('hang', [V((0.1, -0.07, 0.3)), V((0.12, -0.12, 0.15)), V((0.05, -0.1, 0.06))], 0.0085, 8, mat=green)
H.box('gun', 0.03, 0.04, 0.12, loc=(0.03, -0.1, 0.06), mat=K.plastic('gun_orange', '#d86a1c', 0.5), bev=0.008)
K.rod('crank', (0.15, 0, 0.3), (0.2, 0, 0.3), 0.01, grey); K.rod('knob', (0.2, 0, 0.3), (0.2, -0.08, 0.3), 0.012, grey)
H.finish('garden_hose')
