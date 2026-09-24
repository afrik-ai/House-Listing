"""
Preview renders of the exported house GLB (verifies the actual export, not the build scene).

    blender.exe -b --factory-startup --python pipeline/blender/render_previews.py -- <house-id> [outdir] [--only name,name] [--engine eevee|workbench]

Cameras are given in HOUSE coordinates (X east, Y up, Z south).
"""
import bpy, json, math, os, sys
from mathutils import Vector

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..', '..'))
ARGV = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
pos_args = [a for a in ARGV if not a.startswith('--')]
opts = {}
for i, a in enumerate(ARGV):
    if a.startswith('--') and i + 1 < len(ARGV):
        opts[a[2:]] = ARGV[i + 1]
HOUSE_ID = pos_args[0] if pos_args else 'villa-nova'
OUT = os.path.join(ROOT, pos_args[1]) if len(pos_args) > 1 and not pos_args[1] in opts.values() else os.path.join(ROOT, 'reviews', 'p02-blender')
ONLY = set(opts.get('only', '').split(',')) - {''}
ENGINE = opts.get('engine', 'eevee')
RES = opts.get('res', '1280x720').split('x')
os.makedirs(OUT, exist_ok=True)
GLB = os.path.join(ROOT, 'public', 'assets', 'houses', HOUSE_ID, 'house.glb')
H = json.load(open(os.path.join(ROOT, 'houses', HOUSE_ID, 'house.json'), encoding='utf-8'))
META = json.load(open(os.path.join(ROOT, 'public', 'assets', 'houses', HOUSE_ID, 'house.meta.json'), encoding='utf-8'))


def B(p):
    return Vector((p[0], -p[2], p[1]))


bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=GLB)
sc = bpy.context.scene
for ob in list(sc.objects):
    if ob.name.startswith('COL_'):
        ob.hide_render = True
        ob.hide_viewport = True

if opts.get('doors') == 'open':
    for ob in sc.objects:
        if ob.name.startswith('DOOR_') and ob.type == 'EMPTY' and 'swing' in ob.keys():
            ob.rotation_mode = 'XYZ'
            ob.rotation_euler[2] = ob['swing'] * 1.4

# --- context: ground at grade, lawn, pool, a few simple neighbours ---------------------------
grade = H.get('site', {}).get('grade_y', 0.0)


def mat(name, col, rough=0.8, emit=None, alpha=1.0, transmission=0.0):
    m = bpy.data.materials.new(name)
    try:
        m.use_nodes = True
    except Exception:
        pass
    b = m.node_tree.nodes['Principled BSDF']
    b.inputs['Base Color'].default_value = (*col, 1)
    b.inputs['Roughness'].default_value = rough
    if emit:
        b.inputs['Emission Color'].default_value = (*emit, 1)
        b.inputs['Emission Strength'].default_value = 3.0
    m.diffuse_color = (*col, alpha)
    return m


def box(name, x0, x1, y0, y1, z0, z1, m):
    bpy.ops.mesh.primitive_cube_add(size=1)
    ob = bpy.context.active_object
    ob.name = name
    ob.scale = (x1 - x0, z1 - z0, y1 - y0)
    ob.location = ((x0 + x1) / 2, -(z0 + z1) / 2, (y0 + y1) / 2)
    ob.data.materials.append(m)
    return ob


lawn = mat('ctx_lawn', (0.09, 0.16, 0.05), 0.95)
pave = mat('ctx_pave', (0.45, 0.44, 0.42), 0.9)
water = mat('ctx_water', (0.02, 0.18, 0.28), 0.05)
box('ctx_ground', -30, 40, grade - 0.2, grade - 0.005, -25, 30, lawn)
p = H['site'].get('pool')
if p:
    x0, x1, z0, z1 = p['x'], p['x'] + p['w'], p['z'], p['z'] + p['d']
    box('ctx_deck_n', x0 - 0.8, -2.6, grade, -0.02, z0 - 1.5, z0, pave)
    box('ctx_deck_s', x0 - 0.8, -2.6, grade, -0.02, z1, z1 + 1.0, pave)
    box('ctx_deck_w', x0 - 0.8, x0, grade, -0.02, z0, z1, pave)
    box('ctx_deck_e', x1, -2.6, grade, -0.02, z0, z1, pave)
    box('ctx_pool_water', x0, x1, -1.2, -0.12, z0, z1, water)

# --- materials tweak for preview: glass see-through -----------------------------------------
for m in bpy.data.materials:
    if m.name.startswith('glass'):
        try:
            b = m.node_tree.nodes.get('Principled BSDF')
            b.inputs['Alpha'].default_value = 0.18
            b.inputs['Transmission Weight'].default_value = 0.0
            b.inputs['Roughness'].default_value = 0.05
            m.surface_render_method = 'BLENDED'
        except Exception as e:
            print('glass tweak', e)

# --- lighting: sky + sun from SW, interior fill lights at LIGHT_ empties ---------------------
world = bpy.data.worlds.new('w')
sc.world = world
try:
    world.use_nodes = True
except Exception:
    pass
nt = world.node_tree
bg = nt.nodes.get('Background')
try:
    sky = nt.nodes.new('ShaderNodeTexSky')
    sky.sky_type = 'MULTIPLE_SCATTERING' if 'MULTIPLE_SCATTERING' in [e.identifier for e in sky.bl_rna.properties['sky_type'].enum_items] else sky.sky_type
    sky.sun_elevation = math.radians(28)
    sky.sun_rotation = math.radians(225)
    nt.links.new(sky.outputs['Color'], bg.inputs['Color'])
    bg.inputs['Strength'].default_value = 0.35
