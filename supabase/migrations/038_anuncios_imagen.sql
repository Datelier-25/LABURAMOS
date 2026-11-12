-- 038: anuncios de imagen (además de los de video).
--
-- Una campaña puede ser de video (media_type = 'video') o de imagen (media_type = 'image').
--   - Video: precio por segundo, duración entre ads_min_seconds y ads_max_seconds.
--   - Imagen: precio fijo por campaña (ads_price_image) y se muestra ads_image_seconds
--     segundos antes de habilitar "Continuar".
-- Las reglas de revisión, pago, vencimiento, límite por usuario y eventos de métricas
-- son las mismas para los dos tipos.
--
-- Las imágenes van en el bucket público ad-images (jpg, png o webp, hasta 5 MB).

begin;

-- 1) Configuración de precios y tiempos para imágenes -------------------------------------
alter table public.app_settings
  add column if not exists ads_price_image numeric(12,2) not null default 5000,
  add column if not exists ads_image_seconds smallint not null default 8;

alter table public.app_settings drop constraint if exists app_settings_ads_image_check;
alter table public.app_settings add constraint app_settings_ads_image_check check (
  ads_price_image > 0
  and ads_price_image <= 10000000
  and ads_image_seconds between 3 and 30
);

-- 2) Campañas: tipo de medio y ruta de la imagen -----------------------------------------
alter table public.ad_campaigns
  add column if not exists media_type text not null default 'video',
  add column if not exists image_path text;

alter table public.ad_campaigns drop constraint if exists ad_campaigns_media_check;
alter table public.ad_campaigns add constraint ad_campaigns_media_check check (media_type in ('video', 'image'));

alter table public.ad_campaigns alter column video_path drop not null;

alter table public.ad_campaigns drop constraint if exists ad_campaigns_media_path_check;
alter table public.ad_campaigns add constraint ad_campaigns_media_path_check check (
  (media_type = 'video' and video_path is not null)
  or (media_type = 'image' and image_path is not null)
);

-- 3) Bucket de imágenes --------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('ad-images', 'ad-images', true, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set public = true,
      file_size_limit = 5242880,
      allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp'];

drop policy if exists ad_images_read on storage.objects;
create policy ad_images_read on storage.objects for select to anon, authenticated
  using (bucket_id = 'ad-images');

drop policy if exists ad_images_insert on storage.objects;
create policy ad_images_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'ad-images' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists ad_images_update on storage.objects;
create policy ad_images_update on storage.objects for update to authenticated
  using (bucket_id = 'ad-images' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists ad_images_delete on storage.objects;
create policy ad_images_delete on storage.objects for delete to authenticated
  using (
    bucket_id = 'ad-images'
    and (public.is_admin() or (storage.foldername(name))[1] = auth.uid()::text)
  );

-- 4) Enviar una campaña de imagen ------------------------------------------------------------
create or replace function public.submit_ad_image_campaign(
  p_title text,
  p_image_path text,
  p_advertiser_name text default null,
  p_target_url text default null,
  p_image_mime text default null,
  p_image_size bigint default null
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
  v_path text := btrim(coalesce(p_image_path, ''));
  v_advertiser text := nullif(btrim(coalesce(p_advertiser_name, '')), '');
  v_url text := nullif(btrim(coalesce(p_target_url, '')), '');
  v_mime text := nullif(btrim(coalesce(p_image_mime, '')), '');
  v_seconds numeric;
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

  if v_path = '' or v_path !~ ('^' || v_uid::text || '/') then
    raise exception 'imagen_invalida';
  end if;

  if v_mime is not null and v_mime not in ('image/jpeg', 'image/png', 'image/webp') then
    raise exception 'formato_invalido';
  end if;

  if p_image_size is not null and (p_image_size <= 0 or p_image_size > 5242880) then
    raise exception 'imagen_grande';
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

  v_seconds := coalesce(cfg.ads_image_seconds, 8);
  v_amount := round(coalesce(cfg.ads_price_image, 5000), 2);

  insert into public.ad_campaigns (
    user_id, title, advertiser_name, target_url, media_type, image_path, video_mime,
    video_size, duration_seconds, amount
  ) values (
    v_uid, v_title, v_advertiser, v_url, 'image', v_path, v_mime,
    p_image_size, v_seconds, v_amount
  ) returning id into v_id;

  return jsonb_build_object(
    'id', v_id,
    'amount', v_amount,
    'duration_seconds', v_seconds,
    'review_status', 'pending',
    'payment_status', 'pending'
  );
end
$function$;

grant execute on function public.submit_ad_image_campaign(text, text, text, text, text, bigint) to authenticated;

-- 5) Borrado por el admin: devuelve las rutas de archivos de cada bucket -------------------
drop function if exists public.admin_delete_ad_campaign(uuid);

create or replace function public.admin_delete_ad_campaign(p_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_video text;
  v_image text;
begin
  if not public.is_admin() then
    raise exception 'no_es_admin';
  end if;

  select video_path, image_path into v_video, v_image from public.ad_campaigns where id = p_id;
  if not found then
    raise exception 'no_encontrado';
  end if;

  delete from public.ad_campaigns where id = p_id;
  return jsonb_build_object('video_path', v_video, 'image_path', v_image);
end
$function$;

grant execute on function public.admin_delete_ad_campaign(uuid) to authenticated;

-- 6) Anuncio al azar: ahora también devuelve el tipo y la imagen --------------------------
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
    select id, title, advertiser_name, media_type, video_path, image_path,
           duration_seconds, target_url, ends_at
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

commit;
