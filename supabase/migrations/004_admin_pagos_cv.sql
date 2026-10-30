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
