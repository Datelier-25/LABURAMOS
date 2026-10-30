# Revisión de seguridad: LaburamosApp

**Fecha:** 28/10/2026 · **Alcance:** `laburamos_proyecto/` (frontend React, migraciones 003 y 004, Edge Functions `crear-pago-cv` y `mp-webhook`) y el borrador `sql/001_politicas_rls.sql` del paquete de revisión, que se toma como el esquema de políticas vigente.

> **Nota de la copia local (29/10/2026):** el paquete original no incluía las
> migraciones base 001/002. Para poder instalar la app en un Supabase nuevo se
> agregó `supabase/migrations/001_base_laburamos.sql`, una reconstrucción del
> esquema mínimo (tablas, RLS, trigger de registro y `set_listing_status`). Si
> aparece el `001_politicas_rls.sql` original, conviene compararlo antes de
> reemplazar la base. Las referencias a `sql/001_politicas_rls.sql` de este
> informe siguen siendo al borrador original.
**Modo:** solo lectura. No se modificó código ni se ejecutó nada contra el Supabase de producción.

**Contexto:**
- **Qué hace:** bolsa de trabajo, oficios y changas con contacto directo por WhatsApp, más CV online con descarga paga en PDF.
- **Stack:** React 19 + Vite, Supabase (Postgres con RLS, Auth, Storage, Edge Functions en Deno), Netlify.
- **Usuarios y roles:** visitante sin cuenta, vecino (`worker`), comercio (`company`) y administrador (`is_admin`).
- **Exposición:** pública en internet. La clave de Supabase del frontend es pública por diseño, así que la base de datos es la única barrera real.
- **Datos sensibles:** nombre, teléfono, email, fecha de nacimiento, barrio y foto (CV); pagos (Mercado Pago).
- **Integraciones:** Mercado Pago (Checkout Pro y avisos de pago), API Georef, WhatsApp (enlaces `wa.me`).

---

## 1. Resumen ejecutivo

La postura es **razonable en el frontend y en el circuito de pago**, y **débil en lo que expone la base a cualquier usuario**. No hay secretos en el código: la clave del frontend es la `anon` y en `.env` está la `publishable`. El pago está bien diseñado: el precio sale del servidor y cada aviso de Mercado Pago se vuelve a verificar contra su API.

Los tres riesgos principales son de **exposición de datos personales y de lógica de negocio**, todos a través de la API de Supabase que cualquiera puede usar con la clave pública:

1. **Fotos de CV y nombres de todos los usuarios enumerables**, aunque el CV esté oculto (SEC-001).
2. **Los CV visibles exponen la fecha de nacimiento exacta, el email y el teléfono a cualquier cuenta**, y cualquiera puede crearse una de "Comercio" (SEC-002).
3. **Al publicar se pueden fijar `status` y `expires_at` a mano**, así que hay avisos que no vencen nunca (SEC-003).

**Qué atacar primero:**
- Confirmar que RLS está activo en producción (consultas en la sección 6). Si no lo está, todo lo demás pasa a ser crítico.
- Aplicar los quick wins de SEC-001 y SEC-005, que llevan minutos.

---

## 2. Mapa de superficie de ataque

**Puntos de entrada:**
- **PostgREST** (`https://<ref>.supabase.co/rest/v1/*`), con la clave pública, para los roles `anon` y `authenticated`:
  - Tablas `jobs`, `services`, `resumes`, `profiles`, `app_settings` y `cv_purchases`.
  - Vista `public_profiles`.
  - RPC `renew_listing`, `set_listing_status`, `cv_access`, `consume_cv_download` e `is_admin`.
  - El frontend es solo una de las formas de usar esta API: cualquiera puede llamarla directo.
- **Supabase Auth:** registro (los metadatos `full_name`, `role`, `city` y `province` los pone el usuario), ingreso y recuperación de contraseña.
- **Storage:** bucket `cv-photos`, de lectura pública. Cada usuario escribe solo en `<user_id>/`.
- **Edge Functions:**
  - `crear-pago-cv`: exige sesión y crea la compra y la preferencia de Mercado Pago.
  - `mp-webhook`: pública (`--no-verify-jwt`) y recibe los avisos de Mercado Pago.
- **Vuelta de Mercado Pago** (`/?pago=cv&status=…`): el parámetro solo sirve para mostrar un mensaje. El acceso se decide en el servidor.

**Límites de confianza:**
- **Navegador:** no es de confianza. Todo chequeo de rol, de pago o de visibilidad hecho en React es solo cosmético.
- **Postgres:** RLS, permisos por columna y funciones `security definer`. Es la barrera real.
- **Edge Functions:** usan la `service_role` y el Access Token de Mercado Pago, guardados como secretos de Supabase.

