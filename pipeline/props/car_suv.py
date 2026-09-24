# Stylised-realistic modern mid/large SUV (XC90-like massing): lofted + subdivided body with face-classified
# paint / glass / black trim / lights / grille regions, panel-gap strips raycast onto the body, mirrors, roof
# rails, 20" twin-spoke alloys with brake discs, tyres with tread grooves. ~1.98 x 1.74 x 4.82 m, nose = glTF +Z.
import sys; sys.path.insert(0, 'C:/Users/Owner/HouseListing/pipeline/props')
import helpers as H
from helpers import V, PI
import math, numpy as np, bpy, bmesh
from mathutils.bvhtree import BVHTree

H.reset()
# ------------------------------------------------------------------ materials
paint = H.pbr('paint_graphite_metallic', '#3b4046', 0.32, 0.55, coat=1.0, coat_rough=0.03)
glass = H.pbr('glass_tinted', '#0a0c0f', 0.03, 0.0, spec=0.55)
trim = H.pbr('trim_black_gloss', '#0c0c0d', 0.08, 0.0, spec=0.5)
tex_n = H.save_img(H.h2n(H.fnoise(512, 1.3, 1.3, 7) * 0.5 + H.fnoise(512, 3, 3, 8) * 0.3, 0.9), 'plastic_grain_n', True)
plastic = H.pbr('plastic_black_textured', '#191a1b', 0.7, normal_tex=tex_n, nstr=0.8)
chrome = H.pbr('chrome', '#d9dadc', 0.1, 1.0)
under = H.pbr('underbody', '#0e0e0e', 0.9)
# grille: vertical chrome slats on black
G = 512
gy, gx = np.mgrid[0:G, 0:G].astype(np.float32) / G
sl = np.clip(1 - np.abs(((gx * 16) % 1) - 0.5) / 0.14, 0, 1)
grc = H.colmix(sl, '#0b0b0c', '#b9bbbe')
gri_c = H.save_img(grc, 'grille_c'); gri_n = H.save_img(H.h2n(sl ** 0.5 * 6, 1.0), 'grille_n', True)
gri_o = H.save_img(H.orm(0.5 - sl * 0.35, sl * 0.9), 'grille_orm', True)
grille = H.pbr('grille', '#ffffff', 0.4, base_tex=gri_c, normal_tex=gri_n, rough_tex=gri_o)
head = H.pbr('headlight_lens', '#20242a', 0.05, 0.6, spec=0.7)
drl = H.pbr('drl_led', '#ffffff', 0.3, emit='#e8f2ff', emit_str=8.0)
tail = H.pbr('taillight_red', '#5a0508', 0.08, 0.0, emit='#ff1a10', emit_str=0.6, spec=0.7)
tread_n = H.save_img(H.h2n(H.fnoise(512, 1.2, 1.2, 3) * 0.4 + np.abs(np.sin(np.mgrid[0:512, 0:512][1] / 512 * 2 * PI * 48 + np.mgrid[0:512, 0:512][0] / 512 * 2 * PI * 3)) * 0.8, 1.4), 'car_tread_n', True)
tyre = H.pbr('tyre_rubber', '#171717', 0.82, normal_tex=tread_n, nstr=0.8)
side = H.pbr('tyre_sidewall', '#1d1d1d', 0.75)
alloy = H.pbr('alloy_silver', '#b4b7ba', 0.28, 0.9)
disc = H.pbr('brake_disc', '#6b6c6e', 0.45, 1.0)
caliper = H.pbr('caliper_grey', '#3a3c3f', 0.5, 0.4)
plate_m = H.pbr('plate_white', '#f2f2f0', 0.4)
plate_t = H.pbr('plate_text', '#101010', 0.5)

