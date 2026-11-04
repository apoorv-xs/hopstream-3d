"""
MultiHopper Timelock Relayer & Keeper Oracle Prism
Procedural 3D Asset Generator for Blender 5.2 LTS
Produces a bespoke intermediate hop node GLB with dual interlocking faceted pyramids,
orbital timelock dial ring, and emissive pulse core.
"""

import bpy
import math
import os

OUTPUT_DIR = r"B:\bounties\multihopper\models"
OUTPUT_GLB = os.path.join(OUTPUT_DIR, "multihopper_relay.glb")

def reset_scene():
    bpy.ops.wm.read_factory_settings(use_empty=True)

def create_material(name, base_color=(1, 1, 1, 1), metallic=0.0, roughness=0.5, emission=(0, 0, 0, 1), emission_strength=0.0):
    mat = bpy.data.materials.new(name=name)
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes.get("Principled BSDF")
    if bsdf:
        bsdf.inputs["Base Color"].default_value = base_color
        bsdf.inputs["Metallic"].default_value = metallic
        bsdf.inputs["Roughness"].default_value = roughness
        bsdf.inputs["Emission Color"].default_value = emission
        bsdf.inputs["Emission Strength"].default_value = emission_strength
    return mat

def build_timelock_relay():
    reset_scene()
    os.makedirs(OUTPUT_DIR, exist_ok=True)

    # 1. Materials (Crisp obsidian geometry with fine luminous seams)
    mat_lime = create_material(
        "Relay_Lime",
        base_color=(0.83, 0.97, 0.23, 1.0),
        metallic=0.8,
        roughness=0.2,
        emission=(0.83, 0.97, 0.23, 1.0),
        emission_strength=0.9
    )
    mat_carbon = create_material(
        "Relay_Carbon",
        base_color=(0.04, 0.05, 0.07, 1.0),
        metallic=0.96,
        roughness=0.25
    )
    mat_crystal = create_material(
        "Relay_Glass",
        base_color=(0.92, 0.98, 0.92, 1.0),
        metallic=0.1,
        roughness=0.06,
        emission=(0.83, 0.97, 0.23, 1.0),
        emission_strength=0.35
    )

    root = bpy.data.objects.new("Relay_Root", None)
    bpy.context.scene.collection.objects.link(root)

    # 2. Dual Interlocking Faceted Octahedron Pyramids
    bpy.ops.mesh.primitive_cone_add(vertices=4, radius1=0.85, depth=1.4, location=(0, 0, 0.35))
    top_pyr = bpy.context.active_object
    top_pyr.name = "Relay_Top_Prism"
    top_pyr.data.materials.append(mat_crystal)
    top_pyr.parent = root

    bpy.ops.mesh.primitive_cone_add(vertices=4, radius1=0.85, depth=1.4, location=(0, 0, -0.35), rotation=(0, math.radians(180), 0))
    bot_pyr = bpy.context.active_object
    bot_pyr.name = "Relay_Bottom_Prism"
    bot_pyr.data.materials.append(mat_carbon)
    bot_pyr.parent = root

    # 3. Inner Pulsing Timelock Core
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=1, radius=0.32, location=(0, 0, 0))
    core = bpy.context.active_object
    core.name = "Relay_Inner_Core"
    core.data.materials.append(mat_lime)
    core.parent = root

    # 4. Orbital Timelock Dial Ring (Horizontal)
    bpy.ops.mesh.primitive_torus_add(
        align='WORLD', location=(0, 0, 0),
        major_radius=1.35, minor_radius=0.04, major_segments=48, minor_segments=8
    )
    ring = bpy.context.active_object
    ring.name = "Relay_Dial_Ring"
    ring.data.materials.append(mat_lime)
    ring.parent = root

    # 4 Floating Satellite Shards around the ring
    for i in range(4):
        angle = (2 * math.pi / 4) * i
        x = 1.35 * math.cos(angle)
        y = 1.35 * math.sin(angle)
        bpy.ops.mesh.primitive_cube_add(size=0.14, location=(x, y, 0), rotation=(0, 0, angle))
        shard = bpy.context.active_object
        shard.name = f"Relay_Shard_{i}"
        shard.data.materials.append(mat_carbon)
        shard.parent = ring

    print(f"Exporting Timelock Relayer to: {OUTPUT_GLB}")
    bpy.ops.export_scene.gltf(
        filepath=OUTPUT_GLB,
        export_format='GLB',
        use_selection=False,
        export_apply=True,
        export_yup=True
    )
    print("Relay export complete successfully!")

if __name__ == "__main__":
    build_timelock_relay()
