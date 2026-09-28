# Garage workbench 1.5 m: butcher-block top on a black steel frame, lower shelf with bins and a paint can,
# vice, pegboard (0.9 m tall, hole grid) with hung tools: hammer, 3 wrenches, 4 screwdrivers, saw, pliers, tape
# measure, a clamp. Back (wall) at glTF -Z, front +Z.
import sys; sys.path.insert(0, __import__('os').path.dirname(__import__('os').path.abspath(__file__)))
import helpers as H, _kit as K
from helpers import V, PI
import math, numpy as np
H.reset()
top = K.wood('bench_beech', light='#d2b07e', mid='#b8935f', dark='#8d6b40', seed=301)
stl = K.plain('bench_steel', '#232426', 0.45, 0.7)
N = 512
y, x = np.mgrid[0:N, 0:N].astype(np.float32) / N
holes = ((((x * 24) % 1) - 0.5) ** 2 + (((y * 16) % 1) - 0.5) ** 2) < 0.04
col = np.ones((N, N, 3), np.float32) * np.array(H.hexc('#b58a5a', False)); col[holes] = 0.08
peg = H.pbr('pegboard', '#ffffff', 0.8, base_tex=H.save_img(col, 'pegboard_c'))
red = K.plain('tool_red', '#b3261e', 0.4); blk = K.plain('tool_black', '#151515', 0.5); chrome = K.plain('tool_chrome', '#c9cbcd', 0.25, 1.0)
yel = K.plain('tool_yellow', '#e0b12a', 0.45); bin_ = K.plain('bin_blue', '#2b5a8a', 0.5); wood = K.plain('handle_wood', '#a07a4a', 0.6)
W, D, T = 1.5, 0.62, 0.9
H.uv_box(H.box('top', W, D, 0.045, loc=(0, 0, T - 0.0225), mat=top, bev=0.004), 1.0, along='x')
for sx in (-1, 1):
    for sy in (-1, 1): H.box('leg', 0.045, 0.045, T - 0.045, loc=(sx * (W / 2 - 0.04), sy * (D / 2 - 0.04), (T - 0.045) / 2), mat=stl, bev=0.004)
    H.box('rail', 0.03, D - 0.1, 0.04, loc=(sx * (W / 2 - 0.04), 0, 0.2), mat=stl)
H.box('shelf', W - 0.06, D - 0.06, 0.02, loc=(0, 0, 0.18), mat=stl, bev=0.003)
for i, x0 in enumerate((-0.5, -0.15)):
    H.box('bin', 0.3, 0.4, 0.2, loc=(x0, 0.0, 0.29), mat=bin_, bev=0.01)
H.cyl('paint', 0.1, 0.19, loc=(0.35, 0.0, 0.19), seg=24, mat=K.plain('paint_can', '#d9d9d6', 0.35, 0.8), bev=0.004)
# pegboard on the wall (+Y in Blender = glTF -Z)
PB = 0.9
H.box('pegboard', W, 0.012, PB, loc=(0, D / 2 - 0.006, T + 0.12 + PB / 2), mat=peg)
H.box('peg_frame', W + 0.03, 0.02, 0.03, loc=(0, D / 2 - 0.01, T + 0.12 + PB), mat=stl)
yb = D / 2 - 0.03; z0 = T + 0.12
def hang(obj_list): pass
# hammer
H.cyl('hammer_h', 0.012, 0.3, loc=(-0.6, yb, z0 + 0.35), seg=8, mat=wood)
H.box('hammer_head', 0.11, 0.03, 0.03, loc=(-0.6, yb, z0 + 0.66), mat=chrome, bev=0.005)
# wrenches
for i in range(3):
    L = 0.18 + i * 0.05
    H.box('wrench', 0.016, 0.006, L, loc=(-0.42 + i * 0.05, yb, z0 + 0.5), mat=chrome, bev=0.002)
    H.cyl('wrench_end', 0.017, 0.007, loc=(-0.42 + i * 0.05, yb + 0.003, z0 + 0.5 + L / 2), rot=(PI / 2, 0, 0), seg=10, mat=chrome)
# screwdrivers
for i, m in enumerate((red, yel, red, blk)):
    xs = -0.2 + i * 0.045
    H.cyl('sd_handle', 0.014, 0.1, loc=(xs, yb, z0 + 0.62), seg=8, mat=m, bev=0.004)
    H.cyl('sd_shaft', 0.004, 0.12, loc=(xs, yb, z0 + 0.5), seg=6, mat=chrome)
# saw
H.box('saw_blade', 0.45, 0.003, 0.11, loc=(0.2, yb, z0 + 0.62), mat=chrome, bev=0.001)
H.box('saw_handle', 0.12, 0.025, 0.1, loc=(0.46, yb, z0 + 0.62), mat=red, bev=0.01)
# pliers, tape, clamp
for sgn in (-1, 1):
    b = H.box('plier', 0.012, 0.01, 0.18, loc=(0.55 + sgn * 0.012, yb, z0 + 0.3), mat=red, bev=0.003); b.rotation_euler = (0, sgn * 0.12, 0)
H.cyl('tape', 0.035, 0.03, loc=(0.2, yb - 0.01, z0 + 0.3), rot=(PI / 2, 0, 0), seg=16, mat=yel, bev=0.006)
H.box('clamp_bar', 0.02, 0.012, 0.3, loc=(-0.05, yb, z0 + 0.25), mat=chrome); H.box('clamp_jaw', 0.08, 0.03, 0.03, loc=(-0.03, yb - 0.01, z0 + 0.36), mat=red, bev=0.006)
# vice on the bench + clutter
H.box('vice_base', 0.16, 0.14, 0.05, loc=(-0.55, -D / 2 + 0.1, T + 0.025), mat=K.plain('vice_blue', '#25476e', 0.45, 0.4), bev=0.008)
H.box('vice_jaw', 0.16, 0.05, 0.08, loc=(-0.55, -D / 2 + 0.05, T + 0.09), mat=K.plain('vice_blue', '#25476e', 0.45, 0.4), bev=0.006)
H.cyl('vice_screw', 0.01, 0.2, loc=(-0.55, -D / 2 - 0.05, T + 0.08), rot=(PI / 2, 0, 0), seg=8, mat=chrome)
H.box('plank', 0.6, 0.12, 0.02, loc=(0.1, -0.05, T + 0.01), mat=top); H.cyl('screwjar', 0.04, 0.09, loc=(0.5, 0.15, T), seg=12, mat=K.plain('jar_glass', '#b8c4c0', 0.1))
H.finish('workbench_pegboard', extras={'texres': 512})
