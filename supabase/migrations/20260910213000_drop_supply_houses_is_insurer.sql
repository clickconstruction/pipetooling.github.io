SET lock_timeout = '3s';

-- v2.3244 — retire supply_houses.is_insurer.
-- v2.3172 replaced the negative flag with vendor_kind and kept is_insurer one
-- release as a trigger-derived column so pre-push clients' pickers still
-- worked. Nothing reads it now (client, edge functions, RLS, RPCs); the v2.3244
-- client stops writing it. Push only after that client has deployed — an older
-- client still sends is_insurer on save and would 400 against the dropped column.

DROP TRIGGER IF EXISTS supply_houses_derive_is_insurer ON public.supply_houses;
DROP FUNCTION IF EXISTS public.supply_houses_derive_is_insurer();
ALTER TABLE public.supply_houses DROP COLUMN IF EXISTS is_insurer;
