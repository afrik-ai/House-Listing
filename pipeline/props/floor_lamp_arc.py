# Arc floor lamp: Carrara marble block base, brushed stainless arc (telescoping sections), polished aluminium
# dome shade with white inside and an emissive LED disc. ~1.9 x 2.2 x 0.4 m
import sys; sys.path.insert(0, __import__('os').path.dirname(__import__('os').path.abspath(__file__)))
import helpers as H
from helpers import V, PI
import math, numpy as np, bpy

H.reset()
N = 1024
y, x = np.mgrid[0:N, 0:N].astype(np.float32) / N
turb = H.fbm(N, 180, 5, seed=91) * 1.0
v1 = np.abs(np.sin((x * 3 + y * 1.3 + turb * 0.9) * 2 * PI))
v2 = np.abs(np.sin((x * 1.1 - y * 2.2 + H.fbm(N, 90, 4, seed=95) * 0.7) * 2 * PI))
vein = np.clip((1 - v1) ** 7 * 0.9 + (1 - v2) ** 16 * 0.6 + np.clip(H.fbm(N, 40, 4, seed=99) - 0.8, 0, 1) * 0.4, 0, 1)
cloud = H.fbm(N, 120, 4, seed=97) * 0.03
col = H.colmix(np.clip(vein * 0.85, 0, 1), '#eeece8', '#8a8d92') * (1 + cloud[..., None])
marble_c = H.save_img(col, 'lamp_marble_c')
marble_n = H.save_img(H.h2n(-vein * 0.3 + H.fnoise(N, 1.0, 1.0, 3) * 0.05, 0.3), 'lamp_marble_n', True)
marble = H.pbr('carrara_marble', '#ffffff', 0.18, base_tex=marble_c, normal_tex=marble_n, nstr=0.4, spec=0.55)
b = H.tex_brushed(512, seed=5)
steel = H.pbr('brushed_steel', '#cfd0d2', 0.28, 1.0)
alu = H.pbr('polished_aluminium', '#d8d9db', 0.14, 1.0)
inside = H.pbr('shade_inside_white', '#f2f2f0', 0.5)
led = H.pbr('led_diffuser', '#fffaf0', 0.3, emit='#ffe9c8', emit_str=6.0)
felt = H.pbr('felt_pad', '#2b2b2b', 0.95)

# base block
BW, BD, BH = 0.42, 0.26, 0.32
blk = H.box_minmax('base', (-BW / 2, -BD / 2, 0.004), (BW / 2, BD / 2, BH), mat=marble)
H.uv_box(blk, 0.6); H.bevel(blk, 0.012, 3); H.wnormal(blk)
H.box_minmax('felt', (-BW / 2 + 0.01, -BD / 2 + 0.01, 0.0), (BW / 2 - 0.01, BD / 2 - 0.01, 0.005), mat=felt)
# arc: cubic bezier from base top to the shade hanger
p0, p1, p2, p3 = V((-0.05, 0, BH - 0.02)), V((-0.05, 0, 2.25)), V((1.35, 0, 2.45)), V((1.72, 0, 1.98))
pts = H.bezier_pts(p0, p1, p2, p3, 60)
L = [0.0]
for i in range(1, len(pts)): L.append(L[-1] + (pts[i] - pts[i - 1]).length)
# three telescoping sections with slightly different radii + collars
secs = [(0.0, 0.38, 0.0135), (0.38, 0.70, 0.0118), (0.70, 1.0, 0.0102)]
for a, bb, r in secs:
    ids = [i for i in range(len(pts)) if a * L[-1] - 1e-6 <= L[i] <= bb * L[-1] + 1e-6]
    H.tube('arc', [pts[i] for i in ids], r, 16, steel)
    if a > 0:
        i0 = ids[0]
        c = H.tube('collar', [pts[i0] - (pts[i0 + 1] - pts[i0]).normalized() * 0.02, pts[i0] + (pts[i0 + 1] - pts[i0]).normalized() * 0.02], r + 0.004, 16, steel)
H.cyl('socket', 0.024, 0.04, loc=(-0.05, 0, BH - 0.005), seg=24, mat=steel, bev=0.004)
# shade: dome hanging at p3
sx, sz = p3.x + 0.02, p3.z - 0.06
prof = [(0.0, 0.19), (0.05, 0.188), (0.1, 0.175), (0.145, 0.145), (0.175, 0.1), (0.195, 0.04), (0.2, 0.0), (0.196, -0.003)]
H.lathe('shade', prof, 64, alu, loc=(sx, 0, sz - 0.19))
inner = [(r * 0.97, z * 0.97 - 0.004) for r, z in prof[:-1]]
H.lathe('shade_in', inner[::-1], 64, inside, loc=(sx, 0, sz - 0.19))
H.cyl('led', 0.07, 0.01, loc=(sx, 0, sz - 0.19 + 0.12), seg=32, mat=led)
H.cyl('hanger', 0.012, 0.05, loc=(sx, 0, sz - 0.01), seg=16, mat=steel)
H.tube('hook', [p3, V((sx, 0, p3.z)), V((sx, 0, sz + 0.03))], 0.009, 12, steel)
H.finish('floor_lamp_arc')
