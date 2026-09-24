# Rectangular rattan storage basket with a linen liner folded over the rim and rope handles. ~0.36 x 0.26 x 0.20 m
import sys; sys.path.insert(0, __import__('os').path.dirname(__import__('os').path.abspath(__file__)))
import helpers as H, _kit as K
from helpers import V, PI
H.reset()
wk = K.wicker('wicker_basket', '#b89464', '#7f5c34', n=24)
lin = K.fabric('liner_linen', '#d9d2c3', threads=80, seed=9)
rope = K.plain('rope_jute', '#a38a63', 0.9)
W, D, Hh = 0.36, 0.26, 0.20
rings = [H.ring_se(W / 2 - 0.02, D / 2 - 0.02, 0.0, 6, 64), H.ring_se(W / 2 - 0.005, D / 2 - 0.005, 0.01, 6, 64), H.ring_se(W / 2, D / 2, Hh, 6, 64)]
b = H.loft('basket', rings, wk, cap0=True); H.solidify(b, 0.008); H.uv_box(b, 0.3)
rim = H.tube('rim', H.ring_se(W / 2 - 0.002, D / 2 - 0.002, Hh, 6, 64), 0.008, 8, wk, closed=True, up=(0, 0, 1))
# liner folded over the rim (outer skirt 6 cm) with soft waves
import math
out = [V((p.x * 1.03, p.y * 1.04, Hh - 0.06 + 0.006 * math.sin(i * 0.9))) for i, p in enumerate(H.ring_se(W / 2 + 0.006, D / 2 + 0.006, 0, 6, 64))]
top = [V((p.x, p.y, Hh + 0.012)) for p in H.ring_se(W / 2 + 0.004, D / 2 + 0.004, 0, 6, 64)]
inn = [V((p.x, p.y, Hh - 0.05)) for p in H.ring_se(W / 2 - 0.012, D / 2 - 0.012, 0, 6, 64)]
l = H.loft('liner', [out, top, inn], lin); H.solidify(l, 0.002); H.uv_box(l, 0.3)
for s in (-1, 1):
    H.tube('handle', [V((s * (W / 2 + 0.012), -0.05, Hh - 0.085)), V((s * (W / 2 + 0.03), 0, Hh - 0.08)), V((s * (W / 2 + 0.012), 0.05, Hh - 0.085))], 0.006, 8, rope)
H.finish('basket_wicker', extras={'texres': 512})