# ------------------------------------------------------------------ body sections (length along Y, nose at -Y)
KY = [-2.43, -2.40, -2.33, -2.22, -2.05, -1.47, -1.0, -0.78, -0.40, -0.05, 0.10, 1.00, 1.90, 2.08, 2.22, 2.34, 2.40, 2.43]
T_zt = [0.86, 0.90, 0.93, 0.95, 0.97, 1.00, 1.03, 1.06, 1.33, 1.63, 1.70, 1.725, 1.70, 1.67, 1.50, 1.18, 1.00, 0.80]
T_zs = [0.80, 0.84, 0.88, 0.91, 0.93, 0.96, 0.99, 1.00, 1.00, 1.01, 1.015, 1.03, 1.05, 1.055, 1.055, 1.04, 0.92, 0.76]
T_zb = [0.33, 0.30, 0.28, 0.26, 0.24, 0.21, 0.205, 0.205, 0.205, 0.205, 0.205, 0.205, 0.21, 0.22, 0.25, 0.29, 0.33, 0.42]
T_ws = [0.84, 0.87, 0.905, 0.93, 0.935, 0.955, 0.96, 0.96, 0.962, 0.962, 0.962, 0.962, 0.955, 0.945, 0.925, 0.89, 0.84, 0.74]
T_wt = [0.70, 0.74, 0.77, 0.79, 0.78, 0.81, 0.82, 0.82, 0.78, 0.735, 0.725, 0.72, 0.705, 0.695, 0.68, 0.64, 0.60, 0.52]
def P(tab, y): return float(np.interp(y, KY, tab))
def section(y):
    zt, zs, zb, ws, wt = P(T_zt, y), P(T_zs, y), P(T_zb, y), P(T_ws, y), P(T_wt, y)
    wb = ws - 0.035
    g = max(zt - zs, 0.02)
    r = min(0.09, g * 0.28)
    pts = [(0.0, zb - 0.01), (wb - 0.12, zb), (wb - 0.03, zb + 0.025), (wb, zb + 0.11), (ws - 0.006, zb + 0.55 * (zs - zb)),
           (ws, zs - 0.10), (ws - 0.012, zs - 0.02), (ws - 0.04, zs + 0.012),
           (ws - 0.04 + (wt - ws + 0.04) * 0.25, zs + 0.012 + (g - 0.012) * 0.3), (wt + (ws - 0.04 - wt) * 0.12, zt - r),
           (wt - r * 0.7, zt - r * 0.25), (wt - 0.22, zt), (0.0, zt + 0.012)]
    return pts
def ring(y, scale=1.0, zc=None, sx=1.0, ysec=None):
    half = section(y if ysec is None else ysec)
    full = half + [(-x, z) for x, z in reversed(half[1:-1])]
    if scale != 1.0:
        zm = zc if zc is not None else sum(z for _, z in full) / len(full)
        full = [(x * scale, zm + (z - zm) * scale) for x, z in full]
    full = [(x * sx, z) for x, z in full]
    return [V((x, y, z)) for x, z in full]
stations = list(np.linspace(-2.40, -2.05, 6)) + list(np.linspace(-1.85, -0.85, 6)) + list(np.linspace(-0.78, 0.10, 6)) + \
    list(np.linspace(0.35, 1.85, 7)) + list(np.linspace(2.0, 2.40, 7))
rings = [ring(-2.445, 0.9, sx=0.45, ysec=-2.40), ring(-2.44, 0.97, sx=0.8, ysec=-2.40)] + [ring(y) for y in stations] + [ring(2.425, 0.97, sx=0.8, ysec=2.40), ring(2.43, 0.9, sx=0.45, ysec=2.40)]
body = H.loft('body', rings, paint, cap0=True, cap1=True)
H.recalc(body)
H.subsurf(body, 2)
body = H.apply_mods(body)
# wheel arches (boolean) -> black liner faces
AXF, AXR, AZ, WR = -1.47, 1.43, 0.378, 0.378
cut_objs = []
for ay in (AXF, AXR):
    for sx in (-1, 1):
        c = H.cyl('arch', 0.435, 0.7, loc=(sx * 0.60 if sx > 0 else -1.30, ay, AZ), rot=(0, PI / 2, 0), seg=64, mat=plastic)
        cut_objs.append(c)
cut = H.join(cut_objs, 'archcut')
bm_ = body.modifiers.new('arch', 'BOOLEAN'); bm_.object = cut; bm_.operation = 'DIFFERENCE'; bm_.solver = 'EXACT'; bm_.material_mode = 'TRANSFER'
body = H.apply_mods(body); bpy.data.objects.remove(cut)
for m in (glass, trim, plastic, chrome, under, grille, head, tail):
    if m.name not in [x.name for x in body.data.materials]: body.data.materials.append(m)
