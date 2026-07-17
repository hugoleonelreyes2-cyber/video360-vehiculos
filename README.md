# Generador de video 360° de vehículos (4 fotos)

Proyecto independiente para generar un video 360° del exterior de un vehículo
a partir de **4 fotos** (frente, lateral derecho, trasera, lateral izquierdo),
usando reconstrucción 3D por IA para rellenar los ángulos no fotografiados.
Entrega: `.mp4` del giro + las 4 fotos limpias (fondo removido) en `.jpg`.

No depende de ninguna otra herramienta interna existente (Sistema Inspección
Rápida, Cofiño Certificado, modelo de valuación). Es un servicio propio, con
su propia base de datos y almacenamiento.

## Estructura

```
frontend/         App del fotógrafo (captura, panel de control, revisión)
backend/          API + cola de trabajos + orquestación del pipeline
  jobs/           Un archivo por etapa del pipeline
  lib/            Clientes de las APIs externas
render/           Scripts de render orbital (Blender headless)
scripts/          Ensamblado de video (ffmpeg)
docs/             Detalle de arquitectura, costos, plan de piloto
```

## Flujo (ver docs/ARQUITECTURA.md para el detalle completo)

```
Captura (4 fotos) → Remoción de fondo → Reconstrucción 3D (Tripo/Hunyuan3D)
  → Render orbital + fondo artístico → Ensamblado ffmpeg (mp4 + jpg)
  → Revisión del fotógrafo (aprobar / repetir toma) → Publicación (CDN)
```

## Arranque rápido (desarrollo)

```bash
cd backend
cp .env.example .env        # completar API keys y credenciales de storage
npm install
docker compose up -d redis  # cola de trabajos
npm run dev                 # levanta API + worker
```

Abrir `frontend/index.html` (puede sevirse estático o desde el mismo backend).

## Requisitos externos que hay que contratar/configurar antes de producción

- API de remoción de fondo (ver docs/ARQUITECTURA.md, sección de costos)
- API de reconstrucción 3D multi-vista (Tripo 3.0 Multiview o Hunyuan3D V2 Multi-View)
- Blender instalado en el worker de render (headless, sin GUI) — o alternativa Three.js
- Bucket de almacenamiento (S3 / GCS / Cloudflare R2) + CDN
- Redis para la cola de trabajos

## Estado de este repositorio

Este es un **esqueleto funcional**: define la arquitectura, los contratos entre
componentes y el orden del pipeline con implementaciones de referencia. Antes
de producción falta: credenciales reales, manejo de errores más robusto,
autenticación de usuarios, y el piloto de calidad descrito en
`docs/ARQUITECTURA.md`.
