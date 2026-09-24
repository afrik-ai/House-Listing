# Shared helpers for procedural HouseListing props (Blender 5.2 headless).
# Every prop script does:  import helpers as H; H.reset(); ...build...; H.finish('<name>', max_tex=1024)
# Conventions: Blender Z-up while building (front of the product faces -Y), metres.
# finish() applies modifiers, joins everything into one mesh per variant, puts the origin at the base centre
# (bbox centre XY, min Z = 0 unless floor_ref=True) and exports pipeline/props/_build/<name>.glb (Y-up glTF,
# front -> +Z). pack.mjs then WebP-compresses textures, quantizes geometry and writes public/assets/models/.
import bpy, bmesh, math, os, sys, json
import numpy as np
from mathutils import Vector, Matrix, Euler
from mathutils.bvhtree import BVHTree

ROOT = __import__('os').path.abspath(__import__('os').path.join(__import__('os').path.dirname(__file__), '..', '..'))
BUILD = ROOT + '/pipeline/props/_build'
TEXD = BUILD + '/tex'
os.makedirs(TEXD, exist_ok=True)
PI = math.pi
V = Vector

# ------------------------------------------------------------------ scene
def reset():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    for c in (bpy.data.meshes, bpy.data.materials, bpy.data.images, bpy.data.curves):
        for x in list(c): c.remove(x)

def link(ob):
    bpy.context.scene.collection.objects.link(ob)
    return ob

def obj(name, verts, faces, mat=None, uvs=None, smooth=True, mat_idx=None):
    """verts: list of xyz; faces: list of index tuples; uvs: per-face list of (u,v) tuples (same order)."""
    me = bpy.data.meshes.new(name)
    me.from_pydata([tuple(v) for v in verts], [], [tuple(f) for f in faces])
    if uvs is not None:
        uvl = me.uv_layers.new(name='UVMap')
        k = 0
        for poly, fuv in zip(me.polygons, uvs):
            for li, uv in zip(poly.loop_indices, fuv):
                uvl.data[li].uv = uv
    me.validate(clean_customdata=False)
    ob = link(bpy.data.objects.new(name, me))
    if mat is not None:
        mats = mat if isinstance(mat, (list, tuple)) else [mat]
        for m in mats: me.materials.append(m)
        if mat_idx is not None:
            me.polygons.foreach_set('material_index', mat_idx)
    if smooth: me.shade_smooth()
    return ob

def set_mat(ob, m):
    ob.data.materials.clear(); ob.data.materials.append(m); return ob

def add_mat(ob, m):
    ob.data.materials.append(m); return len(ob.data.materials) - 1

# ------------------------------------------------------------------ primitives
def box(name, sx, sy, sz, loc=(0, 0, 0), mat=None, bev=None, seg=3, rot=None, uv=None):
    """Axis-aligned box of size (sx,sy,sz) with its CENTRE at loc. bev = bevel width (m)."""
    x, y, z = sx / 2, sy / 2, sz / 2
    vs = [(-x, -y, -z), (x, -y, -z), (x, y, -z), (-x, y, -z), (-x, -y, z), (x, -y, z), (x, y, z), (-x, y, z)]
    fs = [(0, 3, 2, 1), (4, 5, 6, 7), (0, 1, 5, 4), (1, 2, 6, 5), (2, 3, 7, 6), (3, 0, 4, 7)]
    ob = obj(name, vs, fs, mat)
    if rot: ob.rotation_euler = rot
    ob.location = loc
    if uv: uv_box(ob, uv)
    if bev: bevel(ob, bev, seg)
    return ob

def box_minmax(name, mn, mx, **kw):
    c = [(a + b) / 2 for a, b in zip(mn, mx)]
    return box(name, mx[0] - mn[0], mx[1] - mn[1], mx[2] - mn[2], loc=c, **kw)

def cyl(name, r, h, loc=(0, 0, 0), seg=32, mat=None, bev=None, bseg=3, rot=None, r2=None, caps=True, uv=None):
    """Cylinder (or cone frustum if r2) standing on its base at loc (base centre)."""
    r2 = r if r2 is None else r2
    vs = []
    for z, rr in ((0, r), (h, r2)):
        for i in range(seg):
            a = 2 * PI * i / seg
            vs.append((rr * math.cos(a), rr * math.sin(a), z))
    fs = [(i, (i + 1) % seg, seg + (i + 1) % seg, seg + i) for i in range(seg)]
    if caps:
        fs.append(tuple(reversed(range(seg))))
        fs.append(tuple(range(seg, 2 * seg)))
    ob = obj(name, vs, fs, mat)
    ob.location = loc
    if rot: ob.rotation_euler = rot
    sharpen(ob, 40)
    if uv: uv_cyl(ob, uv)
    if bev: bevel(ob, bev, bseg)
    return ob

