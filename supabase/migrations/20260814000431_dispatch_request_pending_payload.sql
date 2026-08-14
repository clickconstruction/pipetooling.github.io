SET lock_timeout = '3s';

-- Structured payload for dispatch-request pending actions (v2.1615).
--
-- First use: "Send to Dispatch — find the owner" (v2.1610) can now carry
-- WHICH supply house(s) the requester wants the job account set up with —
-- {"supply_houses": [{"id","label","email"}]} — so the share modal preselects
-- them when dispatch completes the errand from the inbox. Generic on purpose:
-- add_job_phone / link_job_pictures / future pending actions can stash their
-- own context here instead of minting a column each.
--
-- Additive; existing RLS policies cover the new column. Old clients ignore it.

ALTER TABLE public.dispatch_requests
  ADD COLUMN IF NOT EXISTS pending_payload jsonb;

COMMENT ON COLUMN public.dispatch_requests.pending_payload IS
  'Structured context for pending_action flows (v2.1615). find_property_owner: {"supply_houses": [{"id","label","email"}]} — the supply house(s) the requester wants the job account at.';
