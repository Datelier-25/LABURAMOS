# LaburamosApp

Laburos, oficios y changas cerca tuyo. Comercios y vecinos publican avisos, la gente se postula con su CV (se envía por email) o contacta directo por WhatsApp a los oficios, y cada persona arma su CV online (con descarga paga en PDF A4).

**Stack:** React 19 + Vite · Supabase (Postgres con RLS, Auth, Storage, Edge Functions) · Netlify · Mercado Pago (Checkout Pro) · API Georef (localidades de Argentina).

## Empezar
```bash
npm install
npm run dev
```
Antes de usar la versión nueva contra una base, crear un Supabase **nuevo** y
aplicar las migraciones en orden. La guía completa está en
**[supabase/INSTALACION_NUEVA.md](supabase/INSTALACION_NUEVA.md)**.
Para importar el proyecto en StackBlitz, ver
**[LEEME_STACKBLITZ.md](LEEME_STACKBLITZ.md)**.

## Estado de esta copia local

Esta carpeta es una instalación separada de Workeo. La vista previa con datos de
ejemplo no usa Supabase:

```bash
npm run preview:mock
```

Después abrir `http://127.0.0.1:5199/?as=worker` (o `?as=company` / `?as=admin`).
Para los datos reales hace falta un Supabase de desarrollo; **no aplicar las
migraciones 003/004 sobre la base de Workeo**. El detalle está en
**[ESTADO_LOCAL.md](ESTADO_LOCAL.md)**.

## Dónde está cada cosa
| Carpeta | Contenido |
|---|---|
| `src/components/` | Pantallas y piezas de la app (Home, JobList, ServiceList, MyResume, Candidates = Postulantes, Admin, …) |
| `src/lib/` | Lógica compartida: `geo.js` (zonas), `cv.js` y `cvTheme.js` (CV), `settings.js` (configuración del admin), `utils.js` |
| `public/marca/` | Logos, isotipo, favicon, íconos y trama de marca de agua |
| `public/geo/localidades.json` | Localidades y provincias de Argentina (Georef), cargadas a demanda |
| `supabase/migrations/` | `000` instalación completa · `001` esquema base · `003` zonas, servicios y CV · `004` admin, pagos, postulaciones y privacidad · `005` permisos de la Data API |
| `supabase/functions/` | `crear-pago-cv` y `mp-webhook` (Mercado Pago) |
| `docs/` | Revisión de seguridad y lámina de marca original |
| `herramientas/` | Vista previa sin Node, chequeo de sintaxis JSX y generadores de logos y localidades |

## Vista previa sin Node
```bash
python herramientas/preview/server.py . 5199
```
Abrir `http://localhost:5199/?as=worker` (también `as=company`, `as=admin`, `pay=on`, `pay=paid`). Usa datos de ejemplo: no toca Supabase.

## Deploy
El sitio de producción es **https://laburamosapp.laburos-y-oficios.workers.dev** y está conectado a este repositorio:
cada push a `main` dispara un build automático en Netlify (`npm run build` → `dist`).

Las credenciales de Supabase se cargan como variables de entorno en Netlify
(`VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY`); no se commitea ningún `.env`.
