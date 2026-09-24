# City / hybrid bicycle (700c): matte sage diamond frame, silver rims, 32 steel spokes, gumwall tyres, brown
# saddle + grips, 1x drivetrain with chain, fenders, kickstand. ~1.76 x 1.05 x 0.60 m (length along glTF X)
import sys; sys.path.insert(0, 'C:/Users/Owner/HouseListing/pipeline/props')
import helpers as H
from helpers import V, PI
import math, numpy as np, bpy

H.reset()
frame_m = H.pbr('frame_sage_matte', '#5f6f5e', 0.48, 0.25, coat=0.2, coat_rough=0.4)
alu = H.pbr('rim_silver', '#c3c5c8', 0.25, 1.0)
steel = H.pbr('spoke_steel', '#b5b7b9', 0.3, 1.0)
black = H.pbr('black_parts', '#18181a', 0.45, 0.3)
tread_n = H.save_img(H.h2n(H.fnoise(512, 1.2, 1.2, 3) * 0.4 + np.cos(np.mgrid[0:512, 0:512][1] / 512 * 2 * PI * 64) * 0.5, 1.2), 'tyre_tread_n', True)
tyre = H.pbr('tyre_black', '#1c1c1c', 0.85, normal_tex=tread_n, nstr=0.8)
gum = H.pbr('tyre_gumwall', '#8a6440', 0.8)
leather = H.pbr('saddle_leather', '#6b4429', 0.55)
chain_m = H.pbr('chain', '#4a4b4d', 0.45, 0.9)

Y0 = 0.0
RA = V((-0.52, 0, 0.345))            # rear axle (x, y, z)
FA = V((0.535, 0, 0.345))            # front axle
BB = V((-0.085, 0, 0.275))           # bottom bracket
st_dir = V((-math.cos(math.radians(73)), 0, math.sin(math.radians(73))))
ST_TOP = BB + st_dir * 0.52
ha = math.radians(71)
u = V((-math.cos(ha), 0, math.sin(ha)))          # steering axis (up)
nrm = V((math.sin(ha), 0, math.cos(ha)))         # perpendicular, forward
HT_B = FA - nrm * 0.045 + u * 0.37
HT_T = HT_B + u * 0.16

