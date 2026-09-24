# Madagascar periwinkle (Catharanthus) bedding plants, variants plant_periwinkle_a..c (0.25-0.35 m):
# glossy oval leaves, flat 5-petal pink / white / magenta flowers.
import sys, os; sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import helpers as H, _p04veg as G
H.reset()
bark = H.pbr('periwinkle_stem', '#56703a', 0.8)
V = {}
cols = {'a': ('#f08cb4', '#c8326e'), 'b': ('#f6f2f0', '#d0325a'), 'c': ('#d23c8c', '#8a1450')}
for i, (k, (pc, cc)) in enumerate(cols.items()):
    img, grid = G.atlas(f'periwinkle_{k}_atlas', dict(leaf='#2f5c22', tip='#4d7a2e', aspect=0.45, len=0.16, n=24, forks=3, shape='ovate', spread=1.1, twig='#56703a',
                                                      petal=pc, centre=cc, fr=0.07, petals=5, petal_aspect=0.9, flowers=4), grid=2, S=512, kind='flower', seed=70 + i)
    m = G.leaf_mat(f'leaves_periwinkle_{k}', img, rough=0.45, spec=0.5)
    P = dict(card=0.2, fold=0.1, droop=0.1, nblend=0.8, card_up=0.5, stem_r=0.005,
             levels=[dict(seg=0.08, wiggle=0.15, up=0.05, taper=0.6, sides=3, root=False, cards=3, card_t0=0.3)])
    V[f'plant_periwinkle_{k}'] = G.shrub(f'pw{k}', P, 80 + i, bark, m, grid, nstems=10, height=0.2 + 0.04 * i, lean=0.8)
H.finish('plant_periwinkle', variants=V)
