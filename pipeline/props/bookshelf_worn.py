# Worn open bookshelf (painted pine, chipped edges showing wood) 0.9 x 0.32 x 1.8 m, 5 shelves full of books,
# a plant-less clutter mix (box, frame, jar). Back at -Z (wall), front +Z.
import sys; sys.path.insert(0, __import__('os').path.dirname(__import__('os').path.abspath(__file__)))
import helpers as H, _kit as K
from helpers import V, PI
import math, random, numpy as np
H.reset()
N = 1024
col, hh = H.tex_wood(N, 185, '#b08a5a', '#7a5a38', '#96724a', rings=60, contrast=0.3)
paint = np.array(H.hexc('#dfd8c8', False), np.float32)
chip = np.clip((H.fbm(N, 60, 4, 186) - 1.1) * 3, 0, 1)[..., None]
c = paint * (1 - chip) + col * chip
c *= (0.95 + H.fnoise(N, 100, 100, 187)[..., None] * 0.03)
pm = H.pbr('worn_paint', '#ffffff', 0.6, base_tex=H.save_img(np.clip(c, 0, 1), 'worn_c'), normal_tex=H.save_img(H.h2n(-chip[..., 0] * 1.5 + hh * 0.2, 1.0), 'worn_n', True))
box = K.plain('shelf_box', '#6d5a44', 0.8); cer = K.glaze('shelf_jar', '#6b8a8a', rough=0.3, seed=188)
W, D, Hh, T = 0.9, 0.32, 1.8, 0.025
for s in (-1, 1): H.uv_box(H.box('side', T, D, Hh, loc=(s * (W / 2 - T / 2), 0, Hh / 2), mat=pm, bev=0.003), 1.0, along='z')
H.uv_box(H.box('back', W - 2 * T, 0.008, Hh - 0.02, loc=(0, D / 2 - 0.004, Hh / 2), mat=pm), 1.0, along='z')
levels = [0.06, 0.42, 0.78, 1.14, 1.5, Hh - T]
for z in levels: H.uv_box(H.box('shelf', W - 2 * T, D - 0.01, T, loc=(0, -0.005, z + T / 2 if z < Hh - T else Hh - T / 2), mat=pm, bev=0.002), 1.0, along='x')
H.box('kick', W - 2 * T, T, 0.06, loc=(0, -D / 2 + 0.03, 0.03), mat=pm)
for i, z in enumerate(levels[:-1]):
    K.book_row('bs', -W / 2 + T + 0.01, W / 2 - T - 0.01 - (0.18 if i in (1, 3) else 0.0), z + T, -0.03, depth=0.24, seed=i + 3, hmin=0.19, hmax=0.3, stack=(i % 2 == 0))
H.box('storage_box', 0.16, 0.24, 0.14, loc=(W / 2 - T - 0.1, -0.02, levels[1] + T + 0.07), mat=box, bev=0.004)
H.lathe('jar', [(0.0, 0.0), (0.05, 0.0), (0.055, 0.1), (0.035, 0.13), (0.035, 0.15), (0.0, 0.15)], 32, cer, loc=(W / 2 - T - 0.1, -0.03, levels[3] + T))
H.finish('bookshelf_worn', extras={'texres': 1024})
