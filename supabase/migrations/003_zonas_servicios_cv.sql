-- 003: zonas de toda Argentina, servicios "ofrece / busca" y CV completo.
-- Solo AGREGA columnas, índices, un trigger y el bucket de fotos: no borra ni renombra columnas.
-- Probarla primero en un proyecto de Supabase de desarrollo. La versión nueva de la app la necesita aplicada.

begin;

-- 1. Provincia en todo lo que tiene localidad -------------------------------------------
alter table public.profiles add column if not exists province text;
alter table public.jobs     add column if not exists province text;
alter table public.services add column if not exists province text;
alter table public.resumes  add column if not exists province text;

-- En la lista oficial (Georef) la localidad se llama "General O'Brien"
update public.profiles set city     = 'General O''Brien' where city     = 'O''Brien';
update public.jobs     set location = 'General O''Brien' where location = 'O''Brien';
update public.services set city     = 'General O''Brien' where city     = 'O''Brien';
update public.resumes  set city     = 'General O''Brien' where city     = 'O''Brien';

-- Las localidades que tenía la app son todas de la provincia de Buenos Aires
update public.profiles set province = 'Buenos Aires'
  where province is null and city in ('Bragado', 'General O''Brien', 'Mechita', 'Alberti', '9 de Julio');
update public.jobs set province = 'Buenos Aires'
  where province is null and location in ('Bragado', 'General O''Brien', 'Mechita', 'Alberti', '9 de Julio');
update public.services set province = 'Buenos Aires'
  where province is null and city in ('Bragado', 'General O''Brien', 'Mechita', 'Alberti', '9 de Julio');
update public.resumes set province = 'Buenos Aires'
  where province is null and city in ('Bragado', 'General O''Brien', 'Mechita', 'Alberti', '9 de Julio');

create index if not exists jobs_zone_idx     on public.jobs (province, location);
create index if not exists services_zone_idx on public.services (province, city);
create index if not exists resumes_zone_idx  on public.resumes (province, city);

-- Al registrarse, la provincia viaja en los metadatos igual que la ciudad.
-- Este trigger la completa sin tocar el trigger que ya crea el perfil.
create or replace function public.profiles_fill_province() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.province is null then
    select u.raw_user_meta_data ->> 'province' into new.province from auth.users u where u.id = new.id;
  end if;
  return new;
end $$;
drop trigger if exists trg_profiles_province on public.profiles;
create trigger trg_profiles_province before insert on public.profiles
  for each row execute function public.profiles_fill_province();

-- 2. Servicios: quien ofrece su oficio o quien busca que le hagan un trabajo -------------
alter table public.services add column if not exists intent text not null default 'ofrece';
alter table public.services drop constraint if exists services_intent_check;
alter table public.services add constraint services_intent_check check (intent in ('ofrece', 'busca'));
alter table public.services add column if not exists is_urgent boolean not null default false;
-- Los avisos que ya existen quedan como "ofrece" (por el default).

-- 3. CV completo ------------------------------------------------------------------------
alter table public.resumes add column if not exists summary         text;
-- Ruta de la foto dentro del bucket privado cv-photos (<user_id>/<aleatorio>.jpg); se muestra con URL firmada
alter table public.resumes add column if not exists photo_path      text;
alter table public.resumes add column if not exists birth_date      date;
alter table public.resumes add column if not exists neighborhood    text;
alter table public.resumes add column if not exists email           text;
alter table public.resumes add column if not exists skills_list     text[] not null default '{}';
alter table public.resumes add column if not exists education       jsonb  not null default '[]'::jsonb;
alter table public.resumes add column if not exists experience_list jsonb  not null default '[]'::jsonb;
-- Colores elegidos para el CV: { "bg": "navy", "title": "naranja" }
alter table public.resumes add column if not exists theme           jsonb  not null default '{}'::jsonb;

alter table public.resumes drop constraint if exists resumes_summary_len;
alter table public.resumes add constraint resumes_summary_len check (summary is null or char_length(summary) <= 300);
alter table public.resumes drop constraint if exists resumes_skills_max;
alter table public.resumes add constraint resumes_skills_max check (coalesce(array_length(skills_list, 1), 0) <= 5);
alter table public.resumes drop constraint if exists resumes_lists_are_arrays;
alter table public.resumes add constraint resumes_lists_are_arrays
  check (jsonb_typeof(education) = 'array' and jsonb_typeof(experience_list) = 'array');

-- Las habilidades viejas (texto separado por comas) pasan a la lista nueva
update public.resumes
  set skills_list = (
    select coalesce(array_agg(t), '{}') from (
      select trim(x) as t from unnest(string_to_array(skills, ',')) as x where trim(x) <> '' limit 5
    ) s
  )
  where skills is not null and skills <> '' and skills_list = '{}';

-- Si se aplicó 001_politicas_rls.sql, el UPDATE está limitado por columna: sumar las nuevas.
-- (Si no se aplicó, estos grant no cambian nada.)
grant update (province) on public.profiles to authenticated;
grant update (province) on public.jobs to authenticated;
grant update (province, intent, is_urgent) on public.services to authenticated;

-- 4. Fotos del CV (Storage) -------------------------------------------------------------
-- Bucket PRIVADO: las fotos se ven solo con URL firmada. Cada persona escribe solo en su carpeta.
-- La lectura para las empresas a las que se postuló y para el administrador se agrega en la 004.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('cv-photos', 'cv-photos', false, 2097152, array['image/jpeg'])
on conflict (id) do update set public = false;

drop policy if exists cv_photos_select_own on storage.objects;
create policy cv_photos_select_own on storage.objects for select to authenticated
  using (bucket_id = 'cv-photos' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists cv_photos_insert on storage.objects;
create policy cv_photos_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'cv-photos' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists cv_photos_update on storage.objects;
create policy cv_photos_update on storage.objects for update to authenticated
  using (bucket_id = 'cv-photos' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists cv_photos_delete on storage.objects;
create policy cv_photos_delete on storage.objects for delete to authenticated
  using (bucket_id = 'cv-photos' and (storage.foldername(name))[1] = auth.uid()::text);

commit;
