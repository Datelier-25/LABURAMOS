-- 042: postulaciones solo por email, correo transaccional y comentario opcional.
--
-- Qué agrega:
--   1. Dos columnas en app_settings para el remitente de postulaciones:
--      application_email_from (correo verificado en Resend/SendGrid/Brevo)
--      application_email_name (nombre visible, ej: "LaburamosApp")
--   2. Columna worker_comment en applications para el comentario breve opcional.
--   3. Columnas de seguimiento del envío: email_sent_at y email_error.
--
-- El envío real lo hace la Edge Function supabase/functions/send_application_email.
-- Esa función lee estas columnas y usa las variables de entorno del proveedor
-- (RESEND_API_KEY o BREVO_API_KEY). El correo sale SIEMPRE desde el remitente
-- configurado, con Reply-To al email del postulante.

begin;

-- 1) Configuración del correo de postulaciones -------------------------------------------
alter table public.app_settings
  add column if not exists application_email_from text not null default 'laburamosapp@gmail.com',
  add column if not exists application_email_name text not null default 'LaburamosApp';

update public.app_settings
set application_email_from = coalesce(nullif(btrim(application_email_from), ''), 'laburamosapp@gmail.com'),
    application_email_name = coalesce(nullif(btrim(application_email_name), ''), 'LaburamosApp')
where id = 1;

-- 2) Comentario opcional del postulante ---------------------------------------------------
alter table public.applications
  add column if not exists worker_comment text;

-- 3) Seguimiento del envío -----------------------------------------------------------------
alter table public.applications
  add column if not exists email_sent_at timestamptz,
  add column if not exists email_error text;

-- El estado del envío lo maneja solo la Edge Function (service role).
-- No hace falta tocar grants: applications no tiene política de UPDATE para clientes.


-- La versión anterior de esta migración creaba un RPC de prueba que no enviaba nada.
-- El envío se movió a la Edge Function, así que se elimina para no dejar una función vacía.
drop function if exists public.send_application_email(uuid, uuid);

-- 4) Las postulaciones son solo por email ------------------------------------------------
-- El canal queda fijo en 'email'. Al publicar un aviso el email es obligatorio.
create or replace function public.enforce_job_apply_fields()
returns trigger
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_items jsonb := coalesce(NEW.requirement_items, '[]'::jsonb);
  v_item jsonb;
  v_clean jsonb := '[]'::jsonb;
  v_text text;
  v_required boolean;
  v_count int := 0;
begin
  if jsonb_typeof(v_items) <> 'array' then
    raise exception 'requisitos_invalidos';
  end if;

  for v_item in select value from jsonb_array_elements(v_items) loop
    if jsonb_typeof(v_item) <> 'object' then
      raise exception 'requisitos_invalidos';
    end if;

    v_text := btrim(coalesce(v_item->>'text', ''));
    if v_text = '' then
      continue;
    end if;
    if length(v_text) > 200 then
      raise exception 'requisito_largo';
    end if;

    v_required := case
      when jsonb_typeof(v_item->'required') = 'boolean' then (v_item->>'required')::boolean
      else false
    end;

    v_count := v_count + 1;
    if v_count > 10 then
      raise exception 'requisitos_limite';
    end if;

    v_clean := v_clean || jsonb_build_array(
      jsonb_build_object('text', v_text, 'required', v_required)
    );
  end loop;

  NEW.requirement_items := v_clean;

  -- Postulaciones: solo por email.
  NEW.apply_channel := 'email';
  NEW.apply_email := nullif(btrim(coalesce(NEW.apply_email, '')), '');

  if NEW.apply_email is null then
    -- Avisos viejos sin email: se dejan guardar para que el admin pueda operarlos,
    -- pero no reciben postulaciones hasta que el dueño cargue un correo.
    if tg_op = 'INSERT' then
      raise exception 'email_invalido';
    end if;
  elsif NEW.apply_email !~* '^[^@[:space:]]+@[^@[:space:]]+[.][^@[:space:]]+$'
     or length(NEW.apply_email) > 254 then
    raise exception 'email_invalido';
  end if;

  return NEW;
end
$function$;

-- Los avisos existentes pasan a email (si no tienen correo, quedan sin postulaciones).
update public.jobs set apply_channel = 'email' where apply_channel is distinct from 'email';

alter table public.jobs drop constraint if exists jobs_apply_channel_check;
alter table public.jobs add constraint jobs_apply_channel_check check (apply_channel = 'email');

commit;
