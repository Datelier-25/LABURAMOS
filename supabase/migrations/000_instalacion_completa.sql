-- =============================================================================
-- LaburamosApp - instalacion completa para un Supabase NUEVO y vacio
--
-- Este archivo equivale a ejecutar, en orden:
--   001_base_laburamos.sql
--   003_zonas_servicios_cv.sql
--   004_admin_pagos_cv.sql
--   005_grants_laburamos.sql
--
-- NO usar sobre la base de Workeo. Si preferis revisar cada paso, ejecuta los
-- cuatro archivos por separado; el resultado es el mismo.
-- =============================================================================

-- ===== 001_base_laburamos.sql =====

-- 001: esquema base de LaburamosApp para un Supabase NUEVO y vacío.
--
-- IMPORTANTE:
--   * Esto NO es para la base de Workeo. No lo apliques sobre el proyecto que
--     ya usa Workeo: esa base tiene un esquema distinto (por ejemplo,
--     resumes.education es texto allí y jsonb acá).
--   * Creá un proyecto Supabase nuevo, vacío, y ejecutá en este orden:
--       001_base_laburamos.sql
--       003_zonas_servicios_cv.sql
--       004_admin_pagos_cv.sql
--       005_grants_laburamos.sql
--   * Es idempotente: se puede volver a ejecutar sin borrar datos.
--
-- La versión original del proyecto no incluía las migraciones base 001/002;
-- este archivo reconstruye lo mínimo que necesitan la app y las migraciones
-- 003/004. Si ya tenés un 001/002 original, usá ese en lugar de este.

begin;

grant usage on schema public to anon, authenticated;

