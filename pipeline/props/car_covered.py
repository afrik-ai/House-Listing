# SUV under a fitted grey fabric car cover (4.8 x 1.85 x 1.9 m, soft draped massing, wheels visible below the
# hem). Nose +Z. Stands in for a parked car in the garage / drive.
import sys, os; sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import helpers as H, _p04kit as K
from helpers import V, PI
import math, numpy as np
H.reset()
cover = K.fabric('car_cover', '#8d9196', 0.95)
tyre = K.rubber('tyre_black')
rim = K.steel('rim_alu', '#a9adb0', 0.35)
def zf(x, y, z):
    return z
# body: lofted rounded sections along Y (length). profile height by y
rings = []
L, W = 4.8, 1.86
for i in range(25):
    t = i / 24; y = -L / 2 + t * L
    top = 1.05 + 0.78 * (math.sin(PI * min(1, max(0, (t - 0.12) / 0.8))) ** 0.35) * (1 if t > 0.3 else 0.45 + 0.55 * t / 0.3)
    top = min(top, 1.9) if t < 0.95 else 1.3
    bot = 0.3
    hw = W / 2 * (0.9 + 0.1 * math.sin(PI * t))
    ring = []
    for a in np.linspace(0, 2 * PI, 33)[:-1]:
        ca, sa = math.cos(a), math.sin(a)
        zc = (top + bot) / 2; hz = (top - bot) / 2
        x = hw * math.copysign(abs(ca) ** 0.35, ca)
        z = zc + hz * math.copysign(abs(sa) ** 0.5, sa)
        if z < 0.45: x *= 1.02
        ring.append(V((x, y, z)))
    rings.append(ring)
b = H.loft('body', rings, cover, cap0=True, cap1=True, uvscale=0.5)
m = b.modifiers.new('s', 'SUBSURF'); m.levels = 1
# drape wrinkles
b = H.apply_mods(b)
for v in b.data.vertices:
    v.co.z += 0.012 * math.sin(v.co.y * 9 + v.co.x * 3) * (1 if v.co.z < 0.9 else 0.3)
H.uv_box(b, 0.5)
for sy in (-1, 1):
    for sx in (-1, 1):
        H.lathe('tyre', [(0.22, -0.12), (0.34, -0.12), (0.37, -0.09), (0.37, 0.09), (0.34, 0.12), (0.22, 0.12)], 32, tyre, loc=(sx * 0.8, sy * 1.45, 0.37), rot=(0, PI / 2, 0))
        H.cyl('rim', 0.22, 0.02, loc=(sx * 0.8 + sx * 0.1, sy * 1.45, 0.37), rot=(0, PI / 2, 0), seg=24, mat=rim)
H.finish('car_covered')
