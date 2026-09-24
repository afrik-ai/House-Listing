"""
HouseListing - exterior detail builder (P03).

    blender.exe -b --factory-startup --python pipeline/blender/exterior_build.py -- <house-id>

Reads houses/<id>/house.json (the same spec P02's build_house.py uses) and writes
    public/assets/houses/<id>/exterior_detail.glb
ADDITIVE facade detail laid over P02's shell, in the same house coordinates (X east, Y up, Z south):
  * copings with drip lips on every flat-roof parapet, white fascia bands with fine panel joints,
  * aluminium edge trim + white fascia + larch beams on elevated slabs (pergola),
  * drip edges on hip-roof eaves, flashings where hip roofs abut walls, hip caps,
  * horizontal larch slats (+ black battens) on 'slats' cladding (entrance recess),
  * larch window surrounds with the grain running along each piece,
  * glazing beads on windows, slim top channel on frameless glass balustrades,
  * flush sectional garage-door skin with fine horizontal grooves,
  * square black up/down wall lights (lens + wall-wash quads) at every exterior sconce and beside the garage door.
Nothing here is structural: no collision, no rooms. Replacements of shell parts are declared in the root node's
extras (`replaces`) and applied at runtime by src/game/plugins/20_exterior.js only while the shell part still
needs replacing (see docs/CONTRACTS.md, P03 section).
All materials are named for the registry (src/game/materials/exterior.js): shell names (wood_slats, frames,
handrail_black) or EXT_*.
"""
import bpy, bmesh, json, math, os, sys, time, random

T0 = time.time()
HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..', '..'))
ARGV = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
HOUSE_ID = next((a for a in ARGV if not a.startswith('--')), 'villa-nova')
H = json.load(open(os.path.join(ROOT, 'houses', HOUSE_ID, 'house.json'), encoding='utf-8'))
OUT_DIR = os.path.join(ROOT, 'public', 'assets', 'houses', HOUSE_ID)
EPS = 1e-6
RNG = random.Random(7)


def log(*a):
    print('[exterior_build %6.2fs]' % (time.time() - T0), *a, flush=True)


def R(v):
    return round(float(v), 4)


# ---------------------------------------------------------------------------------------------
# per-house options (everything else is derived from house.json)
# ---------------------------------------------------------------------------------------------
OPTS = {
    'coping_overhang': 0.04, 'coping_t': 0.025, 'coping_lip': 0.05,
    'fascia_t': 0.012, 'fascia_band': 0.5, 'fascia_panel': 2.4, 'joint_w': 0.006,
    'slat_board': 0.040, 'slat_gap': 0.020, 'slat_off': 0.022, 'slat_depth': 0.028, 'batten_spacing': 0.6,
    'beam_w': 0.07, 'beam_d': 0.16, 'beam_spacing': 0.55,
    'lamp': (0.10, 0.20, 0.10),          # width along wall, height, depth
    'garage_lights': True,
    # vertical larch screens in front of openings: (opening id, extra u each side, extra y below/above, offset from wall)
    'screens': [{'opening': 'W_kitchen_s', 'pad_u': (0.30, 0.20), 'pad_y': (0.20, 0.20), 'offset': 0.14}],
}

# ---------------------------------------------------------------------------------------------
# spec
# ---------------------------------------------------------------------------------------------
LEVEL_ORDER = [l['id'] for l in H['levels']]
LEV = {}
for l in H['levels']:
    LEV[l['id']] = dict(floor=l['elevation'], clear=l['clear_height'], slab=l['slab'],
                        ceil=l['elevation'] + l['clear_height'])
T_EXT = H['walls']['exterior']
HALF = T_EXT / 2
FOUND_BOTTOM = H.get('structure', {}).get('foundation_bottom', -0.6)
GRADE = H.get('site', {}).get('grade_y', 0.0)


def rect_b(rc):
    x, z, w, d = rc
    return (R(x), R(z), R(x + w), R(z + d))


def rects_of(d):
    return [rect_b(r) for r in (d.get('rects') or [d['rect']])]


ROOMS = {lid: [(d['id'], rects_of(d)) for d in H.get(lid + '_rooms', [])] for lid in LEVEL_ORDER}


def level_top(i):
    lid = LEVEL_ORDER[i]
    return LEV[LEVEL_ORDER[i + 1]]['floor'] if i + 1 < len(LEVEL_ORDER) else LEV[lid]['ceil'] + LEV[lid]['slab']


def room_at(lid, x, z):
    for rid, rs in ROOMS.get(lid, []):
        for r in rs:
            if r[0] + EPS < x < r[2] - EPS and r[1] + EPS < z < r[3] - EPS:
                return rid
    return None


def expand(r, e):
    return (r[0] - e, r[1] - e, r[2] + e, r[3] + e)


