"""
HouseListing - house shell builder (P02).

    blender.exe -b --factory-startup --python pipeline/blender/build_house.py -- <house-id> [--blend]

Reads houses/<id>/house.json and writes
    public/assets/houses/<id>/house.glb        (Y-up, extras, no textures)
    public/assets/houses/<id>/house.meta.json  (rooms, doors, lights, spawn, bounds)

Coordinates in this script are HOUSE coordinates: X east, Y up, Z south (== three.js / glTF).
They are converted to Blender (X, -Z, Y) only when a mesh/object is created, so the
glTF exporter's Y-up conversion gives back exactly the house coordinates.

Architecture:
  * structure (foundations, walls, slabs, parapets, pergola, platform, steps) is a single
    3D "voxel" solid on a NON-uniform grid made from every box edge.  Walls come from a
    wall graph built on the room rects (shared edges -> one wall, no doubles), boxes are
    unioned, openings/voids carved, and only boundary faces are emitted (greedy merged into
    rectangles).  Result: real thickness, no internal faces, no coplanar duplicates.
  * every boundary face is classified by the empty cell it faces -> floor (SURF_<mat>_<room>),
    ceiling (CEIL_<room>), interior wall (WALL_<room>) or exterior (EXT_<material>).
  * everything else (frames, glass, doors, stair, roofs, balustrades, slats, panels, skirting)
    is explicit geometry laid on top of those faces with its back faces omitted.
"""
import bpy, bmesh, json, math, os, sys, time
import numpy as np

T0 = time.time()
HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..', '..'))
ARGV = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
HOUSE_ID = next((a for a in ARGV if not a.startswith('--')), 'villa-nova')
SAVE_BLEND = '--blend' in ARGV
SPEC_PATH = os.path.join(ROOT, 'houses', HOUSE_ID, 'house.json')
OUT_DIR = os.path.join(ROOT, 'public', 'assets', 'houses', HOUSE_ID)
H = json.load(open(SPEC_PATH, encoding='utf-8'))
EPS = 1e-6


def R(v):
    return round(float(v), 4)


def log(*a):
    print('[build_house %6.2fs]' % (time.time() - T0), *a, flush=True)


# ---------------------------------------------------------------------------------------------
# spec
# ---------------------------------------------------------------------------------------------
LEVEL_ORDER = [l['id'] for l in H['levels']]
LEV = {}
for l in H['levels']:
    LEV[l['id']] = dict(floor=l['elevation'], clear=l['clear_height'], slab=l['slab'],
                        ceil=l['elevation'] + l['clear_height'], parapet=l.get('roof_parapet', 0.45))
T_EXT = H['walls']['exterior']
T_INT = H['walls']['interior']
FOUND_BOTTOM = H.get('structure', {}).get('foundation_bottom', -0.6)
GRADE = H.get('site', {}).get('grade_y', 0.0)


def rect_b(rc):
    x, z, w, d = rc
    return (R(x), R(z), R(x + w), R(z + d))


class Room:
    def __init__(self, d, level, exterior=False):
        self.id = d['id']
        self.name = d.get('name', d['id'])
        self.level = level
        self.rects = [rect_b(r) for r in (d.get('rects') or [d['rect']])]
        self.floor = d.get('floor', 'concrete_screed')
        self.area_src = d.get('area')
        self.exterior = exterior
        self.y = d.get('y', LEV[level]['floor'])
        self.d = d

    def contains(self, x, z):
        for r in self.rects:
            if r[0] + EPS < x < r[2] - EPS and r[1] + EPS < z < r[3] - EPS:
                return True
        return False

    def plan_area(self):
        return sum((r[2] - r[0]) * (r[3] - r[1]) for r in self.rects)

    def bounds(self):
        return (min(r[0] for r in self.rects), min(r[1] for r in self.rects),
                max(r[2] for r in self.rects), max(r[3] for r in self.rects))

    def main_rect(self):
        return max(self.rects, key=lambda r: (r[2] - r[0]) * (r[3] - r[1]))


ROOMS, EXT_AREAS = [], []
for lid in LEVEL_ORDER:
    for d in H.get(lid + '_rooms', []):
        ROOMS.append(Room(d, lid))
    for d in H.get(lid + '_exterior', []):
        EXT_AREAS.append(Room(d, lid, exterior=True))
ROOM_BY_ID = {r.id: r for r in ROOMS + EXT_AREAS}
ROOMS_BY_LEVEL = {lid: [r for r in ROOMS if r.level == lid] for lid in LEVEL_ORDER}
VOIDS = [dict(v, b=rect_b(v['rect'])) for v in H.get('structure', {}).get('voids', [])]


def room_at(level, x, z):
    for r in ROOMS_BY_LEVEL.get(level, []):
        if r.contains(x, z):
            return r
    return None


def in_void(level, x, z):
    for v in VOIDS:
        b = v['b']
        if v['level'] == level and b[0] - EPS <= x <= b[2] + EPS and b[1] - EPS <= z <= b[3] + EPS:
            return True
    return False


def level_band(y):
    """-> (level for room lookup, kind) kind: 'room' inside a storey, 'slab' between storeys."""
    for i, lid in enumerate(LEVEL_ORDER):
        L = LEV[lid]
        if L['floor'] - EPS <= y <= L['ceil'] + EPS:
            return lid, 'room'
        if i + 1 < len(LEVEL_ORDER):
            up = LEVEL_ORDER[i + 1]
            if L['ceil'] < y < LEV[up]['floor']:
                return up, 'slab'
    return None, None


# ---------------------------------------------------------------------------------------------
# wall graph
# ---------------------------------------------------------------------------------------------
def wall_graph(label_rects, open_pairs=(), t_ext=T_EXT, t_int=T_INT, skip_rects=(), free_end_ext=False):
    """label_rects: [(label, [(x0,z0,x1,z1), ...])].  Returns merged, junction-extended walls:
    dict(run='x'|'z', c, a, b, t, kind, ext_a, ext_b, pieces=[(a,b,left,right)])
    run 'z' = wall at x=c running along z (left = west cell); run 'x' = wall at z=c (left = north)."""
    xs = sorted({v for _, rs in label_rects for r in rs for v in (r[0], r[2])})
    zs = sorted({v for _, rs in label_rects for r in rs for v in (r[1], r[3])})

    def lab(x, z):
        for L, rs in label_rects:
            for r in rs:
                if r[0] < x < r[2] and r[1] < z < r[3]:
                    return L
        return None
    nx, nz = len(xs) - 1, len(zs) - 1
    grid = [[lab((xs[i] + xs[i + 1]) / 2, (zs[j] + zs[j + 1]) / 2) for j in range(nz)] for i in range(nx)]

    def cell(i, j):
        return grid[i][j] if 0 <= i < nx and 0 <= j < nz else None
    opn = {frozenset(p) for p in open_pairs}

    def skipped(px, pz):
        return any(s[0] - EPS <= px <= s[2] + EPS and s[1] - EPS <= pz <= s[3] + EPS for s in skip_rects)
    units = []
    for i in range(len(xs)):
        for j in range(nz):
            a, b = cell(i - 1, j), cell(i, j)
            if a == b or (a and b and frozenset((a, b)) in opn):
                continue
            kind = 'int' if (a and b) else 'ext'
            zm = (zs[j] + zs[j + 1]) / 2
            if kind == 'ext' and skip_rects and skipped(xs[i] + (-0.01 if a is None else 0.01), zm):
                continue
            units.append(('z', xs[i], zs[j], zs[j + 1], kind, a, b))
    for j in range(len(zs)):
        for i in range(nx):
            a, b = cell(i, j - 1), cell(i, j)
            if a == b or (a and b and frozenset((a, b)) in opn):
                continue
            kind = 'int' if (a and b) else 'ext'
            xm = (xs[i] + xs[i + 1]) / 2
            if kind == 'ext' and skip_rects and skipped(xm, zs[j] + (-0.01 if a is None else 0.01)):
                continue
            units.append(('x', zs[j], xs[i], xs[i + 1], kind, a, b))
    units.sort(key=lambda u: (u[0], u[1], u[4], u[2]))
    walls = []
    for u in units:
        w = walls[-1] if walls else None
        if w and w['run'] == u[0] and abs(w['c'] - u[1]) < EPS and w['kind'] == u[4] and abs(w['b'] - u[2]) < EPS:
            w['b'] = u[3]
            w['pieces'].append((u[2], u[3], u[5], u[6]))
        else:
            walls.append(dict(run=u[0], c=u[1], a=u[2], b=u[3], kind=u[4],
                              t=(t_ext if u[4] == 'ext' else t_int), pieces=[(u[2], u[3], u[5], u[6])]))

    def P(w, s):
        return (w['c'], s) if w['run'] == 'z' else (s, w['c'])
    for w in walls:
        for end in ('a', 'b'):
            px, pz = P(w, w[end])
            m, touched = 0.0, False
            for o in walls:
                if o is w:
                    continue
                if o['run'] == 'z':
                    on = abs(o['c'] - px) < EPS and o['a'] - EPS <= pz <= o['b'] + EPS
                else:
                    on = abs(o['c'] - pz) < EPS and o['a'] - EPS <= px <= o['b'] + EPS
                if on:
                    touched = True
                    if o['run'] != w['run']:
                        m = max(m, o['t'])
            w['ext_' + end] = (m / 2) if touched else ((w['t'] / 2) if free_end_ext else 0.0)
    return walls


def wall_box(w, y0, y1):
    lo, hi = w['a'] - w['ext_a'], w['b'] + w['ext_b']
    c0, c1 = w['c'] - w['t'] / 2, w['c'] + w['t'] / 2
    if w['run'] == 'z':
        return (c0, c1, y0, y1, lo, hi)
    return (lo, hi, y0, y1, c0, c1)


# ---------------------------------------------------------------------------------------------
# voxel solid on a non-uniform grid
# ---------------------------------------------------------------------------------------------
AX = {0: (1, 2), 1: (2, 0), 2: (0, 1)}   # cyclic in-plane axes: e_a x e_b = e_axis


def rect_quad(axis, sign, plane, a0, a1, b0, b1):
    a, b = AX[axis]
    pts = []
    for (u, v) in ((a0, b0), (a1, b0), (a1, b1), (a0, b1)):
        p = [0.0, 0.0, 0.0]
        p[axis] = plane
        p[a] = u
        p[b] = v
        pts.append(tuple(p))
    if sign < 0:
        pts.reverse()
    return pts


def greedy(K):
    """K: 2D list of ints (-1 = empty). Returns [(i0,i1,j0,j1,k)] maximal-ish rectangles."""
    Hh = len(K)
    Ww = len(K[0]) if Hh else 0
    used = [[False] * Ww for _ in range(Hh)]
    out = []
    for i in range(Hh):
        row = K[i]
        for j in range(Ww):
            k = row[j]
            if k < 0 or used[i][j]:
                continue
            j2 = j + 1
            while j2 < Ww and row[j2] == k and not used[i][j2]:
                j2 += 1
            i2 = i + 1
            while i2 < Hh:
                r2, u2 = K[i2], used[i2]
                if all(r2[q] == k and not u2[q] for q in range(j, j2)):
                    i2 += 1
                else:
                    break
            for ii in range(i, i2):
                for q in range(j, j2):
                    used[ii][q] = True
            out.append((i, i2, j, j2, k))
    return out


