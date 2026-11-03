-- 011: sueldo / forma de pago / condiciones del aviso y estado de verificación.
-- El aviso laboral ya guardaba `salary` (texto, ej: "$650.000" o "A convenir");
-- le agregamos la forma de cobro estructurada, horario y duración.
-- El servicio obtiene `price` (precio orientativo o presupuesto).

begin;

alter table public.jobs
  add column if not exists pay_type text,
  add column if not exists schedule text,
  add column if not exists duration text;

alter table public.services
  add column if not exists price text;

comment on column public.jobs.pay_type is 'Por hora, Por día, Por semana, Por mes, Por trabajo o A convenir';
comment on column public.jobs.schedule is 'Horario del aviso, ej: lunes a viernes de 9 a 18';
comment on column public.jobs.duration is 'Duración, ej: permanente, 3 meses, por temporada';
comment on column public.services.price is 'Precio orientativo o presupuesto del servicio';

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'jobs_pay_type_check') then
    alter table public.jobs
      add constraint jobs_pay_type_check
      check (pay_type is null or pay_type in ('Por hora', 'Por día', 'Por semana', 'Por mes', 'Por trabajo', 'A convenir'));
  end if;
end
$$;

-- Reputación pública con el estado de verificación de la cuenta.
drop view if exists public.user_reputation;
create view public.user_reputation as
select p.id as user_id,
       p.is_verified,
       p.verification_requested,
       coalesce(round(avg(r.rating), 1), 0) as rating,
       count(r.id)::int as reviews,
       count(nullif(btrim(r.comment), ''))::int as comments,
       coalesce(round(avg(coalesce((r.compliance + r.responsibility + r.communication) / 3.0, r.rating)) / 5.0 * 100), 0)::int as score,
       coalesce(round(avg(r.compliance) / 5.0 * 100), 0)::int as compliance,
       coalesce(round(avg(r.responsibility) / 5.0 * 100), 0)::int as responsibility,
       coalesce(round(avg(r.communication) / 5.0 * 100), 0)::int as communication
  from public.profiles p
  left join public.reviews r on r.target_id = p.id
 group by p.id, p.is_verified, p.verification_requested;

revoke all on public.user_reputation from anon, authenticated;
grant select on public.user_reputation to anon, authenticated;

commit;
