# Boxwood / small-leaved evergreen shrub, one GLB with variants shrub_03_a..c (0.5-0.9 m, dense rounded).
import sys, os; sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import helpers as H, _p04veg as G
H.reset()
bark = G.bark_mat('bark_box', 'rough', seed=6, N=256)
img, grid = G.atlas('leaf_box_atlas', dict(leaf='#3d5f25', tip='#6d8a34', aspect=0.6, len=0.085, n=90, forks=4, shape='ovate', spread=1.2, twig='#5a4a35', jit=(0.03, 0.12, 0.2), petiole=0.05), grid=2, S=512, seed=17)
leaves = G.leaf_mat('leaves_box', img, rough=0.5)
V = {}
for i, (k, h) in enumerate({'a': 0.55, 'b': 0.75, 'c': 0.95}.items()):
    P = dict(card=0.3, bark_tile=0.3, fold=0.1, droop=0.05, nblend=0.88, card_up=0.4, stem_r=0.012,
             levels=[dict(seg=0.15, wiggle=0.1, up=0.1, taper=0.5, sides=4, root=False, cards=3, card_t0=0.4),
                     dict(n=(4, 6), t0=0.2, t1=1.0, angle=50, ratio=0.5, shrink=0.4, rratio=0.6, rmin=0.004, sides=3, wiggle=0.2, taper=0.4, cards=4, card_t0=0.1, seg=0.12)])
    V[f'shrub_03_{k}'] = G.shrub(f's{k}', P, 70 + i, bark, leaves, grid, nstems=9, height=h * 0.75, lean=0.75)
H.finish('shrub_03', variants=V)
