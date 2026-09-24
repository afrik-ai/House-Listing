# Pair of throw pillows leaning together: terracotta linen + ivory knit with contrast piping. ~0.70 x 0.45 m
import sys; sys.path.insert(0, __import__('os').path.dirname(__import__('os').path.abspath(__file__)))
import helpers as H, _kit as K
from helpers import V, PI
import math, random, numpy as np
H.reset()
a = K.fabric('pillow_terracotta', '#a95b3c', threads=80, seed=80, sheen=0.0)
b = K.fabric('pillow_ivory', '#e4dccb', threads=40, seed=81, strength=2.2, sheen=0.0)
p = K.fabric('pillow_pipe', '#3a3a3a', threads=140, seed=82)
K.cushion('p1', 0.45, 0.45, 0.13, a, loc=(-0.14, 0.0, 0.22), crown=1.0, e=4, rot=(PI / 2 - 0.25, 0, 0.1))
K.cushion('p2', 0.42, 0.42, 0.12, b, loc=(0.16, -0.04, 0.2), crown=1.0, e=4, pipe=p, pipe_r=0.004, rot=(PI / 2 - 0.35, 0.15, -0.15))
H.finish('throw_pillows', extras={'texres': 1024})
