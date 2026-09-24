# Oak side table / nightstand: bevelled top, drawer with 3 mm reveal and brass knob, open lower shelf with two
# paperbacks, square tapered legs. ~0.48 x 0.48 x 0.56 m, front (drawer) +Z.
import sys; sys.path.insert(0, __import__('os').path.dirname(__import__('os').path.abspath(__file__)))
import helpers as H, _kit as K
from helpers import V, PI

H.reset()
oak = K.wood('oak_side', seed=14)
dark = K.plain('drawer_shadow', '#1c140d', 0.9)
brass = K.brushed('brass_knob')
covA = K.fabric('pb_terracotta', '#b0623f', threads=140, seed=31)
covB = K.fabric('pb_cream', '#d8cfb8', threads=140, seed=32)
page = K.plain('book_pages', '#efe8d8', 0.9)
W, HT = 0.48, 0.56
t = H.box('top', W, W, 0.028, loc=(0, 0, HT - 0.014), mat=oak, bev=0.004); H.uv_box(t, 1.0, along='x')
for sx in (-1, 1):
    for sy in (-1, 1):
        l = H.cyl('leg', 0.02, HT - 0.028, loc=(sx * (W / 2 - 0.03), sy * (W / 2 - 0.03), 0), seg=4, mat=oak, r2=0.026)
        l.rotation_euler = (0, 0, PI / 4); H.uv_box(l, 1.0, along='z'); H.bevel(l, 0.002, 1)
# carcass under the top: sides + back + drawer box
H.uv_box(H.box('apron_back', W - 0.08, 0.018, 0.16, loc=(0, W / 2 - 0.035, HT - 0.108), mat=oak, bev=0.002), 1.0, along='x')
for sx in (-1, 1):
    H.uv_box(H.box('apron_side', 0.018, W - 0.08, 0.16, loc=(sx * (W / 2 - 0.035), 0, HT - 0.108), mat=oak, bev=0.002), 1.0, along='y')
H.box('drawer_void', W - 0.09, 0.01, 0.15, loc=(0, -W / 2 + 0.04, HT - 0.108), mat=dark)
df = H.box('drawer_front', W - 0.076, 0.02, 0.146, loc=(0, -W / 2 + 0.03, HT - 0.108), mat=oak, bev=0.003); H.uv_box(df, 1.0, along='x')
H.box('drawer_bottom', W - 0.08, W - 0.08, 0.012, loc=(0, 0, HT - 0.195), mat=oak, bev=0.002)
H.lathe('knob', [(0.0, 0.0), (0.008, 0.0), (0.005, 0.012), (0.012, 0.02), (0.012, 0.026), (0.0, 0.028)], 24, brass,
        loc=(0, -W / 2 + 0.02, HT - 0.108), rot=(PI / 2, 0, 0))
# lower shelf + books
sh = H.box('shelf', W - 0.05, W - 0.05, 0.018, loc=(0, 0, 0.12), mat=oak, bev=0.002); H.uv_box(sh, 1.0, along='x')
K.book('pb1', 0.13, 0.20, 0.025, covA, page, loc=(-0.06, 0.02, 0.129), rotz=0.2)
K.book('pb2', 0.12, 0.18, 0.02, covB, page, loc=(-0.05, 0.03, 0.154), rotz=-0.1)
H.finish('side_table_oak', extras={'texres': 1024})
