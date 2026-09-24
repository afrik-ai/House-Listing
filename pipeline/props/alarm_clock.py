# Retro twin-bell alarm clock: sage enamel case, chrome bells + hammer, ivory dial, brass feet. ~0.11 x 0.14 m, front +Z.
import sys; sys.path.insert(0, __import__('os').path.dirname(__import__('os').path.abspath(__file__)))
import helpers as H, _kit as K
from helpers import V, PI
import math, numpy as np
H.reset()
en = K.plain('clock_enamel', '#8fa38e', 0.3, coat=0.5); chrome = K.plain('clock_chrome', '#dedede', 0.08, 1.0); blk = K.plain('hands_black', '#111111', 0.4)
N = 256
yy, xx = (np.mgrid[0:N, 0:N].astype(np.float32) / N - 0.5); r = np.hypot(xx, yy); a = np.arctan2(yy, xx)
d = np.ones((N, N, 3), np.float32) * np.array(H.hexc('#f1ead8', False))
d[(np.abs(((a / (2 * PI) * 12) % 1) - 0.5) > 0.46) & (r > 0.36) & (r < 0.45)] = 0.12
dial = H.pbr('alarm_dial', '#ffffff', 0.5, base_tex=H.save_img(d, 'alarm_dial_c'))
R, cz = 0.05, 0.065
H.cyl('case', R, 0.04, loc=(0, 0.02, cz), rot=(PI / 2, 0, 0), seg=48, mat=en, bev=0.006)
H.cyl('bezel', R + 0.002, 0.006, loc=(0, -0.018, cz), rot=(PI / 2, 0, 0), seg=48, mat=chrome, bev=0.002)
dd = H.cyl('dial', R - 0.004, 0.002, loc=(0, -0.019, cz), rot=(PI / 2, 0, 0), seg=48, mat=dial); H.uv_planar(dd, axis='Y', size=(2 * R - 0.008, 2 * R - 0.008), origin=(0, cz))
for s in (-1, 1):
    b = H.lathe('bell', [(0.0, 0.028), (0.012, 0.026), (0.026, 0.012), (0.028, 0.0), (0.025, 0.0)], 32, chrome)
    b.location = (s * 0.035, 0.0, cz + 0.042); b.rotation_euler = (0, s * 0.55, 0)
    H.tube('leg', [V((s * 0.03, 0, cz - 0.035)), V((s * 0.042, 0, 0.004))], 0.003, 8, chrome)
    H.superellipsoid('foot', 0.007, 0.007, 0.005, e=2, n=2, nu=12, nv=6, mat=chrome, loc=(s * 0.043, 0, 0.004))
H.tube('hammer', [V((0, 0.0, cz + R)), V((0, 0.0, cz + R + 0.03))], 0.002, 6, chrome)
H.tube('handle', [V((-0.02, 0.005, cz + R - 0.005)), V((0, 0.005, cz + R + 0.018)), V((0.02, 0.005, cz + R - 0.005))], 0.0025, 6, chrome)
for L, ang in ((0.025, 2.2), (0.037, -0.4)):
    h = H.box('hand', 0.003, 0.001, L, loc=(math.sin(ang) * L / 2, -0.021, cz + math.cos(ang) * L / 2), mat=blk); h.rotation_euler = (0, ang, 0)
H.finish('alarm_clock', extras={'texres': 256})
