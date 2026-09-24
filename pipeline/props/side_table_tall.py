# Tall round side table: 0.40 m walnut top with a lipped edge on a black steel tripod, lower ring shelf holding
# a stack of magazines. ~0.40 x 0.64 m.
import sys; sys.path.insert(0, __import__('os').path.dirname(__import__('os').path.abspath(__file__)))
import helpers as H, _kit as K
from helpers import V, PI
import math

H.reset()
wal = K.wood('walnut_tall', light='#8a6246', mid='#6f4c34', dark='#4a3122', seed=16, rings=26)
steel = K.plain('black_steel', '#1b1b1c', 0.45, 0.8)
magA = K.plain('mag_cover_a', '#c9bfa8', 0.35); magB = K.plain('mag_cover_b', '#384a5a', 0.35)
R, HT = 0.20, 0.64
top = H.lathe('top', [(0.0, HT - 0.022), (R - 0.004, HT - 0.022), (R, HT - 0.018), (R, HT + 0.008), (R - 0.012, HT + 0.008), (R - 0.014, HT), (0.0, HT)], 72, wal, sharp=30)
H.uv_planar(top, 1.0)
for k in range(3):
    a = 2 * PI * k / 3 + PI / 2
    p0 = V((math.cos(a) * 0.05, math.sin(a) * 0.05, HT - 0.022)); p1 = V((math.cos(a) * 0.17, math.sin(a) * 0.17, 0.0))
    H.tube('leg', [p0, p0.lerp(p1, 0.5), p1], 0.009, 12, steel)
ring = H.lathe('shelf', [(0.0, 0.2), (0.125, 0.2), (0.125, 0.212), (0.0, 0.212)], 48, steel)
for i, (m, rz) in enumerate(((magA, 0.2), (magB, -0.3), (magA, 0.5))):
    b = H.box('mag', 0.16, 0.21, 0.006, loc=(0, 0, 0.215 + i * 0.007), mat=m, bev=0.001, seg=1); b.rotation_euler = (0, 0, rz)
H.finish('side_table_tall', extras={'texres': 1024})
