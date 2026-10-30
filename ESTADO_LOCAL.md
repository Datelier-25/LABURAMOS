# Estado local de LaburamosApp

Esta carpeta es una **copia separada** de LaburamosApp. No modifica el proyecto
`proyecto-workeo` ni la base de datos que usa Workeo.

## Lo que ya está hecho

- Proyecto descomprimido en `laburamos-app/`.
- `npm install` ejecutado.
- Compilación con Vite y lint revisados.
- `src/.env` viejo eliminado (tenía una URL con un error de tipeo y Vite no lo leía).
- Variables de Supabase movidas a `import.meta.env`, **sin URL de respaldo**:
  si faltan, la app muestra una pantalla de configuración y no se conecta a la
  base de Workeo.
- `.env.example` en la raíz para configurar un Supabase de desarrollo.
- Migración `001_base_laburamos.sql` creada para un Supabase nuevo y vacío
  (el paquete original solo traía 003/004, que asumen tablas base).
- Migración `005_grants_laburamos.sql` para los permisos de la Data API de las
  tablas que crea 004.
- Guías `supabase/INSTALACION_NUEVA.md` y `LEEME_STACKBLITZ.md`.
- Warning de lint de `Admin.jsx` corregido.

## Resultado de la prueba (29/10/2026)

- `npm run build`: pasa. Solo queda el aviso de Vite de que el bundle principal
  supera los 500 kB (553 kB; no bloquea).
- `npm run lint`: pasa sin warnings.
- Vista previa revisada con `worker`, `company` y `admin`: Inicio, Laburos,
  Oficios, Mi CV, Mis avisos, Postulantes, modal de CV y Administración.
- Sin errores de runtime (`window.__previewErrors` vacío) y sin pedidos 404 en
  la consola.
- En celular (390 px): sin scroll horizontal en Inicio, Mi CV, Oficios,
  Postulantes, Admin y modal de publicación.
- Detalle de UX a revisar: en el celular, el botón flotante "Publicar" puede
  quedar encima del botón "Me interesa" de la primera tarjeta de Oficios. No se
  cambió el diseño todavía.

## Cómo verla sin base de datos

La vista previa usa datos de ejemplo y no toca Supabase:

```powershell
cd "C:\Users\facun\OneDrive\Documentos\Proyecto predeterminado\laburamos-app"
npm run preview:mock
```

El servidor de vista previa está hecho en Node porque en esta máquina no hay
Python instalado (solo el acceso directo de Microsoft Store). También queda
`herramientas/preview/server.py` para cuando se use una máquina con Python:

```powershell
python herramientas/preview/server.py . 5199
```

Abrir:

```text
http://127.0.0.1:5199/?as=worker
http://127.0.0.1:5199/?as=company
http://127.0.0.1:5199/?as=admin
```

También se puede usar `&pay=on` o `&pay=paid` para probar el cobro del CV.
Las rutas son `#/laburos`, `#/oficios`, `#/cv`, `#/candidatos`, `#/avisos` y
`#/admin`.

## Importante: la base actual no sirve para esta app

El Supabase de Workeo **no se usa ni se toca**. Antes había una URL de respaldo
en `supabaseClient.js`; se quitó para que la app no pueda conectarse por error a
esa base. Tampoco hay que aplicar las migraciones 003/004 sobre Workeo: allí
`resumes.education` es texto y LaburamosApp lo espera como `jsonb`.

Para probar con datos reales hace falta:

1. Crear un **Supabase de desarrollo** aparte y vacío.
2. Copiar `.env.example` a `.env` y completar la URL y la clave `anon` de ese
   proyecto.
3. Aplicar en orden:
   - `supabase/migrations/001_base_laburamos.sql`
   - `supabase/migrations/003_zonas_servicios_cv.sql`
   - `supabase/migrations/004_admin_pagos_cv.sql`
   - `supabase/migrations/005_grants_laburamos.sql`
4. Configurar Auth (Site URL y Redirect URLs) y hacerte administrador con el
   `update` de la guía.
5. Revisar las políticas RLS y el trigger `handle_new_user` (ver
   `docs/REVISION_SEGURIDAD.md`).
6. Recién después, publicar las Edge Functions y configurar Mercado Pago.

La guía paso a paso está en `supabase/INSTALACION_NUEVA.md`.

## Lo que todavía no está probado

- La app contra una base real (solo se probó la compilación y la vista previa).
- Las migraciones 001/003/004/005 contra un Supabase real. Se ejecutaron sin
  errores de sintaxis en PGlite (Postgres embebido) y el trigger de registro
  creó un perfil de prueba, pero falta probarlas en Supabase.
- Las Edge Functions `crear-pago-cv` y `mp-webhook`.
- Mercado Pago.
- El despliegue en Netlify.
- La importación en StackBlitz (el ZIP está preparado, pero no se subió).

La skill y el proyecto original están en
`C:\Users\facun\Downloads\laburamosapp.skill.zip` y
`C:\Users\facun\Downloads\LaburamosApp_proyecto_completo.zip`.
