-- Freeze crew-lead inheritance into concrete rows so the inherit feature can
-- be removed without losing historical attribution.
--
-- Every consumer of people_crew_jobs / people_crew_bids resolves
--   row.crew_lead_person_name ? leadRow.assignments : row.assignments
-- (see getEffectiveAssignments in src/utils/teamLabor.ts and the parallel
-- resolutions in src/pages/People.tsx, src/lib/draftPayrollPersonBreakdown.ts,
-- src/lib/payReportAssignmentsBreakdown.ts, etc.).
--
-- Copying the lead's same-date array into each follower's row and clearing
-- crew_lead_person_name is therefore lossless: every read returns the same
-- array before and after. Orphan followers (lead row missing that date)
-- resolve to [] via LEFT JOIN + COALESCE, which matches the
-- `leadRow?.job_assignments ?? []` fallback in the read-time helper.
--
-- Pre-flight audit on 2026-05-16:
--   people_crew_jobs : 116 followers / 789 leads (42 orphans) span 2026-02-02..2026-04-24
--   people_crew_bids : 29  followers / 139 leads (7  orphans) span 2026-03-23..2026-04-24

BEGIN;

-- Insurance: snapshot original follower rows before mutating.
-- These backup tables let us audit / reconstruct the lead linkage if anything
-- looks off, and are dropped in the future column-drop migration.
CREATE TABLE IF NOT EXISTS public._freeze_crew_lead_jobs_backup AS
SELECT work_date, person_name, crew_lead_person_name, job_assignments,
       now() AS captured_at
FROM public.people_crew_jobs WHERE crew_lead_person_name IS NOT NULL;

CREATE TABLE IF NOT EXISTS public._freeze_crew_lead_bids_backup AS
SELECT work_date, person_name, crew_lead_person_name, bid_assignments,
       now() AS captured_at
FROM public.people_crew_bids WHERE crew_lead_person_name IS NOT NULL;

-- Jobs: copy lead's array into follower row, null out the link.
-- LEFT JOIN handles orphan followers -> COALESCE to '[]'::jsonb (same as the
-- read-time `leadRow?.job_assignments ?? []` fallback).
WITH followers AS (
  SELECT work_date, person_name, crew_lead_person_name
  FROM public.people_crew_jobs WHERE crew_lead_person_name IS NOT NULL
),
leads AS (
  SELECT work_date, person_name, job_assignments
  FROM public.people_crew_jobs WHERE crew_lead_person_name IS NULL
)
UPDATE public.people_crew_jobs t
SET job_assignments       = COALESCE(l.job_assignments, '[]'::jsonb),
    crew_lead_person_name = NULL
FROM followers f
LEFT JOIN leads l ON l.work_date = f.work_date AND l.person_name = f.crew_lead_person_name
WHERE t.work_date = f.work_date AND t.person_name = f.person_name;

-- Bids: same shape with bid_assignments.
WITH followers AS (
  SELECT work_date, person_name, crew_lead_person_name
  FROM public.people_crew_bids WHERE crew_lead_person_name IS NOT NULL
),
leads AS (
  SELECT work_date, person_name, bid_assignments
  FROM public.people_crew_bids WHERE crew_lead_person_name IS NULL
)
UPDATE public.people_crew_bids t
SET bid_assignments       = COALESCE(l.bid_assignments, '[]'::jsonb),
    crew_lead_person_name = NULL
FROM followers f
LEFT JOIN leads l ON l.work_date = f.work_date AND l.person_name = f.crew_lead_person_name
WHERE t.work_date = f.work_date AND t.person_name = f.person_name;

-- Hard verify: nothing left to freeze. If this fires, the transaction rolls
-- back automatically and the backup tables remain (they were created earlier
-- inside the same transaction; CREATE TABLE IF NOT EXISTS rolls back too).
DO $$
DECLARE
  n_jobs int;
  n_bids int;
BEGIN
  SELECT COUNT(*) INTO n_jobs FROM public.people_crew_jobs WHERE crew_lead_person_name IS NOT NULL;
  SELECT COUNT(*) INTO n_bids FROM public.people_crew_bids WHERE crew_lead_person_name IS NOT NULL;
  RAISE NOTICE 'freeze_crew_lead_inheritance: remaining followers -> jobs=%, bids=%', n_jobs, n_bids;
  IF n_jobs > 0 OR n_bids > 0 THEN
    RAISE EXCEPTION 'freeze_crew_lead_inheritance: % job and % bid followers remain after update', n_jobs, n_bids;
  END IF;
END $$;

-- Deprecate the column in metadata. The column itself stays for now so the
-- existing readers / writers in the app code do not break; a follow-up
-- migration drops the column once the app code stops reading it.
COMMENT ON COLUMN public.people_crew_jobs.crew_lead_person_name IS
  'Deprecated; inheritance was frozen by migration 20260516154601_freeze_crew_lead_inheritance. Every follower row now carries its own job_assignments and this column is always NULL. Kept temporarily so existing readers / writers do not break; will be dropped in a follow-up migration once removed from app code.';
COMMENT ON COLUMN public.people_crew_bids.crew_lead_person_name IS
  'Deprecated; inheritance was frozen by migration 20260516154601_freeze_crew_lead_inheritance. Every follower row now carries its own bid_assignments and this column is always NULL. Kept temporarily so existing readers / writers do not break; will be dropped in a follow-up migration once removed from app code.';

COMMIT;
