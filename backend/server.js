import "dotenv/config";
import express from "express";
import multer from "multer";
import { v4 as uuid } from "uuid";
import { pipelineQueue } from "./queue.js";
import { getJob, createJob, updateJob } from "./lib/jobStore.js";

const app = express();

// Permite que el frontend publicado en GitHub Pages (otro dominio) llame
// a esta API. Si más adelante usas un dominio propio para el backend,
// puedes restringir el origen en vez de usar "*".
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.header("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.sendStatus(200);
  next();
});

app.use(express.json());
app.use(express.static("../frontend"));

const upload = multer({ dest: "/tmp/video360-uploads" });

const ANGULOS = ["frente", "lateral_derecho", "trasera", "lateral_izquierdo"];

// Crea un job nuevo y sube las 4 fotos requeridas.
// Espera multipart/form-data con un campo de archivo por cada ángulo.
app.post(
  "/api/vehiculos/:vehiculoId/fotos",
  upload.fields(ANGULOS.map((a) => ({ name: a, maxCount: 1 }))),
  async (req, res) => {
    const { vehiculoId } = req.params;
    const faltantes = ANGULOS.filter((a) => !req.files?.[a]);
    if (faltantes.length > 0) {
      return res.status(400).json({
        error: `Faltan fotos para: ${faltantes.join(", ")}`,
      });
    }

    const fotosOriginales = {};
    for (const angulo of ANGULOS) {
      fotosOriginales[angulo] = req.files[angulo][0].path;
    }

    const jobId = uuid();
    const job = await createJob({
      jobId,
      vehiculoId,
      fotografoId: req.body.fotografoId ?? null,
      fotosOriginales,
      config: {
        velocidadRotacionSeg: Number(req.body.velocidadRotacionSeg ?? 8),
        fondo: req.body.fondo ?? "estudio_gris",
        resolucion: req.body.resolucion ?? "1920x1080",
      },
      estado: "capturado",
    });

    await pipelineQueue.add("procesar-vehiculo", { jobId });

    res.status(202).json({ jobId, estado: job.estado });
  }
);

// Estado de un job (para que el frontend haga polling)
app.get("/api/jobs/:jobId", async (req, res) => {
  const job = await getJob(req.params.jobId);
  if (!job) return res.status(404).json({ error: "job no encontrado" });
  res.json(job);
});

// Aprobar el resultado -> pasa a "publicado"
app.post("/api/jobs/:jobId/aprobar", async (req, res) => {
  const job = await updateJob(req.params.jobId, { estado: "publicado" });
  res.json(job);
});

// Repetir un ángulo específico sin rehacer las 4 fotos
app.post(
  "/api/jobs/:jobId/repetir/:angulo",
  upload.single("foto"),
  async (req, res) => {
    const { jobId, angulo } = req.params;
    if (!ANGULOS.includes(angulo)) {
      return res.status(400).json({ error: "ángulo inválido" });
    }
    const job = await getJob(jobId);
    if (!job) return res.status(404).json({ error: "job no encontrado" });

    job.fotosOriginales[angulo] = req.file.path;
    job.intentosPorAngulo[angulo] = (job.intentosPorAngulo[angulo] ?? 1) + 1;
    await updateJob(jobId, {
      fotosOriginales: job.fotosOriginales,
      intentosPorAngulo: job.intentosPorAngulo,
      estado: "capturado",
    });

    await pipelineQueue.add("procesar-vehiculo", { jobId });
    res.status(202).json({ jobId, estado: "capturado" });
  }
);

const port = process.env.PORT ?? 3001;
app.listen(port, () => console.log(`API en http://localhost:${port}`));
