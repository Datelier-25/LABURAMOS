-- 015: foto de perfil (avatar) + bucket público 'avatars'.
begin;

-- 1. Columna avatar en profiles
alter table public.profiles add column if not exists avatar_url text;

-- 2. Permiso de escritura sobre la nueva columna (los grants son por columna)
grant update (avatar_url) on public.profiles to authenticated;

-- 3. Bucket público para avatares (carpeta <user_id>/...)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', true, 2097152,
        array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set public = true,
      file_size_limit = 2097152,
      allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp'];

-- 4. Políticas: lectura pública; cada uno sube/edita/borra solo su carpeta
drop policy if exists avatars_read on storage.objects;
create policy avatars_read on storage.objects for select to anon, authenticated
  using (bucket_id = 'avatars');

drop policy if exists avatars_insert on storage.objects;
create policy avatars_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists avatars_update on storage.objects;
create policy avatars_update on storage.objects for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists avatars_delete on storage.objects;
create policy avatars_delete on storage.objects for delete to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

commit;
