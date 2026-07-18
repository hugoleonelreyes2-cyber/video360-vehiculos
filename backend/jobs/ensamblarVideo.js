import { spawn } from "node:child_process";
import path from "node:path";
import { subirArchivo } from "../lib/storage.js";
import { ANGULOS_A_RENDERIZAR } from "./renderizarOrbital.js";

const FPS_SALIDA = 30;

// Junta los frames renderizados en un .mp4 y sube ese mp4 + las 4 fotos
// limpias (jpg) al almacenamiento. Devuelve las URLs finales.
//
// Solo se renderizaron ANGULOS_A_RENDERIZAR posiciones (ver
// renderizarOrbital.js); aquí se calcula a qué "velocidad de entrada" hay
// que reproducirlas para que, estiradas a FPS_SALIDA, duren exactamente
// lo que el fotógrafo configuró como velocidad de rotación. ffmpeg repite
// cada frame las veces necesarias para rellenar -- no hay interpolación
// real entre ángulos, es un efecto de "pasos", como la mayoría de los
// visores de 360° de e-commerce.
export async function ensamblarVideo({ framesDir, fotosLimpias, config, jobId }) {
  const rutaMp4Local = path.join(framesDir, "giro_360.mp4");
  const duracionSeg = config.velocidadRotacionSeg ?? 8;
  const fpsEntrada = ANGULOS_A_RENDERIZAR / duracionSeg;

  await new Promise((resolve, reject) => {
    const ffmpeg = spawn("ffmpeg", [
      "-y",
      "-framerate", String(fpsEntrada),
      "-i", path.join(framesDir, "frame_%04d.png"),
      "-r", String(FPS_SALIDA),
      "-c:v", "libx264",
      "-pix_fmt", "yuv420p",
      "-b:v", "10M",
      rutaMp4Local,
    ]);

    ffmpeg.stderr.on("data", (d) => process.stderr.write(d));
    ffmpeg.on("close", (codigo) => {
      if (codigo === 0) resolve();
      else reject(new Error(`ffmpeg terminó con código ${codigo}`));
    });
  });

  const videoUrl = await subirArchivo(rutaMp4Local, `vehiculos/${jobId}/giro_360.mp4`);

  const jpgsUrls = {};
  for (const [angulo, rutaLocal] of Object.entries(fotosLimpias)) {
    jpgsUrls[angulo] = await subirArchivo(
      rutaLocal,
      `vehiculos/${jobId}/${angulo}.jpg`
    );
  }

  return { videoUrl, jpgsUrls };
}
