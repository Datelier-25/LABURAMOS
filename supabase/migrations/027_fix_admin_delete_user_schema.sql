-- 027: reescribir admin_delete_user según el esquema real de la base
-- La versión de 021 usaba columnas inexistentes (reviews.reviewer_id,
-- reviews.reviewee_id y applications.service_id), por eso fallaba al eliminar.
--
-- Esquema real:
--   reviews      -> application_id, author_id, target_id
--   applications -> job_id, worker_id, company_id
--
-- Además borra la cuenta de auth.users: las FK están en cascada, pero así
-- también se libera el email para que la persona pueda registrarse otra vez.
--
-- Ejecutar en Supabase SQL Editor (o aplicar con la CLI).

create or replace function public.admin_delete_user(p_user uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
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

  -- 1. Reseñas escritas o recibidas por el usuario
  delete from public.reviews
  where author_id = p_user or target_id = p_user;

  -- 2. Postulaciones hechas por el usuario, recibidas en sus avisos
  --    o asociadas a empleos que publicó
  delete from public.applications
  where worker_id = p_user
     or company_id = p_user
     or job_id in (select id from public.jobs where company_id = p_user);

  -- 3. Compras de CV y CV
  delete from public.cv_purchases where user_id = p_user;
  delete from public.resumes where user_id = p_user;

  -- 4. Servicios y empleos publicados
  delete from public.services where owner_id = p_user;
  delete from public.jobs where company_id = p_user;

  -- 5. Reportes: no tienen FK, se conservan como historial sin el usuario
  update public.reports set user_id = null where user_id = p_user;

  -- 6. Perfil
  delete from public.profiles where id = p_user;

  -- 7. Cuenta de auth (libera el email). Si el rol no tuviera permiso,
  --    los datos públicos ya quedaron borrados igual.
  begin
    delete from auth.users where id = p_user;
  exception when insufficient_privilege then
    null;
  end;
end $$;

revoke all on function public.admin_delete_user(uuid) from public;
grant execute on function public.admin_delete_user(uuid) to authenticated;
