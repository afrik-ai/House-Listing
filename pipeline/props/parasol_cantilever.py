# Cantilever parasol: 3 x 3 m off-white canvas canopy on 8 ribs, anthracite aluminium mast + arm,
# cross base weighted with 4 concrete slabs. ~3.5 x 2.95 x 3.0 m
import sys; sys.path.insert(0, __import__('os').path.dirname(__import__('os').path.abspath(__file__)))
import helpers as H
from helpers import V, PI
import math, numpy as np, bpy

H.reset()
weave = H.fabric_normal('canvas_n', 1024, 96, seed=3, strength=1.4)
canvas = H.pbr('parasol_canvas', '#ebe6da', 0.9, normal_tex=weave, nstr=1.0)
alu = H.pbr('anthracite_alu', '#2d2f32', 0.42, 0.4)
steel = H.pbr('steel_dark', '#3a3c3e', 0.5, 0.6)
conc_n = H.save_img(H.h2n(H.fnoise(512, 1.5, 1.5, 5) * 0.6 + H.fnoise(512, 6, 6, 6) * 0.4, 0.8), 'slab_conc_n', True)
conc = H.pbr('concrete_slab', '#9c9a95', 0.85, normal_tex=conc_n, nstr=0.8)

HS = 1.5          # canopy half size
ZH = 2.75         # hub height
DROP = 0.55       # hub -> edge drop
def edge_pt(phi):
    c, s = math.cos(phi), math.sin(phi)
    m = max(abs(c), abs(s))
    return V((HS * c / m, HS * s / m, 0))
NA, NR = 96, 18
vs, fs, uvs = [], [], []
vs.append((0, 0, ZH))
def surf(r, phi):
    e = edge_pt(phi)
    k = (phi / (PI / 4)) % 1.0
    sag = 0.03 * math.sin(PI * k) * r ** 2.0          # canvas dips between ribs
    return V((e.x * r, e.y * r, ZH - DROP * (r ** 0.92) - sag))
for j in range(1, NR + 1):
    r = j / NR
    for i in range(NA):
        vs.append(tuple(surf(r, 2 * PI * i / NA)))
for i in range(NA):
    fs.append((0, 1 + i, 1 + (i + 1) % NA))
for j in range(NR - 1):
    for i in range(NA):
        a = 1 + j * NA + i; b = 1 + j * NA + (i + 1) % NA
        fs.append((a, a + NA, b + NA, b))
# valance: hang 0.13 m down from the edge ring
base_i = 1 + (NR - 1) * NA
vi0 = len(vs)
for i in range(NA):
    p = V(vs[base_i + i])
    vs.append((p.x * 1.002, p.y * 1.002, p.z - 0.10))
for i in range(NA):
    a = base_i + i; b = base_i + (i + 1) % NA
    fs.append((a, vi0 + i, vi0 + (i + 1) % NA, b))
can = H.obj('canopy', vs, fs, canvas)
H.recalc(can)
H.solidify(can, 0.003, offset=0)
can = H.apply_mods(can)
H.uv_box(can, 0.25)
H.sharpen(can, 4)
# finial on top
H.lathe('finial', [(0.0, 0.0), (0.07, 0.0), (0.065, 0.02), (0.03, 0.05), (0.012, 0.09), (0.0, 0.1)], 32, alu, loc=(0, 0, ZH - 0.01))
# ribs under the canvas
for k in range(8):
    phi = k * PI / 4
    pts = [surf(r, phi) - V((0, 0, 0.012)) for r in np.linspace(0.04, 0.985, 10)]
    H.tube('rib', pts, 0.008, 8, alu)
    # stretchers from runner to mid-rib
    H.tube('stretcher', [V((0, 0, ZH - 0.42)), surf(0.45, phi) - V((0, 0, 0.02))], 0.0065, 8, alu)
H.cyl('runner', 0.035, 0.08, loc=(0, 0, ZH - 0.46), seg=24, mat=alu, bev=0.01)
H.cyl('hub_pole', 0.022, 0.46, loc=(0, 0, ZH - 0.44), seg=20, mat=alu)
# cantilever mast + arm
MX = -HS - 0.28
ZA = ZH + 0.26
mast = H.box_minmax('mast', (MX - 0.045, -0.045, 0.08), (MX + 0.045, 0.045, ZA + 0.05), mat=alu, bev=0.008, seg=3)
arm = H.box_minmax('arm', (MX - 0.04, -0.035, ZA - 0.04), (0.06, 0.035, ZA + 0.03), mat=alu, bev=0.008, seg=3)
H.box_minmax('arm_cap', (-0.05, -0.045, ZA - 0.07), (0.07, 0.045, ZA + 0.04), mat=alu, bev=0.01, seg=3)
H.cyl('hanger', 0.02, ZA - ZH - 0.05, loc=(0, 0, ZH + 0.05), seg=16, mat=alu)
H.tube('strut', [V((MX + 0.03, 0, ZA - 0.75)), V((MX + 0.9, 0, ZA - 0.03))], 0.018, 12, alu)
H.box_minmax('crank_box', (MX + 0.04, -0.05, 1.1), (MX + 0.1, 0.05, 1.3), mat=alu, bev=0.01, seg=3)
H.tube('crank', [V((MX + 0.1, 0, 1.2)), V((MX + 0.16, 0, 1.2)), V((MX + 0.16, -0.12, 1.2)), V((MX + 0.2, -0.12, 1.2))], 0.008, 8, steel)
H.cyl('mast_foot', 0.09, 0.08, loc=(MX, 0, 0.07), seg=24, mat=steel, bev=0.01)
# cross base + 4 slabs
for a in (PI / 4, 3 * PI / 4, 5 * PI / 4, 7 * PI / 4):
    b = H.box('base_arm', 0.62, 0.08, 0.05, loc=(MX + 0.31 * math.cos(a), 0.31 * math.sin(a), 0.025), rot=(0, 0, a), mat=steel, bev=0.006, seg=2)
for dx in (-0.25, 0.25):
    for dy in (-0.25, 0.25):
        s = H.box('slab', 0.49, 0.49, 0.045, loc=(MX + dx, dy, 0.05 + 0.0225), mat=conc, bev=0.006, seg=2)
        H.uv_box(s, 0.5)
H.finish('parasol_cantilever')
