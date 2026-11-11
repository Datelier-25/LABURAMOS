-- 033: anuncios en video de hasta 30 segundos.
--
-- Los usuarios suben un video, la base calcula el precio por segundo y deja la
-- campaña pendiente de revisión. El administrador aprueba/rechaza y acredita el
-- pago. Un anuncio se muestra solo si está aprobado, pago y vigente; la
-- selección es aleatoria y se hace con una función que no expone la tabla.
--
-- Primera etapa: el pago se acredita a mano desde el panel. La tabla ya guarda
-- monto, estado de pago y referencia para conectar Mercado Pago más adelante.

begin;

-- 1) Configuración de los anuncios ---------------------------------------------------------
alter table public.app_settings
  add column if not exists ads_enabled boolean not null default true,
  add column if not exists ads_price_per_second numeric(12,2) not null default 100,
  add column if not exists ads_max_seconds smallint not null default 30,
  add column if not exists ads_min_seconds smallint not null default 5,
  add column if not exists ads_days smallint not null default 30,
  add column if not exists ads_skip_seconds smallint not null default 5,
  add column if not exists ads_max_per_user smallint not null default 3;

alter table public.app_settings drop constraint if exists app_settings_ads_check;
alter table public.app_settings add constraint app_settings_ads_check check (
  ads_price_per_second > 0
  and ads_price_per_second <= 1000000
  and ads_max_seconds between 5 and 30
  and ads_min_seconds between 1 and ads_max_seconds
  and ads_days between 1 and 365
  and ads_skip_seconds between 0 and ads_max_seconds
  and ads_max_per_user between 1 and 20
);

-- La app lee la configuración con select('*'): hay que dar permiso a las
-- columnas nuevas. El update sigue protegido por la política is_admin().
grant select (
  ads_enabled, ads_price_per_second, ads_max_seconds, ads_min_seconds,
  ads_days, ads_skip_seconds, ads_max_per_user
) on public.app_settings to anon, authenticated;
grant update (
  ads_enabled, ads_price_per_second, ads_max_seconds, ads_min_seconds,
  ads_days, ads_skip_seconds, ads_max_per_user
) on public.app_settings to authenticated;

-- 2) Campañas de anuncios ------------------------------------------------------------------
create table if not exists public.ad_campaigns (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references auth.users(id) on delete cascade,
  title            text not null,
  advertiser_name  text,
  target_url       text,
  video_path       text not null,
  video_mime       text,
  video_size       bigint,
  duration_seconds numeric(5,2) not null,
  amount           numeric(12,2) not null,
  review_status    text not null default 'pending' check (review_status in ('pending', 'approved', 'rejected')),
  payment_status   text not null default 'pending' check (payment_status in ('pending', 'paid')),
  active           boolean not null default true,
  review_note      text,
  payment_ref      text,
  starts_at        timestamptz,
  ends_at          timestamptz,
  approved_at      timestamptz,
  approved_by      uuid references auth.users(id) on delete set null,
  paid_at          timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  constraint ad_campaigns_duration_check check (duration_seconds > 0 and duration_seconds <= 30),
  constraint ad_campaigns_amount_check check (amount > 0),
  constraint ad_campaigns_title_len check (length(title) between 3 and 120),
  constraint ad_campaigns_video_path_len check (length(video_path) <= 500),
  constraint ad_campaigns_target_url_len check (target_url is null or length(target_url) <= 500)
);

create index if not exists ad_campaigns_user_idx on public.ad_campaigns (user_id, created_at desc);
create index if not exists ad_campaigns_live_idx on public.ad_campaigns (review_status, payment_status, active, ends_at);

alter table public.ad_campaigns enable row level security;

drop policy if exists ad_campaigns_read on public.ad_campaigns;
create policy ad_campaigns_read on public.ad_campaigns for select to authenticated
  using (user_id = auth.uid() or public.is_admin());

-- El dueño puede borrar su campaña mientras no esté paga; el administrador, cualquiera.
-- Las altas y los cambios de estado pasan solo por las funciones de abajo.
drop policy if exists ad_campaigns_delete on public.ad_campaigns;
create policy ad_campaigns_delete on public.ad_campaigns for delete to authenticated
  using (public.is_admin() or (user_id = auth.uid() and payment_status <> 'paid'));

grant select on public.ad_campaigns to authenticated;
grant delete on public.ad_campaigns to authenticated;

