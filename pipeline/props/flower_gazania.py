# Gazania clumps, variants flower_gazania_a..c: narrow grey-green lance leaves + orange / yellow / cream daisy
# flowers with dark-ringed centres, held just above the leaves.
import sys, os; sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import helpers as H, _p04veg as G
H.reset()
bark = H.pbr('gazania_stem', '#5d7043', 0.8)
V = {}
cols = {'a': ('#e8741e', '#f2b03a'), 'b': ('#f2c230', '#f6dc6a'), 'c': ('#efe6cf', '#f4d98a')}
for i, (k, (pc, pb)) in enumerate(cols.items()):
    img, grid = G.atlas(f'gazania_{k}_atlas', dict(leaf='#546b3e', tip='#7c8c68', aspect=0.18, len=0.28, n=16, forks=2, shape='lance', spread=0.9, twig='#5d7043',
                                                   petal=pc, petal_base=pb, centre='#3a2a14', fr=0.1, petals=14, petal_aspect=0.3, flowers=3), grid=2, S=512, kind='flower', seed=50 + i)
    m = G.leaf_mat(f'leaves_gazania_{k}', img, rough=0.7)
    P = dict(card=0.2, fold=0.1, droop=0.12, nblend=0.8, card_up=0.7, stem_r=0.004,
             levels=[dict(seg=0.08, wiggle=0.2, taper=0.6, sides=3, root=False, cards=2, card_t0=0.4)])
    V[f'flower_gazania_{k}'] = G.shrub(f'gz{k}', P, 60 + i, bark, m, grid, nstems=14, height=0.12, lean=1.3)
H.finish('flower_gazania', variants=V)
