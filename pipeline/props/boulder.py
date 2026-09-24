# Weathered grey boulder (~1.4 m). Landscape (gabions) also reuses its normal + ORM maps for cage stones.
import sys, os; sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import helpers as H, _p04veg as G
H.reset()
rock, _ = G.rock_mats('boulder_rock', seed=5, moss=False, col=('#57544f', '#8b877f', '#aaa59b'))
G.rock('boulder', (1.4, 1.1, 0.85), 7, rock, None, sub=6)
H.finish('boulder')
