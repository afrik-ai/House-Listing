# Silver birch (Betula pendula), 1-2 leaning stems: white bark with black lenticels/patches, ascending limbs
# with pendulous twigs, small round-toothed leaves in light airy clusters. ~4.2 m tall (site.json scales ~2.1-2.4x).
import sys, os; sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import helpers as H, _p04veg as G
H.reset()
bark = G.bark_mat('bark_birch', 'birch', seed=8)
img, grid = G.atlas('leaf_birch_atlas', dict(leaf='#5d8a2e', tip='#8fa844', aspect=0.8, len=0.11, n=48, forks=3, twig_len=0.84, shape='round', serr=0.15,
                                             spread=1.2, twig='#3a2a22', jit=(0.03, 0.12, 0.2), petiole=0.2), grid=2, S=512, seed=5)
leaves = G.leaf_mat('leaves_birch', img)
P = dict(leaf_min_z=1.2, trunk_len=3.3, trunk_r=0.1, flare=0.35, card=0.5, bark_tile=0.45, fold=0.1, droop=0.35, nblend=0.72, card_up=-0.2,
         levels=[
             dict(seg=0.3, wiggle=0.035, up=0.03, taper=0.25, sides=9),
             dict(n=(9, 11), t0=0.35, t1=0.97, angle=48, angle_var=12, ratio=0.42, shrink=0.55, rratio=0.6, sides=6, up=0.06, wiggle=0.1, taper=0.3, seg=0.25),
             dict(n=(5, 6), t0=0.2, t1=1.0, angle=45, ratio=0.6, shrink=0.3, rratio=0.6, sides=4, droop=0.18, wiggle=0.14, taper=0.35, cards=4, card_t0=0.3, seg=0.18),
             dict(n=(3, 4), t0=0.3, t1=1.0, angle=35, ratio=0.6, shrink=0.2, rratio=0.6, rmin=0.004, sides=3, droop=0.35, wiggle=0.12, taper=0.4, cards=4, card_t0=0.05, seg=0.15),
         ])
from helpers import V
objs = G.build_tree('birch', P, 33, bark, leaves, grid, stems=[((0, 0, 0), (0.12, 0.05, 1), 3.4, 0.11), ((0.12, 0.06, 0), (0.35, 0.25, 1), 2.6, 0.075)])
H.finish('tree_island_02')
