# Solid ash bathroom stool (P07): round dished seat 0.32 m, three splayed legs with a stretcher ring. ~0.46 m
import sys; sys.path.insert(0, __import__('os').path.dirname(__import__('os').path.abspath(__file__)))
import helpers as H, _kit as K
from helpers import V, PI
import math
H.reset()
ash = K.wood('ash_stool', light='#d7bf98', mid='#bfa27a', dark='#977a55', seed=26)
Hh, R = 0.46, 0.16
s = H.lathe('seat', [(0.0, Hh - 0.028), (R - 0.01, Hh - 0.03), (R, Hh - 0.02), (R, Hh - 0.006), (R - 0.008, Hh), (R * 0.5, Hh - 0.004), (0.0, Hh - 0.006)], 64, ash, sharp=40)
H.uv_planar(s, 1.0)
for k in range(3):
    a = 2 * PI * k / 3
    top = V((math.cos(a) * 0.09, math.sin(a) * 0.09, Hh - 0.03)); bot = V((math.cos(a) * 0.17, math.sin(a) * 0.17, 0.0))
    l = H.tube('leg', [bot, top], 0.017, 12, ash); H.uv_box(l, 1.0, along='z')
ring = [V((math.cos(t / 48 * 2 * PI) * 0.135, math.sin(t / 48 * 2 * PI) * 0.135, 0.16)) for t in range(48)]
H.tube('stretcher', ring, 0.009, 8, ash, closed=True, up=(0, 0, 1))
H.finish('stool_wood', extras={'texres': 512})
