import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { v4 as uuid } from "uuid";
import fetch from "node-fetch";

const FPS = 30;

// Descarga el .glb, corre Blender headless con orbit_render.py y devuelve
// la carpeta con los frames renderizados (PNG con fondo ya compuesto).
export async function renderizarOrbital({ modelo3dUrl, config }) {
  const tmpDir = process.env.RENDER_TMP_DIR ?? "/tmp/video360-render";
  const carpetaJob = path.join(tmpDir, uuid());
  fs.mkdirSync(carpetaJob, { recursive: true });

  const rutaGlb = path.join(carpetaJob, "modelo.glb");
  await descargarArchivo(modelo3dUrl, rutaGlb);

  const [ancho, alto] = (config.resolucion ?? "1920x1080").split("x").map(Number);
  const totalFrames = Math.round((config.velocidadRotacionSeg ?? 8) * FPS);

  await new Promise((resolve, reject) => {
    const args = [
      "--background",
      "--python",
      process.env.RENDER_SCRIPT_PATH ?? "../render/orbit_render.py",
      "--",
      `--glb=${rutaGlb}`,
      `--salida=${carpetaJob}`,
      `--frames=${totalFrames}`,
      `--ancho=${ancho}`,
      `--alto=${alto}`,
      `--fondo=${config.fondo ?? "estudio_gris"}`,
    ];

    const blender = spawn(process.env.BLENDER_BIN ?? "blender", args);

    blender.stderr.on("data", (d) => process.stderr.write(d));
    blender.on("close", (codigo) => {
      if (codigo === 0) resolve();
      else reject(new Error(`Blender terminó con código ${codigo}`));
    });
  });

  return carpetaJob; // contiene frame_0000.png ... frame_NNNN.png
}

async function descargarArchivo(url, destino) {
  const respuesta = await fetch(url);
  const buffer = await respuesta.buffer();
  fs.writeFileSync(destino, buffer);
}
