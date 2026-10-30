# Instalar LaburamosApp con un Supabase nuevo

Esta guía es para la **versión nueva**, en un proyecto Supabase **nuevo y vacío**.
No uses la base de Workeo (`fbmsbbifkqyqmsdqyian`): su esquema no es compatible.

## Antes de empezar

- Tené a mano el email con el que vas a entrar a Supabase.
- No hace falta Mercado Pago para probar la app. Dejá el cobro del CV apagado.
- No uses ni pegues la clave `service_role` en el frontend. La app solo necesita
  la URL del proyecto y la clave pública `anon` / `publishable`.

## 1. Crear el proyecto Supabase

1. Entrá a <https://supabase.com/dashboard> y creá un proyecto nuevo.
2. Nombre sugerido: `laburamos-dev` (o `laburamos` si ya es el definitivo).
3. Guardá la contraseña de la base en un lugar seguro.
4. Esperá a que termine la provisión.
5. En **Project Settings → API** copiá:
   - **Project URL** (termina en `.supabase.co`).
   - **anon public** / **publishable key**.

## 2. Crear el esquema (SQL Editor)

**Opción rápida:** copiá y ejecutá
`supabase/migrations/000_instalacion_completa.sql` una sola vez. Ese archivo
junta las cuatro migraciones en orden.

**Opción por partes:** en **SQL Editor → New query**, ejecutá estos archivos
**en este orden**, uno por uno:

1. `supabase/migrations/001_base_laburamos.sql`
2. `supabase/migrations/003_zonas_servicios_cv.sql`
3. `supabase/migrations/004_admin_pagos_cv.sql`
4. `supabase/migrations/005_grants_laburamos.sql`

Cada archivo empieza con `begin;` y termina con `commit;`, así que se pega
entero. Si Supabase muestra un error, no sigas con el siguiente: anotá el
mensaje y corregí primero.

### Qué hace cada uno

| Archivo | Qué crea |
|---|---|
| `001_base_laburamos.sql` | `profiles`, `jobs`, `services`, `resumes`, RLS base, trigger de registro y `set_listing_status()` |
| `003_...sql` | Provincia, servicios "ofrece/busca", campos del CV y bucket privado `cv-photos` |
| `004_...sql` | Administrador, `app_settings`, `cv_purchases`, `applications`, duraciones, privacidad del CV y RPC de admin |
| `005_...sql` | Permisos de la Data API para las tablas de 004 |

Las migraciones son idempotentes: si algo falla y lo volvés a correr, no borra
datos.

## 3. Configurar Auth

En **Authentication → Providers → Email**:

- Dejá **Email** habilitado.
- Para probar rápido en desarrollo, podés desactivar **Confirm email**. Si lo
  dejás activo, cada registro tiene que confirmar el correo antes de entrar.
- En **Authentication → URL Configuration**:
  - **Site URL**: la URL donde corre la app. En StackBlitz es la URL del
    preview (por ejemplo `https://algo.stackblitz.io`). En local es
    `http://localhost:5173`.
  - **Redirect URLs**: agregá la misma URL y, si usás local, también
    `http://localhost:5173/**`.
- Si cambiás la URL de StackBlitz, actualizá **Site URL** y **Redirect URLs**.
  StackBlitz genera una URL distinta para cada proyecto/preview.

La app usa `window.location.origin` para la recuperación de contraseña, por eso
esa URL tiene que estar autorizada en Supabase.

## 4. Configurar la app (`.env`)

En la raíz del proyecto (al lado de `package.json`, no dentro de `src/`), creá
un archivo `.env`:

```env
VITE_SUPABASE_URL=https://TU-PROYECTO.supabase.co
VITE_SUPABASE_ANON_KEY=TU_ANON_PUBLIC_KEY
```

- Podés copiar `.env.example` y cambiar los valores.
- Reiniciá el servidor de Vite después de crearlo (en StackBlitz, recargá el
  preview o reiniciá el proyecto).
- Si faltan estas variables, la app muestra una pantalla "Falta conectar
  Supabase" y **no** se conecta a la base de Workeo. Antes tenía una URL de
  respaldo peligrosa; ya se quitó.

## 5. Hacerte administrador

1. Registrate en la app con tu email (elegí Vecino o Comercio; después podés
   cambiarlo desde SQL si hace falta).
2. En **SQL Editor** ejecutá, cambiando el email:

```sql
update public.profiles
   set is_admin = true
 where id = (select id from auth.users where email = 'TU_EMAIL');
```

3. Cerrá sesión y volvé a entrar. Tiene que aparecer **Admin** en el menú.
4. Desde Admin → Configuración podés cambiar los días de duración y, más
   adelante, activar el cobro del CV.

## 6. Probar lo básico

Con dos cuentas (una Vecino y una Comercio):

- [ ] Registro y login.
- [ ] El perfil se crea solo (trigger `handle_new_user`).
- [ ] Publicar un empleo y un servicio; el vencimiento lo fija la base.
- [ ] Editar, pausar, reactivar, renovar y eliminar desde **Mis avisos**.
- [ ] Postularse a un aviso; la empresa lo ve en **Postulantes**.
- [ ] La empresa puede abrir el CV y la foto; otra empresa no.
- [ ] Mi CV: guardar, foto, colores y descarga PDF con el cobro apagado.
- [ ] Admin: configuración, avisos, CVs y pagos.
- [ ] En la consola, con la clave pública, leer `resumes` ajenos debe devolver
      vacío.

## 7. Mercado Pago y Edge Functions (después)

No hace falta para esta etapa. Cuando el resto funcione:

1. Crear una aplicación de Checkout Pro en Mercado Pago Developers.
2. Cargar en Supabase → Edge Functions → Secrets:
   - `MP_ACCESS_TOKEN`
   - `APP_URL` (la URL pública de la app, sin barra final)
3. Publicar:
   ```bash
   supabase functions deploy crear-pago-cv
   supabase functions deploy mp-webhook --no-verify-jwt
   ```
4. Activar el cobro desde Admin → Configuración y probar con usuarios de
   prueba de Mercado Pago.

## Problemas frecuentes

| Error | Causa / solución |
|---|---|
| `relation "public.profiles" does not exist` | No se ejecutó `001_base_laburamos.sql` o falló. Ejecutalo primero. |
| `column "education" is of type text` | Estás en la base de Workeo. Pará y creá un Supabase nuevo; no fuerces la migración. |
| `permission denied for table app_settings` | Falta `005_grants_laburamos.sql`. Ejecutalo después de 004. |
| `new row violates row-level security policy` | Revisá que el `company_id`/`owner_id`/`user_id` coincida con el usuario logueado y que hayas aplicado las políticas. |
| El registro no crea el perfil | Revisá el trigger `on_auth_user_created` y que `handle_new_user` exista. Volvé a ejecutar 001. |
| El login funciona pero no aparecen datos | Revisá que `.env` apunte al proyecto nuevo y reiniciá Vite. |
| La recuperación de contraseña vuelve a localhost | Configurá **Site URL** y **Redirect URLs** con la URL real. |

## Seguridad mínima

- RLS está activo en todas las tablas.
- El cliente solo tiene la clave pública; nunca `service_role`.
- `profiles.is_admin` no se puede cambiar desde la API (trigger de 004).
- Los CV y las fotos son privados: se ven por postulación o por admin.
- Antes de usar datos reales, revisá `docs/REVISION_SEGURIDAD.md`.
