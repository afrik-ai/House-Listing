# Boltless steel-frame garage shelving 1.2 x 0.45 x 1.8 m: galvanised slotted angle uprights, 5 shelves
# (chipboard decks on steel beams) at 0.04 / 0.42 / 0.82 / 1.22 / 1.62 m (+ top 1.8). Back (-Z) to the wall.
import sys, os; sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import helpers as H, _p04kit as K
from helpers import V, PI
import math, numpy as np
H.reset()
import _p04shelf as S
S.build(1.2, 0.45, 1.8)
H.finish('garage_shelves_steel')
