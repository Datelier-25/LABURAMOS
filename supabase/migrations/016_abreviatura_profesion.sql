-- 016: abreviatura de profesión (opcional) para acompañar el nombre en la
-- tarjeta de servicios. Se guarda aparte del nombre para poder cambiarla o
-- quitarla sin editarlo.
--
-- Ejemplo: provider_prefix = 'Cra.' + provider_name = 'Andrea Pérez'.

begin;

alter table public.services add column if not exists provider_prefix text;

-- Los grants de services son por columna (ver 001/003/005/014).
grant select (provider_prefix) on public.services to anon, authenticated;
grant insert (provider_prefix) on public.services to authenticated;
grant update (provider_prefix) on public.services to authenticated;

commit;