def lathe(name, prof, seg=48, mat=None, loc=(0, 0, 0), rot=None, uvscale=None, arc=2 * PI, close=True, smooth=True, sharp=None):
    """Revolve profile [(r,z),...] around Z. Points with r==0 collapse to poles."""
    vs, fs, uvs = [], [], []
    n = len(prof)
    segs = seg if close else seg + 1
    idx = {}
    for i in range(segs):
        a = arc * i / seg
        for j, (r, z) in enumerate(prof):
            idx[(i, j)] = len(vs)
            vs.append((r * math.cos(a), r * math.sin(a), z))
    L = [0.0]
    for j in range(1, n):
        L.append(L[-1] + math.hypot(prof[j][0] - prof[j - 1][0], prof[j][1] - prof[j - 1][1]))
    us = uvscale or 1.0
    for i in range(seg):
        i2 = (i + 1) % segs if close else i + 1
        for j in range(n - 1):
            f = [idx[(i, j)], idx[(i2, j)], idx[(i2, j + 1)], idx[(i, j + 1)]]
            fs.append(f)
            if uvscale:
                uvs.append([(i / seg * 2 * PI * 0.3 / us, L[j] / us), ((i + 1) / seg * 2 * PI * 0.3 / us, L[j] / us),
                            ((i + 1) / seg * 2 * PI * 0.3 / us, L[j + 1] / us), (i / seg * 2 * PI * 0.3 / us, L[j + 1] / us)])
    ob = obj(name, vs, fs, mat, uvs if uvscale else None, smooth=smooth)
    weld(ob, 1e-6)
    ob.location = loc
    if rot: ob.rotation_euler = rot
    if sharp: sharpen(ob, sharp)
    return ob

def ring_se(a, b, z=0.0, n=4.0, cnt=64, cx=0.0, cy=0.0, start=0.0):
    """Superellipse ring (|x/a|^n + |y/b|^n = 1) at height z."""
    pts = []
    for i in range(cnt):
        t = start + 2 * PI * i / cnt
        c, s = math.cos(t), math.sin(t)
        x = a * math.copysign(abs(c) ** (2 / n), c)
        y = b * math.copysign(abs(s) ** (2 / n), s)
        pts.append(V((cx + x, cy + y, z)))
    return pts

def loft(name, rings, mat=None, cap0=False, cap1=False, closed=True, uvscale=None, smooth=True):
    """Connect rings (lists of Vectors, equal counts) with quads. caps: ngon."""
    vs, fs, uvs = [], [], []
    m = len(rings[0])
    for r in rings: vs.extend([tuple(p) for p in r])
    # arc-length based uv
    for k in range(len(rings) - 1):
        for i in range(m if closed else m - 1):
            i2 = (i + 1) % m
            fs.append((k * m + i, k * m + i2, (k + 1) * m + i2, (k + 1) * m + i))
    if uvscale:
        # per ring cumulative lengths
        rl = []
        for r in rings:
            c = [0.0]
            for i in range(1, m + 1):
                c.append(c[-1] + (r[i % m] - r[i - 1]).length)
            rl.append(c)
        vl = [0.0]
        for k in range(1, len(rings)):
            vl.append(vl[-1] + (sum(rings[k], V()) / m - sum(rings[k - 1], V()) / m).length + 1e-4)
        for k in range(len(rings) - 1):
            for i in range(m if closed else m - 1):
                uvs.append([(rl[k][i] / uvscale, vl[k] / uvscale), (rl[k][i + 1] / uvscale, vl[k] / uvscale),
                            (rl[k + 1][i + 1] / uvscale, vl[k + 1] / uvscale), (rl[k + 1][i] / uvscale, vl[k + 1] / uvscale)])
    nr = len(rings)
    if cap0:
        fs.append(tuple(reversed(range(m))))
        if uvscale: uvs.append([(p.x / uvscale, p.y / uvscale) for p in reversed(rings[0])])
    if cap1:
        fs.append(tuple(range((nr - 1) * m, nr * m)))
        if uvscale: uvs.append([(p.x / uvscale, p.y / uvscale) for p in rings[-1]])
    return obj(name, vs, fs, mat, uvs if uvscale else None, smooth=smooth)

def frames(pts, closed=False, up=None):
    """Parallel-transport frames along a polyline -> list of (T, N, B)."""
    n = len(pts)
    T = []
    for i in range(n):
        if closed:
            t = pts[(i + 1) % n] - pts[i - 1]
        else:
            t = pts[min(i + 1, n - 1)] - pts[max(i - 1, 0)]
        T.append(t.normalized())
    up = V(up) if up else (V((0, 0, 1)) if abs(T[0].z) < 0.9 else V((1, 0, 0)))
    N0 = (up - T[0] * up.dot(T[0])).normalized()
    out = []
    N = N0
    for i in range(n):
        if i > 0:
            N = N - T[i] * N.dot(T[i])
            if N.length < 1e-8: N = out[-1][1]
            N.normalize()
        B = T[i].cross(N)
        out.append((T[i], N, B))
    return out

def sweep(name, path, prof, mat=None, closed=False, caps=True, scale=None, uvscale=None, up=None, smooth=True, twist=0.0):
    """Sweep a 2D profile [(x,y)] (closed loop, in the N/B plane) along 3D path points."""
    path = [V(p) for p in path]
    fr = frames(path, closed, up)
    rings = []
    for i, (p, (T, N, B)) in enumerate(zip(path, fr)):
        s = scale[i] if scale else 1.0
        a = twist * i / max(1, len(path) - 1)
        ca, sa = math.cos(a), math.sin(a)
        ring = []
        for (x, y) in prof:
            xx, yy = x * ca - y * sa, x * sa + y * ca
            ring.append(p + N * (xx * s) + B * (yy * s))
        rings.append(ring)
    if closed: rings.append(rings[0])
    ob = loft(name, rings, mat, cap0=caps and not closed, cap1=caps and not closed, uvscale=uvscale, smooth=smooth)
    if closed: weld(ob, 1e-6)
    return ob

def circle2d(r, n=12, rx=None):
    rx = r if rx is None else rx
    return [(rx * math.cos(2 * PI * i / n), r * math.sin(2 * PI * i / n)) for i in range(n)]

