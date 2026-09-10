SET lock_timeout = '3s';

-- v2.3243 — reps carry provenance for real.
-- The Directory (v2.3166) labels each rep "added by <name>" from
-- supply_house_contacts.created_by, but the column (v2.1605) had no default and
-- neither writer — the reps editor nor the RFQ window's "remember as rep" — set
-- it, so every rep added since read as nobody's. Default it to the caller so
-- every path stamps the author; service-role writes (no auth.uid()) stay NULL.
-- Existing rows keep NULL: nobody can say who added them after the fact.

ALTER TABLE public.supply_house_contacts
  ALTER COLUMN created_by SET DEFAULT auth.uid();

COMMENT ON COLUMN public.supply_house_contacts.created_by IS
  'Who added the rep — defaults to auth.uid() (v2.3243); the Directory shows it as "added by". NULL for rows older than v2.3243 or written by the service role.';
