-- 039: permisos de las funciones de anuncios y de eliminación de cuenta.
--
-- En Supabase, las funciones nuevas del esquema public heredan EXECUTE para
-- anon por los privilegios por defecto. La guía de instalación pide que estas
-- funciones solo las pueda llamar una persona autenticada. Revocamos anon y
-- PUBLIC y dejamos el permiso explícito para authenticated.
--
-- No se toca is_admin(): las políticas RLS lo evalúan para anon y tiene que
-- poder ejecutarse (devuelve false cuando no hay sesión).

begin;

revoke execute on function public.submit_ad_campaign(text, text, numeric, text, text, text, bigint) from public, anon;
revoke execute on function public.submit_ad_image_campaign(text, text, text, text, text, bigint) from public, anon;
revoke execute on function public.pick_random_ad() from public, anon;
revoke execute on function public.register_ad_event(uuid, text) from public, anon;
revoke execute on function public.my_ad_stats() from public, anon;
revoke execute on function public.admin_review_ad_campaign(uuid, text, text) from public, anon;
revoke execute on function public.admin_delete_ad_campaign(uuid) from public, anon;
revoke execute on function public.delete_my_account() from public, anon;

grant execute on function public.submit_ad_campaign(text, text, numeric, text, text, text, bigint) to authenticated;
grant execute on function public.submit_ad_image_campaign(text, text, text, text, text, bigint) to authenticated;
grant execute on function public.pick_random_ad() to authenticated;
grant execute on function public.register_ad_event(uuid, text) to authenticated;
grant execute on function public.my_ad_stats() to authenticated;
grant execute on function public.admin_review_ad_campaign(uuid, text, text) to authenticated;
grant execute on function public.admin_delete_ad_campaign(uuid) to authenticated;
grant execute on function public.delete_my_account() to authenticated;

commit;
