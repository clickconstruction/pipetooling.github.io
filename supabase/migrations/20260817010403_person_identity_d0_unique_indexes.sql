SET lock_timeout = '3s';

-- Phase D0 of docs/PERSON_IDENTITY_PLAN.md: block duplicate-identity creation
-- at the DB instead of by periodic audit (the "Kyle" class).
--
-- The baseline already carries unique person_id indexes on people_pay_config,
-- people_hours, people_hours_display_order, people_team_members and
-- hours_reviewed (shipped with Phase B). These three were the gaps.
--
-- Preflight (2026-08-16, prod): zero duplicate (person_id, work_date) keys on
-- both crew tables; zero duplicate active roster names case-insensitively.

CREATE UNIQUE INDEX IF NOT EXISTS people_crew_jobs_person_id_work_date_uniq
  ON public.people_crew_jobs (person_id, work_date)
  WHERE person_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS people_crew_bids_person_id_work_date_uniq
  ON public.people_crew_bids (person_id, work_date)
  WHERE person_id IS NOT NULL;

-- Two ACTIVE people may not share a (case-insensitive, trimmed) name; the
-- name-keyed joins would treat them as one identity. Same-named archived rows
-- stay allowed — Combine people archives duplicates rather than deleting them.
CREATE UNIQUE INDEX IF NOT EXISTS people_active_name_uniq
  ON public.people (lower(btrim(name)))
  WHERE archived_at IS NULL;
