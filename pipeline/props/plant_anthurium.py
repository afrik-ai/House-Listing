# Anthurium andraeanum, 6 GLBs plant_anthurium_a..f (0.35-0.6 m, plant only, base = soil): glossy dark heart
# leaves on upright petioles + waxy red (or white/pink) spathes with yellow-cream spadix.
import sys, os; sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import helpers as H, _p04veg as G
from helpers import V, PI
import math, numpy as np
SIZES = {'a': (6, 0.38, '#c8161e'), 'b': (8, 0.45, '#c8161e'), 'c': (7, 0.42, '#f1eee6'), 'd': (9, 0.5, '#e98aa3'), 'e': (10, 0.55, '#b3121a'), 'f': (11, 0.6, '#c8161e')}
for si, (k, (n, h, sp_col)) in enumerate(SIZES.items()):
    H.reset()
    img, nc = G.single_leaf_img('anthurium_leaf', dict(leaf='#23471f', aspect=0.62, shape='ovate', vein=0.12), n=3, seed=5)
    lm = H.pbr('leaves_anthurium', '#ffffff', 0.3, base_tex=img, alpha_tex=True, cull=False, spec=0.6)
    simg, snc = G.single_leaf_img(f'anthurium_spathe_{k}', dict(leaf=sp_col, aspect=0.75, shape='ovate', vein=0.25), n=2, seed=7)
    spm = H.pbr('leaves_anthurium_spathe', '#ffffff', 0.2, base_tex=simg, alpha_tex=True, cull=False, spec=0.7, coat=0.5)
    sm = H.pbr('anthurium_stem', '#3f5f2e', 0.5)
    dm = H.pbr('anthurium_spadix', '#e8d27a', 0.6)
    rng = np.random.default_rng(20 + si)
    L = G.Mesh(); L.fuv = []; S = G.Mesh(); S.fuv = []; F = G.Mesh(); F.fuv = []
    for i in range(n + 3):
        flower = i >= n
        a = 2 * PI * i / (n + 3) * 1.618 + rng.uniform(-0.3, 0.3)
        out = V((math.cos(a), math.sin(a), 0))
        pl = h * (rng.uniform(0.5, 0.8) if not flower else rng.uniform(0.8, 1.0))
        pts = G.curve((out.x * 0.015, out.y * 0.015, 0), out * rng.uniform(0.1, 0.4) + V((0, 0, 1)), pl, 6, droop=0.05)
        G.stem(S, pts, 0.004, 0.003, 5)
        d = (out * 0.7 + V((0, 0, 0.2 if not flower else 0.6))).normalized()
        side = V((-out.y, out.x, 0))
        if not flower:
            size = h * rng.uniform(0.42, 0.55)
            G.leaf_geo(L, pts[-1] - d * 0.02, (d - V((0, 0, 0.5))).normalized(), side, size, size * 0.95, int(rng.integers(0, nc)), nc, arch=0.12, cup=0.12)
        else:
            size = h * 0.22
            G.leaf_geo(F, pts[-1] - V((0, 0, 0.02)), (out * 0.8 + V((0, 0, 0.4))).normalized(), side, size, size * 0.75, int(rng.integers(0, snc)), snc, arch=0.1, cup=0.25)
            sp = H.cyl('spadix', 0.005, h * 0.1, loc=tuple(pts[-1]), seg=8, mat=dm, r2=0.003)
            sp.rotation_euler = (0.5 * math.cos(a + PI / 2), 0.5 * math.sin(a + PI / 2), 0)
    G.mesh_obj(S, 'stems', sm); G.mesh_obj(L, 'leaves', lm); G.mesh_obj(F, 'spathes', spm)
    H.finish(f'plant_anthurium_{k}')
G.outputs('plant_anthurium', [f'plant_anthurium_{k}' for k in SIZES])
