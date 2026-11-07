-- 021: RPC para eliminar un usuario y todos sus datos (solo admin)
-- Ejecutar en Supabase SQL Editor

create or replace function public.admin_delete_user(p_user uuid)
returns void
language plpgsql security definer set search_path = public as $$
begin
  -- Solo admins pueden llamar
  if not public.is_admin() then
    raise exception 'no_permitido';
  end if;

  -- No permitir auto-eliminación
  if p_user = auth.uid() then
    raise exception 'no_podes_eliminarte';
  end if;

  -- Verificar que el usuario existe
  if not exists (select 1 from public.profiles where id = p_user) then
    raise exception 'no_encontrado';
  end if;

  -- Eliminar en orden para respetar FKs
  -- 1. Reseñas donde es reviewer o reviewee
  delete from public.reviews where reviewer_id = p_user or reviewee_id = p_user;

  -- 2. Postulaciones del usuario
  delete from public.applications where worker_id = p_user;

  -- 3. Postulaciones a sus avisos (jobs y services)
  delete from public.applications
  where job_id in (select id from public.jobs where company_id = p_user)
     or service_id in (select id from public.services where owner_id = p_user);

  -- 4. Compras de CV
  delete from public.cv_purchases where user_id = p_user;

  -- 5. CV
  delete from public.resumes where user_id = p_user;

  -- 6. Servicios
  delete from public.services where owner_id = p_user;

  -- 7. Empleos
  delete from public.jobs where company_id = p_user;

  -- 8. Avatar en storage (si existe)
  -- Nota: esto requiere service_role, no se puede desde SQL normal
  -- Se limpia desde la app si hace falta

  -- 9. Perfil
  delete from public.profiles where id = p_user;

  -- 10. Usuario en auth (requiere service_role, no se puede desde SQL normal)
  -- Nota: el usuario en auth.users NO se borra aquí.
  -- Para borrarlo completamente, usar el dashboard de Supabase o una Edge Function con service_role.
  -- El perfil queda huérfano pero inaccesible (no hay perfil -> no puede loguearse efectivamente).

end $$;

revoke all on function public.admin_delete_user(uuid) from public;
grant execute on function public.admin_delete_user(uuid) to authenticated;