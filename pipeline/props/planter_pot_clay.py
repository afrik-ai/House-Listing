# Large terracotta garden pot 0.5 m dia x 0.45 m with rolled rim, filled with soil. Plant it with a prop.
import sys, os; sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import helpers as H, _p04kit as K
from helpers import V, PI
import math, numpy as np
H.reset()
import _p04veg as G
G.pot('pot', 0.25, 0.45, 'taper', K.terracotta(), K.soil(), rim=0.03)
H.finish('planter_pot_clay')
