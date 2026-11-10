-- 028: premium por publicación (links y fotos extra).
--
-- Primera etapa sin cobro automático: el administrador activa o quita el
-- premium de una publicación desde el panel. Igual que el resto de los
-- límites, la base valida los links y la cantidad de fotos para que no se
-- puedan saltear desde el navegador.

begin;

-- 1) Configuración del premium (editable desde Configuración)
alter table public.app_settings
  add column if not exists premium_enabled boolean not null default false,
  add column if not exists premium_price numeric not null default 3000,
  add column if not exists premium_days smallint not null default 30,
  add column if not exists premium_include_links boolean not null default true,
  add column if not exists premium_include_photos boolean not null default true,
  add column if not exists free_links_limit smallint not null default 1,
  add column if not exists premium_links_limit smallint not null default 3,
  add column if not exists free_photos_limit smallint not null default 5,
  add column if not exists premium_photos_limit smallint not null default 10;

alter table public.app_settings drop constraint if exists app_settings_premium_check;
alter table public.app_settings add constraint app_settings_premium_check check (
  premium_price >= 0
  and premium_days between 1 and 365
  and free_links_limit between 0 and 20
  and premium_links_limit between 0 and 20
  and free_photos_limit between 0 and 20
  and premium_photos_limit between 0 and 20
);

-- La app lee la configuración con select('*'): hay que dar permiso a las
-- columnas nuevas. El update sigue protegido por la política is_admin().
grant select (
  premium_enabled, premium_price, premium_days, premium_include_links,
  premium_include_photos, free_links_limit, premium_links_limit,
  free_photos_limit, premium_photos_limit
) on public.app_settings to anon, authenticated;
grant update (
  premium_enabled, premium_price, premium_days, premium_include_links,
  premium_include_photos, free_links_limit, premium_links_limit,
  free_photos_limit, premium_photos_limit
) on public.app_settings to authenticated;

-- 2) Links y vencimiento del premium en cada publicación
alter table public.jobs
  add column if not exists links text[] not null default '{}',
  add column if not exists premium_until timestamptz;

alter table public.services
  add column if not exists links text[] not null default '{}',
  add column if not exists premium_until timestamptz;

alter table public.jobs drop constraint if exists jobs_links_max;
alter table public.jobs add constraint jobs_links_max
  check (coalesce(array_length(links, 1), 0) <= 20);

alter table public.services drop constraint if exists services_links_max;
alter table public.services add constraint services_links_max
  check (coalesce(array_length(links, 1), 0) <= 20);

-- La cantidad real se controla en el trigger según el premium. El tope fijo
-- evita valores absurdos si alguien llama directo a la API.
alter table public.services drop constraint if exists services_photos_max;
alter table public.services add constraint services_photos_max
  check (coalesce(array_length(photos, 1), 0) <= 20);

-- select('*') necesita permiso sobre todas las columnas.
grant select (links, premium_until) on public.jobs to anon, authenticated;
grant select (links, premium_until) on public.services to anon, authenticated;

-- Los links se pueden cargar al publicar. La edición pasa por
-- admin_update_listing. premium_until solo lo cambia el RPC del administrador.
grant insert (links) on public.jobs to authenticated;
grant insert (links) on public.services to authenticated;

-- 3) Validación de límites y links en la base
create or replace function public.enforce_listing_limits()
returns trigger
language plpgsql
security definer
set search_path = public
as $function$
declare
  cfg public.app_settings%rowtype;
  v_new jsonb := to_jsonb(NEW);
  v_old jsonb := case when TG_OP = 'UPDATE' then to_jsonb(OLD) else '{}'::jsonb end;
  v_links jsonb := coalesce(v_new->'links', '[]'::jsonb);
  v_photos jsonb := coalesce(v_new->'photos', '[]'::jsonb);
  v_link_count int;
  v_photo_count int;
  v_link_limit int;
  v_photo_limit int;
  v_premium boolean;
