import fetch from "node-fetch";
import fs from "node:fs";
import FormData from "form-data";

// Remueve el fondo de las 4 fotos en paralelo.
// Implementación de referencia contra la API estilo remove.bg -- cambiar
// endpoint/payload si se contrata Photoroom, Slazzer u otra.
export async function removerFondo(fotosOriginales) {
  const entradas = Object.entries(fotosOriginales);

  const resultados = await Promise.all(
    entradas.map(async ([angulo, rutaArchivo]) => {
      const form = new FormData();
      form.append("image_file", fs.createReadStream(rutaArchivo));
      form.append("size", "auto");

      const respuesta = await fetch(process.env.BG_REMOVAL_API_URL, {
        method: "POST",
        headers: { "X-Api-Key": process.env.BG_REMOVAL_API_KEY },
        body: form,
      });

      if (!respuesta.ok) {
        throw new Error(
          `remoción de fondo falló para ${angulo}: ${respuesta.status}`
        );
      }

      const rutaSalida = `${rutaArchivo}.limpio.png`;
      const buffer = await respuesta.buffer();
      fs.writeFileSync(rutaSalida, buffer);

      return [angulo, rutaSalida];
    })
  );

  return Object.fromEntries(resultados);
}
