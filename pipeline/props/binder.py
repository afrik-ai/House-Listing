# Lever-arch document folder lying flat, marbled-board covers with black spine label, papers sticking out.
# ~0.32 x 0.29 x 0.06 m
import sys; sys.path.insert(0, __import__('os').path.dirname(__import__('os').path.abspath(__file__)))
import helpers as H, _kit as K
from helpers import V, PI
import math, random, numpy as np
H.reset()
N = 512
m = H.fbm(N, 40, 4, 3)
col = H.colmix(np.clip(0.5 + np.sin(m * 6) * 0.5, 0, 1), '#2d4a73', '#6f8cb3')
cov = H.pbr('binder_marble', '#ffffff', 0.7, base_tex=H.save_img(col, 'binder_c'))
spine = K.plain('binder_spine', '#1b1b1d', 0.6)
lab = K.plain('binder_label', '#f0ece2', 0.8)
paper = K.plain('binder_paper', '#f5f3ee', 0.9)
metal = K.plain('binder_metal', '#c7c7c7', 0.3, 1.0)
W, D, Hh = 0.29, 0.32, 0.06
H.box('cover_bot', W, D, 0.003, loc=(0.005, 0, 0.0015), mat=cov, bev=0.001, seg=1)
H.box('cover_top', W, D, 0.003, loc=(0.005, 0, Hh - 0.0015), mat=cov, bev=0.001, seg=1)
H.box('spine', 0.006, D, Hh, loc=(-W / 2 + 0.003, 0, Hh / 2), mat=spine, bev=0.002, seg=2)
H.box('label', 0.001, 0.12, 0.035, loc=(-W / 2 - 0.0005, 0.05, Hh / 2), mat=lab)
H.cyl('ring', 0.012, 0.001, loc=(-W / 2 - 0.0005, -0.1, Hh / 2), rot=(0, PI / 2, 0), seg=20, mat=metal)
rnd = random.Random(5)
for i in range(6):
    b = H.box('paper', 0.28 - rnd.uniform(0, 0.01), 0.297, 0.007, loc=(0.008 + rnd.uniform(-0.004, 0.012), rnd.uniform(-0.006, 0.006), 0.006 + i * 0.0078), mat=paper)
    b.rotation_euler = (0, 0, rnd.uniform(-0.03, 0.03))
H.finish('binder', extras={'texres': 512})