class Vox:
    def __init__(self):
        self.adds, self.carves = [], []
        self.lines = [set(), set(), set()]

    def add(self, b):
        b = tuple(R(v) for v in b)
        if b[0] < b[1] and b[2] < b[3] and b[4] < b[5]:
            self.adds.append(b)

    def carve(self, b, tag=0):
        b = tuple(R(v) for v in b)
        if b[0] < b[1] and b[2] < b[3] and b[4] < b[5]:
            self.carves.append((b, tag))

    def line(self, axis, v):
        self.lines[axis].add(R(v))

    def build(self):
        G = [set(s) for s in self.lines]
        for b in self.adds + [c[0] for c in self.carves]:
            G[0].update((b[0], b[1]))
            G[1].update((b[2], b[3]))
            G[2].update((b[4], b[5]))
        # clamp helper lines to the solid's extent
        lo = [min(b[2 * i] for b in self.adds) for i in range(3)]
        hi = [max(b[2 * i + 1] for b in self.adds) for i in range(3)]
        G = [sorted(v for v in G[i] if lo[i] - EPS <= v <= hi[i] + EPS) for i in range(3)]
        self.G = [np.array(g) for g in G]
        self.idx = [{v: i for i, v in enumerate(g)} for g in G]
        n = tuple(len(g) - 1 for g in G)
        self.S = np.zeros(n, dtype=bool)
        self.T = np.zeros(n, dtype=np.int32)

        def sl(b):
            return tuple(slice(self.idx[i][max(lo[i], min(hi[i], b[2 * i]))],
                               self.idx[i][max(lo[i], min(hi[i], b[2 * i + 1]))]) for i in range(3))
        for b in self.adds:
            self.S[sl(b)] = True
        for b, tag in self.carves:
            s = sl(b)
            self.S[s] = False
            if tag:
                self.T[s] = tag
        log('voxel grid', n, 'solid cells', int(self.S.sum()))

    def faces(self, classify):
        """classify(axis, sign, plane, center(x,y,z), tag) -> hashable key or None.
        Returns {key: [(axis, sign, plane, a0, a1, b0, b1), ...]}"""
        out = {}
        keys, keyid = [], {}
        for axis in range(3):
            a, b = AX[axis]
            St = np.transpose(self.S, (axis, a, b))
            Tt = np.transpose(self.T, (axis, a, b))
            n = St.shape[0]
            Pd = np.zeros((n + 2,) + St.shape[1:], dtype=bool)
            Pd[1:-1] = St
            g, ga, gb = self.G[axis], self.G[a], self.G[b]
            cn = (g[:-1] + g[1:]) / 2
            ca = (ga[:-1] + ga[1:]) / 2
            cb = (gb[:-1] + gb[1:]) / 2
            for k in range(n + 1):
                lower, upper = Pd[k], Pd[k + 1]
                for sign, mask in ((1, lower & ~upper), (-1, ~lower & upper)):
                    if not mask.any():
                        continue
                    ec = k if sign > 0 else k - 1
                    if 0 <= ec < n:
                        cen, tags = cn[ec], Tt[ec]
                    else:
                        cen, tags = g[k] + sign * 0.05, None
                    ii, jj = np.nonzero(mask)
                    i0, i1, j0, j1 = ii.min(), ii.max() + 1, jj.min(), jj.max() + 1
                    K = [[-1] * (j1 - j0) for _ in range(i1 - i0)]
                    for i, j in zip(ii.tolist(), jj.tolist()):
                        c = [0.0, 0.0, 0.0]
                        c[axis] = float(cen)
                        c[a] = float(ca[i])
                        c[b] = float(cb[j])
                        tag = int(tags[i, j]) if tags is not None else 0
                        key = classify(axis, sign, float(g[k]), c, tag)
                        if key is None:
                            continue
                        if key not in keyid:
                            keyid[key] = len(keys)
                            keys.append(key)
                        K[i - i0][j - j0] = keyid[key]
                    for (p0, p1, q0, q1, kid) in greedy(K):
                        out.setdefault(keys[kid], []).append(
                            (axis, sign, float(g[k]), float(ga[i0 + p0]), float(ga[i0 + p1]),
                             float(gb[j0 + q0]), float(gb[j0 + q1])))
        return out


# ---------------------------------------------------------------------------------------------
# mesh builder
# ---------------------------------------------------------------------------------------------
def newell(pts):
    nx = ny = nz = 0.0
    for i in range(len(pts)):
        x1, y1, z1 = pts[i]
        x2, y2, z2 = pts[(i + 1) % len(pts)]
        nx += (y1 - y2) * (z1 + z2)
        ny += (z1 - z2) * (x1 + x2)
        nz += (x1 - x2) * (y1 + y2)
    return (nx, ny, nz)


def box_uv(p, n):
    ax = max(range(3), key=lambda i: abs(n[i]))
    x, y, z = p
    if ax == 0:
        return ((-z if n[0] > 0 else z), y)
    if ax == 2:
        return ((x if n[2] > 0 else -x), y)
    return (x, (-z if n[1] > 0 else z))


class MB:
    """Mesh builder in house coordinates.  Faces carry material names and 1 m box UVs."""

    def __init__(self, origin=(0.0, 0.0, 0.0)):
        self.v, self.f, self.m, self.uv, self.mats = [], [], [], [], []
        self.o = origin

    def mi(self, name):
        if name not in self.mats:
            self.mats.append(name)
        return self.mats.index(name)

    def poly(self, pts, mat, normal=None):
        n = newell(pts)
        ln = math.sqrt(n[0] ** 2 + n[1] ** 2 + n[2] ** 2)
        if ln < 1e-10:
            return
        if normal is not None and (n[0] * normal[0] + n[1] * normal[1] + n[2] * normal[2]) < 0:
            pts = pts[::-1]
            n = (-n[0], -n[1], -n[2])
        base = len(self.v)
        # UVs from WORLD position (continuous across objects), vertices stored relative to origin
        self.uv.append([box_uv(p, n) for p in pts])
        ox, oy, oz = self.o
        self.v.extend([(p[0] - ox, p[1] - oy, p[2] - oz) for p in pts])
        self.f.append(list(range(base, base + len(pts))))
        self.m.append(self.mi(mat))

    def box(self, x0, x1, y0, y1, z0, z1, mat, skip=()):
        if x1 - x0 < 1e-5 or y1 - y0 < 1e-5 or z1 - z0 < 1e-5:
            return
        if '+x' not in skip: self.poly(rect_quad(0, 1, x1, y0, y1, z0, z1), mat)
        if '-x' not in skip: self.poly(rect_quad(0, -1, x0, y0, y1, z0, z1), mat)
        if '+y' not in skip: self.poly(rect_quad(1, 1, y1, z0, z1, x0, x1), mat)
        if '-y' not in skip: self.poly(rect_quad(1, -1, y0, z0, z1, x0, x1), mat)
        if '+z' not in skip: self.poly(rect_quad(2, 1, z1, x0, x1, y0, y1), mat)
        if '-z' not in skip: self.poly(rect_quad(2, -1, z0, x0, x1, y0, y1), mat)

    def wbox(self, run, u0, u1, y0, y1, w0, w1, mat, skip=()):
        """box in a wall frame: u along the run axis, w across. skip names use +u/-u/+w/-w/+y/-y."""
        if run == 'x':
            m = {'+u': '+x', '-u': '-x', '+w': '+z', '-w': '-z', '+y': '+y', '-y': '-y'}
            self.box(min(u0, u1), max(u0, u1), y0, y1, min(w0, w1), max(w0, w1), mat, [m[s] for s in skip])
        else:
            m = {'+u': '+z', '-u': '-z', '+w': '+x', '-w': '-x', '+y': '+y', '-y': '-y'}
            self.box(min(w0, w1), max(w0, w1), y0, y1, min(u0, u1), max(u0, u1), mat, [m[s] for s in skip])

    def extrude(self, prof, O, A, X, Y, L, mat, skip_edge=None, caps=True):
        """extrude 2D profile prof=[(px,py)] (closed polygon) along unit axis A for length L.
        world point = O + X*px + Y*py + A*t.  skip_edge(p,q) -> True to drop a side face."""
        def W(px, py, t):
            return tuple(O[i] + X[i] * px + Y[i] * py + A[i] * t for i in range(3))
        cx = sum(p[0] for p in prof) / len(prof)
        cy = sum(p[1] for p in prof) / len(prof)
        n = len(prof)
        for i in range(n):
            p, q = prof[i], prof[(i + 1) % n]
            if skip_edge and skip_edge(p, q):
                continue
            ex, ey = q[0] - p[0], q[1] - p[1]
            nx_, ny_ = ey, -ex
            mx, my = (p[0] + q[0]) / 2 - cx, (p[1] + q[1]) / 2 - cy
            if nx_ * mx + ny_ * my < 0:
                nx_, ny_ = -nx_, -ny_
            nrm = tuple(X[k] * nx_ + Y[k] * ny_ for k in range(3))
            self.poly([W(p[0], p[1], 0), W(q[0], q[1], 0), W(q[0], q[1], L), W(p[0], p[1], L)], mat, normal=nrm)
        if caps:
            self.poly([W(px, py, 0) for px, py in prof], mat, normal=tuple(-a for a in A))
            self.poly([W(px, py, L) for px, py in prof], mat, normal=A)

    def extend(self, other):
        base = len(self.v)
        self.v.extend(other.v)
        for f, m in zip(other.f, other.m):
            self.f.append([i + base for i in f])
            self.m.append(self.mi(other.mats[m]))
        self.uv.extend(other.uv)

    def tris(self):
        return sum(len(f) - 2 for f in self.f)


def wpt(run, u, y, w):
    """wall-frame point -> world (x,y,z)"""
    return (u, y, w) if run == 'x' else (w, y, u)


# ---------------------------------------------------------------------------------------------
# Blender helpers
# ---------------------------------------------------------------------------------------------
def B(p):
    return (p[0], -p[2], p[1])


def srgb2lin(c):
    return ((c + 0.055) / 1.055) ** 2.4 if c > 0.04045 else c / 12.92


MAT_LOOK = {   # preview look only - runtime replaces these with textured PBR by name
    'wall_ext_white': ((0.93, 0.93, 0.91), 0.9, 0.0),
    'wall_ext_anthracite': ((0.23, 0.25, 0.27), 0.6, 0.0),
    'wood_slats': ((0.72, 0.52, 0.32), 0.7, 0.0),
    'frames': ((0.06, 0.06, 0.06), 0.45, 0.5),
    'glass': ((0.85, 0.92, 0.9), 0.02, 0.0),
    'wall_int': ((0.95, 0.94, 0.91), 0.95, 0.0),
    'oak_plank': ((0.71, 0.55, 0.38), 0.5, 0.0),
    'large_format_tile_grey': ((0.62, 0.62, 0.6), 0.4, 0.0),
    'large_format_tile_light': ((0.86, 0.84, 0.79), 0.5, 0.0),
    'small_tile_white': ((0.94, 0.94, 0.94), 0.3, 0.0),
    'concrete_screed': ((0.58, 0.58, 0.57), 0.7, 0.0),
    'ceiling': ((0.97, 0.97, 0.96), 0.95, 0.0),
    'roof_membrane': ((0.42, 0.42, 0.42), 0.9, 0.0),
    'concrete_pavers': ((0.6, 0.59, 0.57), 0.8, 0.0),
    'roof_standing_seam': ((0.2, 0.22, 0.24), 0.45, 0.6),
    'stair_tread': ((0.7, 0.53, 0.35), 0.45, 0.0),
    'handrail_black': ((0.04, 0.04, 0.04), 0.4, 0.7),
    'door_leaf_white': ((0.95, 0.95, 0.94), 0.45, 0.0),
    'skirting_white': ((0.96, 0.96, 0.95), 0.5, 0.0),
}
MATS = {}


def get_mat(name):
    if name in MATS:
        return MATS[name]
    col, rough, metal = MAT_LOOK.get(name, ((0.8, 0.8, 0.8), 0.8, 0.0))
    lin = tuple(srgb2lin(c) for c in col)
    m = bpy.data.materials.new(name)
    try:
        m.use_nodes = True
    except Exception:
        pass
    bsdf = m.node_tree.nodes.get('Principled BSDF')
    bsdf.inputs['Base Color'].default_value = (*lin, 1.0)
    bsdf.inputs['Roughness'].default_value = rough
    bsdf.inputs['Metallic'].default_value = metal
    m.diffuse_color = (*lin, 1.0)
    m.roughness = rough
    if name == 'glass':
        bsdf.inputs['Transmission Weight'].default_value = 1.0
        bsdf.inputs['IOR'].default_value = 1.5
        m.diffuse_color = (*lin, 0.25)
        try:
            m.surface_render_method = 'BLENDED'
        except Exception:
            pass
    m['house_material'] = name
    MATS[name] = m
    return m


COLL = None
STATS = {'objects': 0, 'tris': 0}


