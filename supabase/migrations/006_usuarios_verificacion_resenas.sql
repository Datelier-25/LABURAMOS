-- 006: bloqueo de usuarios, verificación de comercios y reseñas.
-- Aplicar después de 005. Probar primero en un proyecto de Supabase de desarrollo.

begin;

-- ============================================================================
-- 1. Banderas nuevas en el perfil
-- ============================================================================
alter table public.profiles add column if not exists is_blocked boolean not null default false;
alter table public.profiles add column if not exists is_verified boolean not null default false;
alter table public.profiles add column if not exists verification_requested boolean not null default false;

-- El navegador no puede tocar estas banderas (ni is_admin): solo los RPC del
-- administrador, que son security definer (corren como el dueño de la función).
create or replace function public.profiles_protect_admin() returns trigger
language plpgsql as $$
begin
  if current_user in ('anon', 'authenticated') then
    if tg_op = 'INSERT' then
      new.is_admin := false;
      new.is_blocked := false;
      new.is_verified := false;
      new.verification_requested := false;
    else
      if new.is_admin is distinct from old.is_admin then raise exception 'no_permitido'; end if;
      if new.is_blocked is distinct from old.is_blocked then raise exception 'no_permitido'; end if;
      if new.is_verified is distinct from old.is_verified then raise exception 'no_permitido'; end if;
      if new.verification_requested is distinct from old.verification_requested then raise exception 'no_permitido'; end if;
    end if;
  end if;
  return new;
end $$;

-- ¿Esta cuenta está bloqueada? (para políticas de RLS y para la app)
create or replace function public.is_blocked(p_user uuid default auth.uid()) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select is_blocked from public.profiles where id = p_user), false);
$$;
grant execute on function public.is_blocked(uuid) to anon, authenticated;

-- ¿Esta cuenta puede ver CVs? Solo comercios verificados (o el administrador).
create or replace function public.can_see_cvs() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select is_verified or is_admin from public.profiles where id = auth.uid()), false);
$$;
grant execute on function public.can_see_cvs() to authenticated;

-- ============================================================================
-- 2. Una cuenta bloqueada no puede publicar, postularse ni editar su CV
-- ============================================================================
drop policy if exists jobs_select on public.jobs;
create policy jobs_select on public.jobs
  for select to anon, authenticated
  using (
    (status = 'active' and expires_at > now() and not public.is_blocked(company_id))
    or company_id = auth.uid()
  );

drop policy if exists jobs_insert on public.jobs;
create policy jobs_insert on public.jobs
  for insert to authenticated
  with check (company_id = auth.uid() and not public.is_blocked());

drop policy if exists services_select on public.services;
create policy services_select on public.services
  for select to anon, authenticated
  using (
    (status = 'active' and expires_at > now() and not public.is_blocked(owner_id))
    or owner_id = auth.uid()
  );

drop policy if exists services_insert on public.services;
create policy services_insert on public.services
  for insert to authenticated
  with check (owner_id = auth.uid() and not public.is_blocked());

drop policy if exists applications_insert on public.applications;
create policy applications_insert on public.applications for insert to authenticated
  with check (worker_id = auth.uid() and not public.is_blocked());

drop policy if exists resumes_insert on public.resumes;
create policy resumes_insert on public.resumes
  for insert to authenticated
  with check (user_id = auth.uid() and not public.is_blocked());

drop policy if exists resumes_update on public.resumes;
create policy resumes_update on public.resumes
  for update to authenticated
  using (user_id = auth.uid() and not public.is_blocked())
  with check (user_id = auth.uid() and not public.is_blocked());

-- ============================================================================
-- 3. Verificación de comercios: solo un comercio verificado ve CVs
-- ============================================================================
drop policy if exists resumes_select on public.resumes;
create policy resumes_select on public.resumes for select to authenticated
  using (
    user_id = auth.uid()
    or public.is_admin()
    or (public.applied_to_me(user_id) and public.can_see_cvs())
  );

drop policy if exists cv_photos_select_shared on storage.objects;
create policy cv_photos_select_shared on storage.objects for select to authenticated
  using (
    bucket_id = 'cv-photos'
    and (
      public.is_admin()
      or (
        public.can_see_cvs()
        and exists (
          select 1 from public.applications a
          where a.worker_id::text = (storage.foldername(name))[1] and a.company_id = auth.uid()
        )
      )
    )
  );

-- El comercio pide la verificación desde la app (el admin la aprueba)
create or replace function public.request_verification() returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'no_permitido'; end if;
  update public.profiles set verification_requested = true where id = auth.uid();
  if not found then raise exception 'no_encontrado'; end if;
end $$;
revoke all on function public.request_verification() from public;
grant execute on function public.request_verification() to authenticated;

-- ============================================================================
-- 4. Gestión de usuarios desde el panel
-- ============================================================================
create or replace function public.admin_users()
returns table (
  id uuid,
  email text,
  full_name text,
  role text,
  city text,
  province text,
  is_admin boolean,
  is_blocked boolean,
  is_verified boolean,
  verification_requested boolean,
  created_at timestamptz,
  listings int,
  applications int
)
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'no_permitido'; end if;
  return query
    select p.id, u.email::text, p.full_name, p.role, p.city, p.province,
           p.is_admin, p.is_blocked, p.is_verified, p.verification_requested,
           p.created_at,
           ((select count(*) from public.jobs j where j.company_id = p.id)
            + (select count(*) from public.services s where s.owner_id = p.id))::int,
           (select count(*) from public.applications a where a.worker_id = p.id)::int
    from public.profiles p
    join auth.users u on u.id = p.id
    order by p.created_at desc;
