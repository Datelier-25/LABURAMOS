-- 008: sugerencias y denuncias. Llegan al correo definido por el admin (app_settings.contact_email).

begin;

alter table public.app_settings add column if not exists contact_email text not null default 'laburamosapp@gmail.com';

create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  type text not null check (type in ('sugerencia', 'denuncia')),
  job_id uuid references public.jobs(id) on delete set null,
  message text not null,
  status text not null default 'nueva' check (status in ('nueva', 'enviada', 'cerrada')),
  created_at timestamptz not null default now()
);
create index if not exists reports_created_idx on public.reports (created_at desc);

alter table public.reports enable row level security;
drop policy if exists reports_insert on public.reports;
create policy reports_insert on public.reports for insert to authenticated with check (user_id = auth.uid());
drop policy if exists reports_select_admin on public.reports;
create policy reports_select_admin on public.reports for select to authenticated using (public.is_admin());
drop policy if exists reports_update_admin on public.reports;
create policy reports_update_admin on public.reports for update to authenticated using (public.is_admin());

grant select, insert, update on public.reports to authenticated;

-- La sección es pública: cualquiera puede dejar una sugerencia o denuncia sin
-- crear cuenta (user_id queda en null). El admin las lee desde el panel.
create or replace function public.create_report(p_type text, p_job_id uuid, p_message text)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_id uuid;
  v_msg text;
begin
  if p_type is null or p_type not in ('sugerencia', 'denuncia') then
    raise exception 'tipo_invalido';
  end if;

  v_msg := btrim(coalesce(p_message, ''));
  if v_msg = '' then
    raise exception 'mensaje_vacio';
  end if;
  if length(v_msg) > 2000 then
    raise exception 'mensaje_largo';
  end if;

  insert into public.reports (user_id, type, job_id, message)
  values (auth.uid(), p_type, p_job_id, v_msg)
  returning id into v_id;

  return v_id;
end $$;

revoke all on function public.create_report(text, uuid, text) from public;
grant execute on function public.create_report(text, uuid, text) to authenticated, anon;

commit;