def rrect2d(w, h, r, n=4):
    """Rounded rectangle profile centred at 0 (w,h full sizes), n segments per corner."""
    pts = []
    cs = [(w / 2 - r, h / 2 - r, 0), (-w / 2 + r, h / 2 - r, PI / 2), (-w / 2 + r, -h / 2 + r, PI), (w / 2 - r, -h / 2 + r, 1.5 * PI)]
    for cx, cy, a0 in cs:
        for i in range(n + 1):
            a = a0 + (PI / 2) * i / n
            pts.append((cx + r * math.cos(a), cy + r * math.sin(a)))
    return pts

def tube(name, path, r, sides=12, mat=None, closed=False, caps=True, uvscale=None, up=None, scale=None):
    return sweep(name, path, circle2d(r, sides), mat, closed, caps, scale=scale, uvscale=uvscale, up=up)

def arc_pts(center, radius, a0, a1, n, plane='XZ'):
    c = V(center); out = []
    for i in range(n + 1):
        a = a0 + (a1 - a0) * i / n
        if plane == 'XZ': out.append(c + V((radius * math.cos(a), 0, radius * math.sin(a))))
        elif plane == 'YZ': out.append(c + V((0, radius * math.cos(a), radius * math.sin(a))))
        else: out.append(c + V((radius * math.cos(a), radius * math.sin(a), 0)))
    return out

def bezier_pts(p0, p1, p2, p3, n=24):
    p0, p1, p2, p3 = map(V, (p0, p1, p2, p3))
    out = []
    for i in range(n + 1):
        t = i / n; u = 1 - t
        out.append(p0 * u ** 3 + p1 * 3 * u * u * t + p2 * 3 * u * t * t + p3 * t ** 3)
    return out

def extrude_poly(name, pts2d, z0, z1, mat=None, plane='XY'):
    """Prism from a 2D polygon (CCW) between z0 and z1. plane XY (extrude Z), XZ (extrude Y), YZ (extrude X)."""
    n = len(pts2d)
    def m(a, b, h):
        if plane == 'XY': return (a, b, h)
        if plane == 'XZ': return (a, h, b)
        return (h, a, b)
    vs = [m(x, y, z0) for x, y in pts2d] + [m(x, y, z1) for x, y in pts2d]
    fs = [tuple(reversed(range(n))), tuple(range(n, 2 * n))]
    for i in range(n):
        fs.append((i, (i + 1) % n, n + (i + 1) % n, n + i))
    ob = obj(name, vs, fs, mat)
    if plane == 'XZ':  # m() swaps handedness -> flip
        ob.data.flip_normals()
    ob.data.normals_split_custom_set(None) if False else None
    recalc(ob)
    sharpen(ob, 40)
    return ob

def text(name, body, size, loc, rot=(PI / 2, 0, 0), mat=None, extrude=0.0005, align='CENTER'):
    cu = bpy.data.curves.new(name, 'FONT'); cu.body = body; cu.size = size; cu.extrude = extrude
    cu.align_x = align; cu.align_y = 'CENTER'
    ob = link(bpy.data.objects.new(name, cu)); ob.location = loc; ob.rotation_euler = rot
    if mat: cu.materials.append(mat)
    return ob

# ------------------------------------------------------------------ mesh ops
def bm_edit(ob, fn):
    bm = bmesh.new(); bm.from_mesh(ob.data)
    fn(bm)
    bm.to_mesh(ob.data); bm.free(); ob.data.update()

def weld(ob, dist=1e-5):
    bm_edit(ob, lambda bm: bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=dist))

def recalc(ob):
    bm_edit(ob, lambda bm: bmesh.ops.recalc_face_normals(bm, faces=bm.faces))

def sharpen(ob, angle=35):
    """Mark edges sharper than angle (deg) as sharp (split normals), keep faces smooth."""
    lim = math.radians(angle)
    def f(bm):
        for e in bm.edges:
            if len(e.link_faces) == 2:
                if e.calc_face_angle(0) > lim: e.smooth = False
            else:
                e.smooth = True
    bm_edit(ob, f)
    ob.data.shade_smooth() if False else None
    for p in ob.data.polygons: p.use_smooth = True

def bevel(ob, w, seg=3, angle=35, harden=True, limit='ANGLE', profile=0.5, clamp=True):
    m = ob.modifiers.new('bevel', 'BEVEL')
    m.width = w; m.segments = seg; m.limit_method = limit
    if limit == 'ANGLE': m.angle_limit = math.radians(angle)
    m.harden_normals = harden; m.use_clamp_overlap = clamp; m.profile = profile
    m.miter_outer = 'MITER_ARC'
    return m

def subsurf(ob, lv=2, crease=None):
    m = ob.modifiers.new('subsurf', 'SUBSURF'); m.levels = lv; m.render_levels = lv
    m.quality = 3
    return m

def solidify(ob, t, offset=-1.0, even=True, rim=True):
    m = ob.modifiers.new('solidify', 'SOLIDIFY'); m.thickness = t; m.offset = offset
    m.use_even_offset = even; m.use_rim = rim; m.use_quality_normals = True
    return m

def wnormal(ob, weight=50):
    m = ob.modifiers.new('wn', 'WEIGHTED_NORMAL'); m.keep_sharp = True; m.weight = weight; m.mode = 'FACE_AREA'
    return m

def displace_fn(ob, fn):
    """Move every vertex: co = fn(co) (world == local assumed before transforms)."""
    me = ob.data
    for v in me.vertices:
        v.co = fn(v.co.copy())
    me.update()

