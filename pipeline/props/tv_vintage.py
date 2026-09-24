# Vintage 1960s TV on splayed legs: teak cabinet, curved grey CRT screen, chrome knobs, speaker grille. ~0.75 x 0.45 x 0.85 m, front +Z.
import sys; sys.path.insert(0, __import__('os').path.dirname(__import__('os').path.abspath(__file__)))
import helpers as H, _kit as K
from helpers import V, PI
import math, random, numpy as np
H.reset()
teak = K.wood('tv_teak', light='#a4744a', mid='#8a5d37', dark='#5a3a20', seed=178, coat=0.3)
crt = K.plain('crt_glass', '#3b4240', 0.08, coat=1.0); grille = K.fabric('tv_grille', '#b9ad90', threads=60, seed=179)
chrome = K.plain('tv_chrome', '#d8d8d8', 0.1, 1.0); blk = K.plain('tv_bezel', '#1b1b1b', 0.5)
W, D, Hh, L = 0.75, 0.45, 0.5, 0.35
H.uv_box(H.box('cabinet', W, D, Hh, loc=(0, 0, L + Hh / 2), mat=teak, bev=0.02, seg=3), 1.0, along='x')
H.box('bezel', 0.5, 0.01, 0.4, loc=(-0.1, -D / 2 - 0.002, L + Hh / 2), mat=blk, bev=0.03, seg=4)
s = H.superellipsoid('screen', 0.22, 0.03, 0.17, e=5, n=5, nu=40, nv=12, mat=crt, loc=(-0.1, -D / 2 - 0.004, L + Hh / 2))
H.box('grille', 0.14, 0.006, 0.26, loc=(0.27, -D / 2 - 0.001, L + Hh / 2 + 0.06), mat=grille)
for z in (0.12, 0.06): H.cyl('knob', 0.018, 0.02, loc=(0.27, -D / 2 - 0.0, L + z), rot=(PI / 2, 0, 0), seg=20, mat=chrome, bev=0.004)
for sx in (-1, 1):
    for sy in (-1, 1):
        H.tube('leg', [V((sx * (W / 2 - 0.08), sy * (D / 2 - 0.08), L)), V((sx * (W / 2 - 0.02), sy * (D / 2 - 0.02), 0.0))], 0.015, 10, teak)
H.tube('antenna', [V((0.05, 0.1, L + Hh)), V((-0.15, 0.12, L + Hh + 0.35))], 0.003, 6, chrome)
H.tube('antenna2', [V((0.05, 0.1, L + Hh)), V((0.25, 0.12, L + Hh + 0.33))], 0.003, 6, chrome)
H.finish('tv_vintage', extras={'texres': 1024})
