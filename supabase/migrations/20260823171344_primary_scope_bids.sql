SET lock_timeout = '3s';

-- Primary scoping, part 1 of 3 — BIDS (v2.2174).
--
-- The `primary` role was written into every bids policy as an office role
-- ("role IN (dev, master, assistant, estimator, primary) → all rows"). Owner
-- rule (2026-08-23): a primary sees only bids they are the ESTIMATOR or the
-- ACCOUNT MANAGER on (creating a bid also counts — D3). Rather than rewrite
-- ~20 permissive policies and risk the other roles, this adds RESTRICTIVE
-- policies that only bite when the caller is a primary (the read-only
-- training-mode precedent, 20260713090000). Everyone else: `NOT is_primary()`
-- is true and the policy is a no-op. Idempotent (DROP IF EXISTS + CREATE).
--
-- Parts 2 (estimates) and 3 (jobs/documents) reuse the helpers declared here.

-- ── helpers ────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.is_primary() RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path = public
    AS $$
  SELECT EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'primary');
$$;
COMMENT ON FUNCTION public.is_primary() IS 'Caller has role primary. Used by the primary_scope_* restrictive policies (v2.2174).';
GRANT EXECUTE ON FUNCTION public.is_primary() TO authenticated, service_role;

-- A primary is "on" a bid when they are its estimator, its account manager, or its creator.
CREATE OR REPLACE FUNCTION public.primary_can_access_bid(p_bid_id uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path = public
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.bids b
    WHERE b.id = p_bid_id
      AND (b.estimator_id = auth.uid() OR b.account_manager_id = auth.uid() OR b.created_by = auth.uid())
  );
$$;
COMMENT ON FUNCTION public.primary_can_access_bid(uuid) IS 'Primary scoping: caller is estimator, account manager, or creator of the bid.';
GRANT EXECUTE ON FUNCTION public.primary_can_access_bid(uuid) TO authenticated, service_role;

-- A primary is "on" a job when they are its Account Man (jobs_ledger.account_manager_user_id, v2.1466).
CREATE OR REPLACE FUNCTION public.primary_can_access_job(p_job_id uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path = public
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.jobs_ledger j
    WHERE j.id = p_job_id AND j.account_manager_user_id = auth.uid()
  );
$$;
COMMENT ON FUNCTION public.primary_can_access_job(uuid) IS 'Primary scoping: caller is the job''s Account Man.';
GRANT EXECUTE ON FUNCTION public.primary_can_access_job(uuid) TO authenticated, service_role;

-- A primary is "on" an estimate when they created it (the "created and sent" proxy — D2)
-- or it hangs off a job they are the Account Man for.
CREATE OR REPLACE FUNCTION public.primary_can_access_estimate(p_estimate_id uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path = public
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.estimates e
    WHERE e.id = p_estimate_id
      AND (e.created_by = auth.uid()
           OR (e.job_ledger_id IS NOT NULL AND public.primary_can_access_job(e.job_ledger_id)))
  );
$$;
COMMENT ON FUNCTION public.primary_can_access_estimate(uuid) IS 'Primary scoping: caller created the estimate or is Account Man on its job.';
GRANT EXECUTE ON FUNCTION public.primary_can_access_estimate(uuid) TO authenticated, service_role;

-- ── restrictive policies: bids family ──────────────────────────────────────
-- bids itself: INSERT must check the NEW row's own columns (the row doesn't
-- exist yet for the helper to look up).
DROP POLICY IF EXISTS primary_scope_bids ON public.bids;
CREATE POLICY primary_scope_bids ON public.bids AS RESTRICTIVE FOR ALL
  USING ( NOT (SELECT public.is_primary())
          OR estimator_id = (SELECT auth.uid()) OR account_manager_id = (SELECT auth.uid()) OR created_by = (SELECT auth.uid()) )
  WITH CHECK ( NOT (SELECT public.is_primary())
          OR estimator_id = (SELECT auth.uid()) OR account_manager_id = (SELECT auth.uid()) OR created_by = (SELECT auth.uid()) );

-- Children keyed by bid_id.
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'bids_count_rows', 'bids_gc_builders', 'bids_takeoff_rough_part_lines', 'bids_takeoff_template_mappings',
    'bids_tally_parts', 'bids_materials', 'bids_submission_entries',
    'bid_versions', 'bid_version_sends', 'bid_pricing_assignments', 'bid_pricing_package_sends',
    'bid_payment_schedule_rows', 'bid_count_row_custom_prices', 'bid_count_row_submission_hides',
    'bid_gc_recipients', 'price_book_versions', 'cost_estimates'
  ] LOOP
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = t AND column_name = 'bid_id') THEN
      EXECUTE format('DROP POLICY IF EXISTS primary_scope_%I ON public.%I', t, t);
      EXECUTE format(
        'CREATE POLICY primary_scope_%I ON public.%I AS RESTRICTIVE FOR ALL
           USING (NOT (SELECT public.is_primary()) OR public.primary_can_access_bid(bid_id))
           WITH CHECK (NOT (SELECT public.is_primary()) OR public.primary_can_access_bid(bid_id))',
        t, t);
    ELSE
      RAISE NOTICE 'primary_scope: table % has no bid_id column — skipped', t;
    END IF;
  END LOOP;
END $$;

-- Cost-estimate row tables hang off cost_estimates (→ bid_id).
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'cost_estimate_equipment_rows', 'cost_estimate_labor_rows', 'cost_estimate_other_rows',
    'cost_estimate_permit_rows', 'cost_estimate_subcontractor_rows', 'cost_estimate_waste_rows'
  ] LOOP
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = t AND column_name = 'cost_estimate_id') THEN
      EXECUTE format('DROP POLICY IF EXISTS primary_scope_%I ON public.%I', t, t);
      EXECUTE format(
        'CREATE POLICY primary_scope_%I ON public.%I AS RESTRICTIVE FOR ALL
           USING (NOT (SELECT public.is_primary()) OR EXISTS (SELECT 1 FROM public.cost_estimates ce WHERE ce.id = cost_estimate_id AND public.primary_can_access_bid(ce.bid_id)))
           WITH CHECK (NOT (SELECT public.is_primary()) OR EXISTS (SELECT 1 FROM public.cost_estimates ce WHERE ce.id = cost_estimate_id AND public.primary_can_access_bid(ce.bid_id)))',
        t, t);
    ELSE
      RAISE NOTICE 'primary_scope: table % has no cost_estimate_id column — skipped', t;
    END IF;
  END LOOP;
END $$;