def pack_uv2(face_uvs, pad_frac=0.004):
    """per-face islands (from the metric box UVs) shelf-packed into [0,1]^2, non-overlapping."""
    items = []
    tot = 0.0
    for fi, pts in enumerate(face_uvs):
        us = [p[0] for p in pts]
        vs = [p[1] for p in pts]
        u0, v0 = min(us), min(vs)
        w, h = max(us) - u0, max(vs) - v0
        items.append((h, w, fi, u0, v0))
        tot += (w + 0.02) * (h + 0.02)
    side = max(math.sqrt(tot) * 1.08, max((it[1] for it in items), default=1.0))
    pad = side * pad_frac
    items.sort(key=lambda t: (-t[0], -t[1]))
    x = y = shelf = 0.0
    place = {}
    for h, w, fi, u0, v0 in items:
        if x + w + pad > side + 1e-9 and x > 0:
            x = 0.0
            y += shelf + pad
            shelf = 0.0
        place[fi] = (x + pad - u0, y + pad - v0)
        x += w + pad
        shelf = max(shelf, h + pad)
    total_h = y + shelf + pad
    s = 1.0 / max(side + pad, total_h)
    out = []
    for fi, pts in enumerate(face_uvs):
        ox, oy = place[fi]
        out.append([((p[0] + ox) * s, (p[1] + oy) * s) for p in pts])
    return out


def make_obj(name, mb, parent=None, uv=True, uv2=True, weld=True, props=None, collection=None):
    if not mb.f:
        return None
    me = bpy.data.meshes.new(name)
    me.from_pydata([B(p) for p in mb.v], [], mb.f)
    for mn in mb.mats:
        me.materials.append(get_mat(mn))
    me.polygons.foreach_set('material_index', mb.m)
    if uv:
        l1 = me.uv_layers.new(name='UVMap')
        l1.data.foreach_set('uv', [c for fu in mb.uv for p in fu for c in p])
        if uv2:
            l2 = me.uv_layers.new(name='UV2')
            l2.data.foreach_set('uv', [c for fu in pack_uv2(mb.uv) for p in fu for c in p])
    me.update()
    if weld:
        bm = bmesh.new()
        bm.from_mesh(me)
        bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-5)
        bm.to_mesh(me)
        bm.free()
    try:
        me.shade_flat()
    except Exception:
        pass
    ob = bpy.data.objects.new(name, me)
    (collection or COLL).objects.link(ob)
    if parent is not None:
        ob.parent = parent
    if props:
        for k, v in props.items():
            ob[k] = v
    STATS['objects'] += 1
    STATS['tris'] += mb.tris()
    return ob


def make_empty(name, pos, props=None, parent=None, size=0.25, local=False):
    ob = bpy.data.objects.new(name, None)
    ob.empty_display_type = 'PLAIN_AXES'
    ob.empty_display_size = size
    COLL.objects.link(ob)
    if parent is not None:
        ob.parent = parent
    ob.location = B(pos)
    if props:
        for k, v in props.items():
            ob[k] = v
    return ob


# ---------------------------------------------------------------------------------------------
# build: walls per level
# ---------------------------------------------------------------------------------------------
WALLS = {}
for lid in LEVEL_ORDER:
    lr = [(r.id, r.rects) for r in ROOMS_BY_LEVEL[lid]]
    WALLS[lid] = wall_graph(lr, H['walls'].get('open', {}).get(lid, []))
    log('level', lid, 'walls', len(WALLS[lid]),
        'ext', sum(1 for w in WALLS[lid] if w['kind'] == 'ext'), 'int', sum(1 for w in WALLS[lid] if w['kind'] == 'int'))


def find_wall(lid, x, z):
    best = None
    for w in WALLS[lid]:
        if w['run'] == 'z' and abs(w['c'] - x) < 1e-3 and w['a'] - EPS <= z <= w['b'] + EPS:
            best = w
        if w['run'] == 'x' and abs(w['c'] - z) < 1e-3 and w['a'] - EPS <= x <= w['b'] + EPS:
            best = w
    return best


# ---------------------------------------------------------------------------------------------
# openings
# ---------------------------------------------------------------------------------------------
OPENINGS = []
for i, o in enumerate(H.get('openings', [])):
    lid = o['level']
    x, z = o['at']
    w = find_wall(lid, x, z)
    if w is None:
        raise SystemExit('opening %s: no wall at %s on %s' % (o['id'], o['at'], lid))
    u = z if w['run'] == 'z' else x
    fl = LEV[lid]['floor']
    sill = o.get('sill', 0.0)
    op = dict(o)
    op.update(tag=i + 1, wall=w, run=w['run'], c=w['c'], t=w['t'], u0=R(u - o['width'] / 2), u1=R(u + o['width'] / 2),
              y0=R(fl + sill), y1=R(fl + sill + o['height']), sill=sill, lvl=lid, floor=fl)

    def side_room(sgn, c=w['c'], um=u, run=w['run']):
        px, pz = (c + sgn * 0.3, um) if run == 'z' else (um, c + sgn * 0.3)
        return room_at(lid, px, pz)
    left, right = side_room(-1), side_room(1)
    op['left'], op['right'] = (left.id if left else None), (right.id if right else None)
    op['exterior'] = left is None or right is None
    op['out'] = (-1 if left is None else 1) if op['exterior'] else 0
    OPENINGS.append(op)
OP_BY_TAG = {o['tag']: o for o in OPENINGS}
log('openings', len(OPENINGS))


def op_box(o, grow=0.0):
    c0, c1 = o['c'] - o['t'] / 2 - 0.0005, o['c'] + o['t'] / 2 + 0.0005
    if o['run'] == 'z':
        return (c0, c1, o['y0'], o['y1'], o['u0'] - grow, o['u1'] + grow)
    return (o['u0'] - grow, o['u1'] + grow, o['y0'], o['y1'], c0, c1)


# ---------------------------------------------------------------------------------------------
# structure solid
# ---------------------------------------------------------------------------------------------
def expanded(rc, e):
    return (rc[0] - e, rc[1] - e, rc[2] + e, rc[3] + e)


COP_O, COP_T = 0.04, 0.05


def structure_vox(for_collision=False):
    V = Vox()
    half = T_EXT / 2
    # foundations + slabs
    for i, lid in enumerate(LEVEL_ORDER):
        L = LEV[lid]
        rects = [expanded(rc, half) for r in ROOMS_BY_LEVEL[lid] for rc in r.rects]
        rects += [expanded(rect_b(c), half) for c in H.get('structure', {}).get('canopies', {}).get(lid, [])]
        if i == 0:
            for rc in [expanded(rc, half) for r in ROOMS_BY_LEVEL[lid] for rc in r.rects]:
                V.add((rc[0], rc[2], FOUND_BOTTOM, L['floor'], rc[1], rc[3]))
        top = LEV[LEVEL_ORDER[i + 1]]['floor'] if i + 1 < len(LEVEL_ORDER) else L['ceil'] + L['slab']
        for rc in rects:
            V.add((rc[0], rc[2], L['ceil'], top, rc[1], rc[3]))
        for w in WALLS[lid]:
            V.add(wall_box(w, L['floor'], L['ceil']))
            V.line(2 if w['run'] == 'x' else 0, w['c'])      # centre-line: splits reveal cells in/out
    # parapets
    for rf in H.get('roofs', []):
        if rf['type'] != 'flat' or not rf.get('parapet'):
            continue
        pw = wall_graph([('roof', [rect_b(r) for r in rf['rects']])], skip_rects=[rect_b(s) for s in rf.get('parapet_skip', [])],
                        free_end_ext=True)
        ptop = rf['top'] + rf['parapet']
        for w in pw:
            V.add(wall_box(w, rf['top'], ptop))
            if rf.get('coping'):
                # coping cap: 50 mm thick, overhangs 40 mm both sides, 15 mm drip lips at the outer
                # edges leave a 20 mm drip groove against each wall face (all part of the solid union)
                lo, hi = w['a'] - w['ext_a'] - COP_O, w['b'] + w['ext_b'] + COP_O
                for (c0, c1, y0, y1) in ((w['c'] - w['t'] / 2 - COP_O, w['c'] + w['t'] / 2 + COP_O, ptop, ptop + COP_T),
                                         (w['c'] - w['t'] / 2 - COP_O, w['c'] - w['t'] / 2 - COP_O + 0.02, ptop - 0.015, ptop),
                                         (w['c'] + w['t'] / 2 + COP_O - 0.02, w['c'] + w['t'] / 2 + COP_O, ptop - 0.015, ptop)):
                    V.add((c0, c1, y0, y1, lo, hi) if w['run'] == 'z' else (lo, hi, y0, y1, c0, c1))
    for bx in H.get('structure', {}).get('boxes', []):
        rc = rect_b(bx['rect'])
        V.add((rc[0], rc[2], bx['y'][0], bx['y'][1], rc[1], rc[3]))
    # voids through slabs
    for v in VOIDS:
        i = LEVEL_ORDER.index(v['level'])
        lo_y = LEV[LEVEL_ORDER[i - 1]]['ceil'] if i > 0 else LEV[v['level']]['floor'] - 0.3
        b = v['b']
        V.carve((b[0], b[2], lo_y, LEV[v['level']]['floor'], b[1], b[3]))
    # openings
    for o in OPENINGS:
        if for_collision and o['type'] in ('window', 'garage'):
            continue
        V.carve(op_box(o), 0 if for_collision else o['tag'])
    V.build()
    return V


def ext_area_at(x, z, y):
    for a in EXT_AREAS:
        if abs(a.y - y) < 0.011 and a.contains(x, z):
            return a
    return None


COPING = set()
for rf in H.get('roofs', []):
    if rf['type'] == 'flat' and rf.get('parapet'):
        COPING.add(R(rf['top'] + rf['parapet'] + (COP_T if rf.get('coping') else 0)))
for bx in H.get('structure', {}).get('boxes', []):
    if bx['y'][1] > 3.2:
        COPING.add(R(bx['y'][1]))   # tops of tall blocks read as copings, not roof membrane
ZONES = H.get('facade_zones', [])


def zone_of(x, y, z):
    for zn in ZONES:
        b = zn['box']
        if b[0] <= x <= b[3] and b[1] <= y <= b[4] and b[2] <= z <= b[5]:
            return zn
    return None


def classify(axis, sign, plane, c, tag):
    x, y, z = c
    op = OP_BY_TAG.get(tag)
    lid, kind = level_band(y)
    room = room_at(lid, x, z) if lid else None
    if room is not None:
        if axis == 1 and sign > 0:
            if op and op['sill'] > 0.001:
                return ('WALL_' + room.id, 'wall_int', True)
            return ('SURF_%s_%s' % (room.floor, room.id), room.floor, False)
        if axis == 1 and sign < 0:
            if op or kind == 'slab':
                return ('WALL_' + room.id, 'wall_int', bool(op))
            return ('CEIL_' + room.id, 'ceiling', False)
        return ('WALL_' + room.id, 'wall_int', bool(op))
    # exterior
    if op:
        zn = zone_of(x, y, z)
        mat = op.get('reveal') or (zn['material'] if zn else 'wall_ext_white')
        return ('EXT_' + mat, mat, True)
    if axis == 1 and sign > 0:
        a = ext_area_at(x, z, plane)
        if a:
            return ('SURF_%s_%s' % (a.floor, a.id), a.floor, False)
        if R(plane) in COPING:
            return ('EXT_wall_ext_white', 'wall_ext_white', False)
        if plane <= 0.001:
            return ('EXT_concrete_screed', 'concrete_screed', False)
        return ('EXT_roof_membrane', 'roof_membrane', False)
    if axis == 1 and sign < 0:
        return ('EXT_wall_ext_white', 'wall_ext_white', False)
    if y < 0:
        return ('EXT_concrete_screed', 'concrete_screed', False)
    zn = zone_of(x, y, z)
    mat = zn['material'] if zn else 'wall_ext_white'
    return ('EXT_' + mat, mat, False)


# ---------------------------------------------------------------------------------------------
# scene setup
# ---------------------------------------------------------------------------------------------
bpy.ops.wm.read_factory_settings(use_empty=True)
COLL = bpy.data.collections.new('house_' + HOUSE_ID)
bpy.context.scene.collection.children.link(COLL)

log('building structure solid')
V = structure_vox()
FACES = V.faces(classify)
log('structure face groups', len(FACES), 'rects', sum(len(v) for v in FACES.values()))

GROUPS = {}   # object name -> MB
for (name, mat, flag), rects in FACES.items():
    mb = GROUPS.setdefault(name, MB())
    for (axis, sign, plane, a0, a1, b0, b1) in rects:
        mb.poly(rect_quad(axis, sign, plane, a0, a1, b0, b1), mat)

