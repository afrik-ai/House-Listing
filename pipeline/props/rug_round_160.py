# Round low-pile rug, 1.6 m: warm grey wool with tone-on-tone organic arcs and a charcoal bound edge.
import sys; sys.path.insert(0, __import__('os').path.dirname(__import__('os').path.abspath(__file__)))
import helpers as H
from helpers import V, PI
import math, numpy as np, bpy

H.reset()
R, T = 0.8, 0.010
N = 1024
y, x = np.mgrid[0:N, 0:N].astype(np.float32)
u = (x / N - 0.5) * 2 * R; v = (y / N - 0.5) * 2 * R
r = np.sqrt(u * u + v * v)
wob = H.fnoise(N, 80, 80, 3) * 0.05 + H.fnoise(N, 20, 20, 4) * 0.008
# offset concentric arcs (like ripples from an off-centre point) -> tone-on-tone
cx, cy = 0.35, -0.25
rr = np.sqrt((u - cx) ** 2 + (v - cy) ** 2) + wob
rip = 0.5 + 0.5 * np.cos(2 * PI * rr / 0.11)
rip = np.clip((rip - 0.82) / 0.18, 0, 1)
fade = np.clip(1.3 - rr / 1.1, 0, 1)
ab = H.fnoise(N, 150, 150, 9) * 0.04 + H.fnoise(N, 1.0, 1.0, 10) * 0.04
base = H.colmix(np.clip(0.5 + ab * 4, 0, 1), '#958e83', '#a39c90')
light = np.array(H.hexc('#d4cec3', False))
col = base * (1 - (rip * fade)[..., None] * 0.9) + light[None, None, :] * (rip * fade)[..., None] * 0.9
col = np.clip(col * (1 + H.fnoise(N, 1.3, 1.3, 11)[..., None] * 0.03), 0, 1)
cimg = H.save_img(col, 'rug_round_c')
pile = H.pile_normal()
rug = H.rug_mat('rug_wool_round', cimg, pile, nstr=1.5)
bind = H.pbr('rug_binding_charcoal', '#34353a', 0.85, normal_tex=pile, nstr=0.8, uv_normal='UVPile')
# disc: rings of verts
seg = 128
rings = [0.0, 0.2, 0.4, 0.55, 0.68, R - 0.012]
vs = [(0, 0, T)]; fs = []
wave = H.fnoise(64, 12, 12, 6)
for k, rr_ in enumerate(rings[1:]):
    for i in range(seg):
        a = 2 * PI * i / seg
        vs.append((rr_ * math.cos(a), rr_ * math.sin(a), T + wave[int(k * 10) % 64, i % 64] * 0.0006))
for i in range(seg):
    fs.append((0, 1 + i, 1 + (i + 1) % seg))
for k in range(len(rings) - 2):
    for i in range(seg):
        a = 1 + k * seg + i; b = 1 + k * seg + (i + 1) % seg
        fs.append((a, a + seg, b + seg, b))
top = H.obj('rug_top', vs, fs, rug)
H.solidify(top, T - 0.001, offset=-1.0)
top = H.apply_mods(top)
H.uv_planar(top, axis='Z', size=(2 * R, 2 * R))
H.uv_planar(top, 0.08, axis='Z', name='UVPile')
# bound edge: rounded tube around the perimeter
path = [V(((R - 0.009) * math.cos(2 * PI * i / seg), (R - 0.009) * math.sin(2 * PI * i / seg), 0)) for i in range(seg)]
prof = [(p[0], p[1]) for p in H.rrect2d(0.020, 0.0105, 0.005, 3)]
e = H.sweep('binding', path, [(py, px) for px, py in prof], bind, closed=True, up=(0, 0, 1))
for vtx in e.data.vertices: vtx.co.z += 0.00525
H.uv_box(e, 0.08, name='UVMap'); H.uv_box(e, 0.08, name='UVPile')
H.finish('rug_round_160')
