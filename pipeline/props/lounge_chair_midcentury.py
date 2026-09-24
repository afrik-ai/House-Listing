# Mid-century lounge chair (Eames-type): moulded walnut plywood shells (seat, back, headrest) with visible ply
# edge, black leather cushions with tufting buttons and welted edges, aluminium arms, 5-star swivel base.
# ~0.84 x 0.85 x 0.84 m, front +Z.
import sys; sys.path.insert(0, __import__('os').path.dirname(__import__('os').path.abspath(__file__)))
import helpers as H, _kit as K
from helpers import V, PI
import math

H.reset()
wal = K.wood('walnut_ply', light='#8b5f3f', mid='#6e472d', dark='#472b19', seed=17, rings=34, coat=0.4)
ply = K.plain('ply_edge', '#c7a67a', 0.6)
lea = K.leather('leather_black', '#1c1a19')
alu = K.plain('alu_polished', '#cfd1d3', 0.2, 1.0)
blk = K.plain('base_black', '#121212', 0.5, 0.3)

def shell(name, w, h, t, curve, loc, tilt):
    """Curved shell: rounded rect plan w x h bent around X by 'curve' (m sag), thickness t; tilt about X."""
    rr = H.rrect2d(w, h, 0.08, 8)
    def bend(x, y): return curve * (1 - (2 * x / w) ** 2) * 0.6 + curve * 0.4 * (1 - (2 * y / h) ** 2)
    rings = [[V((x, y, bend(x, y) + dz)) for x, y in rr] for dz in (0.0, t)]
    ob = H.loft(name, rings, wal, cap0=True, cap1=True)
    H.uv_box(ob, 1.0, along='y')
    ed = H.loft(name + '_edge', [[V((x * 1.001, y * 1.001, bend(x, y) + t * 0.3)) for x, y in rr], [V((x * 1.001, y * 1.001, bend(x, y) + t * 0.7)) for x, y in rr]], ply)
    for o in (ob, ed):
        o.rotation_euler = (tilt, 0, 0); o.location = loc
    return ob
# seat shell (horizontal, slight tilt back)
shell('seat_shell', 0.66, 0.60, 0.018, 0.03, (0, -0.02, 0.36), 0.12)
K.cushion('seat_cush', 0.60, 0.56, 0.11, lea, loc=(0, -0.03, 0.44), crown=0.15, pipe=lea, pipe_r=0.004, rot=(0.12, 0, 0), e=5)
# back shell (reclined) + cushion
shell('back_shell', 0.66, 0.42, 0.018, 0.05, (0, 0.30, 0.66), 1.25)
K.cushion('back_cush', 0.58, 0.40, 0.10, lea, loc=(0, 0.25, 0.68), crown=0.2, pipe=lea, pipe_r=0.004, rot=(1.25 + PI, 0, 0), e=5, tuft=3)
shell('head_shell', 0.58, 0.24, 0.018, 0.04, (0, 0.38, 0.93), 1.40)
K.cushion('head_cush', 0.52, 0.22, 0.09, lea, loc=(0, 0.33, 0.93), crown=0.25, pipe=lea, pipe_r=0.004, rot=(1.4 + PI, 0, 0), e=5)
# arms: aluminium bracket + leather pad
for s in (-1, 1):
    x = s * 0.35
    H.tube('arm_bracket', [V((x * 0.9, 0.22, 0.47)), V((x, 0.05, 0.52)), V((x, -0.18, 0.57))], 0.012, 10, alu)
    K.cushion('arm_pad', 0.07, 0.36, 0.04, lea, loc=(x, -0.05, 0.585), crown=0.4, rot=(-0.12, 0, 0), e=5)
# swivel base
H.cyl('column', 0.035, 0.26, loc=(0, 0.02, 0.08), seg=24, mat=blk)
for k in range(5):
    a = PI / 2 + 2 * PI * k / 5
    d = V((math.cos(a), math.sin(a), 0))
    H.sweep('star', [V((0, 0.02, 0.10)), V((0, 0.02, 0.07)) + d * 0.2, V((0, 0.02, 0.03)) + d * 0.36],
            [(p[1], p[0]) for p in H.rrect2d(0.03, 0.045, 0.012, 3)], alu, caps=True, scale=[1, 0.85, 0.6], up=(0, 0, 1))
    tip = V((0, 0.02, 0.0)) + d * 0.36
    H.cyl('glide', 0.02, 0.03, loc=(tip.x, tip.y, 0.0), seg=16, mat=blk, bev=0.005)
H.finish('lounge_chair_midcentury', extras={'texres': 1024})
