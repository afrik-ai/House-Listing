# Money tree (Pachira aquatica), 4 GLBs plant_pachira_a..d (0.6-1.6 m, plant only, base = soil): braided
# 3-stem trunk, crown of palmate leaves (5 glossy leaflets per petiole).
import sys, os; sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import helpers as H, _p04veg as G
from helpers import V, PI
import math, numpy as np
SIZES = {'a': 0.6, 'b': 1.0, 'c': 1.3, 'd': 1.6}
for si, (k, h) in enumerate(SIZES.items()):
    H.reset()
    img, nc = G.single_leaf_img('pachira_leaflet', dict(leaf='#3c6a2a', tip='#4f7d33', aspect=0.36, shape='ovate', vein=0.1), n=4, seed=9)
    lm = H.pbr('leaves_pachira', '#ffffff', 0.4, base_tex=img, alpha_tex=True, cull=False, spec=0.55)
    bark = G.bark_mat('pachira_bark', 'olive', seed=4, N=256)
    sm = H.pbr('pachira_petiole', '#58793c', 0.6)
    rng = np.random.default_rng(30 + si)
    B = G.Mesh(); B.fuv = []; L = G.Mesh(); L.fuv = []; S = G.Mesh(); S.fuv = []
    th = h * 0.5
    for s in range(3):   # braid
        pts = []
        for i in range(25):
            t = i / 24
            a = s * 2 * PI / 3 + t * 5.5
            r = 0.022 * (1 - 0.3 * t)
            pts.append(V((math.cos(a) * r, math.sin(a) * r, t * th)))
        radii = [0.016 * (1 - 0.45 * i / 24) * (1 + 0.5 * max(0, 1 - i / 3)) for i in range(25)]
        G.tube(B, pts, radii, 7, 0.15)
    top = V((0, 0, th))
    nb = 10 + int(h * 16)
    for b in range(nb):
        a = b * 2.39996 + rng.uniform(-0.2, 0.2)
        out = V((math.cos(a), math.sin(a), 0))
        z0 = th - rng.uniform(0, 0.08) * h
        pl = h * rng.uniform(0.15, 0.42)
        pts = G.curve((0, 0, z0), out * rng.uniform(0.3, 1.0) + V((0, 0, 1.0)), pl, 5, droop=0.25)
        G.stem(S, pts, 0.004, 0.0025, 4)
        tip = pts[-1]; td = (pts[-1] - pts[-2]).normalized()
        n5 = 5 if rng.uniform() > 0.2 else 7
        for j in range(n5):
            fan = (j - (n5 - 1) / 2) / ((n5 - 1) / 2)
            dd = (out * 0.8 + V((0, 0, 0.2)))
            q = __import__('mathutils').Quaternion(V((0, 0, 1)), fan * 1.2)
            dd = q @ dd
            side = V((0, 0, 1)).cross(dd)
            size = h * 0.2 * (1 - 0.35 * abs(fan)) * rng.uniform(0.9, 1.1)
            G.leaf_geo(L, tip, dd, side, size, size * 0.85, int(rng.integers(0, nc)), nc, arch=0.3, cup=0.2, nu=2, nv=5)
    G.mesh_obj(B, 'trunk', bark); G.mesh_obj(S, 'petioles', sm); G.mesh_obj(L, 'leaves', lm)
    H.finish(f'plant_pachira_{k}')
G.outputs('plant_pachira', [f'plant_pachira_{k}' for k in SIZES])
