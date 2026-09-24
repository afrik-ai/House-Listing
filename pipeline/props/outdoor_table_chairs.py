# Teak outdoor dining set: 1.6 x 0.9 m slatted table (0.75 m) + 4 slatted armless chairs pulled in
# (2 per long side). Overall ~1.7 x 0.9 x 1.75 m. Table length along X.
import sys, os; sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import helpers as H, _p04kit as K
from helpers import V, PI
import math, numpy as np
H.reset()
teak = K.wood('teak_set', '#b48d62', '#977049', '#735236', 0.62, seed=81)
TW, TD, TH = 1.6, 0.9, 0.75
for sx in (-1, 1):
    for sy in (-1, 1):
        K.plank('tleg', (sx * (TW / 2 - 0.08) - 0.03, sy * (TD / 2 - 0.08) - 0.03, 0), (sx * (TW / 2 - 0.08) + 0.03, sy * (TD / 2 - 0.08) + 0.03, TH - 0.03), teak, 'z')
for sy in (-1, 1): K.plank('apron', (-TW / 2 + 0.08, sy * (TD / 2 - 0.08) - 0.012, TH - 0.12), (TW / 2 - 0.08, sy * (TD / 2 - 0.08) + 0.012, TH - 0.03), teak, 'x')
for sx in (-1, 1): K.plank('apron', (sx * (TW / 2 - 0.08) - 0.012, -TD / 2 + 0.08, TH - 0.12), (sx * (TW / 2 - 0.08) + 0.012, TD / 2 - 0.08, TH - 0.03), teak, 'y')
n = 11
for i in range(n):
    y0 = -TD / 2 + i * TD / n
    K.plank('tslat', (-TW / 2, y0 + 0.004, TH - 0.03), (TW / 2, y0 + TD / n - 0.004, TH), teak, 'x', 0.003)
def chair(cx, cy, face):
    parts = []
    SW, SD, SH = 0.46, 0.46, 0.45
    for sx in (-1, 1):
        parts.append(K.plank('cleg', (sx * (SW / 2 - 0.03) - 0.02, -SD / 2, 0), (sx * (SW / 2 - 0.03) + 0.02, -SD / 2 + 0.04, SH), teak, 'z'))
        parts.append(K.plank('cback', (sx * (SW / 2 - 0.03) - 0.02, SD / 2 - 0.04, 0), (sx * (SW / 2 - 0.03) + 0.02, SD / 2, 0.9), teak, 'z'))
        parts.append(K.plank('crail', (sx * (SW / 2 - 0.03) - 0.015, -SD / 2, SH - 0.08), (sx * (SW / 2 - 0.03) + 0.015, SD / 2, SH - 0.02), teak, 'y'))
    for i in range(5):
        y0 = -SD / 2 + i * SD / 5
        parts.append(K.plank('cslat', (-SW / 2, y0 + 0.004, SH - 0.02), (SW / 2, y0 + SD / 5 - 0.004, SH), teak, 'x', 0.003))
    for z in (0.58, 0.7, 0.82):
        parts.append(K.plank('cbslat', (-SW / 2 + 0.03, SD / 2 - 0.035, z), (SW / 2 - 0.03, SD / 2 - 0.015, z + 0.08), teak, 'x', 0.003))
    H.xform_about(parts, (0, 0, 0), (0, 0, face))
    for p in parts: p.location = V(tuple(p.location)) + V((cx, cy, 0))
for x in (-0.4, 0.4):
    chair(x, -0.62, 0.0)
    chair(x, 0.62, PI)
H.finish('outdoor_table_chairs')
