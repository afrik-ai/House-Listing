# Front-loading washing machine: white enamel body, graphite porthole door with glass bowl, steel drum,
# detergent drawer, dial + display. 0.60 x 0.85 x 0.60 m
import sys; sys.path.insert(0, 'C:/Users/Owner/HouseListing/pipeline/props')
import helpers as H
from helpers import V, PI
import math, numpy as np, bpy

H.reset()
N = 512
# drum: perforated stainless (colour + normal), holes in a staggered grid
y, x = np.mgrid[0:N, 0:N].astype(np.float32) / N
cells = 16
gx, gy = x * cells, y * cells
off = (np.floor(gy) % 2) * 0.5
fx = (gx + off) % 1 - 0.5; fy = gy % 1 - 0.5
d = np.sqrt(fx ** 2 + fy ** 2)
hole = np.clip((0.16 - d) / 0.03, 0, 1)
emb = np.clip(1 - np.abs(d - 0.27) / 0.08, 0, 1) * 0.4  # embossed dimple ring
bb = H.tex_brushed(N, 31)
drum_c = H.save_img(H.colmix(hole * 0.95, '#b8bbbe', '#101112') * (1 - 0.04 * bb[..., None]), 'wm_drum_c')
drum_n = H.save_img(H.h2n(-hole * 3 + emb * 3 + bb * 0.05, 1.0), 'wm_drum_n', True)
drum = H.pbr('drum_steel', '#ffffff', 0.32, 1.0, base_tex=drum_c, normal_tex=drum_n, cull=False)

white = H.pbr('enamel_white', '#f1f1ef', 0.22, coat=0.3, coat_rough=0.1)
panel = H.pbr('panel_white', '#e9e9e7', 0.35)
graphite = H.pbr('door_graphite', '#3b3d40', 0.25, 0.8)
chrome = H.pbr('chrome', '#dcdcdc', 0.1, 1.0)
rubber = H.pbr('gasket_rubber', '#6e7072', 0.6, cull=False)
glass = H.pbr('door_glass', '#20262b', 0.04, alpha=0.32, blend='BLEND', cull=False, spec=0.7)
black = H.pbr('black_gloss', '#0c0c0c', 0.12)
icon = H.pbr('display_digits', '#ffffff', 0.4, emit='#7fd6ff', emit_str=5.0)
grey = H.pbr('grey_plastic', '#b9bbbd', 0.4)

