# Turned olive-wood serving bowl, end-grain figure, oiled; a few walnuts inside. Built 0.16 m (placed at x1.5-1.6).
import sys; sys.path.insert(0, __import__('os').path.dirname(__import__('os').path.abspath(__file__)))
import helpers as H, _kit as K
import random, math
H.reset()
w = K.wood('olive_wood', light='#c9a878', mid='#a8835a', dark='#6d4f33', seed=23, rings=40, coat=0.2)
nut = K.leather('walnut_shell', '#7a5a3a', seed=24)
b = H.lathe('bowl', [(0.0, 0.0), (0.035, 0.0), (0.04, 0.004), (0.07, 0.03), (0.08, 0.055), (0.079, 0.058), (0.074, 0.057), (0.066, 0.035), (0.034, 0.012), (0.0, 0.01)], 48, w)
H.uv_box(b, 0.25, along='x')
rnd = random.Random(2)
for i in range(5):
    a = rnd.uniform(0, 6.28); r = rnd.uniform(0, 0.03)
    n = H.superellipsoid('nut', 0.013, 0.012, 0.015, e=2, n=2.3, nu=14, nv=10, mat=nut, loc=(math.cos(a) * r, math.sin(a) * r, 0.024 + (0.012 if i > 2 else 0)))
    n.rotation_euler = (rnd.uniform(0, 3), rnd.uniform(0, 3), 0)
H.finish('bowl_wood_02', extras={'texres': 512})
