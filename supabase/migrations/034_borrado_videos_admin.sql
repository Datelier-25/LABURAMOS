-- 034: el administrador también puede borrar los videos de los anuncios.
--
-- La 033 dejó el bucket `ad-videos` con borrado solo para el dueño de la
-- carpeta (<user_id>/...). Cuando el admin elimina una campaña desde el panel,
-- la función devuelve la ruta del video y el frontend lo borra; sin este
-- permiso, el archivo quedaba huérfano en el bucket.
--
-- No cambia nada del resto del flujo: los usuarios siguen borrando solo lo suyo.

begin;

drop policy if exists ad_videos_delete on storage.objects;
create policy ad_videos_delete on storage.objects for delete to authenticated
  using (
    bucket_id = 'ad-videos'
    and (public.is_admin() or (storage.foldername(name))[1] = auth.uid()::text)
  );

commit;
