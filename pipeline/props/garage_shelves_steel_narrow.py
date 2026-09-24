# Narrow boltless steel shelving 0.6 x 0.35 x 1.8 m (5 decks at 0.04 / 0.42 / 0.82 / 1.22 / 1.62 m). Back (-Z) to wall.
import sys, os; sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import helpers as H, _p04kit as K
from helpers import V, PI
import math, numpy as np
H.reset()
import _p04shelf as S
S.build(0.6, 0.35, 1.8)
H.finish('garage_shelves_steel_narrow')
