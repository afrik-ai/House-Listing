# Enamelled cast-iron casserole (cocotte): deep teal enamel with darker rim, cream interior, lid with brass knob. ~0.30 x 0.17 m
import sys; sys.path.insert(0, __import__('os').path.dirname(__import__('os').path.abspath(__file__)))
import helpers as H, _kit as K
from helpers import V, PI
import math, random, numpy as np
H.reset()
en = K.glaze('enamel_teal', '#2f6b6a', rough=0.18, seed=12)
cr = K.plain('enamel_cream', '#ece3cf', 0.3)
brass = K.brushed('pot_knob_brass', '#c39a52', 0.25)
iron = K.plain('cast_iron_rim', '#1d1d1d', 0.6, 0.6)
H.lathe('pot', [(0.0, 0.0), (0.1, 0.0), (0.115, 0.01), (0.12, 0.05), (0.12, 0.11), (0.115, 0.113), (0.11, 0.11), (0.11, 0.015), (0.0, 0.012)], 56, en, uvscale=0.15)
H.lathe('inside', [(0.0, 0.013), (0.108, 0.016), (0.108, 0.105)], 48, cr)
H.lathe('rim', [(0.11, 0.108), (0.121, 0.108), (0.121, 0.114), (0.11, 0.114)], 48, iron)
H.lathe('lid', [(0.123, 0.112), (0.123, 0.12), (0.1, 0.14), (0.02, 0.15), (0.0, 0.15)], 56, en, uvscale=0.15)
H.lathe('knob', [(0.0, 0.15), (0.015, 0.15), (0.01, 0.16), (0.022, 0.172), (0.0, 0.175)], 24, brass)
for s in (-1, 1):
    h = H.superellipsoid('handle', 0.025, 0.045, 0.01, e=3, n=3, nu=24, nv=8, mat=en, loc=(s * 0.14, 0, 0.1))
H.finish('pot_enamel', extras={'texres': 512})
