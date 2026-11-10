-- 031: requisitos por ítem (excluyente / no excluyente) y medio de postulación.
--
-- Cada aviso laboral puede cargar varios requisitos. Cada uno tiene su texto y
-- una marca que indica si es excluyente (obligatorio) o no. Además, quien
-- publica elige si quiere recibir las postulaciones por WhatsApp o por email.
-- La base valida todo para que no se pueda saltear desde el navegador.

begin;

-- 1) Columnas nuevas en los avisos de empleo
alter table public.jobs
  add column if not exists requirement_items jsonb not null default '[]'::jsonb,
  add column if not exists apply_channel text not null default 'whatsapp',
  add column if not exists apply_email text;

alter table public.jobs drop constraint if exists jobs_apply_channel_check;
alter table public.jobs add constraint jobs_apply_channel_check
  check (apply_channel in ('whatsapp', 'email'));

alter table public.jobs drop constraint if exists jobs_requirement_items_array;
alter table public.jobs add constraint jobs_requirement_items_array
  check (jsonb_typeof(requirement_items) = 'array');

-- La app lee los avisos con select('*'): hacen falta los permisos de lectura.
grant select (requirement_items, apply_channel, apply_email) on public.jobs to anon, authenticated;
grant insert (requirement_items, apply_channel, apply_email) on public.jobs to authenticated;

-- Los requisitos viejos (un solo texto) pasan a ser un ítem no excluyente.
update public.jobs
set requirement_items = jsonb_build_array(
  jsonb_build_object('text', left(btrim(requirements), 200), 'required', false)
)
where requirements is not null
  and btrim(requirements) <> ''
  and requirement_items = '[]'::jsonb;

-- 2) Validación y normalización de los campos nuevos
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

  if NEW.apply_channel is null then
    NEW.apply_channel := 'whatsapp';
  end if;

  if NEW.apply_channel not in ('whatsapp', 'email') then
    raise exception 'medio_invalido';
  end if;

  if NEW.apply_channel = 'email' then
    NEW.apply_email := nullif(btrim(coalesce(NEW.apply_email, '')), '');
    if NEW.apply_email is null
       or NEW.apply_email !~* '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'
       or length(NEW.apply_email) > 254 then
      raise exception 'email_invalido';
    end if;
  else
    NEW.apply_email := null;
  end if;

  return NEW;
end
$function$;

drop trigger if exists enforce_job_apply_fields on public.jobs;
create trigger enforce_job_apply_fields
  before insert or update on public.jobs
  for each row execute function public.enforce_job_apply_fields();