def apply_mods(ob):
    dg = bpy.context.evaluated_depsgraph_get()
    ev = ob.evaluated_get(dg)
    me = bpy.data.meshes.new_from_object(ev, preserve_all_data_layers=True, depsgraph=dg)
    if ob.type != 'MESH':
        nob = link(bpy.data.objects.new(ob.name + '_m', me))
        nob.matrix_world = ob.matrix_world.copy()
        bpy.data.objects.remove(ob)
        return nob
    old = ob.data
    ob.modifiers.clear()
    ob.data = me
    if old.users == 0: bpy.data.meshes.remove(old)
    return ob

def apply_xform(ob):
    """Bake loc/rot/scale into mesh (uses join into identity object to keep custom normals)."""
    return ob

def duplicate(ob, name=None, loc=None, rot=None, scale=None, linked=False):
    n = ob.copy()
    if not linked: n.data = ob.data.copy()
    n.name = name or ob.name + '_d'
    link(n)
    if loc is not None: n.location = loc
    if rot is not None: n.rotation_euler = rot
    if scale is not None: n.scale = scale
    return n

def mirror_x(ob, name=None):
    """Duplicate mirrored across world X=0 (no negative scale: mesh is mirrored + normals flipped)."""
    n = duplicate(ob, name)
    n.data.transform(Matrix.Scale(-1, 4, (1, 0, 0)))
    n.data.flip_normals()
    n.location.x = -ob.location.x
    n.rotation_euler = (ob.rotation_euler.x, -ob.rotation_euler.y, -ob.rotation_euler.z)
    return n

def join(objs, name):
    """Apply modifiers + transforms and join into a single object at identity."""
    objs = [apply_mods(o) for o in objs]
    for o in objs:
        if not o.data.uv_layers: o.data.uv_layers.new(name='UVMap')
    base = link(bpy.data.objects.new(name, bpy.data.meshes.new(name)))
    for o in objs:
        if o.data.materials and o.data.materials[0]:
            base.data.materials.append(o.data.materials[0]); break
    with bpy.context.temp_override(active_object=base, selected_editable_objects=objs + [base], selected_objects=objs + [base]):
        bpy.ops.object.join()
    # negative scales flip winding; join handles it.
    return base

def tris_of(ob):
    me = ob.data
    me.calc_loop_triangles()
    return len(me.loop_triangles)

# ------------------------------------------------------------------ UV projection
def uv_box(ob, scale=1.0, name='UVMap', offset=(0, 0), along=None):
    """Box-project UVs in local coords (scale = metres per UV unit).
    along='x'|'y'|'z': the local axis that u follows on every face where it lies in-plane (wood grain / brushing)."""
    me = ob.data
    uvl = me.uv_layers.get(name) or me.uv_layers.new(name=name)
    sx, sy, sz = ob.scale
    AX = {'x': 0, 'y': 1, 'z': 2}
    for p in me.polygons:
        n = p.normal
        ax = max(range(3), key=lambda i: abs(n[i]))
        inplane = [i for i in range(3) if i != ax]
        if along is not None and AX[along] in inplane:
            ua = AX[along]; va = [i for i in inplane if i != ua][0]
        else:
            ua, va = inplane
        for li in p.loop_indices:
            co = me.vertices[me.loops[li].vertex_index].co
            co = (co.x * sx, co.y * sy, co.z * sz)
            uvl.data[li].uv = (co[ua] / scale + offset[0], co[va] / scale + offset[1])
    return uvl

def uv_planar(ob, scale=1.0, axis='Z', name='UVMap', origin=(0, 0), size=None):
    """Planar projection. If size=(w,h) maps that rectangle (centred on origin) to 0..1."""
    me = ob.data
    uvl = me.uv_layers.get(name) or me.uv_layers.new(name=name)
    for li, l in enumerate(me.loops):
        co = me.vertices[l.vertex_index].co
        if axis == 'Z': a, b = co.x, co.y
        elif axis == 'Y': a, b = co.x, co.z
        else: a, b = co.y, co.z
        if size: uvl.data[li].uv = ((a - origin[0]) / size[0] + 0.5, (b - origin[1]) / size[1] + 0.5)
        else: uvl.data[li].uv = (a / scale, b / scale)
    return uvl

def uv_cyl(ob, scale=1.0, name='UVMap'):
    me = ob.data
    uvl = me.uv_layers.get(name) or me.uv_layers.new(name=name)
    for p in me.polygons:
        cs = [me.vertices[me.loops[li].vertex_index].co for li in p.loop_indices]
        cen = sum(cs, V()) / len(cs)
        if abs(p.normal.z) > 0.7:
            for li in p.loop_indices:
                co = me.vertices[me.loops[li].vertex_index].co
                uvl.data[li].uv = (co.x / scale, co.y / scale)
            continue
        ac = math.atan2(cen.y, cen.x)
        for li in p.loop_indices:
            co = me.vertices[me.loops[li].vertex_index].co
            a = math.atan2(co.y, co.x)
            if a - ac > PI: a -= 2 * PI
            if ac - a > PI: a += 2 * PI
            r = math.hypot(co.x, co.y)
            uvl.data[li].uv = (a * max(r, 0.01) / scale, co.z / scale)
    return uvl

# ------------------------------------------------------------------ colours / materials
def srgb2lin(c):
    return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4

def hexc(h, lin=True):
    h = h.lstrip('#')
    c = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    return tuple(srgb2lin(x) for x in c) if lin else tuple(c)

