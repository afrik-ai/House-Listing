# Cherry-laurel-like evergreen shrubs, 4 separate GLBs shrub_02_a..d (0.7-1.5 m): multi-stem, glossy dark
# ovate leaves in painted cluster cards. (models.json splits Poly Haven shrub_02 into _a.._d.)
import sys, os; sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import helpers as H, _p04veg as G
SP = dict(leaf='#35582a', tip='#5c7d33', aspect=0.45, len=0.2, n=36, forks=3, shape='ovate', spread=1.0, twig='#4b3b2b', jit=(0.03, 0.12, 0.18))
SIZES = {'a': (1.0, 6, 0.5), 'b': (1.35, 7, 0.45), 'c': (0.75, 5, 0.6), 'd': (1.55, 8, 0.4)}
for i, (k, (h, n, lean)) in enumerate(SIZES.items()):
    H.reset()
    bark = G.bark_mat('bark_shrub', 'rough', seed=2, N=256)
    img, grid = G.cached_atlas('leaf_laurel_atlas', SP, grid=2, S=512, seed=13)
    leaves = G.leaf_mat('leaves_laurel', img, rough=0.45, spec=0.5)
    P = dict(card=0.36 + h * 0.05, bark_tile=0.3, fold=0.14, droop=0.1, nblend=0.8, card_up=0.35, stem_r=0.018,
             levels=[dict(seg=0.2, wiggle=0.12, up=0.1, taper=0.5, sides=5, root=False, cards=3, card_t0=0.5),
                     dict(n=(4, 5), t0=0.25, t1=1.0, angle=45, ratio=0.55, shrink=0.4, rratio=0.6, rmin=0.004, sides=3, wiggle=0.16, up=0.05, taper=0.4, cards=4, card_t0=0.1, seg=0.15)])
    G.shrub('shrub', P, 50 + i, bark, leaves, grid, nstems=n, height=h * 0.8, lean=lean)
    H.finish(f'shrub_02_{k}')
G.outputs('shrub_02', [f'shrub_02_{k}' for k in SIZES])
