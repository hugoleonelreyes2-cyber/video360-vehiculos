import "dotenv/config";
import { Worker } from "bullmq";
import { connection } from "./queue.js";
import { getJob, updateJob } from "./lib/jobStore.js";
import { removerFondo } from "./jobs/removerFondo.js";
import { reconstruir3d } from "./jobs/reconstruir3d.js";
import { renderizarOrbital } from "./jobs/renderizarOrbital.js";
import { ensamblarVideo } from "./jobs/ensamblarVideo.js";

async function procesarVehiculo(jobId) {
  let job = await getJob(jobId);
  if (!job) throw new Error(`job ${jobId} no encontrado`);

  const fotosLimpias = await removerFondo(job.fotosOriginales);
  job = await updateJob(jobId, { fotosLimpias, estado: "fondo_removido" });

  const modelo3dUrl = await reconstruir3d(fotosLimpias);
  job = await updateJob(jobId, { modelo3dUrl, estado: "reconstruido_3d" });

  const framesDir = await renderizarOrbital({
    modelo3dUrl,
    config: job.config,
  });
  job = await updateJob(jobId, { estado: "renderizado" });

  const { videoUrl, jpgsUrls } = await ensamblarVideo({
    framesDir,
    fotosLimpias,
    config: job.config,
    jobId,
  });

  job = await updateJob(jobId, {
    videoFinalUrl: videoUrl,
    jpgsFinalesUrls: jpgsUrls,
    estado: "en_revision", // el fotógrafo aprueba o pide repetir un ángulo
  });

  return job;
}

const worker = new Worker(
  "pipeline-video360",
  async (job) => {
    const { jobId } = job.data;
    try {
      await procesarVehiculo(jobId);
    } catch (err) {
      await updateJob(jobId, { estado: "error", errorMensaje: err.message });
      throw err;
    }
  },
  { connection, concurrency: 3 } // 3 vehículos en paralelo; ajustar según capacidad del worker de render
);

worker.on("failed", (job, err) => {
  console.error(`job ${job?.data?.jobId} falló:`, err.message);
});

console.log("Worker de video360 escuchando la cola...");
