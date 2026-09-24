# Olive-like small multi-stem tree: three twisting grey stems, rounded open crown of narrow grey-green
# lance leaves (silver undersides). ~3.4 m tall (site.json scales ~1.55x). Leaf material 'leaves_olive'.
import sys, os; sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import helpers as H, _p04veg as G
H.reset()
bark = G.bark_mat('bark_olive', 'olive', seed=12)
img, grid = G.atlas('leaf_olive_atlas', dict(leaf='#5f6f44', tip='#8e9a78', aspect=0.2, len=0.16, n=60, forks=3, shape='lance', spread=0.8,
                                             twig='#5a5446', jit=(0.03, 0.2, 0.25), petiole=0.04, vein=0.02), grid=2, S=512, seed=9)
leaves = G.leaf_mat('leaves_olive', img, rough=0.7)
P = dict(card=0.55, bark_tile=0.4, flare=0.3, fold=0.12, droop=0.12, nblend=0.75, card_up=0.3,
         levels=[
             dict(seg=0.2, wiggle=0.12, up=0.02, taper=0.55, sides=9),
             dict(n=(3, 4), t0=0.62, t1=1.0, angle=45, angle_var=12, ratio=0.95, shrink=0.25, rratio=0.7, sides=6, up=0.04, wiggle=0.16, taper=0.4, seg=0.22),
             dict(n=(5, 6), t0=0.2, t1=1.0, angle=52, ratio=0.6, shrink=0.4, rratio=0.6, sides=4, droop=0.04, wiggle=0.16, taper=0.35, cards=4, card_t0=0.4, seg=0.2),
             dict(n=(3, 5), t0=0.2, t1=1.0, angle=50, ratio=0.5, shrink=0.3, rratio=0.6, rmin=0.004, sides=3, droop=0.06, wiggle=0.18, taper=0.4, cards=4, card_t0=0.1, seg=0.15),
         ])
G.build_tree('olive', P, 7, bark, leaves, grid, stems=[((0, 0, 0), (0.2, 0.1, 1), 2.0, 0.09), ((0.08, 0.05, 0), (-0.25, 0.2, 1), 1.85, 0.075), ((0.02, -0.08, 0), (0.05, -0.3, 1), 1.9, 0.07)])
H.finish('tree_small')
