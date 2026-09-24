# Round coffee table: 0.90 m honed white marble top (30 mm, eased edge) on a fluted smoked-oak drum,
# recessed black plinth. Lived-in: two stacked coffee-table books + a small brass dish. ~0.90 x 0.40 m.
import sys; sys.path.insert(0, __import__('os').path.dirname(__import__('os').path.abspath(__file__)))
import helpers as H, _kit as K
from helpers import V, PI
import math

H.reset()
marb = K.marble('marble_top')
oak = K.wood('smoked_oak', light='#7a5a40', mid='#634631', dark='#43301f', seed=12, rings=30)
black = K.plain('plinth_black', '#141414', 0.6)
brass = K.brushed('brass_dish')
cov1 = K.fabric('book_linen_sage', '#7d8a72', threads=120, seed=21)
cov2 = K.fabric('book_linen_ink', '#2b3446', threads=120, seed=22)
page = K.plain('book_pages', '#efe8d8', 0.9)
R, HT = 0.45, 0.40
top = H.lathe('top', [(0.0, HT - 0.03), (R - 0.006, HT - 0.03), (R, HT - 0.024), (R, HT - 0.006), (R - 0.006, HT), (0.0, HT)], 96, marb, sharp=30)
H.uv_planar(top, size=(0.95, 0.95))
# fluted drum: 28 flutes
NF = 28
drum = H.lathe('drum', [(0.0, 0.03), (0.27, 0.03), (0.27, HT - 0.03), (0.0, HT - 0.03)], NF * 6, oak)
def flute(co):
    r = math.hypot(co.x, co.y)
    if r < 0.2: return co
    a = math.atan2(co.y, co.x)
    k = 1 - 0.018 / 0.27 * (0.5 + 0.5 * math.cos(a * NF)) ** 0.6
    return V((co.x * k, co.y * k, co.z))
H.displace_fn(drum, flute)
H.uv_box(drum, 1.0, along='z')
H.cyl('plinth', 0.24, 0.03, loc=(0, 0, 0), seg=64, mat=black, bev=0.004)
# clutter (kept clear of the dropped vase/candle positions: +X/-Z quadrant stays free)
K.book('bookA', 0.24, 0.30, 0.03, cov1, page, loc=(-0.17, 0.05, HT), rotz=0.25)
K.book('bookB', 0.20, 0.26, 0.025, cov2, page, loc=(-0.16, 0.06, HT + 0.03), rotz=0.05)
H.lathe('dish', [(0.0, 0.0), (0.05, 0.0), (0.06, 0.012), (0.057, 0.013), (0.047, 0.003), (0.0, 0.003)], 40, brass, loc=(-0.12, -0.2, HT))
H.finish('coffee_table_round_marble', extras={'texres': 1024})