MI = {m.name: i for i, m in enumerate(body.data.materials)}
# ------------------------------------------------------------------ classify faces
YA0, YA1 = -0.80, -0.02      # windscreen span (y)
YB = (-0.02, 0.07)           # B-pillar
YD = 1.92                    # D-pillar starts
for p in body.data.polygons:
    c = p.center; n = p.normal
    if p.material_index == MI['plastic_black_textured']: continue
    y, z, ax = c.y, c.z, abs(c.x)
    zs, zt, zb, ws, wt = P(T_zs, y), P(T_zt, y), P(T_zb, y), P(T_ws, y), P(T_wt, y)
    m = 'paint_graphite_metallic'
    if n.z < -0.6: m = 'underbody'
    elif z < zb + 0.16 and -1.9 < y < 1.9 and n.z < 0.6: m = 'plastic_black_textured'                  # sill cladding
    # glasshouse
    elif z > zs + 0.03 and YA0 < y < 0.12 and ax < wt - 0.02 and (n.z > 0.35 or n.y < -0.3): m = 'glass_tinted'   # windscreen
    elif z > zs + 0.035 and z < zt - 0.045 and abs(n.x) > 0.45 and YA0 + 0.1 < y < YD:
        m = 'trim_black_gloss' if (YB[0] < y < YB[1] or 1.18 < y < 1.26) else 'glass_tinted'
    elif z > zs + 0.035 and z < zt - 0.05 and abs(n.x) > 0.45 and YA0 < y <= YA0 + 0.1: m = 'trim_black_gloss'   # A-pillar base
    elif abs(n.x) > 0.3 and zs - 0.004 < z < zs + 0.035 and YA0 + 0.05 < y < YD + 0.05: m = 'chrome'           # belt trim
    elif y > 2.12 and z > 1.14 and ax < wt - 0.05 and n.y > 0.2: m = 'glass_tinted'                             # rear screen
    elif n.z > 0.85 and ax < 0.52 and 0.12 < y < 1.55 and z > 1.6: m = 'glass_tinted'                           # panoramic roof
    # front
    # rear lights: tall vertical L along the D-pillar + wrap-around
    p.material_index = MI[m]
H.sharpen(body, 70)
# ------------------------------------------------------------------ raycast decals
dg = bpy.context.evaluated_depsgraph_get()
bvh = BVHTree.FromObject(body, dg)
def hit(orig, d):
    loc, nor, idx, dist = bvh.ray_cast(V(orig), V(d).normalized(), 10)
    return (loc, nor) if loc else (None, None)
def strip(name, samples, width, mat, off=0.0012, along_dir=None):
    """Thin quad strip through surface points [(loc, nor)], width across the path."""
    samples = [s for s in samples if s[0] is not None]
    if len(samples) < 2: return None
    vs, fs = [], []
    for i, (lc, nr) in enumerate(samples):
        t = (samples[min(i + 1, len(samples) - 1)][0] - samples[max(i - 1, 0)][0]).normalized()
        sd = t.cross(nr).normalized() * (width / 2)
        base = lc + nr * off
        vs += [tuple(base - sd), tuple(base + sd)]
    for i in range(len(samples) - 1):
        fs.append((2 * i, 2 * i + 1, 2 * i + 3, 2 * i + 2))
    o = H.obj(name, vs, fs, mat); H.recalc(o)
    return o
