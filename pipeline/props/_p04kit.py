# P04 hard-surface kit: shared procedural materials for garden / outdoor / garage props.
import numpy as np
import helpers as H

_C = {}
def _once(key, fn):
    if key not in _C or _C[key].name not in __import__('bpy').data.materials: _C[key] = fn()
    return _C[key]

def wood(name='wood', light='#b58a5c', mid='#946b44', dark='#6e4d30', rough=0.7, seed=5, rings=26):
    def f():
        c, h = H.tex_wood(512, seed=seed, light=light, mid=mid, dark=dark, rings=rings)
        return H.pbr(name, '#ffffff', rough, base_tex=H.save_img(c, name + '_c'), normal_tex=H.save_img(H.h2n(h, 0.5), name + '_n', True), nstr=0.8)
    return _once(name, f)

def weathered_wood(name='wood_weathered'):
    return wood(name, '#a39b8d', '#857c6e', '#5d564c', 0.9, seed=8, rings=18)

def painted(name, color, rough=0.45, metal=0.0, orange_peel=0.25):
    def f():
        h = H.fnoise(256, 2, 2, 3) * orange_peel
        return H.pbr(name, color, rough, metal, normal_tex=H.save_img(H.h2n(h, 1.0), name + '_n', True), nstr=0.4)
    return _once(name, f)

def galvanized(name='galvanized'):
    def f():
        N = 512
        sp = H.fnoise(N, 18, 18, 4) * 0.5 + H.fnoise(N, 5, 5, 5) * 0.5   # spangle
        c = H.ramp(np.clip(0.5 + sp * 0.18, 0, 1), [(0, '#8d9294'), (0.5, '#aeb3b5'), (1, '#c9cdcf')])
        r = np.clip(0.42 + sp * 0.08, 0.2, 0.8).astype(np.float32)
        return H.pbr(name, '#ffffff', 0.45, 1.0, base_tex=H.save_img(c.astype(np.float32), name + '_c'), rough_tex=H.save_img(H.orm(r, np.ones_like(r)), name + '_orm', True))
    return _once(name, f)

def steel(name='steel_brushed', color='#b8bcbf', rough=0.35):
    def f():
        h = H.tex_brushed(512, 3)
        return H.pbr(name, color, rough, 1.0, normal_tex=H.save_img(H.h2n(h * 0.3, 1.0), name + '_n', True), nstr=0.3)
    return _once(name, f)

def plastic(name, color, rough=0.55):
    return _once(name, lambda: H.pbr(name, color, rough, spec=0.5))

def rubber(name='rubber_black'):
    return _once(name, lambda: H.pbr(name, '#1c1c1c', 0.85))

def cardboard(name='cardboard'):
    def f():
        N = 512
        y, x = np.mgrid[0:N, 0:N].astype(np.float32) / N
        fl = np.sin(x * 2 * np.pi * 60) * 0.15            # flute ridges
        n = H.fnoise(N, 3, 3, 2) * 0.5 + H.fnoise(N, 40, 40, 3) * 0.3
        c = H.ramp(np.clip(0.5 + n * 0.15, 0, 1), [(0, '#a0764a'), (0.5, '#b88c5c'), (1, '#c9a070')])
        return H.pbr(name, '#ffffff', 0.9, base_tex=H.save_img(c.astype(np.float32), name + '_c'), normal_tex=H.save_img(H.h2n(fl + n * 0.2, 1.0), name + '_n', True), nstr=0.5)
    return _once(name, f)

def concrete(name='concrete_cast', color=('#8a8782', '#a3a09a', '#bab6af')):
    def f():
        N = 512
        n = H.fbm(N, 60, 4, 7)
        pits = np.clip(H.fnoise(N, 1.2, 1.2, 9) - 2.0, 0, 1)
        c = H.ramp(np.clip(0.5 + n * 0.2 - pits, 0, 1), [(0, color[0]), (0.5, color[1]), (1, color[2])])
        return H.pbr(name, '#ffffff', 0.85, base_tex=H.save_img(c.astype(np.float32), name + '_c'), normal_tex=H.save_img(H.h2n(n * 0.4 - pits * 2, 1.0), name + '_n', True))
    return _once(name, f)

def terracotta(name='terracotta_pot'):
    def f():
        N = 512
        n = H.fbm(N, 50, 4, 2)
        c = H.ramp(np.clip(0.5 + n * 0.2, 0, 1), [(0, '#94502f'), (0.5, '#b0643e'), (1, '#c98a62')])
        return H.pbr(name, '#ffffff', 0.88, base_tex=H.save_img(c.astype(np.float32), name + '_c'), normal_tex=H.save_img(H.h2n(n * 0.5, 1.0), name + '_n', True))
    return _once(name, f)

def corten(name='corten_steel'):
    def f():
        N = 512
        n = H.fbm(N, 40, 5, 12)
        c = H.ramp(np.clip(0.5 + n * 0.25, 0, 1), [(0, '#4a2412'), (0.45, '#7a3c1c'), (0.8, '#9c5428'), (1, '#b06a36')])
        r = np.clip(0.8 + n * 0.08, 0, 1).astype(np.float32)
        return H.pbr(name, '#ffffff', 0.85, base_tex=H.save_img(c.astype(np.float32), name + '_c'), normal_tex=H.save_img(H.h2n(n * 0.6, 1.0), name + '_n', True), rough_tex=H.save_img(H.orm(r), name + '_orm', True))
    return _once(name, f)

def fabric(name, color, rough=0.95):
    return _once(name, lambda: H.pbr(name, color, rough, normal_tex=H.fabric_normal('p04_weave_n', 512, 64, seed=3, strength=1.2), nstr=0.8))

def soil(name='garden_soil'):
    def f():
        N = 256
        h = H.fnoise(N, 3, 3, 1) * 0.6 + H.fnoise(N, 1, 1, 2) * 0.4
        c = H.ramp(np.clip(0.5 + h * 0.25, 0, 1), [(0, '#1d1510'), (0.6, '#34261b'), (1, '#57442f')])
        return H.pbr(name, '#ffffff', 0.95, base_tex=H.save_img(c.astype(np.float32), name + '_c'), normal_tex=H.save_img(H.h2n(h, 3), name + '_n', True))
    return _once(name, f)

def emissive(name='led_warm', color='#fff1d6', strength=4.0):
    return _once(name, lambda: H.pbr(name, color, 0.4, emit=color, emit_str=strength))

def glass(name='glass_clear'):
    return _once(name, lambda: H.pbr(name, '#dfe6e8', 0.05, alpha=0.3, spec=0.5))

def plank(name, mn, mx, mat, along, bev=0.004, k=[0]):
    o = H.box_minmax(name, mn, mx, mat=mat)
    k[0] += 1
    H.uv_box(o, 1.0, along=along, offset=(k[0] * 0.137 % 1, k[0] * 0.291 % 1))
    if bev: H.bevel(o, bev, 2)
    return o

def rod(name, a, b, r, mat, seg=10):
    """Cylinder between points a and b."""
    from helpers import V
    import math
    a, b = V(a), V(b); d = b - a
    o = H.cyl(name, r, d.length, loc=tuple(a), seg=seg, mat=mat)
    o.rotation_euler = d.to_track_quat('Z', 'Y').to_euler()
    return o
