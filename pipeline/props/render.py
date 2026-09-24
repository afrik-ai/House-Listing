# Review renders of packed props: imports public/assets/models/<name>.glb (the shipped file) and renders an
# EEVEE 3/4 studio shot to reviews/props/<name>.png (800x600).
# usage: blender -b --python pipeline/props/render.py -- name [name ...] [--az 35] [--el 18] [--zoom 1] [--suffix _x]
#        [--target x,y,z] (look-at in glTF-space metres, overrides bbox centre) [--dist d]
import bpy, sys, math, os
from mathutils import Vector as V

ROOT = __import__('os').path.abspath(__import__('os').path.join(__import__('os').path.dirname(__file__), '..', '..'))
argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
opts = {'az': 35.0, 'el': 18.0, 'zoom': 1.0, 'suffix': '', 'target': None, 'dist': None, 'w': 800, 'h': 600, 'lens': 50.0, 'only': None, 'wall': 0.0}
names = []
i = 0
while i < len(argv):
    a = argv[i]
    if a.startswith('--'):
        k = a[2:]; v = argv[i + 1]; i += 2
        opts[k] = v if k in ('suffix', 'target', 'only') else float(v)
    else:
        names.append(a); i += 1

def setup_world(sc):
    """HDRI sky for lighting/reflections, flat neutral grey for camera rays (studio look)."""
    w = bpy.data.worlds.new('studio'); sc.world = w
    try: w.use_nodes = True
    except Exception: pass
    nt = w.node_tree
    bg = nt.nodes.get('Background'); out = nt.nodes.get('World Output')
    env = nt.nodes.new('ShaderNodeTexEnvironment')
    env.image = bpy.data.images.load(f'{ROOT}/public/assets/hdri/day_partly_cloudy_1k.hdr')
    nt.links.new(env.outputs['Color'], bg.inputs['Color']); bg.inputs['Strength'].default_value = 0.35
    grey = nt.nodes.new('ShaderNodeBackground'); grey.inputs['Color'].default_value = (0.36, 0.36, 0.37, 1)
    lp = nt.nodes.new('ShaderNodeLightPath'); mix = nt.nodes.new('ShaderNodeMixShader')
    nt.links.new(lp.outputs['Is Camera Ray'], mix.inputs['Fac'])
    nt.links.new(bg.outputs['Background'], mix.inputs[1]); nt.links.new(grey.outputs['Background'], mix.inputs[2])
    nt.links.new(mix.outputs['Shader'], out.inputs['Surface'])

def area(name, loc, target, size, power, color=(1, 1, 1)):
    l = bpy.data.lights.new(name, 'AREA'); l.shape = 'DISK'; l.size = size; l.energy = power; l.color = color
    o = bpy.data.objects.new(name, l); bpy.context.scene.collection.objects.link(o)
    o.location = loc
    o.rotation_euler = (V(target) - V(loc)).to_track_quat('-Z', 'Y').to_euler()
    return o

