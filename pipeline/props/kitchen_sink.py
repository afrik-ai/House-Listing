# Undermount stainless kitchen sink + matte-black gooseneck mixer. Variants (top-level nodes, each centred):
#   sink_worktop : 1.20 x 0.62 x 0.03 m light quartz worktop section with the bowl under-mounted and the tap
#   sink_bowl    : the 0.54 x 0.40 x 0.20 m bowl alone (flange top = its max Y) for a counter with a cut-out
#   mixer_tap    : the tap alone (origin at the base of its escutcheon)
import sys; sys.path.insert(0, 'C:/Users/Owner/HouseListing/pipeline/props')
import helpers as H
from helpers import V, PI
import math, numpy as np, bpy

H.reset()
N = 1024
b = H.tex_brushed(N, seed=51, along='u')
steel_n = H.save_img(H.h2n(b * 0.8 + H.fnoise(N, 0.8, 0.8, 5) * 0.05, 0.12), 'sink_steel_n', True)
steel_r = H.save_img(H.orm(np.clip(0.3 + b * 0.035, 0, 1), np.ones((N, N), np.float32)), 'sink_steel_orm', True)
steel = H.pbr('brushed_steel', '#c9cbcd', 0.3, 1.0, normal_tex=steel_n, rough_tex=steel_r, nstr=0.5, cull=False)
chrome = H.pbr('chrome', '#e0e0e0', 0.08, 1.0)
dark = H.pbr('drain_dark', '#151515', 0.6)
black = H.pbr('matte_black_tap', '#1a1a1a', 0.42, 0.75)
aer = H.pbr('aerator', '#2a2a2a', 0.6)
# quartz worktop (fine speckle, tiles every 0.6 m)
q = H.fnoise(N, 1.2, 1.2, 61); q2 = H.fnoise(N, 2.5, 2.5, 62); q3 = H.fnoise(N, 60, 60, 63)
spk = np.clip((q - 2.0) * 2, 0, 1) * 0.6 + np.clip((q2 - 2.2) * 2, 0, 1) * 0.3
qc = H.colmix(np.clip(0.5 + q3 * 0.15, 0, 1), '#d4d2cd', '#dcdad6') * (1 - spk[..., None] * 0.45)
quartz = H.pbr('quartz_light', '#ffffff', 0.32, base_tex=H.save_img(qc, 'quartz_c'))

IW, ID, DEP = 0.54, 0.40, 0.20
rc = 0.012
def rr(w, d, r, z, n=5):
    return [V((x, y, z)) for x, y in H.rrect2d(w, d, r, n)]
def bowl(name):
    rings = [rr(IW + 0.05, ID + 0.05, 0.03, DEP),         # flange outer edge
             rr(IW + 0.004, ID + 0.004, rc + 0.002, DEP), # top inner lip
             rr(IW, ID, rc, DEP - 0.004),
             rr(IW - 0.008, ID - 0.008, rc, 0.02),         # drafted walls
             rr(IW - 0.02, ID - 0.02, rc, 0.004),          # bottom fillet
             rr(IW - 0.04, ID - 0.04, rc, 0.0)]
    # floor: rings closing towards the drain (at centre)
    for s in (0.7, 0.4, 0.2):
        rings.append([V((p.x * s, p.y * s, -0.004 * (1 - s))) for p in rings[-1]])
    o = H.loft(name, rings, steel, cap1=True)
    H.recalc(o)
    H.uv_box(o, 1.0, along='x')
    H.solidify(o, 0.0012, offset=-1)
    return o
def drain(z0):
    # strainer: ring + slotted cap
    parts = [H.lathe('drain_ring', [(0.0, 0.0), (0.043, 0.0), (0.046, 0.003), (0.043, 0.005), (0.036, 0.004), (0.034, 0.0015), (0.0, 0.0015)], 48, chrome, loc=(0, 0, z0 - 0.0035))]
    for i in range(12):
        a = 2 * PI * i / 12
        parts.append(H.box('slot', 0.018, 0.0035, 0.002, loc=(0.02 * math.cos(a), 0.02 * math.sin(a), z0 - 0.0012), rot=(0, 0, a), mat=dark, bev=0.0015, seg=2))
    parts.append(H.cyl('cap', 0.009, 0.004, loc=(0, 0, z0 - 0.002), seg=24, mat=chrome, bev=0.0025, bseg=3))
    return parts
def overflow():
    return H.box('overflow', 0.05, 0.004, 0.012, loc=(0, ID / 2 - 0.0035, DEP - 0.035), mat=dark, bev=0.005, seg=3)
def tap(x, y, z):
    parts = []
    parts.append(H.lathe('tap_base', [(0.0, 0.0), (0.028, 0.0), (0.028, 0.004), (0.024, 0.010), (0.019, 0.022), (0.0, 0.022)], 48, black, loc=(x, y, z)))
    # body + gooseneck: vertical rise then 180 deg arc towards -Y and short drop
    Rg = 0.105
    path = [V((x, y, z + 0.01)), V((x, y, z + 0.15)), V((x, y, z + 0.30))]
    path += [V((x, y - Rg + Rg * math.cos(a), z + 0.30 + Rg * math.sin(a))) for a in np.linspace(0, PI, 22)[1:]]
    path += [V((x, y - 2 * Rg, z + 0.26))]
    rad = [0.0165] * 3 + [0.0165 - 0.003 * i / 21 for i in range(1, 22)] + [0.0135]
    t = H.sweep('spout', path, H.circle2d(1.0, 24), black, caps=True, scale=rad)
    parts.append(t)
    parts.append(H.cyl('aerator', 0.0125, 0.006, loc=(x, y - 2 * Rg, z + 0.255), seg=24, mat=aer))
    # side lever
    parts.append(H.cyl('lever_boss', 0.0175, 0.034, loc=(x + 0.012, y, z + 0.12), rot=(0, PI / 2, 0), seg=32, mat=black, bev=0.003))
    lv = H.tube('lever', [V((x + 0.044, y, z + 0.12)), V((x + 0.05, y + 0.02, z + 0.155)), V((x + 0.052, y + 0.035, z + 0.19))], 0.0055, 16, black)
    parts.append(lv)
    return parts

# ---- variant A: worktop module
WT, WD, TH = 1.20, 0.62, 0.03
a_parts = [bowl('bowlA')] + drain(0.0) + [overflow()]
slab = H.box_minmax('worktop', (-WT / 2, -WD / 2 + 0.02, DEP), (WT / 2, WD / 2 + 0.02, DEP + TH), mat=quartz)
cut = H.loft('cut', [rr(IW, ID, rc, DEP - 0.05), rr(IW, ID, rc, DEP + 0.1)], quartz, cap0=True, cap1=True)
bm_ = slab.modifiers.new('cut', 'BOOLEAN'); bm_.object = cut; bm_.solver = 'EXACT'; bm_.operation = 'DIFFERENCE'
slab = H.apply_mods(slab); bpy.data.objects.remove(cut)
H.uv_box(slab, 0.6)
H.sharpen(slab, 40)
H.bevel(slab, 0.002, 2)
H.wnormal(slab)
a_parts.append(slab)
a_parts += tap(0.0, ID / 2 + 0.075, DEP + TH)
# ---- variant B: bowl only
b_parts = [bowl('bowlB')] + drain(0.0) + [overflow()]
# ---- variant C: tap only
c_parts = tap(0.0, 0.0, 0.0)
H.finish('kitchen_sink', variants={'sink_worktop': a_parts, 'sink_bowl': b_parts, 'mixer_tap': c_parts}, extras={'texres': 1024})
