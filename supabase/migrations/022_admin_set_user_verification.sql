-- 022: extender admin_set_user para aceptar/rechazar pedidos de verificación
-- Ejecutar en Supabase SQL Editor

create or replace function public.admin_set_user(
  p_user uuid,
  p_role text default null,
  p_is_admin boolean default null,
  p_is_blocked boolean default null,
  p_is_verified boolean default null,
  p_verification_requested boolean default null
) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then
    raise exception 'no_permitido';
  end if;
  if p_user = auth.uid() and coalesce(p_is_blocked, false) then
    raise exception 'no_podes_bloquearte';
  end if;
  if p_role is not null and p_role not in ('worker', 'company') then
    raise exception 'rol_invalido';
  end if;

  update public.profiles set
    role                 = coalesce(p_role, role),
    is_admin             = coalesce(p_is_admin, is_admin),
    is_blocked           = coalesce(p_is_blocked, is_blocked),
    is_verified          = coalesce(p_is_verified, is_verified),
    verification_requested = coalesce(p_verification_requested, verification_requested)
  where id = p_user;
  if not found then raise exception 'no_encontrado'; end if;

  -- Al bloquear, se limpia el pedido de verificación y se pausan publicaciones
  if coalesce(p_is_blocked, false) then
    update public.profiles set verification_requested = false where id = p_user;
    update public.jobs set status = 'paused' where company_id = p_user and status = 'active';
    update public.services set status = 'paused' where owner_id = p_user and status = 'active';
  end if;

end $$;

revoke all on function public.admin_set_user(uuid, text, boolean, boolean, boolean, boolean) from public;
grant execute on function public.admin_set_user(uuid, text, boolean, boolean, boolean, boolean) to authenticated;