for name in names:
    bpy.ops.wm.read_factory_settings(use_empty=True)
    sc = bpy.context.scene
    bpy.ops.import_scene.gltf(filepath=f'{ROOT}/public/assets/models/{name}.glb')
    if opts['only']:
        keep = set(opts['only'].split(','))
        for o in list(sc.objects):
            if o.type == 'MESH' and o.name.split('.')[0] not in keep: bpy.data.objects.remove(o)
    mn = V((1e9,) * 3); mx = V((-1e9,) * 3)
    dg = bpy.context.evaluated_depsgraph_get()
    for o in sc.objects:
        if o.type != 'MESH': continue
        for v in o.data.vertices:
            w = o.matrix_world @ v.co
            for k in range(3): mn[k] = min(mn[k], w[k]); mx[k] = max(mx[k], w[k])
    size = mx - mn
    c = (mn + mx) / 2
    if opts['target']:
        t = [float(x) for x in opts['target'].split(',')]
        c = V((t[0], -t[2], t[1]))  # glTF (x,y,z) -> Blender (x,-z,y)
    R = max(size.length / 2, 0.05)
    flat = size.z < 0.12 * max(size.x, size.y)
    if flat and opts['el'] == 18.0:
        opts_el = 38.0; R = max(size.x, size.y) * 0.42
    else:
        opts_el = opts['el']
    # floor + sweep backdrop
    fl = max(size.x, size.y) * 6 + 4
    bpy.ops.mesh.primitive_plane_add(size=fl, location=(c.x, c.y, min(mn.z, 0) - 0.0005))
    # darker floor for pale flat things (rugs/towels) so edges read
    floor = sc.objects[-1] if sc.objects[-1].type == 'MESH' else bpy.context.active_object
    floor = bpy.context.active_object
    fm = bpy.data.materials.new('floor'); fm.use_nodes = True
    bs = fm.node_tree.nodes['Principled BSDF']; bs.inputs['Base Color'].default_value = (0.5, 0.5, 0.52, 1); bs.inputs['Roughness'].default_value = 0.6
    floor.data.materials.append(fm)
    if opts['wall']:
        bpy.ops.mesh.primitive_plane_add(size=fl, location=(c.x, mx.y + 0.001, fl / 2 - 0.01), rotation=(math.pi / 2, 0, 0))
        wm = bpy.data.materials.new('wall'); wm.use_nodes = True
        wb = wm.node_tree.nodes['Principled BSDF']; wb.inputs['Base Color'].default_value = (0.75, 0.75, 0.74, 1); wb.inputs['Roughness'].default_value = 0.8
        bpy.context.active_object.data.materials.append(wm)
    setup_world(sc)
    az = math.radians(opts['az']); el = math.radians(opts_el)
    # model front faces -Y in Blender (glTF +Z); camera at front-right
    d = V((math.sin(az) * math.cos(el), -math.cos(az) * math.cos(el), math.sin(el)))
    cam_d = bpy.data.cameras.new('cam'); cam_d.lens = opts['lens']; cam_d.sensor_width = 36
    cam = bpy.data.objects.new('cam', cam_d); sc.collection.objects.link(cam); sc.camera = cam
    fov = 2 * math.atan(18 / cam_d.lens) * 0.75  # vertical-ish (4:3)
    dist = opts['dist'] or (R / math.sin(fov / 2) * 1.08 / opts['zoom'])
    cam.location = c + d * dist
    cam.rotation_euler = (c - cam.location).to_track_quat('-Z', 'Y').to_euler()
    cam_d.clip_start = max(0.005, dist * 0.01); cam_d.clip_end = dist * 20
    s = max(R, 0.3)
    area('key', c + V((-1.2, -1.4, 1.6)) * s * 3, c, s * 3, 900 * s * s)
    area('fill', c + V((1.8, -0.8, 0.7)) * s * 3, c, s * 4, 280 * s * s)
    area('rim', c + V((0.6, 2.0, 1.4)) * s * 3, c, s * 2.5, 500 * s * s)
    sc.render.engine = 'BLENDER_EEVEE'
    ee = sc.eevee
    for k, v in (('taa_render_samples', 64), ('use_raytracing', True), ('use_shadows', True), ('use_gtao', True)):
        try: setattr(ee, k, v)
        except Exception: pass
    try: sc.view_settings.view_transform = 'AgX'; sc.view_settings.look = 'AgX - Medium High Contrast'
    except Exception:
        try: sc.view_settings.look = 'None'
        except Exception: pass
    sc.render.resolution_x = int(opts['w']); sc.render.resolution_y = int(opts['h']); sc.render.resolution_percentage = 100
    sc.render.film_transparent = False
    os.makedirs(f'{ROOT}/reviews/props', exist_ok=True)
    sc.render.filepath = f"{ROOT}/reviews/props/{name}{opts['suffix']}.png"
    sc.render.image_settings.file_format = 'PNG'
    bpy.ops.render.render(write_still=True)
    print('RENDERED', sc.render.filepath, 'size', [round(x, 3) for x in size])
