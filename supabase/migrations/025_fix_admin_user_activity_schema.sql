-- 025: reescribir admin_user_activity según el esquema real de la base
-- La versión anterior usaba columnas inexistentes (reviews.reviewer_id,
-- applications.status/message/service_id, resumes.headline, services.mode, etc.)
-- y agregados con ORDER BY que fallaban en PostgreSQL.
--
-- Ejecutar en Supabase SQL Editor (o aplicar con la CLI).

create or replace function public.admin_user_activity(p_user uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile jsonb;
  v_jobs jsonb;
  v_services jsonb;
  v_applications jsonb;
  v_reviews_given jsonb;
  v_reviews_received jsonb;
  v_cv jsonb;
  v_purchases jsonb;
begin
  if not public.is_admin() then
    raise exception 'no_permitido';
  end if;

  -- Perfil + email (el email vive en auth.users)
  select to_jsonb(t) into v_profile
  from (
    select p.id, p.full_name, u.email::text as email, p.role, p.city, p.province,
           p.is_admin, p.is_blocked, p.is_verified, p.verification_requested,
           p.created_at, p.avatar_url, u.last_sign_in_at
    from public.profiles p
    join auth.users u on u.id = p.id
    where p.id = p_user
  ) t;

  if v_profile is null then
    raise exception 'no_encontrado';
  end if;

  -- Avisos de empleo publicados por el usuario
  select jsonb_agg(to_jsonb(j)) into v_jobs
  from (
    select j.id, j.title, j.category, j.job_type, j.location, j.status,
           j.created_at, j.expires_at,
           (select count(*) from public.applications a where a.job_id = j.id)::int as applications_count
    from public.jobs j
    where j.company_id = p_user
    order by j.created_at desc
  ) j;

  -- Servicios publicados por el usuario
  select jsonb_agg(to_jsonb(s)) into v_services
  from (
    select s.id, s.title, s.category, s.intent as mode,
           nullif(concat_ws(' · ', s.city, s.province), '') as location,
           s.status, s.created_at, s.expires_at,
           0::int as applications_count
    from public.services s
    where s.owner_id = p_user
    order by s.created_at desc
  ) s;

  -- Postulaciones hechas por el usuario (la tabla no guarda estado ni mensaje)
  select jsonb_agg(to_jsonb(a)) into v_applications
  from (
    select a.id, null::text as status, a.created_at,
           null::text as message,
           j.title as job_title, j.company_name,
           null::text as service_title, null::uuid as owner_id
    from public.applications a
    left join public.jobs j on j.id = a.job_id
    where a.worker_id = p_user
    order by a.created_at desc
  ) a;

  -- Reseñas escritas por el usuario
  select jsonb_agg(to_jsonb(r)) into v_reviews_given
  from (
    select r.id, r.rating, r.comment, r.created_at,
           r.target_id as reviewee_id,
           p.full_name as reviewee_name,
           j.title as job_title,
           null::text as service_title
    from public.reviews r
    left join public.profiles p on p.id = r.target_id
    left join public.applications a on a.id = r.application_id
    left join public.jobs j on j.id = a.job_id
    where r.author_id = p_user
    order by r.created_at desc
  ) r;

  -- Reseñas recibidas por el usuario
  select jsonb_agg(to_jsonb(r)) into v_reviews_received
  from (
    select r.id, r.rating, r.comment, r.created_at,
           r.author_id as reviewer_id,
           p.full_name as reviewer_name,
           j.title as job_title,
           null::text as service_title
    from public.reviews r
    left join public.profiles p on p.id = r.author_id
    left join public.applications a on a.id = r.application_id
    left join public.jobs j on j.id = a.job_id
    where r.target_id = p_user
    order by r.created_at desc
  ) r;

  -- CV del usuario (nombres adaptados a lo que muestra el modal)
  select to_jsonb(cv) into v_cv
  from (
    select r.id, r.user_id,
           r.profession as headline,
           r.summary, r.skills_list as skills, r.experience, r.education,
           r.availability,
           null::text as salary_expectation,
           r.updated_at,
           r.is_visible as is_public
    from public.resumes r
    where r.user_id = p_user
    limit 1
  ) cv;

  -- Compras de CV
  select jsonb_agg(to_jsonb(p)) into v_purchases
  from (
    select p.id, p.amount, p.mode, p.days, p.status, p.created_at
    from public.cv_purchases p
    where p.user_id = p_user
    order by p.created_at desc
  ) p;

  return jsonb_build_object(
    'profile', v_profile,
    'jobs', coalesce(v_jobs, '[]'::jsonb),
    'services', coalesce(v_services, '[]'::jsonb),
    'applications', coalesce(v_applications, '[]'::jsonb),
    'reviews_given', coalesce(v_reviews_given, '[]'::jsonb),
    'reviews_received', coalesce(v_reviews_received, '[]'::jsonb),
    'cv', coalesce(v_cv, 'null'::jsonb),
    'purchases', coalesce(v_purchases, '[]'::jsonb)
  );
end $$;

revoke all on function public.admin_user_activity(uuid) from public;
grant execute on function public.admin_user_activity(uuid) to authenticated;
