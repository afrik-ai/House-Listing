# 2-slice toaster: brushed stainless body, black base/controls, chrome slot trims. ~0.30 x 0.18 x 0.19 m
import sys; sys.path.insert(0, __import__('os').path.dirname(__import__('os').path.abspath(__file__)))
import helpers as H
from helpers import V, PI
import math, numpy as np, bpy

H.reset()
N = 512
# brushed steel maps
b = H.tex_brushed(N, seed=11)
steel_n = H.save_img(H.h2n(b * 0.8 + H.fnoise(N, 0.7, 0.7, 4) * 0.05, 0.12), 'toaster_steel_n', True)
steel_r = H.save_img(H.orm(np.clip(0.30 + b * 0.04, 0, 1), np.ones((N, N), np.float32)), 'toaster_steel_orm', True)
steel = H.pbr('brushed_steel', '#c9cbcd', 0.3, 1.0, normal_tex=steel_n, rough_tex=steel_r, nstr=0.6)
black = H.pbr('black_plastic', '#141414', 0.45)
chrome = H.pbr('chrome', '#e8e8e8', 0.08, 1.0)
dark = H.pbr('slot_inside', '#0b0b0b', 0.7)
rubber = H.pbr('rubber', '#0a0a0a', 0.85)
led = H.pbr('led', '#1a1a1a', 0.3, emit='#ff9a3c', emit_str=3.0)

W, D, HH = 0.300, 0.180, 0.190
r = 0.035
rings = []
prof = [(0.020, 0.0020), (0.0, 0.010), (0.0, 0.170), (0.003, 0.181), (0.009, 0.1875), (0.018, HH)]
for inset, z in prof:
    rr = H.rrect2d(W - 2 * inset, D - 2 * inset, max(r - inset, 0.006), 6)
    rings.append([V((x, y, z)) for x, y in rr])
body = H.loft('body', rings, steel, cap0=True, cap1=True, uvscale=0.4)
H.uv_box(body, 0.35)
# slots (boolean)
cut_mat = dark
cutters = []
for sy in (-0.035, 0.035):
    c = H.box('slot', 0.150, 0.034, 0.16, loc=(0, sy, HH - 0.07), mat=cut_mat)
    cutters.append(c)
cut = H.join(cutters, 'slotcut')
bm = body.modifiers.new('slots', 'BOOLEAN'); bm.object = cut; bm.operation = 'DIFFERENCE'; bm.solver = 'EXACT'
bm.material_mode = 'TRANSFER'
body = H.apply_mods(body)
bpy.data.objects.remove(cut)
H.sharpen(body, 50)
# chrome trims around slots
for sy in (-0.035, 0.035):
    prof2 = [(0.0, -0.003), (0.004, -0.003), (0.0055, 0.0), (0.004, 0.003), (0.0, 0.003)]
    path = [V((x, sy + y, HH + 0.0005)) for x, y in H.rrect2d(0.150 + 0.004, 0.034 + 0.004, 0.012, 5)]
    t = H.sweep('trim', path, [(p[1], p[0]) for p in H.rrect2d(0.004, 0.006, 0.0018, 3)], chrome, closed=True, up=(0, 0, 1))
# black base plinth
base = H.loft('base', [[V((x, y, z)) for x, y in H.rrect2d(W - 0.012 - 2 * i, D - 0.012 - 2 * i, r - 0.006 - i, 6)] for i, z in ((0.004, 0.0), (0.0, 0.004), (0.0, 0.013))], black, cap0=True, cap1=True)
# feet
for x in (-0.11, 0.11):
    for y in (-0.06, 0.06):
        H.cyl('foot', 0.009, 0.004, loc=(x, y, -0.003), seg=16, mat=rubber, bev=0.0015, bseg=2)
# front control panel (right side of front face): lever slot, lever knob, dial, buttons
fx = 0.105
slot = H.box('lever_slot', 0.012, 0.004, 0.105, loc=(fx, -D / 2 - 0.0005, 0.105), mat=dark, bev=0.004, seg=3)
lever = H.box('lever', 0.048, 0.030, 0.018, loc=(fx, -D / 2 - 0.016, 0.150), mat=black, bev=0.006, seg=3)
dial = H.cyl('dial', 0.016, 0.012, loc=(-0.105, -D / 2 + 0.001, 0.075), rot=(PI / 2, 0, 0), seg=32, mat=chrome, bev=0.003, bseg=3)
dial_ring = H.cyl('dial_base', 0.021, 0.003, loc=(-0.105, -D / 2 + 0.002, 0.075), rot=(PI / 2, 0, 0), seg=32, mat=black, bev=0.001, bseg=2)
tick = H.box('dial_tick', 0.002, 0.002, 0.010, loc=(-0.105, -D / 2 - 0.0115, 0.084), mat=black)
for i, lab in enumerate(('cancel', 'defrost', 'reheat')):
    z = 0.120 - i * 0.022
    H.box('btn_' + lab, 0.026, 0.006, 0.012, loc=(-0.105, -D / 2 - 0.002, z + 0.02), mat=black, bev=0.004, seg=3)
    H.cyl('led_' + lab, 0.0018, 0.002, loc=(-0.087, -D / 2 - 0.0005, z + 0.02), rot=(PI / 2, 0, 0), seg=10, mat=led)
# cord exit at back
H.cyl('cord', 0.0045, 0.012, loc=(0.1, D / 2 - 0.005, 0.012), rot=(-PI / 2, 0, 0), seg=10, mat=black)

H.wnormal(body)
H.finish('toaster', extras={'texres': 512})
