-- 037: que cada persona pueda eliminar su propia cuenta y sus datos personales.
--
-- Mismo criterio que admin_delete_user (027), pero para el usuario actual:
--   - Reseñas, postulaciones, CV, avisos, servicios y empleos propios se borran.
--   - Los reportes se conservan sin usuario (historial).
--   - El historial de compras de CV (cv_purchases) SE CONSERVA como registro contable:
--     la columna user_id pasa a ser opcional y, al borrar la cuenta, queda en null.
--     Así el pago sigue existiendo sin estar asociado a la persona.
--   - La cuenta de auth se borra al final, dentro de la misma transacción: si algo falla,
--     no queda nada a medio borrar.
--   - Los archivos (avatar, foto de CV, videos de anuncios) los borra el cliente, porque
--     el storage no se toca desde SQL. El cliente los lista ANTES de llamar a esta función.
--
-- Bloqueo: si hay anuncios pagos y todavía vigentes, no se puede eliminar la cuenta.

begin;

-- 0) Historial de compras de CV: sobrevive a la eliminación de la cuenta -------------------
alter table public.cv_purchases alter column user_id drop not null;
alter table public.cv_purchases drop constraint if exists cv_purchases_user_id_fkey;
alter table public.cv_purchases
  add constraint cv_purchases_user_id_fkey
  foreign key (user_id) references auth.users(id) on delete set null;

-- 1) Función de borrado ----------------------------------------------------------------------
create or replace function public.delete_my_account()
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

  if exists (
    select 1 from public.ad_campaigns c
    where c.user_id = v_uid
      and c.payment_status = 'paid'
      and c.active
      and (c.ends_at is null or c.ends_at > now())
  ) then
    raise exception 'anuncios_activos';
  end if;

  -- 1. Reseñas escritas o recibidas
  delete from public.reviews where author_id = v_uid or target_id = v_uid;

  -- 2. Postulaciones hechas, recibidas o asociadas a empleos propios
  delete from public.applications
  where worker_id = v_uid
     or company_id = v_uid
     or job_id in (select id from public.jobs where company_id = v_uid);

  -- 3. CV (las compras de CV se conservan; ver paso 0)
  delete from public.resumes where user_id = v_uid;

  -- 4. Anuncios en video (los eventos se borran en cascada), servicios y empleos
  delete from public.ad_campaigns where user_id = v_uid;
  delete from public.services where owner_id = v_uid;
  delete from public.jobs where company_id = v_uid;

  -- 5. Reportes y compras de CV: se conservan sin usuario
  update public.reports set user_id = null where user_id = v_uid;
  update public.cv_purchases set user_id = null where user_id = v_uid;

  -- 6. Perfil
  delete from public.profiles where id = v_uid;

  -- 7. Cuenta de auth (libera el email). Sin captura: si falla, se revierte todo.
  delete from auth.users where id = v_uid;
end
$function$;

revoke all on function public.delete_my_account() from public;
grant execute on function public.delete_my_account() to authenticated;

commit;
