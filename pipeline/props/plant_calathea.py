# Calathea orbifolia, 5 GLBs plant_calathea_a..e (0.35-0.7 m, plant only: base = soil level, used inside the
# furnish 'planter' proc). Real curved mesh leaves (round, silver-striped) on arching petioles.
import sys, os; sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import helpers as H, _p04veg as G
from helpers import V, PI
import math, numpy as np
SIZES = {'a': (7, 0.38), 'b': (10, 0.5), 'c': (8, 0.42), 'd': (12, 0.6), 'e': (14, 0.7)}
for si, (k, (n, h)) in enumerate(SIZES.items()):
    H.reset()
    img, nc = G.single_leaf_img('calathea_leaf', dict(leaf='#476b39', aspect=0.92, shape='round', vein=0.06, stripes=9, stripe_col='#aebfa0'), n=4, seed=3)
    lm = H.pbr('leaves_calathea', '#ffffff', 0.45, base_tex=img, alpha_tex=True, cull=False, spec=0.5)
    sm = H.pbr('calathea_stem', '#5d7a45', 0.6)
    rng = np.random.default_rng(10 + si)
    L = G.Mesh(); L.fuv = []; S = G.Mesh(); S.fuv = []
    for i in range(n):
        a = 2 * PI * i / n * 1.618 + rng.uniform(-0.3, 0.3)
        out = V((math.cos(a), math.sin(a), 0))
        pl = h * rng.uniform(0.45, 0.8)
        tilt = rng.uniform(0.15, 0.55)
        pts = G.curve((out.x * 0.02, out.y * 0.02, 0), out * tilt + V((0, 0, 1)), pl, 6, droop=0.1)
        G.stem(S, pts, 0.005, 0.003, 5)
        tipd = (pts[-1] - pts[-2]).normalized()
        d = (out * 0.9 + V((0, 0, 0.55))).normalized()
        side = V((-out.y, out.x, 0))
        size = h * rng.uniform(0.5, 0.62)
        G.leaf_geo(L, pts[-1] - d * 0.01, d, side, size, size * 0.95, int(rng.integers(0, nc)), nc, arch=0.18, cup=0.18, twist=rng.uniform(-0.3, 0.3))
    G.mesh_obj(S, 'stems', sm); G.mesh_obj(L, 'leaves', lm)
    H.finish(f'plant_calathea_{k}')
G.outputs('plant_calathea', [f'plant_calathea_{k}' for k in SIZES])