def pbr(name, color='#808080', rough=0.5, metal=0.0, base_tex=None, normal_tex=None, rough_tex=None, nstr=1.0,
        alpha=1.0, alpha_tex=False, emit=None, emit_str=1.0, coat=0.0, coat_rough=0.05, transmission=0.0,
        ior=1.5, sheen=0.0, spec=0.5, cull=True, uv_normal=None, uv_base=None, tint_tex=False, blend=None, emit_tex=None):
    """Principled material. color hex (sRGB). *_tex are bpy images. uv_* = UV map name for that texture."""
    m = bpy.data.materials.new(name)
    try: m.use_nodes = True
    except Exception: pass
    nt = m.node_tree
    bs = nt.nodes.get('Principled BSDF') or nt.nodes.new('ShaderNodeBsdfPrincipled')
    out = nt.nodes.get('Material Output') or nt.nodes.new('ShaderNodeOutputMaterial')
    if not bs.outputs['BSDF'].is_linked: nt.links.new(bs.outputs['BSDF'], out.inputs['Surface'])
    col = hexc(color) if isinstance(color, str) else color
    bs.inputs['Base Color'].default_value = (*col, 1)
    bs.inputs['Roughness'].default_value = rough
    bs.inputs['Metallic'].default_value = metal
    bs.inputs['IOR'].default_value = ior
    def uvnode(img_node, uvname):
        uvname = uvname or 'UVMap'
        if uvname:
            u = nt.nodes.new('ShaderNodeUVMap'); u.uv_map = uvname
            nt.links.new(u.outputs['UV'], img_node.inputs['Vector'])
    if base_tex is not None:
        t = nt.nodes.new('ShaderNodeTexImage'); t.image = base_tex; uvnode(t, uv_base)
        nt.links.new(t.outputs['Color'], bs.inputs['Base Color'])
        if alpha_tex:
            nt.links.new(t.outputs['Alpha'], bs.inputs['Alpha'])
    if rough_tex is not None:
        t = nt.nodes.new('ShaderNodeTexImage'); t.image = rough_tex; t.image.colorspace_settings.name = 'Non-Color'
        uvnode(t, uv_normal)
        sep = nt.nodes.new('ShaderNodeSeparateColor')
        nt.links.new(t.outputs['Color'], sep.inputs['Color'])
        nt.links.new(sep.outputs['Green'], bs.inputs['Roughness'])
        # glTF: roughness in G, metallic in B of the same image
        nt.links.new(sep.outputs['Blue'], bs.inputs['Metallic'])
    if normal_tex is not None:
        t = nt.nodes.new('ShaderNodeTexImage'); t.image = normal_tex; t.image.colorspace_settings.name = 'Non-Color'
        uvnode(t, uv_normal)
        nm = nt.nodes.new('ShaderNodeNormalMap'); nm.inputs['Strength'].default_value = nstr
        nm.uv_map = uv_normal or 'UVMap'
        nt.links.new(t.outputs['Color'], nm.inputs['Color'])
        nt.links.new(nm.outputs['Normal'], bs.inputs['Normal'])
        if coat > 0: nt.links.new(nm.outputs['Normal'], bs.inputs['Coat Normal']) if False else None
    if alpha < 1 and not alpha_tex:
        bs.inputs['Alpha'].default_value = alpha
    if emit is not None:
        bs.inputs['Emission Color'].default_value = (*hexc(emit), 1)
        bs.inputs['Emission Strength'].default_value = emit_str
    if emit_tex is not None:
        t = nt.nodes.new('ShaderNodeTexImage'); t.image = emit_tex
        nt.links.new(t.outputs['Color'], bs.inputs['Emission Color'])
        bs.inputs['Emission Strength'].default_value = emit_str
    if coat > 0:
        bs.inputs['Coat Weight'].default_value = coat
        bs.inputs['Coat Roughness'].default_value = coat_rough
    if transmission > 0:
        bs.inputs['Transmission Weight'].default_value = transmission
    if sheen > 0:
        bs.inputs['Sheen Weight'].default_value = sheen
    bs.inputs['Specular IOR Level'].default_value = spec
    m.use_backface_culling = cull
    if alpha < 1 or alpha_tex or blend:
        try: m.surface_render_method = 'BLENDED' if (blend or 'BLEND') == 'BLEND' else 'DITHERED'
        except Exception: pass
    m['hl_alpha'] = blend or ('BLEND' if alpha < 1 else ('MASK' if alpha_tex else 'OPAQUE'))
    return m

# ------------------------------------------------------------------ procedural textures (numpy, tileable)
# Arrays are float32 [H, W, C] with row 0 = v 0 (bottom), values 0..1 (colour stored sRGB-encoded).
RNG = np.random.default_rng(7)

def fnoise(n, su, sv=None, seed=0, m=None):
    """Tileable gaussian-filtered noise. su/sv = feature size in pixels along u (cols) / v (rows). Normalised std 1."""
    m = m or n
    sv = su if sv is None else sv
    rng = np.random.default_rng(seed)
    w = rng.standard_normal((m, n)).astype(np.float32)
    F = np.fft.rfft2(w)
    fy = np.fft.fftfreq(m)[:, None]
    fx = np.fft.rfftfreq(n)[None, :]
    g = np.exp(-2 * (PI ** 2) * ((fx * su) ** 2 + (fy * sv) ** 2))
    out = np.fft.irfft2(F * g, s=(m, n)).astype(np.float32)
    out -= out.mean(); out /= (out.std() + 1e-8)
    return out

