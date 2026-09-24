# Brass candleholders, 3 variants (top-level nodes): brass_candleholder_01 (tall trio on a tray), _02 (pair,
# turned), _03 (single chamberstick). Ivory dinner candles with burnt wicks and wax drips. Built ~1.8x real
# size: furniture.json places them at scale 0.5-0.6.
import sys; sys.path.insert(0, __import__('os').path.dirname(__import__('os').path.abspath(__file__)))
import helpers as H, _kit as K
from helpers import V, PI
import bpy
H.reset()
S = 1.8
brass = K.brushed('brass_candle', '#bf9550', 0.28)
wax = H.pbr('candle_wax', '#f2ead8', 0.45, sheen=0.2)
wick = K.plain('wick', '#111111', 0.9)
def stick(h, loc, turned=True):
    prof = [(0.0, 0.0), (0.045, 0.0), (0.045, 0.006), (0.03, 0.012), (0.012, 0.03)]
    if turned: prof += [(0.009, h * 0.3), (0.016, h * 0.36), (0.009, h * 0.42), (0.008, h * 0.8), (0.014, h * 0.86)]
    else: prof += [(0.008, h * 0.86)]
    prof += [(0.022, h * 0.95), (0.022, h), (0.012, h), (0.012, h - 0.015), (0.0, h - 0.015)]
    o = [H.lathe('stick', [(r * S, z * S) for r, z in prof], 40, brass, loc=loc)]
    ch = 0.16 + (hash(loc) % 5) * 0.01
    z0 = (h - 0.015) * S
    o.append(H.cyl('candle', 0.011 * S, ch * S, loc=(loc[0], loc[1], z0), seg=20, mat=wax, bev=0.002))
    for k in range(2):
        d = H.superellipsoid('drip', 0.004 * S, 0.003 * S, 0.02 * S, e=2, n=2, nu=10, nv=6, mat=wax)
        a = 1.3 + k * 2.4
        import math
        d.location = (loc[0] + math.cos(a) * 0.011 * S, loc[1] + math.sin(a) * 0.011 * S, z0 + ch * S - 0.02 * S - k * 0.01)
    o.append(H.cyl('wick', 0.0012 * S, 0.012 * S, loc=(loc[0], loc[1], z0 + ch * S), seg=6, mat=wick))
    return o
_seen = set()
def objs_since(n0):
    new = [o for o in bpy.context.scene.objects if o.type == 'MESH' and o.name not in _seen]
    _seen.update(o.name for o in new)
    return new
groups = {}
n0 = 0
# 01: trio of different heights on an oval tray
tray = H.superellipsoid('tray', 0.16 * S, 0.07 * S, 0.006 * S, e=3, n=8, nu=48, nv=6, mat=brass, loc=(0, 0, 0.006 * S))
for i, (x, h) in enumerate(((-0.1, 0.2), (0.0, 0.26), (0.1, 0.16))):
    stick(h, (x * S, 0.0, 0.012 * S))
groups['brass_candleholder_01'] = objs_since(0); n0 = len(groups['brass_candleholder_01'])
for x, h in ((-0.05, 0.24), (0.05, 0.2)):
    stick(h, (x * S + 1.0, 0.0, 0.0))
groups['brass_candleholder_02'] = objs_since(n0); n0 += len(groups['brass_candleholder_02'])
d = H.lathe('dish', [(r * S, z * S) for r, z in [(0.0, 0.0), (0.07, 0.0), (0.075, 0.012), (0.07, 0.014), (0.02, 0.006), (0.0, 0.006)]], 40, brass, loc=(2.0, 0, 0))
H.tube('handle', [V((2.0 + 0.07 * S, 0, 0.01 * S)), V((2.0 + 0.1 * S, 0, 0.02 * S)), V((2.0 + 0.1 * S, 0, 0.05 * S)), V((2.0 + 0.085 * S, 0, 0.06 * S))], 0.004 * S, 8, brass)
stick(0.06, (2.0, 0, 0.006 * S), turned=False)
groups['brass_candleholder_03'] = objs_since(n0)
H.finish('candlesticks_brass', variants=groups, extras={'texres': 512})
