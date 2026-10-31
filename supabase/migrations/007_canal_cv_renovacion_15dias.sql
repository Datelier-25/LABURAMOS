-- 007: canal por el que la empresa recibe el CV de un postulante,
-- y renovación a los 15 días.

begin;

alter table public.applications add column if not exists email text;
alter table public.applications add column if not exists cv_contact
  text not null default 'whatsapp'
  check (cv_contact in ('whatsapp', 'email', 'both'));

-- La empresa decide cómo recibe el CV: por WhatsApp, por Gmail (email) o por ambas.
create or replace function public.set_cv_contact(p_application_id uuid, p_channel text)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then
    if not exists (
      select 1
      from public.applications a
      join public.jobs j on j.id = a.job_id
      where a.id = p_application_id
        and j.company_id = auth.uid()
    ) then
      raise exception 'no_permitido';
    end if;
  end if;
  if p_channel not in ('whatsapp', 'email', 'both') then
    raise exception 'canal_invalido';
  end if;
  update public.applications set cv_contact = p_channel where id = p_application_id;
  if not found then
    raise exception 'no_encontrado';
  end if;
end $$;
revoke all on function public.set_cv_contact(uuid, text) from public;
grant execute on function public.set_cv_contact(uuid, text) to authenticated;

-- Renovación: los avisos y servicios se renuevan cada 15 días.
update public.app_settings
set job_days = 15, service_days = 15
where id = 1;

commit;
