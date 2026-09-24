# Fiddle-leaf fig (Ficus lyrata) in a tapered charcoal fibre-clay pot: ~1.45 m, big violin-shaped glossy leaves.
import sys, os; sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import helpers as H, _p04veg as G
from helpers import V, PI
import math, numpy as np
H.reset()
img, nc = G.single_leaf_img('ficus_lyrata_leaf', dict(leaf='#2e5a23', tip='#3d6b2a', aspect=0.78, shape='round', vein=0.18), n=3, seed=4)
lm = H.pbr('leaves_ficus', '#ffffff', 0.35, base_tex=img, alpha_tex=True, cull=False, spec=0.6)
potm = H.pbr('pot_charcoal', '#3b3a38', 0.85)
bark = G.bark_mat('ficus_bark', 'olive', seed=6, N=256)
sz = G.pot('pot', 0.2, 0.38, 'taper', potm, G.soil_mat())
rng = np.random.default_rng(5)
B = G.Mesh(); B.fuv = []; L = G.Mesh(); L.fuv = []
trunk = G.curve((0, 0, sz - 0.02), (0.05, 0.02, 1), 1.0, 8, wig=0.03, rng=rng)
G.tube(B, trunk, [0.022 - 0.012 * i / 8 for i in range(9)], 7, 0.2)
for i in range(22):
    t = 0.3 + 0.7 * i / 21
    fi = t * 8; i0 = min(int(fi), 7)
    p = trunk[i0].lerp(trunk[i0 + 1], fi - i0)
    a = i * 2.39996
    out = V((math.cos(a), math.sin(a), 0))
    d = (out * 0.8 + V((0, 0, 0.6 + 0.4 * t))).normalized()
    side = V((-out.y, out.x, 0))
    size = rng.uniform(0.2, 0.3) * (1.1 - 0.3 * t)
    G.leaf_geo(L, p, d, side, size, size * 0.85, int(rng.integers(0, nc)), nc, arch=0.22, cup=0.2, twist=rng.uniform(-0.3, 0.3))
G.mesh_obj(B, 'trunk', bark); G.mesh_obj(L, 'leaves', lm)
H.finish('plant_potted_02')