gap_m = H.pbr('panel_gap', '#050505', 0.9)
for sx in (-1, 1):
    # door shut lines (vertical) and the door bottom line
    for yd in (-0.76, 0.02, 1.16):
        zs = P(T_zs, yd)
        smp = [hit((sx * 1.5, yd + (z - 0.6) * (0.06 if yd > 1 else 0.02), z), (-sx, 0, 0)) for z in np.linspace(0.40, zs + 0.01, 22)]
        strip('gap', smp, 0.004, gap_m)
    smp = [hit((sx * 1.5, y, 0.40), (-sx, 0, 0)) for y in np.linspace(-0.76, 1.16, 30)]
    strip('gap', smp, 0.004, gap_m)
    # hood line along the fender top
    smp = [hit((sx * (P(T_ws, y) - 0.13), y, 2.0), (0, 0, -1)) for y in np.linspace(-2.2, -0.80, 24)]
    strip('gap', smp, 0.004, gap_m)
    # fuel door (right rear)
    if sx > 0:
        pts = [hit((1.5, 1.72 + 0.075 * math.cos(a), 0.86 + 0.065 * math.sin(a)), (-1, 0, 0)) for a in np.linspace(0, 2 * PI, 25)]
        strip('fuel', pts, 0.003, gap_m)
    # door handles (body colour with chrome strip) on front + rear door
    for yh in (-0.28, 0.62):
        lc, nr = hit((sx * 1.5, yh, P(T_zs, yh) - 0.07), (-sx, 0, 0))
        if lc:
            hnd = H.superellipsoid('handle', 0.012, 0.085, 0.014, e=3, n=3, nu=24, nv=8, mat=paint)
            hnd.location = lc + nr * 0.012
            H.box('handle_chrome', 0.004, 0.15, 0.004, loc=tuple(lc + nr * 0.024 + V((0, 0, 0.004))), mat=chrome)
    # tailgate side lines
    smp = [hit((sx * 0.60, 3.0, z), (0, -1, 0)) for z in np.linspace(0.62, 1.5, 20)]
    strip('gap', smp, 0.004, gap_m)
# hood front edge and tailgate bottom
strip('gap', [hit((x, -2.6, 0.83), (0, 1, 0)) for x in np.linspace(-0.7, 0.7, 26)], 0.004, gap_m)
strip('gap', [hit((x, 3.0, 0.62), (0, -1, 0)) for x in np.linspace(-0.6, 0.6, 20)], 0.004, gap_m)
def decal(name, cx, cz, hw, hh, dirv, mat, n=5.0, off=0.003, rings=5, cnt=40, skew=0.0, frame=None):
    """Superellipse panel conformed to the body by raycasting along dirv (0,+-1,0) from outside."""
    ys = -3.0 if dirv[1] > 0 else 3.0
    grid = []
    for k in range(rings + 1):
        sc = k / rings
        rowp = []
        for i in range(cnt):
            t = 2 * PI * i / cnt
            c_, s_ = math.cos(t), math.sin(t)
            x = cx + hw * sc * math.copysign(abs(c_) ** (2 / n), c_)
            z = cz + hh * sc * math.copysign(abs(s_) ** (2 / n), s_) + skew * (x - cx)
            lc, nr = hit((x, ys, z), dirv)
            rowp.append(lc + nr * off if (lc and -nr.dot(V(dirv)) > 0.3) else None)
        grid.append(rowp)
    vs_, fs_ = [], []
    idx = {}
    for k, rowp in enumerate(grid):
        for i, pnt in enumerate(rowp):
            if pnt is not None: idx[(k, i)] = len(vs_); vs_.append(tuple(pnt))
    for k in range(rings):
        for i in range(cnt):
            q = [(k, i), (k, (i + 1) % cnt), (k + 1, (i + 1) % cnt), (k + 1, i)]
            if all(x in idx for x in q): fs_.append(tuple(idx[x] for x in q))
    o = H.obj(name, vs_, fs_, mat); H.recalc(o); H.weld(o, 1e-5)
    H.uv_planar(o, 0.1, axis='Y')
    if frame is not None:
        edge = [pp for pp in grid[-1] if pp is not None]
        if len(edge) > 3:
            H.sweep(name + '_frame', edge, H.circle2d(0.006, 8), frame, closed=True)
    return o
