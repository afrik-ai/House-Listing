# Hanging egg chair: open diagonal rattan weave shell (alpha-masked, baked colour+normal), wrapped rattan rim,
# off-white seat + back cushions, black steel C-stand with round base, chain + hook. ~1.0 x 2.05 x 1.05 m
import sys; sys.path.insert(0, __import__('os').path.dirname(__import__('os').path.abspath(__file__)))
import helpers as H
from helpers import V, PI
import math, numpy as np, bpy, bmesh

H.reset()
# ---- rattan open weave (1024 px per 15 cm tile)
N = 1024
y, x = np.mgrid[0:N, 0:N].astype(np.float32) / N
K = 10
d1 = (x + y) * K; d2 = (x - y) * K
f1 = np.abs((d1 % 1) - 0.5); f2 = np.abs((d2 % 1) - 0.5)
w = 0.30
s1 = f1 < w; s2 = f2 < w
top1 = ((np.floor(d1) + np.floor(d2)) % 2) == 0
p1 = np.sqrt(np.clip(1 - (f1 / w) ** 2, 0, 1)); p2 = np.sqrt(np.clip(1 - (f2 / w) ** 2, 0, 1))
# along-strand undulation (dips where it goes under)
u1 = 0.5 + 0.5 * np.cos(2 * PI * d2); u2 = 0.5 + 0.5 * np.cos(2 * PI * d1)
h1 = np.where(s1, p1 * (0.6 + 0.4 * u1), 0); h2 = np.where(s2, p2 * (0.6 + 0.4 * u2), 0)
on1 = s1 & (~s2 | top1); on2 = s2 & (~s1 | ~top1)
h = np.where(on1, h1 + 0.2, np.where(on2, h2 + 0.2, 0))
alpha = (s1 | s2).astype(np.float32)
fib = H.fnoise(N, 40, 0.8, 5)
fib2 = H.fnoise(N, 0.8, 40, 6)
fibre = np.where(on1, H.fnoise(N, 30, 30, 7) * 0 + np.roll(fib, 0, 0), fib2)
var1 = H.fnoise(N, 200, 3, 8); var2 = H.fnoise(N, 3, 200, 9)
t = np.where(on1, 0.5 + var1 * 0.12 + fibre * 0.08, 0.5 + var2 * 0.12 + fibre * 0.08)
t = t - (1 - np.maximum(h1 * on1, h2 * on2)) * 0.35
col = H.ramp(np.clip(t, 0, 1), [(0, '#6b5033'), (0.5, '#b39468'), (1, '#d9bf96')])
rat_c = H.save_img(np.concatenate([col, alpha[..., None]], -1), 'rattan_c')
rat_n = H.save_img(H.h2n(h * 6 + fibre * 0.15, 1.0), 'rattan_n', True)
rattan = H.pbr('rattan_weave', '#ffffff', 0.62, base_tex=rat_c, alpha_tex=True, normal_tex=rat_n, nstr=1.0, cull=False, blend='MASK')
# wrapped rim: dense helical binding
wrap = 0.5 + 0.5 * np.sin(2 * PI * (y * 24 + x * 1))
wc = H.ramp(np.clip(0.35 + wrap * 0.5 + H.fnoise(N, 2, 30, 11) * 0.08, 0, 1), [(0, '#6b5033'), (0.5, '#ae8e62'), (1, '#d3b88e')])
rim_c = H.save_img(wc, 'rattan_rim_c'); rim_n = H.save_img(H.h2n(wrap * 3, 1.0), 'rattan_rim_n', True)
rimm = H.pbr('rattan_rim', '#ffffff', 0.6, base_tex=rim_c, normal_tex=rim_n)
weave = H.fabric_normal('cushion_weave_n', 1024, 110, seed=21, strength=1.3)
cush = H.pbr('cushion_offwhite', '#e9e4da', 0.9, normal_tex=weave, nstr=1.0)
blk = H.pbr('steel_black', '#1c1c1d', 0.45, 0.5)

# ---- egg shell
A, B, C = 0.47, 0.42, 0.63
ZC = 1.04
NU, NV = 72, 44
vs, fs, uvs = [], [], []
def pt(i, j):
    th = 2 * PI * i / NU; ph = -PI / 2 + PI * j / NV
    nx, ny, nz = math.cos(ph) * math.cos(th), math.cos(ph) * math.sin(th), math.sin(ph)
    # slightly pointed top, fuller bottom
    zz = C * nz * (1.0 if nz < 0 else 1.08)
    return V((A * nx * (1 - 0.12 * max(nz, 0)), B * ny * (1 - 0.12 * max(nz, 0)), ZC + zz)), (nx, ny, nz)
def opening(n):
    nx, ny, nz = n
    return ny < -0.05 and (nx / 0.78) ** 2 + ((nz - 0.12) / 0.66) ** 2 < 1.0
def shape(nx, ny, nz):
    zz = C * nz * (1.0 if nz < 0 else 1.08)
    return V((A * nx * (1 - 0.12 * max(nz, 0)), B * ny * (1 - 0.12 * max(nz, 0)), ZC + zz))