# ---------------------------------------------------------------------------------------------
# 2D rect-set algebra on a non-uniform grid (used for rings around unions of boxes)
# ---------------------------------------------------------------------------------------------
class Cells:
    """A set of plan cells = (union of `add` rects) minus (union of `sub` rects)."""

    def __init__(self, add, sub=()):
        add = [r for r in add if r[2] - r[0] > EPS and r[3] - r[1] > EPS]
        sub = [r for r in sub if r[2] - r[0] > EPS and r[3] - r[1] > EPS]
        xs = sorted({R(v) for r in add + sub for v in (r[0], r[2])})
        zs = sorted({R(v) for r in add + sub for v in (r[1], r[3])})
        self.xs, self.zs = xs, zs
        nx, nz = max(0, len(xs) - 1), max(0, len(zs) - 1)

        def inside(rs, x, z):
            return any(r[0] < x < r[2] and r[1] < z < r[3] for r in rs)
        self.F = [[False] * nz for _ in range(nx)]
        for i in range(nx):
            cx = (xs[i] + xs[i + 1]) / 2
            if xs[i + 1] - xs[i] < 1e-5:
                continue
            for j in range(nz):
                if zs[j + 1] - zs[j] < 1e-5:
                    continue
                cz = (zs[j] + zs[j + 1]) / 2
                self.F[i][j] = inside(add, cx, cz) and not inside(sub, cx, cz)
        self.nx, self.nz = nx, nz

    def filled(self, i, j):
        return 0 <= i < self.nx and 0 <= j < self.nz and self.F[i][j]

    def rects(self):
        """greedy merge -> [(x0,z0,x1,z1)]"""
        used = [[False] * self.nz for _ in range(self.nx)]
        out = []
        for i in range(self.nx):
            for j in range(self.nz):
                if not self.F[i][j] or used[i][j]:
                    continue
                j2 = j + 1
                while j2 < self.nz and self.F[i][j2] and not used[i][j2]:
                    j2 += 1
                i2 = i + 1
                while i2 < self.nx and all(self.F[i2][q] and not used[i2][q] for q in range(j, j2)):
                    i2 += 1
                for a in range(i, i2):
                    for q in range(j, j2):
                        used[a][q] = True
                out.append((self.xs[i], self.zs[j], self.xs[i2], self.zs[j2]))
        return out

    def boundary(self):
        """merged boundary runs: [(run, c, a, b, n)] run 'z' = edge at x=c along z (n=+1 -> filled side is -x ...)
        n = outward normal sign along the perpendicular axis."""
        units = []
        for i in range(self.nx + 1):
            for j in range(self.nz):
                a, b = self.filled(i - 1, j), self.filled(i, j)
                if a != b:
                    units.append(('z', self.xs[i], self.zs[j], self.zs[j + 1], 1 if a else -1))
        for j in range(self.nz + 1):
            for i in range(self.nx):
                a, b = self.filled(i, j - 1), self.filled(i, j)
                if a != b:
                    units.append(('x', self.zs[j], self.xs[i], self.xs[i + 1], 1 if a else -1))
        units.sort(key=lambda u: (u[0], u[1], u[4], u[2]))
        runs = []
        for u in units:
            w = runs[-1] if runs else None
            if w and w[0] == u[0] and abs(w[1] - u[1]) < EPS and w[4] == u[4] and abs(w[3] - u[2]) < EPS:
                runs[-1] = (w[0], w[1], w[2], u[3], w[4])
            else:
                runs.append(u)
        return runs


def union_boundary(rects):
    """outline runs of a union of plan rects (no subtraction)"""
    return Cells(rects).boundary()


# ---------------------------------------------------------------------------------------------
# mesh builder (house coordinates, explicit UVs)
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


def grain_uv(p, n, grain, off):
    """UV with v running along the grain axis (0=x,1=y,2=z); u along the other in-plane axis."""
    ax = max(range(3), key=lambda i: abs(n[i]))
    if ax == grain:
        u, v = box_uv(p, n)
        return (u + off[0], v + off[1])
    other = [k for k in range(3) if k not in (ax, grain)][0]
    return (p[other] + off[0], p[grain] + off[1])


class MB:
    def __init__(self):
        self.v, self.f, self.m, self.uv, self.mats = [], [], [], [], []

    def mi(self, name):
        if name not in self.mats:
            self.mats.append(name)
        return self.mats.index(name)

    def poly(self, pts, mat, normal=None, uvs=None, grain=None, off=(0.0, 0.0)):
        n = newell(pts)
        ln = math.sqrt(n[0] ** 2 + n[1] ** 2 + n[2] ** 2)
        if ln < 1e-12:
            return
        if normal is not None and (n[0] * normal[0] + n[1] * normal[1] + n[2] * normal[2]) < 0:
            pts = pts[::-1]
            if uvs:
                uvs = uvs[::-1]
            n = (-n[0], -n[1], -n[2])
        if uvs is None:
            uvs = [grain_uv(p, n, grain, off) if grain is not None else box_uv(p, n) for p in pts]
        base = len(self.v)
        self.v.extend(pts)
        self.uv.append(list(uvs))
        self.f.append(list(range(base, base + len(pts))))
        self.m.append(self.mi(mat))

    def box(self, x0, x1, y0, y1, z0, z1, mat, skip=(), grain=None, off=(0.0, 0.0)):
        x0, x1 = min(x0, x1), max(x0, x1)
        y0, y1 = min(y0, y1), max(y0, y1)
        z0, z1 = min(z0, z1), max(z0, z1)
        if x1 - x0 < 1e-5 or y1 - y0 < 1e-5 or z1 - z0 < 1e-5:
            return
        kw = dict(grain=grain, off=off)
        if '+x' not in skip: self.poly([(x1, y0, z0), (x1, y1, z0), (x1, y1, z1), (x1, y0, z1)], mat, (1, 0, 0), **kw)
        if '-x' not in skip: self.poly([(x0, y0, z0), (x0, y0, z1), (x0, y1, z1), (x0, y1, z0)], mat, (-1, 0, 0), **kw)
        if '+y' not in skip: self.poly([(x0, y1, z0), (x0, y1, z1), (x1, y1, z1), (x1, y1, z0)], mat, (0, 1, 0), **kw)
        if '-y' not in skip: self.poly([(x0, y0, z0), (x1, y0, z0), (x1, y0, z1), (x0, y0, z1)], mat, (0, -1, 0), **kw)
        if '+z' not in skip: self.poly([(x0, y0, z1), (x1, y0, z1), (x1, y1, z1), (x0, y1, z1)], mat, (0, 0, 1), **kw)
        if '-z' not in skip: self.poly([(x0, y0, z0), (x0, y1, z0), (x1, y1, z0), (x1, y0, z0)], mat, (0, 0, -1), **kw)

    def wbox(self, run, u0, u1, y0, y1, w0, w1, mat, skip=(), grain=None, off=(0.0, 0.0)):
        """box in a wall frame: u along the run axis, w across. grain: 'u' | 'y' | 'w' | None"""
        g = {'u': 0 if run == 'x' else 2, 'y': 1, 'w': 2 if run == 'x' else 0}.get(grain) if grain else None
        if run == 'x':
            m = {'+u': '+x', '-u': '-x', '+w': '+z', '-w': '-z', '+y': '+y', '-y': '-y'}
            self.box(u0, u1, y0, y1, w0, w1, mat, [m[s] for s in skip], g, off)
        else:
            m = {'+u': '+z', '-u': '-z', '+w': '+x', '-w': '-x', '+y': '+y', '-y': '-y'}
            self.box(w0, w1, y0, y1, u0, u1, mat, [m[s] for s in skip], g, off)

    def prism(self, cells, y0, y1, mat, top=True, bottom=True, sides=True):
        """extrude a Cells set between y0 and y1 (only boundary faces)."""
        if top or bottom:
            for (x0, z0, x1, z1) in cells.rects():
                if top: self.poly([(x0, y1, z0), (x0, y1, z1), (x1, y1, z1), (x1, y1, z0)], mat, (0, 1, 0))
                if bottom: self.poly([(x0, y0, z0), (x1, y0, z0), (x1, y0, z1), (x0, y0, z1)], mat, (0, -1, 0))
        if sides:
            for (run, c, a, b, n) in cells.boundary():
                if run == 'z':
                    self.poly([(c, y0, a), (c, y0, b), (c, y1, b), (c, y1, a)], mat, (n, 0, 0))
                else:
                    self.poly([(a, y0, c), (b, y0, c), (b, y1, c), (a, y1, c)], mat, (0, 0, n))

    def extrude(self, prof, O, A, X, Y, L, mat):
        def W(px, py, t):
            return tuple(O[i] + X[i] * px + Y[i] * py + A[i] * t for i in range(3))
        cx = sum(p[0] for p in prof) / len(prof)
        cy = sum(p[1] for p in prof) / len(prof)
        n = len(prof)
        for i in range(n):
            p, q = prof[i], prof[(i + 1) % n]
            ex, ey = q[0] - p[0], q[1] - p[1]
            nx_, ny_ = ey, -ex
            mx, my = (p[0] + q[0]) / 2 - cx, (p[1] + q[1]) / 2 - cy
            if nx_ * mx + ny_ * my < 0:
                nx_, ny_ = -nx_, -ny_
            nrm = tuple(X[k] * nx_ + Y[k] * ny_ for k in range(3))
            self.poly([W(p[0], p[1], 0), W(q[0], q[1], 0), W(q[0], q[1], L), W(p[0], p[1], L)], mat, normal=nrm)
        self.poly([W(px, py, 0) for px, py in prof], mat, normal=tuple(-a for a in A))
        self.poly([W(px, py, L) for px, py in prof], mat, normal=A)

    def tris(self):
        return sum(len(f) - 2 for f in self.f)


