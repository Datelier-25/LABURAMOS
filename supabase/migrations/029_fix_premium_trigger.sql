-- 029: la activación manual del premium debe funcionar aunque el interruptor
-- general esté apagado. El interruptor controla la opción en el panel, no el
-- vencimiento ya asignado a una publicación.

create or replace function public.enforce_listing_limits()
returns trigger
language plpgsql
security definer
set search_path = public
as $function$
declare
  cfg public.app_settings%rowtype;
  v_new jsonb := to_jsonb(NEW);
  v_old jsonb := case when TG_OP = 'UPDATE' then to_jsonb(OLD) else '{}'::jsonb end;
  v_links jsonb := coalesce(v_new->'links', '[]'::jsonb);
  v_photos jsonb := coalesce(v_new->'photos', '[]'::jsonb);
  v_link_count int;
  v_photo_count int;
  v_link_limit int;
  v_photo_limit int;
  v_premium boolean;
begin
  if TG_OP = 'UPDATE'
     and (v_new->'links') is not distinct from (v_old->'links')
     and (v_new->'photos') is not distinct from (v_old->'photos') then
    return NEW;
  end if;

  select * into cfg from public.app_settings where id = 1;

  v_premium := NEW.premium_until is not null and NEW.premium_until > now();

  if coalesce(cfg.premium_include_links, true) then
    v_link_limit := case
      when v_premium then coalesce(cfg.premium_links_limit, 3)
      else coalesce(cfg.free_links_limit, 1)
    end;
  else
    v_link_limit := greatest(coalesce(cfg.free_links_limit, 1), coalesce(cfg.premium_links_limit, 3));
  end if;

  if coalesce(cfg.premium_include_photos, true) then
    v_photo_limit := case
      when v_premium then coalesce(cfg.premium_photos_limit, 10)
      else coalesce(cfg.free_photos_limit, 5)
    end;
  else
    v_photo_limit := greatest(coalesce(cfg.free_photos_limit, 5), coalesce(cfg.premium_photos_limit, 10));
  end if;

  if jsonb_typeof(v_links) <> 'array' then
    raise exception 'links_invalidos';
  end if;
  if jsonb_typeof(v_photos) <> 'array' then
    raise exception 'fotos_invalidas';
  end if;

  v_link_count := jsonb_array_length(v_links);
  v_photo_count := jsonb_array_length(v_photos);

  if v_link_count > v_link_limit then
    raise exception 'links_limite';
  end if;
  if v_photo_count > v_photo_limit then
    raise exception 'fotos_limite';
  end if;

  if exists (
    select 1
    from jsonb_array_elements_text(v_links) as t(link)
    where link !~* '^https?://[^[:space:]]+$' or length(link) > 500
  ) then
    raise exception 'link_invalido';
  end if;

  return NEW;
end
$function$;
