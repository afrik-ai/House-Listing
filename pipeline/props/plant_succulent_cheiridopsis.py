# Cheiridopsis (lobster-claw ice plant) clumps in shallow clay bowls, variants plant_succulent_cheiridopsis_a..b:
# paired grey-green fleshy finger leaves.
import sys, os; sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import helpers as H, _p04veg as G
from helpers import V, PI
import math, numpy as np
H.reset()
clay = H.pbr('clay_bowl', '#a88a72', 0.9)
leaf = H.pbr('cheiridopsis_leaf', '#9fb3a3', 0.6)
soil = G.soil_mat()
Vv = {}
for vi, (r, n) in enumerate([(0.09, 9), (0.13, 15)]):
    objs = []
    import bpy
    before = set(bpy.data.objects)
    sz = G.pot(f'bowl{vi}', r, 0.07, 'bowl', clay, soil)
    rng = np.random.default_rng(10 + vi)
    for i in range(n):
        rr = r * 0.7 * math.sqrt(rng.uniform()); a = rng.uniform(0, 2 * PI)
        for s in (-1, 1):
            L = rng.uniform(0.05, 0.08)
            o = H.superellipsoid(f'f{vi}_{i}_{s}', 0.009, 0.007, L / 2, e=2, n=2.4, nu=10, nv=8, mat=leaf)
            for v in o.data.vertices:
                t = (v.co.z / (L / 2) + 1) / 2
                v.co.x *= 1 - 0.6 * t ** 2; v.co.y *= 1 - 0.6 * t ** 2
                v.co.x += 0.012 * t * t * s
                v.co.z += L / 2
            o.location = (math.cos(a) * rr + s * 0.004, math.sin(a) * rr, sz - 0.005)
            o.rotation_euler = (rng.uniform(-0.25, 0.25), s * rng.uniform(0.05, 0.3), a)
    Vv[f'plant_succulent_cheiridopsis_{"ab"[vi]}'] = [o for o in bpy.data.objects if o not in before]
    for o in Vv[f'plant_succulent_cheiridopsis_{"ab"[vi]}']: o.location.x += vi * 0.5
H.finish('plant_succulent_cheiridopsis', variants=Vv)