def wpt(run, u, y, w):
    return (u, y, w) if run == 'x' else (w, y, u)


# ---------------------------------------------------------------------------------------------
# solids (for probing wall faces / abutments)
# ---------------------------------------------------------------------------------------------
SOLIDS = []   # (x0,x1,y0,y1,z0,z1)
for i, lid in enumerate(LEVEL_ORDER):
    y0 = FOUND_BOTTOM if i == 0 else LEV[lid]['floor']
    for rid, rs in ROOMS[lid]:
        for r in rs:
            e = expand(r, HALF)
            SOLIDS.append((e[0], e[2], y0, level_top(i), e[1], e[3]))
    for c in H.get('structure', {}).get('canopies', {}).get(lid, []):
        e = expand(rect_b(c), HALF)
        SOLIDS.append((e[0], e[2], LEV[lid]['ceil'], level_top(i), e[1], e[3]))
for bx in H.get('structure', {}).get('boxes', []):
    r = rect_b(bx['rect'])
    SOLIDS.append((r[0], r[2], bx['y'][0], bx['y'][1], r[1], r[3]))

PARAPETS = []   # per flat roof: dict(roof, boxes=[plan rects], top, parapet)
for rf in H.get('roofs', []):
    if rf['type'] != 'flat' or not rf.get('parapet'):
        continue
    rects = [rect_b(r) for r in rf['rects']]
    skips = [rect_b(s) for s in rf.get('parapet_skip', [])]
    boxes = []
    for (run, c, a, b, n) in union_boundary(rects):
        # split the run into units that are not skipped (outside neighbour inside a skip rect -> no parapet)
        pts = sorted({a, b} | {v for s in skips for v in ((s[1], s[3]) if run == 'z' else (s[0], s[2])) if a < v < b})
        for s0, s1 in zip(pts[:-1], pts[1:]):
            m = (s0 + s1) / 2
            px, pz = (c + n * 0.01, m) if run == 'z' else (m, c + n * 0.01)
            if any(s[0] - EPS <= px <= s[2] + EPS and s[1] - EPS <= pz <= s[3] + EPS for s in skips):
                continue
            if run == 'z':
                boxes.append((c - HALF, s0 - HALF, c + HALF, s1 + HALF))
            else:
                boxes.append((s0 - HALF, c - HALF, s1 + HALF, c + HALF))
    PARAPETS.append(dict(id=rf['id'], boxes=boxes, top=rf['top'], parapet=rf['parapet'], shell_coping=bool(rf.get('coping'))))
    for b in boxes:
        SOLIDS.append((b[0], b[2], rf['top'], rf['top'] + rf['parapet'], b[1], b[3]))

HIPS = [rf for rf in H.get('roofs', []) if rf['type'] == 'hip']


def solid_at(x, y, z, pad=0.0):
    for s in SOLIDS:
        if s[0] - pad < x < s[1] + pad and s[2] - pad < y < s[3] + pad and s[4] - pad < z < s[5] + pad:
            return True
    return False


def interiors(y0, y1):
    """plan rects of room interiors (clear space) on levels overlapping [y0, y1]."""
    out = []
    for i, lid in enumerate(LEVEL_ORDER):
        if LEV[lid]['floor'] < y1 and LEV[lid]['ceil'] > y0:
            for rid, rs in ROOMS[lid]:
                out += [expand(r, -0.06) for r in rs]
    return out


def footprints(y0, y1):
    """solid plan rects (walls + slabs) overlapping [y0, y1]."""
    return [(s[0], s[4], s[1], s[5]) for s in SOLIDS if s[2] < y1 - EPS and s[3] > y0 + EPS]


def hip_plans(y0, y1):
    out = []
    for rf in HIPS:
        tp = math.tan(math.radians(rf.get('pitch', 12)))
        x0, z0, x1, z1 = rect_b(rf['outline'])
        top = rf['base'] + rf.get('thickness', 0.18) + min(x1 - x0, z1 - z0) / 2 * tp
        if rf['base'] < y1 and top > y0:
            out.append((x0, z0, x1, z1))
    return out


