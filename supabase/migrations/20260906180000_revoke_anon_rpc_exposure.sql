SET lock_timeout = '3s';

-- v2.2954 — Security hardening: the public anon key could read the jobs ledger.
--
-- Supabase grants EXECUTE on every new function to PUBLIC (and so to `anon`),
-- and the baseline dump re-granted it explicitly. A SECURITY DEFINER RPC runs
-- as its owner, so unless its BODY checks the caller, the anon key alone —
-- which ships inside the client bundle on GitHub Pages — gets the owner's view
-- of the data. Live-proved 2026-09-06 with only the anon key (no session):
--
--   get_jobs_ledger_by_status('paid')  → 714 rows: job name, address, revenue,
--                                        payments_made, Drive / plans links
--   search_jobs_ledger('')             → 50 jobs (name, address, trade)
--   search_bids_for_clock('')          → 50 bids (project, address, customer)
--   search_jobs_for_reports('')        → 53 rows
--   list_customer_review_job_hours()   → 98 rows (customer name, hours)
--   get_archived_user_names()          → 13 names
--   get_location_enabled_user_ids()    → 22 user ids
--   get_jobs_ledger_office()           → 1 row
--   next_job_number_suggestion()       → the next job number
--   debug_cost_estimate_policies()     → the policy definitions
--
-- Compare search_estimates_for_nav, which gates on auth inside the body and
-- returns nothing to anon — that is the shape every future RPC should have.
--
-- Fix, following the 20260730160048 (Stripe webhook RPCs) precedent: REVOKE
-- EXECUTE from PUBLIC and anon on every RPC that reads or writes prod data
-- without an in-body caller check. Callers are all signed-in surfaces
-- (Clock In picker, header search, Dashboard billing, People, Materials,
-- Tally, reports) — repo-wide audit of src/ and supabase/functions/ found no
-- public page, no edge function, and no anon-role path using any of them.
-- `authenticated` and `service_role` keep EXECUTE (baseline grants), so the
-- app is unchanged for signed-in users.
--
-- Five functions have NO caller anywhere in the repo; those lose EXECUTE from
-- `authenticated` too, so a logged-in low-privilege role cannot reach a
-- SECURITY DEFINER writer that bypasses RLS. service_role keeps them.
--
-- REVOKE is idempotent. Every signature listed exists on prod (all live
-- overloads, including the two get_parts_ordered_by_price_count forms).
-- A signature that does not exist would abort the push — that is intended:
-- the file must describe prod, not guess at it.

-- ---------------------------------------------------------------------------
-- 1. Read RPCs with signed-in callers: anon off, authenticated unchanged.
-- ---------------------------------------------------------------------------
REVOKE EXECUTE ON FUNCTION public.search_jobs_ledger(text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.search_jobs_for_reports(text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.search_bids_for_clock(text, uuid, uuid[]) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_jobs_ledger_by_status(text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_jobs_ledger_office() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_jobs_ledger_by_ids(uuid[]) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_jobs_ledger_by_hcp_numbers(text[]) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_jobs_ledger_by_ids_paid_only(uuid[]) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_jobs_ledger_by_hcp_numbers_paid_only(text[]) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_bids_by_ids(uuid[]) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_projects_by_ids(uuid[]) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_archived_user_names() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_location_enabled_user_ids() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.list_customer_review_job_hours() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.next_job_number_suggestion() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_supply_house_stats_by_service_type() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_parts_ordered_by_price_count(boolean) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_parts_ordered_by_price_count(boolean, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_job_display_for_report(text, uuid) FROM PUBLIC, anon;
-- Gated only by a deny-list ("caller is not a helper/sub") — with no session
-- auth.uid() is NULL, the NOT EXISTS passes, and anon gets the office view.
REVOKE EXECUTE ON FUNCTION public.search_jobs_for_tally_mercury_assign(text) FROM PUBLIC, anon;
-- Nudge counters: pending label suggestions (with a dollar total) and pending
-- clock approvals (sessions / hours / people) answered the anon key.
REVOKE EXECUTE ON FUNCTION public.count_pending_accounting_label_suggestions(integer) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.count_pending_clock_session_approvals() FROM PUBLIC, anon;

-- ---------------------------------------------------------------------------
-- 2. Writer / allocator RPCs with signed-in callers (Tally → PO, work-order
--    record ids): anon off.
-- ---------------------------------------------------------------------------
REVOKE EXECUTE ON FUNCTION public.create_po_from_job_tally(uuid, jsonb) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.next_work_order_record_id(uuid) FROM PUBLIC, anon;

-- ---------------------------------------------------------------------------
-- 3. No caller in the repo (src/ or supabase/functions/): anon AND
--    authenticated off. service_role keeps EXECUTE for any manual use.
-- ---------------------------------------------------------------------------
REVOKE EXECUTE ON FUNCTION public.create_project_with_template(text, uuid, text, uuid, uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.duplicate_purchase_order(uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.copy_workflow_step(uuid, integer) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.create_takeoff_entry_with_items(uuid, text, jsonb, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.debug_cost_estimate_policies() FROM PUBLIC, anon, authenticated;

-- Grants to authenticated/service_role were made explicitly in the baseline
-- and later files, so revoking PUBLIC does not touch them. Re-assert the two
-- the app depends on for the overload that was only ever PUBLIC-granted.
GRANT EXECUTE ON FUNCTION public.get_parts_ordered_by_price_count(boolean) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_parts_ordered_by_price_count(boolean, uuid) TO authenticated, service_role;
