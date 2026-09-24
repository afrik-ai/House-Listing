# Boston fern (Nephrolepis), 4 GLBs plant_fern_a..d (0.35-0.6 m tall, up to 0.9 m wide, plant only, base = soil):
# arching pinnate fronds (painted pinnae strip atlas, alpha-masked) from a crown.
import sys, os; sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import helpers as H, _p04veg as G
from helpers import V, PI
import math, numpy as np
SIZES = {'a': (18, 0.4), 'b': (26, 0.5), 'c': (22, 0.45), 'd': (32, 0.6)}
def frond_atlas():
    rng = np.random.default_rng(3); S = 512; n = 4
    img = np.zeros((S, S * n, 4), np.float32)
    for c in range(n):
        cell = G.paint_cluster_cell(S, rng, dict(leaf='#4f8a2c', tip='#79a83e', aspect=0.32, len=0.13, n=70, forks=0, twig_len=0.97,
                                                 shape='lance', spread=1.35, twig='#5d7a35', jit=(0.02, 0.1, 0.12), petiole=0.0, vein=0.05))
        img[:, c * S:(c + 1) * S] = cell
    return H.save_img(G.bleed(img), 'fern_frond'), n
for si, (k, (n, h)) in enumerate(SIZES.items()):
    H.reset()
    img, nc = frond_atlas()
    lm = H.pbr('leaves_fern', '#ffffff', 0.7, base_tex=img, alpha_tex=True, cull=False, spec=0.35)
    rng = np.random.default_rng(40 + si)
    L = G.Mesh(); L.fuv = []
    for i in range(n):
        a = 2 * PI * i / n * 1.618 + rng.uniform(-0.2, 0.2)
        out = V((math.cos(a), math.sin(a), 0))
        up = rng.uniform(0.6, 1.6)
        d = (out * 0.5 + V((0, 0, up))).normalized()
        side = V((-out.y, out.x, 0))
        size = h * rng.uniform(1.0, 1.5)
        G.leaf_geo(L, V((out.x * 0.02, out.y * 0.02, 0)), d, side, size, size * 0.7, int(rng.integers(0, nc)), nc, arch=0.55 / up, cup=0.15, twist=rng.uniform(-0.4, 0.4), nu=1, nv=7)
    G.mesh_obj(L, 'fronds', lm)
    H.finish(f'plant_fern_{k}')
G.outputs('plant_fern', [f'plant_fern_{k}' for k in SIZES])
