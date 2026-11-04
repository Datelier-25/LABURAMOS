-- 014: permisos por columna que faltaban para publicar.
-- Los grants de jobs/services son a nivel columna (ver 001/003/005); al agregar
-- columnas nuevas hay que habilitarlas para el rol authenticated o el insert
-- falla con "permission denied for table".
--
--   jobs:     pay_type / schedule / duration (sueldo y condiciones) + icon (emote)
--   services: price (precio) + icon (emote)

grant insert (pay_type, schedule, duration, icon) on public.jobs to authenticated;
grant update (pay_type, schedule, duration, icon) on public.jobs to authenticated;

grant insert (price, icon) on public.services to authenticated;
grant update (price, icon) on public.services to authenticated;
