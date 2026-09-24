# Open aluminium laptop: keyboard with individual keys, trackpad, lid at ~105 deg with an emissive screen
# (desktop wallpaper + windows). Built 0.53 m wide (placed at x0.62 -> 0.33 m). Screen faces +Z (user side).
import sys; sys.path.insert(0, __import__('os').path.dirname(__import__('os').path.abspath(__file__)))
import helpers as H, _kit as K
from helpers import V, PI
import math, random, numpy as np
H.reset()
alu = K.brushed('laptop_alu', '#a9acb0', 0.35)
key = K.plain('laptop_key', '#1d1e20', 0.55)
bez = K.plain('laptop_bezel', '#0c0c0d', 0.3)
N = 512
y, x = np.mgrid[0:N, 0:N].astype(np.float32) / N
img = H.ramp(y, [(0, '#1f3550'), (0.6, '#5d7fa8'), (1, '#c6a58a')])
win = ((x > 0.12) & (x < 0.62) & (y > 0.25) & (y < 0.8))
img[win] = np.array(H.hexc('#f1f2f4', False))
img[win & (y > 0.74)] = np.array(H.hexc('#d9dce1', False))
for r in range(8): img[win & (np.abs(y - (0.68 - r * 0.05)) < 0.008) & (x < 0.2 + (r % 3) * 0.12 + 0.2)] = 0.45
img[(x > 0.55) & (x < 0.9) & (y > 0.12) & (y < 0.5)] = np.array(H.hexc('#2b2e33', False))
img[y < 0.035] = np.array(H.hexc('#dfe3e8', False))
scr = H.pbr('laptop_screen', '#000000', 0.2, base_tex=H.save_img(img.astype(np.float32), 'laptop_screen_c'), emit_tex=H.save_img(img.astype(np.float32), 'laptop_screen_e'), emit_str=1.2)
W, D, T = 0.53, 0.37, 0.016
K.rounded_panel('base', W, D, T, 0.014, alu, loc=(0, 0, 0))
H.box('kb_well', W * 0.86, D * 0.40, 0.001, loc=(0, 0.06, T), mat=key)
cols = 14; kw = W * 0.86 / cols
for r in range(5):
    for c in range(cols):
        H.box('key', kw * 0.82, kw * 0.82, 0.003, loc=(-W * 0.43 + kw * (c + 0.5), 0.06 + D * 0.2 - kw * (r + 0.5), T + 0.0015), mat=key, bev=0.0012, seg=1)
H.box('space', kw * 5.5, kw * 0.82, 0.003, loc=(0, 0.06 + D * 0.2 - kw * 5.5, T + 0.0015), mat=key, bev=0.0012, seg=1)
H.box('trackpad', 0.13, 0.08, 0.0006, loc=(0, -0.12, T + 0.0002), mat=bez)
lid = [K.rounded_panel('lid', W, D, 0.007, 0.014, alu, loc=(0, 0, 0))]
lid.append(H.box('bezel', W - 0.006, D - 0.006, 0.0008, loc=(0, 0, -0.0004), mat=bez))
p = H.obj('screen', [(-W / 2 + 0.015, -D / 2 + 0.02, -0.0009), (W / 2 - 0.015, -D / 2 + 0.02, -0.0009), (W / 2 - 0.015, D / 2 - 0.012, -0.0009), (-W / 2 + 0.015, D / 2 - 0.012, -0.0009)],
          [(0, 3, 2, 1)], scr, uvs=[[(0, 0), (0, 1), (1, 1), (1, 0)]]); lid.append(p)
for o in lid:
    o.location.z += T + 0.0012
H.xform_about(lid, (0, D / 2, T), (-1.83, 0, 0))
H.finish('laptop', extras={'texres': 512})
