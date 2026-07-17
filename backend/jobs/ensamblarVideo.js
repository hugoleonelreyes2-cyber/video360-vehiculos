import { spawn } from "node:child_process";
import path from "node:path";
import { subirArchivo } from "../lib/storage.js";

const FPS = 30;

// Junta los frames renderizados en un .mp4 y sube ese mp4 + las 4 fotos
// limpias (jpg) al almacenamiento. Devuelve las URLs finales.
export async function ensamblarVideo({ framesDir, fotosLimpias, config, jobId }) {
  const rutaMp4Local = path.join(framesDir, "giro_360.mp4");

  await new Promise((resolve, reject) => {
    const ffmpeg = spawn("ffmpeg", [
      "-y",
      "-framerate", String(FPS),
      "-i", path.join(framesDir, "frame_%04d.png"),
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