**Flujo de datos sensibles:**
- **CV:** sale del navegador (`upsert` en `resumes`) y lo lee cualquier `authenticated` si está visible. La foto va del navegador al bucket público y se lee por URL directa.
- **Pago:** el navegador llama a `crear-pago-cv`, que crea la compra y la preferencia en Mercado Pago. Mercado Pago avisa a `mp-webhook`, que vuelve a consultar el pago y aprueba la compra. Por último, `consume_cv_download` habilita la impresión.

---

## 3. Hallazgos

### SEC-001: Fotos de CV y nombres de todos los usuarios enumerables, aunque el CV esté oculto

| Campo | Contenido |
|---|---|
| Severidad | **Media**. CVSS 3.1: AV:N/AC:L/PR:N/UI:N/S:U/C:L/I:N/A:N (5.3) |
| Confianza | **Confirmado** para el bucket y la ruta (código propio). **Plausible** para la vista `public_profiles`: depende de que el 001 esté aplicado tal cual. |
| Categoría | OWASP A01 Broken Access Control · CWE-639 / CWE-200 |
| Ubicación | `supabase/migrations/003_zonas_servicios_cv.sql:93` · `src/components/MyResume.jsx:250-253` · `sql/001_politicas_rls.sql:122-124` |

**Evidencia:**
```sql
-- 003: bucket de lectura pública
values ('cv-photos', 'cv-photos', true, 2097152, array['image/jpeg'])
-- 001: vista de todos los perfiles para anon (las vistas no aplican RLS por defecto)
create or replace view public.public_profiles as select id, full_name, city from public.profiles;
grant select on public.public_profiles to anon, authenticated;
```
```js
// MyResume.jsx: ruta predecible
const path = `${user.id}/foto.jpg`;
```

**Escenario de explotación:** alguien sin cuenta pide `GET /rest/v1/public_profiles?select=id,full_name,city` y obtiene el id, el nombre y la ciudad de **todos** los registrados. Si la vista no existe, los ids salen igual de `jobs.company_id` y `services.owner_id`, que son públicos. Con cada id descarga `.../storage/v1/object/public/cv-photos/<id>/foto.jpg`. Así obtiene la foto de cada persona que alguna vez subió una a su CV, aunque tenga el CV en "Solo lo ves vos".

**Impacto:**
- Se puede armar un padrón de nombre, ciudad y foto de los usuarios.
- Contradice lo que promete la pantalla ("Ahora solo lo ves vos").

**Remediación:**
- **Quick win:** usar un nombre impredecible para la foto (`${user.id}/${crypto.randomUUID()}.jpg`) y guardarlo en `photo_url`. Con eso alcanza, porque un bucket público no permite listar archivos sin una política `select`, y la única que hay es solo para el dueño. También hay que borrar la foto anterior.
- **Mejor:** bucket privado y URLs firmadas (`createSignedUrl`), que se entregan solo si el CV es visible o si el que pide es el dueño.
- Quitar `public_profiles` para `anon`, o crearla con `security_invoker = on` y solo los campos necesarios.

---

### SEC-002: Los CV visibles exponen la fecha de nacimiento exacta, el email y el teléfono a cualquier cuenta

| Campo | Contenido |
|---|---|
| Severidad | **Media**. CVSS 3.1: AV:N/AC:L/PR:L/UI:N/S:U/C:L/I:N/A:N (4.3) |
| Confianza | **Plausible**: depende de la política `resumes_select` vigente. Los campos son confirmados (migración 003). |
| Categoría | OWASP A01 · CWE-359 (exposición de información privada) |
| Ubicación | `sql/001_politicas_rls.sql:71-73` · `src/components/Candidates.jsx:20` · `supabase/migrations/003_zonas_servicios_cv.sql:57-59` · `src/components/AuthScreen.jsx:35` |

**Evidencia:**
```sql
create policy resumes_select on public.resumes for select to authenticated
  using (is_visible = true or user_id = auth.uid());   -- cualquier authenticated, sin importar el rol
```
```js
// AuthScreen.jsx: el rol lo elige el propio usuario al registrarse
options: { data: { full_name: ..., role: form.role, ... } }
```

**Escenario de explotación:** cualquier persona se registra (puede elegir "Comercio", aunque no hace falta) y con su sesión pide `select=*` sobre `resumes`. Obtiene todos los CV visibles con `birth_date` exacta, `email`, `phone`, `neighborhood` y `photo_url`. La pantalla, en cambio, solo muestra la edad, y promete que el CV lo ven "los comercios registrados".

