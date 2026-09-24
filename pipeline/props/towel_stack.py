# Stack of four folded towels: two white bath towels + two anthracite hand towels. ~0.35 x 0.28 x 0.17 m
import sys; sys.path.insert(0, 'C:/Users/Owner/HouseListing/pipeline/props')
import helpers as H
H.reset()
white = H.terry_mats('towel_white', '#f3f1ec', '#ebe8e1', seed=9)
grey = H.terry_mats('towel_grey', '#55585c', '#4b4e52', seed=19)
z = 0.0
spec = [(0.34, 0.27, 4, 0.012, white, 0.004, 0.003, 0.01), (0.34, 0.27, 4, 0.012, white, -0.003, 0.002, -0.015),
        (0.32, 0.25, 4, 0.010, grey, 0.002, -0.004, 0.02), (0.32, 0.25, 4, 0.010, grey, -0.004, 0.003, -0.01)]
for i, (w, l, n, t, m, dx, dy, rz) in enumerate(spec):
    H.folded_towel(f'towel{i}', w, l, n, t, m, seed=5 + i, loc=(dx, dy, z), rotz=rz + (3.14159 if i % 2 else 0))
    z += n * t * 0.97
H.finish('towel_stack', extras={'texres': 512})