-- 3) Edición: sumamos los campos nuevos al RPC que usan el dueño y el admin
create or replace function public.admin_update_listing(p_kind text, p_id uuid, p jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_owner uuid;
begin
  if p_kind = 'job' then
    select company_id into v_owner from public.jobs where id = p_id;
  elsif p_kind = 'service' then
    select owner_id into v_owner from public.services where id = p_id;
  else
    raise exception 'tipo_invalido';
  end if;

  if v_owner is null then
    raise exception 'no_encontrado';
  end if;

  if not public.is_admin() and v_owner is distinct from auth.uid() then
    raise exception 'no_es_dueno';
  end if;

  if p ? 'status' and p->>'status' not in ('active', 'paused', 'filled') then
    raise exception 'estado_invalido';
  end if;

  if p ? 'photos' and jsonb_typeof(p->'photos') <> 'array' then
    raise exception 'fotos_invalidas';
  end if;

  if p ? 'links' and jsonb_typeof(p->'links') <> 'array' then
    raise exception 'links_invalidos';
  end if;

  if p ? 'requirement_items' and jsonb_typeof(p->'requirement_items') <> 'array' then
    raise exception 'requisitos_invalidos';
  end if;

  if p_kind = 'job' then
    update public.jobs set
      title        = case when p ? 'title' then nullif(p->>'title', '') else title end,
      company_name = case when p ? 'company_name' then nullif(p->>'company_name', '') else company_name end,
      category     = case when p ? 'category' then nullif(p->>'category', '') else category end,
      job_type     = case when p ? 'job_type' then nullif(p->>'job_type', '') else job_type end,
      salary       = case when p ? 'salary' then nullif(p->>'salary', '') else salary end,
      pay_type     = case when p ? 'pay_type' then nullif(p->>'pay_type', '') else pay_type end,
      location     = case when p ? 'location' then nullif(p->>'location', '') else location end,
      province     = case when p ? 'province' then nullif(p->>'province', '') else province end,
      phone        = case when p ? 'phone' then nullif(p->>'phone', '') else phone end,
      description  = case when p ? 'description' then coalesce(p->>'description', '') else description end,
      requirements = case when p ? 'requirements' then nullif(p->>'requirements', '') else requirements end,
      requirement_items = case when p ? 'requirement_items' then coalesce(p->'requirement_items', '[]'::jsonb) else requirement_items end,
      apply_channel = case when p ? 'apply_channel' then nullif(p->>'apply_channel', '') else apply_channel end,
      apply_email   = case when p ? 'apply_email' then nullif(p->>'apply_email', '') else apply_email end,
      schedule     = case when p ? 'schedule' then nullif(p->>'schedule', '') else schedule end,
      duration     = case when p ? 'duration' then nullif(p->>'duration', '') else duration end,
      icon         = case when p ? 'icon' then nullif(p->>'icon', '') else icon end,
      links        = case when p ? 'links' then
                       coalesce(
                         (select array_agg(value)
                          from jsonb_array_elements_text(p->'links') as t(value)),
                         '{}'::text[]
                       )
                     else links end,
      is_urgent    = case when p ? 'is_urgent' then (p->>'is_urgent')::boolean else is_urgent end,
      status       = case when p ? 'status' then p->>'status' else status end,
      expires_at   = case when p ? 'expires_at' then (p->>'expires_at')::timestamptz else expires_at end
    where id = p_id;
  else
    if p ? 'status' and p->>'status' = 'filled' then
      raise exception 'estado_invalido';
    end if;
    update public.services set
      title           = case when p ? 'title' then nullif(p->>'title', '') else title end,
      provider_name   = case when p ? 'provider_name' then nullif(p->>'provider_name', '') else provider_name end,
      provider_prefix = case when p ? 'provider_prefix' then nullif(p->>'provider_prefix', '') else provider_prefix end,
      category        = case when p ? 'category' then nullif(p->>'category', '') else category end,
      description     = case when p ? 'description' then coalesce(p->>'description', '') else description end,
      phone           = case when p ? 'phone' then nullif(p->>'phone', '') else phone end,
      city            = case when p ? 'city' then nullif(p->>'city', '') else city end,
      province        = case when p ? 'province' then nullif(p->>'province', '') else province end,
      intent          = case when p ? 'intent' then nullif(p->>'intent', '') else intent end,
      price           = case when p ? 'price' then nullif(p->>'price', '') else price end,
      icon            = case when p ? 'icon' then nullif(p->>'icon', '') else icon end,
      photos          = case when p ? 'photos' then
                          coalesce(
                            (select array_agg(value)
                             from jsonb_array_elements_text(p->'photos') as t(value)),
                            '{}'::text[]
                          )
                        else photos end,
      links           = case when p ? 'links' then
                          coalesce(
                            (select array_agg(value)
                             from jsonb_array_elements_text(p->'links') as t(value)),
                            '{}'::text[]
                          )
                        else links end,
      is_urgent       = case when p ? 'is_urgent' then (p->>'is_urgent')::boolean else is_urgent end,
      status          = case when p ? 'status' then p->>'status' else status end,
      expires_at      = case when p ? 'expires_at' then (p->>'expires_at')::timestamptz else expires_at end
    where id = p_id;
  end if;

  if not found then
    raise exception 'no_encontrado';
  end if;
end
$function$;

grant execute on function public.admin_update_listing(text, uuid, jsonb) to authenticated;

commit;