def fbm(n, base, octaves=4, seed=0, gain=0.5, aniso=1.0):
    acc = np.zeros((n, n), np.float32); amp = 1.0; tot = 0
    for o in range(octaves):
        s = base / (2 ** o)
        acc += amp * fnoise(n, s * aniso, s, seed + o); tot += amp; amp *= gain
    return acc / tot

def h2n(h, strength=1.0):
    """Height (in pixel units * strength) -> OpenGL tangent-space normal map RGB 0..1 (tileable)."""
    dx = (np.roll(h, -1, 1) - np.roll(h, 1, 1)) * 0.5 * strength
    dy = (np.roll(h, -1, 0) - np.roll(h, 1, 0)) * 0.5 * strength
    nz = np.ones_like(h)
    l = np.sqrt(dx * dx + dy * dy + 1)
    return np.stack([(-dx / l) * 0.5 + 0.5, (-dy / l) * 0.5 + 0.5, (nz / l) * 0.5 + 0.5], -1).astype(np.float32)

def lerp(a, b, t):
    return a + (b - a) * t

def colmix(t, c0, c1):
    """t [H,W] -> colour between hex c0, c1 (sRGB space)."""
    a = np.array(hexc(c0, False), np.float32); b = np.array(hexc(c1, False), np.float32)
    return a[None, None, :] * (1 - t[..., None]) + b[None, None, :] * t[..., None]

def ramp(t, stops):
    """stops: [(pos, hex), ...] -> sRGB colour array."""
    t = np.clip(t, 0, 1)
    ps = np.array([s[0] for s in stops], np.float32)
    cs = np.array([hexc(s[1], False) for s in stops], np.float32)
    out = np.zeros(t.shape + (3,), np.float32)
    for c in range(3):
        out[..., c] = np.interp(t, ps, cs[:, c])
    return out

def save_img(arr, name, noncolor=False):
    """arr [H,W,3|4] 0..1 -> PNG in _build/tex, returns bpy image (packed-less, file-backed)."""
    arr = np.clip(arr, 0, 1).astype(np.float32)
    if arr.ndim == 2: arr = np.stack([arr] * 3, -1)
    h, w, c = arr.shape
    if c == 3: arr = np.concatenate([arr, np.ones((h, w, 1), np.float32)], -1)
    img = bpy.data.images.new(name, w, h, alpha=True)
    img.pixels.foreach_set(arr.ravel())
    path = f'{TEXD}/{name}.png'
    img.filepath_raw = path; img.file_format = 'PNG'
    img.save()
    if noncolor: img.colorspace_settings.name = 'Non-Color'
    return img

def orm(rough, metal=None):
    """Pack roughness (G) and metallic (B) arrays into a glTF metallicRoughness image array."""
    h, w = rough.shape
    mt = np.zeros_like(rough) if metal is None else metal
    return np.stack([np.ones_like(rough), rough, mt], -1)

# ---- specific texture recipes
def tex_weave(n=1024, threads=48, seed=1, depth=1.0, fuzz=0.25, twill=False):
    """Plain (or 2/1 twill) weave height field, tileable. threads = threads per tile per axis."""
    y, x = np.mgrid[0:n, 0:n].astype(np.float32) / n
    tu, tv = x * threads, y * threads
    iu, iv = np.floor(tu), np.floor(tv)
    fu, fv = tu - iu, tv - iv
    pu = np.sin(PI * fu) ** 0.7  # profile across a warp thread (cols)
    pv = np.sin(PI * fv) ** 0.7
    if twill:
        over = ((iu + iv) % 3) < 1
    else:
        over = ((iu + iv) % 2) < 1
    # warp (vertical threads) on top where over; bulge along its length
    along_w = np.sin(PI * fv) ** 0.5
    along_f = np.sin(PI * fu) ** 0.5
    h = np.where(over, pu * (0.6 + 0.4 * along_w), pv * (0.6 + 0.4 * along_f))
    rnd = fnoise(n, 1.2, 6, seed) * 0.12 + fnoise(n, 6, 1.2, seed + 1) * 0.12
    h = h + rnd * fuzz + fnoise(n, 0.8, 0.8, seed + 2) * fuzz * 0.25
    return h * depth

def tex_brushed(n=1024, seed=3, along='u'):
    a = fnoise(n, 60, 0.6, seed) if along == 'u' else fnoise(n, 0.6, 60, seed)
    b = fnoise(n, 200, 1.5, seed + 1) if along == 'u' else fnoise(n, 1.5, 200, seed + 1)
    return a * 0.7 + b * 0.3

def tex_wood(n=1024, seed=5, light='#b98a5a', dark='#7a5230', mid='#9c6d42', rings=26, grain_len=400, plank=None, warp=0.035,
             contrast=0.55, pores=0.5):
    """Straight-grain wood running along u (tileable). Returns (colour sRGB, height ~[-1,1])."""
    y, x = np.mgrid[0:n, 0:n].astype(np.float32) / n
    w = fnoise(n, 260, 40, seed) * warp + fnoise(n, 90, 14, seed + 1) * warp * 0.25
    t = (y + w) * rings
    ph = t % 1.0
    late = np.clip((ph - 0.62) / 0.18, 0, 1) * np.clip((1.0 - ph) / 0.2, 0, 1)   # latewood band
    late = late ** 0.8
    fib = fnoise(n, 90, 0.7, seed + 3)                      # long fine fibre streaks
    fib2 = fnoise(n, 30, 1.5, seed + 6)
    pr = np.clip(fnoise(n, 14, 0.55, seed + 4) - 1.6, 0, None)  # elongated pores/flecks
    tone = fnoise(n, 500, 120, seed + 5)
    tt = np.clip(0.28 + late * contrast + fib * 0.05 + fib2 * 0.04 + tone * 0.06, 0, 1)
    col = ramp(tt, [(0, light), (0.5, mid), (1, dark)])
    col *= (1 - np.clip(pr, 0, 1)[..., None] * 0.25 * pores)
    h = late * 0.35 + fib * 0.06 + fib2 * 0.05 - np.clip(pr, 0, 1) * 0.8 * pores
    return col.astype(np.float32), h.astype(np.float32)

