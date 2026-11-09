-- 026: editar las fotos de un servicio desde la pantalla de edición.
--
-- admin_update_listing no contemplaba la columna photos, así que los cambios de
-- fotos no se podían guardar. La sumamos con el mismo control de propiedad que
-- el resto de los campos (dueño o administrador).
--
-- Además alineamos el límite de la tabla con la app: la pantalla de publicar y
-- la de editar permiten hasta 5 fotos.

alter table public.services drop constraint if exists services_photos_max;
alter table public.services add constraint services_photos_max
  check (coalesce(array_length(photos, 1), 0) <= 5);

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
