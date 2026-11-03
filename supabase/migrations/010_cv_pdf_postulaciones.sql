-- ============================================================================
-- CV adjunto en PDF para postularse
-- Cada postulación puede usar el CV armado en la app ('app') o un PDF subido
-- por la persona ('file'). El PDF queda privado en el bucket "cvs".
-- ============================================================================

begin;

alter table public.applications
  add column if not exists cv_kind text not null default 'app' check (cv_kind in ('app', 'file')),
  add column if not exists cv_path text,
  add column if not exists cv_name text,
  add column if not exists worker_name text,
  add column if not exists worker_phone text;

comment on column public.applications.cv_kind is 'app = CV de LaburamosApp, file = PDF adjunto';
comment on column public.applications.cv_path is 'Ruta del PDF dentro del bucket cvs';
comment on column public.applications.cv_name is 'Nombre original del PDF';

-- Bucket privado: sólo PDF, hasta 5 MB.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('cvs', 'cvs', false, 5242880, array['application/pdf'])
on conflict (id) do update
  set public = false,
      file_size_limit = 5242880,
      allowed_mime_types = array['application/pdf'];

-- Sólo se sube dentro de la carpeta propia: cvs/<user_id>/archivo.pdf
drop policy if exists "cvs_insert" on storage.objects;
create policy "cvs_insert" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'cvs' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "cvs_delete" on storage.objects;
create policy "cvs_delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'cvs' and (storage.foldername(name))[1] = auth.uid()::text);

-- La persona dueña siempre puede leer su PDF.
drop policy if exists "cvs_select_own" on storage.objects;
create policy "cvs_select_own" on storage.objects
  for select to authenticated
  using (bucket_id = 'cvs' and (storage.foldername(name))[1] = auth.uid()::text);

-- La empresa puede leerlo sólo si el PDF vino en una postulación suya y está
-- verificada (misma regla que los CVs armados en la app).
drop policy if exists "cvs_select_shared" on storage.objects;
create policy "cvs_select_shared" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'cvs'
    and (
      public.is_admin()
      or (
        public.can_see_cvs()
        and exists (
          select 1
            from public.applications a
           where a.cv_path = objects.name
             and a.company_id = auth.uid()
        )
      )
    )
  );

commit;
