-- 041: el anunciante puede ocultar o eliminar sus campañas.
--
-- Qué agrega:
--   1. paused_by_user: pausa reversible. El anuncio deja de mostrarse, pero la
--      persona lo sigue viendo en "Tus campañas" y puede volver a mostrarlo.
--   2. hidden_by_user: baja de la lista (eliminación lógica). El anuncio deja de
--      mostrarse y desaparece de la vista del anunciante, pero la fila y el
--      registro del pago se conservan para la contabilidad y las métricas.
--   3. set_my_ad_paused(...) y hide_my_ad(...): solo el dueño puede cambiar sus
--      campañas; no se toca `active`, que es la pausa del administrador.
--   4. pick_random_ad() y register_ad_event() ignoran las campañas pausadas por
--      el usuario o dadas de baja.
--
-- Las campañas sin pago se siguen borrando de verdad desde la app (la política
-- ad_campaigns_delete ya lo permite). Las pagas se dan de baja con hide_my_ad().

begin;

alter table public.ad_campaigns
  add column if not exists paused_by_user boolean not null default false,
  add column if not exists hidden_by_user boolean not null default false;

create index if not exists ad_campaigns_user_visible_idx
  on public.ad_campaigns (user_id, created_at desc)
  where not hidden_by_user;

-- 1) Pausar o volver a mostrar una campaña ------------------------------------------------
create or replace function public.set_my_ad_paused(p_id uuid, p_paused boolean)
returns void
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'no_autenticado';
  end if;

  update public.ad_campaigns
     set paused_by_user = coalesce(p_paused, false)
   where id = p_id
     and user_id = v_uid
     and not hidden_by_user;

  if not found then
    raise exception 'no_encontrado';
  end if;
end
$function$;

revoke all on function public.set_my_ad_paused(uuid, boolean) from public;
grant execute on function public.set_my_ad_paused(uuid, boolean) to authenticated;

-- 2) Dar de baja una campaña (eliminación lógica) -----------------------------------------
-- Conserva la fila por el pago y las métricas. Termina la campaña para liberar
-- el cupo de anuncios activos de esa persona.
create or replace function public.hide_my_ad(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'no_autenticado';
  end if;

  update public.ad_campaigns
     set hidden_by_user = true,
         paused_by_user = true,
         ends_at = case
           when ends_at is null or ends_at > now() then now()
           else ends_at
         end
   where id = p_id
     and user_id = v_uid
     and not hidden_by_user;

  if not found then
    raise exception 'no_encontrado';
  end if;
end
$function$;

revoke all on function public.hide_my_ad(uuid) from public;
grant execute on function public.hide_my_ad(uuid) to authenticated;

-- 3) El anuncio al azar ignora pausas y bajas del anunciante ------------------------------
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
      and not paused_by_user
      and not hidden_by_user
      and coalesce(starts_at, created_at) <= now()
      and (ends_at is null or ends_at > now())
    order by random()
    limit 1
  ) t;

  return v_ad;
end
$function$;

grant execute on function public.pick_random_ad() to authenticated;

-- 4) Las métricas tampoco suman en campañas ocultas ---------------------------------------
create or replace function public.register_ad_event(p_ad uuid, p_kind text)
returns void
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_uid uuid := auth.uid();
begin
  if p_kind not in ('shown', 'clicked') then
    raise exception 'evento_invalido';
  end if;

  if not exists (
    select 1 from public.ad_campaigns c
    where c.id = p_ad
      and c.review_status = 'approved'
      and c.payment_status = 'paid'
      and c.active
      and not c.paused_by_user
      and not c.hidden_by_user
      and (c.ends_at is null or c.ends_at > now())
      and c.user_id is distinct from v_uid
  ) then
    return;
  end if;

  if exists (
    select 1 from public.ad_events e
    where e.ad_id = p_ad
      and e.kind = p_kind
      and e.user_id is not distinct from v_uid
      and e.created_at > now() - interval '10 minutes'
  ) then
    return;
  end if;

  insert into public.ad_events (ad_id, user_id, kind) values (p_ad, v_uid, p_kind);
end
$function$;

grant execute on function public.register_ad_event(uuid, text) to authenticated;

commit;
