# Classic yellow rubber duck with orange beak and painted eyes. Built ~0.23 m long (placed at x0.4).
import sys; sys.path.insert(0, __import__('os').path.dirname(__import__('os').path.abspath(__file__)))
import helpers as H, _kit as K
H.reset()
y = K.plain('duck_yellow', '#f2c318', 0.35, coat=0.3); o = K.plain('duck_beak', '#e8641c', 0.35); k = K.plain('duck_eye', '#101010', 0.2)
H.superellipsoid('body', 0.11, 0.08, 0.065, e=2.2, n=2.2, nu=40, nv=20, mat=y, loc=(0, 0.01, 0.065), zfn=lambda x, yy, z: z + (0.03 * max(0, yy / 0.08) ** 2 if z > 0 else 0))
H.superellipsoid('head', 0.055, 0.055, 0.055, e=2, n=2, nu=32, nv=16, mat=y, loc=(0, -0.06, 0.15))
b = H.superellipsoid('beak', 0.025, 0.035, 0.012, e=2.5, n=2.5, nu=20, nv=10, mat=o, loc=(0, -0.115, 0.14))
for s in (-1, 1):
    H.superellipsoid('eye', 0.009, 0.006, 0.011, e=2, n=2, nu=12, nv=8, mat=k, loc=(s * 0.03, -0.103, 0.17))
H.finish('rubber_duck', extras={'texres': 256})
