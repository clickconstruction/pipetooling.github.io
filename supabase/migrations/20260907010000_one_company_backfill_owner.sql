SET lock_timeout = '3s';

-- v2.2984 — One company, Phase 4: every row is filed under the company owner account.
--
-- docs/ONE_COMPANY_PLAN.md Phase 4. Phases 1–3 made master_user_id inert for access and
-- stopped the client from choosing an owner; the column is provenance. This migration makes
-- the data say the same thing: every non-null master_user_id on the 15 tables that carry one
-- becomes company_owner_user_id(). Counted 2026-09-07 04:55 UTC: 176 rows (bid_proposal_rooms 2,
-- customers 1, estimates 7, jobs_receivables 2, people 18, people_labor_jobs 70, prospects 10,
-- team_prospect_roles 4, team_prospects 62) held by an estimator, an assistant and a dev — and
-- every master_user_id FK is ON DELETE CASCADE, so those rows would have vanished with the
-- account that filed them.
--
-- 1) The two owner-equality guards on developments that Phase 1 (20260906190000) missed
--    become no-ops, like their job/project/customer/GC siblings.
-- 2) The backfill runs per table with USER triggers paused: no updated_at bump, no
--    'owner' field_edited job_activity_events row per job, no customer → projects / jobs
--    cascade, no accepted-estimate immutability refusal (the signed content —
--    line_items_snapshot / terms_snapshot / total_cents — is untouched; only the filing
--    account changes). Tables with nothing to repoint are not touched (no ALTER, no lock).
--    RI triggers are internal and stay on. Idempotent: a second run repoints 0 rows.
-- 3) The grant tables are marked RETIRED in their comments. They are NOT renamed yet:
--    ~52 SECURITY DEFINER functions still read master_assistants / master_shares inline
--    (SQL-language bodies resolve the name at call time), and sync_company_access_grants()
--    (v2.921) keeps them complete so those gates keep passing for every office user.
--    Renaming waits for the Phase 5 function sweep.
--
-- Rollback: provenance cannot be restored from this file (the previous holders are in the
-- 2026-09-07 count above and in the Phase 4 doc); the guards' previous bodies live in
-- 20260801100000_developments_on_jobs.sql.

-- 1) developments guards → no-op --------------------------------------------------------

CREATE OR REPLACE FUNCTION public.developments_gc_customer_master_match_fn()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  -- One company (v2.2984): a development may name any customer as its GC.
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.developments_gc_customer_master_match_fn() IS
  'No-op since v2.2984 (one company). Previously: the development''s default GC had to belong to the development master.';

CREATE OR REPLACE FUNCTION public.jobs_ledger_development_master_match_fn()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  -- One company (v2.2984): a job may sit in any development.
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.jobs_ledger_development_master_match_fn() IS
  'No-op since v2.2984 (one company). Previously: the job''s development had to belong to the job master.';

-- 2) backfill ---------------------------------------------------------------------------

DO $$
DECLARE
  v_owner uuid := public.company_owner_user_id();
  v_n integer;
  v_total integer := 0;
  t text;
BEGIN
  IF v_owner IS NULL THEN
    RAISE NOTICE 'one company backfill: company owner account unset (app_settings.company_owner_user_id) — nothing repointed';
    RETURN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.users u WHERE u.id = v_owner AND u.role IN ('master_technician', 'dev')) THEN
    RAISE EXCEPTION 'one company backfill: company owner % is not a leader/dev account', v_owner;
  END IF;

  FOREACH t IN ARRAY ARRAY[
    'customers', 'developments', 'projects', 'jobs_ledger', 'jobs_receivables', 'estimates',
    'bid_proposal_rooms', 'prospects', 'team_prospects', 'team_prospect_roles',
    'people', 'people_labor_jobs', 'labels', 'user_tag_org', 'workflow_templates'
  ] LOOP
    EXECUTE format('SELECT count(*) FROM public.%I WHERE master_user_id IS NOT NULL AND master_user_id <> $1', t)
      INTO v_n USING v_owner;
    IF v_n = 0 THEN
      CONTINUE;
    END IF;
    EXECUTE format('ALTER TABLE public.%I DISABLE TRIGGER USER', t);
    EXECUTE format('UPDATE public.%I SET master_user_id = $1 WHERE master_user_id IS NOT NULL AND master_user_id <> $1', t)
      USING v_owner;
    GET DIAGNOSTICS v_n = ROW_COUNT;
    EXECUTE format('ALTER TABLE public.%I ENABLE TRIGGER USER', t);
    v_total := v_total + v_n;
    RAISE NOTICE 'one company backfill: % row(s) repointed on %', v_n, t;
  END LOOP;
  RAISE NOTICE 'one company backfill: % row(s) repointed to %', v_total, v_owner;
END $$;

-- 3) provenance, in the catalog ----------------------------------------------------------

COMMENT ON TABLE public.master_assistants IS
  'RETIRED (v2.2984, one company): no policy or client reads this for access; filled only by sync_company_access_grants() so the ~52 RPC gates that still read it inline keep passing until the Phase 5 sweep, then renamed/dropped.';
COMMENT ON TABLE public.master_shares IS
  'RETIRED (v2.2984, one company): no policy or client reads this for access; filled only by sync_company_access_grants() until the Phase 5 sweep, then renamed/dropped.';
COMMENT ON COLUMN public.customers.master_user_id IS
  'Provenance only (one company, v2.2984): the account the row was filed under — company_owner_user_id() for every row since the backfill. Never an access wall.';
COMMENT ON COLUMN public.projects.master_user_id IS
  'Provenance only (one company, v2.2984): the account the row was filed under. Never an access wall.';
COMMENT ON COLUMN public.jobs_ledger.master_user_id IS
  'Provenance only (one company, v2.2984): the account the row was filed under. Never an access wall; jobs_ledger_*_master_match triggers are no-ops.';
COMMENT ON COLUMN public.estimates.master_user_id IS
  'Provenance only (one company, v2.2984): the account the row was filed under. Never an access wall.';
COMMENT ON COLUMN public.prospects.master_user_id IS
  'Provenance only (one company, v2.2984): the account the row was filed under. Never an access wall.';
COMMENT ON COLUMN public.people.master_user_id IS
  'Provenance only (one company, v2.2984): the account the roster row was filed under. Never an access wall.';