# ---------------------------------------------------------------------------------------------
# skirting + anthracite panels (derived from classified faces)
# ---------------------------------------------------------------------------------------------
SK = MB()
SK_H, SK_T, SK_EMBED = 0.08, 0.012, 0.005
# chamfered profile (d = distance from the wall face into the room, h = height). The back is
# EMBEDDED 5 mm into the wall so the skirting/wall junction is a clean intersection, not a shared
# edge (a shared edge on a T-junction leaks a dashed line of light at the skirting top).
SK_PROF = [(-SK_EMBED, 0.0), (SK_T, 0.0), (SK_T, SK_H - 0.012), (SK_T - 0.005, SK_H), (-SK_EMBED, SK_H)]
_sk_skip = lambda p, q: (p[1] == 0.0 and q[1] == 0.0) or (p[0] == -SK_EMBED and q[0] == -SK_EMBED)
for (name, mat, reveal), rects in FACES.items():
    if not name.startswith('WALL_') or reveal:
        continue
    rm = ROOM_BY_ID[name[5:]]
    if rm.floor in ('concrete_screed',):
        continue
    fl = LEV[rm.level]['floor']
    for (axis, sign, plane, a0, a1, b0, b1) in rects:
        if axis == 1:
            continue
        if axis == 0:   # plane x: a=y, b=z
            if abs(a0 - fl) > 1e-4:
                continue
            SK.extrude(SK_PROF, (plane, fl, b0), (0, 0, 1), (sign, 0, 0), (0, 1, 0), b1 - b0, 'skirting_white', _sk_skip)
        else:           # plane z: a=x, b=y
            if abs(b0 - fl) > 1e-4:
                continue
            SK.extrude(SK_PROF, (a0, fl, plane), (1, 0, 0), (0, 0, sign), (0, 1, 0), a1 - a0, 'skirting_white', _sk_skip)

PANEL = MB()
PAN_U, PAN_V, PAN_J, PAN_T = 1.20, 0.675, 0.008, 0.015
for (name, mat, reveal), rects in FACES.items():
    if name != 'EXT_wall_ext_anthracite' or reveal:
        continue
    for (axis, sign, plane, a0, a1, b0, b1) in rects:
        if axis == 1:
            continue
        if axis == 0:
            y0, y1, u0, u1 = a0, a1, b0, b1
        else:
            u0, u1, y0, y1 = a0, a1, b0, b1
        zn = zone_of(plane if axis == 0 else (u0 + u1) / 2, (y0 + y1) / 2, plane if axis == 2 else (u0 + u1) / 2)
        if not zn or not zn.get('panels'):
            continue
        vbase = zn['box'][1]
        for iu in range(int(math.floor(u0 / PAN_U)) - 1, int(math.ceil(u1 / PAN_U)) + 1):
            cu0, cu1 = iu * PAN_U + PAN_J / 2, (iu + 1) * PAN_U - PAN_J / 2
            pu0, pu1 = max(u0, cu0), min(u1, cu1)
            if pu1 - pu0 < 0.02:
                continue
            for iv in range(int(math.floor((y0 - vbase) / PAN_V)) - 1, int(math.ceil((y1 - vbase) / PAN_V)) + 1):
                cv0, cv1 = vbase + iv * PAN_V + PAN_J / 2, vbase + (iv + 1) * PAN_V - PAN_J / 2
                pv0, pv1 = max(y0, cv0), min(y1, cv1)
                if pv1 - pv0 < 0.02:
                    continue
                w0, w1 = (plane - sign * 0.002, plane + sign * PAN_T)   # embedded 2 mm: no shared edge with the wall
                if axis == 0:
                    PANEL.box(min(w0, w1), max(w0, w1), pv0, pv1, pu0, pu1, 'wall_ext_anthracite',
                              skip=('-x' if sign > 0 else '+x',))
                else:
                    PANEL.box(pu0, pu1, pv0, pv1, min(w0, w1), max(w0, w1), 'wall_ext_anthracite',
                              skip=('-z' if sign > 0 else '+z',))

# ---------------------------------------------------------------------------------------------
# windows, sliding doors, garage door, doors
# ---------------------------------------------------------------------------------------------
FR = MB()        # window/door frames (black) + ext sills + interior boards
GL = MB()        # glass
LARCH = MB()     # larch window surrounds
DOORFR = MB()    # interior door linings + casings
GARAGE = MB()
COL_GLASS = {}   # id -> MB
DOORS_META = []
FW, FD = 0.06, 0.07   # frame profile width / depth


SLIDES = []      # (opening, MB, props) movable panels exported OPEN as SLIDE_<id>


def sash(mb, run, g0, g1, y0, y1, d0, d1, glass_mb, sw=0.05):
    """sash ring (stiles + rails) with glass and glazing beads inside, depth d0..d1"""
    mb.wbox(run, g0, g0 + sw, y0, y1, d0, d1, 'frames')
    mb.wbox(run, g1 - sw, g1, y0, y1, d0, d1, 'frames')
    mb.wbox(run, g0 + sw, g1 - sw, y0, y0 + sw, d0, d1, 'frames', skip=('-u', '+u'))
    mb.wbox(run, g0 + sw, g1 - sw, y1 - sw, y1, d0, d1, 'frames', skip=('-u', '+u'))
    dm = (d0 + d1) / 2
    glass_mb.wbox(run, g0 + sw, g1 - sw, y0 + sw, y1 - sw, dm - 0.006, dm + 0.006, 'glass')
    for (a, b) in ((d0 - 0.004, d0), (d1, d1 + 0.004)):
        mb.wbox(run, g0 + sw, g1 - sw, y0 + sw, y0 + sw + 0.012, a, b, 'frames', skip=('-u', '+u'))
        mb.wbox(run, g0 + sw, g1 - sw, y1 - sw - 0.012, y1 - sw, a, b, 'frames', skip=('-u', '+u'))
        mb.wbox(run, g0 + sw, g0 + sw + 0.012, y0 + sw + 0.012, y1 - sw - 0.012, a, b, 'frames', skip=('-y', '+y'))
        mb.wbox(run, g1 - sw - 0.012, g1 - sw, y0 + sw + 0.012, y1 - sw - 0.012, a, b, 'frames', skip=('-y', '+y'))


def window(o):
    run, c, t = o['run'], o['c'], o['t']
    out = o['out'] if o['exterior'] else 1
    fc = c + out * 0.05                      # frame plane (slightly towards the outside)
    f0, f1 = fc - FD / 2, fc + FD / 2
    u0, u1, y0, y1 = o['u0'], o['u1'], o['y0'], o['y1']
    n = max(1, int(o.get('panes', 1)))
    slide = o['type'] == 'slide'
    face_out, face_in = c + out * t / 2, c - out * t / 2
    if slide:
        # threshold plate across the whole reveal + two tracks, 12 mm lip only
        th = 0.012
        FR.wbox(run, u0, u1, y0, y0 + th, *sorted((face_in, face_out + out * 0.04)), 'frames', skip=('-y', '-u', '+u'))
        for off in (-0.02, 0.02):
            FR.wbox(run, u0 + FW, u1 - FW, y0 + th, y0 + th + 0.012, fc + off - 0.004, fc + off + 0.004, 'handrail_black', skip=('-y', '-u', '+u'))
        yb = y0 + th
        FR.wbox(run, u0, u0 + FW, yb, y1, f0, f1, 'frames', skip=('-u', '-y'))
        FR.wbox(run, u1 - FW, u1, yb, y1, f0, f1, 'frames', skip=('+u', '-y'))
        FR.wbox(run, u0 + FW, u1 - FW, y1 - FW, y1, f0, f1, 'frames', skip=('+y', '-u', '+u'))
        pw = (u1 - u0 - 2 * FW) / n
        ovl = 0.05                                             # interlock overlap between panels
        jopen = o.get('open_panel')
        cols = []
        for k in range(n):
            g0 = u0 + FW + k * pw - (ovl / 2 if k > 0 else 0)
            g1 = u0 + FW + (k + 1) * pw + (ovl / 2 if k < n - 1 else 0)
            off = 0.02 if (k % 2) else -0.02
            d0, d1 = fc + off - 0.016, fc + off + 0.016
            if k == jopen:
                nb = k + 1 if k + 1 < n else k - 1               # parked behind its neighbour
                shift = (nb - k) * pw
                mb = MB()
                sash(mb, run, g0 + shift, g1 + shift, yb + 0.012, y1 - FW, d0, d1, mb, sw=0.055)
                axis = [1, 0, 0] if run == 'x' else [0, 0, 1]
                SLIDES.append((o, mb, {'kind': 'slide', 'opening': o['id'], 'axis': axis, 'open_offset': round(shift, 4),
                                       'closed_offset': round(-shift, 4), 'state': 'open',
                                       'desc': 'panel exported OPEN; translate by closed_offset along axis to close'}))
                o['open_range'] = [round(g0 + ovl / 2, 3), round(g1 - ovl / 2, 3)]
                continue
            sash(FR, run, g0, g1, yb + 0.012, y1 - FW, d0, d1, GL, sw=0.055)
            cols.append((g0, g1))
        cg = COL_GLASS.setdefault('slide_' + o['id'], MB())
        for (g0, g1) in cols:
            cg.wbox(run, g0, g1, y0 + 0.05, y1, c - 0.06, c + 0.06, 'glass')
    else:
        FR.wbox(run, u0, u0 + FW, y0, y1, f0, f1, 'frames', skip=('-u',))
        FR.wbox(run, u1 - FW, u1, y0, y1, f0, f1, 'frames', skip=('+u',))
        FR.wbox(run, u0 + FW, u1 - FW, y0, y0 + FW, f0, f1, 'frames', skip=('-y', '-u', '+u'))
        FR.wbox(run, u0 + FW, u1 - FW, y1 - FW, y1, f0, f1, 'frames', skip=('+y', '-u', '+u'))
        edges = [u0 + FW] + [u0 + (u1 - u0) * k / n for k in range(1, n)] + [u1 - FW]
        for k in range(1, n):
            FR.wbox(run, edges[k] - FW / 2, edges[k] + FW / 2, y0 + FW, y1 - FW, f0, f1, 'frames', skip=('-y', '+y'))
        for k in range(n):
            g0 = edges[k] + (FW / 2 if k > 0 else 0)
            g1 = edges[k + 1] - (FW / 2 if k < n - 1 else 0)
            sash(FR, run, g0, g1, y0 + FW, y1 - FW, f0 + 0.012, f1 - 0.012, GL, sw=0.045)
    if o['exterior'] and o['sill'] > 0.001:
        proj = 0.05 + (0.18 if o.get('surround') else 0.0)
        a0, a1 = (f1, face_out + proj) if out > 0 else (face_out - proj, f0)
        FR.wbox(run, u0, u1, y0, y0 + 0.03, a0, a1, 'frames', skip=('-u', '+u') if not o.get('surround') else ())
        dn = sorted((face_out + out * (proj - 0.012), face_out + out * proj))       # drip nose
        FR.wbox(run, u0, u1, y0 - 0.02, y0, dn[0], dn[1], 'frames', skip=('+y', '-u', '+u') if not o.get('surround') else ('+y',))
        b0, b1 = (face_in - out * 0.025, f0) if out > 0 else (f1, face_in - out * 0.025)
        FR.wbox(run, u0 - 0.02, u1 + 0.02, y0, y0 + 0.025, min(b0, b1), max(b0, b1), 'skirting_white')
    if o.get('surround'):
        s0, s1 = sorted((face_out - out * 0.004, face_out + out * 0.18))
        back = '-w' if out > 0 else '+w'
        LARCH.wbox(run, u0 - 0.10, u0, y0 - 0.10, y1 + 0.10, s0, s1, 'wood_slats', skip=(back,))
        LARCH.wbox(run, u1, u1 + 0.10, y0 - 0.10, y1 + 0.10, s0, s1, 'wood_slats', skip=(back,))
        LARCH.wbox(run, u0, u1, y1, y1 + 0.10, s0, s1, 'wood_slats', skip=(back, '-u', '+u'))
        LARCH.wbox(run, u0, u1, y0 - 0.10, y0, s0, s1, 'wood_slats', skip=(back, '-u', '+u'))