# ---------------------------------------------------------------------------------------------
# openings (same resolution as build_house.py)
# ---------------------------------------------------------------------------------------------
OPENINGS = []
for o in H.get('openings', []):
    lid = o['level']
    x, z = o['at']
    run = None
    for cand in ('z', 'x'):
        if cand == 'z':
            a, b = room_at(lid, x - 0.3, z), room_at(lid, x + 0.3, z)
        else:
            a, b = room_at(lid, x, z - 0.3), room_at(lid, x, z + 0.3)
        if a != b:
            run = cand
            left, right = a, b
            break
    if run is None:
        continue
    exterior = left is None or right is None
    if not exterior:
        continue
    c = x if run == 'z' else z
    u = z if run == 'z' else x
    fl = LEV[lid]['floor']
    sill = o.get('sill', 0.0)
    OPENINGS.append(dict(o, run=run, c=c, t=T_EXT, u0=R(u - o['width'] / 2), u1=R(u + o['width'] / 2),
                         y0=R(fl + sill), y1=R(fl + sill + o['height']), sill=sill, out=(-1 if left is None else 1)))
log('exterior openings', len(OPENINGS))

# ---------------------------------------------------------------------------------------------
# geometry groups (one object each -> a few draw calls)
# ---------------------------------------------------------------------------------------------
G = {k: MB() for k in ('trim', 'metal', 'wood', 'frames', 'garage', 'lamps', 'wash')}
REPLACES = []
LIGHTS = []

# ---- copings + fascia bands on flat-roof parapets ------------------------------------------
O_ = OPTS
for P in PARAPETS:
    if not P['boxes']:
        continue
    ytop = P['top'] + P['parapet']
    band0 = ytop - O_['fascia_band']
    sub_int = interiors(band0, ytop + 0.1)
    if not P['shell_coping']:     # P02 builds copings when the roof has "coping": true
        ov = O_['coping_overhang']
        plate = Cells([expand(b, ov) for b in P['boxes']], sub_int)
        G['trim'].prism(plate, ytop, ytop + O_['coping_t'], 'EXT_coping')
        lip = Cells([expand(b, ov) for b in P['boxes']], [expand(b, ov - 0.012) for b in P['boxes']] + sub_int)
        G['trim'].prism(lip, ytop - O_['coping_lip'], ytop, 'EXT_coping', top=False)
    # fascia ring 12 mm proud, minus anything solid next to it and hip roofs abutting it
    ft = O_['fascia_t']
    sub = list(P['boxes']) + footprints(band0, ytop) + hip_plans(band0, ytop) + sub_int
    ring0 = Cells([expand(b, ft) for b in P['boxes']], sub)
    # joints: slots across the ring every ~2.4 m along each outer run of the parapet outline
    slots, joints = [], []
    jw = O_['joint_w'] / 2
    for (run, c, a, b, n) in union_boundary(P['boxes']):
        L = b - a
        k = max(1, int(round(L / O_['fascia_panel'])))
        for q in range(1, k):
            p = a + L * q / k
            f0, f1 = sorted((c - n * 0.005, c + n * (ft + 0.005)))
            if run == 'z':
                slots.append((f0, p - jw, f1, p + jw))
                probe = (c + n * ft / 2, p)
            else:
                slots.append((p - jw, f0, p + jw, f1))
                probe = (p, c + n * ft / 2)
            joints.append((run, c, n, p, probe))
    ring = Cells([expand(b, ft) for b in P['boxes']], sub + slots)
    G['trim'].prism(ring, band0, ytop, 'EXT_fascia', top=False)
    ring_rects = ring0.rects()
    for (run, c, n, p, probe) in joints:
        if not any(r[0] < probe[0] < r[2] and r[1] < probe[1] < r[3] for r in ring_rects):
            continue
        w0, w1 = sorted((c, c + n * 0.0015))
        G['trim'].wbox('z' if run == 'z' else 'x', p - jw, p + jw, band0, ytop - 0.001, w0, w1, 'EXT_joint', skip=('-w' if n > 0 else '+w',))
    log('parapet', P['id'], 'boxes', len(P['boxes']), 'joints', len(joints))

