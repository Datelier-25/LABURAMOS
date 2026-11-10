-- 032: imagen de portada separada de las fotos de la publicación.
--
-- La portada es la imagen que se ve en la tarjeta (puede ser una foto propia,
-- un logo o un emote). Las fotos de la publicación son otra cosa: se muestran
-- dentro de "Ver más" y no se usan como portada si ya hay una elegida.

begin;

alter table public.services
  add column if not exists cover_photo text;

alter table public.services drop constraint if exists services_cover_photo_len;
alter table public.services add constraint services_cover_photo_len
  check (cover_photo is null or length(cover_photo) <= 500);

grant select (cover_photo) on public.services to anon, authenticated;
grant insert (cover_photo) on public.services to authenticated;

-- Edición: la portada también se puede cambiar desde el panel.
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

  if p ? 'requirement_items' and jsonb_typeof(p->'requirement_items') <> 'array' then
    raise exception 'requisitos_invalidos';
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
      requirement_items = case when p ? 'requirement_items' then coalesce(p->'requirement_items', '[]'::jsonb) else requirement_items end,
      apply_channel = case when p ? 'apply_channel' then nullif(p->>'apply_channel', '') else apply_channel end,
      apply_email   = case when p ? 'apply_email' then nullif(p->>'apply_email', '') else apply_email end,
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
      cover_photo     = case when p ? 'cover_photo' then nullif(p->>'cover_photo', '') else cover_photo end,
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

commit;
