# Row of 12 encyclopedia volumes (leather-look spines in oxblood/green/navy, gilt bands) + 3 lying on top.
# Spines face +Z. ~0.62 x 0.30 x 0.26 m
import sys; sys.path.insert(0, __import__('os').path.dirname(__import__('os').path.abspath(__file__)))
import helpers as H, _kit as K
from helpers import V, PI
import math, random, numpy as np
H.reset()
cols = [('#5a1f1c', 'enc_oxblood'), ('#23402f', 'enc_green'), ('#1f2c47', 'enc_navy')]
covs = [K.leather(k, c, seed=100 + i) for i, (c, k) in enumerate(cols)]
page = K.plain('enc_pages', '#e9dfc6', 0.9); gilt = K.brushed('enc_gilt', '#c9a24e', 0.3)
rnd = random.Random(3); x = -0.3
for i in range(12):
    t = 0.038 + rnd.uniform(-0.004, 0.006); h = 0.26 + rnd.uniform(-0.01, 0.01); c = covs[(i // 4) % 3] if i % 5 else covs[rnd.randrange(3)]
    lean = 0.0 if i < 11 else -0.12
    b = K.book('vol', t, 0.2, h, c, page, loc=(x + t / 2, 0, 0), rotz=0.0, roty=lean)
    for z in (0.03, h - 0.04, h * 0.55):
        H.box('band', t + 0.001, 0.002, 0.004, loc=(x + t / 2, -0.1005, z), mat=gilt)
    x += t + 0.002
for j in range(3):
    K.book('lie', 0.2, 0.28, 0.035, covs[j], page, loc=(0.05 * (j % 2), 0.0, 0.265 + j * 0.035), rotz=math.pi / 2 + rnd.uniform(-0.15, 0.15))
H.finish('books_encyclopedia', extras={'texres': 512})
