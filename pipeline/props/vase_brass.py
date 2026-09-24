# Hammered brass vase (amphora-ish silhouette, hand-beaten dimples via normal map), dark patina inside. ~0.20 x 0.36 m
import sys; sys.path.insert(0, __import__('os').path.dirname(__import__('os').path.abspath(__file__)))
import helpers as H, _kit as K
import numpy as np
H.reset()
N = 512
h = -np.abs(H.fnoise(N, 10, 10, 3)) * 1.0 + H.fnoise(N, 2, 2, 4) * 0.1
ni = H.save_img(H.h2n(h, 1.5), 'hammer_n', True)
ri = H.save_img(H.orm(np.clip(0.28 + h * 0.08 + H.fnoise(N, 60, 60, 5) * 0.06, 0, 1), np.ones((N, N), np.float32)), 'hammer_orm', True)
brass = H.pbr('brass_hammered', '#c29a52', 0.3, 1.0, normal_tex=ni, rough_tex=ri, nstr=0.8)
pat = K.plain('brass_patina', '#3a2e1e', 0.6, 0.8)
H.lathe('vase', [(0.0, 0.0), (0.05, 0.0), (0.06, 0.008), (0.1, 0.12), (0.095, 0.2), (0.055, 0.28), (0.04, 0.32), (0.055, 0.355), (0.06, 0.36), (0.052, 0.36), (0.046, 0.35)], 56, brass, uvscale=0.12)
H.lathe('inside', [(0.0, 0.33), (0.046, 0.35)], 24, pat)
H.finish('vase_brass', extras={'texres': 512})
