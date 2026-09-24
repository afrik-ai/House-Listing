# Butter croissant: layered crescent (swept tapering rolls) with glossy golden crust. ~0.14 m
import sys; sys.path.insert(0, __import__('os').path.dirname(__import__('os').path.abspath(__file__)))
import helpers as H, _kit as K
from helpers import V, PI
import math, random, numpy as np
H.reset()
cr = H.pbr('croissant_crust', '#c07a2e', 0.45, coat=0.2, normal_tex=H.save_img(H.h2n(H.fnoise(256, 3, 3, 5), 1.0), 'croissant_n', True))
for k, (r, s) in enumerate(((0.012, 0.35), (0.022, 0.75), (0.028, 1.0), (0.022, 0.75), (0.012, 0.35))):
    t0 = -0.9 + k * 0.36
    pts = [V((math.sin(t) * 0.05, (1 - math.cos(t)) * 0.05 - 0.03, 0.022)) for t in np.linspace(t0, t0 + 0.4, 6)]
    o = H.sweep('seg', pts, [(math.cos(a) * r, math.sin(a) * r * 0.8) for a in np.linspace(0, 2 * PI, 12, endpoint=False)], cr, caps=True, scale=[0.8, 1, 1, 1, 1, 0.8], up=(0, 0, 1))
    H.uv_box(o, 0.05)
H.finish('croissant', extras={'texres': 256})
