# Wide low steel shelving unit 1.5 x 0.5 x 1.5 m, anthracite powder-coat frame, 4 decks. Back (-Z) to wall.
import sys, os; sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import helpers as H, _p04kit as K
from helpers import V, PI
import math, numpy as np
H.reset()
import _p04shelf as S
S.build(1.5, 0.5, 1.5, levels=(0.04, 0.5, 1.0, 1.48), frame=K.painted('frame_anthracite', '#34373a', 0.5, 0.6))
H.finish('shelves_steel_03')
