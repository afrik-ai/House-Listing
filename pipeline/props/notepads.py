# Stack of 3 notebooks (kraft, black, sage) with elastic band and a ballpoint pen on top. ~0.22 x 0.15 x 0.05 m
import sys; sys.path.insert(0, __import__('os').path.dirname(__import__('os').path.abspath(__file__)))
import helpers as H, _kit as K
from helpers import V, PI
import math, random, numpy as np
H.reset()
cs = [K.plain('nb_kraft', '#b08d62', 0.8), K.plain('nb_black', '#1b1b1d', 0.6), K.plain('nb_sage', '#7f8f78', 0.7)]
pg = K.plain('nb_pages', '#f3efe4', 0.9); el = K.plain('nb_elastic', '#8a2b22', 0.6); pen = K.plain('nb_pen', '#1d2f5a', 0.35); chrome = K.plain('nb_chrome', '#d0d0d0', 0.1, 1.0)
z = 0
for i, c in enumerate(cs):
    rz = (i - 1) * 0.08
    K.book('nb', 0.15, 0.21, 0.014, c, pg, loc=(0.0, 0.0, z), rotz=rz)
    z += 0.014
H.box('elastic', 0.004, 0.215, 0.0152, loc=(0.06, 0.0, z - 0.007), mat=el).rotation_euler = (0, 0, 0.08)
H.tube('pen', [V((-0.05, -0.08, z + 0.005)), V((0.03, 0.08, z + 0.005))], 0.0045, 10, pen)
H.tube('clip', [V((0.02, 0.06, z + 0.01)), V((0.015, 0.04, z + 0.01))], 0.0012, 5, chrome)
H.finish('notepads', extras={'texres': 256})