def tex_terry(n=512, seed=9):
    h = np.zeros((n, n), np.float32)
    h += fnoise(n, 1.3, 1.3, seed) * 0.8
    h += fnoise(n, 3, 3, seed + 1) * 0.5
    h += fnoise(n, 25, 25, seed + 2) * 0.15
    return h

# ------------------------------------------------------------------ finish / export
def bbox_world(objs):
    dg = bpy.context.evaluated_depsgraph_get()
    mn = V((1e9, 1e9, 1e9)); mx = V((-1e9, -1e9, -1e9))
    for o in objs:
        if o.type not in ('MESH', 'CURVE', 'FONT'): continue
        ev = o.evaluated_get(dg)
        me = ev.to_mesh()
        mw = o.matrix_world
        for v in me.vertices:
            w = mw @ v.co
            for i in range(3):
                mn[i] = min(mn[i], w[i]); mx[i] = max(mx[i], w[i])
        ev.to_mesh_clear()
    return mn, mx

def finish(name, variants=None, floor_ref=False, center_xy=True, extras=None):
    """Join all scene meshes (or per-variant lists) into single objects, set origin at base centre, export GLB.
    variants: dict {variant_name: [objs]} -> separate top-level nodes (each centred at origin)."""
    sc = bpy.context.scene
    groups = variants or {name: [o for o in sc.objects if o.type in ('MESH', 'CURVE', 'FONT')]}
    outs = []
    stats = {}
    for vname, objs in groups.items():
        j = join(objs, vname)
        me = j.data
        mn, mx = bbox_world([j])
        off = V((-(mn.x + mx.x) / 2 if center_xy else 0, -(mn.y + mx.y) / 2 if center_xy else 0, 0 if floor_ref else -mn.z))
        me.transform(Matrix.Translation(off))
        me.update()
        # drop unused material slots
        used = set(p.material_index for p in me.polygons)
        stats[vname] = {'tris': tris_of(j), 'dims': [round(mx.x - mn.x, 3), round(mx.z - mn.z, 3), round(mx.y - mn.y, 3)],
                        'minz': round(mn.z + off.z, 3), 'mats': [m.name if m else None for m in me.materials]}
        outs.append(j)
    for o in list(sc.objects):
        if o not in outs: bpy.data.objects.remove(o)
    # store alpha hints for pack.mjs
    alpha = {m.name: m.get('hl_alpha', 'OPAQUE') for m in bpy.data.materials if m.users}
    path = f'{BUILD}/{name}.glb'
    bpy.ops.export_scene.gltf(filepath=path, export_format='GLB', use_selection=False, export_apply=True,
                              export_yup=True, export_image_format='AUTO', export_texcoords=True, export_normals=True,
                              export_materials='EXPORT', export_cameras=False, export_lights=False,
                              export_animations=False, export_extras=False, export_tangents=False)
    meta = {'name': name, 'variants': list(groups.keys()) if variants else None, 'alpha': alpha, 'stats': stats,
            'floor_ref': floor_ref}
    if extras: meta.update(extras)
    json.dump(meta, open(f'{BUILD}/{name}.json', 'w'), indent=1)
    print('BUILT', name, json.dumps(stats))
    return outs

def mat_img_count():
    return len([i for i in bpy.data.images if i.users])

# ------------------------------------------------------------------ shared prop builders
_CACHE = {}
def terry_mats(prefix, color, border_color=None, seed=9):
    """Terry-cloth towel materials (loop-pile normal 512 px repeating every 8 cm)."""
    N = 512
    if 'terry' not in _CACHE:
        _CACHE['terry'] = save_img(h2n(tex_terry(N, seed), 2.2), 'terry_n', True)
        _CACHE['dobby'] = save_img(h2n(tex_weave(N, 64, seed + 3, 1.0, 0.1), 1.2), 'dobby_n', True)
    nimg, bimg = _CACHE['terry'], _CACHE['dobby']
    t = pbr(f'{prefix}_terry', color, 0.95, normal_tex=nimg, nstr=1.0)
    b = pbr(f'{prefix}_border', border_color or color, 0.8, normal_tex=bimg, nstr=0.8)
    return t, b

