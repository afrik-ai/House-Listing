# Low ribbed white bowl-vase with a few dried craspedia heads. ~0.16 x 0.12 m
import sys; sys.path.insert(0, __import__('os').path.dirname(__import__('os').path.abspath(__file__)))
import helpers as H, _kit as K
H.reset()
g = K.glaze('glaze_white_rib', '#ece8df', rough=0.4, speck=0.3, seed=7)
inside = K.plain('vase_inside', '#2e2a26', 0.9)
H.lathe('vase', [(0.0, 0.0), (0.05, 0.0), (0.07, 0.02), (0.08, 0.06), (0.075, 0.1), (0.06, 0.115), (0.055, 0.12), (0.05, 0.115), (0.045, 0.1)], 48, g, uvscale=0.15)
H.lathe('inside', [(0.0, 0.1), (0.045, 0.1)], 24, inside)
from helpers import V
import math
st = K.plain('cr_stem', '#8a8a5a', 0.7); hd = K.plain('cr_head', '#d9a93a', 0.85)
for i, (a, l) in enumerate(((0.3, 0.2), (2.5, 0.16), (4.3, 0.23))):
    d = V((math.cos(a) * 0.3, math.sin(a) * 0.3, 1)).normalized(); p0 = V((0, 0, 0.09)); p1 = p0 + d * l
    H.tube('st', [p0, p1], 0.0015, 5, st)
    H.superellipsoid('head', 0.014, 0.014, 0.014, e=2, n=2, nu=12, nv=8, mat=hd, loc=tuple(p1))
H.finish('vase_ceramic_04', extras={'texres': 512})
