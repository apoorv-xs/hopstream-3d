"""
MultiHopper Kinetic Reactor & Crystalline Escrow Core
Procedural 3D Asset Generator for Blender 5.2 LTS
Produces an award-winning bespoke WebGL centerpiece GLB with concentric orbital rings,
faceted quartz crystal lattice, titanium heat sink fins, and PBR emission channels.
"""

import bpy
import math
import os

OUTPUT_DIR = r"B:\bounties\multihopper\models"
OUTPUT_GLB = os.path.join(OUTPUT_DIR, "multihopper_reactor.glb")

def reset_scene():
    """Clear all default objects, meshes, and materials."""
    bpy.ops.wm.read_factory_settings(use_empty=True)

def create_material(name, base_color=(1, 1, 1, 1), metallic=0.0, roughness=0.5, emission=(0, 0, 0, 1), emission_strength=0.0):
    """Create a Principled BSDF material with custom PBR properties."""
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

def build_multihopper_reactor():
    reset_scene()
    os.makedirs(OUTPUT_DIR, exist_ok=True)

    # 1. Materials
    # MultiHopper Acid Lime Accent (Controlled luminescence, sharp edge definition)
    mat_lime = create_material(
        "MH_AcidLime",
        base_color=(0.83, 0.97, 0.23, 1.0),
        metallic=0.8,
        roughness=0.2,
        emission=(0.83, 0.97, 0.23, 1.0),
        emission_strength=1.2
    )
    # Solana Electric Cyan
    mat_cyan = create_material(
        "MH_Cyan",
        base_color=(0.0, 0.95, 1.0, 1.0),
        metallic=0.7,
        roughness=0.2,
        emission=(0.0, 0.95, 1.0, 1.0),
        emission_strength=1.0
    )
    # Solana Royal Purple
    mat_purple = create_material(
        "MH_Purple",
        base_color=(0.6, 0.27, 1.0, 1.0),
        metallic=0.7,
        roughness=0.25,
        emission=(0.6, 0.27, 1.0, 1.0),
        emission_strength=0.9
    )
    # Titanium Carbon Obsidian (Deep metallic body with crisp specularity)
    mat_titanium = create_material(
        "MH_Titanium",
        base_color=(0.03, 0.04, 0.06, 1.0),
        metallic=0.98,
        roughness=0.22
    )
    # Crystalline Diamond Core (Refractive faceted diamond, subtle inner glow)
    mat_crystal = create_material(
        "MH_CoreCrystal",
        base_color=(0.95, 1.0, 0.98, 1.0),
        metallic=0.05,
        roughness=0.05,
        emission=(0.83, 0.97, 0.23, 1.0),
        emission_strength=0.4
    )

    # Root Hierarchy Empty
    reactor_root = bpy.data.objects.new("Reactor_Root", None)
    bpy.context.scene.collection.objects.link(reactor_root)

    # 2. Crystalline Central Core (Icosahedron / Diamond Escrow)
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=2, radius=0.65, location=(0, 0, 0))
    core_mesh = bpy.context.active_object
    core_mesh.name = "Reactor_Core_Crystal"
    core_mesh.data.materials.append(mat_crystal)
    core_mesh.parent = reactor_root

    # Inner Singularity Emitter
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=1, radius=0.25, location=(0, 0, 0))
    emitter = bpy.context.active_object
    emitter.name = "Reactor_Inner_Singularity"
    emitter.data.materials.append(mat_lime)
    emitter.parent = core_mesh

    # 3. Concentric Orbital Rings (Matching MultiHopper Brand Swirl)
    # Ring 1: Outer Heavy Titanium Shield with Lime Inlays
    bpy.ops.mesh.primitive_torus_add(
        align='WORLD', location=(0, 0, 0), rotation=(0, 0, 0),
        major_radius=1.85, minor_radius=0.065, major_segments=64, minor_segments=16
    )
    ring_outer = bpy.context.active_object
    ring_outer.name = "Orbital_Ring_Outer"
    ring_outer.data.materials.append(mat_titanium)
    ring_outer.parent = reactor_root

    # Ring 1 Accent Nodes (6 orbital satellite beads)
    for i in range(6):
        angle = (2 * math.pi / 6) * i
        x = 1.85 * math.cos(angle)
        y = 1.85 * math.sin(angle)
        bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=1, radius=0.09, location=(x, y, 0))
        bead = bpy.context.active_object
        bead.name = f"Outer_Bead_{i}"
        bead.data.materials.append(mat_lime)
        bead.parent = ring_outer

    # Ring 2: Mid Gimbal Ring (Rotated 45 degrees, Cyan Emissive)
    bpy.ops.mesh.primitive_torus_add(
        align='WORLD', location=(0, 0, 0), rotation=(math.radians(45), math.radians(25), 0),
        major_radius=1.4, minor_radius=0.05, major_segments=48, minor_segments=12
    )
    ring_mid = bpy.context.active_object
    ring_mid.name = "Orbital_Ring_Mid"
    ring_mid.data.materials.append(mat_cyan)
    ring_mid.parent = reactor_root

    # Ring 3: Inner High-Frequency Swirl (Rotated -55 degrees, Purple Emissive)
    bpy.ops.mesh.primitive_torus_add(
        align='WORLD', location=(0, 0, 0), rotation=(math.radians(-55), math.radians(-35), math.radians(30)),
        major_radius=0.98, minor_radius=0.04, major_segments=40, minor_segments=12
    )
    ring_inner = bpy.context.active_object
    ring_inner.name = "Orbital_Ring_Inner"
    ring_inner.data.materials.append(mat_purple)
    ring_inner.parent = reactor_root

    # 4. Token-2022 Radial Radiator / Hook Guard Fins (12 directional fins)
    for i in range(12):
        angle = (2 * math.pi / 12) * i
        bpy.ops.mesh.primitive_cube_add(
            size=1.0,
            location=(0.85 * math.cos(angle), 0.85 * math.sin(angle), 0)
        )
        fin = bpy.context.active_object
        fin.name = f"Radiator_Fin_{i}"
        fin.scale = (0.28, 0.025, 0.12)
        fin.rotation_euler = (0, 0, angle)
        fin.data.materials.append(mat_titanium)
        fin.parent = reactor_root

    # 5. Export to GLTF/GLB
    print(f"Exporting MultiHopper Kinetic Reactor to: {OUTPUT_GLB}")
    bpy.ops.export_scene.gltf(
        filepath=OUTPUT_GLB,
        export_format='GLB',
        use_selection=False,
        export_apply=True,
        export_yup=True
    )
    print("Export complete successfully!")

if __name__ == "__main__":
    build_multihopper_reactor()
