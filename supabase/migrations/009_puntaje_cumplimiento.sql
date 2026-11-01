-- ============================================================================
-- Puntaje de cumplimiento (0 a 100)
-- Cada calificación puntúa tres aspectos del trabajo: cumplimiento,
-- responsabilidad y comunicación (1 a 5). El puntaje público es 0-100.
-- ============================================================================

begin;

alter table public.reviews
  add column if not exists compliance     smallint check (compliance between 1 and 5),
  add column if not exists responsibility smallint check (responsibility between 1 and 5),
  add column if not exists communication  smallint check (communication between 1 and 5);

comment on column public.reviews.compliance     is 'Cumplió lo acordado (1 a 5)';
comment on column public.reviews.responsibility is 'Responsabilidad y puntualidad (1 a 5)';
comment on column public.reviews.communication  is 'Comunicación y trato (1 a 5)';

-- El puntaje general (1-5) sale del promedio de los tres aspectos.
create or replace function public.reviews_fill() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if coalesce(auth.role(), '') in ('anon', 'authenticated') then new.author_id := auth.uid(); end if;

  if new.compliance is not null and new.responsibility is not null and new.communication is not null then
    new.rating := greatest(1, least(5, round((new.compliance + new.responsibility + new.communication)::numeric / 3)))::smallint;
  end if;

  select case when a.worker_id = new.author_id then a.company_id else a.worker_id end into new.target_id
    from public.applications a
    where a.id = new.application_id and new.author_id in (a.worker_id, a.company_id);
  if new.target_id is null then raise exception 'no_permitido'; end if;
  new.created_at := now();
  return new;
end $$;

-- Reputación pública: puntaje 0-100, cantidad de valoraciones, cuántas tienen
-- reseña escrita y el detalle de cada aspecto.
create or replace view public.user_reputation as
select p.id as user_id,
       p.is_verified,
       coalesce(round(avg(r.rating)::numeric, 1), 0) as rating,
       count(r.id)::int as reviews,
       count(nullif(btrim(r.comment), ''))::int as comments,
       coalesce(round(avg(coalesce((r.compliance + r.responsibility + r.communication) / 3.0, r.rating)) / 5.0 * 100), 0)::int as score,
       coalesce(round(avg(r.compliance) / 5.0 * 100), 0)::int as compliance,
       coalesce(round(avg(r.responsibility) / 5.0 * 100), 0)::int as responsibility,
       coalesce(round(avg(r.communication) / 5.0 * 100), 0)::int as communication
  from public.profiles p
  left join public.reviews r on r.target_id = p.id
 group by p.id, p.is_verified;

revoke all on public.user_reputation from anon, authenticated;
grant select on public.user_reputation to anon, authenticated;

-- Reseñas escritas, sin datos de quien las escribió.
create or replace view public.user_reviews as
  select r.id,
         r.target_id as user_id,
         r.rating,
         r.compliance,
         r.responsibility,
         r.communication,
         btrim(r.comment) as comment,
         r.created_at
    from public.reviews r
   where r.comment is not null and btrim(r.comment) <> '';

revoke all on public.user_reviews from anon, authenticated;
grant select on public.user_reviews to anon, authenticated;

commit;
