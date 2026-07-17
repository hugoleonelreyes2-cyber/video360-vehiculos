"""
Render orbital 360 para el generador de video de vehículos.

Uso (invocado por backend/jobs/renderizarOrbital.js):
  blender --background --python orbit_render.py -- \
      --glb=modelo.glb --salida=/ruta/frames --frames=240 \
      --ancho=1920 --alto=1080 --fondo=estudio_gris

Genera frame_0000.png ... frame_{frames-1}.png en --salida, con la cámara
arrancando en el frente del vehículo (ver CALIBRACION_ANGULO_INICIAL más
abajo) y dando una vuelta completa de 360 grados.
"""

import bpy
import sys
import argparse
import math
import os

# --- Fondos artísticos disponibles. Agregar entradas nuevas aquí según se
# definan los ambientes de marca. Cada uno es un color RGB plano; se puede
# reemplazar por un HDRI real (world.node_tree) sin cambiar el resto del script.
FONDOS = {
    "estudio_gris": (0.82, 0.82, 0.82),
    "estudio_negro": (0.05, 0.05, 0.05),
    "marca_cofino": (0.94, 0.96, 0.98),
}

# Si el modelo generado no arranca exactamente con el frente hacia la cámara
# en el ángulo 0, ajustar este offset (en grados) en vez de tocar el resto
# del pipeline. Es lo primero a calibrar durante el piloto.
CALIBRACION_ANGULO_INICIAL = 0.0

ALTURA_CAMARA_GRADOS = 12  # elevación de la cámara sobre el plano horizontal


def parsear_argumentos():
    argv = sys.argv[sys.argv.index("--") + 1:]
    parser = argparse.ArgumentParser()
    parser.add_argument("--glb", required=True)
    parser.add_argument("--salida", required=True)
    parser.add_argument("--frames", type=int, required=True)
    parser.add_argument("--ancho", type=int, default=1920)
    parser.add_argument("--alto", type=int, default=1080)
    parser.add_argument("--fondo", default="estudio_gris")
    return parser.parse_args(argv)


def limpiar_escena():
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)


def importar_vehiculo(ruta_glb):
    bpy.ops.import_scene.gltf(filepath=ruta_glb)
    objetos_importados = [o for o in bpy.context.selected_objects]
    return objetos_importados


def calcular_centro_y_radio(objetos):
    min_c = [math.inf, math.inf, math.inf]
    max_c = [-math.inf, -math.inf, -math.inf]
    for obj in objetos:
        for corner in obj.bound_box:
            mundo = obj.matrix_world @ __import__("mathutils").Vector(corner)
            for i in range(3):
                min_c[i] = min(min_c[i], mundo[i])
                max_c[i] = max(max_c[i], mundo[i])
    centro = [(min_c[i] + max_c[i]) / 2 for i in range(3)]
    dimension_mayor = max(max_c[i] - min_c[i] for i in range(3))
    return centro, dimension_mayor


def configurar_fondo(nombre_fondo):
    color = FONDOS.get(nombre_fondo, FONDOS["estudio_gris"])
    world = bpy.context.scene.world or bpy.data.worlds.new("Mundo")
    bpy.context.scene.world = world
    world.use_nodes = True
    fondo_nodo = world.node_tree.nodes.get("Background")
    if fondo_nodo:
        fondo_nodo.inputs[0].default_value = (*color, 1.0)


def configurar_iluminacion(centro, radio):
    # Iluminación de 3 puntos simple, suficiente para un producto tipo showroom.
    posiciones = [
        (radio * 2, -radio * 2, radio * 2, 2.0),   # key light
        (-radio * 2, -radio * 1.5, radio * 1.5, 1.0),  # fill light
        (0, radio * 2, radio * 2.5, 1.5),           # back light
    ]
    for x, y, z, energia in posiciones:
        bpy.ops.object.light_add(type="AREA", location=(centro[0] + x, centro[1] + y, centro[2] + z))
        luz = bpy.context.object
        luz.data.energy = energia * 1000
        luz.data.size = radio


def crear_camara_orbital(centro, radio):
    distancia = radio * 2.2
    bpy.ops.object.camera_add(location=(centro[0], centro[1] - distancia, centro[2] + radio * 0.3))
    camara = bpy.context.object
    bpy.context.scene.camera = camara

    # Empty en el centro del vehículo: la cámara orbita alrededor de este punto.
    bpy.ops.object.empty_add(location=centro)
    pivote = bpy.context.object
    camara.parent = pivote

    restriccion = camara.constraints.new(type="TRACK_TO")
    restriccion.target = pivote
    restriccion.track_axis = "TRACK_NEGATIVE_Z"
    restriccion.up_axis = "UP_Y"

    return pivote


def animar_giro(pivote, total_frames):
    scene = bpy.context.scene
    scene.frame_start = 0
    scene.frame_end = total_frames - 1

    angulo_inicial = math.radians(CALIBRACION_ANGULO_INICIAL)
    pivote.rotation_euler = (0, 0, angulo_inicial)
    pivote.keyframe_insert(data_path="rotation_euler", frame=0)

    # Vuelta completa: el último frame queda a un paso de completar los 360°
    # para que, al reproducir en loop, el regreso al frente sea continuo.
    pivote.rotation_euler = (0, 0, angulo_inicial + 2 * math.pi)
    pivote.keyframe_insert(data_path="rotation_euler", frame=total_frames)

    for fc in pivote.animation_data.action.fcurves:
        for kp in fc.keyframe_points:
            kp.interpolation = "LINEAR"


def configurar_render(ancho, alto, carpeta_salida):
    scene = bpy.context.scene
    scene.render.engine = "CYCLES"
    scene.render.resolution_x = ancho
    scene.render.resolution_y = alto
    scene.render.image_settings.file_format = "PNG"
    scene.render.filepath = os.path.join(carpeta_salida, "frame_")


def main():
    args = parsear_argumentos()
    os.makedirs(args.salida, exist_ok=True)

    limpiar_escena()
    objetos = importar_vehiculo(args.glb)
    centro, dimension_mayor = calcular_centro_y_radio(objetos)
    radio = dimension_mayor / 2

    configurar_fondo(args.fondo)
    configurar_iluminacion(centro, radio)
    pivote = crear_camara_orbital(centro, radio)
    animar_giro(pivote, args.frames)
    configurar_render(args.ancho, args.alto, args.salida)

    bpy.ops.render.render(animation=True)


if __name__ == "__main__":
    main()
