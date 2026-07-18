// Guarda los jobs en Redis (el mismo Redis que ya usamos para la cola).
// Esto es necesario porque la API y el worker corren como procesos
// separados -- guardarlos solo en memoria (como en una primera versión de
// este archivo) hace que el worker no pueda ver los jobs que crea la API.
// En producción, si el volumen crece mucho, se puede migrar a Postgres,
// pero para 500 vehículos/mes Redis es más que suficiente.
import { connection } from "../queue.js";

const PREFIJO = "job:";

export async function createJob(data) {
  const job = { intentosPorAngulo: {}, ...data };
  await connection.set(PREFIJO + job.jobId, JSON.stringify(job));
  return job;
}

export async function getJob(jobId) {
  const bruto = await connection.get(PREFIJO + jobId);
  return bruto ? JSON.parse(bruto) : null;
}

export async function updateJob(jobId, patch) {
  const job = await getJob(jobId);
  if (!job) throw new Error(`job ${jobId} no existe`);
  const actualizado = { ...job, ...patch };
  await connection.set(PREFIJO + jobId, JSON.stringify(actualizado));
  return actualizado;
}