def wheel(c, name):
    # tyre: lathe around the axle (Y axis); cross-section circle radius 0.018 centred at r=0.33
    prof = []
    for i in range(17):
        a = -PI + 2 * PI * i / 16
        prof.append((0.329 + 0.018 * math.cos(a), 0.019 * math.sin(a)))
    t = H.lathe(name + '_tyre', prof, 64, [tyre, gum], loc=c, rot=(PI / 2, 0, 0))
    # gumwall on the sidewall faces (radius < 0.335 and not the tread band)
    me = t.data
    for p in me.polygons:
        co = p.center
        r = math.hypot(co.x, co.y)
        if r < 0.336: p.material_index = 1
    H.uv_cyl(t, 0.05)
    # rim (box-section) + hub + spokes
    rim = [(0.303, -0.011), (0.312, -0.012), (0.317, -0.009), (0.317, 0.009), (0.312, 0.012), (0.303, 0.011), (0.296, 0.004), (0.296, -0.004)]
    r = H.lathe(name + '_rim', rim + [rim[0]], 64, alu, loc=c, rot=(PI / 2, 0, 0))
    H.sharpen(r, 40)
    H.lathe(name + '_hub', [(0.0, -0.05), (0.008, -0.05), (0.008, -0.036), (0.028, -0.032), (0.028, -0.026), (0.016, -0.02), (0.016, 0.02),
                            (0.028, 0.026), (0.028, 0.032), (0.008, 0.036), (0.008, 0.05), (0.0, 0.05)], 24, alu, loc=c, rot=(PI / 2, 0, 0))
    for k in range(32):
        side = 1 if k % 2 else -1
        a0 = 2 * PI * k / 32
        a1 = a0 + (0.35 if (k // 2) % 2 else -0.35)   # tangential lacing
        p0 = c + V((0.026 * math.cos(a1), side * 0.029, 0.026 * math.sin(a1)))
        p1 = c + V((0.299 * math.cos(a0), side * 0.004, 0.299 * math.sin(a0)))
        H.tube('spoke', [p0, p1], 0.0011, 4, steel, caps=False)
wheel(RA, 'rear'); wheel(FA, 'front')

def tb(name, a, b, r, mat=frame_m, sides=14, r2=None):
    return H.tube(name, [a, b], r, sides, mat, scale=[1.0, (r2 or r) / r] if r2 else None)
# main triangle
tb('seat_tube', BB, ST_TOP + st_dir * 0.02, 0.0145)
tb('top_tube', ST_TOP - st_dir * 0.03, HT_T - u * 0.02, 0.0145)
tb('down_tube', BB, HT_B + u * 0.03, 0.019)
tb('head_tube', HT_B - u * 0.01, HT_T + u * 0.01, 0.019)
# rear triangle (both sides)
for s in (-1, 1):
    tb('chainstay', BB + V((0, s * 0.02, 0)), RA + V((0, s * 0.066, 0)), 0.0095, r2=0.0075)
    tb('seatstay', ST_TOP - st_dir * 0.035 + V((0, s * 0.012, 0)), RA + V((0, s * 0.066, 0.01)), 0.008, r2=0.0065)
    # fork blades (curved)
    fb = H.bezier_pts(HT_B - u * 0.03 + V((0, s * 0.03, 0)), HT_B - u * 0.18 + V((0, s * 0.05, 0)),
                      FA + u * 0.12 + nrm * 0.02 + V((0, s * 0.052, 0)), FA + V((0, s * 0.052, 0)), 10)
    H.tube('fork_blade', fb, 0.011, 12, frame_m, scale=[1.0 - 0.35 * i / 10 for i in range(11)])
H.tube('fork_crown', [HT_B - u * 0.03 + V((0, -0.035, 0)), HT_B - u * 0.03 + V((0, 0.035, 0))], 0.014, 12, frame_m)
H.cyl('bb_shell', 0.021, 0.07, loc=(BB.x, -0.035, BB.z), rot=(-PI / 2, 0, 0), seg=20, mat=frame_m)
H.tube('dropout_r', [RA + V((0, -0.07, 0)), RA + V((0, 0.07, 0))], 0.006, 10, alu)
# seatpost + saddle
SP = ST_TOP + st_dir * 0.16
H.tube('seatpost', [ST_TOP - st_dir * 0.03, SP], 0.0125, 16, alu)
sad_c = SP + V((0.005, 0, 0.035))
def sz(x_, y_, z_):
    t = (x_ + 0.13) / 0.27                         # 0 at back, 1 at nose
    return z_ + 0.012 * math.sin(PI * min(max(t, 0), 1)) * 0.0 - 0.01 * t
sad = H.superellipsoid('saddle', 0.135, 0.085, 0.03, e=2.6, n=2.6, nu=48, nv=12, mat=leather)
me = sad.data
for v in me.vertices:
    t = (v.co.x + 0.135) / 0.27
    v.co.y *= (1.0 - 0.62 * max(0.0, t - 0.35) / 0.65)          # narrow nose
    v.co.z = v.co.z * (0.8 + 0.2 * (1 - t)) + 0.01 * math.cos(PI * t) * 0.5
sad.location = sad_c
H.box('saddle_rails', 0.12, 0.04, 0.008, loc=(SP.x, 0, SP.z + 0.008), mat=steel, bev=0.003)
# stem + riser bar + grips + levers
st0 = HT_T + u * 0.015
H.tube('steerer', [HT_T, HT_T + u * 0.05], 0.015, 14, alu)
st1 = HT_T + u * 0.045 + nrm * 0.08 + V((0, 0, 0.03))
H.tube('stem', [st0 + u * 0.03, st1], 0.016, 14, alu)
bar = [V((st1.x + 0.0 - abs(y_) * 0.12, y_, st1.z + (0.02 if abs(y_) > 0.12 else abs(y_) * 0.16))) for y_ in np.linspace(-0.31, 0.31, 15)]
H.tube('handlebar', bar, 0.011, 12, alu)
for s in (-1, 1):
    g0 = V((st1.x - 0.31 * 0.12, s * 0.31, st1.z + 0.02))
    H.tube('grip', [g0 - V((0, s * 0.12, 0)), g0 + V((0, s * 0.005, 0))], 0.016, 16, leather)
    H.tube('brake_lever', [g0 - V((0, s * 0.155, 0)) + V((0.005, 0, 0)), g0 - V((0, s * 0.12, 0)) + V((0.06, 0, -0.015)), g0 - V((0, s * 0.06, 0)) + V((0.07, 0, -0.02))], 0.004, 8, black)
# drivetrain: chainring, cranks, pedals, cog, chain
CR = 0.092
H.lathe('chainring', [(0.075, -0.002), (CR, -0.002), (CR + 0.004, 0.0), (CR, 0.002), (0.075, 0.002)], 64, alu, loc=(BB.x, -0.055, BB.z), rot=(PI / 2, 0, 0))
for k in range(5):
    a = 2 * PI * k / 5
    H.tube('ring_spider', [V((BB.x, -0.055, BB.z)), V((BB.x + 0.078 * math.cos(a), -0.055, BB.z + 0.078 * math.sin(a)))], 0.006, 6, alu)
ca = math.radians(35)
for s, a in ((-1, ca), (1, ca + PI)):
    cd = V((math.cos(a), 0, math.sin(a)))
    end = BB + cd * 0.17 + V((0, s * 0.075, 0))
    H.tube('crank', [BB + V((0, s * 0.065, 0)), end], 0.009, 10, alu)
    H.box('pedal', 0.10, 0.08, 0.018, loc=(end.x, end.y + s * 0.05, end.z), mat=black, bev=0.004, seg=2)
H.lathe('cog', [(0.03, -0.004), (0.045, -0.004), (0.045, 0.004), (0.03, 0.004)], 32, steel, loc=(RA.x, -0.055, RA.z), rot=(PI / 2, 0, 0))
# chain path: upper run, around cog, lower run, around ring
cp = []
for a in np.linspace(PI / 2, 3 * PI / 2, 10): cp.append(V((RA.x + 0.047 * math.cos(a), -0.055, RA.z + 0.047 * math.sin(a))))
for a in np.linspace(-PI / 2, PI / 2, 14): cp.append(V((BB.x + (CR + 0.003) * math.cos(a), -0.055, BB.z + (CR + 0.003) * math.sin(a))))
H.sweep('chain', cp, [(p[0], p[1]) for p in H.rrect2d(0.007, 0.005, 0.0015, 2)], chain_m, closed=True, up=(0, 1, 0))
# fenders (arcs over wheels) + kickstand
for c, a0, a1 in ((RA, 0.15, 2.4), (FA, 0.55, 2.7)):
    pts = [c + V((0.36 * math.cos(a), 0, 0.36 * math.sin(a))) for a in np.linspace(a0 if c is FA else PI - a1, a1 if c is FA else PI - a0, 24)]
    H.sweep('fender', pts, [(p[1] * 0.8, p[0]) for p in H.rrect2d(0.05, 0.004, 0.0018, 3)], black, caps=True, up=(0, 1, 0))
H.tube('kickstand', [RA + V((0.12, 0.03, -0.02)), V((RA.x + 0.02, 0.1, 0.004))], 0.008, 10, black)
H.finish('bicycle')
