-- 013: emote de tarjeta (ilustración del oficio) cuando el aviso no lleva fotos.

begin;

alter table public.jobs add column if not exists icon text;
alter table public.services add column if not exists icon text;

commit;
