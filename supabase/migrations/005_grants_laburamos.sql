-- 005: permisos de la Data API para las tablas que crea la migración 004.
--
-- Ejecutar DESPUÉS de 004. Sin estos GRANT, Supabase puede devolver
-- "permission denied for table app_settings / applications / cv_purchases"
-- aunque las políticas RLS estén bien.
--
-- Las políticas RLS siguen siendo las que deciden qué filas ve cada usuario.

begin;

grant usage on schema public to anon, authenticated;

-- La configuración la lee cualquiera (incluso sin sesión) para mostrar los
-- días de duración; solo el administrador puede modificarla (RLS en 004).
grant select on public.app_settings to anon, authenticated;
grant update (cv_paid_enabled, cv_price, cv_mode, cv_days, job_days, service_days, updated_at)
  on public.app_settings to authenticated;

-- El historial de compras lo lee su dueño o el administrador (RLS en 004).
-- No hay GRANT de escritura: solo lo escriben las Edge Functions con service_role.
grant select on public.cv_purchases to authenticated;

-- Postulaciones: el usuario inserta la suya, la empresa y el postulante leen,
-- y el postulante puede borrar la propia (RLS en 004).
grant select, insert, delete on public.applications to authenticated;

commit;