W, D, HT = 0.598, 0.575, 0.850
yf = -D / 2
# body shell as a front panel with a round hole + separate box for the rest (boolean hole)
body = H.box_minmax('body', (-W / 2, yf, 0.0), (W / 2, D / 2, HT - 0.02), mat=white)
H.bevel(body, 0.008, 3)
body = H.apply_mods(body)
dz = 0.44  # door centre height
c1 = H.cyl('holecut', 0.2, 0.12, loc=(0, yf - 0.05, dz), rot=(-PI / 2, 0, 0), seg=64, mat=rubber)
c2 = H.cyl('holecut2', 0.25, 0.40, loc=(0, yf + 0.06, dz), rot=(-PI / 2, 0, 0), seg=64, mat=rubber)
cut = H.join([c1, c2], 'cut')
bm_ = body.modifiers.new('hole', 'BOOLEAN'); bm_.object = cut; bm_.operation = 'DIFFERENCE'; bm_.solver = 'EXACT'
bm_.material_mode = 'TRANSFER'
body = H.apply_mods(body); bpy.data.objects.remove(cut)
H.sharpen(body, 40)
H.wnormal(body)
# worktop lid (slightly larger)
top = H.box_minmax('top', (-W / 2 - 0.001, yf - 0.002, HT - 0.02), (W / 2 + 0.001, D / 2, HT), mat=white, bev=0.006, seg=3)
# control panel strip: front face band z 0.73..0.83 in slightly different white + drawer on the left
H.box_minmax('panel', (-W / 2 + 0.004, yf - 0.004, 0.735), (W / 2 - 0.004, yf + 0.01, HT - 0.024), mat=panel, bev=0.004, seg=3)
H.box_minmax('drawer', (-W / 2 + 0.012, yf - 0.012, 0.745), (-0.07, yf - 0.002, HT - 0.034), mat=white, bev=0.005, seg=3)
H.box_minmax('drawer_grip', (-W / 2 + 0.03, yf - 0.0125, 0.748), (-0.09, yf - 0.009, 0.756), mat=grey, bev=0.002, seg=2)
# dial
kx = 0.12
H.cyl('dial_ring', 0.036, 0.004, loc=(kx, yf - 0.004, 0.786), rot=(PI / 2, 0, 0), seg=48, mat=chrome, bev=0.0015, bseg=2)
H.cyl('dial', 0.03, 0.022, loc=(kx, yf - 0.006, 0.786), rot=(PI / 2, 0, 0), seg=48, mat=grey, bev=0.004, bseg=3)
H.box('dial_mark', 0.003, 0.002, 0.012, loc=(kx, yf - 0.0285, 0.806), mat=black)
# display
H.box('display', 0.10, 0.003, 0.036, loc=(0.0, yf - 0.0055, 0.79), mat=black, bev=0.003, seg=2)
H.text('digits', '1:29', 0.022, (0.0, yf - 0.0075, 0.79), mat=icon)
for i in range(4):
    H.cyl('btn', 0.0065, 0.004, loc=(0.2 + (i % 2) * 0.03, yf - 0.004, 0.772 + (i // 2) * 0.03), rot=(PI / 2, 0, 0), seg=20, mat=grey, bev=0.0015, bseg=2)
# door: graphite ring (lathe profile in local XY -> rotated to face -Y)
Rr = 0.235
prof = [(0.150, 0.0), (0.160, -0.012), (0.185, -0.030), (0.215, -0.036), (Rr - 0.004, -0.034), (Rr, -0.026), (Rr + 0.001, -0.012), (Rr - 0.004, 0.0)]
ring = H.lathe('door_ring', [(r, z) for r, z in prof] + [(0.150, 0.0)], 72, graphite, loc=(0, yf - 0.002, dz), rot=(-PI / 2, 0, 0))
H.sharpen(ring, 50)
H.subsurf(ring, 1)
# chrome inner trim
H.lathe('door_trim', [(0.148, -0.001), (0.151, -0.014), (0.160, -0.016), (0.163, -0.004)], 72, chrome, loc=(0, yf - 0.002, dz), rot=(-PI / 2, 0, 0))
# glass bowl (convex into the drum)
gprof = [(0.0, 0.07), (0.06, 0.065), (0.11, 0.045), (0.14, 0.02), (0.152, -0.01)]
H.lathe('door_glass', gprof, 64, glass, loc=(0, yf - 0.002, dz), rot=(-PI / 2, 0, 0))
# handle recess on the right of the door ring
H.box('door_handle', 0.03, 0.02, 0.09, loc=(Rr - 0.01, yf - 0.03, dz), mat=graphite, bev=0.008, seg=3)
# gasket + drum
gk = [(0.2, -0.001), (0.186, 0.02), (0.19, 0.045), (0.205, 0.058), (0.242, 0.066)]
H.lathe('gasket', gk, 64, rubber, loc=(0, yf, dz), rot=(-PI / 2, 0, 0))
dr = H.lathe('drum', [(0.24, 0.065), (0.24, 0.40), (0.0, 0.40)], 48, drum, loc=(0, yf, dz), rot=(-PI / 2, 0, 0), uvscale=0.12)
for i in range(3):
    a = 2 * PI * i / 3 + 0.3
    p = H.box('lifter', 0.03, 0.30, 0.04, loc=(0.225 * math.cos(a), yf + 0.23, dz + 0.225 * math.sin(a)), mat=grey, rot=(0, -a + PI / 2, 0), bev=0.01, seg=2)
# service flap bottom right + kick strip
H.box_minmax('flap', (0.17, yf - 0.003, 0.03), (0.27, yf + 0.001, 0.095), mat=white, bev=0.003, seg=2)
H.box_minmax('kick', (-W / 2 + 0.01, yf - 0.001, 0.0), (W / 2 - 0.01, yf + 0.002, 0.012), mat=grey)
# feet
for x_ in (-0.25, 0.25):
    for y_ in (yf + 0.05, D / 2 - 0.05):
        H.cyl('foot', 0.016, 0.012, loc=(x_, y_, -0.012), seg=16, mat=grey)
H.finish('washing_machine')
