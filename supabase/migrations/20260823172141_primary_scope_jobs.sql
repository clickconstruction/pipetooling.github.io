SET lock_timeout = '3s';

-- Primary scoping, part 3 of 3 — JOBS (and therefore Documents) (v2.2177).
--
-- Owner rule: a primary sees only the jobs they are the Account Man for
-- (jobs_ledger.account_manager_user_id, v2.1466). The /documents page is a
-- ledger view over jobs_ledger / estimates / bids, so scoping the tables scopes
-- the page. Same RESTRICTIVE mechanism as parts 1–2; helpers from part 1.
--
-- Deliberately NOT scoped (D1): `reports` — primaries keep the Reports tab as
-- is; list_reports_with_job_info and search_jobs_for_reports are SECURITY
-- DEFINER, so report reading and the New-report job picker are unaffected.
-- No-op for every other role. Idempotent.

DROP POLICY IF EXISTS primary_scope_jobs_ledger ON public.jobs_ledger;
CREATE POLICY primary_scope_jobs_ledger ON public.jobs_ledger AS RESTRICTIVE FOR ALL
  USING ( NOT (SELECT public.is_primary()) OR account_manager_user_id = (SELECT auth.uid()) )
  WITH CHECK ( NOT (SELECT public.is_primary()) OR account_manager_user_id = (SELECT auth.uid()) );

-- Children keyed by job_id.
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'jobs_ledger_fixtures', 'jobs_ledger_invoices', 'jobs_ledger_materials', 'jobs_ledger_payments',
    'jobs_ledger_team_members', 'jobs_ledger_thread_notes', 'jobs_ledger_thread_note_stats_cache',
    'jobs_tally_parts', 'job_activity_events', 'job_status_events', 'job_pct_events',
    'job_followup_reviews', 'job_promised_pay_dates', 'job_property_owners', 'job_share_links',
    'job_hazmat_incidents', 'job_payment_chase_touches', 'job_collect_payment_flows'
  ] LOOP
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = t AND column_name = 'job_id') THEN
      EXECUTE format('DROP POLICY IF EXISTS primary_scope_%I ON public.%I', t, t);
      EXECUTE format(
        'CREATE POLICY primary_scope_%I ON public.%I AS RESTRICTIVE FOR ALL
           USING (NOT (SELECT public.is_primary()) OR public.primary_can_access_job(job_id))
           WITH CHECK (NOT (SELECT public.is_primary()) OR public.primary_can_access_job(job_id))',
        t, t);
    ELSE
      RAISE NOTICE 'primary_scope: table % has no job_id column — skipped', t;
    END IF;
  END LOOP;
END $$;

-- inspections key by job_ledger_id.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'inspections' AND column_name = 'job_ledger_id') THEN
    DROP POLICY IF EXISTS primary_scope_inspections ON public.inspections;
    CREATE POLICY primary_scope_inspections ON public.inspections AS RESTRICTIVE FOR ALL
      USING (NOT (SELECT public.is_primary()) OR job_ledger_id IS NULL OR public.primary_can_access_job(job_ledger_id))
      WITH CHECK (NOT (SELECT public.is_primary()) OR job_ledger_id IS NULL OR public.primary_can_access_job(job_ledger_id));
  END IF;
END $$;
