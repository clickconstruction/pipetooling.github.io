-- Phase 0 — Pay / hours identity audit (person_name → people.id)
-- Run against linked DB or local replica when planning backfill.
-- See repo grep: person_name in supabase/migrations/*.sql for RPC/trigger history.

-- ---------------------------------------------------------------------------
-- Inventory (maintenance): SQL files that reference pay/hours person_name
-- (non-exhaustive; re-grep as needed):
--   Core: 20260213000001_create_people_pay_config.sql
--         20260213000002_create_people_hours.sql
--   Clock approve/revoke/sync crew: 20260422120000_approve_clock_sessions_crew_jobs.sql
--         20260423120000_people_crew_bids.sql (approve/revoke + sync_crew_bids)
--         20260427120000_fix_approve_clock_sessions_cs_scope.sql (current approve_clock_sessions body)
--   Team leader / split / salary: 20260330160000_team_leader_approve_revoke_rpcs.sql
--         20260402050631_salary_split_preserve_origin_eod_force_close.sql,
--         20270403180000_salary_split_indexed_segments_overlap_sync_guard.sql, …
--   NCNS / attendance: 20260416154325_ncns_when_scheduled_no_clock.sql,
--         20260331232529_ncns_reject_day_sessions.sql, …
--   Pay stubs / offsets: 20260314000000_create_pay_stubs.sql,
--         20260315000000_create_pay_stub_days.sql, 20260331020000_create_person_offsets.sql
--   Tags / order / teams / crew rows: 20260219250000_create_people_cost_matrix_tags.sql,
--         20260213000007_create_people_hours_display_order.sql,
--         20260213000003_create_people_teams.sql,
--         20260231000020_create_people_crew_jobs.sql, 20260423120000_people_crew_bids.sql
--   Hours reviewed: 20260701000000_create_hours_reviewed.sql
--   RLS self-read pay config: 20270331160000_users_read_own_people_pay_config.sql
--   Edge/report copy: 20260430071645_recurring_job_report_include_costs.sql
-- ---------------------------------------------------------------------------

-- people_pay_config.person_name: no matching archived=false people row (trim name)
SELECT ppc.person_name AS pay_config_name
FROM public.people_pay_config ppc
WHERE NOT EXISTS (
  SELECT 1
  FROM public.people p
  WHERE p.archived_at IS NULL
    AND btrim(p.name) = btrim(ppc.person_name)
);

-- people_pay_config.person_name: multiple people rows share same trimmed name (active)
SELECT btrim(ppc.person_name) AS name_key, COUNT(DISTINCT p.id) AS people_count
FROM public.people_pay_config ppc
JOIN public.people p
  ON p.archived_at IS NULL
 AND btrim(p.name) = btrim(ppc.person_name)
GROUP BY btrim(ppc.person_name)
HAVING COUNT(DISTINCT p.id) > 1;

-- people_hours: rows whose person_name does not match exactly one active people row
SELECT ph.person_name, ph.work_date, COUNT(DISTINCT p.id) AS people_count
FROM public.people_hours ph
LEFT JOIN public.people p
  ON p.archived_at IS NULL
 AND btrim(p.name) = btrim(ph.person_name)
GROUP BY ph.person_name, ph.work_date
HAVING COUNT(DISTINCT CASE WHEN p.id IS NOT NULL THEN p.id END) <> 1;

-- people_names duplicated on roster (active): blocks naive FK backfill
SELECT btrim(name) AS name_key, COUNT(*) AS n
FROM public.people
WHERE archived_at IS NULL
GROUP BY btrim(name)
HAVING COUNT(*) > 1;
