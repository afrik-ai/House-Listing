# Industrial pipe table lamp: black iron pipe fittings, brass valve, Edison bulb with warm glowing filament. ~0.25 x 0.42 m
import sys; sys.path.insert(0, __import__('os').path.dirname(__import__('os').path.abspath(__file__)))
import helpers as H, _kit as K
from helpers import V, PI
import math, random, numpy as np
H.reset()
ir = K.plain('pipe_iron', '#262626', 0.5, 0.8); br = K.brushed('pipe_brass', '#b58f48', 0.3)
glass = H.pbr('bulb_glass', '#ffe3b0', 0.05, alpha=0.35, blend='BLEND'); fil = H.pbr('filament', '#ffb050', 0.4, emit='#ff9a3a', emit_str=12.0)
w = K.wood('lamp_base_wood', light='#6d4e36', mid='#58402c', dark='#3a291b', seed=110)
H.uv_box(H.box('base', 0.22, 0.14, 0.03, loc=(0, 0, 0.015), mat=w, bev=0.004), 1.0, along='x')
H.cyl('flange', 0.03, 0.012, loc=(-0.06, 0, 0.03), seg=24, mat=ir, bev=0.002)
H.cyl('pipe1', 0.012, 0.25, loc=(-0.06, 0, 0.04), seg=16, mat=ir)
H.cyl('elbow', 0.017, 0.035, loc=(-0.06, 0, 0.28), seg=16, mat=ir, bev=0.004)
H.cyl('pipe2', 0.012, 0.12, loc=(-0.06, 0, 0.3), rot=(0, PI / 2, 0), seg=16, mat=ir)
H.cyl('valve', 0.02, 0.03, loc=(-0.01, 0, 0.3), rot=(0, PI / 2, 0), seg=16, mat=br)
H.cyl('wheel', 0.025, 0.005, loc=(0.005, 0, 0.33), seg=16, mat=br)
H.cyl('socket', 0.018, 0.04, loc=(0.06, 0, 0.26), seg=20, mat=br, bev=0.003)
H.lathe('bulb', [(0.012, 0.26), (0.03, 0.22), (0.035, 0.17), (0.02, 0.13), (0.0, 0.125)], 32, glass, loc=(0, 0, 0)).location = (0.06, 0, 0)
H.tube('fil', [V((0.05, 0, 0.21)), V((0.06, 0, 0.16)), V((0.07, 0, 0.21))], 0.0012, 5, fil)
H.finish('table_lamp_pipe', extras={'texres': 256})
