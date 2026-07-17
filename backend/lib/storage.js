// Implementación de referencia. Reemplazar el cuerpo de subirArchivo por el
// SDK del proveedor elegido (AWS S3, Google Cloud Storage o Cloudflare R2).
// La interfaz (ruta local -> URL pública) se mantiene igual para el resto
// del pipeline.
import fs from "node:fs";

export async function subirArchivo(rutaLocal, rutaDestino) {
  // Ejemplo con AWS S3 (@aws-sdk/client-s3):
  //
  // import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
  // const s3 = new S3Client({});
  // await s3.send(new PutObjectCommand({
  //   Bucket: process.env.STORAGE_BUCKET,
  //   Key: rutaDestino,
  //   Body: fs.createReadStream(rutaLocal),
  // }));
  // return `${process.env.STORAGE_PUBLIC_CDN_URL}/${rutaDestino}`;

  throw new Error(
    "storage.js: implementar subirArchivo() con el SDK del proveedor elegido"
  );
}
