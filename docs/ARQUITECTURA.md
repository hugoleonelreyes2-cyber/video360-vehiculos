# Arquitectura — Generador de video 360° (4 fotos)

## 1. Componentes

| Componente | Responsabilidad | Tecnología sugerida |
|---|---|---|
| Frontend fotógrafo | Captura guiada, panel de control, revisión | HTML/JS estático (mismo patrón simple que ya usa el equipo) |
| API | Recibe fotos, crea jobs, expone estado | Node.js + Express |
| Cola de trabajos | Ejecuta las etapas de forma asíncrona | Redis + BullMQ |
| Remoción de fondo | Limpia las 4 fotos | API externa (remove.bg / Photoroom / equivalente) |
| Reconstrucción 3D | Genera modelo 3D texturizado (GLB) desde las 4 vistas | Tripo 3.0 Multiview o Hunyuan3D V2 Multi-View |
| Render orbital | Cámara recorriendo 360° alrededor del GLB | Blender headless (bpy) — recomendado por fotorrealismo |
| Ensamblado | Frames renderizados → mp4 | ffmpeg |
| Almacenamiento | Fotos, jpgs limpios, GLB, mp4 | S3 / GCS / Cloudflare R2 + CDN |
| Base de datos | Estado del job por vehículo | Postgres o Firestore |

## 2. Contrato de datos por vehículo

```json
{
  "vehiculo_id": "string",
  "fotografo_id": "string",
  "fotos_originales": { "frente": "url", "lateral_derecho": "url", "trasera": "url", "lateral_izquierdo": "url" },
  "fotos_limpias": { "frente": "url", "...": "..." },
  "modelo_3d_url": "url (.glb)",
  "config": { "velocidad_rotacion_seg": 8, "fondo": "estudio_gris", "resolucion": "1920x1080" },
  "estado": "capturado | fondo_removido | reconstruido_3d | renderizado | ensamblado | en_revision | publicado | error",
  "video_final_url": "url (.mp4)",
  "intentos_por_angulo": { "frente": 1, "lateral_derecho": 2, "trasera": 1, "lateral_izquierdo": 1 }
}
```

## 3. Etapas del pipeline

1. **Captura**: 4 fotos en posiciones fijas, altura/distancia/luz estandarizadas.
2. **Remoción de fondo**: por imagen, en paralelo.
3. **Reconstrucción 3D**: las 4 imágenes limpias se envían juntas (multiview) a la API elegida. Es asíncrono — se hace polling o se recibe webhook con el GLB resultante.
4. **Render orbital**: script de Blender (ver `render/orbit_render.py`) carga el GLB, arma el ambiente (fondo artístico + iluminación), y renderiza N frames de una cámara que orbita 360° comenzando y terminando en el frente.
5. **Ensamblado**: ffmpeg junta los frames en `.mp4` (ver `scripts/assemble_mp4.sh`). La velocidad de rotación configurada define cuántos frames se generan y a qué fps.
6. **Revisión del fotógrafo**: previsualiza el mp4 (y opcionalmente el GLB con `<model-viewer>`), aprueba o marca un ángulo específico para repetir — no hay que rehacer las 4 fotos, solo la que falló.
7. **Publicación**: mp4 + jpgs se copian al bucket público / CDN y quedan disponibles para el sitio web.

## 4. Costos estimados (500 vehículos/mes, 4 fotos c/u = 2,000 imágenes/mes)

Cifras de mercado a la fecha de esta nota — **confirmar con la API elegida antes de comprometer presupuesto**, cambian con frecuencia.

| Partida | Costo aproximado |
|---|---|
| Remoción de fondo (2,000 imágenes) | $20 – $40/mes |
| Reconstrucción 3D (500 generaciones, ~$0.10–$0.40 c/u) | $50 – $200/mes |
| Cómputo de render (worker con GPU, uso moderado) | $50 – $150/mes |
| Almacenamiento + CDN | $10 – $30/mes |
| **Total aproximado** | **$130 – $420/mes** |

Muy por debajo de una suscripción a plataforma comercial tipo Spyne/Glo3D
($350–800/mes fijos), con la ventaja de quedar integrado a tu propio stack.

## 5. Limitación conocida y plan de piloto

Con solo 4 fotos, la calidad de reconstrucción depende del vehículo:
superficies reflectantes (vidrios, cromo, pintura brillante) y colores muy
oscuros son el caso difícil tanto para la reconstrucción 3D como para el
render. **Recomendación**: antes de habilitar la herramienta para todo el
equipo de fotografía, correr un piloto de 10–15 vehículos variados (colores
oscuros, mucho cromo, sedán vs. SUV) y revisar resultado uno por uno. Esto
también sirve para calibrar el ángulo de luz de captura, que suele mejorar
la reconstrucción más que cualquier parámetro de la API.

La etapa "Revisión del fotógrafo" no es opcional en el arranque: es el
control de calidad mientras se calibra el proceso.

## 6. Notas de despliegue

- API + worker pueden vivir en el mismo contenedor en una primera fase (17
  vehículos/día no exige alta concurrencia).
- El render con Blender es la parte más pesada en cómputo — vale la pena
  correrlo en una instancia con GPU solo cuando hay trabajos en cola
  (auto-scaling o instancia spot) en vez de tenerla encendida 24/7.
- Redis puede vivir en la misma instancia mientras el volumen sea bajo;
  migrar a un servicio administrado si el equipo de fotografía crece.
