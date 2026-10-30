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
