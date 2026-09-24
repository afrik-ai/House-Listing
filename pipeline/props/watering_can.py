# Galvanised watering can (9 l): oval body, long spout with brass rose, top carry handle. ~0.52 x 0.36 x 0.2.
import sys, os; sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import helpers as H, _p04kit as K
from helpers import V, PI
import math, numpy as np
H.reset()
g = K.galvanized()
brass = K.steel('brass', '#b58d45', 0.3)
body = H.lathe('body', [(0, 0), (0.1, 0), (0.105, 0.01), (0.105, 0.2), (0.095, 0.22), (0.05, 0.235), (0, 0.235)], 32, g)
body.scale = (1.15, 0.85, 1)
H.tube('spout', [V((0.1, 0, 0.04)), V((0.2, 0, 0.12)), V((0.3, 0, 0.23)), V((0.33, 0, 0.27))], 0.012, 10, mat=g)
H.cyl('rose', 0.028, 0.02, loc=(0.33, 0, 0.27), rot=(0, 0.9, 0), seg=16, mat=brass)
H.tube('handle', [V((-0.08, 0, 0.22)) + V((0, 0, 0))] + [V((-0.08 + 0.16 * t, 0, 0.23 + 0.12 * math.sin(PI * t))) for t in np.linspace(0.05, 0.95, 10)] + [V((0.08, 0, 0.22))], 0.008, 8, mat=g)
H.tube('back_handle', [V((-0.12, 0, 0.05)), V((-0.17, 0, 0.12)), V((-0.12, 0, 0.19))], 0.008, 8, mat=g)
H.finish('watering_can')
