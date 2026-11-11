-- 035: cartel de bienvenida con una o varias imágenes.
--
-- El administrador activa el cartel y sube las imágenes desde Configuración.
-- La app las muestra al ingresar, con una cruz para cerrarlo. Si hay más de
-- una imagen, se van alternando solas.
--
-- Las imágenes viven en un bucket público porque las tiene que ver cualquiera
-- que entre al sitio. Solo el administrador puede subir, reemplazar o borrar.

begin;

-- 1) Configuración del cartel ---------------------------------------------------------------
alter table public.app_settings
  add column if not exists welcome_enabled boolean not null default false,
  add column if not exists welcome_images jsonb not null default '[]'::jsonb;

alter table public.app_settings drop constraint if exists app_settings_welcome_images_check;
alter table public.app_settings add constraint app_settings_welcome_images_check check (
  jsonb_typeof(welcome_images) = 'array'
  and jsonb_array_length(welcome_images) <= 10
);

-- La app lee la configuración con select('*'): hay que dar permiso a las
-- columnas nuevas. El update sigue protegido por la política is_admin().
grant select (welcome_enabled, welcome_images) on public.app_settings to anon, authenticated;
grant update (welcome_enabled, welcome_images) on public.app_settings to authenticated;

-- 2) Bucket público para las imágenes del cartel --------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('welcome-images', 'welcome-images', true, 5242880,
        array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set public = true,
      file_size_limit = 5242880,
      allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp'];

drop policy if exists welcome_images_read on storage.objects;
create policy welcome_images_read on storage.objects for select to anon, authenticated
  using (bucket_id = 'welcome-images');

drop policy if exists welcome_images_insert on storage.objects;
create policy welcome_images_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'welcome-images' and public.is_admin());

drop policy if exists welcome_images_update on storage.objects;
create policy welcome_images_update on storage.objects for update to authenticated
  using (bucket_id = 'welcome-images' and public.is_admin());

drop policy if exists welcome_images_delete on storage.objects;
create policy welcome_images_delete on storage.objects for delete to authenticated
  using (bucket_id = 'welcome-images' and public.is_admin());

commit;
