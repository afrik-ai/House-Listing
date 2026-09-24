# Low-pile wool rug 2.0 x 3.0 m: ivory with a hand-drawn charcoal diamond lattice (Berber style), bound long
# edges and cotton fringe on the short ends.
import sys; sys.path.insert(0, __import__('os').path.dirname(__import__('os').path.abspath(__file__)))
import helpers as H
from helpers import V, PI
import math, numpy as np, bpy

H.reset()
W, L, T = 2.0, 3.0, 0.011
# ---- colour texture (682 x 1024 covers the whole rug)
NW, NL = 682, 1024
y, x = np.mgrid[0:NL, 0:NW].astype(np.float32)
u = x / NW * W; v = y / NL * L                         # metres
wob = H.fnoise(NW, 60, 60, 3, NL)[:NL, :NW] * 0.012 + H.fnoise(NW, 12, 12, 4, NL)[:NL, :NW] * 0.003
# diamond lattice inside a border
bx, by = 0.16, 0.16
inner = (u > bx) & (u < W - bx) & (v > by) & (v < L - by)
cu, cv = (u - W / 2), (v - L / 2)
p = 0.25; q = 0.36                                   # diamond half-diagonals (m)
d1 = (cu / p + cv / q) ; d2 = (cu / p - cv / q)
f1 = np.abs(((d1 + wob * 3.5) % 1.0) - 0.5); f2 = np.abs(((d2 - wob * 3.5) % 1.0) - 0.5)
lw = 0.018 + H.fnoise(NW, 30, 30, 7, NL)[:NL, :NW] * 0.004
line = np.clip(1 - np.minimum(f1, f2) * (p / 1.0) / lw * 2.2, 0, 1)
line = np.where(inner, line, 0)
# double border lines
def band(dist, w):
    return np.clip(1 - np.abs(dist) / w, 0, 1)
e = np.minimum(np.minimum(u, W - u), np.minimum(v, L - v)) + wob
border = np.maximum(band(e - 0.10, 0.012), band(e - 0.135, 0.006))
ink = np.clip(np.maximum(line, border) * 1.4, 0, 1)
# wool: abrash + fleck
ab = H.fnoise(NW, 200, 30, 9, NL)[:NL, :NW] * 0.03 + H.fnoise(NW, 1.0, 1.0, 10, NL)[:NL, :NW] * 0.035
base = H.colmix(np.clip(0.5 + ab * 4, 0, 1), '#e2dccf', '#ece7dc')
col = base * (1 - ink[..., None]) + np.array(H.hexc('#34322f', False))[None, None, :] * ink[..., None]
col = np.clip(col * (1 + H.fnoise(NW, 1.3, 1.3, 11, NL)[:NL, :NW, None] * 0.03), 0, 1)
cimg = H.save_img(col, 'rug_rect_c')
pile = H.pile_normal()
rug = H.rug_mat('rug_wool', cimg, pile, nstr=1.5)
binding = H.pbr('rug_binding', '#d9d3c5', 0.9, normal_tex=pile, nstr=0.5, uv_normal='UVPile')
fringe_m = H.pbr('rug_fringe', '#e6e0d2', 0.9)
# ---- slab (slightly wavy top), bevelled edge
nx, ny = 24, 36
vs, fs = [], []
wave = H.fnoise(64, 10, 10, 21)
for j in range(ny + 1):
    for i in range(nx + 1):
        xx = -W / 2 + W * i / nx; yy = -L / 2 + L * j / ny
        vs.append((xx, yy, T + wave[j % 64, i % 64] * 0.0008))
for j in range(ny):
    for i in range(nx):
        a = j * (nx + 1) + i
        fs.append((a, a + 1, a + nx + 2, a + nx + 1))
top = H.obj('rug_top', vs, fs, rug)
H.solidify(top, T, offset=-1.0)
top = H.apply_mods(top)
H.uv_planar(top, axis='Z', size=(W, L))
H.uv_planar(top, 0.08, axis='Z', name='UVPile')
# side bands (binding) get the binding material
top.data.materials.append(binding)
for pp in top.data.polygons:
    if abs(pp.normal.z) < 0.5: pp.material_index = 1
H.bevel(top, 0.0045, 3, angle=40)
# ---- fringe on the short ends
rng = np.random.default_rng(5)
strands = []
prof = H.circle2d(0.0022, 5, 0.003)
for side in (-1, 1):
    n = int(W / 0.011)
    for k in range(n):
        x0 = -W / 2 + 0.02 + k * (W - 0.04) / (n - 1) + rng.normal(0, 0.0012)
        ln = 0.065 + rng.normal(0, 0.004)
        ang = rng.normal(0, 0.09)
        curl = rng.normal(0, 0.012)
        pts = []
        for s in range(5):
            t = s / 4
            pts.append(V((x0 + math.sin(ang) * ln * t + curl * t * t, side * (L / 2 - 0.004 + math.cos(ang) * ln * t), 0.0028 + 0.004 * (1 - t) ** 2)))
        strands.append(H.sweep('fringe', pts, prof, fringe_m, caps=True, up=(0, 0, 1)))
fr = H.join(strands, 'fringes')
H.finish('rug_rect_200x300')
