# Blender headless: import every GLB in public/assets/models, report tris + bbox, render a workbench thumbnail.
# usage: blender -b --python scripts/assets/blender_verify.py -- <thumb_dir> [name ...]
import bpy, sys, os, json, math, mathutils
argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
TH = argv[0] if argv else None
only = set(argv[1:])
D = 'C:/Users/Owner/HouseListing/public/assets/models/'
res = {}
sc = bpy.context.scene
sc.render.engine = 'BLENDER_WORKBENCH'
sc.display.shading.light = 'STUDIO'; sc.display.shading.color_type = 'TEXTURE'
sc.render.resolution_x = sc.render.resolution_y = 200; sc.render.film_transparent = False
sc.world = sc.world or bpy.data.worlds.new('w')
for f in sorted(os.listdir(D)):
    if not f.endswith('.glb') or (only and f[:-4] not in only): continue
    bpy.ops.wm.read_factory_settings(use_empty=True)
    sc = bpy.context.scene
    try:
        bpy.ops.import_scene.gltf(filepath=D + f)
    except Exception as e:
        res[f] = {'error': str(e)}; print('IMPORT FAIL', f, e); continue
    dg = bpy.context.evaluated_depsgraph_get()
    tris = 0; mn = [1e9]*3; mx = [-1e9]*3
    for o in sc.objects:
        if o.type != 'MESH': continue
        me = o.evaluated_get(dg).to_mesh()
        me.calc_loop_triangles(); tris += len(me.loop_triangles)
        for v in me.vertices:
            w = o.matrix_world @ v.co
            for i in range(3): mn[i] = min(mn[i], w[i]); mx[i] = max(mx[i], w[i])
        o.evaluated_get(dg).to_mesh_clear()
    # blender Z-up: glTF Y-up is converted, so base should be at z=0
    res[f] = {'tris': tris, 'min': [round(x, 3) for x in mn], 'max': [round(x, 3) for x in mx]}
    if TH:
        sc.render.engine = 'BLENDER_WORKBENCH'
        sc.display.shading.light = 'STUDIO'; sc.display.shading.color_type = 'TEXTURE'
        sc.render.resolution_x = sc.render.resolution_y = 200
        w = bpy.data.worlds.new('w'); sc.world = w; w.color = (0.9, 0.9, 0.9)
        c = mathutils.Vector([(mn[i] + mx[i]) / 2 for i in range(3)]); r = max(mathutils.Vector(mx) - mathutils.Vector(mn)) * 0.9 + 0.01
        cam = bpy.data.objects.new('cam', bpy.data.cameras.new('cam')); sc.collection.objects.link(cam); sc.camera = cam
        cam.data.type = 'ORTHO'; cam.data.ortho_scale = r * 1.35
        d = mathutils.Vector((1.0, -1.4, 0.8)).normalized()
        cam.location = c + d * r * 4; cam.rotation_euler = (c - cam.location).to_track_quat('-Z', 'Y').to_euler()
        cam.data.clip_end = r * 20
        sc.render.filepath = TH + '/' + f[:-4] + '.png'
        bpy.ops.render.render(write_still=True)
print('VERIFY_JSON ' + json.dumps(res))