FRONT, REAR = (0, 1, 0), (0, -1, 0)
decal('grille', 0.0, 0.695, 0.35, 0.115, FRONT, grille, n=6, frame=chrome)
decal('lower_intake', 0.0, 0.375, 0.56, 0.055, FRONT, plastic, n=6)
for sx in (-1, 1):
    decal('headlight', sx * 0.64, 0.80, 0.17, 0.05, FRONT, head, n=4, skew=sx * 0.12, frame=trim)
    bar = [hit((sx * x, -3.0, 0.80 + sx * 0.12 * (sx * x - sx * 0.64) * sx), (0, 1, 0)) for x in np.linspace(0.52, 0.76, 12)]
    strip('drl', bar, 0.008, drl, off=0.006)
    st = [hit((sx * 0.53, -3.0, z), (0, 1, 0)) for z in np.linspace(0.765, 0.835, 5)]
    strip('drl', st, 0.008, drl, off=0.006)
    decal('fog', sx * 0.66, 0.42, 0.07, 0.022, FRONT, head, n=4)
    # tail lights: vertical bar along the D-pillar + short horizontal foot
    decal('tail_v', sx * 0.745, 1.18, 0.05, 0.24, REAR, tail, n=4)
    decal('tail_h', sx * 0.64, 0.97, 0.14, 0.035, REAR, tail, n=4)
    decal('reflector', sx * 0.72, 0.47, 0.08, 0.015, REAR, tail, n=4)
decal('diffuser', 0.0, 0.36, 0.78, 0.06, REAR, plastic, n=10, rings=3, cnt=64)
decal('front_lip', 0.0, 0.35, 0.80, 0.045, FRONT, plastic, n=10, rings=3, cnt=64)
# licence plates
for yy, dirv in ((-3.0, 1), (3.0, -1)):
    lc, nr = hit((0, yy, 0.50 if yy < 0 else 0.72), (0, dirv, 0))
    if lc:
        pl = H.box('plate', 0.52, 0.006, 0.112, loc=tuple(lc + nr * 0.004), mat=plate_m, bev=0.002, seg=2)
        pl.rotation_euler = (0, 0, 0)
        H.text('plate_txt', 'HL 2026', 0.075, tuple(lc + nr * 0.0075), rot=(PI / 2, 0, 0 if yy < 0 else PI), mat=plate_t, extrude=0.0004)
# ------------------------------------------------------------------ mirrors + roof rails
for sx in (-1, 1):
    mc = V((sx * 1.02, -0.58, 1.10))
    cap = H.superellipsoid('mirror_cap', 0.11, 0.06, 0.07, e=2.6, n=2.6, nu=32, nv=12, mat=paint)
    cap.location = mc; cap.rotation_euler = (0, 0, sx * 0.12)
    H.box('mirror_glass', 0.012, 0.18, 0.1, loc=(sx * 1.02, -0.52, 1.10), mat=chrome) if False else None
    H.tube('mirror_arm', [V((sx * 0.92, -0.62, 1.04)), V((sx * 0.98, -0.59, 1.08))], 0.022, 12, trim)
    H.box('mirror_ind', 0.1, 0.012, 0.012, loc=(sx * 1.04, -0.64, 1.07), mat=head)
for sx in (-1, 1):
    pts = []
    for y in np.linspace(-0.05, 1.88, 16):
        lc, nr = hit((sx * 0.62, y, 3.0), (0, 0, -1))
        if lc: pts.append(lc + V((0, 0, 0.045)))
    H.sweep('roof_rail', pts, [(p[0], p[1]) for p in H.rrect2d(0.028, 0.035, 0.01, 3)], alloy, caps=True, up=(0, 0, 1))
    for y in (0.02, 0.95, 1.80):
        lc, nr = hit((sx * 0.62, y, 3.0), (0, 0, -1))
        if lc: H.box('rail_foot', 0.03, 0.06, 0.05, loc=tuple(lc + V((0, 0, 0.022))), mat=trim, bev=0.008, seg=2)
# arch cladding (black plastic eyebrows around each wheel arch)
for ay in (AXF, AXR):
    for sx in (-1, 1):
        pts = []
        for a in np.linspace(-0.12, PI + 0.12, 26):
            yy, zz = ay + 0.445 * math.cos(a), AZ + 0.445 * math.sin(a)
            lc, nr = hit((sx * 1.5, yy, zz), (-sx, 0, 0))
            if lc: pts.append(lc + nr * 0.006)
        if len(pts) > 2:
            H.sweep('arch_trim', pts, [(p[0], p[1]) for p in H.rrect2d(0.018, 0.07, 0.007, 2)], plastic, caps=True, up=(sx, 0, 0))
