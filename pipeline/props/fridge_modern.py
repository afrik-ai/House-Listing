# Tall freestanding fridge-freezer, brushed stainless doors, bar handles, door display. 0.60 x 0.67 x 1.86 m
import sys; sys.path.insert(0, 'C:/Users/Owner/HouseListing/pipeline/props')
import helpers as H
from helpers import V, PI
import math, numpy as np, bpy

H.reset()
N = 1024
b = H.tex_brushed(N, seed=21, along='v')
steel_n = H.save_img(H.h2n(b * 0.8 + H.fnoise(N, 0.8, 0.8, 5) * 0.05, 0.12), 'fridge_steel_n', True)
rough = np.clip(0.28 + b * 0.035 + H.fnoise(N, 120, 120, 8) * 0.02, 0, 1)
steel_r = H.save_img(H.orm(rough, np.ones((N, N), np.float32)), 'fridge_steel_orm', True)
steel = H.pbr('brushed_steel', '#c6c8ca', 0.3, 1.0, normal_tex=steel_n, rough_tex=steel_r, nstr=0.5)
side = H.pbr('side_paint_silver', '#8d9094', 0.38, 0.75)
gasket = H.pbr('gasket_black', '#101010', 0.7)
black = H.pbr('black_plastic', '#161616', 0.4)
glass = H.pbr('display_glass', '#050505', 0.05, spec=0.6)
icon = H.pbr('display_icons', '#ffffff', 0.4, emit='#dff3ff', emit_str=4.0)
back = H.pbr('back_dark', '#2a2a2b', 0.8)
handle_m = H.pbr('handle_steel', '#d9dbdd', 0.18, 1.0)

W, DB, HT = 0.595, 0.60, 1.855   # body width, body depth (without doors), height
DT = 0.055                       # door thickness
yf = -DB / 2                     # body front plane
# carcass (sides/top) - painted silver, back dark
car = H.box_minmax('carcass', (-W / 2, yf, 0.04), (W / 2, DB / 2, HT), mat=side)
car.data.materials.append(back)
for p in car.data.polygons:
    if p.normal.y > 0.9: p.material_index = 1
H.bevel(car, 0.006, 3)
# plinth / kick plate with vent slots (recessed)
H.box_minmax('plinth', (-W / 2 + 0.01, yf - 0.02, 0.0), (W / 2 - 0.01, DB / 2 - 0.03, 0.075), mat=black, bev=0.003, seg=2)
for i in range(14):
    x = -0.2 + i * 0.4 / 13
    H.box('vent', 0.012, 0.004, 0.035, loc=(x, yf - 0.0215, 0.04), mat=gasket, bev=0.004, seg=2)
# feet
for x in (-0.25, 0.25):
    H.cyl('foot', 0.018, 0.012, loc=(x, yf + 0.03, 0.0), mat=black, seg=16)
# doors: freezer (bottom) and fridge (top); 4 mm gap between
gap = 0.004
zb0, zb1 = 0.080, 0.720
zt0, zt1 = zb1 + gap, HT
doors = []
for nm, z0, z1 in (('freezer_door', zb0, zb1), ('fridge_door', zt0, zt1)):
    d = H.box_minmax(nm, (-W / 2, yf - DT, z0), (W / 2, yf - 0.006, z1), mat=steel)
    H.uv_box(d, 1.0, along='x')
    H.bevel(d, 0.012, 3)
    doors.append(d)
    # gasket between door and body
    H.box_minmax(nm + '_gasket', (-W / 2 + 0.012, yf - 0.007, z0 + 0.012), (W / 2 - 0.012, yf + 0.001, z1 - 0.012), mat=gasket, bev=0.004, seg=2)
# bar handles (left side, hinge right): vertical round bars on two standoffs
hx = -W / 2 + 0.055
def bar(z0, z1):
    yh = yf - DT - 0.055
    H.tube('handle_bar', [V((hx, yh, z0)), V((hx, yh, z1))], 0.013, 20, handle_m)
    for z in (z0 + 0.03, z1 - 0.03):
        H.cyl('standoff', 0.009, 0.05, loc=(hx, yf - DT + 0.002, z), rot=(PI / 2, 0, 0), seg=16, mat=handle_m)
    for z in (z0, z1):  # rounded end caps
        pass
bar(1.02, 1.62)
bar(0.46, 0.70)
# door display (black glass, emissive readouts)
dz = 1.47
disp = H.box('display', 0.13, 0.004, 0.05, loc=(0.12, yf - DT - 0.0015, dz), mat=glass, bev=0.004, seg=3)
H.text('temp_fridge', '4°', 0.020, (0.085, yf - DT - 0.0038, dz + 0.002), mat=icon)
H.text('temp_freezer', '-18°', 0.020, (0.15, yf - DT - 0.0038, dz + 0.002), mat=icon)
for i in range(3):
    H.cyl('touch_dot', 0.0022, 0.0006, loc=(0.075 + i * 0.022, yf - DT - 0.0035, dz - 0.016), rot=(PI / 2, 0, 0), seg=10, mat=icon)
# hinge covers on the right
for z in (zt1 - 0.002, zb0 - 0.002):
    H.box('hinge', 0.04, 0.05, 0.012, loc=(W / 2 - 0.03, yf - 0.03, z + (0.008 if z > 1 else -0.004)), mat=black, bev=0.004, seg=2)
# top vent grille strip at the top rear
H.box('top_vent', W - 0.1, 0.06, 0.004, loc=(0, DB / 2 - 0.06, HT + 0.001), mat=black, bev=0.0015, seg=2)

for d in doors: H.wnormal(d)
H.wnormal(car)
H.finish('fridge_modern')