**Impacto:**
- Extracción masiva de datos personales (fecha de nacimiento, email y teléfono) que sirven para fraude y spam.
- Contradice lo que la app le promete al usuario.

**Remediación:**
- Exponer los CV a terceros solo a través de una vista o RPC que **no** devuelva `birth_date` (solo la edad calculada) y que exija `role = 'company'`:
```sql
create or replace view public.resumes_publicos with (security_invoker = off) as
  select id, user_id, full_name, profession, summary, skills_list, education, experience_list,
         availability, city, province, neighborhood, phone,
         date_part('year', age(birth_date))::int as edad, updated_at
  from public.resumes
  where is_visible and exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'company');
revoke all on public.resumes_publicos from anon;
grant select on public.resumes_publicos to authenticated;
-- y en resumes_select dejar solo: using (user_id = auth.uid())
```
- `Candidates.jsx` pasa a leer de `resumes_publicos`.
- Evaluar si el email hace falta: el contacto ya es por WhatsApp.
- Más adelante, que el rol "Comercio" no se pueda elegir libremente (verificación).

---

### SEC-003: Al publicar se pueden fijar `status`, `expires_at` e `is_urgent` a mano (avisos que no vencen)

| Campo | Contenido |
|---|---|
| Severidad | **Media**. CVSS 3.1: AV:N/AC:L/PR:L/UI:N/S:U/C:N/I:L/A:N (4.3) |
| Confianza | **Plausible**: confirmado sobre el 001 (el UPDATE está limitado por columna, el INSERT no). Falta confirmar que el 001 esté aplicado tal cual. |
| Categoría | OWASP A04 Insecure Design · CWE-840 (lógica de negocio) |
| Ubicación | `sql/001_politicas_rls.sql:32-33, 55-56` · `src/components/PublishModal.jsx:63, 77` |

**Evidencia:**
```sql
create policy jobs_insert on public.jobs for insert to authenticated with check (company_id = auth.uid());
-- Solo se limitó el UPDATE por columna; el INSERT acepta cualquier columna, incluidas status y expires_at
```

**Escenario de explotación:** un usuario registrado hace `POST /rest/v1/jobs` con `{"company_id":"<su id>","expires_at":"2100-01-01","is_urgent":true,...}`. El aviso no vence nunca y queda primero en todas las listas, porque se ordena por urgente. Si se agregan destacados pagos (`featured_until`, borrador 002), los obtiene gratis. Lo mismo pasa con `services`. También puede insertar avisos ya marcados como `filled` o con un `created_at` falso para manipular el orden.

**Impacto:**
- Se saltea la regla de 30 días.
- Se manipula el orden de las listas.
- Se pierde el control de cualquier funcionalidad paga sobre avisos.

**Remediación:** que la base fije esos campos al insertar.
```sql
create or replace function public.listing_defaults() returns trigger language plpgsql as $$
begin
  if current_user in ('anon', 'authenticated') then
    new.status := 'active';
    new.expires_at := now() + interval '30 days';
    new.created_at := now();
    if tg_table_name = 'services' and new.intent <> 'busca' then new.is_urgent := false; end if;
  end if;
  return new;
end $$;
create trigger trg_jobs_defaults before insert on public.jobs for each row execute function public.listing_defaults();
create trigger trg_services_defaults before insert on public.services for each row execute function public.listing_defaults();
```
Otra opción: `revoke insert on public.jobs from authenticated; grant insert (title, company_name, …) on public.jobs to authenticated;`.

---

### SEC-004: El cobro de la descarga del PDF se puede saltear desde el navegador

| Campo | Contenido |
|---|---|
| Severidad | **Media** (impacto económico). CVSS 3.1: AV:N/AC:L/PR:L/UI:N/S:U/C:N/I:L/A:N (4.3) |
| Confianza | **Confirmado** |
| Categoría | OWASP A04 · CWE-602 (seguridad aplicada en el cliente) |
| Ubicación | `src/components/MyResume.jsx:355-367, 484, 673` · `src/index.css:493-512` |

**Evidencia:** el CV limpio (`<CvPrint>`) está **siempre** en el DOM. El cobro solo decide si se le pone a `<body>` la clase `print-cv`, y la trama de marcas de agua es un `div` superpuesto.
```js
<CvPrint form={form} />                       // siempre montado
document.body.classList.add('print-cv');      // solo después de consume_cv_download()
```

