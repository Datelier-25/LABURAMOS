# Paso a paso: aplicar las mejoras de LaburamosApp (completo)

Esta carpeta contiene el proyecto con todas las mejoras: diseño, cartel de bienvenida, anuncios
(video e imagen), métricas de anuncios, perfil y eliminación de cuenta.

Hay **tres migraciones de base de datos** que tienen que correrse a mano en Supabase, en orden:
036 → 037 → 038. También hay que verificar la configuración de Supabase (buckets, permisos y precios).

El archivo `PROMPT_PARA_IA.md` (en esta misma carpeta) tiene el texto listo para pegarle a tu IA.

---

## Qué hay que hacer

| Paso | Qué es | Dónde se corre |
|------|--------|----------------|
| 0 | Verificar lo que ya estaba en la base (033, 034, 035) | Supabase SQL Editor |
| 1 | Instalar y compilar el proyecto | Tu compu |
| 2 | Aplicar la migración 036 (métricas de anuncios) | Supabase SQL Editor |
| 3 | Aplicar la migración 037 (eliminar cuenta) | Supabase SQL Editor |
| 4 | Aplicar la migración 038 (anuncios de imagen y precios) | Supabase SQL Editor |
| 5 | Verificar la configuración de Supabase (buckets, precios, permisos) | Supabase SQL Editor |
| 6 | Probar en la app | Navegador |
| 7 | Publicar el frontend | Tu forma habitual de publicar |

**Orden de prueba:** primero todo en un proyecto de desarrollo, después producción.
La migración 037 borra datos al eliminar una cuenta y no tiene reversión automática.

---

## Paso 0: comprobar las migraciones anteriores

Estas funcionalidades dependen de migraciones que ya deberían estar aplicadas. Si alguna falta, aplicala primero
(están en `supabase/migrations/`) y después seguí.

```sql
select to_regclass('public.ad_campaigns') as anuncios_video,        -- 033: debe devolver 'ad_campaigns'
       to_regclass('public.reviews') as reseñas,
       (select count(*) from storage.buckets where id in ('ad-videos','welcome-images','avatars','cv-photos')) as buckets;
                                                                     -- debe devolver 4
select count(*) from pg_proc where proname in ('submit_ad_campaign','pick_random_ad','admin_review_ad_campaign');
                                                                     -- debe devolver 3
```

- Si `anuncios_video` es `null`: falta la 033. Aplicala antes de la 036.
- Si `buckets` es menor a 4: revisá las migraciones 000 y 035 (cartel de bienvenida).
- Si la 034 no está (la función `admin_delete_ad_campaign` existe pero el borrado de videos del admin falla): aplicala.

---

## Paso 1: instalar y compilar

Requisitos: Node.js 22 o superior (ver `.nvmrc`).

```bash
cd laburamos_rediseno
npm install
npm run build
```

Tiene que terminar con `built in` y sin errores. La advertencia sobre "chunks larger than 500 kB" es normal.

---

## Paso 2: migración 036 (métricas de anuncios)

Comprobá si ya está aplicada:

```sql
select to_regclass('public.ad_events') as tabla,
       (select count(*) from pg_proc where proname in ('register_ad_event','my_ad_stats')) as funciones;
```

- Si `tabla` es `null` o `funciones` es `0`: aplicá `supabase/migrations/036_anuncios_metricas.sql` (una sola vez).
- Si `tabla` es `ad_events` y `funciones` es `2`: ya está.

Verificación:

```sql
select grantee, privilege_type from information_schema.role_table_grants where table_name = 'ad_events';
-- No debe devolver filas para anon ni authenticated.
```

---

## Paso 3: migración 037 (eliminar mi cuenta)

**Primero en desarrollo.** Aplicá `supabase/migrations/037_eliminar_mi_cuenta.sql` (una sola vez).

Verificación:

```sql
select proname from pg_proc where proname = 'delete_my_account';
-- Debe devolver 1 fila.

select is_nullable from information_schema.columns
where table_schema = 'public' and table_name = 'cv_purchases' and column_name = 'user_id';
-- Debe devolver: YES

select pg_get_constraintdef(oid) from pg_constraint where conname = 'cv_purchases_user_id_fkey';
-- Debe contener: ON DELETE SET NULL
```

Si algo no coincide, no sigas: pegá el resultado y el error completo.

Decisión tomada: al eliminar una cuenta, sus compras de CV se conservan sin el usuario (por registro contable).

---

## Paso 4: migración 038 (anuncios de imagen y precios)

Comprobá si ya está aplicada:

```sql
select column_name from information_schema.columns
where table_schema = 'public' and table_name = 'ad_campaigns' and column_name = 'media_type';
```

Si devuelve una fila, ya está. Si no, aplicá `supabase/migrations/038_anuncios_imagen.sql` (una sola vez).

Esta migración cambia `admin_delete_ad_campaign`: ahora devuelve un objeto con las rutas de video e imagen.
**El frontend nuevo tiene que estar publicado junto con esta migración**, si no el borrado de anuncios por el admin falla.

---

## Paso 5: verificar la configuración de Supabase

### 5.1 Buckets (Storage)

```sql
select id, public, file_size_limit, allowed_mime_types
from storage.buckets
where id in ('ad-videos', 'ad-images', 'welcome-images', 'avatars', 'cv-photos')
order by id;
```

Resultado esperado:

| Bucket | public | Límite | Tipos |
|--------|--------|--------|-------|
| ad-videos | true | 50 MB | video/mp4, video/webm, video/quicktime |
| ad-images | true | 5 MB | image/jpeg, image/png, image/webp |
| welcome-images | true | — | imágenes |
| avatars | true | — | imágenes |
| cv-photos | **false** | — | image/jpeg |

Si `cv-photos` quedó público, **corregilo**: los CV son privados.

### 5.2 Políticas de Storage de los anuncios

```sql
select policyname, cmd, roles from pg_policies
where schemaname = 'storage' and tablename = 'objects' and policyname like 'ad_%'
order by policyname;
```

Deben existir: `ad_videos_read`, `ad_videos_insert`, `ad_videos_update`, `ad_videos_delete`,
`ad_images_read`, `ad_images_insert`, `ad_images_update`, `ad_images_delete`.

### 5.3 Precios y reglas de anuncios

```sql
select ads_enabled, ads_price_per_second, ads_price_image, ads_image_seconds,
       ads_min_seconds, ads_max_seconds, ads_days, ads_skip_seconds, ads_max_per_user
from public.app_settings where id = 1;
```

Valores de partida (los podés cambiar después desde el panel de admin, en la sección Anuncios):

- `ads_price_per_second`: precio por segundo de video (por defecto 100).
- `ads_price_image`: precio fijo de una campaña de imagen (por defecto 5000).
- `ads_image_seconds`: segundos que se ve una imagen (por defecto 8).
- `ads_min_seconds` / `ads_max_seconds`: duración de los videos (5 y 30).
- `ads_days`: días de campaña (30).
- `ads_skip_seconds`: cuenta regresiva en videos (5).
- `ads_max_per_user`: anuncios activos por usuario (3).

No hay que cambiar nada si estos valores te sirven. Para cambiarlos sin el panel:

```sql
update public.app_settings set ads_price_image = 5000, ads_image_seconds = 8 where id = 1;
```

### 5.4 Permisos de las funciones de anuncios

```sql
select routine_name, grantee from information_schema.routine_privileges
where routine_schema = 'public'
  and routine_name in ('submit_ad_campaign','submit_ad_image_campaign','pick_random_ad',
                       'register_ad_event','my_ad_stats','delete_my_account','admin_delete_ad_campaign')
order by routine_name, grantee;
```

Ninguna de estas funciones debe tener `anon` como grantee. Deben tener `authenticated`.

### 5.5 Auth

En Supabase, Authentication → URL Configuration: la **Site URL** y las **Redirect URLs** tienen que
incluir la dirección donde está publicada la app (la que se usa para "Olvidé mi contraseña").

