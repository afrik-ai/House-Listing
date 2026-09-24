# Antique blue-and-white porcelain ginger jar with lid (painted foliage band via procedural texture). ~0.22 x 0.32 m
import sys; sys.path.insert(0, __import__('os').path.dirname(__import__('os').path.abspath(__file__)))
import helpers as H, _kit as K
from helpers import V, PI
import math, random, numpy as np
H.reset()
N = 512
y, x = np.mgrid[0:N, 0:N].astype(np.float32) / N
pat = (np.sin(x * 2 * PI * 6 + np.sin(y * 2 * PI * 3) * 2) * np.sin(y * 2 * PI * 8 + x * 4) > 0.45).astype(np.float32)
band = ((y > 0.3) & (y < 0.75)).astype(np.float32)
lines = (np.abs(y - 0.28) < 0.01) | (np.abs(y - 0.77) < 0.01) | (np.abs(y - 0.12) < 0.006)
t = np.clip(pat * band + lines, 0, 1) * (0.85 + H.fnoise(N, 6, 6, 3) * 0.1)
col = H.colmix(np.clip(t, 0, 1), '#f1efe8', '#1f3d7a')
por = H.pbr('ginger_porcelain', '#ffffff', 0.15, base_tex=H.save_img(col, 'ginger_c'))
prof = [(0.0, 0.0), (0.06, 0.0), (0.075, 0.02), (0.11, 0.12), (0.105, 0.2), (0.07, 0.24), (0.055, 0.25), (0.055, 0.26)]
j = H.lathe('jar', prof, 48, por)
me = j.data; uv = me.uv_layers.new(name='UVMap')
for p in me.polygons:
    for li in p.loop_indices:
        co = me.vertices[me.loops[li].vertex_index].co
        uv.data[li].uv = ((math.atan2(co.y, co.x) / (2 * PI)) % 1.0 * 2, co.z / 0.26)
H.lathe('lid', [(0.058, 0.255), (0.06, 0.27), (0.045, 0.3), (0.012, 0.31), (0.015, 0.325), (0.0, 0.33)], 40, K.glaze('ginger_lid', '#233f78', rough=0.15, seed=151))
H.finish('vase_antique_ceramic', extras={'texres': 512})