def folded_towel(name, w, l, layers, t, mats, seed=0, loc=(0, 0, 0), rotz=0.0, xres=14, bulge=0.004):
    """Serpentine folded towel: 'layers' plies of thickness ~t, footprint w (X) x l (Y), sitting on z=loc.z.
    mats = (terry, border). Returns object."""
    rng = np.random.default_rng(seed)
    r = t / 2
    pts = []  # (y, z, s)
    nstraight = 10
    for k in range(layers):
        z = r + k * t
        ys = np.linspace(-l / 2 + r, l / 2 - r, nstraight)
        if k % 2: ys = ys[::-1]
        for yv in ys: pts.append((yv, z))
        if k < layers - 1:
            end = l / 2 - r if k % 2 == 0 else -l / 2 + r
            sgn = 1 if k % 2 == 0 else -1
            for i in range(1, 10):
                a = -PI / 2 + PI * i / 10
                pts.append((end + sgn * r * math.cos(a), z + r + r * math.sin(a)))
    # arc length
    S = [0.0]
    for i in range(1, len(pts)):
        S.append(S[-1] + math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]))
    Ltot = S[-1]
    xs = np.linspace(-w / 2, w / 2, xres)
    vs, fs, uvs, mi = [], [], [], []
    nz = fnoise(64, 6, 6, seed)
    for i, (yv, zv) in enumerate(pts):
        for j, xv in enumerate(xs):
            fx = 1 - (2 * xv / w) ** 2
            fy = 1 - (2 * yv / l) ** 2
            zb = zv + bulge * (zv / (layers * t)) * max(fx, 0) ** 0.6 * max(fy, 0) ** 0.6 * 1.5
            n = nz[int(i * 63 / len(pts)), int(j * 63 / xres)] * 0.0012
            sag = 0.002 * (1 - fx) * (zv / (layers * t))  # edges droop a little
            vs.append((xv + n * 0.5, yv, zb + n - sag))
    for i in range(len(pts) - 1):
        for j in range(xres - 1):
            a = i * xres + j
            fs.append((a, a + 1, a + xres + 1, a + xres))
            uvs.append([(xs[j] / 0.08, S[i] / 0.08), (xs[j + 1] / 0.08, S[i] / 0.08), (xs[j + 1] / 0.08, S[i + 1] / 0.08), (xs[j] / 0.08, S[i + 1] / 0.08)])
            s = (S[i] + S[i + 1]) / 2
            mi.append(1 if (0.035 < s < 0.07 or 0.035 < Ltot - s < 0.07) else 0)
    ob = obj(name, vs, fs, list(mats), uvs, mat_idx=mi)
    solidify(ob, t * 0.82, offset=0.0)
    ob = apply_mods(ob)
    uv_box(ob, 0.08)
    ob.location = loc; ob.rotation_euler = (0, 0, rotz)
    return ob

def pile_normal(name='pile_n', N=512, seed=41):
    """Low loop-pile wool normal map (tiles every ~8 cm)."""
    if name in _CACHE: return _CACHE[name]
    y, x = np.mgrid[0:N, 0:N].astype(np.float32) / N
    rows = 0.5 + 0.5 * np.sin(2 * PI * (y * 64 + fnoise(N, 40, 40, seed) * 0.15))
    loops = 0.5 + 0.5 * np.sin(2 * PI * (x * 64 + (np.floor(y * 64) % 2) * 0.5))
    h = rows * loops * 0.6 + fnoise(N, 1.2, 1.2, seed + 1) * 0.35 + fnoise(N, 3, 3, seed + 2) * 0.25
    _CACHE[name] = save_img(h2n(h, 1.6), name, True)
    return _CACHE[name]

def rug_mat(name, color_img, N_img, nstr=1.0):
    """Rug material: colour on UVMap (whole rug 0..1), pile normal on 'UVPile' (tiling)."""
    return pbr(name, '#ffffff', 0.92, base_tex=color_img, normal_tex=N_img, nstr=nstr, uv_normal='UVPile', uv_base='UVMap')

def superellipsoid(name, a, b, c, e=6.0, n=4.0, nu=64, nv=20, mat=None, loc=(0, 0, 0), zfn=None, bottom_flat=False):
    """Superellipsoid: plan exponent e (xy squareness), profile exponent n (z). a,b,c = half sizes.
    zfn(x, y, z) -> z  optional deformation. Poles at top/bottom centre."""
    def sp(v, p):
        return math.copysign(abs(v) ** (2 / p), v)
    vs, fs = [], []
    vs.append((0, 0, -c))
    for j in range(1, nv):
        t = -PI / 2 + PI * j / nv
        cz, sz = math.cos(t), math.sin(t)
        for i in range(nu):
            u = 2 * PI * i / nu
            x = a * sp(cz, n) * sp(math.cos(u), e)
            y = b * sp(cz, n) * sp(math.sin(u), e)
            z = c * sp(sz, n)
            if zfn: z = zfn(x, y, z)
            vs.append((x, y, z))
    vs.append((0, 0, zfn(0, 0, c) if zfn else c))
    top = len(vs) - 1
    for i in range(nu):
        fs.append((0, 1 + (i + 1) % nu, 1 + i))
    for j in range(nv - 2):
        for i in range(nu):
            a0 = 1 + j * nu + i; a1 = 1 + j * nu + (i + 1) % nu
            fs.append((a0, a1, a1 + nu, a0 + nu))
    base = 1 + (nv - 2) * nu
    for i in range(nu):
        fs.append((base + i, base + (i + 1) % nu, top))
    ob = obj(name, vs, fs, mat)
    ob.location = loc
    return ob

def xform_about(objs, pivot, rot_euler):
    """Rotate objects (their world matrices) about a pivot point."""
    M = Matrix.Translation(V(pivot)) @ Euler(rot_euler).to_matrix().to_4x4() @ Matrix.Translation(-V(pivot))
    bpy.context.view_layer.update()
    for o in objs:
        o.matrix_world = M @ o.matrix_world

def fabric_normal(name='weave_n', N=1024, threads=96, seed=1, strength=1.2, twill=False):
    if name in _CACHE: return _CACHE[name]
    _CACHE[name] = save_img(h2n(tex_weave(N, threads, seed, 1.0, 0.3, twill), strength), name, True)
    return _CACHE[name]