def snap(n):
    """Project a direction inside the opening onto the opening's boundary ellipse."""
    nx, ny, nz = n
    ex, ez = nx / 0.78, (nz - 0.12) / 0.66
    l = math.hypot(ex, ez) or 1e-6
    nx2, nz2 = 0.78 * ex / l, 0.12 + 0.66 * ez / l
    ny2 = -math.sqrt(max(0.0, 1 - nx2 * nx2 - nz2 * nz2))
    return nx2, ny2, nz2
grid = {}
dirs = {}
for j in range(NV + 1):
    for i in range(NU + 1):
        p, n = pt(i % NU, j)
        grid[(i, j)] = len(vs); vs.append(tuple(p)); dirs[len(vs) - 1] = n
used = set()
for j in range(NV):
    for i in range(NU):
        cn = pt(i + 0.5, j + 0.5)[1]
        if opening(cn): continue
        f = (grid[(i, j)], grid[(i + 1, j)], grid[(i + 1, j + 1)], grid[(i, j + 1)])
        fs.append(f); used.update(f)
        su = 2 * PI * 0.44 / 0.15; sv = PI * 0.63 / 0.15
        uvs.append([(i / NU * su, j / NV * sv), ((i + 1) / NU * su, j / NV * sv), ((i + 1) / NU * su, (j + 1) / NV * sv), (i / NU * su, (j + 1) / NV * sv)])
for vi in used:
    n = dirs[vi]
    if n[1] < -0.05 and (n[0] / 0.78) ** 2 + ((n[2] - 0.12) / 0.66) ** 2 < 1.06:
        vs[vi] = tuple(shape(*snap(n)))
shell = H.obj('shell', vs, fs, rattan, uvs)
H.weld(shell, 1e-4)
H.bm_edit(shell, lambda bm: bmesh.ops.delete(bm, geom=[v for v in bm.verts if not v.link_faces], context='VERTS'))
H.bm_edit(shell, lambda bm: bmesh.ops.dissolve_degenerate(bm, dist=1e-4, edges=bm.edges))
H.recalc(shell)
# rim: analytic opening ellipse
pts = []
for k in range(120):
    t = 2 * PI * k / 120
    nx, nz = 0.78 * math.cos(t), 0.12 + 0.66 * math.sin(t)
    ny = -math.sqrt(max(0.0, 1 - nx * nx - nz * nz))
    pts.append(shape(nx, ny, nz))
rim = H.sweep('rim', pts, H.circle2d(0.02, 10), rimm, closed=True, uvscale=0.1)
H.solidify(shell, 0.01, offset=0)
# ---- cushions
sc = H.superellipsoid('seat_cushion', 0.30, 0.27, 0.06, e=2.2, n=2.6, nu=48, nv=12, mat=cush,
                      zfn=lambda xx, yy, zz: zz + 0.012 * max(0, 1 - (xx / 0.3) ** 2 - (yy / 0.27) ** 2) * (1 if zz > 0 else -0.5))
sc.location = (0, 0.03, ZC - C + 0.20)
H.uv_box(sc, 0.2)
bc = H.superellipsoid('back_cushion', 0.27, 0.06, 0.21, e=3.5, n=1.8, nu=48, nv=14, mat=cush)
bc.location = (0, 0.27, ZC + 0.0); bc.rotation_euler = (-0.22, 0, 0)
H.uv_box(bc, 0.2)
# ---- stand: round base + C-arm + hook + chain
H.lathe('base', [(0.0, 0.0), (0.44, 0.0), (0.45, 0.008), (0.44, 0.02), (0.30, 0.035), (0.0, 0.04)], 64, blk)
arc = H.bezier_pts(V((0, 0.40, 0.02)), V((0, 0.62, 1.2)), V((0, 0.56, 2.25)), V((0, 0.02, 2.05)), 40)
H.tube('pole', arc, 0.024, 16, blk)
H.cyl('pole_foot', 0.05, 0.05, loc=(0, 0.40, 0.02), seg=24, mat=blk, bev=0.01)
top_z = ZC + C * 1.08
H.tube('hook', [V((0, 0.02, 2.05)), V((0, 0.0, 2.03)), V((0, 0.0, 1.99))], 0.01, 10, blk)
z = 1.985
k = 0
while z - 0.05 > top_z + 0.03:
    link = H.lathe('link', [(0.012 + 0.005 * math.cos(a), 0.005 * math.sin(a)) for a in np.linspace(0, 2 * PI, 9)], 16, blk,
                   loc=(0, 0, z - 0.025), rot=(0, PI / 2, PI / 2 * (k % 2)))
    link.scale = (1.0, 1.0, 1.0)
    for v in link.data.vertices: v.co.x *= 1.8   # oval link (local X -> vertical after rotation)
    z -= 0.042; k += 1
H.tube('hanger_rod', [V((0, 0, z + 0.01)), V((0, 0, top_z - 0.06))], 0.012, 12, blk)
H.lathe('top_cap', [(0.0, 0.0), (0.06, 0.0), (0.05, 0.03), (0.0, 0.04)], 24, blk, loc=(0, 0, top_z - 0.05))
H.finish('hanging_egg_chair')
