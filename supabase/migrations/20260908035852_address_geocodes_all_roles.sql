SET lock_timeout = '3s';

-- v2.3131 — "Your jobs on a map" Dashboard card (all roles).
--
-- address_geocodes is the shared address → lat/lng cache the office Map page
-- fills. Its policies admitted only the map roles (dev / master_technician /
-- assistant / estimator — the 20270520120000 pre-baseline migration), so the
-- controller, primary, superintendent, subcontractor and helpers roles could
-- neither read a cached pin nor let geocode-address-batch (which reads and
-- upserts through the caller's JWT) fill one for them. The cache holds no
-- ownership and nothing a signed-in user cannot already see on the job rows
-- that carry the address, so SELECT / INSERT / UPDATE open to every signed-in
-- user. DELETE stays with the map roles (Settings → Review geocodes).
--
-- Read-only (training mode) users are still blocked from the writes by the
-- restrictive read_only policies apply_read_only_write_blocks() attached to
-- this table; the edge function tolerates a refused upsert (v2.3131).

DROP POLICY IF EXISTS "Map roles can read address geocodes" ON public.address_geocodes;
CREATE POLICY "Signed-in users can read address geocodes"
  ON public.address_geocodes
  FOR SELECT
  TO authenticated
  USING ((SELECT auth.uid()) IS NOT NULL);

DROP POLICY IF EXISTS "Map roles can insert address geocodes" ON public.address_geocodes;
CREATE POLICY "Signed-in users can insert address geocodes"
  ON public.address_geocodes
  FOR INSERT
  TO authenticated
  WITH CHECK ((SELECT auth.uid()) IS NOT NULL);

DROP POLICY IF EXISTS "Map roles can update address geocodes" ON public.address_geocodes;
CREATE POLICY "Signed-in users can update address geocodes"
  ON public.address_geocodes
  FOR UPDATE
  TO authenticated
  USING ((SELECT auth.uid()) IS NOT NULL)
  WITH CHECK ((SELECT auth.uid()) IS NOT NULL);

COMMENT ON TABLE public.address_geocodes IS 'Cached lat/lng for normalized address strings. RLS: any signed-in user reads/inserts/updates (v2.3131 — the Dashboard "Your jobs on a map" card for every role); delete stays with dev, master_technician, assistant, estimator (Review geocodes). Used by /map and the Dashboard job map.';