def garage_door(o):
    run, c, t = o['run'], o['c'], o['t']
    out = o['out']
    face_out = c + out * t / 2
    dp = face_out - out * 0.10                 # door plane (P03 anchors a skin 8 mm in front: keep)
    u0, u1, y0, y1 = o['u0'], o['u1'], o['y0'], o['y1']
    lo, hi = sorted((dp, face_out))
    GARAGE.wbox(run, u0, u0 + 0.05, y0, y1, lo, hi, 'frames', skip=('-u', '-y'))
    GARAGE.wbox(run, u1 - 0.05, u1, y0, y1, lo, hi, 'frames', skip=('+u', '-y'))
    GARAGE.wbox(run, u0 + 0.05, u1 - 0.05, y1 - 0.08, y1, lo, hi, 'frames', skip=('+y', '-u', '+u'))
    s0, s1 = sorted((face_out - out * 0.002, face_out + out * 0.018))       # facade surround trim
    back = '-w' if out > 0 else '+w'
    GARAGE.wbox(run, u0 - 0.09, u0, y0, y1 + 0.09, s0, s1, 'frames', skip=(back, '-y'))
    GARAGE.wbox(run, u1, u1 + 0.09, y0, y1 + 0.09, s0, s1, 'frames', skip=(back, '-y'))
    GARAGE.wbox(run, u0, u1, y1, y1 + 0.09, s0, s1, 'frames', skip=(back, '-u', '+u'))
    ns = 5
    top = y1 - 0.08
    sh = (top - y0) / ns
    bp = sorted((dp - out * 0.045, dp - out * 0.052))
    GARAGE.wbox(run, u0 + 0.05, u1 - 0.05, y0, top, bp[0], bp[1], 'frames', skip=('-u', '+u', '-y'))
    for k in range(ns):
        a_ = y0 + k * sh + (0.005 if k > 0 else 0.0)
        b_ = y0 + (k + 1) * sh - (0.005 if k < ns - 1 else 0.0)
        sk = ('-u', '+u', '-y') if k == 0 else ('-u', '+u')
        GARAGE.wbox(run, u0 + 0.05, u1 - 0.05, a_, b_, *sorted((dp, dp - out * 0.045)), 'wall_ext_anthracite', skip=sk)
        GARAGE.wbox(run, u0 + 0.05, u1 - 0.05, a_, b_, *sorted((dp - out * 0.052, dp - out * 0.062)), 'skirting_white', skip=sk)
    sa, sb = sorted((dp, dp + out * 0.012))                                   # bottom rubber seal
    GARAGE.wbox(run, u0 + 0.05, u1 - 0.05, y0, y0 + 0.025, sa, sb, 'handrail_black', skip=('-y', '-u', '+u'))
    inner = c - out * t / 2
    for uu in (u0 + 0.02, u1 - 0.09):   # vertical + ceiling tracks inside the garage
        GARAGE.wbox(run, uu, uu + 0.07, y0, y1 + 0.25, *sorted((inner - out * 0.002, inner - out * 0.07)), 'handrail_black', skip=('-y',))
        GARAGE.wbox(run, uu, uu + 0.07, y1 + 0.18, y1 + 0.25, *sorted((inner - out * 0.07, inner - out * 3.0)), 'handrail_black')
    um = (u0 + u1) / 2
    GARAGE.wbox(run, um - 0.03, um + 0.03, 2.62, 2.68, *sorted((inner - out * 0.07, inner - out * 3.4)), 'handrail_black')
    GARAGE.wbox(run, um - 0.14, um + 0.14, 2.5, 2.7, *sorted((inner - out * 3.4, inner - out * 3.8)), 'handrail_black')


DOOR_OPEN = math.radians(H.get('doors_default_open_deg', 92))


def door(o):
    run, c, t = o['run'], o['c'], o['t']
    u0, u1, y0, y1 = o['u0'], o['u1'], o['y0'], o['y1']
    front = o['type'] == 'front_door'
    lining_mat = 'frames' if front else 'door_leaf_white'
    LT = 0.05 if front else 0.03      # lining thickness
    w0, w1 = c - t / 2, c + t / 2
    tgt = DOORFR
    tgt.wbox(run, u0, u0 + LT, y0, y1, w0, w1, lining_mat, skip=('-u', '-y'))
    tgt.wbox(run, u1 - LT, u1, y0, y1, w0, w1, lining_mat, skip=('+u', '-y'))
    tgt.wbox(run, u0 + LT, u1 - LT, y1 - LT, y1, w0, w1, lining_mat, skip=('+y', '-u', '+u'))
    CW, CT, CE = 0.07, 0.018, 0.003
    U = (1, 0, 0) if run == 'x' else (0, 0, 1)
    Wv = (0, 0, 1) if run == 'x' else (1, 0, 0)
    CPROF = [(0.0, -CE), (CW, -CE), (CW, CT - 0.004), (CW - 0.004, CT), (0.004, CT), (0.0, CT - 0.004)]
    cskip = lambda p, q: p[1] == -CE and q[1] == -CE          # back face is embedded in the wall
    for side in ((-1, 1) if not front else ((-o['out'],))):
        f = c + side * t / 2
        Y = tuple(side * v for v in Wv)
        jl = y1 + CW - 0.015 - y0
        # jambs (vertical extrusions, chamfered both front edges); head runs over them (butt joint)
        tgt.extrude(CPROF, wpt(run, u0 + 0.015, y0, f), (0, 1, 0), tuple(-v for v in U), Y, jl - CW, 'door_leaf_white', cskip, caps=False)
        tgt.extrude(CPROF, wpt(run, u1 - 0.015, y0, f), (0, 1, 0), U, Y, jl - CW, 'door_leaf_white', cskip, caps=False)
        tgt.extrude(CPROF, wpt(run, u0 - CW, y1 - 0.015, f), U, (0, 1, 0), Y, (u1 + CW) - (u0 - CW), 'door_leaf_white', cskip)
    # leaf + hinge pivot
    swing_room = o.get('swing_into')
    s = -1 if (o['left'] == swing_room) else 1          # across-direction towards the swing room
    LTH = 0.07 if front else 0.04
    gap = 0.003
    lu0, lu1 = u0 + LT + gap, u1 - LT - gap
    ly0, ly1 = y0 + 0.008, y1 - LT - gap
    hinge_u = lu0 if o.get('hinge', 'min') == 'min' else lu1
    hinge_w = c + s * LTH / 2
    hinge = wpt(run, hinge_u, y0, hinge_w)
    leaf = MB(origin=hinge)
    leaf_mat = 'wood_slats' if front else 'door_leaf_white'
    leaf.wbox(run, lu0, lu1, ly0, ly1, c - LTH / 2, c + LTH / 2, leaf_mat)
    # handles (lever both sides / long pull bar outside on the front door)
    far_u = lu1 - 0.07 if hinge_u == lu0 else lu0 + 0.07
    for side in (-1, 1):
        f = c + side * LTH / 2
        if front and side == o['out']:
            leaf.wbox(run, far_u - 0.015, far_u + 0.015, y0 + 0.5, y0 + 1.9, *sorted((f + side * 0.05, f + side * 0.075)), 'handrail_black')
            for yy in (y0 + 0.6, y0 + 1.8):
                leaf.wbox(run, far_u - 0.01, far_u + 0.01, yy - 0.01, yy + 0.01, *sorted((f, f + side * 0.05)), 'handrail_black')
        else:
            hy = y0 + 1.02
            leaf.wbox(run, far_u - 0.03, far_u + 0.03, hy - 0.03, hy + 0.03, *sorted((f, f + side * 0.01)), 'handrail_black')
            dirn = 1 if hinge_u == lu0 else -1   # lever points towards the hinge
            leaf.wbox(run, *sorted((far_u, far_u - dirn * 0.13)), hy - 0.011, hy + 0.011,
                      *sorted((f + side * 0.045, f + side * 0.067)), 'handrail_black')
            leaf.wbox(run, far_u - 0.009, far_u + 0.009, hy - 0.009, hy + 0.009, *sorted((f + side * 0.01, f + side * 0.045)), 'handrail_black')
    col = MB(origin=hinge)
    col.wbox(run, lu0, lu1, ly0, ly1, c - 0.03, c + 0.03, 'door_leaf_white')
    # swing sign about +Y
    d_u = 1 if hinge_u == lu0 else -1
    dvec = wpt(run, d_u, 0, 0)
    nvec = wpt(run, 0, 0, s)
    deriv = (dvec[2], -dvec[0])
    swing = 1 if (deriv[0] * nvec[0] + deriv[1] * nvec[2]) > 0 else -1
    other = o['right'] if o['left'] == swing_room else o['left']
    props = {'type': 'door', 'door_id': o['id'], 'room_a': other or 'exterior', 'room_b': swing_room or '',
             'swing': swing, 'open_angle': DOOR_OPEN, 'default_open': round(swing * DOOR_OPEN, 4), 'width': round(lu1 - lu0, 3)}
    DOORS_META.append(dict(id=o['id'], room_a=other or 'exterior', room_b=swing_room, hinge=[round(v, 4) for v in hinge],
                           width=round(lu1 - lu0, 3), height=round(ly1 - ly0, 3), swing=swing,
                           swing_desc='rotate node DOOR_%s about +Y by swing*angle to open into %s' % (o['id'], swing_room),
                           open_angle=DOOR_OPEN, default_open=round(swing * DOOR_OPEN, 4), default_state='open',
                           level=o['lvl'], front=front, node='DOOR_' + o['id']))
    return hinge, leaf, col, props


DOOR_PARTS = []
for o in OPENINGS:
    if o['type'] in ('window', 'slide'):
        window(o)
    elif o['type'] == 'garage':
        garage_door(o)
    elif o['type'] in ('door', 'front_door'):
        DOOR_PARTS.append((o, door(o)))

