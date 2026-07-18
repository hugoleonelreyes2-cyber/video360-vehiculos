import fetch from "node-fetch";
import fs from "node:fs";
import FormData from "form-data";

const BASE_URL = "https://api.tripo3d.ai/v2/openapi";
const INTERVALO_POLLING_MS = 5000;
const MAX_INTENTOS_POLLING = 60; // ~5 minutos máx

// Tripo exige las 4 vistas en este orden exacto: frente, izquierdo, trasera, derecho.
const ORDEN_VISTAS = ["frente", "lateral_izquierdo", "trasera", "lateral_derecho"];

// Sube las 4 fotos limpias a Tripo y espera el modelo 3D (.glb) resultante.
export async function reconstruir3d(fotosLimpias) {
  const tokens = [];
  for (const angulo of ORDEN_VISTAS) {
    const ruta = fotosLimpias[angulo];
    tokens.push(await subirImagen(ruta));
  }

  const taskId = await submitTarea(tokens);
  return await esperarResultado(taskId);
}

async function subirImagen(rutaArchivo) {
  const form = new FormData();
  form.append("file", fs.createReadStream(rutaArchivo));

  const respuesta = await fetch(`${BASE_URL}/upload`, {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.RECONSTRUCTION_3D_API_KEY}` },
    body: form,
  });

  if (!respuesta.ok) {
    throw new Error(`no se pudo subir imagen a Tripo: ${respuesta.status}`);
  }
  const { data } = await respuesta.json();
  return data.image_token;
}

async function submitTarea(tokens) {
  const respuesta = await fetch(`${BASE_URL}/task`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.RECONSTRUCTION_3D_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      type: "multiview_to_model",
      files: tokens.map((token) => ({ type: "jpg", file_token: token })),
      texture: true,
    }),
  });

  if (!respuesta.ok) {
    const texto = await respuesta.text();
    throw new Error(`no se pudo enviar la tarea de reconstrucción 3D: ${respuesta.status} ${texto}`);
  }

  const { data } = await respuesta.json();
  return data.task_id;
}

async function esperarResultado(taskId) {
  for (let intento = 0; intento < MAX_INTENTOS_POLLING; intento++) {
    const respuesta = await fetch(`${BASE_URL}/task/${taskId}`, {
      headers: { Authorization: `Bearer ${process.env.RECONSTRUCTION_3D_API_KEY}` },
    });
    const { data } = await respuesta.json();

    if (data.status === "success") {
      return data.output?.pbr_model || data.output?.model || data.output?.base_model;
    }
    if (data.status === "failed") {
      throw new Error(`reconstrucción 3D falló: ${data.error ?? "sin detalle"}`);
    }

    await new Promise((r) => setTimeout(r, INTERVALO_POLLING_MS));
  }

  throw new Error("tiempo de espera agotado en reconstrucción 3D");
}
