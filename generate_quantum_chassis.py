"""
Solana Quantum Routing Chassis & Monolithic Blade
Procedural 3D Architectural Chassis Generator for Blender 5.2 LTS
Produces a unified, luxury physical server/router chassis with recessed socket bays,
beveled edge chamfers, optical bus trenches, and precision titanium hardware mounts.
"""

import bpy
import math
import os

OUTPUT_DIR = r"B:\bounties\multihopper\models"
OUTPUT_GLB = os.path.join(OUTPUT_DIR, "quantum_chassis.glb")

def reset_scene():
    bpy.ops.wm.read_factory_settings(use_empty=True)

def create_mat(name, base_color=(1,1,1,1), metallic=0.0, roughness=0.5, emission=(0,0,0,1), emission_strength=0.0):
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

def t3_pos(x, y, z):
    """Maps Three.js coordinates (X-right, Y-up, Z-forward) to Blender (X-right, Y-depth, Z-up)."""
    return (x, -z, y)

def t3_scale(sx, sy, sz):
    """Maps Three.js scale to Blender scale."""
    return (sx, sz, sy)

def build_chassis():
    reset_scene()
    os.makedirs(OUTPUT_DIR, exist_ok=True)

    # 1. PBR Materials - Refined Cinema Grade Obsidian & Brushed Titanium
    mat_chassis = create_mat("Chassis_Obsidian", (0.018, 0.022, 0.032, 1.0), metallic=0.92, roughness=0.32)
    mat_bezel = create_mat("Chassis_Titanium", (0.08, 0.10, 0.13, 1.0), metallic=0.96, roughness=0.20)
    mat_lime_line = create_mat("Chassis_Lime", (0.83, 0.97, 0.23, 1.0), metallic=0.2, roughness=0.15, emission=(0.83, 0.97, 0.23, 1.0), emission_strength=2.2)
    mat_cyan_line = create_mat("Chassis_Cyan", (0.0, 0.95, 1.0, 1.0), metallic=0.2, roughness=0.15, emission=(0.0, 0.95, 1.0, 1.0), emission_strength=2.2)
    mat_glass_trench = create_mat("Chassis_Trench", (0.008, 0.012, 0.018, 1.0), metallic=0.4, roughness=0.08)

    root = bpy.data.objects.new("Chassis_Root", None)
    bpy.context.scene.collection.objects.link(root)

    # 2. Main Monolithic Server Blade (Base Slab)
    # Three.js: Center at (2.0, -1.8, 0.0), scale (36.0, 1.2, 16.0) -> bounds X: [-16, 20], Y: [-2.4, -1.2], Z: [-8, 8]
    bpy.ops.mesh.primitive_cube_add(size=1.0, location=t3_pos(2.0, -1.8, 0.0))
    slab = bpy.context.active_object
    slab.name = "Chassis_Main_Slab"
    slab.scale = t3_scale(36.0, 1.2, 16.0)
    slab.data.materials.append(mat_chassis)
    slab.parent = root

    # 3. Outer Titanium Perimeter Chamfer Rail
    bpy.ops.mesh.primitive_cube_add(size=1.0, location=t3_pos(2.0, -1.18, 0.0))
    rail = bpy.context.active_object
    rail.name = "Chassis_Perimeter_Rail"
    rail.scale = t3_scale(36.4, 0.08, 16.4)
    rail.data.materials.append(mat_bezel)
    rail.parent = root

    # 4. Centerpiece Escrow Well (Recessed Magnetic Suspension Collar)
    # Three.js: pos=(-4.5, -1.0, 1.5)
    bpy.ops.mesh.primitive_cylinder_add(
        vertices=48, radius=3.2, depth=0.45,
        location=t3_pos(-4.5, -1.0, 1.5)
    )
    well = bpy.context.active_object
    well.name = "Chassis_Escrow_Well"
    well.data.materials.append(mat_bezel)
    well.parent = root

    # Stepped Inner Well Trench
    bpy.ops.mesh.primitive_cylinder_add(
        vertices=48, radius=2.6, depth=0.55,
        location=t3_pos(-4.5, -0.95, 1.5)
    )
    inner_well = bpy.context.active_object
    inner_well.name = "Chassis_Inner_Well"
    inner_well.data.materials.append(mat_glass_trench)
    inner_well.parent = root

    # Concentric Luminous Well Ring (Hairline Cyan Pulse)
    bpy.ops.mesh.primitive_torus_add(
        location=t3_pos(-4.5, -0.72, 1.5),
        major_radius=2.85, minor_radius=0.035, major_segments=48, minor_segments=8
    )
    well_ring = bpy.context.active_object
    well_ring.name = "Chassis_Well_Luminous_Ring"
    well_ring.data.materials.append(mat_cyan_line)
    well_ring.parent = root

    # 5. Origin Key Dock Bay (Machined Angled Socket)
    # Three.js: pos=(-13.5, -1.0, 0.0)
    bpy.ops.mesh.primitive_cube_add(
        size=1.0, location=t3_pos(-13.5, -1.0, 0.0)
    )
    origin_dock = bpy.context.active_object
    origin_dock.name = "Chassis_Origin_Dock"
    origin_dock.scale = t3_scale(4.0, 0.35, 4.0)
    origin_dock.data.materials.append(mat_bezel)
    origin_dock.parent = root

    # Origin Luminous Ring
    bpy.ops.mesh.primitive_torus_add(
        location=t3_pos(-13.5, -0.78, 0.0),
        major_radius=1.8, minor_radius=0.03, major_segments=36, minor_segments=8
    )
    origin_ring = bpy.context.active_object
    origin_ring.name = "Chassis_Origin_Ring"
    origin_ring.data.materials.append(mat_lime_line)
    origin_ring.parent = root

    # 6. Relay Socket Bays (Machined Pedestals across the hop arc)
    # In Three.js, the hops arc from -4.5 to 11.25 with Z from 0.7 to -4.7
    relay_coords = [
        (0.75, -1.0, 0.68),
        (6.0, -1.0, -2.0),
        (11.25, -1.0, -4.68)
    ]
    for i, (rx, ry, rz) in enumerate(relay_coords):
        bpy.ops.mesh.primitive_cylinder_add(
            vertices=32, radius=1.6, depth=0.3,
            location=t3_pos(rx, ry, rz)
        )
        r_bay = bpy.context.active_object
        r_bay.name = f"Chassis_Relay_Bay_{i+1}"
        r_bay.data.materials.append(mat_bezel)
        r_bay.parent = root

        # Hairline lime indicator ring on each bay
        bpy.ops.mesh.primitive_torus_add(
            location=t3_pos(rx, ry + 0.16, rz),
            major_radius=1.45, minor_radius=0.025, major_segments=32, minor_segments=8
        )
        r_ring = bpy.context.active_object
        r_ring.name = f"Chassis_Relay_Ring_{i+1}"
        r_ring.data.materials.append(mat_lime_line)
        r_ring.parent = root

    # 7. Destination Collector Bays (Treasury & Contributor)
    dest_coords = [
        (17.5, -1.0, -3.0),
        (17.5, -1.0, 3.0)
    ]
    for i, (dx, dy, dz) in enumerate(dest_coords):
        bpy.ops.mesh.primitive_cube_add(
            size=1.0, location=t3_pos(dx, dy, dz)
        )
        d_bay = bpy.context.active_object
        d_bay.name = f"Chassis_Dest_Bay_{i+1}"
        d_bay.scale = t3_scale(3.4, 0.35, 3.4)
        d_bay.data.materials.append(mat_bezel)
        d_bay.parent = root

        bpy.ops.mesh.primitive_torus_add(
            location=t3_pos(dx, dy + 0.18, dz),
            major_radius=1.5, minor_radius=0.03, major_segments=32, minor_segments=8
        )
        d_ring = bpy.context.active_object
        d_ring.name = f"Chassis_Dest_Ring_{i+1}"
        d_ring.data.materials.append(mat_cyan_line if i == 0 else mat_lime_line)
        d_ring.parent = root

    # 8. Longitudinal Recessed Optical Bus Channel
    bpy.ops.mesh.primitive_cube_add(
        size=1.0, location=t3_pos(2.0, -1.05, 0.0)
    )
    trench = bpy.context.active_object
    trench.name = "Chassis_Optical_Trench"
    trench.scale = t3_scale(32.0, 0.12, 1.2)
    trench.data.materials.append(mat_glass_trench)
    trench.parent = root

    # Hairline Bus Fiber Rails
    for z_off in [-0.45, 0.45]:
        bpy.ops.mesh.primitive_cylinder_add(
            vertices=16, radius=0.025, depth=32.0,
            location=t3_pos(2.0, -0.98, z_off),
            rotation=(0, math.radians(90), 0)
        )
        fiber = bpy.context.active_object
        fiber.name = f"Chassis_Fiber_Rail_{'+' if z_off > 0 else '-'}"
        fiber.data.materials.append(mat_cyan_line)
        fiber.parent = root

    print(f"Exporting Solana Quantum Routing Chassis to: {OUTPUT_GLB}")
    bpy.ops.export_scene.gltf(
        filepath=OUTPUT_GLB,
        export_format='GLB',
        use_selection=False,
        export_apply=True,
        export_yup=True
    )
    print("Quantum Chassis export complete successfully!")

if __name__ == "__main__":
    build_chassis()
