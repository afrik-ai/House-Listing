# Wood sorrel (Oxalis) ground-cover mounds, variants shrub_sorrel_a..c (0.15-0.3 m): clover-like trifoliate
# leaves (3 heart leaflets) on thin petioles, a few small white flowers.
import sys, os; sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import helpers as H, _p04veg as G
H.reset()
bark = H.pbr('sorrel_stem', '#6f8a45', 0.8)
img, grid = G.atlas('leaf_sorrel_atlas', dict(leaf='#4f7d2d', tip='#6f9a3c', aspect=0.9, len=0.12, n=42, forks=4, shape='heart', spread=1.3, twig='#6f8a45',
                                              petal='#f4f2ea', centre='#e8d86a', petal_base='#e0d9f0', fr=0.05, petals=5, petal_aspect=0.6, flowers=3, petiole=0.3), grid=2, S=512, kind='flower', seed=29)
leaves = G.leaf_mat('leaves_sorrel', img)
V = {}
for i, (k, (h, n)) in enumerate({'a': (0.16, 9), 'b': (0.22, 12), 'c': (0.3, 14)}.items()):
    P = dict(card=0.16 + h * 0.2, fold=0.1, droop=0.15, nblend=0.85, card_up=0.6, stem_r=0.003,
             levels=[dict(seg=0.1, wiggle=0.2, up=0.0, taper=0.6, sides=3, root=False, cards=3, card_t0=0.3)])
    V[f'shrub_sorrel_{k}'] = G.shrub(f's{k}', P, 100 + i, bark, leaves, grid, nstems=n * 2, height=h * 0.7, lean=1.4)
H.finish('shrub_sorrel', variants=V)
