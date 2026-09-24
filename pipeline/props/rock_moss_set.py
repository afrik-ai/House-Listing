# Six mossy granite rocks, variants rock_moss_set_01_rock01..06 (0.9-2.2 m as authored; Landscape scales them
# 0.16-0.28x into bed stones). Chipped-facet silhouettes, lichen/crack texture, moss on up-facing faces.
import sys, os; sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import helpers as H, _p04veg as G
H.reset()
rock, moss = G.rock_mats('rock_moss', seed=11)
S = [(1.0, 0.8, 0.55), (1.3, 0.9, 0.7), (0.7, 0.6, 0.6), (1.6, 1.1, 0.6), (0.9, 1.0, 0.8), (2.0, 1.2, 0.9)]
V = {}
for i, s in enumerate(S):
    V[f'rock_moss_set_01_rock0{i + 1}'] = [G.rock(f'r{i}', s, 20 + i, rock, moss, sub=3, moss_amt=0.4)]
H.finish('rock_moss_set', variants=V)
