# Walnut mantel clock (tambour/napoleon hat case), brass bezel, ivory dial with printed hour marks, black hands.
# Built ~0.30 wide (placed at x0.8). front +Z.
import sys; sys.path.insert(0, __import__('os').path.dirname(__import__('os').path.abspath(__file__)))
import helpers as H, _kit as K
from helpers import V, PI
import math, numpy as np
H.reset()
wal = K.wood('clock_walnut', light='#7e5a3e', mid='#654530', dark='#3e2819', seed=27, coat=0.15)
brass = K.brushed('clock_brass', '#c49a4e', 0.25)
N = 256
yy, xx = (np.mgrid[0:N, 0:N].astype(np.float32) / N - 0.5)
r = np.hypot(xx, yy); a = np.arctan2(yy, xx)
d = np.ones((N, N, 3), np.float32) * np.array(H.hexc('#efe7d4', False))
ticks = ((np.abs(((a / (2 * PI) * 12) % 1) - 0.5) > 0.47) & (r > 0.38) & (r < 0.45)) | ((np.abs(((a / (2 * PI) * 60) % 1) - 0.5) > 0.46) & (r > 0.43) & (r < 0.45)) | ((np.abs(r - 0.47) < 0.005))
d[ticks] = 0.1
dial = H.pbr('clock_dial', '#ffffff', 0.5, base_tex=H.save_img(d, 'clock_dial_c'))
blk = K.plain('clock_hands', '#111111', 0.4)
glass = H.pbr('clock_glass', '#ffffff', 0.02, alpha=0.1, blend='BLEND')
W, D = 0.30, 0.10
# case profile in XZ extruded along Y (napoleon hat)
pts = [(-W / 2, 0.0), (W / 2, 0.0), (W / 2, 0.02), (W / 2 - 0.01, 0.03)]
for i in range(1, 16):
    t = i / 16; x = W / 2 - 0.01 - t * (W - 0.02)
    z = 0.03 + 0.12 * math.sin(PI * t) ** 0.7 + 0.04 * math.exp(-((t - 0.5) / 0.12) ** 2)
    pts.append((x, z))
pts += [(-W / 2 + 0.01, 0.03), (-W / 2, 0.02)]
c = H.extrude_poly('case', pts, -D / 2, D / 2, wal, plane='XZ'); H.uv_box(c, 1.0, along='x'); H.bevel(c, 0.004, 2)
H.box('plinth', W + 0.02, D + 0.02, 0.015, loc=(0, 0, 0.0075), mat=wal, bev=0.003)
for s in (-1, 1): H.cyl('foot', 0.012, 0.008, loc=(s * 0.12, 0, -0.006), mat=brass, seg=16)
cz = 0.115
H.lathe('bezel', [(0.051, 0.0), (0.051, 0.006), (0.056, 0.012), (0.062, 0.01), (0.062, 0.0)], 48, brass, loc=(0, -D / 2 + 0.001, cz), rot=(PI / 2, 0, 0))
dd = H.cyl('dial', 0.052, 0.002, loc=(0, -D / 2 - 0.002, cz), rot=(PI / 2, 0, 0), seg=48, mat=dial); H.uv_planar(dd, axis='Y', size=(0.104, 0.104), origin=(0, cz))
H.cyl('glass', 0.054, 0.001, loc=(0, -D / 2 - 0.009, cz), rot=(PI / 2, 0, 0), seg=48, mat=glass)
for L, ang in ((0.032, 0.9), (0.045, -1.6)):
    h = H.box('hand', 0.003, 0.001, L, loc=(0, -D / 2 - 0.0055, cz), mat=blk); h.rotation_euler = (0, ang, 0)
    h.location = (math.sin(ang) * L / 2, -D / 2 - 0.0055, cz + math.cos(ang) * L / 2)
H.finish('mantel_clock', extras={'texres': 512})
