-- 036: métricas de anuncios (vistas y clics) para el dueño de la campaña y el admin.
--
-- Cada vez que se muestra un anuncio se registra un evento 'shown'; si la persona
-- toca "Conocer más", un evento 'clicked'. La tabla no tiene políticas: nadie la lee
-- ni la escribe directo. Se usa solo por funciones:
--   - register_ad_event(ad, kind): registra un evento de un anuncio aprobado y pago.
--   - my_ad_stats(): totales por campaña, solo para el dueño (o el admin).
-- Anti-abuso: el mismo usuario no suma dos eventos iguales al mismo anuncio en 10 minutos,
-- y el dueño no suma sus propias vistas.

begin;

create table if not exists public.ad_events (
  id         uuid primary key default gen_random_uuid(),
  ad_id      uuid not null references public.ad_campaigns(id) on delete cascade,
  user_id    uuid references auth.users(id) on delete set null default auth.uid(),
  kind       text not null check (kind in ('shown', 'clicked')),
  created_at timestamptz not null default now()
);

create index if not exists ad_events_ad_kind_idx on public.ad_events (ad_id, kind);
create index if not exists ad_events_user_idx on public.ad_events (ad_id, user_id, kind, created_at);

alter table public.ad_events enable row level security;
revoke all on public.ad_events from anon, authenticated;

-- 1) Registrar un evento ---------------------------------------------------------------
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

  -- Solo anuncios aprobados, pagos y vigentes; si no, no pasa nada (silencioso).
  if not exists (
    select 1 from public.ad_campaigns c
    where c.id = p_ad
      and c.review_status = 'approved'
      and c.payment_status = 'paid'
      and c.active
      and (c.ends_at is null or c.ends_at > now())
      and c.user_id is distinct from v_uid
  ) then
    return;
  end if;

  -- Sin duplicados del mismo usuario en 10 minutos.
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

-- 2) Estadísticas por campaña ----------------------------------------------------------
create or replace function public.my_ad_stats()
returns table (ad_id uuid, shown bigint, clicked bigint, last_shown timestamptz)
language sql
stable
security definer
set search_path = public
as $function$
  select c.id,
         count(e.id) filter (where e.kind = 'shown'),
         count(e.id) filter (where e.kind = 'clicked'),
         max(e.created_at) filter (where e.kind = 'shown')
  from public.ad_campaigns c
  left join public.ad_events e on e.ad_id = c.id
  where c.user_id = auth.uid() or public.is_admin()
  group by c.id;
$function$;

grant execute on function public.my_ad_stats() to authenticated;

commit;