begin
  -- Si solo cambió otro campo, no revisamos límites: así una publicación
  -- premium vencida se puede seguir editando sin borrar sus links o fotos.
  if TG_OP = 'UPDATE'
     and (v_new->'links') is not distinct from (v_old->'links')
     and (v_new->'photos') is not distinct from (v_old->'photos') then
    return NEW;
  end if;

  select * into cfg from public.app_settings where id = 1;

  v_premium := coalesce(cfg.premium_enabled, false)
    and NEW.premium_until is not null
    and NEW.premium_until > now();

  if coalesce(cfg.premium_include_links, true) then
    v_link_limit := case
      when v_premium then coalesce(cfg.premium_links_limit, 3)
      else coalesce(cfg.free_links_limit, 1)
    end;
  else
    v_link_limit := greatest(coalesce(cfg.free_links_limit, 1), coalesce(cfg.premium_links_limit, 3));
  end if;

  if coalesce(cfg.premium_include_photos, true) then
    v_photo_limit := case
      when v_premium then coalesce(cfg.premium_photos_limit, 10)
      else coalesce(cfg.free_photos_limit, 5)
    end;
  else
    v_photo_limit := greatest(coalesce(cfg.free_photos_limit, 5), coalesce(cfg.premium_photos_limit, 10));
  end if;

  if jsonb_typeof(v_links) <> 'array' then
    raise exception 'links_invalidos';
  end if;
  if jsonb_typeof(v_photos) <> 'array' then
    raise exception 'fotos_invalidas';
  end if;

  v_link_count := jsonb_array_length(v_links);
  v_photo_count := jsonb_array_length(v_photos);

  if v_link_count > v_link_limit then
    raise exception 'links_limite';
  end if;
  if v_photo_count > v_photo_limit then
    raise exception 'fotos_limite';
  end if;

  if exists (
    select 1
    from jsonb_array_elements_text(v_links) as t(link)
    where link !~* '^https?://[^[:space:]]+$' or length(link) > 500
  ) then
    raise exception 'link_invalido';
  end if;

  return NEW;
end
$function$;

drop trigger if exists enforce_job_limits on public.jobs;
create trigger enforce_job_limits
  before insert or update on public.jobs
  for each row execute function public.enforce_listing_limits();

drop trigger if exists enforce_service_limits on public.services;
create trigger enforce_service_limits
  before insert or update on public.services
  for each row execute function public.enforce_listing_limits();

