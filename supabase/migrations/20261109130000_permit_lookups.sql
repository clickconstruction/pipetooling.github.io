-- v2.6786 — Research: Who pulled it (punch list #292, PR 4). One cache table for the two
-- lookups the card makes once per name and once per address: the company on Google Places
-- (phone, website, address, what kind of business) and the parcel at the county (the
-- appraisal id, the use, the values), so the ledger never pays for or waits on a lookup twice.
-- Written by `permit-lookup` as the service role; read by the people who research.
SET lock_timeout = '3s';

CREATE TABLE IF NOT EXISTS public.permit_lookups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- company | parcel
  kind text NOT NULL CHECK (kind IN ('company', 'parcel')),
  -- company: the name key (research_name_key); parcel: the city and the address key.
  lookup_key text NOT NULL,
  -- What was asked of the source, as sent.
  query text NOT NULL,
  found boolean NOT NULL DEFAULT false,
  -- The facts, by kind: company {name, phone, website, address, kind, maps_url, place_id};
  -- parcel {prop_id, situs, use, land_value, improvement_value, total_value, acres, detail_url}.
  facts jsonb NOT NULL DEFAULT '{}'::jsonb,
  error text,
  looked_up_at timestamptz NOT NULL DEFAULT now(),
  looked_up_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  CONSTRAINT permit_lookups_kind_key_key UNIQUE (kind, lookup_key)
);
COMMENT ON TABLE public.permit_lookups IS 'Research (punch list #292): the Who pulled it card''s cached lookups — a company on Google Places, a parcel at the county — one row per kind and key, refreshed when older than the function''s window.';

ALTER TABLE public.permit_lookups ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS permit_lookups_select ON public.permit_lookups;
CREATE POLICY permit_lookups_select ON public.permit_lookups
  FOR SELECT TO authenticated
  USING (public.user_can_research_permits());
REVOKE ALL ON TABLE public.permit_lookups FROM anon;
GRANT SELECT ON TABLE public.permit_lookups TO authenticated;
GRANT ALL ON TABLE public.permit_lookups TO service_role;

-- The four fences every CREATE TABLE migration closes with (CLAUDE.md → DB migrations).
SELECT public.apply_read_only_write_blocks();
SELECT public.apply_read_only_stmt_blocks();
SELECT public.apply_digital_twin_write_blocks();
SELECT public.apply_archived_read_blocks();
