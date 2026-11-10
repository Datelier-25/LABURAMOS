-- 030: agregar link oficial de Instagram de la app (editable desde Configuración)

alter table public.app_settings
  add column if not exists instagram_url text;

grant select (instagram_url) on public.app_settings to anon, authenticated;
grant update (instagram_url) on public.app_settings to authenticated;

-- Valor por defecto
update public.app_settings set instagram_url = 'https://instagram.com/laburamosapp' where id = 1 and instagram_url is null;