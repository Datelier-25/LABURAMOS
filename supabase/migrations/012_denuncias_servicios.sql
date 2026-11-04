-- 012: denuncias y compartidos también para servicios (avisos de oficios).

begin;

alter table public.reports
  add column if not exists service_id uuid references public.services(id) on delete set null;

create index if not exists reports_service_idx on public.reports (service_id);

-- Se redefine con el nuevo parámetro para guardar también el servicio denunciado.
drop function if exists public.create_report(text, uuid, text);

create or replace function public.create_report(p_type text, p_job_id uuid, p_service_id uuid, p_message text)
returns uuid
language plpgsql
security definer
set search_path = public as $$
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

  insert into public.reports (user_id, type, job_id, service_id, message)
  values (auth.uid(), p_type, p_job_id, p_service_id, v_msg)
  returning id into v_id;

  return v_id;
end $$;

revoke all on FUNCTION public.create_report(text, uuid, uuid, text) from public;
grant execute on FUNCTION public.create_report(text, uuid, uuid, text) to authenticated, anon;

commit;
