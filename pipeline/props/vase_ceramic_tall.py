# Tall stoneware floor/sideboard vase, matte sand glaze with clay specks, rolled lip, holding dried pampas stems. ~0.45 m
import sys; sys.path.insert(0, __import__('os').path.dirname(__import__('os').path.abspath(__file__)))
import helpers as H, _kit as K
from helpers import V, PI
import math, random
H.reset()
g = K.glaze('glaze_sand', '#cbbba3', rough=0.7, speck=0.6, seed=4)
inside = K.plain('vase_inside', '#3a332c', 0.9)
stem = K.plain('dried_stem', '#b49a72', 0.8)
plume = K.fabric('pampas_plume', '#e3d5bb', threads=40, seed=8, sheen=0.4)
prof = [(0.0, 0.0), (0.06, 0.0), (0.075, 0.01), (0.105, 0.09), (0.11, 0.16), (0.085, 0.27), (0.05, 0.33), (0.042, 0.37), (0.05, 0.385), (0.046, 0.39), (0.036, 0.385), (0.034, 0.34)]
v = H.lathe('vase', prof, 48, g, uvscale=0.2)
H.lathe('inside', [(0.0, 0.34), (0.034, 0.34)], 24, inside)
rnd = random.Random(3)
for i in range(7):
    a = rnd.uniform(0, 2 * PI); lean = rnd.uniform(0.08, 0.3); L = rnd.uniform(0.35, 0.55)
    d = V((math.cos(a) * math.sin(lean), math.sin(a) * math.sin(lean), math.cos(lean)))
    p0 = V((math.cos(a) * 0.01, math.sin(a) * 0.01, 0.30)); p1 = p0 + d * L
    H.tube('stem', [p0, p0.lerp(p1, 0.5) + V((0, 0, 0.01)), p1], 0.002, 5, stem)
    pl = H.superellipsoid('plume', 0.022, 0.022, 0.09, e=2, n=2, nu=10, nv=8, mat=plume)
    pl.location = p1 + d * 0.06
    pl.rotation_euler = (0, lean, a)
    pl.rotation_mode = 'XYZ'
    pl.rotation_euler = (math.atan2(-d.y, d.z), math.asin(max(-1, min(1, d.x))), 0)
H.finish('vase_ceramic_tall', extras={'texres': 512})
