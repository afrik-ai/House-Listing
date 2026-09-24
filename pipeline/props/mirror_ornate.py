# Ornate arched wall mirror: gilt carved frame, bevelled silvered glass. ~0.70 x 1.10 m, back at -Z (wall).
import sys; sys.path.insert(0, __import__('os').path.dirname(__import__('os').path.abspath(__file__)))
import helpers as H, _kit as K
from helpers import V, PI
import math, random, numpy as np
H.reset()
gilt = K.brushed('mirror_gilt', '#c7a050', 0.3, seed=150)
mir = K.plain('mirror_silver', '#e8eaec', 0.02, 1.0)
W, Hh = 0.7, 1.1
def arch(w, h, n=40):
    pts = [(-w / 2, -h / 2), (w / 2, -h / 2)]
    for i in range(n + 1):
        a = i / n * PI
        pts.append((math.cos(a) * w / 2, h / 2 - w / 2 + math.sin(a) * w / 2))
    return pts
path = [V((x, 0, z)) for x, z in arch(W - 0.07, Hh - 0.07)]
fr = H.sweep('frame', path, [(-0.012, -0.035), (0.02, -0.035), (0.02, 0.035), (0.0, 0.035), (-0.01, 0.022), (-0.018, 0.01), (-0.01, 0.0), (-0.02, -0.015)], gilt, closed=True, up=(0, 1, 0))
m = H.extrude_poly('glass', arch(W - 0.1, Hh - 0.1), 0.0, 0.006, mir, plane='XZ')
H.lathe('crest', [(0.0, 0.0), (0.04, 0.0), (0.03, 0.03), (0.0, 0.05)], 16, gilt, loc=(0, -0.01, Hh / 2 + 0.01), rot=(PI / 2, 0, 0))
H.finish('mirror_ornate', extras={'texres': 512})