-- 4) Edición: sumamos links al RPC que ya usan el dueño y el administrador
create or replace function public.admin_update_listing(p_kind text, p_id uuid, p jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_owner uuid;
begin
  if p_kind = 'job' then
    select company_id into v_owner from public.jobs where id = p_id;
  elsif p_kind = 'service' then
    select owner_id into v_owner from public.services where id = p_id;
  else
    raise exception 'tipo_invalido';
  end if;

  if v_owner is null then
    raise exception 'no_encontrado';
  end if;

  if not public.is_admin() and v_owner is distinct from auth.uid() then
    raise exception 'no_es_dueno';
  end if;

  if p ? 'status' and p->>'status' not in ('active', 'paused', 'filled') then
    raise exception 'estado_invalido';
  end if;

  if p ? 'photos' and jsonb_typeof(p->'photos') <> 'array' then
    raise exception 'fotos_invalidas';
  end if;

  if p ? 'links' and jsonb_typeof(p->'links') <> 'array' then
    raise exception 'links_invalidos';
  end if;

  if p_kind = 'job' then
    update public.jobs set
      title        = case when p ? 'title' then nullif(p->>'title', '') else title end,
      company_name = case when p ? 'company_name' then nullif(p->>'company_name', '') else company_name end,
      category     = case when p ? 'category' then nullif(p->>'category', '') else category end,
      job_type     = case when p ? 'job_type' then nullif(p->>'job_type', '') else job_type end,
      salary       = case when p ? 'salary' then nullif(p->>'salary', '') else salary end,
      pay_type     = case when p ? 'pay_type' then nullif(p->>'pay_type', '') else pay_type end,
      location     = case when p ? 'location' then nullif(p->>'location', '') else location end,
      province     = case when p ? 'province' then nullif(p->>'province', '') else province end,
      phone        = case when p ? 'phone' then nullif(p->>'phone', '') else phone end,
      description  = case when p ? 'description' then coalesce(p->>'description', '') else description end,
      requirements = case when p ? 'requirements' then nullif(p->>'requirements', '') else requirements end,
      schedule     = case when p ? 'schedule' then nullif(p->>'schedule', '') else schedule end,
      duration     = case when p ? 'duration' then nullif(p->>'duration', '') else duration end,
      icon         = case when p ? 'icon' then nullif(p->>'icon', '') else icon end,
      links        = case when p ? 'links' then
                       coalesce(
                         (select array_agg(value)
                          from jsonb_array_elements_text(p->'links') as t(value)),
                         '{}'::text[]
                       )
                     else links end,
      is_urgent    = case when p ? 'is_urgent' then (p->>'is_urgent')::boolean else is_urgent end,
      status       = case when p ? 'status' then p->>'status' else status end,
      expires_at   = case when p ? 'expires_at' then (p->>'expires_at')::timestamptz else expires_at end
    where id = p_id;
  else
    if p ? 'status' and p->>'status' = 'filled' then
      raise exception 'estado_invalido';
    end if;
    update public.services set
      title           = case when p ? 'title' then nullif(p->>'title', '') else title end,
      provider_name   = case when p ? 'provider_name' then nullif(p->>'provider_name', '') else provider_name end,
      provider_prefix = case when p ? 'provider_prefix' then nullif(p->>'provider_prefix', '') else provider_prefix end,
      category        = case when p ? 'category' then nullif(p->>'category', '') else category end,
      description     = case when p ? 'description' then coalesce(p->>'description', '') else description end,
      phone           = case when p ? 'phone' then nullif(p->>'phone', '') else phone end,
      city            = case when p ? 'city' then nullif(p->>'city', '') else city end,
      province        = case when p ? 'province' then nullif(p->>'province', '') else province end,
      intent          = case when p ? 'intent' then nullif(p->>'intent', '') else intent end,
      price           = case when p ? 'price' then nullif(p->>'price', '') else price end,
      icon            = case when p ? 'icon' then nullif(p->>'icon', '') else icon end,
      photos          = case when p ? 'photos' then
                          coalesce(
                            (select array_agg(value)
                             from jsonb_array_elements_text(p->'photos') as t(value)),
                            '{}'::text[]
                          )
                        else photos end,
      links           = case when p ? 'links' then
                          coalesce(
                            (select array_agg(value)
                             from jsonb_array_elements_text(p->'links') as t(value)),
                            '{}'::text[]
                          )
                        else links end,
      is_urgent       = case when p ? 'is_urgent' then (p->>'is_urgent')::boolean else is_urgent end,
      status          = case when p ? 'status' then p->>'status' else status end,
      expires_at      = case when p ? 'expires_at' then (p->>'expires_at')::timestamptz else expires_at end
    where id = p_id;
  end if;

  if not found then
    raise exception 'no_encontrado';
  end if;
end
$function$;

grant execute on function public.admin_update_listing(text, uuid, jsonb) to authenticated;

-- 5) Activación manual del premium por publicación
create or replace function public.admin_set_listing_premium(p_kind text, p_id uuid, p_enabled boolean)
returns timestamptz
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_days int;
  v_until timestamptz;
begin
  if not public.is_admin() then
    raise exception 'no_es_admin';
  end if;

  select coalesce(premium_days, 30) into v_days from public.app_settings where id = 1;
  if v_days is null or v_days < 1 then
    v_days := 30;
  end if;

  v_until := case when p_enabled then now() + make_interval(days => v_days) else null end;

  if p_kind = 'job' then
    update public.jobs set premium_until = v_until where id = p_id;
  elsif p_kind = 'service' then
    update public.services set premium_until = v_until where id = p_id;
  else
    raise exception 'tipo_invalido';
  end if;

  if not found then
    raise exception 'no_encontrado';
  end if;

  return v_until;
end
$function$;

grant execute on function public.admin_set_listing_premium(text, uuid, boolean) to authenticated;

commit;
