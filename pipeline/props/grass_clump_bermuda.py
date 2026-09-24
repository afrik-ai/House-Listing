# Low fine-bladed Bermuda-grass mats, variants grass_clump_bermuda_a..c (0.1-0.18 m, wide and flat).
import sys, os; sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import helpers as H, _p04veg as G
H.reset()
img, grid = G.atlas('grass_bermuda_atlas', dict(leaf='#4d7a2c', tip='#8ca24e', n=70, w=0.008, fan=0.55, len=0.8), grid=2, S=512, kind='tuft', seed=41)
m = G.leaf_mat('grass_bermuda_leaves', img, rough=0.8)
V = {}
for i, (k, (h, n)) in enumerate({'a': (0.1, 10), 'b': (0.14, 12), 'c': (0.18, 14)}.items()):
    V[f'grass_clump_bermuda_{k}'] = [G.tuft(f'g{k}', m, grid, n=n, h=h, w=h * 1.6, lean=1.2, seed=400 + i)]
H.finish('grass_clump_bermuda', variants=V)