# ---- elevated slabs (pergola): fascia, edge trim, larch beams -------------------------------
for bx in H.get('structure', {}).get('boxes', []):
    y0, y1 = bx['y']
    if y0 < 1.0 or y1 - y0 > 0.6:      # thin elevated slabs only (pergola, canopy), not tall blocks
        continue
    r = rect_b(bx['rect'])
    sub = [s for s in footprints(y0, y1) if s != r] + interiors(y0, y1)
    ft = O_['fascia_t']
    slots, joints = [], []
    jw = O_['joint_w'] / 2
    for (run, c, a, b, n) in union_boundary([r]):
        L = b - a
        k = max(1, int(round(L / O_['fascia_panel'])))
        for q in range(1, k):
            p = a + L * q / k
            f0, f1 = sorted((c - n * 0.005, c + n * (ft + 0.005)))
            slots.append((f0, p - jw, f1, p + jw) if run == 'z' else (p - jw, f0, p + jw, f1))
            joints.append((run, c, n, p))
    ring = Cells([expand(r, ft)], [r] + sub + slots)
    G['trim'].prism(ring, y0, y1, 'EXT_fascia', top=False)
    ring_rects = Cells([expand(r, ft)], [r] + sub).rects()
    for (run, c, n, p) in joints:
        probe = (c + n * ft / 2, p) if run == 'z' else (p, c + n * ft / 2)
        if not any(q[0] < probe[0] < q[2] and q[1] < probe[1] < q[3] for q in ring_rects):
            continue
        w0, w1 = sorted((c, c + n * 0.0015))
        G['trim'].wbox(run, p - jw, p + jw, y0 + 0.001, y1 - 0.001, w0, w1, 'EXT_joint', skip=('-w' if n > 0 else '+w',))
    # aluminium edge trim on the top outer edge
    e_out = 0.02
    top = Cells([expand(r, e_out)], [expand(r, -0.03)] + sub)
    G['trim'].prism(top, y1, y1 + 0.006, 'EXT_coping')
    lip = Cells([expand(r, e_out)], [expand(r, e_out - 0.008)] + sub)
    G['trim'].prism(lip, y1 - 0.035, y1, 'EXT_coping', top=False)
    # larch beams under the soffit, spanning the short direction, bays centred on the downlights
    if 'pergola' in bx['id']:
        span_x = (r[2] - r[0]) <= (r[3] - r[1])       # beams run along x when the slab is long in z
        lo, hi = (r[1], r[3]) if span_x else (r[0], r[2])
        lights = sorted(f['pos'][2] if span_x else f['pos'][0] for f in H.get('lighting', {}).get('fixtures', [])
                        if f['type'] == 'downlight' and r[0] <= f['pos'][0] <= r[2] and r[1] <= f['pos'][2] <= r[3])
        sp = O_['beam_spacing']
        if len(lights) >= 2:
            gap = lights[1] - lights[0]
            sp = gap / max(1, round(gap / sp))
            start = lights[0] + sp / 2
        else:
            start = lo + sp / 2
        while start - sp > lo + 0.25:
            start -= sp
        # span between the free edge and the house wall face (exclude solids)
        fp = footprints(y0 - 0.2, y0 - 0.01)
        s = start
        bw, bd = O_['beam_w'], O_['beam_d']
        nb = 0
        while s < hi - 0.25:
            if span_x:
                a0, a1 = r[0] + 0.05, r[2]
                for f in fp:          # stop at walls
                    if f[1] < s < f[3] and f[0] < a1 and f[2] > a0 and f[0] > a0 + 0.5:
                        a1 = min(a1, f[0])
                G['wood'].box(a0, a1, y0 - bd, y0, s - bw / 2, s + bw / 2, 'wood_slats', skip=('+y',), grain=0,
                              off=(RNG.random() * 3, RNG.random() * 3))
            else:
                a0, a1 = r[1] + 0.05, r[3]
                G['wood'].box(s - bw / 2, s + bw / 2, y0 - bd, y0, a0, a1, 'wood_slats', skip=('+y',), grain=2,
                              off=(RNG.random() * 3, RNG.random() * 3))
            s += sp
            nb += 1
        log('pergola', bx['id'], 'beams', nb, 'spacing %.3f' % sp)

# ---- hip roofs: drip edges, flashings, hip caps ---------------------------------------------
for rf in HIPS:
    x0, z0, x1, z1 = rect_b(rf['outline'])
    base, t = rf['base'], rf.get('thickness', 0.18)
    yE = base + t
    tp = math.tan(math.radians(rf.get('pitch', 12)))
    o = (x0, z0, x1, z1)
    abut_sub = []
    # outline edges sampled every 5 cm: abutting (wall just outside above the eave) or free eave
    for (run, c, a, b, n) in union_boundary([o]):
        s = a
        spans = []
        while s < b - 1e-6:
            s1 = min(b, s + 0.05)
            m = (s + s1) / 2
            px, pz = (c + n * 0.1, m) if run == 'z' else (m, c + n * 0.1)
            if solid_at(px, yE + 0.1, pz):
                if spans and abs(spans[-1][1] - s) < 1e-6:
                    spans[-1][1] = s1
                else:
                    spans.append([s, s1])
            s = s1
        for (s, s1) in spans:
            abut_sub.append((c - 0.05, s, c + 0.05, s1) if run == 'z' else (s, c - 0.05, s1, c + 0.05))
            # flashing upstand on the wall face (roof side), 8 mm
            w0, w1 = sorted((c, c - n * 0.008))
            G['metal'].wbox(run, s, s1, yE - 0.01, yE + 0.15, w0, w1, 'EXT_metal_anthracite')
    sub = abut_sub + footprints(base - 0.05, yE)
    drip = Cells([expand(o, 0.01)], [o] + sub)
    G['metal'].prism(drip, base - 0.035, yE + 0.012, 'EXT_metal_anthracite')
    kick = Cells([expand(o, 0.03)], [expand(o, 0.01)] + sub)
    G['metal'].prism(kick, base - 0.035, base - 0.025, 'EXT_metal_anthracite')
    # hip caps
    along_x = (x1 - x0) >= (z1 - z0)
    if along_x:
        hd = (z1 - z0) / 2
        zc = (z0 + z1) / 2
        r1, r2 = (x0 + hd, yE + hd * tp, zc), (x1 - hd, yE + hd * tp, zc)
        hips = [((x0, yE, z0), r1), ((x0, yE, z1), r1), ((x1, yE, z0), r2), ((x1, yE, z1), r2)]
    else:
        hd = (x1 - x0) / 2
        xc = (x0 + x1) / 2
        r1, r2 = (xc, yE + hd * tp, z0 + hd), (xc, yE + hd * tp, z1 - hd)
        hips = [((x0, yE, z0), r1), ((x1, yE, z0), r1), ((x0, yE, z1), r2), ((x1, yE, z1), r2)]
    for (p, q) in hips:
        mid = ((p[0] + q[0]) / 2, (p[2] + q[2]) / 2)
        # skip hips whose corner is buried in a wall
        if solid_at(p[0] + (0.2 if q[0] > p[0] else -0.2), yE + 0.12, p[2] + (0.2 if q[2] > p[2] else -0.2)):
            continue
        d = [q[i] - p[i] for i in range(3)]
        L = math.sqrt(sum(v * v for v in d))
        A = [v / L for v in d]
        side = [A[2], 0.0, -A[0]]
        sl = math.sqrt(side[0] ** 2 + side[2] ** 2)
        side = [v / sl for v in side]
        up = [A[1] * side[2] - A[2] * side[1], A[2] * side[0] - A[0] * side[2], A[0] * side[1] - A[1] * side[0]]
        if up[1] < 0:
            up = [-v for v in up]
        prof = [(-0.055, 0.0), (0.055, 0.0), (0.055, 0.012), (0.0, 0.03), (-0.055, 0.012)]
        G['metal'].extrude(prof, p, A, side, up, L, 'EXT_metal_anthracite')
    log('hip', rf['id'], 'abut cells', len(abut_sub))

