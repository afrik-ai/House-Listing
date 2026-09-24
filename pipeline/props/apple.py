# Red-green apple with stem and calyx dimple. ~0.08 m
import sys; sys.path.insert(0, __import__('os').path.dirname(__import__('os').path.abspath(__file__)))
import helpers as H, _kit as K
from helpers import V, PI
import math, random, numpy as np
H.reset()
N = 256
yv = np.mgrid[0:N, 0:N][0].astype(np.float32) / N
streak = H.fnoise(N, 1.5, 20, 3) * 0.2 + H.fnoise(N, 30, 30, 4) * 0.3
col = H.colmix(np.clip(yv * 0.9 + streak * 0.4 + 0.1, 0, 1), '#7fa23a', '#a8231c')
m = H.pbr('apple_skin', '#ffffff', 0.35, base_tex=H.save_img(col, 'apple_c'), coat=0.3)
st = K.plain('apple_stem', '#4b3620', 0.8)
a = H.lathe('apple', [(0.0, 0.004), (0.02, 0.0), (0.036, 0.015), (0.041, 0.04), (0.036, 0.065), (0.02, 0.075), (0.006, 0.07), (0.0, 0.066)], 32, m)
H.uv_cyl(a, 0.25)
H.tube('stem', [V((0, 0, 0.066)), V((0.003, 0, 0.08)), V((0.007, 0, 0.088))], 0.0018, 6, st)
H.finish('apple', extras={'texres': 256})