**Escenario de explotación:** cualquier usuario con su CV abierto entra a la consola del navegador (F12), escribe `document.body.classList.add('print-cv'); print()` y guarda el PDF limpio sin pagar. Otra forma: borra el elemento `.cv-tiles` y saca una captura.

**Impacto:** pérdida de ingresos. No se exponen datos de otros.

**Remediación:**
- **Quick win:** montar `<CvPrint>` solo después de que `consume_cv_download()` devuelva `true`, y desmontarlo en `afterprint`. Sube la vara, porque ya no está en el DOM, pero sigue siendo evitable por alguien técnico.
- **Estructural:** generar el PDF en el servidor. Una Edge Function verifica el acceso y consume la descarga, arma el PDF y devuelve una URL firmada de un solo uso. Es la única forma de que no se pueda saltear. Mientras no se haga, conviene aceptarlo como riesgo de negocio.

---

### SEC-005: `mp-webhook` usa el id del aviso sin validar para armar la URL de la API de Mercado Pago

| Campo | Contenido |
|---|---|
| Severidad | **Baja**. CVSS 3.1: AV:N/AC:H/PR:N/UI:N/S:U/C:N/I:L/A:N (3.7) |
| Confianza | **Plausible**: el camino existe, pero no encontré un endpoint de Mercado Pago que devuelva un JSON capaz de pasar el chequeo `status === 'approved'`, moneda e importe. |
| Categoría | CWE-22 / CWE-918 (path traversal en un request saliente) |
| Ubicación | `supabase/functions/mp-webhook/index.ts:21-24` |

**Evidencia:**
```ts
const paymentId = body.data?.id || url.searchParams.get('data.id') || url.searchParams.get('id');
const res = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, { headers: { Authorization: `Bearer ${mpToken}` } });
```

**Escenario de explotación:** un atacante llama a la función pública con `{"type":"payment","data":{"id":"../../merchant_orders/123"}}`. La función hace un GET autenticado con **tu** Access Token a otro endpoint de Mercado Pago. La respuesta no vuelve al atacante, pero se procesa como si fuera un pago.

**Impacto:** hoy, bajo. Es un vector innecesario que usa tu credencial.

**Remediación:**
```ts
if (type !== 'payment' || !/^\d{1,20}$/.test(String(paymentId))) return ok();
```
Opcional: validar la firma `x-signature` con el secreto de webhooks de Mercado Pago.

---

## 4. Controles que están bien implementados

- **No hay secretos en el código:** en el frontend solo están la clave `anon` (verificada: `role: anon`) y la `sb_publishable`. El Access Token de Mercado Pago y la `service_role` viven solo como secretos de las Edge Functions.
- **Pago:**
  - El precio y la modalidad salen de `app_settings`, nunca del navegador.
  - `external_reference` es un id que crea el servidor.
  - El webhook **vuelve a consultar el pago a Mercado Pago** con el token y verifica estado, moneda e importe, así que un aviso falso no aprueba nada.
  - Procesa cada pago una sola vez y revoca la compra ante un reembolso o contracargo.
  - `cv_purchases` no tiene políticas de escritura para el cliente.
- **Administración:**
  - `app_settings` solo la modifica quien cumple `is_admin()`.
  - El trigger `profiles_protect_admin` impide que un usuario se dé el rol de administrador desde la API.
  - La sección Admin del frontend es solo cosmética: los datos los protege RLS.
- **Descargas:** `consume_cv_download` bloquea la fila (`for update`), lo que evita carreras con descargas simultáneas.
- **Storage:** la escritura está limitada a la carpeta propia, solo JPEG y hasta 2 MB. No se aceptan SVG ni HTML, así que no hay XSS por archivos subidos.
- **Frontend:**
  - No hay `dangerouslySetInnerHTML` ni `eval`; React escapa todo.
  - Los enlaces de WhatsApp usan solo dígitos del teléfono y `encodeURIComponent`.
  - El único `location.href` dinámico es la URL que devuelve tu propia función.
  - Si falla la carga del CV, no se pisa el existente.
- **Funciones de avisos:** `renew_listing` y `set_listing_status` validan que el aviso sea del usuario y la lista de estados permitidos, con `search_path` fijo.
- **Ubicación:** solo se pide al tocar el botón, y a Georef se le envían únicamente las coordenadas.

---

## 5. Plan de remediación

**Quick wins (menos de un día):**
- **Verificar RLS en producción:** correr las consultas de la sección 6.
- **SEC-005:** validar `paymentId` con una expresión regular (una línea).
- **SEC-001:** nombre aleatorio para las fotos y quitar `public_profiles` para `anon`.
- **SEC-003:** trigger `listing_defaults` en `jobs` y `services`.
- **SEC-004:** montar `<CvPrint>` solo después de consumir la descarga.