-- ============================================================================
-- 1. Perfiles
-- ============================================================================
create table if not exists public.profiles (
  id         uuid primary key references auth.users(id) on delete cascade,
  full_name  text,
  role       text not null default 'worker'
             constraint profiles_role_check check (role in ('worker', 'company')),
  city       text,
  province   text,
  phone      text,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles
  for select to authenticated
  using (id = auth.uid());

drop policy if exists profiles_update on public.profiles;
create policy profiles_update on public.profiles
  for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

-- El perfil lo crea este trigger. El cliente no puede insertar perfiles ni
-- cambiarse el rol o is_admin (is_admin se agrega en 004 y lo protege 004).
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.profiles (id, full_name, role, city, province)
  values (
    new.id,
    nullif(btrim(coalesce(new.raw_user_meta_data ->> 'full_name', '')), ''),
    case
      when new.raw_user_meta_data ->> 'role' = 'company' then 'company'
      else 'worker'
    end,
    nullif(btrim(coalesce(new.raw_user_meta_data ->> 'city', '')), ''),
    nullif(btrim(coalesce(new.raw_user_meta_data ->> 'province', '')), '')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Permisos: leer el perfil propio y actualizar solo datos personales.
-- El rol y el id no se pueden cambiar desde la API.
revoke all on public.profiles from anon, authenticated;
grant select on public.profiles to authenticated;
grant update (full_name, city, province, phone) on public.profiles to authenticated;

-- ============================================================================
-- 2. Avisos de empleo
-- ============================================================================
create table if not exists public.jobs (
  id           uuid primary key default gen_random_uuid(),
  company_id   uuid not null references auth.users(id) on delete cascade,
  title        text not null,
  company_name text not null,
  category     text not null,
  job_type     text,
  salary       text,
  location     text not null,
  province     text,
  phone        text not null,
  description  text not null,
  requirements text,
  is_urgent    boolean not null default false,
  status       text not null default 'active'
               constraint jobs_status_check check (status in ('active', 'paused', 'filled')),
  expires_at   timestamptz not null default (now() + interval '30 days'),
  created_at   timestamptz not null default now()
);

create index if not exists jobs_company_idx on public.jobs (company_id, created_at desc);
create index if not exists jobs_status_idx  on public.jobs (status, expires_at);
create index if not exists jobs_zone_idx    on public.jobs (province, location);

alter table public.jobs enable row level security;

drop policy if exists jobs_select on public.jobs;
create policy jobs_select on public.jobs
  for select to anon, authenticated
  using (
    (status = 'active' and expires_at > now())
    or company_id = auth.uid()
  );

drop policy if exists jobs_insert on public.jobs;
create policy jobs_insert on public.jobs
  for insert to authenticated
  with check (company_id = auth.uid());

drop policy if exists jobs_update on public.jobs;
create policy jobs_update on public.jobs
  for update to authenticated
  using (company_id = auth.uid())
  with check (company_id = auth.uid());

drop policy if exists jobs_delete on public.jobs;
create policy jobs_delete on public.jobs
  for delete to authenticated
  using (company_id = auth.uid());

revoke all on public.jobs from anon, authenticated;
grant select on public.jobs to anon, authenticated;
grant insert (company_id, title, company_name, category, job_type, salary,
              location, province, phone, description, requirements, is_urgent)
  on public.jobs to authenticated;
grant update (title, company_name, category, job_type, salary, location,
              province, phone, description, requirements, is_urgent)
  on public.jobs to authenticated;
grant delete on public.jobs to authenticated;

-- ============================================================================
-- 3. Oficios y servicios
-- ============================================================================
create table if not exists public.services (
  id            uuid primary key default gen_random_uuid(),
  owner_id      uuid not null references auth.users(id) on delete cascade,
  provider_name text not null,
  title         text not null,
  category      text not null,
  description   text not null,
  phone         text not null,
  city          text not null,
  province      text,
  intent        text not null default 'ofrece'
                constraint services_intent_check check (intent in ('ofrece', 'busca')),
  is_urgent     boolean not null default false,
  status        text not null default 'active'
                constraint services_status_check check (status in ('active', 'paused', 'filled')),
  expires_at    timestamptz not null default (now() + interval '30 days'),
  created_at    timestamptz not null default now()
);

create index if not exists services_owner_idx on public.services (owner_id, created_at desc);
create index if not exists services_status_idx on public.services (status, expires_at);
create index if not exists services_zone_idx  on public.services (province, city);

alter table public.services enable row level security;

drop policy if exists services_select on public.services;
create policy services_select on public.services
  for select to anon, authenticated
  using (
    (status = 'active' and expires_at > now())
    or owner_id = auth.uid()
  );

drop policy if exists services_insert on public.services;
create policy services_insert on public.services
  for insert to authenticated
  with check (owner_id = auth.uid());

drop policy if exists services_update on public.services;
create policy services_update on public.services
  for update to authenticated
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

drop policy if exists services_delete on public.services;
create policy services_delete on public.services
  for delete to authenticated
  using (owner_id = auth.uid());

revoke all on public.services from anon, authenticated;
grant select on public.services to anon, authenticated;
grant insert (owner_id, provider_name, title, category, description, phone,
              city, province, intent, is_urgent)
  on public.services to authenticated;
grant update (provider_name, title, category, description, phone, city,
              province, intent, is_urgent)
  on public.services to authenticated;
grant delete on public.services to authenticated;

-- ============================================================================
-- 4. CV
-- ============================================================================
create table if not exists public.resumes (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null unique references auth.users(id) on delete cascade,
  full_name       text not null,
  profession      text not null,
  summary         text,
  photo_path      text,
  birth_date      date,
  city            text not null,
  province        text,
  neighborhood    text,
  skills          text,
  skills_list     text[] not null default '{}'
                  constraint resumes_skills_max
                  check (coalesce(array_length(skills_list, 1), 0) <= 5),
  experience      text,
  experience_list jsonb not null default '[]'::jsonb,
  education       jsonb not null default '[]'::jsonb,
  availability    text,
  phone           text not null,
  email           text,
  is_visible      boolean not null default true,
  theme           jsonb not null default '{}'::jsonb,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  constraint resumes_summary_len
    check (summary is null or char_length(summary) <= 300),
  constraint resumes_lists_are_arrays
    check (jsonb_typeof(education) = 'array' and jsonb_typeof(experience_list) = 'array')
);

create index if not exists resumes_zone_idx on public.resumes (province, city);

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_resumes_updated_at on public.resumes;
create trigger trg_resumes_updated_at
  before update on public.resumes
  for each row execute function public.touch_updated_at();

alter table public.resumes enable row level security;

-- 004 reemplaza esta política por una más estricta (dueño, empresa que recibió
-- la postulación o administrador). Antes de 004, cada persona ve solo su CV.
drop policy if exists resumes_select on public.resumes;
create policy resumes_select on public.resumes
  for select to authenticated
  using (user_id = auth.uid());

drop policy if exists resumes_insert on public.resumes;
create policy resumes_insert on public.resumes
  for insert to authenticated
  with check (user_id = auth.uid());

drop policy if exists resumes_update on public.resumes;
create policy resumes_update on public.resumes
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists resumes_delete on public.resumes;
create policy resumes_delete on public.resumes
  for delete to authenticated
  using (user_id = auth.uid());

revoke all on public.resumes from anon, authenticated;
grant select, insert, update, delete on public.resumes to authenticated;

-- ============================================================================
-- 5. RPC para pausar / reactivar / marcar como cubierto un aviso propio
-- ============================================================================
-- La app la llama desde "Mis avisos". 004 crea renew_listing y las funciones
-- de administración; esta es la que faltaba en el paquete original.
create or replace function public.set_listing_status(
  p_kind   text,
  p_id     uuid,
  p_status text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_status not in ('active', 'paused', 'filled') then
    raise exception 'estado_invalido';
  end if;

  if p_kind = 'job' then
    update public.jobs
       set status = p_status
     where id = p_id
       and company_id = auth.uid();
  elsif p_kind = 'service' then
    if p_status = 'filled' then
      raise exception 'estado_invalido';
    end if;
    update public.services
       set status = p_status
     where id = p_id
       and owner_id = auth.uid();
  else
    raise exception 'tipo_invalido';
  end if;

  if not found then
    raise exception 'no_permitido';
  end if;
end;
$$;

revoke all on function public.set_listing_status(text, uuid, text) from public;
grant execute on function public.set_listing_status(text, uuid, text) to authenticated;

commit;


-- ===== 003_zonas_servicios_cv.sql =====

-- 003: zonas de toda Argentina, servicios "ofrece / busca" y CV completo.
-- Solo AGREGA columnas, índices, un trigger y el bucket de fotos: no borra ni renombra columnas.
-- Probarla primero en un proyecto de Supabase de desarrollo. La versión nueva de la app la necesita aplicada.

begin;

-- 1. Provincia en todo lo que tiene localidad -------------------------------------------
alter table public.profiles add column if not exists province text;
alter table public.jobs     add column if not exists province text;
alter table public.services add column if not exists province text;
alter table public.resumes  add column if not exists province text;

-- En la lista oficial (Georef) la localidad se llama "General O'Brien"
update public.profiles set city     = 'General O''Brien' where city     = 'O''Brien';
update public.jobs     set location = 'General O''Brien' where location = 'O''Brien';
update public.services set city     = 'General O''Brien' where city     = 'O''Brien';
update public.resumes  set city     = 'General O''Brien' where city     = 'O''Brien';

-- Las localidades que tenía la app son todas de la provincia de Buenos Aires
update public.profiles set province = 'Buenos Aires'
  where province is null and city in ('Bragado', 'General O''Brien', 'Mechita', 'Alberti', '9 de Julio');
update public.jobs set province = 'Buenos Aires'
  where province is null and location in ('Bragado', 'General O''Brien', 'Mechita', 'Alberti', '9 de Julio');
update public.services set province = 'Buenos Aires'
  where province is null and city in ('Bragado', 'General O''Brien', 'Mechita', 'Alberti', '9 de Julio');
update public.resumes set province = 'Buenos Aires'
  where province is null and city in ('Bragado', 'General O''Brien', 'Mechita', 'Alberti', '9 de Julio');

create index if not exists jobs_zone_idx     on public.jobs (province, location);
create index if not exists services_zone_idx on public.services (province, city);
create index if not exists resumes_zone_idx  on public.resumes (province, city);

-- Al registrarse, la provincia viaja en los metadatos igual que la ciudad.
-- Este trigger la completa sin tocar el trigger que ya crea el perfil.
create or replace function public.profiles_fill_province() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.province is null then
    select u.raw_user_meta_data ->> 'province' into new.province from auth.users u where u.id = new.id;
  end if;
  return new;
end $$;
drop trigger if exists trg_profiles_province on public.profiles;
create trigger trg_profiles_province before insert on public.profiles
  for each row execute function public.profiles_fill_province();

-- 2. Servicios: quien ofrece su oficio o quien busca que le hagan un trabajo -------------
alter table public.services add column if not exists intent text not null default 'ofrece';
alter table public.services drop constraint if exists services_intent_check;
alter table public.services add constraint services_intent_check check (intent in ('ofrece', 'busca'));
alter table public.services add column if not exists is_urgent boolean not null default false;
-- Los avisos que ya existen quedan como "ofrece" (por el default).

-- 3. CV completo ------------------------------------------------------------------------
alter table public.resumes add column if not exists summary         text;
-- Ruta de la foto dentro del bucket privado cv-photos (<user_id>/<aleatorio>.jpg); se muestra con URL firmada
alter table public.resumes add column if not exists photo_path      text;
alter table public.resumes add column if not exists birth_date      date;
alter table public.resumes add column if not exists neighborhood    text;
alter table public.resumes add column if not exists email           text;
alter table public.resumes add column if not exists skills_list     text[] not null default '{}';
alter table public.resumes add column if not exists education       jsonb  not null default '[]'::jsonb;
alter table public.resumes add column if not exists experience_list jsonb  not null default '[]'::jsonb;
-- Colores elegidos para el CV: { "bg": "navy", "title": "naranja" }
alter table public.resumes add column if not exists theme           jsonb  not null default '{}'::jsonb;

alter table public.resumes drop constraint if exists resumes_summary_len;
alter table public.resumes add constraint resumes_summary_len check (summary is null or char_length(summary) <= 300);
alter table public.resumes drop constraint if exists resumes_skills_max;
alter table public.resumes add constraint resumes_skills_max check (coalesce(array_length(skills_list, 1), 0) <= 5);
alter table public.resumes drop constraint if exists resumes_lists_are_arrays;
alter table public.resumes add constraint resumes_lists_are_arrays
  check (jsonb_typeof(education) = 'array' and jsonb_typeof(experience_list) = 'array');

-- Las habilidades viejas (texto separado por comas) pasan a la lista nueva
update public.resumes
  set skills_list = (
    select coalesce(array_agg(t), '{}') from (
      select trim(x) as t from unnest(string_to_array(skills, ',')) as x where trim(x) <> '' limit 5
    ) s
  )
  where skills is not null and skills <> '' and skills_list = '{}';

-- Si se aplicó 001_politicas_rls.sql, el UPDATE está limitado por columna: sumar las nuevas.
-- (Si no se aplicó, estos grant no cambian nada.)
grant update (province) on public.profiles to authenticated;
grant update (province) on public.jobs to authenticated;
grant update (province, intent, is_urgent) on public.services to authenticated;

-- 4. Fotos del CV (Storage) -------------------------------------------------------------
-- Bucket PRIVADO: las fotos se ven solo con URL firmada. Cada persona escribe solo en su carpeta.
-- La lectura para las empresas a las que se postuló y para el administrador se agrega en la 004.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('cv-photos', 'cv-photos', false, 2097152, array['image/jpeg'])
on conflict (id) do update set public = false;

drop policy if exists cv_photos_select_own on storage.objects;
create policy cv_photos_select_own on storage.objects for select to authenticated
  using (bucket_id = 'cv-photos' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists cv_photos_insert on storage.objects;
create policy cv_photos_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'cv-photos' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists cv_photos_update on storage.objects;
create policy cv_photos_update on storage.objects for update to authenticated
  using (bucket_id = 'cv-photos' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists cv_photos_delete on storage.objects;
create policy cv_photos_delete on storage.objects for delete to authenticated
  using (bucket_id = 'cv-photos' and (storage.foldername(name))[1] = auth.uid()::text);

commit;


-- ===== 004_admin_pagos_cv.sql =====

-- 004: administradores, configuración del cobro y compras de la descarga del CV en PDF.
-- Aplicar después de 003. Probar primero en un proyecto de Supabase de desarrollo.

begin;

-- 1. Administradores --------------------------------------------------------------------
alter table public.profiles add column if not exists is_admin boolean not null default false;

-- Nadie puede darse permisos de administrador desde la app: solo desde el panel de Supabase (SQL)
create or replace function public.profiles_protect_admin() returns trigger
language plpgsql as $$
begin
  if current_user in ('anon', 'authenticated') then
    if tg_op = 'INSERT' then
      new.is_admin := false;
    elsif new.is_admin is distinct from old.is_admin then
      raise exception 'no_permitido';
    end if;
  end if;
  return new;
end $$;
drop trigger if exists trg_profiles_protect_admin on public.profiles;
create trigger trg_profiles_protect_admin before insert or update on public.profiles
  for each row execute function public.profiles_protect_admin();

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select is_admin from public.profiles where id = auth.uid()), false);
$$;
grant execute on function public.is_admin() to anon, authenticated;

-- Para hacerte administrador (una sola vez, en el SQL Editor de Supabase):
--   update public.profiles set is_admin = true where id = (select id from auth.users where email = 'TU_EMAIL');

-- 2. Configuración del cobro (una sola fila) --------------------------------------------
create table if not exists public.app_settings (
  id              smallint primary key default 1 check (id = 1),
  cv_paid_enabled boolean       not null default false,
  cv_price        numeric(12,2) not null default 3000 check (cv_price > 0 and cv_price <= 1000000),
  cv_mode         text          not null default 'por_dias' check (cv_mode in ('por_descarga', 'por_dias', 'para_siempre')),
  cv_days         smallint      not null default 30 check (cv_days between 1 and 365),
  updated_at      timestamptz   not null default now()
);
insert into public.app_settings (id) values (1) on conflict (id) do nothing;

alter table public.app_settings enable row level security;
drop policy if exists app_settings_read on public.app_settings;
create policy app_settings_read on public.app_settings for select to anon, authenticated using (true);
drop policy if exists app_settings_admin_update on public.app_settings;
create policy app_settings_admin_update on public.app_settings for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- 3. Compras de la descarga ---------------------------------------------------------------
-- Las crean y actualizan solo las funciones del servidor (crear-pago-cv y mp-webhook).
create table if not exists public.cv_purchases (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references auth.users(id) on delete cascade,
  status           text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  amount           numeric(12,2) not null,
  mode             text not null check (mode in ('por_descarga', 'por_dias', 'para_siempre')),
  days             smallint,
  downloads_left   smallint,
  valid_until      timestamptz,
  mp_preference_id text,
  mp_payment_id    text unique,
  created_at       timestamptz not null default now(),
  approved_at      timestamptz
);
create index if not exists cv_purchases_user_idx on public.cv_purchases (user_id, status);

alter table public.cv_purchases enable row level security;
drop policy if exists cv_purchases_read on public.cv_purchases;
create policy cv_purchases_read on public.cv_purchases for select to authenticated
  using (user_id = auth.uid() or public.is_admin());
-- Sin políticas de insert/update/delete: desde el navegador no se pueden crear ni modificar.

-- 4. ¿Puede descargar? (no consume) -----------------------------------------------------
-- Tiene acceso si: compró "para siempre", o su compra sigue vigente (valid_until), o le queda una descarga.
create or replace function public.cv_access() returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  cfg public.app_settings;
  p   public.cv_purchases;
begin
  select * into cfg from public.app_settings where id = 1;
  select * into p from public.cv_purchases
    where user_id = auth.uid() and status = 'approved'
      and (mode = 'para_siempre' or valid_until > now() or (mode = 'por_descarga' and downloads_left > 0))
    order by approved_at desc limit 1;
  return jsonb_build_object(
    'paid_enabled',   coalesce(cfg.cv_paid_enabled, false),
    'price',          cfg.cv_price,
    'mode',           cfg.cv_mode,
    'days',           cfg.cv_days,
    'has_access',     p.id is not null,
    'access_mode',    p.mode,
    'valid_until',    p.valid_until,
    'downloads_left', p.downloads_left,
    'last_status',    (select status from public.cv_purchases where user_id = auth.uid() order by created_at desc limit 1)
  );
end $$;

-- 5. Registrar una descarga (justo antes de generar el PDF) ------------------------------
-- En "por descarga", la primera descarga deja 24 horas para repetirla (por si se cancela la impresión).
create or replace function public.consume_cv_download() returns boolean
language plpgsql security definer set search_path = public as $$
declare
  cfg public.app_settings;
  p   public.cv_purchases;
begin
  if auth.uid() is null then return false; end if;
  select * into cfg from public.app_settings where id = 1;
  if not coalesce(cfg.cv_paid_enabled, false) then return true; end if;

  select * into p from public.cv_purchases
    where user_id = auth.uid() and status = 'approved'
      and (mode = 'para_siempre' or valid_until > now() or (mode = 'por_descarga' and downloads_left > 0))
    order by approved_at desc limit 1
    for update;
  if p.id is null then return false; end if;

  if p.mode = 'por_descarga' and coalesce(p.downloads_left, 0) > 0 then
    update public.cv_purchases set downloads_left = 0, valid_until = now() + interval '24 hours' where id = p.id;
  end if;
  return true;
end $$;

revoke all on function public.cv_access() from public;
grant execute on function public.cv_access() to authenticated;
revoke all on function public.consume_cv_download() from public;
grant execute on function public.consume_cv_download() to authenticated;

-- 6. Duración de las publicaciones (la define el administrador) -------------------------
alter table public.app_settings add column if not exists job_days     smallint not null default 30 check (job_days between 1 and 365);
alter table public.app_settings add column if not exists service_days smallint not null default 30 check (service_days between 1 and 365);

-- Al publicar, la base fija estado, fecha y vencimiento: no se pueden mandar desde el navegador (SEC-003)
create or replace function public.listing_defaults() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  d smallint;
begin
  -- El trigger es security definer: miramos quién hace el pedido real
  if coalesce(auth.role(), '') in ('anon', 'authenticated') then
    select case when tg_table_name = 'jobs' then job_days else service_days end into d from public.app_settings where id = 1;
    new.status := 'active';
    new.created_at := now();
    new.expires_at := now() + make_interval(days => coalesce(d, 30));
    if tg_table_name = 'services' and new.intent <> 'busca' then new.is_urgent := false; end if;
  end if;
  return new;
end $$;
drop trigger if exists trg_jobs_defaults on public.jobs;
create trigger trg_jobs_defaults before insert on public.jobs for each row execute function public.listing_defaults();
drop trigger if exists trg_services_defaults on public.services;
create trigger trg_services_defaults before insert on public.services for each row execute function public.listing_defaults();

-- Renovar usa la duración configurada (reemplaza la versión con 30 días fijos)
create or replace function public.renew_listing(p_kind text, p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  cfg public.app_settings;
begin
  select * into cfg from public.app_settings where id = 1;
  if p_kind = 'job' then
    update public.jobs set status = 'active', expires_at = now() + make_interval(days => coalesce(cfg.job_days, 30))
      where id = p_id and company_id = auth.uid();
  elsif p_kind = 'service' then
    update public.services set status = 'active', expires_at = now() + make_interval(days => coalesce(cfg.service_days, 30))
      where id = p_id and owner_id = auth.uid();
  else
    raise exception 'tipo_invalido';
  end if;
  if not found then raise exception 'no_permitido'; end if;
end $$;
revoke all on function public.renew_listing(text, uuid) from public;
grant execute on function public.renew_listing(text, uuid) to authenticated;

-- 7. Postulaciones: el CV lo ven solo su dueño y las empresas a las que se postuló -------
create table if not exists public.applications (
  id         uuid primary key default gen_random_uuid(),
  job_id     uuid not null references public.jobs(id) on delete cascade,
  worker_id  uuid not null default auth.uid() references auth.users(id) on delete cascade,
  company_id uuid not null,
  created_at timestamptz not null default now(),
  unique (job_id, worker_id)
);
create index if not exists applications_company_idx on public.applications (company_id, created_at desc);
create index if not exists applications_worker_idx on public.applications (worker_id);

-- La empresa sale del aviso (no del navegador) y solo se puede postular a avisos vigentes
create or replace function public.applications_fill() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if coalesce(auth.role(), '') in ('anon', 'authenticated') then
    new.worker_id := auth.uid();
  end if;
  select company_id into new.company_id from public.jobs
    where id = new.job_id and status = 'active' and expires_at > now();
  if new.company_id is null then raise exception 'aviso_no_disponible'; end if;
  if new.company_id = new.worker_id then raise exception 'no_permitido'; end if;
  new.created_at := now();
  return new;
end $$;
drop trigger if exists trg_applications_fill on public.applications;
create trigger trg_applications_fill before insert on public.applications
  for each row execute function public.applications_fill();

alter table public.applications enable row level security;
drop policy if exists applications_insert on public.applications;
create policy applications_insert on public.applications for insert to authenticated with check (worker_id = auth.uid());
drop policy if exists applications_read on public.applications;
create policy applications_read on public.applications for select to authenticated
  using (worker_id = auth.uid() or company_id = auth.uid() or public.is_admin());
drop policy if exists applications_delete_own on public.applications;
create policy applications_delete_own on public.applications for delete to authenticated using (worker_id = auth.uid());

-- ¿La empresa que pregunta recibió una postulación de esta persona? (evita recursión de RLS)
create or replace function public.applied_to_me(p_worker uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.applications a where a.worker_id = p_worker and a.company_id = auth.uid());
$$;
grant execute on function public.applied_to_me(uuid) to authenticated;

-- CV: el dueño, las empresas a las que se postuló y el administrador (reemplaza "visibles para todos", SEC-002)
drop policy if exists resumes_select on public.resumes;
create policy resumes_select on public.resumes for select to authenticated
  using (user_id = auth.uid() or public.applied_to_me(user_id) or public.is_admin());

-- Fotos del CV: las mismas personas pueden pedir la URL firmada (SEC-001)
drop policy if exists cv_photos_select_shared on storage.objects;
create policy cv_photos_select_shared on storage.objects for select to authenticated
  using (
    bucket_id = 'cv-photos'
    and (
      public.is_admin()
      or exists (
        select 1 from public.applications a
        where a.worker_id::text = (storage.foldername(name))[1] and a.company_id = auth.uid()
      )
    )
  );

-- La vista de perfiles públicos no queda abierta a cualquiera sin cuenta (SEC-001)
do $$
begin
  if exists (select 1 from pg_views where schemaname = 'public' and viewname = 'public_profiles') then
    execute 'revoke select on public.public_profiles from anon';
  end if;
end $$;

-- 8. Control total del administrador ----------------------------------------------------
-- Ver todo (las políticas se suman a las existentes)
drop policy if exists jobs_admin_read on public.jobs;
create policy jobs_admin_read on public.jobs for select to authenticated using (public.is_admin());
drop policy if exists services_admin_read on public.services;
create policy services_admin_read on public.services for select to authenticated using (public.is_admin());

-- Editar cualquier publicación (incluidos estado y vencimiento, que los usuarios no pueden tocar)
create or replace function public.admin_update_listing(p_kind text, p_id uuid, p jsonb)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'no_permitido'; end if;
  if p ? 'status' and p->>'status' not in ('active', 'paused', 'filled') then raise exception 'estado_invalido'; end if;
  if p_kind = 'job' then
    update public.jobs set
      title        = coalesce(p->>'title', title),
      company_name = coalesce(p->>'company_name', company_name),
      category     = coalesce(p->>'category', category),
      job_type     = coalesce(p->>'job_type', job_type),
      salary       = coalesce(p->>'salary', salary),
      description  = coalesce(p->>'description', description),
      requirements = coalesce(p->>'requirements', requirements),
      phone        = coalesce(p->>'phone', phone),
      is_urgent    = coalesce((p->>'is_urgent')::boolean, is_urgent),
      status       = coalesce(p->>'status', status),
      expires_at   = coalesce((p->>'expires_at')::timestamptz, expires_at)
    where id = p_id;
  elsif p_kind = 'service' then
    if p ? 'status' and p->>'status' = 'filled' then raise exception 'estado_invalido'; end if;
    update public.services set
      title         = coalesce(p->>'title', title),
      provider_name = coalesce(p->>'provider_name', provider_name),
      category      = coalesce(p->>'category', category),
      description   = coalesce(p->>'description', description),
      phone         = coalesce(p->>'phone', phone),
      intent        = coalesce(p->>'intent', intent),
      is_urgent     = coalesce((p->>'is_urgent')::boolean, is_urgent),
      status        = coalesce(p->>'status', status),
      expires_at    = coalesce((p->>'expires_at')::timestamptz, expires_at)
    where id = p_id;
  else
    raise exception 'tipo_invalido';
  end if;
  if not found then raise exception 'no_encontrado'; end if;
end $$;

-- Eliminar cualquier publicación o CV
create or replace function public.admin_delete_listing(p_kind text, p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'no_permitido'; end if;
  if p_kind = 'job' then delete from public.jobs where id = p_id;
  elsif p_kind = 'service' then delete from public.services where id = p_id;
  else raise exception 'tipo_invalido';
  end if;
  if not found then raise exception 'no_encontrado'; end if;
end $$;

create or replace function public.admin_delete_resume(p_user uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'no_permitido'; end if;
  delete from public.resumes where user_id = p_user;
  if not found then raise exception 'no_encontrado'; end if;
end $$;

revoke all on function public.admin_update_listing(text, uuid, jsonb) from public;
grant execute on function public.admin_update_listing(text, uuid, jsonb) to authenticated;
revoke all on function public.admin_delete_listing(text, uuid) from public;
grant execute on function public.admin_delete_listing(text, uuid) to authenticated;
revoke all on function public.admin_delete_resume(uuid) from public;
grant execute on function public.admin_delete_resume(uuid) to authenticated;

commit;


-- ===== 005_grants_laburamos.sql =====

-- 005: permisos de la Data API para las tablas que crea la migración 004.
--
-- Ejecutar DESPUÉS de 004. Sin estos GRANT, Supabase puede devolver
-- "permission denied for table app_settings / applications / cv_purchases"
-- aunque las políticas RLS estén bien.
--
-- Las políticas RLS siguen siendo las que deciden qué filas ve cada usuario.

begin;

grant usage on schema public to anon, authenticated;

-- La configuración la lee cualquiera (incluso sin sesión) para mostrar los
-- días de duración; solo el administrador puede modificarla (RLS en 004).
grant select on public.app_settings to anon, authenticated;
grant update (cv_paid_enabled, cv_price, cv_mode, cv_days, job_days, service_days, updated_at)
  on public.app_settings to authenticated;

-- El historial de compras lo lee su dueño o el administrador (RLS en 004).
-- No hay GRANT de escritura: solo lo escriben las Edge Functions con service_role.
grant select on public.cv_purchases to authenticated;

-- Postulaciones: el usuario inserta la suya, la empresa y el postulante leen,
-- y el postulante puede borrar la propia (RLS en 004).
grant select, insert, delete on public.applications to authenticated;

commit;

