# Squat round bud vase, glossy celadon glaze. ~0.14 x 0.17 m
import sys; sys.path.insert(0, __import__('os').path.dirname(__import__('os').path.abspath(__file__)))
import helpers as H, _kit as K
H.reset()
g = K.glaze('glaze_celadon', '#9fb3a2', rough=0.18, speck=0, seed=5)
inside = K.plain('vase_inside', '#2e2a26', 0.9)
H.lathe('vase', [(0.0, 0.0), (0.04, 0.0), (0.05, 0.006), (0.07, 0.05), (0.072, 0.09), (0.05, 0.13), (0.022, 0.15), (0.02, 0.165), (0.026, 0.172), (0.018, 0.172), (0.016, 0.15)], 48, g, uvscale=0.15)
H.lathe('inside', [(0.0, 0.15), (0.016, 0.15)], 24, inside)

H.finish('vase_ceramic_02', extras={'texres': 512})
