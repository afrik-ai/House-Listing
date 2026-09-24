# Station wall clock 0.40 m: black steel rim, white dial with bold hour bars, red second hand. Back at -Z (wall).
import sys; sys.path.insert(0, __import__('os').path.dirname(__import__('os').path.abspath(__file__)))
import helpers as H, _kit as K
from helpers import V, PI
import math, random, numpy as np
H.reset()
N = 512
yy, xx = (np.mgrid[0:N, 0:N].astype(np.float32) / N - 0.5); r = np.hypot(xx, yy); a = np.arctan2(yy, xx)
d = np.ones((N, N, 3), np.float32) * 0.96
d[(np.abs(((a / (2 * PI) * 12) % 1) - 0.5) > 0.47) & (r > 0.33) & (r < 0.45)] = 0.08
d[(np.abs(((a / (2 * PI) * 60) % 1) - 0.5) > 0.485) & (r > 0.42) & (r < 0.45)] = 0.1
dial = H.pbr('wc_dial', '#ffffff', 0.5, base_tex=H.save_img(d, 'wc_dial_c'))
blk = K.plain('wc_black', '#161616', 0.4, 0.6); red = K.plain('wc_red', '#c0261d', 0.4)
glass = H.pbr('wc_glass', '#ffffff', 0.02, alpha=0.1, blend='BLEND')
R = 0.2
H.lathe('rim', [(0.0, 0.0), (R, 0.0), (R + 0.005, 0.02), (R, 0.05), (R - 0.012, 0.05), (R - 0.012, 0.01)], 64, blk, rot=(-PI / 2, 0, 0))
dd = H.cyl('dial', R - 0.012, 0.002, loc=(0, 0, 0), rot=(-PI / 2, 0, 0), seg=64, mat=dial); dd.location = (0, 0.012, 0)
H.uv_planar(dd, axis='Z', size=(2 * R - 0.024, 2 * R - 0.024))
H.cyl('glass', R - 0.011, 0.002, loc=(0, 0.045, 0), rot=(-PI / 2, 0, 0), seg=64, mat=glass)
for L, w, ang, m, yo in ((0.11, 0.012, 2.4, blk, 0.02), (0.16, 0.009, -0.5, blk, 0.024), (0.15, 0.003, 1.2, red, 0.028)):
    h = H.box('hand', w, 0.002, L, loc=(math.sin(ang) * L * 0.4, -yo, math.cos(ang) * L * 0.4), mat=m); h.rotation_euler = (0, ang, 0)
H.cyl('hub', 0.01, 0.01, loc=(0, -0.02, 0), rot=(PI / 2, 0, 0), seg=16, mat=red)
import bpy
for o in bpy.context.scene.objects: pass
H.finish('wall_clock', extras={'texres': 512})
