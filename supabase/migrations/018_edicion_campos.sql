-- Edición de publicaciones por su dueño o por un administrador.
-- Amplía los campos editables y permite borrar valores opcionales mandando null.
create or replace function public.admin_update_listing(p_kind text, p_id uuid, p jsonb)
returns void
language plpgsql
as $function$
begin
  if not public.is_admin() then
    if p_kind = 'job' then
      if (select company_id from public.jobs where id = p_id) is distinct from auth.uid() then
        raise exception 'no_es_dueno';
      end if;
    elsif p_kind = 'service' then
      if (select owner_id from public.services where id = p_id) is distinct from auth.uid() then
        raise exception 'no_es_dueno';
      end if;
    end if;
  end if;

  if p ? 'status' and p->>'status' not in ('active', 'paused', 'filled') then
    raise exception 'estado_invalido';
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
  elsif p_kind = 'service' then
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
      is_urgent       = case when p ? 'is_urgent' then (p->>'is_urgent')::boolean else is_urgent end,
      status          = case when p ? 'status' then p->>'status' else status end,
      expires_at      = case when p ? 'expires_at' then (p->>'expires_at')::timestamptz else expires_at end
    where id = p_id;
  else
    raise exception 'tipo_invalido';
  end if;

  if not found then
    raise exception 'no_encontrado';
  end if;
end
$function$;

grant execute on function public.admin_update_listing(text, uuid, jsonb) to authenticated;
