-- 017: edicion por propiedad (solo dueño o admin pueden editar)
--
-- La funcion admin_update_listing ahora chequea:
--   - Si es admin (is_admin = true en profiles) -> permite editar todo
--   - Si no es admin -> verifica que company_id (jobs) u owner_id (services)
--     coincida con auth.uid() -> solo puede editar sus propias publicaciones
--
-- Si intenta editar sin permiso, lanza excepcion 'no_es_dueno'.

begin;

-- Actualizamos la funcion existente
create or replace function public.admin_update_listing(p_kind text, p_id uuid, p jsonb)
returns void language plpgsql as
$$
begin
  -- Permitir si es admin O si es el dueño de la publicacion
  if not public.is_admin() then
    if p_kind = 'job' then
      -- Para jobs: el company_id debe ser el usuario actual
      if (select company_id from public.jobs where id = p_id) is distinct from auth.uid() then
        raise exception 'no_es_dueno';
      end if;
    elsif p_kind = 'service' then
      -- Para services: el owner_id debe ser el usuario actual
      if (select owner_id from public.services where id = p_id) is distinct from auth.uid() then
        raise exception 'no_es_dueno';
      end if;
    end if;
  end if;

  if p ? 'status' and p->>'status' not in ('active', 'paused', 'filled') then raise exception 'estado_invalido'; end if;
  if p_kind = 'job' then
    update public.jobs set
      title        = coalesce(p->>'title', title),
      company_name = coalesce(p->>'company_name', company_name),
      category     = coalesce(p->>'category', category),
      job_type     = coalesce(p->>'job_type', job_type),
      salary       = coalesce(p->>'salary', salary),
      description  = coalesce(p->>'description', description),
      requirements = coalesce(p->>'requirements', requirements),
      phone        = coalesce(p->>'phone', phone),
      is_urgent    = coalesce((p->>'is_urgent')::boolean, is_urgent),
      status       = coalesce(p->>'status', status),
      expires_at   = coalesce((p->>'expires_at')::timestamptz, expires_at)
    where id = p_id;
  elsif p_kind = 'service' then
    if p ? 'status' and p->>'status' = 'filled' then raise exception 'estado_invalido'; end if;
    update public.services set
      title         = coalesce(p->>'title', title),
      provider_name = coalesce(p->>'provider_name', provider_name),
      category      = coalesce(p->>'category', category),
      description   = coalesce(p->>'description', description),
      phone         = coalesce(p->>'phone', phone),
      intent        = coalesce(p->>'intent', intent),
      is_urgent     = coalesce((p->>'is_urgent')::boolean, is_urgent),
      status        = coalesce(p->>'status', status),
      expires_at    = coalesce((p->>'expires_at')::timestamptz, expires_at)
    where id = p_id;
  else
    raise exception 'tipo_invalido';
  end if;
  if not found then raise exception 'no_encontrado'; end if;
end
$$;

commit;