# ---------------------------------------------------------------------------------------------
# stair
# ---------------------------------------------------------------------------------------------
ST_BODY, ST_TREAD, RAIL = MB(), MB(), MB()
COL_STAIR, COL_RAIL = MB(), MB()
for st in H.get('stairs', []):
    fl = LEV[st['level']]['floor']
    x0, z0 = st['first_riser']
    dx, dz = st['dir']
    sx, sz = st['side']
    N, Rr, Tt, W = st['risers'], st['riser'], st['tread'], st['width']
    nos, tt = st.get('nosing', 0.02), st.get('tread_thickness', 0.04)

    def P(s, y, w):
        return (x0 + dx * s + sx * w, fl + y, z0 + dz * s + sz * w)
    fwd = (dx, 0, dz)
    back = (-dx, 0, -dz)
    sidev = (sx, 0, sz)
    k = Rr / Tt
    dthk = 0.18 * math.sqrt(1 + k * k)

    def under(s):
        return max(0.0, s * k - dthk)
    s_kink = dthk / k
    run_len = (N - 1) * Tt
    for i in range(1, N):          # N-1 treads
        sa, sb = (i - 1) * Tt, i * Tt
        top = i * Rr - tt
        prev = (i - 1) * Rr - (tt if i > 1 else 0.0)
        # open side face (sawtooth profile)
        prof = [(sa, under(sa))]
        if sa < s_kink < sb:
            prof.append((s_kink, 0.0))
        prof += [(sb, under(sb)), (sb, top), (sa, top)]
        ST_BODY.poly([P(s, y, W) for s, y in prof], 'wall_int', normal=sidev)
        # riser
        ST_BODY.poly([P(sa, prev, 0), P(sa, prev, W), P(sa, top, W), P(sa, top, 0)], 'wall_int', normal=back)
        # tread (oak) with nosing
        ta = sa - nos
        ST_TREAD.poly([P(ta, top + tt, 0), P(sb, top + tt, 0), P(sb, top + tt, W), P(ta, top + tt, W)], 'stair_tread', normal=(0, 1, 0))
        ST_TREAD.poly([P(ta, top, 0), P(ta, top, W), P(ta, top + tt, W), P(ta, top + tt, 0)], 'stair_tread', normal=back)
        ST_TREAD.poly([P(ta, top, W), P(sb, top, W), P(sb, top + tt, W), P(ta, top + tt, W)], 'stair_tread', normal=sidev)
        ST_TREAD.poly([P(ta, top, 0), P(sa, top, 0), P(sa, top, W), P(ta, top, W)], 'stair_tread', normal=(0, -1, 0))
    # sloped soffit + top end
    ST_BODY.poly([P(s_kink, 0, 0), P(run_len, under(run_len), 0), P(run_len, under(run_len), W), P(s_kink, 0, W)],
                 'wall_int', normal=(0, -1, 0))
    ST_BODY.poly([P(run_len, under(run_len), 0), P(run_len, (N - 1) * Rr - tt, 0), P(run_len, (N - 1) * Rr - tt, W),
                  P(run_len, under(run_len), W)], 'wall_int', normal=fwd)
    # --- open-side balustrade: closed stringer, 2 balusters per tread standing ON the tread,
    #     rail from a bottom newel to a top newel below the landing slab (the landing glass takes over)
    def nose_y(s):
        return Rr + s * k
    xn = st.get('rail_newel_x')
    s_new = abs(x0 - xn) if xn is not None else run_len - 0.3
    soffit = LEV[LEVEL_ORDER[LEVEL_ORDER.index(st['level']) + 1]]['floor'] - 0.30 - fl   # slab underside (local)
    # stringer: 20 mm plate on the open side, 60 mm above the nosing line
    sg0, sg1 = W, W + 0.02
    s_a, s_b = -0.02, run_len
    ytop_s = lambda s: min(nose_y(s) + 0.06, soffit)
    s_cap = (soffit - 0.06 - Rr) / k
    prof = [(s_a, 0.0), (s_kink, 0.0), (s_b, under(s_b))]
    if s_cap < s_b:
        prof += [(s_b, soffit), (s_cap, soffit)]
    else:
        prof += [(s_b, ytop_s(s_b))]
    prof += [(s_a, nose_y(s_a) + 0.06)]
    RAIL.poly([P(s, y, sg1) for s, y in prof], 'wall_int', normal=sidev)
    RAIL.poly([P(s, y, sg0) for s, y in prof][::-1], 'wall_int', normal=(-sx, 0, -sz))
    for (pa, pb) in zip(prof, prof[1:] + prof[:1]):
        e = (pb[0] - pa[0], pb[1] - pa[1])
        nrm2 = (e[1], -e[0])
        if abs(e[0]) < 1e-9 and abs(e[1]) < 1e-9:
            continue
        # outward normal in (s,y): pick the side away from the profile centroid
        cxp = sum(p[0] for p in prof) / len(prof)
        cyp = sum(p[1] for p in prof) / len(prof)
        mx, my = (pa[0] + pb[0]) / 2 - cxp, (pa[1] + pb[1]) / 2 - cyp
        if nrm2[0] * mx + nrm2[1] * my < 0:
            nrm2 = (-nrm2[0], -nrm2[1])
        n3 = (dx * nrm2[0], nrm2[1], dz * nrm2[0])
        RAIL.poly([P(pa[0], pa[1], sg0), P(pb[0], pb[1], sg0), P(pb[0], pb[1], sg1), P(pa[0], pa[1], sg1)], 'wall_int', normal=n3)
    # balusters (12 mm square) on the treads, 40 mm in from the open edge
    bw0, bw1 = W - 0.046, W - 0.034
    rail_bot = lambda s: nose_y(s) + 0.90 - 0.04
    for i in range(1, N):
        top = i * Rr
        for f in (0.28, 0.72):
            s = (i - 1) * Tt + f * Tt
            if s <= 0.1:
                continue
            ytop = rail_bot(s) if s < s_new else soffit
            if ytop - top < 0.05:
                continue
            pts = [(s - 0.006, s + 0.006)]
            for (p0, p1) in pts:
                q = lambda ss, yy, ww: P(ss, yy, ww)
                RAIL.poly([q(p0, top, bw1), q(p1, top, bw1), q(p1, ytop, bw1), q(p0, ytop, bw1)], 'handrail_black', normal=sidev)
                RAIL.poly([q(p0, top, bw0), q(p0, ytop, bw0), q(p1, ytop, bw0), q(p1, top, bw0)], 'handrail_black', normal=(-sx, 0, -sz))
                RAIL.poly([q(p0, top, bw0), q(p0, top, bw1), q(p0, ytop, bw1), q(p0, ytop, bw0)], 'handrail_black', normal=back)
                RAIL.poly([q(p1, top, bw0), q(p1, ytop, bw0), q(p1, ytop, bw1), q(p1, top, bw1)], 'handrail_black', normal=fwd)
    # newels (60 mm): bottom one on tread 1, top one at the rail end rising to the slab soffit
    def newel(s, ybot, ytop_):
        a, b = s - 0.03, s + 0.03
        for (pts_, nrm) in (([(a, ybot, W - 0.07), (b, ybot, W - 0.07), (b, ytop_, W - 0.07), (a, ytop_, W - 0.07)], (-sx, 0, -sz)),
                            ([(a, ybot, W - 0.01), (a, ytop_, W - 0.01), (b, ytop_, W - 0.01), (b, ybot, W - 0.01)], sidev),
                            ([(a, ybot, W - 0.07), (a, ytop_, W - 0.07), (a, ytop_, W - 0.01), (a, ybot, W - 0.01)], back),
                            ([(b, ybot, W - 0.07), (b, ybot, W - 0.01), (b, ytop_, W - 0.01), (b, ytop_, W - 0.07)], fwd),
                            ([(a, ytop_, W - 0.07), (b, ytop_, W - 0.07), (b, ytop_, W - 0.01), (a, ytop_, W - 0.01)], (0, 1, 0))):
            RAIL.poly([P(*p) for p in pts_], 'handrail_black', normal=nrm)
    s_bot = 0.06
    newel(s_bot, Rr, rail_bot(s_bot) + 0.07)
    newel(s_new, int(s_new // Tt + 1) * Rr, soffit - 0.001)
    # soffit bar tying the baluster tops beyond the top newel into the landing slab edge
    if s_new < run_len:
        for (pts_, nrm) in (([(s_new, soffit - 0.04, W - 0.07), (run_len, soffit - 0.04, W - 0.07), (run_len, soffit - 0.04, W + 0.02), (s_new, soffit - 0.04, W + 0.02)], (0, -1, 0)),
                            ([(s_new, soffit - 0.04, W - 0.07), (s_new, soffit, W - 0.07), (run_len, soffit, W - 0.07), (run_len, soffit - 0.04, W - 0.07)], (-sx, 0, -sz)),
                            ([(s_new, soffit - 0.04, W + 0.02), (run_len, soffit - 0.04, W + 0.02), (run_len, soffit, W + 0.02), (s_new, soffit, W + 0.02)], sidev)):
            RAIL.poly([P(*p) for p in pts_], 'handrail_black', normal=nrm)
    # rail 50 x 40 mm between the newels
    ra, rb = s_bot + 0.03, s_new - 0.03
    ya0, yb0 = rail_bot(ra), rail_bot(rb)
    ya1, yb1 = ya0 + 0.04, yb0 + 0.04
    hw0, hw1 = W - 0.065, W - 0.015
    RAIL.poly([P(ra, ya1, hw0), P(rb, yb1, hw0), P(rb, yb1, hw1), P(ra, ya1, hw1)], 'handrail_black', normal=(0, 1, 0))
    RAIL.poly([P(ra, ya0, hw0), P(ra, ya0, hw1), P(rb, yb0, hw1), P(rb, yb0, hw0)], 'handrail_black', normal=(0, -1, 0))
    RAIL.poly([P(ra, ya0, hw1), P(ra, ya1, hw1), P(rb, yb1, hw1), P(rb, yb0, hw1)], 'handrail_black', normal=sidev)
    RAIL.poly([P(ra, ya0, hw0), P(rb, yb0, hw0), P(rb, yb1, hw0), P(ra, ya1, hw0)], 'handrail_black', normal=(-sx, 0, -sz))
    # smooth collision ramp: top plane through the nosing line, from the floor to the landing
    land = LEV[LEVEL_ORDER[LEVEL_ORDER.index(st['level']) + 1]]['floor'] - fl
    off = land - k * run_len          # plane through the nosings, meets the landing edge exactly
    ls = -off / k
    a, b = (ls, 0.0), (run_len, land)
    COL_STAIR.poly([P(a[0], a[1], 0), P(b[0], b[1], 0), P(b[0], b[1], W), P(a[0], a[1], W)], 'concrete_screed', normal=(0, 1, 0))
    COL_STAIR.poly([P(a[0], a[1] - 0.15, 0), P(a[0], a[1] - 0.15, W), P(b[0], b[1] - 0.15, W), P(b[0], b[1] - 0.15, 0)], 'concrete_screed', normal=(0, -1, 0))
    COL_STAIR.poly([P(a[0], a[1] - 0.15, W), P(b[0], b[1] - 0.15, W), P(b[0], b[1], W), P(a[0], a[1], W)], 'concrete_screed', normal=sidev)
    COL_STAIR.poly([P(a[0], a[1] - 0.15, 0), P(a[0], a[1], 0), P(b[0], b[1], 0), P(b[0], b[1] - 0.15, 0)], 'concrete_screed', normal=(-sx, 0, -sz))
    # side guard collider along the open side (up to the slab soffit)
    g0, g1 = W - 0.07, W + 0.02
    s_c = min(run_len, (soffit - 0.95 - Rr) / k)
    poly2 = [(0.3, 0.0), (run_len, 0.0), (run_len, soffit), (s_c, soffit), (0.3, nose_y(0.3) + 0.95)]
    COL_RAIL.poly([P(s, y, g1) for s, y in poly2], 'glass', normal=sidev)
    COL_RAIL.poly([P(s, y, g0) for s, y in poly2][::-1], 'glass', normal=(-sx, 0, -sz))
    COL_RAIL.poly([P(0.3, nose_y(0.3) + 0.95, g0), P(0.3, nose_y(0.3) + 0.95, g1), P(s_c, soffit, g1), P(s_c, soffit, g0)], 'glass', normal=(0, 1, 0))
    COL_RAIL.poly([P(0.3, 0, g0), P(0.3, 0, g1), P(0.3, nose_y(0.3) + 0.95, g1), P(0.3, nose_y(0.3) + 0.95, g0)], 'glass', normal=back)


# ---------------------------------------------------------------------------------------------
# balustrades (glass)
# ---------------------------------------------------------------------------------------------
BAL_FR = MB()
COL_BAL = MB()
for bl in H.get('balustrades', []):
    fl = LEV[bl['level']]['floor']
    hgt = bl.get('height', 1.0)
    pts = bl['path']
    for (ax_, az_), (bx_, bz_) in zip(pts[:-1], pts[1:]):
        run = 'x' if abs(az_ - bz_) < 1e-6 else 'z'
        c = az_ if run == 'x' else ax_
        ua, ub = sorted((ax_, bx_) if run == 'x' else (az_, bz_))
        # base shoe (black), glass in 1.2 m panels, optional slim top rail
        BAL_FR.wbox(run, ua - 0.03, ub + 0.03, fl, fl + 0.10, c - 0.03, c + 0.03, 'handrail_black', skip=('-y',))
        npan = max(1, int(math.ceil((ub - ua) / 1.25)))
        for k in range(npan):
            g0 = ua + (ub - ua) * k / npan + (0.005 if k > 0 else 0.0)
            g1 = ua + (ub - ua) * (k + 1) / npan - (0.005 if k < npan - 1 else 0.0)
            GL.wbox(run, g0, g1, fl + 0.10, fl + hgt - (0.04 if bl['type'] == 'glass_rail' else 0.0), c - 0.008, c + 0.008, 'glass')
        if bl['type'] == 'glass_rail':
            BAL_FR.wbox(run, ua - 0.02, ub + 0.02, fl + hgt - 0.045, fl + hgt, c - 0.02, c + 0.02, 'handrail_black')
        COL_BAL.wbox(run, ua - 0.03, ub + 0.03, fl, fl + hgt + 0.05, c - 0.04, c + 0.04, 'glass')

# ---------------------------------------------------------------------------------------------
# roofs (hip, standing seam)
# ---------------------------------------------------------------------------------------------
ROOF = MB()
SEAMS = MB()
for rf in H.get('roofs', []):
    if rf['type'] != 'hip':
        continue
    x0, z0, x1, z1 = rect_b(rf['outline'])
    base, t = rf['base'], rf.get('thickness', 0.18)
    tp = math.tan(math.radians(rf.get('pitch', 12)))
    yE = base + t
    along_x = (x1 - x0) >= (z1 - z0)
    if along_x:
        hd = (z1 - z0) / 2
        zc = (z0 + z1) / 2
        r1, r2 = (x0 + hd, yE + hd * tp, zc), (x1 - hd, yE + hd * tp, zc)
    else:
        hd = (x1 - x0) / 2
        xc = (x0 + x1) / 2
        r1, r2 = (xc, yE + hd * tp, z0 + hd), (xc, yE + hd * tp, z1 - hd)
    c00, c10, c11, c01 = (x0, yE, z0), (x1, yE, z0), (x1, yE, z1), (x0, yE, z1)
    up = (0, 1, 0)
    if along_x:
        slopes = [([c00, c10, r2, r1], (0, 0, -1)), ([c11, c01, r1, r2], (0, 0, 1)), ([c01, c00, r1], (-1, 0, 0)), ([c10, c11, r2], (1, 0, 0))]
    else:
        slopes = [([c00, c01, r2, r1][::-1], (-1, 0, 0)), ([c10, c11, r2, r1], (1, 0, 0)), ([c00, c10, r1], (0, 0, -1)), ([c11, c01, r2], (0, 0, 1))]
    for poly_, out in slopes:
        ROOF.poly(poly_, 'roof_standing_seam', normal=(out[0], 1, out[2]))
    ROOF.poly([(x0, base, z0), (x1, base, z0), (x1, base, z1), (x0, base, z1)], 'roof_standing_seam', normal=(0, -1, 0))
    for (p, q, out) in (((x0, z0), (x1, z0), (0, 0, -1)), ((x1, z0), (x1, z1), (1, 0, 0)), ((x1, z1), (x0, z1), (0, 0, 1)), ((x0, z1), (x0, z0), (-1, 0, 0))):
        ROOF.poly([(p[0], base, p[1]), (q[0], base, q[1]), (q[0], yE, q[1]), (p[0], yE, p[1])], 'roof_standing_seam', normal=out)
    # ridge cap
    if along_x:
        ROOF.box(r1[0] - 0.05, r2[0] + 0.05, r1[1] - 0.01, r1[1] + 0.035, zc - 0.07, zc + 0.07, 'roof_standing_seam', skip=('-y',))
    else:
        ROOF.box(xc - 0.07, xc + 0.07, r1[1] - 0.01, r1[1] + 0.035, r1[2] - 0.05, r2[2] + 0.05, 'roof_standing_seam', skip=('-y',))
    # standing seams perpendicular to each eave
    sp = rf.get('seam_spacing', 0.5)
    edges = [((x0, z0), (x1, z0), (0, 1)), ((x1, z1), (x0, z1), (0, -1)), ((x0, z1), (x0, z0), (1, 0)), ((x1, z0), (x1, z1), (-1, 0))]
    for (e0, e1, m) in edges:
        L = math.hypot(e1[0] - e0[0], e1[1] - e0[1])
        ex, ez = (e1[0] - e0[0]) / L, (e1[1] - e0[1]) / L
        u = sp / 2
        while u < L - 0.05:
            ext = min(u, L - u, hd) - 0.03
            if ext > 0.12:
                bx_, bz_ = e0[0] + ex * u, e0[1] + ez * u
                SW, SH = 0.012, 0.028

                def sp_(dist, off, h):
                    return (bx_ + m[0] * dist + ex * off, yE + dist * tp + h, bz_ + m[1] * dist + ez * off)
                d1 = ext
                side_a = (-ex, 0, -ez)
                side_b = (ex, 0, ez)
                SEAMS.poly([sp_(0, -SW, -0.005), sp_(d1, -SW, -0.005), sp_(d1, -SW, SH), sp_(0, -SW, SH)], 'roof_standing_seam', normal=side_a)
                SEAMS.poly([sp_(0, SW, -0.005), sp_(0, SW, SH), sp_(d1, SW, SH), sp_(d1, SW, -0.005)], 'roof_standing_seam', normal=side_b)
                SEAMS.poly([sp_(0, -SW, SH), sp_(d1, -SW, SH), sp_(d1, SW, SH), sp_(0, SW, SH)], 'roof_standing_seam', normal=up)
                SEAMS.poly([sp_(0, -SW, -0.005), sp_(0, -SW, SH), sp_(0, SW, SH), sp_(0, SW, -0.005)], 'roof_standing_seam', normal=(-m[0], 0, -m[1]))
            u += sp

# ---------------------------------------------------------------------------------------------
# larch slats (instanced boards)
# ---------------------------------------------------------------------------------------------
SLAT_GROUPS = {}   # (group, dims) -> list of centres


def slat(group, dims, centre):
    SLAT_GROUPS.setdefault((group, tuple(round(d, 3) for d in dims)), []).append(centre)


SCREEN = MB()
for cl in H.get('cladding', []):
    if cl['type'] in ('slats', 'screen'):
        run = 'x' if cl['axis'] == 'z' else 'z'   # cladding on a plane of constant z runs along x
        plane, nrm = cl['plane'], cl['normal']
        u0, u1 = cl['u']
        y0, y1 = cl['y']
        if cl['type'] == 'slats' and cl.get('orient') == 'h':
            # horizontal larch boards 60 mm high, 15 mm gaps, on 22 mm battens; cut around openings
            BH, BG, DEP, OFF = 0.06, 0.015, 0.022, 0.022
            wa, wb = sorted((plane + nrm * OFF, plane + nrm * (OFF + DEP)))
            cuts = [(o['u0'] - 0.03, o['u1'] + 0.03, o['y0'] - 0.03, o['y1'] + 0.03) for o in OPENINGS
                    if o['run'] == run and o['exterior'] and abs((o['c'] + o['out'] * o['t'] / 2) - plane) < 0.02]
            nrow = int((y1 - y0 - 0.02) // (BH + BG))
            for r_ in range(nrow):
                b0 = y0 + 0.01 + r_ * (BH + BG)
                b1 = b0 + BH
                segs = [(u0, u1)]
                for cu in cuts:
                    if b1 > cu[2] and b0 < cu[3]:
                        nsegs = []
                        for (s0, s1) in segs:
                            if s1 <= cu[0] or s0 >= cu[1]:
                                nsegs.append((s0, s1)); continue
                            if cu[0] - s0 > 0.05: nsegs.append((s0, cu[0]))
                            if s1 - cu[1] > 0.05: nsegs.append((cu[1], s1))
                        segs = nsegs
                for (s0, s1) in segs:
                    cen = wpt(run, (s0 + s1) / 2, (b0 + b1) / 2, (wa + wb) / 2)
                    dims = (s1 - s0, BH, DEP) if run == 'x' else (DEP, BH, s1 - s0)
                    slat(cl['id'], dims, cen)
            continue
        if cl['type'] == 'slats':
            SWd, GAP, DEP, OFF = 0.04, 0.02, 0.028, 0.022
        else:
            SWd, GAP, DEP, OFF = 0.04, 0.03, 0.045, cl.get('offset', 0.12)
        pitch = SWd + GAP
        wa, wb = sorted((plane + nrm * OFF, plane + nrm * (OFF + DEP)))
        # openings in this wall plane cut the boards
        cuts = []
        for o in OPENINGS:
            if cl['type'] == 'slats' and o['run'] == run and o['exterior'] and abs((o['c'] + o['out'] * o['t'] / 2) - plane) < 0.02:
                cuts.append((o['u0'] - 0.05, o['u1'] + 0.05, o['y0'] - 0.02, o['y1'] + 0.05))
        n = int((u1 - u0 - GAP) // pitch)
        start = u0 + (u1 - u0 - (n * pitch - GAP)) / 2
        for k in range(n):
            a = start + k * pitch
            b = a + SWd
            segs = [(y0 + 0.01, y1 - 0.01)]
            for cu in cuts:
                if b > cu[0] and a < cu[1]:
                    nsegs = []
                    for (s0, s1) in segs:
                        if s1 <= cu[2] or s0 >= cu[3]:
                            nsegs.append((s0, s1))
                            continue
                        if cu[2] - s0 > 0.05: nsegs.append((s0, cu[2]))
                        if s1 - cu[3] > 0.05: nsegs.append((cu[3], s1))
                    segs = nsegs
            for (s0, s1) in segs:
                cu_ = (a + b) / 2
                cw = (wa + wb) / 2
                cen = wpt(run, cu_, (s0 + s1) / 2, cw)
                dims = (SWd, s1 - s0, DEP) if run == 'x' else (DEP, s1 - s0, SWd)
                slat(cl['id'], dims, cen)
        if cl['type'] == 'screen':
            # black rails top/bottom + wall brackets
            for yy in (y0 - 0.04, y1):
                SCREEN.wbox(run, u0, u1, yy, yy + 0.04, wa, wb, 'handrail_black')
            for uu in (u0 + 0.1, u1 - 0.14):
                for yy in (y0 - 0.04, y1):
                    br = sorted((plane, wa if nrm > 0 else wb))
                    SCREEN.wbox(run, uu, uu + 0.04, yy, yy + 0.04, br[0], br[1], 'handrail_black', skip=('-w' if nrm > 0 else '+w',))
    elif cl['type'] == 'soffit_slats':
        x0_, z0_, x1_, z1_ = rect_b(cl['rect'])
        ys = cl['y']
        x0_ += 0.06   # clear the wall slats
        z0_ += 0.06
        pitch = 0.06
        n = int((z1_ - z0_) // pitch)
        for k in range(n):
            za = z0_ + k * pitch + 0.01
            slat(cl['id'], (x1_ - x0_ - 0.01, 0.02, 0.04), ((x0_ + x1_) / 2, ys - 0.025, za + 0.02))

# ---------------------------------------------------------------------------------------------
# driveway (sloped pavers)
# ---------------------------------------------------------------------------------------------
DRIVE = MB()
COL_DRIVE = MB()
for a in EXT_AREAS:
    if 'y_far' in a.d:
        x0, z0, x1, z1 = a.rects[0]
        yn, yf = a.y, a.d['y_far']
        top = [(x0, yn, z0), (x1, yf, z0), (x1, yf, z1), (x0, yn, z1)]
        DRIVE.poly(top, a.floor, normal=(0, 1, 0))
        for (p, q, nrm) in (((x0, z0), (x1, z0), (0, 0, -1)), ((x1, z1), (x0, z1), (0, 0, 1)), ((x1, z0), (x1, z1), (1, 0, 0))):
            yp = yn if abs(p[0] - x0) < 1e-6 else yf
            yq = yn if abs(q[0] - x0) < 1e-6 else yf
            DRIVE.poly([(p[0], yp - 0.2, p[1]), (q[0], yq - 0.2, q[1]), (q[0], yq, q[1]), (p[0], yp, p[1])], 'concrete_screed', normal=nrm)
        COL_DRIVE.poly(top, a.floor, normal=(0, 1, 0))

# ---------------------------------------------------------------------------------------------
# create objects
# ---------------------------------------------------------------------------------------------
log('creating objects')
for name in sorted(GROUPS):
    kind = name.split('_')[0]
    props = {'kind': kind}
    if kind in ('SURF', 'CEIL', 'WALL'):
        rid = name.split('_', 1)[1]
        if kind == 'SURF':
            mat = GROUPS[name].mats[0]
            rid = name[len('SURF_' + mat + '_'):]
            props['surface'] = mat
        props['room'] = rid
        rm = ROOM_BY_ID.get(rid)
        if rm:
            props['level'] = rm.level
    make_obj(name, GROUPS[name], props=props)
make_obj('SKIRTING', SK, props={'kind': 'trim'})
make_obj('PANELS_anthracite', PANEL, props={'kind': 'facade'})
make_obj('FRAMES', FR, props={'kind': 'frames'})
make_obj('GLASS', GL, props={'kind': 'glass'})
make_obj('LARCH_surrounds', LARCH, props={'kind': 'facade'})
make_obj('TRIM_door_frames', DOORFR, props={'kind': 'trim'})
make_obj('GARAGE_DOOR', GARAGE, props={'kind': 'garage_door'})
make_obj('STAIR_body', ST_BODY, props={'kind': 'stair'})
make_obj('SURF_stair_tread_stair', ST_TREAD, props={'kind': 'SURF', 'surface': 'stair_tread', 'room': 'hall'})
make_obj('STAIR_balustrade', RAIL, props={'kind': 'stair'})
make_obj('BALUSTRADE_frames', BAL_FR, props={'kind': 'balustrade'})
make_obj('ROOF_hip', ROOF, props={'kind': 'roof'})
make_obj('ROOF_seams', SEAMS, props={'kind': 'roof'})
make_obj('SLAT_SCREEN_rails', SCREEN, props={'kind': 'facade'})
make_obj('SURF_concrete_pavers_driveway', DRIVE, props={'kind': 'SURF', 'surface': 'concrete_pavers', 'room': 'driveway'})

# instanced slats: one mesh per board size, objects parented to an empty (-> EXT_mesh_gpu_instancing)
n_slats = 0
for gi, ((group, dims), centres) in enumerate(sorted(SLAT_GROUPS.items())):
    mb = MB()
    dx_, dy_, dz_ = dims
    mb.box(-dx_ / 2, dx_ / 2, -dy_ / 2, dy_ / 2, -dz_ / 2, dz_ / 2, 'wood_slats')
    me_ob = make_obj('slat_%s_%d' % (group, gi), mb, props={'kind': 'slat'})
    me = me_ob.data
    COLL.objects.unlink(me_ob)
    bpy.data.objects.remove(me_ob)
    STATS['objects'] -= 1
    STATS['tris'] -= mb.tris()
    root = make_empty('SLATS_%s_%d' % (group, gi), (0, 0, 0), props={'kind': 'slats', 'instances': len(centres)})
    for k, cen in enumerate(centres):
        ob = bpy.data.objects.new('slat_%s_%d_%d' % (group, gi, k), me)
        COLL.objects.link(ob)
        ob.parent = root
        ob.location = B(cen)
        n_slats += 1
    STATS['tris'] += mb.tris() * len(centres)
log('slats', n_slats, 'in', len(SLAT_GROUPS), 'instanced groups')

# doors
for o, (hinge, leaf, col, props) in DOOR_PARTS:
    piv = make_empty('DOOR_' + o['id'], hinge, props=props, size=0.3)
    leaf_ob = make_obj('LEAF_%s' % o['id'], leaf, parent=piv, props={'kind': 'door_leaf', 'door_id': o['id']})
    col_ob = make_obj('COL_DOOR_' + o['id'], col, parent=leaf_ob, uv=False, props={'kind': 'collision', 'door_id': o['id']})
    # exported OPEN (house walkable before P09 animates doors): node rotation about +Y = swing * DOOR_OPEN
    piv.rotation_mode = 'XYZ'
    piv.rotation_euler[2] = props['swing'] * DOOR_OPEN
SLIDES_META = []
for o, mb, props in SLIDES:
    ob = make_obj('SLIDE_' + o['id'], mb, props=props)
    SLIDES_META.append(dict(id=o['id'], node='SLIDE_' + o['id'], axis=props['axis'], closed_offset=props['closed_offset'],
                            state='open', open_range=o.get('open_range'), collider='COL_glass_slide_' + o['id']))

# ---------------------------------------------------------------------------------------------
# collision
# ---------------------------------------------------------------------------------------------
log('building collision solid')
VC = structure_vox(for_collision=True)
CF = VC.faces(lambda axis, sign, plane, c, tag: 'COL')
COL = MB()
for rects in CF.values():
    for (axis, sign, plane, a0, a1, b0, b1) in rects:
        COL.poly(rect_quad(axis, sign, plane, a0, a1, b0, b1), 'concrete_screed')
colprops = {'kind': 'collision'}
make_obj('COL_structure', COL, uv=False, props=colprops)
make_obj('COL_stair', COL_STAIR, uv=False, props=dict(colprops, surface='stair_tread'))
make_obj('COL_glass_stair_rail', COL_RAIL, uv=False, props=colprops)
make_obj('COL_glass_balustrade', COL_BAL, uv=False, props=colprops)
make_obj('COL_driveway', COL_DRIVE, uv=False, props=colprops)
# invisible ramps through the nosings of exterior steps (smooth capsule walking over risers)
COL_RAMP = MB()
for rp in H.get('structure', {}).get('col_ramps', []):
    a0, ya, a1, yb = rp['slope']
    s0, s1 = rp['span']
    if rp['axis'] == 'x':
        pts = [(a0, ya, s0), (a1, yb, s0), (a1, yb, s1), (a0, ya, s1)]
    else:
        pts = [(s0, ya, a0), (s1, ya, a0), (s1, yb, a1), (s0, yb, a1)]
    COL_RAMP.poly(pts, 'concrete_screed', normal=(0, 1, 0))
make_obj('COL_ramps', COL_RAMP, uv=False, props=dict(colprops, surface='concrete_screed'))
for gid, mb in COL_GLASS.items():
    make_obj('COL_glass_' + gid, mb, uv=False, props=colprops)
for ob in COLL.objects:
    if ob.name.startswith('COL_') and ob.type == 'MESH':
        for m in list(ob.data.materials):
            pass
        ob.data.materials.clear()
        ob.hide_render = True
        ob.display_type = 'WIRE'

# ---------------------------------------------------------------------------------------------
# rooms, lights, spawn
# ---------------------------------------------------------------------------------------------
ROOMS_META = []
for r in ROOMS + EXT_AREAS:
    lvl_floor = r.y if r.exterior else LEV[r.level]['floor']
    mr = r.main_rect()
    cen = ((mr[0] + mr[2]) / 2, lvl_floor, (mr[1] + mr[3]) / 2)
    area = r.plan_area()
    for v in VOIDS:
        if v['level'] == r.level and not r.exterior:
            b = v['b']
            for rc in r.rects:
                ix = max(0, min(rc[2], b[2]) - max(rc[0], b[0]))
                iz = max(0, min(rc[3], b[3]) - max(rc[1], b[1]))
                area -= ix * iz
    bx = r.bounds()
    ceil_y = (LEV[r.level]['ceil'] if not r.exterior else lvl_floor + 2.6)
    meta = dict(id=r.id, name=r.name, level=r.level, center=[round(v, 3) for v in cen], area=round(area, 2),
                area_src=r.area_src, floor=r.floor, exterior=r.exterior,
                bounds=[[round(bx[0], 3), round(lvl_floor, 3), round(bx[1], 3)], [round(bx[2], 3), round(ceil_y, 3), round(bx[3], 3)]],
                rects=[[round(v, 3) for v in (rc[0], rc[1], rc[2] - rc[0], rc[3] - rc[1])] for rc in r.rects])
    ROOMS_META.append(meta)
    make_empty('ROOM_' + r.id, cen, props={'kind': 'room', 'room_id': r.id, 'level': r.level, 'name': r.name,
                                            'area': round(area, 2), 'exterior': r.exterior, 'floor': r.floor})

LIGHTS_META = []
lcfg = H.get('lighting', {})
grid = lcfg.get('downlight_grid', 1.5)
single = set(lcfg.get('single_light_rooms', []))
fixture_rooms = {f['room'] for f in lcfg.get('fixtures', []) if f['type'] == 'strip'}


def add_light(lid_, typ, pos, room, extra=None):
    props = {'kind': 'light', 'type': typ, 'room': room}
    if extra:
        props.update(extra)
    make_empty('LIGHT_' + lid_, pos, props=props, size=0.12)
    m = dict(id=lid_, type=typ, pos=[round(v, 3) for v in pos], room=room)
    if extra:
        m.update(extra)
    LIGHTS_META.append(m)


for r in ROOMS:
    cy = LEV[r.level]['ceil'] - 0.01
    if r.id in fixture_rooms:
        continue
    if r.id in single:
        mr = r.main_rect()
        add_light('%s_1' % r.id, 'ceiling', ((mr[0] + mr[2]) / 2, cy, (mr[1] + mr[3]) / 2), r.id)
        continue
    n = 0
    for rc in r.rects:
        ix0, iz0, ix1, iz1 = rc[0] + 0.1, rc[1] + 0.1, rc[2] - 0.1, rc[3] - 0.1
        nx_, nz_ = max(1, int(round((ix1 - ix0) / grid))), max(1, int(round((iz1 - iz0) / grid)))
        for i in range(nx_):
            for j in range(nz_):
                px = ix0 + (ix1 - ix0) * (i + 0.5) / nx_
                pz = iz0 + (iz1 - iz0) * (j + 0.5) / nz_
                below_void = any(in_void(lv, px, pz) for lv in LEVEL_ORDER)
                if below_void:
                    continue
                n += 1
                add_light('%s_%d' % (r.id, n), 'downlight', (px, cy, pz), r.id)
for f in lcfg.get('fixtures', []):
    extra = {k: v for k, v in f.items() if k not in ('id', 'type', 'pos', 'room')}
    add_light(f['id'], f['type'], tuple(f['pos']), f['room'], extra)

sp = H.get('spawn', {'pos': [0, 0, 0], 'yaw': 0})
make_empty('SPAWN', tuple(sp['pos']), props={'kind': 'spawn', 'yaw': sp['yaw'], 'room': sp.get('room', '')}, size=0.5)

# ---------------------------------------------------------------------------------------------
# export
# ---------------------------------------------------------------------------------------------
os.makedirs(OUT_DIR, exist_ok=True)
glb = os.path.join(OUT_DIR, 'house.glb')
allx = [p[0] for mb in GROUPS.values() for p in mb.v] + [p[0] for p in ROOF.v]
ally = [p[1] for mb in GROUPS.values() for p in mb.v] + [p[1] for p in ROOF.v]
allz = [p[2] for mb in GROUPS.values() for p in mb.v] + [p[2] for p in ROOF.v]
bounds = [[round(min(allx), 3), round(min(ally), 3), round(min(allz), 3)], [round(max(allx), 3), round(max(ally), 3), round(max(allz), 3)]]
bpy.context.scene['house_id'] = HOUSE_ID
log('exporting', glb)
bpy.ops.export_scene.gltf(filepath=glb, export_format='GLB', export_yup=True, export_extras=True,
                          export_texcoords=True, export_normals=True, export_materials='EXPORT',
                          export_image_format='NONE', export_gpu_instances=True, export_cameras=False,
                          export_lights=False, export_animations=False, use_selection=False, export_apply=False)
meta = dict(
    id=HOUSE_ID, name=H.get('name'), generated_by='pipeline/blender/build_house.py',
    coords='X east, Y up, Z south; metres; glTF Y-up (same as house.json)',
    levels=[dict(id=l, floor=LEV[l]['floor'], ceil=LEV[l]['ceil']) for l in LEVEL_ORDER],
    grade_y=GRADE,
    rooms=ROOMS_META, doors=DOORS_META, lights=LIGHTS_META, slides=SLIDES_META,
    openings=[dict(id=o['id'], type=o['type'], level=o['lvl'], run=o['run'], wall_c=o['c'], wall_t=o['t'], out=o['out'],
                   face_out=round(o['c'] + o['out'] * o['t'] / 2, 4) if o['exterior'] else None,
                   u=[o['u0'], o['u1']], y=[o['y0'], o['y1']], open_range=o.get('open_range')) for o in OPENINGS],
    spawn=dict(pos=sp['pos'], yaw=sp['yaw'], room=sp.get('room'), eye_height=1.65,
               note='pos is the floor point under the player; yaw 0 = -Z (north), 90 = -X (west)'),
    bounds=bounds,
    materials=sorted(MATS.keys()),
    node_conventions=dict(
        SURF='SURF_<material>_<room>: walkable surfaces, footstep material = <material>',
        WALL='WALL_<room>: interior wall faces (incl. reveals) of that room, material wall_int',
        CEIL='CEIL_<room>: ceiling of that room',
        EXT='EXT_<material>: exterior facade / roof / soffit faces',
        DOOR='DOOR_<id>: empty at hinge (y = floor); child LEAF_<id> (mesh); grandchild COL_DOOR_<id>; rotate about +Y by swing*angle',
        COL='COL_*: invisible collision meshes (no material) - hide at runtime',
        SLATS='SLATS_*: EXT_mesh_gpu_instancing boards (larch)',
        ROOM='ROOM_<id>: empty at room centre on the floor, extras {room_id, level, name, area}',
        LIGHT='LIGHT_<id>: empty, extras {type: downlight|ceiling|pendant|cove|strip|sconce, room}'),
    stats=dict(objects=STATS['objects'], triangles_est=STATS['tris'], slats=n_slats))
with open(os.path.join(OUT_DIR, 'house.meta.json'), 'w', encoding='utf-8') as fh:
    json.dump(meta, fh, indent=1)
if SAVE_BLEND:
    bpy.ops.wm.save_as_mainfile(filepath=os.path.join(ROOT, 'pipeline', 'blender', 'out', HOUSE_ID + '.blend'))
log('done: objects %d, ~tris %d, rooms %d, doors %d, lights %d, size %.2f MB' % (
    STATS['objects'], STATS['tris'], len(ROOMS_META), len(DOORS_META), len(LIGHTS_META), os.path.getsize(glb) / 1e6))
