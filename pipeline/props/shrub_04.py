# Hydrangea-like flowering shrub (~1.1 m): broad serrated leaves + pale blue-lilac mophead flower cards.
import sys, os; sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import helpers as H, _p04veg as G
import numpy as np
H.reset()
bark = G.bark_mat('bark_hyd', 'rough', seed=9, N=256)
img, grid = G.atlas('leaf_hyd_atlas', dict(leaf='#3f6a2a', tip='#5f8436', aspect=0.6, len=0.26, n=18, forks=2, shape='ovate', serr=0.08, spread=1.0,
                                           twig='#5b6a3a', petal='#a9b8e0', centre='#c5cbe8', petal_base='#8fa0d6', fr=0.05, petals=4, petal_aspect=0.9, flowers=0), grid=2, S=512, seed=19)
fimg, _ = G.atlas('flower_hyd_atlas', dict(leaf='#3f6a2a', tip='#5f8436', aspect=0.6, len=0.2, n=5, forks=0, twig_len=0.4, shape='ovate', twig='#5b6a3a',
                                            petal='#b3bfe6', centre='#dfe3f5', petal_base='#98a6da', fr=0.03, petals=4, petal_aspect=1.0, flowers=0, heads=1, head_r=0.27, florets=110), grid=2, S=512, kind='flower', seed=23)
leaves = G.leaf_mat('leaves_hydrangea', img)
flowers = G.leaf_mat('leaves_hydrangea_flowers', fimg)
P = dict(card=0.42, bark_tile=0.3, fold=0.1, droop=0.12, nblend=0.8, card_up=0.3, stem_r=0.014,
         levels=[dict(seg=0.2, wiggle=0.1, up=0.08, taper=0.5, sides=4, root=False, cards=4, card_t0=0.3),
                 dict(n=(2, 3), t0=0.5, t1=1.0, angle=35, ratio=0.4, shrink=0.3, rratio=0.6, rmin=0.004, sides=3, wiggle=0.15, taper=0.4, cards=3, card_t0=0.2, seg=0.12)])
objs = G.shrub('hyd', P, 91, bark, leaves, grid, nstems=11, height=0.95, lean=0.6)
# flower heads: cards at the top of the leaf mass, facing up/out
T = G.Tree(P, 3); rng = np.random.default_rng(4)
from helpers import V
lv = objs[-1].data
zs = [v.co.z for v in lv.vertices]; zmax = max(zs)
pts = [v.co.copy() for v in lv.vertices if v.co.z > zmax * 0.7]
cards = []
for k in range(22):
    p = pts[int(rng.integers(0, len(pts)))]
    d = (V((p.x, p.y, 0)) * 0.6 + V((0, 0, 1))).normalized()
    cards.append((p - V((0, 0, 0.14)), d, 0.34 * rng.uniform(0.8, 1.2), 3))
c, r = G.crown_of(cards)
G.mesh_obj(G.cards_mesh(cards, 2, c, r, 0.2, 0.05, 0.8, rng), 'flowers', flowers)
H.finish('shrub_04')