# ---- horizontal larch slats on 'slats' cladding ----------------------------------------------
recess_ids = []
for cl in H.get('cladding', []):
    if cl['type'] != 'slats' or cl.get('orient') == 'h':
        continue
    recess_ids.append(cl['id'])
    run = 'x' if cl['axis'] == 'z' else 'z'
    plane, nrm = cl['plane'], cl['normal']
    u0, u1 = cl['u']
    y0, y1 = cl['y']
    # butt joints at inside corners: the run-'z' wall stops at the other wall's slat face
    if run == 'z':
        for other in H.get('cladding', []):
            if other is cl or other['type'] != 'slats' or other['axis'] == cl['axis']:
                continue
            face = other['plane'] + other['normal'] * (O_['slat_off'] + O_['slat_depth'])
            if abs(other['plane'] - u0) < 0.02:
                u0 = max(u0, face)
            if abs(other['plane'] - u1) < 0.02:
                u1 = min(u1, face)
    cuts = []
    for o in OPENINGS:
        if o['run'] == run and abs((o['c'] + o['out'] * o['t'] / 2) - plane) < 0.02:
            cuts.append((o['u0'] - 0.03, o['u1'] + 0.03, o['y0'] - 0.02, o['y1'] + 0.03))
    bw, gap, off, dep = O_['slat_board'], O_['slat_gap'], O_['slat_off'], O_['slat_depth']
    pitch = bw + gap
    wa, wb = sorted((plane + nrm * off, plane + nrm * (off + dep)))
    n = int((y1 - y0 - gap) // pitch)
    start = y0 + (y1 - y0 - (n * pitch - gap)) / 2
    nb = 0
    for k in range(n):
        a, b = start + k * pitch, start + k * pitch + bw
        segs = [(u0, u1)]
        for cu in cuts:
            if b > cu[2] and a < cu[3]:
                ns = []
                for (s0, s1) in segs:
                    if s1 <= cu[0] or s0 >= cu[1]:
                        ns.append((s0, s1))
                        continue
                    if cu[0] - s0 > 0.08: ns.append((s0, cu[0]))
                    if s1 - cu[1] > 0.08: ns.append((cu[1], s1))
                segs = ns
        for (s0, s1) in segs:
            # boards in lengths <= 3 m, random texture offset per board (tone/grain variation)
            G['wood'].wbox(run, s0, s1, a, b, wa, wb, 'wood_slats', grain='u', off=(RNG.random() * 5, RNG.random() * 5),
                           skip=('-w' if nrm > 0 else '+w',))
            nb += 1
    # black battens behind the boards (visible through the gaps)
    bs = O_['batten_spacing']
    ba, bb = sorted((plane, plane + nrm * off))
    nbat = max(2, int(round((u1 - u0) / bs)) + 1)
    for q in range(nbat):
        uc = u0 + 0.03 + (u1 - u0 - 0.06) * q / (nbat - 1)
        if any(cu[0] < uc < cu[1] for cu in cuts):
            for cu in cuts:
                if cu[0] < uc < cu[1]:
                    G['wood'].wbox(run, uc - 0.02, uc + 0.02, cu[3], y1 - 0.01, ba, bb, 'EXT_batten', skip=('-w' if nrm > 0 else '+w',))
            continue
        G['wood'].wbox(run, uc - 0.02, uc + 0.02, y0 + 0.01, y1 - 0.01, ba, bb, 'EXT_batten', skip=('-w' if nrm > 0 else '+w',))
    log('slats', cl['id'], 'boards', nb, 'cuts', len(cuts))
if recess_ids:
    REPLACES.append({'node_prefix': ['SLATS_' + i + '_' for i in recess_ids], 'when': 'vertical', 'by': 'P03_wood'})

# ---- openings: larch surrounds, glazing beads, garage door skin, balustrade channel -----------
FW, FD = 0.06, 0.07
have_surround = False
for o in OPENINGS:
    run, c, t, out = o['run'], o['c'], o['t'], o['out']
    u0, u1, y0, y1 = o['u0'], o['u1'], o['y0'], o['y1']
    face_out = c + out * t / 2
    if o.get('surround'):
        have_surround = True
        s0, s1 = sorted((face_out - out * 0.004, face_out + out * 0.18))
        back = '-w' if out > 0 else '+w'
        rnd = lambda: (RNG.random() * 4, RNG.random() * 4)
        G['wood'].wbox(run, u0 - 0.10, u0, y0 - 0.10, y1 + 0.10, s0, s1, 'wood_slats', skip=(back,), grain='y', off=rnd())
        G['wood'].wbox(run, u1, u1 + 0.10, y0 - 0.10, y1 + 0.10, s0, s1, 'wood_slats', skip=(back,), grain='y', off=rnd())
        G['wood'].wbox(run, u0, u1, y1, y1 + 0.10, s0, s1, 'wood_slats', skip=(back, '-u', '+u'), grain='u', off=rnd())
        G['wood'].wbox(run, u0, u1, y0 - 0.10, y0, s0, s1, 'wood_slats', skip=(back, '-u', '+u'), grain='u', off=rnd())
    if o['type'] == 'garage':
        dp = face_out - out * 0.10
        ua, ub = u0 + 0.05, u1 - 0.05
        yt = y1 - 0.08
        # dark groove backing + strips; section joints 8 mm, fine grooves 4 mm (3 per section)
        bk0, bk1 = sorted((dp + out * 0.005, dp + out * 0.006))
        G['garage'].wbox(run, ua, ub, y0 + 0.004, yt, bk0, bk1, 'EXT_groove', skip=('-w' if out > 0 else '+w', '-u', '+u'))
        s0, s1 = sorted((dp + out * 0.006, dp + out * 0.013))
        ns, nf = 5, 4
        sh = (yt - y0) / ns
        edges = []
        for k in range(ns):
            for q in range(nf):
                ya = y0 + k * sh + q * sh / nf
                yb = ya + sh / nf
                g_lo = (0.004 if k > 0 else 0.004) if q == 0 else 0.002
                g_hi = 0.004 if q == nf - 1 else 0.002
                if q == 0 and k == 0:
                    g_lo = 0.004
                edges.append((ya + g_lo, yb - g_hi))
        for (ya, yb) in edges:
            G['garage'].wbox(run, ua, ub, ya, yb, s0, s1, 'EXT_garage_door', skip=('-w' if out > 0 else '+w', '+y', '-y'))  # groove faces = dark backing
        if OPTS['garage_lights']:
            for (uu, tag) in ((u0 - 0.33, 'a'), (u1 + 0.33, 'b')):
                px, pz = wpt(run, uu, 0, face_out + out * 0.05)[0], wpt(run, uu, 0, face_out + out * 0.05)[2]
                # only on a real wall face (solid just behind, nothing in front)
                bx_, _, bz_ = wpt(run, uu, 0, face_out - out * 0.05)
                if solid_at(bx_, y1 - 0.1, bz_) and not solid_at(px, y1 - 0.1, pz):
                    d = wpt(run, 0, 0, out)
                    LIGHTS.append(dict(id='garage_' + tag, pos=list(wpt(run, uu, y1 - 0.15, face_out + out * 0.03)),
                                       dir=[d[0], 0, d[2]], wash=(0.9, 1.6, 0.9)))
if have_surround:
    REPLACES.append({'node': 'LARCH_surrounds', 'by': 'P03_wood'})

# ---- vertical larch slat screens (40 mm boards, 30 mm gaps) on black rails + wall brackets ----
OP_BY_ID = {o['id']: o for o in OPENINGS}
for sc in OPTS.get('screens', []):
    o = OP_BY_ID.get(sc['opening'])
    if not o:
        continue
    run, out = o['run'], o['out']
    face_out = o['c'] + out * o['t'] / 2
    u0, u1 = o['u0'] - sc['pad_u'][0], o['u1'] + sc['pad_u'][1]
    y0, y1 = o['y0'] - sc['pad_y'][0], o['y1'] + sc['pad_y'][1]
    wa, wb = sorted((face_out + out * sc['offset'], face_out + out * (sc['offset'] + 0.045)))
    SWd, GAP = 0.04, 0.03
    pitch = SWd + GAP
    n = int((u1 - u0 - GAP) // pitch)
    start = u0 + (u1 - u0 - (n * pitch - GAP)) / 2
    for k in range(n):
        a = start + k * pitch
        G['wood'].wbox(run, a, a + SWd, y0, y1, wa, wb, 'wood_slats', grain='y', off=(RNG.random() * 5, RNG.random() * 5))
    ra, rb = sorted((face_out + out * (sc['offset'] - 0.03), face_out + out * sc['offset']))
    for yy in (y0 + 0.12, y1 - 0.16):
        G['metal'].wbox(run, u0, u1, yy, yy + 0.04, ra, rb, 'handrail_black')
        for uu in (u0 + 0.12, (u0 + u1) / 2, u1 - 0.16):
            br = sorted((face_out - out * 0.01, ra if out > 0 else rb))
            G['metal'].wbox(run, uu, uu + 0.04, yy, yy + 0.04, br[0], br[1], 'handrail_black')
    log('screen', sc['opening'], 'boards', n)

for bl in H.get('balustrades', []):
    if bl['type'] != 'glass':
        continue
    fl = LEV[bl['level']]['floor']
    top = fl + bl.get('height', 1.0)
    pts = bl['path']
    hw = 0.014
    segs = list(zip(pts[:-1], pts[1:]))
    for i, ((ax_, az_), (bx_, bz_)) in enumerate(segs):
        run = 'x' if abs(az_ - bz_) < 1e-6 else 'z'
        c = az_ if run == 'x' else ax_
        ua, ub = (ax_, bx_) if run == 'x' else (az_, bz_)
        d = 1 if ub > ua else -1
        # the incoming corner is owned by the previous segment
        start = ua + d * (hw if i > 0 else -0.005)
        end = ub + d * (hw if i < len(segs) - 1 else 0.005)
        G['metal'].wbox(run, min(start, end), max(start, end), top - 0.022, top + 0.006, c - hw, c + hw, 'handrail_black')

# ---- wall lights ---------------------------------------------------------------------------
room_ids = {rid for lid in LEVEL_ORDER for rid, _ in ROOMS[lid]}
for f in H.get('lighting', {}).get('fixtures', []):
    if f['type'] == 'sconce' and f['room'] not in room_ids and f.get('dir'):
        LIGHTS.append(dict(id=f['id'], pos=list(f['pos']), dir=list(f['dir']), wash=None))


def wall_face(pos, d):
    """distance behind pos (against d) to the first solid, stepping 5 mm."""
    for k in range(0, 40):
        s = k * 0.005
        p = (pos[0] - d[0] * s, pos[1], pos[2] - d[2] * s)
        if solid_at(*p):
            return s
    return 0.03


def face_extent(face_pt, d, lat, y):
    """free wall width either side of a point on a wall face (stops at edges/openings)."""
    res = []
    for sgn in (-1, 1):
        e = 0.0
        while e < 0.6:
            q = (face_pt[0] + lat[0] * sgn * (e + 0.02) - d[0] * 0.01, y, face_pt[2] + lat[2] * sgn * (e + 0.02) - d[2] * 0.01)
            if not solid_at(*q):
                break
            e += 0.02
        res.append(e)
    return res


def vertical_extent(face_pt, d, sgn, lat):
    e = 0.0
    while e < 2.4:
        y = face_pt[1] + sgn * (e + 0.02)
        behind = solid_at(face_pt[0] - d[0] * 0.01, y, face_pt[2] - d[2] * 0.01)
        front = solid_at(face_pt[0] + d[0] * 0.02, y, face_pt[2] + d[2] * 0.02)
        if not behind or front or y < GRADE + 0.02:
            break
        e += 0.02
    return e


LW, LH, LD = O_['lamp']
for L in LIGHTS:
    d = L['dir']
    pos = L['pos']
    back = wall_face(pos, d)
    face = (pos[0] - d[0] * back, pos[1], pos[2] - d[2] * back)
    lat = (d[2], 0.0, -d[0]) if abs(d[0]) > 0.5 else (1.0, 0.0, 0.0)
    lat = (abs(lat[0]), 0.0, abs(lat[2]))
    cx, cy, cz = face
    fw = lambda s: (cx + d[0] * s, cz + d[2] * s)
    # housing (embedded 2 cm into the wall so it hides P01's globe bulb at the fixture point)
    ax0, az0 = fw(-0.02)
    ax1, az1 = fw(LD)
    hx, hz = lat[0] * LW / 2, lat[2] * LW / 2
    G['lamps'].box(min(ax0, ax1) - hx, max(ax0, ax1) + hx, cy - LH / 2, cy + LH / 2, min(az0, az1) - hz, max(az0, az1) + hz,
                   'EXT_lamp_body', skip=('-y', '+y'))
    # top/bottom: 6 mm rims + recessed glowing lenses
    for sgn in (-1, 1):
        yy = cy + sgn * LH / 2
        lx0, lz0 = fw(0.012)
        lx1, lz1 = fw(LD - 0.012)
        ix, iz = lat[0] * (LW / 2 - 0.012), lat[2] * (LW / 2 - 0.012)
        G['lamps'].poly([(min(lx0, lx1) - ix, yy - sgn * 0.004, min(lz0, lz1) - iz), (max(lx0, lx1) + ix, yy - sgn * 0.004, min(lz0, lz1) - iz),
                         (max(lx0, lx1) + ix, yy - sgn * 0.004, max(lz0, lz1) + iz), (min(lx0, lx1) - ix, yy - sgn * 0.004, max(lz0, lz1) + iz)],
                        'EXT_lamp_lens', normal=(0, sgn, 0))
        # rim = housing outline minus lens, 4 mm deep (the lens sits recessed inside it)
        hr = (min(ax0, ax1) - hx, min(az0, az1) - hz, max(ax0, ax1) + hx, max(az0, az1) + hz)
        lr = (min(lx0, lx1) - ix, min(lz0, lz1) - iz, max(lx0, lx1) + ix, max(lz0, lz1) + iz)
        yr0, yr1 = sorted((yy, yy - sgn * 0.004))
        G['lamps'].prism(Cells([hr], [lr]), yr0, yr1, 'EXT_lamp_body', top=sgn > 0, bottom=sgn < 0)
    # wall-wash quads (up + down), 3 mm off the wall, clipped to the free wall area
    left, right = face_extent(face, d, lat, cy)
    half_w = min(0.45, left + 0.0, right + 0.0)
    up = vertical_extent((cx, cy + LH / 2, cz), d, 1, lat)
    dn = vertical_extent((cx, cy - LH / 2, cz), d, -1, lat)
    wx, wz = fw(0.003)
    for sgn, ext in ((1, min(up, 1.6)), (-1, min(dn, 2.0))):
        if ext < 0.1 or half_w < 0.05:
            continue
        yA = cy + sgn * LH / 2
        yB = yA + sgn * ext
        # UV: u across (0..1 over the actual clipped width, centred), v = distance from the lamp in metres / 2
        uA, uB = 0.5 - half_w / 1.0, 0.5 + half_w / 1.0
        p0 = (wx - lat[0] * half_w, yA, wz - lat[2] * half_w)
        p1 = (wx + lat[0] * half_w, yA, wz + lat[2] * half_w)
        p2 = (wx + lat[0] * half_w, yB, wz + lat[2] * half_w)
        p3 = (wx - lat[0] * half_w, yB, wz - lat[2] * half_w)
        G['wash'].poly([p0, p1, p2, p3], 'EXT_light_wash', normal=(d[0], 0, d[2]),
                       uvs=[(uA, 0.0), (uB, 0.0), (uB, ext / 2.0), (uA, ext / 2.0)])
    L['face'] = [round(v, 4) for v in face]
    L['wash_up'], L['wash_down'], L['wash_half_w'] = round(up, 3), round(dn, 3), round(half_w, 3)
log('wall lights', len(LIGHTS))

# ---------------------------------------------------------------------------------------------
# Blender objects + export
# ---------------------------------------------------------------------------------------------
def B(p):
    return (p[0], -p[2], p[1])


bpy.ops.wm.read_factory_settings(use_empty=True)
COLL = bpy.data.collections.new('exterior_' + HOUSE_ID)
bpy.context.scene.collection.children.link(COLL)
MATS = {}


def get_mat(name):
    if name not in MATS:
        m = bpy.data.materials.new(name)
        m['house_material'] = name
        MATS[name] = m
    return MATS[name]


def make_obj(name, mb, parent=None, props=None):
    if not mb.f:
        return None
    me = bpy.data.meshes.new(name)
    me.from_pydata([B(p) for p in mb.v], [], mb.f)
    for mn in mb.mats:
        me.materials.append(get_mat(mn))
    me.polygons.foreach_set('material_index', mb.m)
    l1 = me.uv_layers.new(name='UVMap')
    l1.data.foreach_set('uv', [c for fu in mb.uv for p in fu for c in p])
    me.update()
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
    COLL.objects.link(ob)
    if parent is not None:
        ob.parent = parent
    for k, v in (props or {}).items():
        ob[k] = v
    return ob


root = bpy.data.objects.new('EXTERIOR_DETAIL', None)
COLL.objects.link(root)
root['kind'] = 'exterior_detail'
root['generated_by'] = 'pipeline/blender/exterior_build.py'
root['house_id'] = HOUSE_ID
root['replaces'] = json.dumps(REPLACES)
root['lights'] = json.dumps(LIGHTS)
tot = 0
for k, mb in G.items():
    ob = make_obj('P03_' + k, mb, parent=root, props={'kind': 'exterior_detail', 'group': k, 'noCollide': True})
    if ob:
        tot += mb.tris()
        log('object P03_%s tris %d mats %s' % (k, mb.tris(), mb.mats))
for L in LIGHTS:
    e = bpy.data.objects.new('EXTLIGHT_' + L['id'], None)
    COLL.objects.link(e)
    e.parent = root
    e.location = B(L.get('face', L['pos']))
    e['kind'] = 'wall_light'
    e['dir'] = L['dir']
os.makedirs(OUT_DIR, exist_ok=True)
glb = os.path.join(OUT_DIR, 'exterior_detail.glb')
bpy.ops.export_scene.gltf(filepath=glb, export_format='GLB', export_yup=True, export_extras=True,
                          export_texcoords=True, export_normals=True, export_materials='EXPORT',
                          export_image_format='NONE', export_cameras=False, export_lights=False,
                          export_animations=False, use_selection=False, export_apply=False)
log('done: tris %d, lights %d, replaces %s, %.1f KB' % (tot, len(LIGHTS), REPLACES, os.path.getsize(glb) / 1024))
