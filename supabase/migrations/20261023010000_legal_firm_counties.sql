SET lock_timeout = '3s';

-- Legal firms by county, PR 1 (punch list #144, v2.5756): which collections law firm covers
-- which Texas county. Venue for a collections suit is the county (the JP precinct for small
-- claims), and every customer address already names it (customer_addresses.county), so the
-- territory a firm covers is a set of counties, one firm per county at a time. A dev colors
-- the counties on Settings → Jobs & billing → Collections law firms; PR 2 makes the Legal
-- desk pick the firm from the account's venue; PR 3 draws the cases on the same map; PR 4
-- shows the firms who covers what.
--
-- One live row per county (until IS NULL); history keeps the closed rows. A county nobody
-- covers has no live row, and the desk says so instead of guessing a firm. A matter stays
-- with the firm it was released to (legal_matters.firm_id), whatever happens to the county.

BEGIN;

CREATE TABLE IF NOT EXISTS public.legal_firm_counties (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  firm_id uuid NOT NULL REFERENCES public.legal_firms(id) ON DELETE CASCADE,
  county text NOT NULL CHECK (length(btrim(county)) > 0),
  since timestamptz NOT NULL DEFAULT now(),
  until timestamptz,
  set_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  CONSTRAINT legal_firm_counties_until_after_since CHECK (until IS NULL OR until >= since)
);

-- One firm per county at a time.
CREATE UNIQUE INDEX IF NOT EXISTS legal_firm_counties_live_county_uidx
  ON public.legal_firm_counties (county) WHERE until IS NULL;
CREATE INDEX IF NOT EXISTS legal_firm_counties_live_firm_idx
  ON public.legal_firm_counties (firm_id) WHERE until IS NULL;

COMMENT ON TABLE public.legal_firm_counties IS 'Which collections law firm covers which Texas county (punch list #144, v2.5756). One live row per county (until IS NULL, held by legal_firm_counties_live_county_uidx); a closed row is history. county is the Census county name as the map file public/geo/tx-counties.json spells it (Bexar, Travis, DeWitt). No row means no firm covers the county. Dev-only writes; the office reads.';
COMMENT ON COLUMN public.legal_firm_counties.county IS 'The Census county name without the word County, as customer_addresses.county and src/lib/txCountyLookup.ts spell it.';
COMMENT ON COLUMN public.legal_firm_counties.until IS 'When the firm stopped covering the county; NULL while it does.';

ALTER TABLE public.legal_firm_counties ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS legal_firm_counties_office_select ON public.legal_firm_counties;
CREATE POLICY legal_firm_counties_office_select ON public.legal_firm_counties
  FOR SELECT TO authenticated USING (public.legal_office_can_read());
DROP POLICY IF EXISTS legal_firm_counties_dev_insert ON public.legal_firm_counties;
CREATE POLICY legal_firm_counties_dev_insert ON public.legal_firm_counties
  FOR INSERT TO authenticated WITH CHECK (public.is_dev());
DROP POLICY IF EXISTS legal_firm_counties_dev_update ON public.legal_firm_counties;
CREATE POLICY legal_firm_counties_dev_update ON public.legal_firm_counties
  FOR UPDATE TO authenticated USING (public.is_dev()) WITH CHECK (public.is_dev());
-- No delete policy: a county's history stays.

-- Two firms at once. The one-active-firm index from punch list #85 (item 27) held the office
-- to a single firm while the desk could only release to one; territories make the second
-- firm a feature, so the index goes. legal_replace_firm still retires one firm and adds its
-- successor in one step.
DROP INDEX IF EXISTS public.legal_firms_one_active;
COMMENT ON TABLE public.legal_firms IS 'The collections law firms the office works with (v2.3313). Several may be active at once since v2.5756 (punch list #144), each covering the counties in legal_firm_counties; the fee model (contingency %, filing cost) drives the Legal desk''s worth panel. Dev-only writes.';

COMMIT;

SELECT public.apply_read_only_write_blocks();
SELECT public.apply_read_only_stmt_blocks();
SELECT public.apply_digital_twin_write_blocks();
