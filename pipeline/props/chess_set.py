# Chess set mid-game: walnut/maple inlaid board with border, turned boxwood + ebony pieces (a few captured on the side).
# ~0.42 x 0.42 m board.
import sys; sys.path.insert(0, __import__('os').path.dirname(__import__('os').path.abspath(__file__)))
import helpers as H, _kit as K
from helpers import V, PI
import math, random, numpy as np
H.reset()
N = 512
y, x = np.mgrid[0:N, 0:N].astype(np.float32) / N
sq = ((np.floor(x * 8) + np.floor(y * 8)) % 2).astype(np.float32)
col = np.where(sq[..., None] > 0.5, np.array(H.hexc('#5b3b24', False)), np.array(H.hexc('#d9bd8c', False))).astype(np.float32)
col *= (0.92 + H.fnoise(N, 40, 2, 5)[..., None] * 0.05)
top = H.pbr('chess_squares', '#ffffff', 0.3, base_tex=H.save_img(np.clip(col, 0, 1), 'chess_c'), coat=0.4)
wal = K.wood('chess_walnut', light='#6e4c34', mid='#553a27', dark='#34231a', seed=160)
lite = K.plain('chess_boxwood', '#e2c998', 0.35); dark = K.plain('chess_ebony', '#1a1411', 0.3)
B = 0.42; S = 0.36
b = H.box('board', B, B, 0.025, loc=(0, 0, 0.0125), mat=wal, bev=0.004); H.uv_box(b, 1.0, along='x')
t = H.obj('squares', [(-S / 2, -S / 2, 0.0252), (S / 2, -S / 2, 0.0252), (S / 2, S / 2, 0.0252), (-S / 2, S / 2, 0.0252)], [(0, 1, 2, 3)], top, uvs=[[(0, 0), (1, 0), (1, 1), (0, 1)]])
PROF = {'p': [(0.0, 0.0), (0.014, 0.0), (0.014, 0.005), (0.008, 0.01), (0.005, 0.025), (0.009, 0.03), (0.0, 0.042)],
        'r': [(0.0, 0.0), (0.016, 0.0), (0.016, 0.006), (0.01, 0.012), (0.009, 0.04), (0.013, 0.045), (0.013, 0.055), (0.0, 0.055)],
        'b': [(0.0, 0.0), (0.016, 0.0), (0.016, 0.006), (0.008, 0.015), (0.006, 0.045), (0.01, 0.055), (0.004, 0.07), (0.0, 0.072)],
        'n': [(0.0, 0.0), (0.016, 0.0), (0.016, 0.006), (0.01, 0.012), (0.012, 0.04), (0.006, 0.058), (0.0, 0.06)],
        'q': [(0.0, 0.0), (0.018, 0.0), (0.018, 0.007), (0.009, 0.018), (0.006, 0.06), (0.012, 0.07), (0.006, 0.08), (0.0, 0.085)],
        'k': [(0.0, 0.0), (0.018, 0.0), (0.018, 0.007), (0.009, 0.018), (0.007, 0.07), (0.013, 0.078), (0.004, 0.085), (0.004, 0.1), (0.0, 0.1)]}
sq_ = S / 8
def at(c, r): return (-S / 2 + sq_ * (c + 0.5), -S / 2 + sq_ * (r + 0.5), 0.025)
layout = {'w': [('r', 0, 0), ('n', 2, 2), ('b', 2, 0), ('q', 3, 0), ('k', 6, 0), ('b', 4, 3), ('r', 5, 0)] + [('p', c, 1) for c in (0, 1, 2, 5, 6, 7)] + [('p', 4, 3)],
          'b': [('r', 0, 7), ('n', 5, 5), ('b', 2, 7), ('q', 3, 7), ('k', 4, 7), ('b', 5, 7), ('r', 7, 7)] + [('p', c, 6) for c in (0, 1, 2, 3, 6, 7)] + [('p', 4, 4)]}
for side, m in (('w', lite), ('b', dark)):
    for k, c, r in layout[side]:
        H.lathe('pc', PROF[k], 20, m, loc=at(c, r))
for i, (k, m) in enumerate((('p', dark), ('n', lite), ('p', lite))):
    H.lathe('cap', PROF[k], 20, m, loc=(B / 2 + 0.03, -0.1 + i * 0.04, 0))
H.finish('chess_set', extras={'texres': 512})
