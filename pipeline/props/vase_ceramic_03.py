# Slim bottle vase, matte charcoal glaze with speckle, single eucalyptus sprig. ~0.10 x 0.26 m
import sys; sys.path.insert(0, __import__('os').path.dirname(__import__('os').path.abspath(__file__)))
import helpers as H, _kit as K
H.reset()
g = K.glaze('glaze_charcoal', '#3b3b3a', rough=0.65, speck=0.0, seed=6)
inside = K.plain('vase_inside', '#2e2a26', 0.9)
H.lathe('vase', [(0.0, 0.0), (0.035, 0.0), (0.045, 0.008), (0.05, 0.1), (0.045, 0.16), (0.02, 0.2), (0.013, 0.23), (0.016, 0.26), (0.01, 0.26), (0.009, 0.23)], 48, g, uvscale=0.15)
H.lathe('inside', [(0.0, 0.23), (0.009, 0.23)], 24, inside)
from helpers import V
st = K.plain('euc_stem', '#6f7a5c', 0.7); lf = K.plain('euc_leaf', '#8fa392', 0.6)
import math
pts = [V((0, 0, 0.22)), V((0.02, 0, 0.32)), V((0.06, 0.01, 0.42))]
H.tube('stem', pts, 0.0018, 5, st)
for i in range(9):
    t = 0.15 + i * 0.09; p = pts[0].lerp(pts[1], min(1, t * 2)) if t < 0.5 else pts[1].lerp(pts[2], (t - 0.5) * 2)
    for s in (-1, 1):
        l = H.cyl('leaf', 0.014 - i * 0.0006, 0.0015, loc=(p.x + s * 0.012, p.y, p.z), seg=12, mat=lf)
        l.rotation_euler = (0.3 * s, 1.2 * s, i)
H.finish('vase_ceramic_03', extras={'texres': 512})