end $$;
revoke all on function public.admin_users() from public;
grant execute on function public.admin_users() to authenticated;

create or replace function public.admin_set_user(
  p_user uuid,
  p_role text default null,
  p_is_admin boolean default null,
  p_is_blocked boolean default null,
  p_is_verified boolean default null
) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'no_permitido'; end if;
  if p_user = auth.uid() and coalesce(p_is_blocked, false) then
    raise exception 'no_podes_bloquearte';
  end if;
  if p_role is not null and p_role not in ('worker', 'company') then
    raise exception 'rol_invalido';
  end if;

  update public.profiles set
    role         = coalesce(p_role, role),
    is_admin     = coalesce(p_is_admin, is_admin),
    is_blocked   = coalesce(p_is_blocked, is_blocked),
    is_verified  = coalesce(p_is_verified, is_verified),
    -- Si se bloquea, se limpia el pedido de verificación
    verification_requested = case when coalesce(p_is_blocked, false) then false else verification_requested end
  where id = p_user;
  if not found then raise exception 'no_encontrado'; end if;

  -- Al bloquear, se pausan sus publicaciones para que dejen de aparecer
  if coalesce(p_is_blocked, false) then
    update public.jobs set status = 'paused' where company_id = p_user and status = 'active';
    update public.services set status = 'paused' where owner_id = p_user and status = 'active';
  end if;
end $$;
revoke all on function public.admin_set_user(uuid, text, boolean, boolean, boolean) from public;
grant execute on function public.admin_set_user(uuid, text, boolean, boolean, boolean) to authenticated;

-- Solo el dueño (trabajador) ve su postulación; la empresa recibe las postulaciones
-- de sus avisos si está verificada (o el admin). El candado aplica a los CVs.
drop policy if exists applications_read on public.applications;
create policy applications_read on public.applications for select to authenticated
  using (
    worker_id = auth.uid()
    or (company_id = auth.uid() and public.can_see_cvs())
    or public.is_admin()
  );

-- ============================================================================
-- 5. Reseñas: cada parte califica a la otra después de una postulación
-- ============================================================================
create table if not exists public.reviews (
  id             uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.applications(id) on delete cascade,
  author_id      uuid not null default auth.uid() references auth.users(id) on delete cascade,
  target_id      uuid not null references auth.users(id) on delete cascade,
  rating         smallint not null check (rating between 1 and 5),
  comment        text check (comment is null or char_length(comment) <= 600),
  created_at     timestamptz not null default now(),
  unique (application_id, author_id)
);
create index if not exists reviews_target_idx on public.reviews (target_id, created_at desc);

-- El autor y el calificado salen de la postulación (no del navegador)
create or replace function public.reviews_fill() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if coalesce(auth.role(), '') in ('anon', 'authenticated') then
    new.author_id := auth.uid();
  end if;
  select case when a.worker_id = new.author_id then a.company_id else a.worker_id end
    into new.target_id
    from public.applications a
    where a.id = new.application_id
      and new.author_id in (a.worker_id, a.company_id);
  if new.target_id is null then raise exception 'no_permitido'; end if;
  new.created_at := now();
  return new;
end $$;
drop trigger if exists trg_reviews_fill on public.reviews;
create trigger trg_reviews_fill before insert on public.reviews
  for each row execute function public.reviews_fill();

alter table public.reviews enable row level security;

drop policy if exists reviews_read on public.reviews;
create policy reviews_read on public.reviews for select to authenticated using (true);

drop policy if exists reviews_insert on public.reviews;
create policy reviews_insert on public.reviews for insert to authenticated
  with check (author_id = auth.uid() and not public.is_blocked());

drop policy if exists reviews_admin_delete on public.reviews;
create policy reviews_admin_delete on public.reviews for delete to authenticated using (public.is_admin());

revoke all on public.reviews from anon, authenticated;
grant select, insert on public.reviews to authenticated;
grant delete on public.reviews to authenticated;

-- Promedio público por persona (solo el número, sin datos personales)
create or replace view public.user_ratings as
  select target_id as user_id,
         round(avg(rating)::numeric, 1) as rating,
         count(*)::int as reviews
  from public.reviews
  group by target_id;
revoke all on public.user_ratings from anon, authenticated;
grant select on public.user_ratings to anon, authenticated;

-- Reputación pública: si el comercio está verificado y su puntaje (sin exponer
-- el perfil completo, que sigue siendo privado).
create or replace view public.user_reputation as
  select p.id as user_id,
         p.is_verified,
         coalesce((select round(avg(r.rating)::numeric, 1) from public.reviews r where r.target_id = p.id), 0) as rating,
         (select count(*) from public.reviews r where r.target_id = p.id)::int as reviews
  from public.profiles p;
revoke all on public.user_reputation from anon, authenticated;
grant select on public.user_reputation to anon, authenticated;

commit;
