// Implementación de referencia. En producción, reemplazar por Postgres o
// Firestore -- la interfaz (createJob/getJob/updateJob) se mantiene igual
// para no tocar el resto del código.

const jobs = new Map();

export async function createJob(data) {
  const job = { intentosPorAngulo: {}, ...data };
  jobs.set(job.jobId, job);
  return job;
}

export async function getJob(jobId) {
  return jobs.get(jobId) ?? null;
}

export async function updateJob(jobId, patch) {
  const job = jobs.get(jobId);
  if (!job) throw new Error(`job ${jobId} no existe`);
  const actualizado = { ...job, ...patch };
  jobs.set(jobId, actualizado);
  return actualizado;
}
