# Medium grass clumps (greener, broader blades), variants grass_clump_medium_a..c.
import sys, os; sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import helpers as H, _p04veg as G
H.reset()
img, grid = G.atlas('grass_med_atlas', dict(leaf='#3b6a24', tip='#7f9c45', n=38, w=0.02, fan=0.4, len=0.9), grid=2, S=512, kind='tuft', seed=37)
m = G.leaf_mat('grass_medium_leaves', img, rough=0.8)
V = {}
for i, (k, (h, n)) in enumerate({'a': (0.35, 10), 'b': (0.45, 12), 'c': (0.55, 14)}.items()):
    V[f'grass_clump_medium_{k}'] = [G.tuft(f'g{k}', m, grid, n=n, h=h, w=h * 0.85, lean=0.5, seed=300 + i)]
H.finish('grass_clump_medium', variants=V)
