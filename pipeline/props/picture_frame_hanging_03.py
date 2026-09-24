# Hanging white-oak frame 40x40 with portrait print. Back at -Z (wall).
import sys; sys.path.insert(0, __import__('os').path.dirname(__import__('os').path.abspath(__file__)))
import helpers as H, _kit as K, _photo
from helpers import V, PI
import math
H.reset()
frame = K.wood('hang_whiteoak', light='#d9c3a0', mid='#c6ad86', dark='#a78d66', seed=141)
mount = K.plain('hang_mount', '#f4f0e6', 0.9)
glass = H.pbr('hang_glass', '#ffffff', 0.03, alpha=0.1, spec=0.9, blend='BLEND')
img = _photo.photo('picture_frame_hanging_03_art', 2, W=384, Hh=384, seed=13)
art = H.pbr('art_print', '#ffffff', 0.6, base_tex=img)
W, Hh, F, T, M = 0.4, 0.4, 0.03, 0.03, 0.05
prof = [(-0.006, -0.02), (0.012, -0.02), (0.012, 0.02), (-0.004, 0.02), (-0.006, 0.0)]
# moulding swept around the rectangle (profile in (depth, width) with ornament bumps)
path = [V((-W / 2 + F / 2, 0, -Hh / 2 + F / 2)), V((W / 2 - F / 2, 0, -Hh / 2 + F / 2)), V((W / 2 - F / 2, 0, Hh / 2 - F / 2)), V((-W / 2 + F / 2, 0, Hh / 2 - F / 2))]
fr = H.sweep('moulding', path, prof, frame, closed=True, up=(0, 1, 0)); H.uv_box(fr, 0.2)
H.box('mount', W - 2 * F + 0.004, 0.004, Hh - 2 * F + 0.004, loc=(0, 0.004, 0), mat=mount)
p = H.obj('art', [(-W / 2 + F + M, 0.0015, -Hh / 2 + F + M), (W / 2 - F - M, 0.0015, -Hh / 2 + F + M), (W / 2 - F - M, 0.0015, Hh / 2 - F - M), (-W / 2 + F + M, 0.0015, Hh / 2 - F - M)],
          [(0, 1, 2, 3)], art, uvs=[[(0, 0), (1, 0), (1, 1), (0, 1)]])
H.box('glass', W - 2 * F + 0.004, 0.002, Hh - 2 * F + 0.004, loc=(0, -0.004, 0), mat=glass)
H.box('backing', W - 0.02, 0.006, Hh - 0.02, loc=(0, 0.012, 0), mat=K.plain('hang_back', '#5b4a37', 0.9))
H.finish('picture_frame_hanging_03', extras={'texres': 512})
