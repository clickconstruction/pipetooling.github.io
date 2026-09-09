SET lock_timeout = '3s';

-- v2.3199 (crew-day sync: upsert by person, not by name).
--
-- Bug: sync_crew_jobs_from_clock (last defined in 20260909022534) keys its
-- people_crew_jobs upsert on the primary key (work_date, person_name), where
-- person_name is the clock user's users.name. But a crew row can also exist
-- under the roster name (people.name) with the same person_id — e.g. user
-- "Zack" ↔ roster "Zach W". The partial unique index
-- people_crew_jobs_person_id_work_date_uniq (person_id, work_date) then
-- rejects the insert:
--   duplicate key value violates unique constraint "people_crew_jobs_person_id_work_date_uniq"
-- and every clock-session change for that person-day fails — approving,
-- editing, or moving a session to another job (surfaced 2026-09-09 by the first
-- cost batch, which repoints 77 sessions; 12 of them were this person).
--
-- Root cause: two resolvers disagree. The function resolved the person with
-- resolve_pay_person_id_from_clock_user(NULL, name), which matches people.name
-- only and returns NULL for a login name; the table's BEFORE INSERT trigger
-- (pay_tables_set_person_id) resolves with resolve_pay_person_id(name), which
-- also matches users.name → people.account_user_id and finds the person. So
-- the function inserted "no person", the trigger stamped the real person_id,
-- and the partial unique index refused the duplicate.
--
-- Fix: resolve the person the way the insert trigger will (COALESCE of both
-- resolvers); when it resolves, update the existing (person_id, work_date) row
-- whatever its name, and delete by person_id too. Only when no such row exists
-- does the by-name upsert run. Body otherwise verbatim from 20260909022534.
-- Additive, idempotent (CREATE OR REPLACE); no trigger or grant changes.

CREATE OR REPLACE FUNCTION public.sync_crew_jobs_from_clock(p_person_name text, p_work_date date)
RETURNS void
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
DECLARE
  v_row RECORD;
  v_total_hours numeric := 0;   -- job + bid sessions (shared denominator)
  v_job_hours numeric := 0;     -- job sessions only (this bucket)
  v_job_share_pct numeric := 0; -- the bucket's share of the day, to 0.1
  v_job_assignments jsonb := '[]'::jsonb;
  v_pct numeric;
  v_sum_pct numeric := 0;
  v_idx int := 0;
  v_cnt int := 0;
  v_person_id uuid;
BEGIN
  -- v2.3199: resolve the person the same way the table's BEFORE INSERT trigger
  -- (pay_tables_set_person_id → resolve_pay_person_id) will, so the pre-update
  -- below targets exactly the row an insert would collide with. The clock-user
  -- resolver alone returned NULL for a login name that differs from the roster
  -- name, which is what let the by-name upsert reach the unique index.
  v_person_id := COALESCE(
    public.resolve_pay_person_id_from_clock_user(NULL, p_person_name),
    public.resolve_pay_person_id(p_person_name));

  -- Recorded sessions: not rejected, not revoked; approval not required
  -- (v2.3179). An open session runs to now() — floored at one minute so a
  -- fresh clock-in still lands its job at 100% instead of tripping the
  -- "nothing here" delete below.
  SELECT
    COALESCE(SUM(GREATEST(EXTRACT(EPOCH FROM (COALESCE(cs.clocked_out_at, now()) - cs.clocked_in_at)) / 3600.0, 1.0 / 60.0)), 0),
    COALESCE(SUM(CASE WHEN cs.job_ledger_id IS NOT NULL
                      THEN GREATEST(EXTRACT(EPOCH FROM (COALESCE(cs.clocked_out_at, now()) - cs.clocked_in_at)) / 3600.0, 1.0 / 60.0)
                      ELSE 0 END), 0),
    COUNT(DISTINCT cs.job_ledger_id) FILTER (WHERE cs.job_ledger_id IS NOT NULL)
  INTO v_total_hours, v_job_hours, v_cnt
  FROM public.clock_sessions cs
  JOIN public.users u ON u.id = cs.user_id
  WHERE trim(u.name) = p_person_name
    AND cs.work_date = p_work_date
    AND cs.rejected_at IS NULL
    AND cs.revoked_at IS NULL
    AND (cs.job_ledger_id IS NOT NULL OR cs.bid_id IS NOT NULL);

  IF v_total_hours <= 0 OR v_job_hours <= 0 OR v_cnt = 0 THEN
    -- v2.3199: the person's row may carry the roster name rather than the
    -- clock user's name — delete by person_id as well.
    DELETE FROM public.people_crew_jobs
    WHERE work_date = p_work_date
      AND (person_name = p_person_name
           OR (v_person_id IS NOT NULL AND person_id = v_person_id));
    RETURN;
  END IF;

  v_job_share_pct := ROUND((v_job_hours / v_total_hours) * 1000) / 10;

  FOR v_row IN
    SELECT cs.job_ledger_id,
           SUM(GREATEST(EXTRACT(EPOCH FROM (COALESCE(cs.clocked_out_at, now()) - cs.clocked_in_at)) / 3600.0, 1.0 / 60.0)) AS hours
    FROM public.clock_sessions cs
    JOIN public.users u ON u.id = cs.user_id
    WHERE trim(u.name) = p_person_name
      AND cs.work_date = p_work_date
      AND cs.rejected_at IS NULL
      AND cs.revoked_at IS NULL
      AND cs.job_ledger_id IS NOT NULL
    GROUP BY cs.job_ledger_id
    ORDER BY cs.job_ledger_id
  LOOP
    v_idx := v_idx + 1;
    IF v_idx < v_cnt THEN
      v_pct := ROUND((v_row.hours / v_total_hours) * 1000) / 10;
      v_sum_pct := v_sum_pct + v_pct;
    ELSE
      -- Last job takes the bucket's remainder so the job pcts sum to exactly
      -- the job share (100 on a job-only day, as before).
      v_pct := v_job_share_pct - v_sum_pct;
    END IF;
    v_job_assignments := v_job_assignments || jsonb_build_array(
      jsonb_build_object('job_id', v_row.job_ledger_id, 'pct', v_pct)
    );
  END LOOP;

  -- v2.3199: a row for this person-day may already exist under the roster
  -- name (people.name) rather than the clock user's name. The partial unique
  -- index on (person_id, work_date) would reject a second row, so update the
  -- existing one in place — its name stays as the roster wrote it.
  IF v_person_id IS NOT NULL THEN
    UPDATE public.people_crew_jobs
    SET crew_lead_person_name = NULL,
        job_assignments = v_job_assignments
    WHERE person_id = v_person_id AND work_date = p_work_date;
    IF FOUND THEN
      RETURN;
    END IF;
  END IF;

  INSERT INTO public.people_crew_jobs (work_date, person_name, crew_lead_person_name, job_assignments, person_id)
  VALUES (p_work_date, p_person_name, NULL, v_job_assignments, v_person_id)
  ON CONFLICT (work_date, person_name) DO UPDATE SET
    crew_lead_person_name = NULL,
    job_assignments = EXCLUDED.job_assignments,
    person_id = COALESCE(public.people_crew_jobs.person_id, EXCLUDED.person_id);
END;
$function$;

COMMENT ON FUNCTION public.sync_crew_jobs_from_clock(text, date) IS
  'Rebuilds the people_crew_jobs row for one person-day from recorded clock sessions (v2.3179). v2.3199: updates the existing (person_id, work_date) row whatever its name before falling back to the by-name upsert, and deletes by person_id too.';
