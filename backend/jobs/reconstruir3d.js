import fetch from "node-fetch";

const ORDEN_VISTAS = ["frente", "lateral_derecho", "trasera", "lateral_izquierdo"];
const INTERVALO_POLLING_MS = 5000;
const MAX_INTENTOS_POLLING = 60; // 5 minutos máx

// Envía las 4 fotos limpias a la API de reconstrucción 3D multi-vista y
// espera el modelo (.glb) resultante. El contrato exacto de request/response
// depende del proveedor contratado -- ajustar submitTarea/consultarEstado.
export async function reconstruir3d(fotosLimpias) {
  const imagenesOrdenadas = ORDEN_VISTAS.map((v) => fotosLimpias[v]);

  const taskId = await submitTarea(imagenesOrdenadas);
  return await esperarResultado(taskId);
}

async function submitTarea(imagenesUrls) {
  const respuesta = await fetch(process.env.RECONSTRUCTION_3D_API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.RECONSTRUCTION_3D_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      mode: "multiview-to-3d",
      images: imagenesUrls,
      texture: true,
    }),
  });

  if (!respuesta.ok) {
    throw new Error(`no se pudo enviar la tarea de reconstrucción 3D: ${respuesta.status}`);
  }

  const { task_id } = await respuesta.json();
  return task_id;
}

async function esperarResultado(taskId) {
  for (let intento = 0; intento < MAX_INTENTOS_POLLING; intento++) {
    const respuesta = await fetch(
      `${process.env.RECONSTRUCTION_3D_API_URL}/status/${taskId}`,
      { headers: { Authorization: `Bearer ${process.env.RECONSTRUCTION_3D_API_KEY}` } }
    );
    const estado = await respuesta.json();

    if (estado.status === "completed") return estado.output.glb_url;
    if (estado.status === "failed") {
      throw new Error(`reconstrucción 3D falló: ${estado.error ?? "sin detalle"}`);
    }

    await new Promise((r) => setTimeout(r, INTERVALO_POLLING_MS));
  }

  throw new Error("tiempo de espera agotado en reconstrucción 3D");
}
