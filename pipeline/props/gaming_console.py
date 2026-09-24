# Game console (horizontal, matte white with black centre band + LED strip) and a wireless controller in front.
# ~0.36 x 0.09 x 0.30 m
import sys; sys.path.insert(0, __import__('os').path.dirname(__import__('os').path.abspath(__file__)))
import helpers as H, _kit as K
from helpers import V, PI
import math, random, numpy as np
H.reset()
wh = K.plain('console_white', '#e9e9e7', 0.45); bk = K.plain('console_black', '#141416', 0.35)
led = H.pbr('console_led', '#8fc1ff', 0.3, emit='#5aa0ff', emit_str=3.0)
W, D = 0.30, 0.26
for s in (-1, 1):
    p = H.superellipsoid('shell', W / 2, D / 2, 0.018, e=8, n=5, nu=48, nv=8, mat=wh, loc=(0, 0, 0.045 + s * 0.028))
H.box('core', W - 0.02, D - 0.03, 0.04, loc=(0, 0.005, 0.045), mat=bk, bev=0.004)
H.box('led', 0.12, 0.002, 0.002, loc=(0, -D / 2 + 0.009, 0.045), mat=led)
for x in (-0.12, 0.12): H.box('foot', 0.03, 0.2, 0.006, loc=(x, 0, 0.003), mat=bk)
# controller
cx, cy = 0.02, -0.2
H.superellipsoid('pad_body', 0.075, 0.035, 0.018, e=2.5, n=3, nu=40, nv=10, mat=bk, loc=(cx, cy, 0.022))
for s in (-1, 1):
    g = H.superellipsoid('grip', 0.025, 0.035, 0.018, e=2, n=2.5, nu=20, nv=8, mat=bk, loc=(cx + s * 0.055, cy - 0.03, 0.018)); g.rotation_euler = (0, 0, s * 0.4)
    H.cyl('stick', 0.009, 0.012, loc=(cx + s * 0.022, cy - 0.01, 0.034), seg=16, mat=wh, bev=0.003)
H.box('touch', 0.05, 0.03, 0.002, loc=(cx, cy + 0.01, 0.041), mat=wh, bev=0.001, seg=1)
H.finish('gaming_console', extras={'texres': 256})
