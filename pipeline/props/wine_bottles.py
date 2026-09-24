# Wine bottles, 2 variants: wine_bottles_01_bordeaux (high shoulders, dark green, cream label, burgundy capsule)
# and wine_bottles_01_burgundy (sloped shoulders, olive glass, kraft label, gold capsule). 0.30-0.31 m.
import sys; sys.path.insert(0, __import__('os').path.dirname(__import__('os').path.abspath(__file__)))
import helpers as H, _kit as K
from helpers import V, PI
import math, random, numpy as np
H.reset()
import bpy
seen = set()
def grab():
    new = [o for o in bpy.context.scene.objects if o.type == 'MESH' and o.name not in seen]; seen.update(o.name for o in new); return new
def label_img(name, bg, ink):
    N = 256
    y, x = np.mgrid[0:N, 0:N].astype(np.float32) / N
    c = np.ones((N, N, 3), np.float32) * np.array(H.hexc(bg, False))
    band = (np.abs(y - 0.62) < 0.08) & (np.abs(x % 0.25 - 0.125) < 0.1)
    lines = (np.abs(y - 0.35) < 0.015) | (np.abs(y - 0.28) < 0.01) | (np.abs(y - 0.85) < 0.006)
    c[band | lines] = np.array(H.hexc(ink, False))
    c *= (0.95 + H.fnoise(N, 2, 2, 3)[..., None] * 0.02)
    return H.save_img(np.clip(c, 0, 1), name)
def bottle(prefix, x, glass_col, prof, lab_z, cap_col, lab_bg, ink):
    g = H.pbr(prefix + '_glass', glass_col, 0.05, alpha=0.85, spec=0.9, blend='BLEND')
    lab = H.pbr(prefix + '_label', '#ffffff', 0.7, base_tex=label_img(prefix + '_label_c', lab_bg, ink))
    cap = K.plain(prefix + '_capsule', cap_col, 0.35, 0.6)
    wine = K.plain(prefix + '_wine', '#2a0508', 0.1)
    H.lathe('bottle', prof, 40, g, loc=(x, 0, 0))
    H.lathe('wine', [(0.0, 0.006), (prof[2][0] - 0.004, 0.008), (prof[2][0] - 0.004, 0.2), (0.0, 0.2)], 24, wine, loc=(x, 0, 0))
    r = prof[3][0] + 0.0008
    lb = H.cyl('label', r, lab_z[1] - lab_z[0], loc=(x, 0, lab_z[0]), seg=40, mat=lab, caps=False)
    me = lb.data; uvl = me.uv_layers.new(name='UVMap')
    for p in me.polygons:
        for li in p.loop_indices:
            co = me.vertices[me.loops[li].vertex_index].co
            uvl.data[li].uv = ((math.atan2(co.y, co.x) / (2 * PI)) % 1.0, co.z / (lab_z[1] - lab_z[0]))
    top = prof[-1][1]
    H.cyl('capsule', 0.0155, 0.05, loc=(x, 0, top - 0.048), seg=24, mat=cap, bev=0.002)
V_ = {}
bottle('bdx', 0.0, '#1f3a22', [(0.0, 0.0), (0.03, 0.002), (0.037, 0.008), (0.037, 0.2), (0.034, 0.215), (0.018, 0.232), (0.0145, 0.25), (0.0145, 0.29), (0.0165, 0.295), (0.0155, 0.3)], (0.06, 0.16), '#5b1420', '#efe6d0', '#2a2a2a')
V_['wine_bottles_01_bordeaux'] = grab()
bottle('bgy', 1.0, '#4a4a1c', [(0.0, 0.0), (0.035, 0.002), (0.041, 0.008), (0.041, 0.15), (0.036, 0.19), (0.022, 0.235), (0.0145, 0.26), (0.0145, 0.3), (0.0165, 0.305), (0.0155, 0.31)], (0.05, 0.13), '#b58c3a', '#c8a77a', '#3c2a1a')
V_['wine_bottles_01_burgundy'] = grab()
H.finish('wine_bottles', variants=V_, extras={'texres': 256})
