# Desk stationery set: ceramic pen pot with pens/pencils, spiral notepad with a pencil, sticky-note block,
# brass paper clips tray. ~0.30 x 0.20 m
import sys; sys.path.insert(0, __import__('os').path.dirname(__import__('os').path.abspath(__file__)))
import helpers as H, _kit as K
from helpers import V, PI
import math, random, numpy as np
H.reset()
pot = K.glaze('pot_terracotta', '#b8674a', rough=0.6, speck=0.3, seed=50)
pap = K.plain('notepad_paper', '#f7f5ef', 0.9)
cov = K.plain('notepad_cover', '#2f4f3f', 0.7)
wire = K.plain('spiral_wire', '#bfbfbf', 0.3, 1.0)
yel = K.plain('pencil_yellow', '#e7b52a', 0.5); wood_t = K.plain('pencil_wood', '#d7b58a', 0.8); lead = K.plain('graphite', '#2b2b2b', 0.5)
pk = K.plain('pen_black', '#141414', 0.35); pb = K.plain('pen_blue', '#2b4f9a', 0.35)
sticky = K.plain('sticky_note', '#f1d85b', 0.85)
H.lathe('pot', [(0.0, 0.0), (0.035, 0.0), (0.038, 0.1), (0.034, 0.1), (0.032, 0.008), (0.0, 0.008)], 32, pot, uvscale=0.1, loc=(0.1, 0.05, 0))
rnd = random.Random(8)
for i, m in enumerate((yel, pk, pb, yel, pk)):
    a = i * 1.25; top = V((0.1 + math.cos(a) * 0.035, 0.05 + math.sin(a) * 0.035, 0.16 + rnd.uniform(0, 0.02)))
    base = V((0.1 + math.cos(a) * 0.012, 0.05 + math.sin(a) * 0.012, 0.01))
    H.tube('pen', [base, top], 0.0045, 6 if m is yel else 10, m)
H.box('pad_back', 0.15, 0.21, 0.003, loc=(-0.06, -0.01, 0.0015), mat=cov, bev=0.001, seg=1)
H.box('pad', 0.148, 0.2, 0.012, loc=(-0.06, -0.014, 0.009), mat=pap)
for i in range(14):
    H.cyl('coil', 0.005, 0.002, loc=(-0.06 - 0.065 + i * 0.01, 0.092, 0.01), rot=(0, PI / 2, 0), seg=10, mat=wire)
H.tube('pencil', [V((-0.12, -0.08, 0.019)), V((0.0, -0.03, 0.019))], 0.0035, 6, yel)
H.cyl('tip', 0.0035, 0.014, loc=(0.0, -0.03, 0.019), rot=(0, PI / 2, 0.39), seg=6, mat=wood_t, r2=0.0008)
H.box('sticky', 0.075, 0.075, 0.018, loc=(0.1, -0.07, 0.009), mat=sticky, bev=0.0005, seg=1).rotation_euler = (0, 0, 0.2)
H.finish('stationery', extras={'texres': 256})
