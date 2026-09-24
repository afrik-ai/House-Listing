# Ornate gilt frame 60x75 with carved moulding, landscape oil print. Back at -Z (wall).
import sys; sys.path.insert(0, __import__('os').path.dirname(__import__('os').path.abspath(__file__)))
import helpers as H, _kit as K, _photo
from helpers import V, PI
import math
H.reset()
frame = K.brushed('gilt_frame', '#c9a24e', 0.35, seed=142)
mount = K.plain('hang_mount', '#f4f0e6', 0.9)
glass = H.pbr('hang_glass', '#ffffff', 0.03, alpha=0.1, spec=0.9, blend='BLEND')
img = _photo.photo('picture_frame_fancy_01_art', 0, W=384, Hh=512, seed=14)
art = H.pbr('art_print', '#ffffff', 0.6, base_tex=img)
W, Hh, F, T, M = 0.6, 0.75, 0.07, 0.05, 0.0
prof = [(-0.012, -0.035), (0.012, -0.035), (0.012, 0.035), (-0.004, 0.035), (-0.012, 0.02), (-0.018, 0.012), (-0.012, 0.004), (-0.02, -0.008), (-0.014, -0.02)]
# moulding swept around the rectangle (profile in (depth, width) with ornament bumps)
path = [V((-W / 2 + F / 2, 0, -Hh / 2 + F / 2)), V((W / 2 - F / 2, 0, -Hh / 2 + F / 2)), V((W / 2 - F / 2, 0, Hh / 2 - F / 2)), V((-W / 2 + F / 2, 0, Hh / 2 - F / 2))]
fr = H.sweep('moulding', path, prof, frame, closed=True, up=(0, 1, 0)); H.uv_box(fr, 0.2)
H.box('mount', W - 2 * F + 0.004, 0.004, Hh - 2 * F + 0.004, loc=(0, 0.004, 0), mat=mount)
p = H.obj('art', [(-W / 2 + F + M, 0.0015, -Hh / 2 + F + M), (W / 2 - F - M, 0.0015, -Hh / 2 + F + M), (W / 2 - F - M, 0.0015, Hh / 2 - F - M), (-W / 2 + F + M, 0.0015, Hh / 2 - F - M)],
          [(0, 1, 2, 3)], art, uvs=[[(0, 0), (1, 0), (1, 1), (0, 1)]])
H.box('glass', W - 2 * F + 0.004, 0.002, Hh - 2 * F + 0.004, loc=(0, -0.004, 0), mat=glass)
H.box('backing', W - 0.02, 0.006, Hh - 0.02, loc=(0, 0.012, 0), mat=K.plain('hang_back', '#5b4a37', 0.9))
H.finish('picture_frame_fancy_01', extras={'texres': 512})