except Exception as e:
    print('sky failed', e)
    bg.inputs['Color'].default_value = (0.5, 0.65, 0.9, 1)
    bg.inputs['Strength'].default_value = 0.8

sun_d = bpy.data.lights.new('sun', 'SUN')
sun_d.energy = 4.0
sun_d.angle = math.radians(1.5)
sun_d.color = (1.0, 0.93, 0.82)
sun = bpy.data.objects.new('sun', sun_d)
sc.collection.objects.link(sun)
# direction: light travels from SW-up towards NE-down.  house: SW = (-x, +z); blender: (-x, -y)
d = Vector((1.0, 1.0, -0.75)).normalized()   # travel direction in blender coords (towards +x, +y(north), down)
sun.rotation_euler = d.to_track_quat('-Z', 'Y').to_euler()

interior = opts.get('interior', '1') == '1'
if interior:
    for L in META['lights']:
        if L['type'] in ('downlight', 'ceiling', 'strip', 'pendant'):
            ld = bpy.data.lights.new('pl_' + L['id'], 'POINT')
            ld.energy = 60 if L['type'] != 'strip' else 120
            ld.color = (1.0, 0.9, 0.78)
            ld.shadow_soft_size = 0.2
            ld.use_shadow = False
            lo = bpy.data.objects.new('pl_' + L['id'], ld)
            lo.location = B((L['pos'][0], L['pos'][1] - 0.15, L['pos'][2]))
            sc.collection.objects.link(lo)

# --- render settings ---------------------------------------------------------------------------
sc.render.resolution_x, sc.render.resolution_y = int(RES[0]), int(RES[1])
sc.render.resolution_percentage = 100
sc.render.image_settings.file_format = 'PNG'
if ENGINE == 'workbench':
    sc.render.engine = 'BLENDER_WORKBENCH'
    sh = sc.display.shading
    sh.light = 'STUDIO'
    sh.color_type = 'MATERIAL'
    sh.show_shadows = True
    sh.show_cavity = True
    sh.cavity_type = 'BOTH'
    sc.display.shadow_focus = 0.8
else:
    sc.render.engine = 'BLENDER_EEVEE'
    ee = sc.eevee
    for k, v in (('taa_render_samples', 48), ('use_shadows', True), ('use_raytracing', True), ('fast_gi_method', 'GLOBAL_ILLUMINATION')):
        try:
            setattr(ee, k, v)
        except Exception:
            pass
    try:
        sc.view_settings.view_transform = 'AgX'
        sc.view_settings.look = 'AgX - Base Contrast'
    except Exception:
        try:
            sc.view_settings.look = 'None'
        except Exception:
            pass
    sc.view_settings.exposure = float(opts.get('exposure', 0.0))

cam_d = bpy.data.cameras.new('cam')
cam = bpy.data.objects.new('cam', cam_d)
sc.collection.objects.link(cam)
sc.camera = cam

VIEWS = [
    ('01_west_from_pool', (-15.5, 1.7, 9.5), (4.0, 2.6, 4.2), 30, 0.0),
    ('02_east_from_street', (24.5, 1.7, 10.5), (10.0, 2.3, 1.2), 30, 0.0),
    ('03_sw_aerial', (-13.0, 15.0, 24.0), (5.5, 1.5, 3.5), 32, 0.0),
    ('04_living_to_terrace', (7.4, 1.55, 5.4), (0.0, 1.2, 8.6), 16, 0.0),
    ('05_kitchen', (4.2, 1.6, 6.3), (11.2, 0.9, 9.6), 16, 0.0),
    ('06_landing_stair', (3.75, 4.75, 6.1), (8.6, 2.9, 2.8), 16, 0.0),
    ('07_north_east', (22.0, 2.0, -12.0), (6.0, 2.0, 2.0), 32, 0.0),
    ('08_hall_stair', (9.3, 1.6, 4.3), (3.5, 2.2, 3.0), 16, 0.0),
    ('09_master', (0.6, 4.75, 9.9), (2.8, 4.1, 5.0), 16, 0.0),
    ('10_entrance', (19.0, 1.5, 4.2), (11.5, 1.5, 4.5), 26, 0.0),
]
extra = opts.get('cam')
if extra:   # --cam name:x,y,z:tx,ty,tz:lens
    n, a, b_, l = extra.split(':')
    VIEWS.append((n, tuple(map(float, a.split(','))), tuple(map(float, b_.split(','))), float(l), 0.0))
    if ONLY:
        ONLY.add(n)
for name, pos, tgt, lens, _ in VIEWS:
    if ONLY and name not in ONLY and name.split('_')[0] not in ONLY:
        continue
    cam.location = B(pos)
    cam.rotation_euler = (B(tgt) - B(pos)).to_track_quat('-Z', 'Y').to_euler()
    cam_d.lens = lens
    cam_d.sensor_width = 36
    cam_d.clip_start = 0.05
    cam_d.clip_end = 300
    sc.render.filepath = os.path.join(OUT, name + '.png')
    bpy.ops.render.render(write_still=True)
    print('rendered', sc.render.filepath, flush=True)
