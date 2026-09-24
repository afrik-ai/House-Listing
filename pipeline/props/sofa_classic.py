# Classic rolled-arm sofa (Chesterfield-ish): deep green velvet, button-tufted back, turned walnut feet, bolster
# cushions. ~2.00 x 0.90 x 0.78 m, front +Z.
import sys; sys.path.insert(0, __import__('os').path.dirname(__import__('os').path.abspath(__file__)))
import helpers as H, _kit as K
from helpers import V, PI
import math, random, numpy as np
H.reset()
vel = K.fabric('velvet_green', '#2f4a3a', threads=200, seed=170, sheen=0.6, strength=0.6)
wal = K.wood('classic_walnut', light='#6e4c34', mid='#553a27', dark='#34231a', seed=171)
W, D = 2.0, 0.9
H.uv_box(H.superellipsoid('base', W / 2, D / 2, 0.12, e=12, n=6, nu=64, nv=10, mat=vel, loc=(0, 0, 0.26)), 0.25)
for s in (-1, 1):
    arm = H.sweep('arm', [V((s * (W / 2 - 0.1), y, 0.0)) for y in np.linspace(-D / 2 + 0.02, D / 2 - 0.02, 8)],
                  [(math.cos(a) * 0.1 + 0.0, math.sin(a) * 0.1) for a in np.linspace(0, 2 * PI, 20, endpoint=False)], vel, caps=True, up=(0, 0, 1))
    arm.location = (0, 0, 0.56); H.uv_box(arm, 0.25)
    H.uv_box(H.box('arm_side', 0.16, D - 0.04, 0.3, loc=(s * (W / 2 - 0.1), 0, 0.37), mat=vel, bev=0.05, seg=3), 0.25)
back = H.superellipsoid('back', W / 2 - 0.05, 0.1, 0.25, e=10, n=5, nu=64, nv=14, mat=vel, loc=(0, D / 2 - 0.1, 0.52)); H.uv_box(back, 0.25)
btn = K.plain('velvet_button', '#233a2d', 0.6)
for r in range(2):
    for c in range(9):
        H.superellipsoid('tuft', 0.012, 0.01, 0.012, e=2, n=2, nu=10, nv=6, mat=btn, loc=(-W / 2 + 0.25 + c * (W - 0.5) / 8 + (0.06 if r else 0), D / 2 - 0.2, 0.52 + r * 0.14))
for i in range(2):
    K.cushion('seat', (W - 0.4) / 2 - 0.01, D - 0.3, 0.13, vel, loc=((i - 0.5) * (W - 0.4) / 2, -0.07, 0.43), crown=0.2, pipe=vel, pipe_r=0.004)
for sx in (-1, 1):
    for sy in (-1, 1):
        H.lathe('foot', [(0.0, 0.0), (0.02, 0.0), (0.028, 0.05), (0.02, 0.1), (0.03, 0.14), (0.0, 0.14)], 16, wal, loc=(sx * (W / 2 - 0.08), sy * (D / 2 - 0.08), 0))
H.finish('sofa_classic', extras={'texres': 1024})
