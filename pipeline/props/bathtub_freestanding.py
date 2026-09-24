# Freestanding oval double-ended bathtub, white gloss, thin rounded rim, chrome click-drain + overflow.
# 1.70 x 0.60 x 0.80 m (length along X)
import sys; sys.path.insert(0, 'C:/Users/Owner/HouseListing/pipeline/props')
import helpers as H
from helpers import V, PI
import math, numpy as np, bpy

H.reset()
white = H.pbr('acrylic_white', '#f5f5f3', 0.07, spec=0.6, coat=0.4, coat_rough=0.03)
chrome = H.pbr('chrome', '#e3e3e3', 0.07, 1.0)
CNT = 96
def R(a, b, z, n=2.5):
    return H.ring_se(a, b, z, n, CNT)
rings = [
    R(0.600, 0.225, 0.000, 2.4), R(0.625, 0.245, 0.004, 2.4), R(0.640, 0.258, 0.020, 2.4),
    R(0.690, 0.295, 0.110), R(0.745, 0.334, 0.220), R(0.795, 0.366, 0.340), R(0.830, 0.388, 0.460),
    R(0.848, 0.398, 0.550), R(0.851, 0.400, 0.585),
    # rim (rounded, ~20 mm)
    R(0.849, 0.398, 0.596), R(0.843, 0.392, 0.600), R(0.836, 0.385, 0.599), R(0.832, 0.381, 0.593),
    # inside
    R(0.829, 0.378, 0.570), R(0.815, 0.366, 0.470), R(0.785, 0.343, 0.350), R(0.735, 0.308, 0.230),
    R(0.665, 0.262, 0.130), R(0.600, 0.220, 0.085), R(0.540, 0.180, 0.066), R(0.470, 0.140, 0.060),
    R(0.300, 0.080, 0.058, 2.2)]
tub = H.loft('tub', rings, white, cap0=True, cap1=True)
H.recalc(tub)
H.subsurf(tub, 1)
# drain (click-clack) near one end, overflow on the end wall
dx = 0.50
H.lathe('drain', [(0.0, 0.0), (0.034, 0.0), (0.036, 0.002), (0.030, 0.006), (0.0, 0.007)], 48, chrome, loc=(dx, 0, 0.056))
H.lathe('overflow', [(0.0, 0.0), (0.028, 0.0), (0.030, 0.002), (0.024, 0.006), (0.0, 0.007)], 48, chrome, loc=(0.812, 0, 0.47), rot=(0, -PI / 2 - 0.2, 0))
H.finish('bathtub_freestanding')
