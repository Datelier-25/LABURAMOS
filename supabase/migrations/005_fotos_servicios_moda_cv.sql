-- 005: fotos en los servicios, más habilidades en el CV y corrección del trigger de publicación.
-- Aplicar después de 004. Probar primero en un proyecto de Supabase de desarrollo.

begin;

-- 1. Corrección del error 'record "new" has no field "intent"' -------------------------------
-- El trigger se usa en jobs y en services, pero leía new.intent en los dos casos.
-- En jobs esa columna no existe y Postgres fallaba al publicar un aviso.
create or replace function public.listing_defaults() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  d smallint;
begin
  -- El trigger es security definer: miramos quién hace el pedido real
  if coalesce(auth.role(), '') in ('anon', 'authenticated') then
    select case when tg_table_name = 'jobs' then job_days else service_days end into d
      from public.app_settings where id = 1;
    new.status := 'active';
    new.created_at := now();
    new.expires_at := now() + make_interval(days => coalesce(d, 30));

    -- Solo services tiene "intent": lo leemos como json para no tocar columnas que no existen
    if tg_table_name = 'services' then
      if coalesce(to_jsonb(new)->>'intent', 'ofrece') <> 'busca' then
        new.is_urgent := false;
      end if;
    end if;
  end if;
  return new;
end $$;

-- 2. Hasta 3 fotos por servicio ---------------------------------------------------------------
alter table public.services add column if not exists photos text[] not null default '{}';
alter table public.services drop constraint if exists services_photos_max;
alter table public.services add constraint services_photos_max
  check (coalesce(array_length(photos, 1), 0) <= 3);

-- Las columnas de la tabla se habilitan una por una: sumamos photos a las que ya se podían escribir
grant insert (photos) on public.services to authenticated;
grant update (photos) on public.services to authenticated;

-- 3. Bucket público para las fotos de los servicios -------------------------------------------
-- Público porque los avisos los ve cualquiera, incluso sin cuenta.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('service-photos', 'service-photos', true, 5242880,
        array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set public = true,
      file_size_limit = 5242880,
      allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp'];

-- Cada persona sube y borra solo dentro de su carpeta (<user_id>/...)
drop policy if exists service_photos_read on storage.objects;
create policy service_photos_read on storage.objects for select to anon, authenticated
  using (bucket_id = 'service-photos');

drop policy if exists service_photos_insert on storage.objects;
create policy service_photos_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'service-photos' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists service_photos_update on storage.objects;
create policy service_photos_update on storage.objects for update to authenticated
  using (bucket_id = 'service-photos' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists service_photos_delete on storage.objects;
create policy service_photos_delete on storage.objects for delete to authenticated
  using (bucket_id = 'service-photos' and (storage.foldername(name))[1] = auth.uid()::text);

-- 4. Más habilidades en el CV -----------------------------------------------------------------
-- El catálogo de la app ahora es amplio, así que damos lugar a 8 habilidades.
alter table public.resumes drop constraint if exists resumes_skills_max;
alter table public.resumes add constraint resumes_skills_max
  check (coalesce(array_length(skills_list, 1), 0) <= 8);

commit;
