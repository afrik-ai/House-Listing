# Industrial enamel pendant: dark green enamel cone shade, white inside, cage-free Edison bulb, cloth cord.
# Shade bottom y=0, canopy at y~0.97.
import sys; sys.path.insert(0, __import__('os').path.dirname(__import__('os').path.abspath(__file__)))
import helpers as H, _kit as K
from helpers import V, PI
import math, random, numpy as np
H.reset()
en = K.glaze('ind_enamel', '#2e4a3c', rough=0.3, seed=111); wh = K.plain('ind_inner', '#f1eee6', 0.5)
bulb = H.pbr('ind_bulb', '#fff0d0', 0.3, emit='#ffc27a', emit_str=6.0); cord = K.plain('ind_cord', '#141414', 0.85); br = K.brushed('ind_brass', '#a78444', 0.3)
sh = H.lathe('shade', [(0.17, 0.0), (0.16, 0.02), (0.07, 0.15), (0.035, 0.18), (0.03, 0.22)], 48, en); H.solidify(sh, 0.0015)
H.lathe('inner', [(0.165, 0.002), (0.068, 0.148), (0.0, 0.17)], 48, wh)
H.superellipsoid('bulb', 0.03, 0.03, 0.04, e=2, n=2, nu=20, nv=10, mat=bulb, loc=(0, 0, 0.08))
H.cyl('cap', 0.03, 0.04, loc=(0, 0, 0.21), seg=20, mat=br)
H.cyl('cord', 0.003, 0.72, loc=(0, 0, 0.25), seg=8, mat=cord)
H.lathe('canopy', [(0.0, 0.94), (0.05, 0.94), (0.055, 0.97), (0.0, 0.97)], 32, en)
H.finish('pendant_lamp_industrial', extras={'texres': 256})
