# Modern lounge armchair: oat boucle-weave shell (arms + back) on a plinth rail, piped loose seat and back
# cushions, rust accent pillow, tapered splayed oak legs with brass ferrules. ~0.78 x 0.80 x 0.80 m, front +Z.
import sys; sys.path.insert(0, __import__('os').path.dirname(__import__('os').path.abspath(__file__)))
import helpers as H, _kit as K
from helpers import V, PI
import math

H.reset()
uph = K.fabric('boucle_oat', '#b3a58c', threads=70, seed=3, strength=2.0)
pipe = K.fabric('piping_oat', '#a89c88', threads=140, seed=4)
rust = K.fabric('pillow_rust', '#86402a', threads=110, seed=5, twill=True, sheen=0.0)
oak = K.wood('oak_legs', seed=8)
brass = K.brushed('brass_ferrule')
W, D = 0.78, 0.76
# plinth rail + shell
rail = H.superellipsoid('rail', W / 2, D / 2, 0.08, e=12, n=8, nu=64, nv=10, mat=uph); rail.location = (0, 0.01, 0.23); H.uv_box(rail, 0.25)
for s in (-1, 1):
    a = H.superellipsoid('arm', 0.075, D / 2, 0.22, e=10, n=5, nu=48, nv=14, mat=uph, zfn=lambda x, y, z: z - (0.02 if y < -0.25 and z > 0 else 0))
    a.location = (s * (W / 2 - 0.075), 0.01, 0.39); H.uv_box(a, 0.25)
    K.stitch('seam', [V((s * (W / 2 - 0.075) + s * 0.074, y, 0.39)) for y in (-D / 2 + 0.05, D / 2 - 0.05)], pipe)
back = H.superellipsoid('back', W / 2 - 0.01, 0.08, 0.30, e=10, n=5, nu=64, nv=14, mat=uph)
back.location = (0, D / 2 - 0.07, 0.48); back.rotation_euler = (-0.12, 0, 0); H.uv_box(back, 0.25)
# loose cushions
K.cushion('seat', W - 0.30, D - 0.20, 0.13, uph, loc=(0, -0.07, 0.375), crown=0.25, pipe=pipe)
K.cushion('backc', W - 0.31, 0.42, 0.13, uph, loc=(0, D / 2 - 0.20, 0.62), crown=0.3, pipe=pipe, rot=(PI / 2 - 0.22, 0, 0))
K.cushion('pillow', 0.40, 0.40, 0.11, rust, loc=(0.13, D / 2 - 0.32, 0.64), crown=0.9, e=4, pipe=None, rot=(PI / 2 - 0.35, 0.25, -0.2))
# legs
for sx in (-1, 1):
    for sy in (-1, 1):
        x, y = sx * (W / 2 - 0.08), sy * (D / 2 - 0.08)
        K.tapered_leg('leg', 0.017, 0.011, 0.16, (x, y, 0.0), oak, splay=(sy * 0.12, -sx * 0.12))
        H.cyl('ferrule', 0.0115, 0.02, loc=(x, y, 0.0), seg=16, mat=brass)
H.finish('armchair_modern', extras={'texres': 1024})
