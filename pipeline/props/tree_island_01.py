# Broad spreading deciduous garden tree (field-maple-like): short trunk splitting into 3-4 limbs, domed,
# clumpy crown of alpha-masked leaf-cluster cards painted into a 2x2 atlas; ridged bark. ~4.3 m tall
# (site.json scales it ~1.7-2.1x). Leaf material 'leaves_maple' (Landscape reads its min Y).
import sys, os; sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import helpers as H, _p04veg as G
H.reset()
bark = G.bark_mat('bark_maple', 'rough', seed=4)
img, grid = G.atlas('leaf_maple_atlas', dict(leaf='#4f7a2c', tip='#7d9a3a', aspect=0.58, len=0.15, n=52, forks=3, shape='ovate', spread=1.1,
                                             twig='#4a3a2a', jit=(0.03, 0.12, 0.2)), grid=2, S=512, seed=3)
leaves = G.leaf_mat('leaves_maple', img)
P = dict(leaf_min_z=1.45, trunk_len=1.55, trunk_r=0.13, flare=0.5, card=0.62, bark_tile=0.5, fold=0.14, droop=0.15, nblend=0.72, card_up=0.35,
         levels=[
             dict(seg=0.3, wiggle=0.04, up=0.05, taper=0.6, sides=10),
             dict(n=(3, 4), t0=0.8, t1=1.0, angle=50, angle_var=10, ratio=1.4, shrink=0.1, rratio=0.72, sides=8, up=0.05, wiggle=0.1, taper=0.35, seg=0.3),
             dict(n=(6, 7), t0=0.2, t1=1.0, angle=55, ratio=0.7, shrink=0.5, rratio=0.62, sides=5, up=0.03, droop=0.05, wiggle=0.14, taper=0.3, cards=5, card_t0=0.55, seg=0.22),
             dict(n=(6, 8), t0=0.2, t1=1.0, angle=55, ratio=0.55, shrink=0.35, rratio=0.6, rmin=0.005, sides=3, droop=0.08, wiggle=0.18, taper=0.4, cards=5, card_t0=0.1, seg=0.2),
         ])
G.build_tree('tree', P, 21, bark, leaves, grid)
H.finish('tree_island_01')
