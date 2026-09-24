# Medium grass clumps, variants grass_medium_02_a..d (0.3-0.5 m): radial bent tuft cards painted with
# tapered curved blades (dark base -> straw-tinted tips). Used by Landscape as lawn-edge ground cover.
import sys, os; sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import helpers as H, _p04veg as G
H.reset()
img, grid = G.atlas('grass_med2_atlas', dict(leaf='#3f6326', tip='#9aa55a', n=46, w=0.014, fan=0.32, len=0.95), grid=2, S=512, kind='tuft', seed=31)
m = G.leaf_mat('grass_medium_02_leaves', img, rough=0.8)
V = {}
for i, (k, (h, n)) in enumerate({'a': (0.3, 9), 'b': (0.38, 11), 'c': (0.45, 12), 'd': (0.52, 14)}.items()):
    V[f'grass_medium_02_{k}'] = [G.tuft(f'g{k}', m, grid, n=n, h=h, w=h * 0.8, lean=0.45, seed=200 + i)]
H.finish('grass_clump_medium_02', variants=V)
