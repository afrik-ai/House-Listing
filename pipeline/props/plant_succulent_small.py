# Small echeveria rosette in a terracotta pot (0.11 m pot, 0.14 m overall): fleshy blue-green leaves with
# pink tips (lathe-like wedge leaves in 3 whorls). Shelf / windowsill prop.
import sys, os; sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import helpers as H, _p04veg as G
from helpers import V, PI
import math, numpy as np
H.reset()
terra = H.pbr('terracotta', '#b0643e', 0.85)
leaf = H.pbr('succulent_leaf', '#7fa39a', 0.55, spec=0.4)
sz = G.pot('pot', 0.055, 0.09, 'taper', terra, G.soil_mat())
def fleshy(name, L, W, T, mat):
    """Wedge-shaped fleshy leaf along +X (superellipsoid squashed + pointed)."""
    o = H.superellipsoid(name, L / 2, W / 2, T / 2, e=2.2, n=2.2, nu=12, nv=6, mat=mat)
    for v in o.data.vertices:
        x = v.co.x / (L / 2)
        k = 1 - 0.55 * max(0, x) ** 2
        v.co.y *= k; v.co.z *= k * (1 - 0.3 * max(0, x))
        v.co.x += L / 2
    return o
rng = np.random.default_rng(2)
for w, (n, L, tilt) in enumerate([(8, 0.05, 0.35), (7, 0.04, 0.75), (5, 0.028, 1.1)]):
    for i in range(n):
        a = 2 * PI * i / n + w * 0.4
        o = fleshy(f'l{w}_{i}', L, L * 0.55, L * 0.22, leaf)
        o.rotation_euler = (0, -tilt, a); o.location = (0, 0, sz + 0.008 + w * 0.009)
H.finish('plant_succulent_small')