**Corto plazo (1 a 2 semanas):**
- **SEC-002:** vista `resumes_publicos` sin fecha de nacimiento ni email, limitada a comercios, y `resumes_select` solo para el dueño.
- **SEC-001:** bucket `cv-photos` privado con URLs firmadas.
- **Netlify:** agregar encabezados de seguridad básicos (`Content-Security-Policy`, `X-Frame-Options: DENY`, `Referrer-Policy`).
- **Mercado Pago:** firmar y validar los avisos con `x-signature`.

**Estructurales:**
- Generar el PDF del CV en el servidor (resuelve SEC-004 de raíz).
- Verificar el rol "Comercio" (CUIT o revisión manual) en lugar de dejarlo a elección.
- Pruebas automáticas de RLS por rol (anon, worker y company), por ejemplo con pgTAP o scripts que fallen si un rol lee o escribe lo que no debe.
- Versionar en el repositorio el esquema real de producción (`supabase db dump`) para que las auditorías no dependan de borradores.

---

## 6. Limitaciones

- **Base de producción no verificada.** No sé qué políticas, triggers y funciones están aplicados realmente; la revisión supone el borrador 001. El código llama a `set_listing_status`, que solo existe en ese borrador, y eso indica que se aplicó, pero no lo confirmé. Para verificarlo, solo lectura, en el SQL Editor:
  ```sql
  select tablename, rowsecurity from pg_tables where schemaname = 'public';
  select tablename, policyname, cmd, roles, qual, with_check from pg_policies where schemaname = 'public';
  select grantee, table_name, privilege_type from information_schema.role_table_grants
   where table_schema = 'public' and grantee in ('anon', 'authenticated');
  ```
  **Si alguna tabla tiene `rowsecurity = false`, cualquiera con la clave pública puede leer, modificar o borrar sus datos. Eso es una vulnerabilidad crítica.**
- **Trigger que crea los perfiles.** No vi el código del trigger que crea el perfil al registrarse (`handle_new_user`). Si copia los metadatos del registro de forma genérica (por ejemplo, con `jsonb_populate_record`), alguien podría darse `is_admin` al registrarse: `profiles_protect_admin` no lo frena, porque ese trigger corre como `postgres`. Hay que revisar que solo copie `full_name`, `role`, `city` y `province`.
- **Configuración de Supabase Auth.** No revisé límites de intentos, contraseña mínima (hoy 6), confirmación de email ni la lista de direcciones permitidas para la recuperación de contraseña: no se ven en el código.
- **Dependencias.** No pude correr `npm audit` porque la máquina no tiene Node. Las versiones están fijadas en `package-lock.json`.
- **Historial de secretos.** El proyecto llegó como zip, sin historial de git, así que no pude buscar secretos en commits viejos. `.gitignore` no excluye `.env`: hoy solo contiene claves públicas, pero conviene agregarlo antes de que alguien guarde ahí una clave secreta.
- **Edge Functions.** No están desplegadas ni probadas. El análisis es estático.
- **Fuera de alcance:** infraestructura de Netlify y Supabase (permisos de la cuenta, backups) y la configuración de la cuenta de Mercado Pago.

---

## 7. Estado de la remediación (actualizado el 28/10/2026)

Los cambios están hechos en el código y en las migraciones 003 y 004, que todavía hay que aplicar. Se probaron solo en la vista previa local, con datos de ejemplo.

| ID | Estado | Qué se hizo |
|---|---|---|
| SEC-001 | Corregido (falta aplicar) | Bucket `cv-photos` privado, nombre de foto aleatorio y URL firmada. Solo pueden leer la foto el dueño, las empresas a las que se postuló y el administrador. La vista `public_profiles` deja de estar abierta a `anon`. |
| SEC-002 | Corregido (falta aplicar) | El CV ya no es "visible para todos": la política `resumes_select` permite verlo solo al dueño, a las empresas que recibieron su postulación (tabla `applications`) y al administrador. |
| SEC-003 | Corregido (falta aplicar) | El trigger `listing_defaults` fija estado, fecha y vencimiento al publicar, con los días que define el administrador. |
| SEC-004 | Mitigado | El CV limpio se monta recién después de `consume_cv_download()` y se desmonta al cerrar la impresión. Alguien técnico todavía podría saltearlo; la solución de fondo sigue siendo generar el PDF en el servidor. |
| SEC-005 | Corregido (falta publicar la función) | `mp-webhook` descarta cualquier id de pago que no sea un número. |
