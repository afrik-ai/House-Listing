# Low walnut media sideboard 1.80 m: 3 slatted doors with 3 mm reveals, open centre bay with a soundbar, black
# steel hairpin legs, top-edge bevel. ~1.80 x 0.42 x 0.56 m, front +Z.
import sys; sys.path.insert(0, __import__('os').path.dirname(__import__('os').path.abspath(__file__)))
import helpers as H, _kit as K
from helpers import V, PI
import math, random, numpy as np
H.reset()
wal = K.wood('media_walnut', light='#8a6246', mid='#6f4c34', dark='#4a3122', seed=83)
blk = K.plain('media_black', '#151515', 0.5, 0.5)
dark = K.plain('media_void', '#0f0b08', 0.9)
W, D, Hh, L = 1.80, 0.42, 0.40, 0.16
H.uv_box(H.box('carcass', W, D, Hh, loc=(0, 0, L + Hh / 2), mat=wal, bev=0.004), 1.0, along='x')
dw = (W - 0.04) / 4
for i in range(4):
    x = -W / 2 + 0.02 + dw * (i + 0.5)
    if i == 2:
        H.box('bay', dw - 0.01, 0.02, Hh - 0.05, loc=(x, -D / 2 + 0.005, L + Hh / 2), mat=dark)
        H.box('soundbar', dw - 0.06, 0.08, 0.06, loc=(x, -D / 2 + 0.08, L + 0.06), mat=blk, bev=0.01)
        continue
    H.box('gap', dw - 0.002, 0.004, Hh - 0.04, loc=(x, -D / 2 - 0.0005, L + Hh / 2), mat=dark)
    for k in range(9):
        sl = H.box('slat', (dw - 0.012) / 9 - 0.004, 0.012, Hh - 0.046, loc=(x - (dw - 0.012) / 2 + (k + 0.5) * (dw - 0.012) / 9, -D / 2 - 0.006, L + Hh / 2), mat=wal, bev=0.002, seg=1)
        H.uv_box(sl, 1.0, along='z')
for sx in (-1, 1):
    for sy in (-1, 1):
        H.tube('hairpin', [V((sx * (W / 2 - 0.08), sy * (D / 2 - 0.06) - 0.03, L)), V((sx * (W / 2 - 0.08), sy * (D / 2 - 0.06), 0.0)), V((sx * (W / 2 - 0.08), sy * (D / 2 - 0.06) + 0.03, L))], 0.006, 8, blk)
H.finish('tv_stand_cabinet', extras={'texres': 1024})
