# Dry-stacked stone fire pit (1.2 m across, 0.42 m high): three courses of rough stones round a sooty
# gravel bed, with charred logs and ash. Origin at base centre.
import sys, os; sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import helpers as H, _p04veg as G
import math, numpy as np
H.reset()
rock, _ = G.rock_mats('pit_stone', seed=15, moss=False, col=('#4f4a44', '#7e776d', '#a39b8e'))
N = 512
h = H.fbm(N, 40, 4, 3); c = H.ramp(np.clip(0.4 + h * 0.2, 0, 1), [(0, '#141210'), (0.6, '#2c2824'), (1, '#6a645c')])
ash = H.pbr('ash_bed', '#ffffff', 0.95, base_tex=H.save_img(c.astype(np.float32), 'ash_c'), normal_tex=H.save_img(H.h2n(h, 3), 'ash_n', True))
wc = H.ramp(np.clip(0.5 + H.fnoise(N, 3, 40, 4) * 0.2, 0, 1), [(0, '#0c0a09'), (0.7, '#231a14'), (1, '#4a3222')])
char = H.pbr('charred_wood', '#ffffff', 0.9, base_tex=H.save_img(wc.astype(np.float32), 'char_c'), normal_tex=H.save_img(H.h2n(H.fnoise(N, 2, 30, 5), 4), 'char_n', True))
rng = np.random.default_rng(3)
R = 0.52
for course in range(3):
    n = 13 - course
    for k in range(n):
        a = 2 * math.pi * (k + 0.5 * course) / n
        s = (0.36 * rng.uniform(0.85, 1.15), 0.26 * rng.uniform(0.85, 1.15), 0.24 * rng.uniform(0.8, 1.1))
        o = G.rock(f'st{course}_{k}', s, 100 + course * 20 + k, rock, None, sub=1)
        o.location = (math.cos(a) * R, math.sin(a) * R, course * 0.13)
        o.rotation_euler = (0, 0, a + math.pi / 2 + rng.uniform(-0.2, 0.2))
bed = H.cyl('bed', R - 0.05, 0.08, loc=(0, 0, 0), seg=32, mat=ash); H.uv_planar(bed, 0.5)
for k in range(5):
    a = k * 1.25 + 0.3
    d = (math.cos(a), math.sin(a))
    L = 0.34 * rng.uniform(0.85, 1.1)
    lg = H.cyl(f'log{k}', 0.045 * rng.uniform(0.8, 1.2), L, loc=(-d[0] * L / 2 + rng.uniform(-0.05, 0.05), -d[1] * L / 2 + rng.uniform(-0.05, 0.05), 0.12 + 0.05 * (k % 3)), seg=10, mat=char,
               rot=(math.pi / 2 - 0.12 * (k % 2), 0, a - math.pi / 2))
    H.uv_cyl(lg, 0.3)
H.finish('fire_pit_stone')
