# Snake plant (Sansevieria trifasciata) in a matte white cylinder pot: ~0.75 m, 0.26 m pot.
import sys, os; sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import helpers as H, _p04veg as G
from helpers import V, PI
import math, numpy as np
H.reset()
img, nc = G.single_leaf_img('sansevieria_leaf', dict(leaf='#2f5a2c', aspect=0.22, shape='lance', vein=0.0, variegate=True, margin='#c9bf52'), n=3, seed=2)
lm = H.pbr('leaves_sansevieria', '#ffffff', 0.45, base_tex=img, alpha_tex=True, cull=False, spec=0.5)
potm = H.pbr('pot_white_matte', '#e9e6e0', 0.75)
sz = G.pot('pot', 0.13, 0.26, 'cyl', potm, G.soil_mat())
rng = np.random.default_rng(3)
L = G.Mesh(); L.fuv = []
for i in range(13):
    a = 2 * PI * i / 13 * 1.618
    out = V((math.cos(a), math.sin(a), 0))
    r0 = rng.uniform(0, 0.06)
    d = (out * rng.uniform(0.05, 0.35) + V((0, 0, 1))).normalized()
    side = V((-out.y, out.x, 0))
    size = rng.uniform(0.35, 0.55)
    G.leaf_geo(L, V((out.x * r0, out.y * r0, sz - 0.02)), d, side, size, size * 0.6, int(rng.integers(0, nc)), nc, arch=0.04, cup=0.5, twist=rng.uniform(-0.6, 0.6), nu=2, nv=6)
G.mesh_obj(L, 'leaves', lm)
H.finish('plant_potted_01')