---

## Paso 6: probar en la app

Usá una cuenta de prueba en el proyecto de desarrollo.

1. **Perfil:** "Mi perfil" muestra el porcentaje de perfil completo, los paneles y la zona de peligro.
2. **Guardar cambios:** el botón solo se activa cuando cambiás algo.
3. **Contraseña:** el mensaje debajo del campo cambia según lo que escribas.
4. **Cartel de bienvenida:** muestra flechas y puntos si hay más de una imagen. Tocar el fondo lo cierra.
5. **Publicar un aviso:** el formulario abre sin anuncio. Al guardar, si hay un anuncio aprobado y pagado, aparece después de confirmar. Al cerrarlo, pasa a "Mis avisos".
6. **Anuncio de video:** en "Mis anuncios", elegí "Video", subí un video de 5 a 30 segundos y enviálo. El precio es por segundo.
7. **Anuncio de imagen:** elegí "Imagen", subí una imagen de al menos 600 × 600 px y enviala. El precio es el fijo configurado.
8. **Métricas:** con un anuncio aprobado y pagado, en "Mis anuncios" aparecen las vistas y los clics.
9. **Admin, Anuncios:** los precios y reglas están en tres tarjetas (Precios, Duración, Reglas). El ejemplo de precio se actualiza al escribir. La revisión muestra imagen o video según el tipo.
10. **Eliminar cuenta (solo con una cuenta de prueba):**
    - Con un anuncio pago vigente, el botón tiene que estar bloqueado con el aviso.
    - Sin anuncios pagos: escribí `ELIMINAR`, confirmá, y verificá que la sesión se cierre.
    - En Supabase, comprobá que el usuario ya no esté en `auth.users` y que sus compras de CV queden con `user_id` nulo:
      ```sql
      select count(*) from auth.users where id = '<id de la cuenta>';          -- 0
      select count(*) from public.cv_purchases where user_id is null;          -- >= 0 (sin error)
      ```

Si algo falla, anotá qué hiciste y el mensaje de error.

---

## Paso 7: publicar el frontend

Recién después de probar en desarrollo y, si corresponde, aplicar las migraciones en producción:

1. Compilá con `npm run build`.
2. Publicá la carpeta `dist` con tu forma habitual de deploy (Cloudflare o Netlify según tu configuración).
3. Abrí la app publicada y repetí los puntos 1, 5 y 6 del paso 6 como prueba rápida.

---

## Resumen de cambios incluidos

- **Diseño:** barra superior sin desborde en celular, botones en forma de pastilla, áreas de toque de 44 px, texto de metadatos más legible, foco visible.
- **Marca:** marca de agua del CV con el isotipo que sí existe; icono "L" en `public/marca`.
- **Cartel de bienvenida:** flechas, puntos, teclado, cierre al tocar el fondo, foco contenido, visible en cada ingreso (`WELCOME_COOLDOWN_HOURS = 0`).
- **Anuncios de video:** la ventana habilita "Continuar" al terminar el video, no repite el mismo anuncio seguido, tiene un límite de 10 minutos entre anuncios (`AD_COOLDOWN_MINUTES`), y se muestra después de guardar un aviso nuevo.
- **Anuncios de imagen (038):** formato Video/Imagen al crear el anuncio, precio fijo para imágenes y segundos en pantalla configurables.
- **Admin de anuncios:** precios y reglas en tarjetas, con ejemplos de precio en vivo.
- **Métricas (036):** vistas y clics por campaña, visibles solo para el dueño y el admin.
- **Perfil (037):** paneles separados, progreso del perfil, correo, zona de peligro para eliminar la cuenta. El historial de compras de CV se conserva.

## Si algo sale mal

- **036:** no hace falta revertirla para que la app funcione. Sin ella, las métricas no se registran.
- **037 y 038:** no tienen reversión automática. Probalas primero en desarrollo. Antes de aplicarlas en producción, pedí un respaldo a Supabase.
