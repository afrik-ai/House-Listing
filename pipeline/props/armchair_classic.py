# Classic wingback armchair: rust velvet, wings + rolled arms, piped seat cushion, turned walnut legs. ~0.80 x 0.85 x 1.05 m, front +Z.
import sys; sys.path.insert(0, __import__('os').path.dirname(__import__('os').path.abspath(__file__)))
import helpers as H, _kit as K
from helpers import V, PI
import math, random, numpy as np
H.reset()
vel = K.fabric('velvet_rust', '#8a4a30', threads=200, seed=172, sheen=0.6, strength=0.6)
pipe = K.fabric('velvet_rust_pipe', '#6f3a25', threads=200, seed=173)
wal = K.wood('wing_walnut', light='#6e4c34', mid='#553a27', dark='#34231a', seed=174)
W, D = 0.80, 0.82
H.uv_box(H.superellipsoid('base', W / 2, D / 2, 0.1, e=10, n=6, nu=48, nv=10, mat=vel, loc=(0, 0, 0.3)), 0.25)
H.uv_box(H.superellipsoid('back', W / 2 - 0.04, 0.08, 0.38, e=8, n=4, nu=48, nv=14, mat=vel, loc=(0, D / 2 - 0.08, 0.66)), 0.25)
for s in (-1, 1):
    H.uv_box(H.superellipsoid('arm', 0.07, D / 2 - 0.05, 0.14, e=6, n=3, nu=40, nv=12, mat=vel, loc=(s * (W / 2 - 0.07), -0.03, 0.5)), 0.25)
    w = H.superellipsoid('wing', 0.05, 0.2, 0.26, e=4, n=3, nu=32, nv=12, mat=vel, loc=(s * (W / 2 - 0.06), D / 2 - 0.2, 0.84)); w.rotation_euler = (0, 0, s * 0.25); H.uv_box(w, 0.25)
K.cushion('seat', W - 0.26, D - 0.2, 0.12, vel, loc=(0, -0.06, 0.45), crown=0.25, pipe=pipe, pipe_r=0.004)
for sx in (-1, 1):
    for sy in (-1, 1):
        H.lathe('leg', [(0.0, 0.0), (0.016, 0.0), (0.02, 0.05), (0.015, 0.12), (0.024, 0.2), (0.0, 0.2)], 16, wal, loc=(sx * (W / 2 - 0.07), sy * (D / 2 - 0.07), 0))
H.finish('armchair_classic', extras={'texres': 1024})
