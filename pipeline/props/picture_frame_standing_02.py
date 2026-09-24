# Standing black slim frame 15x20 (landscape) with a family snapshot; front +Z.
import sys; sys.path.insert(0, __import__('os').path.dirname(__import__('os').path.abspath(__file__)))
import helpers as H, _kit as K, _photo
from helpers import V, PI
H.reset()
frame = K.plain('frame_black', '#161616', 0.4)
mount = K.plain('mount_board', '#f3efe6', 0.9)
glass = H.pbr('frame_glass', '#ffffff', 0.03, alpha=0.12, spec=0.9, blend='BLEND')
back = K.plain('frame_back', '#6b5a45', 0.9)
img = _photo.photo('picture_frame_standing_02_photo', 2, seed=5)
ph = H.pbr('photo', '#ffffff', 0.35, base_tex=img)
W, Hh, F, T = 0.2, 0.15, 0.01, 0.018
tilt = 0.18
parts = []
# moulding: 4 bevelled bars
for (sx, sy, lx, lz) in ((W, F, 0, Hh / 2 - F / 2), (W, F, 0, -Hh / 2 + F / 2), (F, Hh - 2 * F, W / 2 - F / 2, 0), (F, Hh - 2 * F, -W / 2 + F / 2, 0)):
    parts.append(H.box('mould', sx, T, sy, loc=(lx, 0, lz), mat=frame, bev=0.003, seg=2))
    H.uv_box(parts[-1], 1.0, along='x' if sx > sy else 'z')
parts.append(H.box('mount', W - 2 * F + 0.002, 0.003, Hh - 2 * F + 0.002, loc=(0, 0.002, 0), mat=mount))
p = H.obj('photo', [(-W / 2 + F + 0.012, -0.0003, -Hh / 2 + F + 0.012), (W / 2 - F - 0.012, -0.0003, -Hh / 2 + F + 0.012), (W / 2 - F - 0.012, -0.0003, Hh / 2 - F - 0.012), (-W / 2 + F + 0.012, -0.0003, Hh / 2 - F - 0.012)],
          [(0, 1, 2, 3)], ph, uvs=[[(0, 0), (1, 0), (1, 1), (0, 1)]]); parts.append(p)
parts.append(H.box('glass', W - 2 * F + 0.004, 0.002, Hh - 2 * F + 0.004, loc=(0, -T / 2 + 0.004, 0), mat=glass))
parts.append(H.box('back', W - 0.01, 0.004, Hh - 0.01, loc=(0, T / 2 - 0.002, 0), mat=back))
for o in parts: o.location.z += Hh / 2
H.xform_about(parts, (0, 0, 0), (-tilt, 0, 0))
# easel strut
st = H.box('strut', 0.03, 0.004, Hh * 0.75, loc=(0, 0, 0), mat=back)
st.location = (0, T / 2 + Hh * 0.28, Hh * 0.35); st.rotation_euler = (0.42, 0, 0)
H.finish('picture_frame_standing_02', extras={'texres': 512})