# ------------------------------------------------------------------ wheels
def build_wheel(name):
    parts = []
    prof = [(0.255, -0.105), (0.262, -0.118), (0.30, -0.126), (0.345, -0.127), (0.366, -0.118), (0.376, -0.102),
            (0.378, -0.075), (0.371, -0.072), (0.371, -0.056), (0.378, -0.053), (0.378, -0.02), (0.371, -0.017), (0.371, 0.017),
            (0.378, 0.02), (0.378, 0.053), (0.371, 0.056), (0.371, 0.072), (0.378, 0.075), (0.376, 0.102), (0.366, 0.118),
            (0.345, 0.127), (0.30, 0.126), (0.262, 0.118), (0.255, 0.105)]
    t = H.lathe(name + '_tyre', prof, 52, [tyre, side])
    for p in t.data.polygons:
        if abs(p.normal.z) > 0.5: p.material_index = 1
    H.uv_cyl(t, 0.25)
    parts.append(t)
    # rim barrel + lip
    parts.append(H.lathe(name + '_barrel', [(0.254, 0.108), (0.262, 0.112), (0.262, 0.100), (0.245, 0.09), (0.24, -0.09), (0.25, -0.105), (0.25, -0.112)], 48, alloy))
    # face: closed dish solid, spokes by boolean windows
    face = H.lathe(name + '_face', [(0.06, 0.07), (0.075, 0.108), (0.24, 0.095), (0.252, 0.104), (0.252, 0.075), (0.235, 0.07), (0.075, 0.05), (0.06, 0.05), (0.06, 0.07)], 50, alloy)
    cutters = []
    for k in range(10):
        a0 = 2 * PI * k / 10 + (0.07 if k % 2 else -0.07)
        half = 0.19 if k % 2 == 0 else 0.13
        pts = []
        for tt in np.linspace(-1, 1, 7):
            a = a0 + tt * half; pts.append((0.232 * math.cos(a), 0.232 * math.sin(a)))
        for tt in np.linspace(1, -1, 5):
            a = a0 + tt * half * 0.55; pts.append((0.10 * math.cos(a), 0.10 * math.sin(a)))
        cutters.append(H.extrude_poly('win', pts, -0.1, 0.3, alloy))
    ct = H.join(cutters, 'wincut')
    b = face.modifiers.new('win', 'BOOLEAN'); b.object = ct; b.operation = 'DIFFERENCE'; b.solver = 'EXACT'
    face = H.apply_mods(face); bpy.data.objects.remove(ct)
    H.sharpen(face, 35); H.bevel(face, 0.002, 1, angle=35)
    parts.append(face)
    parts.append(H.lathe(name + '_cap', [(0.0, 0.1), (0.045, 0.098), (0.06, 0.085), (0.06, 0.07)], 40, trim))
    for k in range(5):
        a = 2 * PI * k / 5 + PI / 10
        parts.append(H.cyl('lug', 0.011, 0.012, loc=(0.085 * math.cos(a), 0.085 * math.sin(a), 0.066), seg=6, mat=chrome))
    parts.append(H.lathe(name + '_disc', [(0.08, -0.03), (0.19, -0.03), (0.19, 0.0), (0.08, 0.0)], 32, disc))
    cal = H.box('caliper', 0.12, 0.07, 0.07, loc=(0.0, 0.18, -0.01), mat=caliper, bev=0.015, seg=2)
    parts.append(cal)
    return H.join(parts, name)
wheel = build_wheel('wheel_fr')
wheel.rotation_euler = (0, PI / 2, 0)
wheel.location = (0.82, AXF, AZ)
bpy.context.view_layer.update()
w2 = H.duplicate(wheel, 'wheel_rr', loc=(0.82, AXR, AZ))
w3 = H.mirror_x(wheel, 'wheel_fl')
w4 = H.mirror_x(w2, 'wheel_rl')
H.finish('car_suv', extras={'texres': 1024})
