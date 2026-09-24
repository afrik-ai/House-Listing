# Wall sconce: brass back plate + swing arm + opal globe (emissive). Back at -Z (wall). ~0.18 x 0.28 x 0.26 m
import sys; sys.path.insert(0, __import__('os').path.dirname(__import__('os').path.abspath(__file__)))
import helpers as H, _kit as K
from helpers import V, PI
import math, random, numpy as np
H.reset()
br = K.brushed('sconce_brass', '#b8914a', 0.3); opal = H.pbr('sconce_opal', '#fff7ea', 0.35, emit='#ffd8a0', emit_str=5.0)
H.cyl('plate', 0.06, 0.012, loc=(0, 0.0, 0.14), rot=(PI / 2, 0, 0), seg=40, mat=br, bev=0.003)
H.tube('arm', [V((0, -0.01, 0.14)), V((0, -0.12, 0.14)), V((0, -0.16, 0.18))], 0.008, 10, br)
H.cyl('cup', 0.03, 0.03, loc=(0, -0.16, 0.18), seg=24, mat=br, bev=0.004)
H.superellipsoid('globe', 0.08, 0.08, 0.08, e=2, n=2, nu=40, nv=20, mat=opal, loc=(0, -0.16, 0.28))
H.finish('wall_sconce', extras={'texres': 256})
