-- 043: límite de publicaciones por usuario (configurable desde Admin).
--
-- Máximo de avisos de empleo (jobs) y de servicios/oficios (services) que cada
-- persona puede tener publicados al mismo tiempo. "Publicado" = activo y no
-- vencido. Se controla al crear, reactivar o renovar para que no se pueda
-- saltear desde el navegador.

begin;

-- 1) Configuración
alter table public.app_settings
  add column if not exists max_jobs_per_user smallint not null default 3,
  add column if not exists max_services_per_user smallint not null default 3;

alter table public.app_settings drop constraint if exists app_settings_pub_limits_check;
alter table public.app_settings add constraint app_settings_pub_limits_check check (
  max_jobs_per_user between 1 and 50
  and max_services_per_user between 1 and 50
);

grant select (max_jobs_per_user, max_services_per_user) on public.app_settings to anon, authenticated;
grant update (max_jobs_per_user, max_services_per_user) on public.app_settings to authenticated;

-- 2) Conteo de publicaciones activas (no vencidas) por usuario/tipo
create or replace function public.active_listing_count(p_kind text, p_user uuid, p_exclude uuid default null)
returns int
language sql
stable
security definer
set search_path = public
as $function$
  select case p_kind
    when 'job' then (
      select count(*)::int from public.jobs
      where company_id = p_user
        and status = 'active'
        and expires_at > now()
        and (p_exclude is null or id <> p_exclude)
    )
    when 'service' then (
      select count(*)::int from public.services
      where owner_id = p_user
        and status = 'active'
        and expires_at > now()
        and (p_exclude is null or id <> p_exclude)
    )
    else 0
  end;
$function$;

-- 3) Tope al crear una publicación activa
create or replace function public.enforce_listing_count()
returns trigger
language plpgsql
security definer
set search_path = public
as $function$
declare
  cfg public.app_settings%rowtype;
  v_kind text;
  v_owner uuid;
  v_max int;
begin
  if TG_TABLE_NAME = 'jobs' then
    v_kind := 'job';
    v_owner := new.company_id;
  else
    v_kind := 'service';
    v_owner := new.owner_id;
  end if;

  -- Solo cuentan las publicaciones activas y vigentes.
  if coalesce(new.status, 'active') <> 'active' then
    return new;
  end if;
  if new.expires_at is not null and new.expires_at <= now() then
    return new;
  end if;

  select * into cfg from public.app_settings where id = 1;
  v_max := case v_kind
    when 'job' then coalesce(cfg.max_jobs_per_user, 3)
    else coalesce(cfg.max_services_per_user, 3)
  end;

  if public.active_listing_count(v_kind, v_owner) >= v_max then
    raise exception 'limite_publicaciones';
  end if;

  return new;
end
$function$;

drop trigger if exists enforce_job_count on public.jobs;
create trigger enforce_job_count
  before insert on public.jobs
  for each row execute function public.enforce_listing_count();

drop trigger if exists enforce_service_count on public.services;
create trigger enforce_service_count
  before insert on public.services
  for each row execute function public.enforce_listing_count();

-- 4) Reactivar: no puede pasar a activo si ya alcanzó el tope
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
declare
  cfg public.app_settings%rowtype;
  v_owner uuid;
  v_expires timestamptz;
  v_max int;
begin
  if p_status not in ('active', 'paused', 'filled') then
    raise exception 'estado_invalido';
  end if;

  select * into cfg from public.app_settings where id = 1;

  if p_kind = 'job' then
    select company_id, expires_at into v_owner, v_expires from public.jobs where id = p_id and company_id = auth.uid();
    if not found then raise exception 'no_permitido'; end if;
    if p_status = 'active' and v_expires > now()
       and public.active_listing_count('job', v_owner, p_id) >= coalesce(cfg.max_jobs_per_user, 3) then
      raise exception 'limite_publicaciones';
    end if;
    update public.jobs set status = p_status where id = p_id and company_id = auth.uid();
  elsif p_kind = 'service' then
    if p_status = 'filled' then
      raise exception 'estado_invalido';
    end if;
    select owner_id, expires_at into v_owner, v_expires from public.services where id = p_id and owner_id = auth.uid();
    if not found then raise exception 'no_permitido'; end if;
    if p_status = 'active' and v_expires > now()
       and public.active_listing_count('service', v_owner, p_id) >= coalesce(cfg.max_services_per_user, 3) then
      raise exception 'limite_publicaciones';
    end if;
    update public.services set status = p_status where id = p_id and owner_id = auth.uid();
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

-- 5) Renovar: vuelve a activo, así que también respeta el tope
create or replace function public.renew_listing(p_kind text, p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  cfg public.app_settings;
  v_owner uuid;
begin
  select * into cfg from public.app_settings where id = 1;
  if p_kind = 'job' then
    select company_id into v_owner from public.jobs where id = p_id and company_id = auth.uid();
    if not found then raise exception 'no_permitido'; end if;
    if public.active_listing_count('job', v_owner, p_id) >= coalesce(cfg.max_jobs_per_user, 3) then
      raise exception 'limite_publicaciones';
    end if;
    update public.jobs set status = 'active', expires_at = now() + make_interval(days => coalesce(cfg.job_days, 30))
      where id = p_id and company_id = auth.uid();
  elsif p_kind = 'service' then
    select owner_id into v_owner from public.services where id = p_id and owner_id = auth.uid();
    if not found then raise exception 'no_permitido'; end if;
    if public.active_listing_count('service', v_owner, p_id) >= coalesce(cfg.max_services_per_user, 3) then
      raise exception 'limite_publicaciones';
    end if;
    update public.services set status = 'active', expires_at = now() + make_interval(days => coalesce(cfg.service_days, 30))
      where id = p_id and owner_id = auth.uid();
  else
    raise exception 'tipo_invalido';
  end if;
  if not found then raise exception 'no_permitido'; end if;
end $$;
revoke all on function public.renew_listing(text, uuid) from public;
grant execute on function public.renew_listing(text, uuid) to authenticated;

commit;