-- 3) Enviar un anuncio ---------------------------------------------------------------------
-- El precio y la duración máxima salen de app_settings, nunca del navegador.
create or replace function public.submit_ad_campaign(
  p_title text,
  p_video_path text,
  p_duration_seconds numeric,
  p_advertiser_name text default null,
  p_target_url text default null,
  p_video_mime text default null,
  p_video_size bigint default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $function$
declare
  cfg public.app_settings%rowtype;
  v_uid uuid := auth.uid();
  v_title text := btrim(coalesce(p_title, ''));
  v_path text := btrim(coalesce(p_video_path, ''));
  v_advertiser text := nullif(btrim(coalesce(p_advertiser_name, '')), '');
  v_url text := nullif(btrim(coalesce(p_target_url, '')), '');
  v_mime text := nullif(btrim(coalesce(p_video_mime, '')), '');
  v_duration numeric := round(coalesce(p_duration_seconds, 0)::numeric, 2);
  v_amount numeric;
  v_count int;
  v_id uuid;
begin
  if v_uid is null then
    raise exception 'no_autenticado';
  end if;

  if exists (select 1 from public.profiles where id = v_uid and is_blocked) then
    raise exception 'cuenta_bloqueada';
  end if;

  select * into cfg from public.app_settings where id = 1;

  if not coalesce(cfg.ads_enabled, false) then
    raise exception 'anuncios_desactivados';
  end if;

  if length(v_title) < 3 or length(v_title) > 120 then
    raise exception 'titulo_invalido';
  end if;

  if v_duration < coalesce(cfg.ads_min_seconds, 5)
     or v_duration > coalesce(cfg.ads_max_seconds, 30)
     or v_duration > 30 then
    raise exception 'duracion_invalida';
  end if;

  -- El archivo tiene que estar en la carpeta de quien lo envía.
  if v_path = '' or v_path !~ ('^' || v_uid::text || '/') then
    raise exception 'video_invalido';
  end if;

  if v_mime is not null and v_mime not in ('video/mp4', 'video/webm', 'video/quicktime') then
    raise exception 'formato_invalido';
  end if;

  if p_video_size is not null and (p_video_size <= 0 or p_video_size > 52428800) then
    raise exception 'video_grande';
  end if;

  if v_url is not null and (v_url !~* '^https?://[^[:space:]]+$' or length(v_url) > 500) then
    raise exception 'link_invalido';
  end if;

  select count(*) into v_count
  from public.ad_campaigns
  where user_id = v_uid
    and review_status in ('pending', 'approved')
    and (ends_at is null or ends_at > now());

  if v_count >= coalesce(cfg.ads_max_per_user, 3) then
    raise exception 'anuncios_limite';
  end if;

  v_amount := round(v_duration * coalesce(cfg.ads_price_per_second, 100), 2);

  insert into public.ad_campaigns (
    user_id, title, advertiser_name, target_url, video_path, video_mime,
    video_size, duration_seconds, amount
  ) values (
    v_uid, v_title, v_advertiser, v_url, v_path, v_mime,
    p_video_size, v_duration, v_amount
  ) returning id into v_id;

  return jsonb_build_object(
    'id', v_id,
    'amount', v_amount,
    'duration_seconds', v_duration,
    'review_status', 'pending',
    'payment_status', 'pending'
  );
end
$function$;

grant execute on function public.submit_ad_campaign(text, text, numeric, text, text, text, bigint) to authenticated;

-- 4) Revisión y pago (solo administrador) -------------------------------------------------
create or replace function public.admin_review_ad_campaign(
  p_id uuid,
  p_status text,
  p_note text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_days int;
  v_row public.ad_campaigns%rowtype;
begin
  if not public.is_admin() then
    raise exception 'no_es_admin';
  end if;

  if p_status not in ('pending', 'approved', 'rejected') then
    raise exception 'estado_invalido';
  end if;

  select * into v_row from public.ad_campaigns where id = p_id for update;
  if v_row.id is null then
    raise exception 'no_encontrado';
  end if;

  select coalesce(ads_days, 30) into v_days from public.app_settings where id = 1;
  if v_days is null or v_days < 1 then
    v_days := 30;
  end if;

  update public.ad_campaigns set
    review_status = p_status,
    review_note = case when p_status = 'rejected' then nullif(btrim(coalesce(p_note, '')), '') else null end,
    approved_at = case when p_status = 'approved' then now() else null end,
    approved_by = case when p_status = 'approved' then auth.uid() else null end,
    starts_at = case
      when p_status = 'approved' and payment_status = 'paid' then coalesce(starts_at, now())
      else starts_at
    end,
    ends_at = case
      when p_status = 'approved' and payment_status = 'paid' then now() + make_interval(days => v_days)
      else ends_at
    end,
    updated_at = now()
  where id = p_id;
end
$function$;

grant execute on function public.admin_review_ad_campaign(uuid, text, text) to authenticated;

create or replace function public.admin_set_ad_payment(p_id uuid, p_paid boolean)
returns void
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_days int;
  v_row public.ad_campaigns%rowtype;
begin
  if not public.is_admin() then
    raise exception 'no_es_admin';
  end if;

  select * into v_row from public.ad_campaigns where id = p_id for update;
  if v_row.id is null then
    raise exception 'no_encontrado';
  end if;

  select coalesce(ads_days, 30) into v_days from public.app_settings where id = 1;
  if v_days is null or v_days < 1 then
    v_days := 30;
  end if;

  if p_paid then
    update public.ad_campaigns set
      payment_status = 'paid',
      paid_at = coalesce(paid_at, now()),
      starts_at = case when review_status = 'approved' then coalesce(starts_at, now()) else starts_at end,
      ends_at = case when review_status = 'approved' then now() + make_interval(days => v_days) else ends_at end,
      updated_at = now()
    where id = p_id;
  else
    update public.ad_campaigns set
      payment_status = 'pending',
      paid_at = null,
      starts_at = null,
      ends_at = null,
      updated_at = now()
    where id = p_id;
  end if;
end
$function$;

grant execute on function public.admin_set_ad_payment(uuid, boolean) to authenticated;

-- 5) Edición y borrado desde el panel ------------------------------------------------------
create or replace function public.admin_update_ad_campaign(p_id uuid, p jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_title text;
  v_url text;
begin
  if not public.is_admin() then
    raise exception 'no_es_admin';
  end if;

  if p ? 'title' then
    v_title := btrim(coalesce(p->>'title', ''));
    if length(v_title) < 3 or length(v_title) > 120 then
      raise exception 'titulo_invalido';
    end if;
  end if;

  if p ? 'target_url' then
    v_url := nullif(btrim(coalesce(p->>'target_url', '')), '');
    if v_url is not null and (v_url !~* '^https?://[^[:space:]]+$' or length(v_url) > 500) then
      raise exception 'link_invalido';
    end if;
  end if;

  if p ? 'active' and jsonb_typeof(p->'active') <> 'boolean' then
    raise exception 'estado_invalido';
  end if;

  if p ? 'ends_at' and jsonb_typeof(p->'ends_at') <> 'null' and (p->>'ends_at') !~ '^\d{4}-\d{2}-\d{2}' then
    raise exception 'fecha_invalida';
  end if;

  update public.ad_campaigns set
    title = case when p ? 'title' then v_title else title end,
    advertiser_name = case when p ? 'advertiser_name' then nullif(btrim(coalesce(p->>'advertiser_name', '')), '') else advertiser_name end,
    target_url = case when p ? 'target_url' then v_url else target_url end,
    review_note = case when p ? 'review_note' then nullif(btrim(coalesce(p->>'review_note', '')), '') else review_note end,
    active = case when p ? 'active' then (p->>'active')::boolean else active end,
    ends_at = case when p ? 'ends_at' then (p->>'ends_at')::timestamptz else ends_at end,
    updated_at = now()
  where id = p_id;

  if not found then
    raise exception 'no_encontrado';
  end if;
end
$function$;

grant execute on function public.admin_update_ad_campaign(uuid, jsonb) to authenticated;

create or replace function public.admin_delete_ad_campaign(p_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_path text;
begin
  if not public.is_admin() then
    raise exception 'no_es_admin';
  end if;

  select video_path into v_path from public.ad_campaigns where id = p_id;
  if v_path is null then
    raise exception 'no_encontrado';
  end if;

  delete from public.ad_campaigns where id = p_id;
  return v_path;
end
$function$;

grant execute on function public.admin_delete_ad_campaign(uuid) to authenticated;

-- 6) Elegir un anuncio al azar -------------------------------------------------------------
-- Devuelve solo los datos públicos del anuncio. La tabla no se expone a quien
-- no es dueño ni administrador.
create or replace function public.pick_random_ad()
returns jsonb
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_ad jsonb;
begin
  select to_jsonb(t) into v_ad
  from (
    select id, title, advertiser_name, video_path, duration_seconds, target_url, ends_at
    from public.ad_campaigns
    where review_status = 'approved'
      and payment_status = 'paid'
      and active
      and coalesce(starts_at, created_at) <= now()
      and (ends_at is null or ends_at > now())
    order by random()
    limit 1
  ) t;

  return v_ad;
end
$function$;

grant execute on function public.pick_random_ad() to authenticated;

-- 7) Bucket público para los videos --------------------------------------------------------
-- Público porque el anuncio lo tiene que poder reproducir cualquiera. Cada
-- persona sube y borra solo dentro de su carpeta (<user_id>/...).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('ad-videos', 'ad-videos', true, 52428800,
        array['video/mp4', 'video/webm', 'video/quicktime'])
on conflict (id) do update
  set public = true,
      file_size_limit = 52428800,
      allowed_mime_types = array['video/mp4', 'video/webm', 'video/quicktime'];

drop policy if exists ad_videos_read on storage.objects;
create policy ad_videos_read on storage.objects for select to anon, authenticated
  using (bucket_id = 'ad-videos');

drop policy if exists ad_videos_insert on storage.objects;
create policy ad_videos_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'ad-videos' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists ad_videos_update on storage.objects;
create policy ad_videos_update on storage.objects for update to authenticated
  using (bucket_id = 'ad-videos' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists ad_videos_delete on storage.objects;
create policy ad_videos_delete on storage.objects for delete to authenticated
  using (bucket_id = 'ad-videos' and (storage.foldername(name))[1] = auth.uid()::text);

commit;
