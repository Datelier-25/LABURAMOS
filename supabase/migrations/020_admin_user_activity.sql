-- 020: RPC para ver actividad detallada de un usuario (solo admin)
-- Ejecutar en Supabase SQL Editor

create or replace function public.admin_user_activity(p_user uuid)
returns jsonb
language plpgsql security definer set search_path = public as $$
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
  -- Solo admins pueden llamar
  if not public.is_admin() then
    raise exception 'no_permitido';
  end if;

  -- Perfil básico
  select to_jsonb(t) into v_profile
  from (
    select p.id, p.full_name, p.email, p.role, p.city, p.province,
           p.is_admin, p.is_blocked, p.is_verified, p.verification_requested,
           p.created_at, p.avatar_url,
           u.email as auth_email, u.last_sign_in_at
    from public.profiles p
    join auth.users u on u.id = p.id
    where p.id = p_user
  ) t;

  if v_profile is null then
    raise exception 'no_encontrado';
  end if;

  -- Publicaciones de empleo (jobs)
  select jsonb_agg(to_jsonb(j) order by j.created_at desc) into v_jobs
  from (
    select j.id, j.title, j.category, j.job_type, j.location,
           j.status, j.created_at, j.expires_at,
           (select count(*) from public.applications a where a.job_id = j.id) as applications_count
    from public.jobs j
    where j.company_id = p_user
  ) j;

  -- Publicaciones de servicios
  select jsonb_agg(to_jsonb(s) order by s.created_at desc) into v_services
  from (
    select s.id, s.title, s.category, s.mode, s.location,
           s.status, s.created_at, s.expires_at,
           (select count(*) from public.applications a where a.service_id = s.id) as applications_count
    from public.services s
    where s.owner_id = p_user
  ) s;

  -- Postulaciones (si es trabajador)
  select jsonb_agg(to_jsonb(a) order by a.created_at desc) into v_applications
  from (
    select a.id, a.status, a.created_at, a.message,
           j.title as job_title, j.company_id,
           s.title as service_title, s.owner_id
    from public.applications a
    left join public.jobs j on j.id = a.job_id
    left join public.services s on s.id = a.service_id
    where a.worker_id = p_user
  ) a;

  -- Reseñas dadas
  select jsonb_agg(to_jsonb(r) order by r.created_at desc) into v_reviews_given
  from (
    select r.id, r.rating, r.comment, r.created_at,
           r.reviewee_id,
           p.full_name as reviewee_name,
           j.title as job_title,
           s.title as service_title
    from public.reviews r
    left join public.profiles p on p.id = r.reviewee_id
    left join public.jobs j on j.id = r.job_id
    left join public.services s on s.id = r.service_id
    where r.reviewer_id = p_user
  ) r;

  -- Reseñas recibidas
  select jsonb_agg(to_jsonb(r) order by r.created_at desc) into v_reviews_received
  from (
    select r.id, r.rating, r.comment, r.created_at,
           r.reviewer_id,
           p.full_name as reviewer_name,
           j.title as job_title,
           s.title as service_title
    from public.reviews r
    left join public.profiles p on p.id = r.reviewer_id
    left join public.jobs j on j.id = r.job_id
    left join public.services s on s.id = r.service_id
    where r.reviewee_id = p_user
  ) r;

  -- CV (si tiene)
  select to_jsonb(cv) into v_cv
  from (
    select r.id, r.user_id, r.headline, r.summary, r.skills,
           r.experience, r.education, r.availability, r.salary_expectation,
           r.updated_at, r.pdf_url, r.is_public
    from public.resumes r
    where r.user_id = p_user
  ) cv;

  -- Compras de CV
  select jsonb_agg(to_jsonb(p) order by p.created_at desc) into v_purchases
  from (
    select id, amount, mode, days, status, mp_preference_id, created_at
    from public.cv_purchases
    where user_id = p_user
  ) p;

  return jsonb_build_object(
    'profile', v_profile,
    'jobs', coalesce(v_jobs, '[]'::jsonb),
    'services', coalesce(v_services, '[]'::jsonb),
    'applications', coalesce(v_applications, '[]'::jsonb),
    'reviews_given', coalesce(v_reviews_given, '[]'::jsonb),
    'reviews_received', coalesce(v_reviews_received, '[]'::jsonb),
    'cv', v_cv,
    'purchases', coalesce(v_purchases, '[]'::jsonb)
  );
end $$;

revoke all on function public.admin_user_activity(uuid) from public;
grant execute on function public.admin_user_activity(uuid) to authenticated;