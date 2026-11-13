-- 040: documentos legales, consentimiento informado y datos del operador.
--
-- Qué agrega:
--   1. Datos del responsable del sitio en app_settings (razón social, CUIT,
--      domicilio, correo legal y fecha de última actualización).
--   2. Tabla legal_acceptances: prueba de cuándo y cómo cada persona aceptó
--      los Términos, la Política de Privacidad y la Política de Cookies.
--   3. Función record_legal_acceptance(...) para registrar la aceptación desde
--      los formularios. Guarda IP y user-agent que envía el servidor (no los
--      inventa el cliente) y evita duplicados por doble clic.
--   4. handle_new_user registra la aceptación del registro a partir de los
--      metadatos que manda el formulario de creación de cuenta, incluso si la
--      confirmación por correo queda pendiente y todavía no hay sesión.
--
-- La tabla no tiene políticas de RLS: solo se escribe por la función. Los
-- registros se conservan si se elimina la cuenta (user_id pasa a null) porque
-- sirven como prueba del consentimiento otorgado.

begin;

-- 1) Datos del responsable -----------------------------------------------------------------
alter table public.app_settings
  add column if not exists legal_business_name text,
  add column if not exists legal_cuit text,
  add column if not exists legal_address text,
  add column if not exists legal_email text default 'laburamosapp@gmail.com',
  add column if not exists legal_last_update date default current_date;

update public.app_settings
set legal_email = coalesce(nullif(btrim(legal_email), ''), 'laburamosapp@gmail.com'),
    legal_last_update = coalesce(legal_last_update, current_date)
where id = 1;

-- 2) Registro de aceptaciones --------------------------------------------------------------
create table if not exists public.legal_acceptances (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references auth.users(id) on delete set null,
  document    text not null check (document in ('terms', 'privacy', 'cookies', 'refund')),
  version     text not null,
  context     text not null,
  method      text not null default 'checkbox' check (method in ('checkbox', 'signup', 'banner', 'settings')),
  accepted_at timestamptz not null default now(),
  ip          text,
  user_agent  text
);

create index if not exists legal_acceptances_user_idx
  on public.legal_acceptances (user_id, document, accepted_at desc);
create index if not exists legal_acceptances_document_idx
  on public.legal_acceptances (document, accepted_at desc);

alter table public.legal_acceptances enable row level security;
revoke all on public.legal_acceptances from anon, authenticated;

-- 3) Función para registrar una aceptación -------------------------------------------------
create or replace function public.record_legal_acceptance(
  p_document text,
  p_version text,
  p_context text,
  p_method text default 'checkbox'
)
returns void
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_uid uuid := auth.uid();
  v_headers jsonb;
  v_ip text;
  v_ua text;
  v_doc text := lower(btrim(coalesce(p_document, '')));
  v_version text := left(btrim(coalesce(p_version, '')), 40);
  v_context text := left(btrim(coalesce(p_context, '')), 80);
  v_method text := lower(btrim(coalesce(p_method, 'checkbox')));
begin
  if v_doc not in ('terms', 'privacy', 'cookies', 'refund') then
    raise exception 'documento_invalido';
  end if;
  if v_version = '' then
    raise exception 'version_invalida';
  end if;
  if v_context = '' then
    raise exception 'contexto_invalido';
  end if;
  if v_method not in ('checkbox', 'signup', 'banner', 'settings') then
    raise exception 'metodo_invalido';
  end if;

  -- Los encabezados los agrega el servidor de Supabase. Si no están disponibles,
  -- el registro queda igual con la fecha y el usuario.
  begin
    v_headers := nullif(current_setting('request.headers', true), '')::jsonb;
  exception when others then
    v_headers := null;
  end;
  v_ip := nullif(split_part(coalesce(v_headers ->> 'x-forwarded-for', ''), ',', 1), '');
  v_ua := left(coalesce(v_headers ->> 'user-agent', ''), 400);

  -- Evita filas repetidas por doble clic o reintentos inmediatos.
  if exists (
    select 1
    from public.legal_acceptances a
    where a.document = v_doc
      and a.context = v_context
      and a.user_id is not distinct from v_uid
      and a.accepted_at > now() - interval '5 seconds'
  ) then
    return;
  end if;

  insert into public.legal_acceptances (user_id, document, version, context, method, ip, user_agent)
  values (v_uid, v_doc, v_version, v_context, v_method, v_ip, v_ua);
end
$function$;

revoke all on function public.record_legal_acceptance(text, text, text, text) from public;
grant execute on function public.record_legal_acceptance(text, text, text, text) to anon, authenticated;

-- 4) Registro de la cuenta: deja prueba de la aceptación del formulario ----------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  v_terms text := nullif(btrim(coalesce(new.raw_user_meta_data ->> 'legal_terms_version', '')), '');
  v_privacy text := nullif(btrim(coalesce(new.raw_user_meta_data ->> 'legal_privacy_version', '')), '');
  v_headers jsonb;
  v_ip text;
  v_ua text;
begin
  insert into public.profiles (id, full_name, role, city, province)
  values (
    new.id,
    nullif(btrim(coalesce(new.raw_user_meta_data ->> 'full_name', '')), ''),
    case
      when new.raw_user_meta_data ->> 'role' = 'company' then 'company'
      else 'worker'
    end,
    nullif(btrim(coalesce(new.raw_user_meta_data ->> 'city', '')), ''),
    nullif(btrim(coalesce(new.raw_user_meta_data ->> 'province', '')), '')
  )
  on conflict (id) do nothing;

  begin
    v_headers := nullif(current_setting('request.headers', true), '')::jsonb;
  exception when others then
    v_headers := null;
  end;
  v_ip := nullif(split_part(coalesce(v_headers ->> 'x-forwarded-for', ''), ',', 1), '');
  v_ua := left(coalesce(v_headers ->> 'user-agent', ''), 400);

  if v_terms is not null then
    insert into public.legal_acceptances (user_id, document, version, context, method, ip, user_agent)
    values (new.id, 'terms', left(v_terms, 40), 'registro', 'signup', v_ip, v_ua);
  end if;

  if v_privacy is not null then
    insert into public.legal_acceptances (user_id, document, version, context, method, ip, user_agent)
    values (new.id, 'privacy', left(v_privacy, 40), 'registro', 'signup', v_ip, v_ua);
  end if;

  return new;
end;
$function$;

commit;
