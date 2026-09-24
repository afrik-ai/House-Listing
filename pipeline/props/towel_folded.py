# Single folded bath towel (white terry, dobby border). ~0.34 x 0.27 x 0.05 m
import sys; sys.path.insert(0, 'C:/Users/Owner/HouseListing/pipeline/props')
import helpers as H
H.reset()
mats = H.terry_mats('towel_white', '#f3f1ec', '#ebe8e1', seed=9)
H.folded_towel('towel', 0.34, 0.27, 4, 0.012, mats, seed=3)
H.finish('towel_folded', extras={'texres': 512})
