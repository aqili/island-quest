"""
convert_kenney.py
=================
Blender Python script — converts Kenney Animated Characters 3 (FBX)
to four separate GLB files, one per skin, each with all animations.

Run as:
    blender --background --python scripts/convert_kenney.py

Output files (in public/assets/characters/kenney/):
    humanMale.glb
    humanFemale.glb
    zombieMale.glb
    zombieFemale.glb
"""

import bpy, os, sys, pathlib

# ── Paths ─────────────────────────────────────────────────────────────────────
BASE   = pathlib.Path(__file__).resolve().parent.parent
SRC    = pathlib.Path(r"C:/Users/iogaili/Downloads/kenney_animated-characters-3")
DST    = BASE / "public" / "assets" / "characters" / "kenney"
MODEL  = str(SRC / "Model"      / "characterMedium.fbx")
ANIM   = str(SRC / "Animations")
SKINS_DIR = SRC / "Skins"

DST.mkdir(parents=True, exist_ok=True)

SKINS = [
    ("humanMaleA",    "humanMale"),
    ("humanFemaleA",  "humanFemale"),
    ("zombieMaleA",   "zombieMale"),
    ("zombieFemaleA", "zombieFemale"),
]

ANIMATIONS = ["idle", "jump", "run"]


def clear_scene():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    # Make sure we're in object mode if possible
    try:
        bpy.ops.object.mode_set(mode="OBJECT")
    except Exception:
        pass
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete()
    # Clear orphan data
    for block in [bpy.data.meshes, bpy.data.armatures, bpy.data.materials,
                  bpy.data.images, bpy.data.actions, bpy.data.textures]:
        for item in block:
            block.remove(item)


def import_fbx(path):
    """Import an FBX and return all newly created objects."""
    before = set(o.name for o in bpy.data.objects)
    bpy.ops.import_scene.fbx(filepath=path, use_anim=True, automatic_bone_orientation=True)
    after  = set(o.name for o in bpy.data.objects)
    return [bpy.data.objects[n] for n in (after - before)]


def get_armature(objects=None):
    pool = objects if objects is not None else bpy.data.objects
    for obj in pool:
        if obj.type == "ARMATURE":
            return obj
    return None


def load_animations_onto_armature(main_armature):
    """
    For each animation FBX: import, find the action, rename it,
    push it as an NLA strip onto the main armature, then delete
    the imported armature.
    """
    loaded_actions = []
    for anim_name in ANIMATIONS:
        fbx_path = os.path.join(ANIM, anim_name + ".fbx")
        if not os.path.isfile(fbx_path):
            print(f"  [WARN] Missing animation: {fbx_path}")
            continue

        new_objs = import_fbx(fbx_path)
        anim_arm = get_armature(new_objs)

        if anim_arm is None:
            print(f"  [WARN] No armature in {anim_name}.fbx")
            bpy.ops.object.select_all(action="DESELECT")
            for o in new_objs:
                o.select_set(True)
            bpy.ops.object.delete()
            continue

        if anim_arm.animation_data and anim_arm.animation_data.action:
            action = anim_arm.animation_data.action
            action.name = anim_name
            # Assign to main armature + push to NLA
            if not main_armature.animation_data:
                main_armature.animation_data_create()
            main_armature.animation_data.action = action
            track = main_armature.animation_data.nla_tracks.new()
            track.name = anim_name
            strip = track.strips.new(anim_name, int(action.frame_range[0]), action)
            strip.name = anim_name
            main_armature.animation_data.action = None   # unlink from active slot
            loaded_actions.append(anim_name)
            print(f"  [OK ] Loaded animation '{anim_name}' ({int(action.frame_range[1])} frames)")
        else:
            print(f"  [WARN] No action data in {anim_name}.fbx")

        # Remove the animation armature + its mesh children
        bpy.ops.object.select_all(action="DESELECT")
        for o in new_objs:
            o.select_set(True)
        bpy.ops.object.delete()

    return loaded_actions


def apply_skin_texture(mesh_obj, skin_png_path):
    """Replace every material slot's diffuse texture with the skin PNG."""
    img = bpy.data.images.load(str(skin_png_path), check_existing=False)
    for slot in mesh_obj.material_slots:
        mat = slot.material
        if mat is None:
            continue
        mat.use_nodes = True
        nodes = mat.node_tree.nodes
        links = mat.node_tree.links
        # Find or create an image texture node and link to Principled BSDF
        bsdf = next((n for n in nodes if n.type == "BSDF_PRINCIPLED"), None)
        tex_node = next((n for n in nodes if n.type == "TEX_IMAGE"), None)
        if tex_node is None:
            tex_node = nodes.new("ShaderNodeTexImage")
        tex_node.image = img
        if bsdf:
            links.new(tex_node.outputs["Color"], bsdf.inputs["Base Color"])
        print(f"  [OK ] Applied texture {img.name} to material '{mat.name}'")


def export_glb(filepath):
    bpy.ops.export_scene.gltf(
        filepath=str(filepath),
        export_format="GLB",
        export_animations=True,
        export_nla_strips=True,
        export_nla_strips_merged_animation_name="action",
        export_draco_mesh_compression_enable=False,
        export_apply=False,
        use_selection=False,
        export_yup=True,
    )
    print(f"  [EXPORT] {filepath}")


# ── Main ──────────────────────────────────────────────────────────────────────
print("=" * 60)
print("Kenney Animated Characters 3 → GLB converter")
print("=" * 60)

for skin_file, skin_id in SKINS:
    print(f"\n>>> Processing skin: {skin_id}")
    clear_scene()

    # 1. Import base model
    new_objs = import_fbx(MODEL)
    main_arm = get_armature(new_objs)
    mesh_obj = next((o for o in new_objs if o.type == "MESH"), None)

    if main_arm is None or mesh_obj is None:
        print(f"  [ERROR] Could not find armature or mesh in {MODEL}")
        continue

    print(f"  [OK ] Base model: mesh='{mesh_obj.name}', arm='{main_arm.name}'")

    # 2. Load animations as NLA tracks
    load_animations_onto_armature(main_arm)

    # 3. Apply skin texture
    skin_png = SKINS_DIR / (skin_file + ".png")
    if skin_png.exists():
        apply_skin_texture(mesh_obj, skin_png)
    else:
        print(f"  [WARN] Skin not found: {skin_png}")

    # 4. Export as GLB
    out_path = DST / (skin_id + ".glb")
    export_glb(out_path)

print("\n" + "=" * 60)
print("Done!  GLB files written to:")
print(str(DST))
for _, sid in SKINS:
    p = DST / (sid + ".glb")
    size = p.stat().st_size // 1024 if p.exists() else 0
    status = f"{size} KB" if p.exists() else "MISSING"
    print(f"  {sid}.glb — {status}")
print("=" * 60)
