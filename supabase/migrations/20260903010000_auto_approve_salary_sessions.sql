SET lock_timeout = '3s';

-- Auto-approve salary-schedule clock sessions (v2.2670).
--
-- Salaried users get clock_sessions rows MATERIALIZED BY THE SYSTEM
-- (origin = 'salary_schedule', see salary_sync_one_user_clock_sessions and
-- docs/SALARY_CLOCK_SESSIONS.md). Those rows still waited on a human to
-- approve them, and when approvals stall (Aug 2026: company-wide approvals
-- stopped for 3 weeks) the system-generated rows pile up alongside real
-- punches, starving people_hours and the People → Overhead pool.
--
-- This function approves closed salary_schedule sessions with the SAME write
-- semantics as approve_clock_sessions (incremental people_hours upsert +
-- crew-job/bid sync), and a pg_cron job runs it every 30 minutes. Differences
-- from the interactive RPC, on purpose:
--   - no per-caller permission walk: callable only by pg_cron (auth.uid() IS
--     NULL) or a dev running it by hand;
--   - a bad row (blank user name, non-positive hours) SKIPS instead of
--     aborting the batch;
--   - approved_by / entered_by stay NULL — "approved by the system", and a
--     human's earlier entered_by on the people_hours day is never clobbered;
--   - 2-hour settle buffer after clock-out so the salary sync (which may
--     still close/adjust rows at template end) always wins;
--   - kill switch: app_settings key 'auto_approve_salary_sessions_disabled_v1'
--     with value_text '1' disables the run without unscheduling the cron.
--
-- Post-approval edits are unaffected: My Time / Adjust-times edits on approved
-- sessions already resync through recompute_people_hours_after_session_edit.

CREATE OR REPLACE FUNCTION public.auto_approve_salary_clock_sessions()
RETURNS TABLE(approved_count integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_approved int := 0;
  v_session RECORD;
  v_hours numeric;
  v_disabled text;
BEGIN
  IF auth.uid() IS NOT NULL AND NOT public.is_dev() THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  SELECT value_text INTO v_disabled
  FROM public.app_settings
  WHERE key = 'auto_approve_salary_sessions_disabled_v1';
  IF v_disabled = '1' THEN
    RETURN QUERY SELECT 0;
    RETURN;
  END IF;

  FOR v_session IN
    SELECT cs.id, cs.user_id, cs.clocked_in_at, cs.clocked_out_at, cs.work_date,
           trim(u.name) AS person_name, cs.job_ledger_id, cs.bid_id
    FROM public.clock_sessions cs
    JOIN public.users u ON u.id = cs.user_id
    WHERE cs.origin = 'salary_schedule'
      AND cs.clocked_out_at IS NOT NULL
      AND cs.clocked_out_at <= now() - interval '2 hours'
      AND cs.approved_at IS NULL
      AND cs.rejected_at IS NULL
      AND cs.revoked_at IS NULL
    ORDER BY cs.clocked_in_at
  LOOP
    IF v_session.person_name IS NULL OR v_session.person_name = '' THEN
      CONTINUE;
    END IF;

    v_hours := EXTRACT(EPOCH FROM (v_session.clocked_out_at - v_session.clocked_in_at)) / 3600.0;
    IF v_hours <= 0 THEN
      CONTINUE;
    END IF;

    -- Same incremental merge approve_clock_sessions does (+hours on the day),
    -- minus the entered_by clobber: an existing human attribution stays.
    INSERT INTO public.people_hours (person_name, work_date, hours, entered_by, person_id)
    VALUES (
      v_session.person_name,
      v_session.work_date,
      v_hours,
      NULL,
      public.resolve_pay_person_id_from_clock_user(v_session.user_id, v_session.person_name)
    )
    ON CONFLICT (person_name, work_date) DO UPDATE SET
      hours = public.people_hours.hours + EXCLUDED.hours,
      person_id = COALESCE(public.people_hours.person_id, EXCLUDED.person_id);

    -- Re-check the flags in the UPDATE itself: if an interactive approval (or
    -- reject/revoke) landed since our snapshot, back the hours increment out
    -- and leave the row to its human.
    UPDATE public.clock_sessions
    SET approved_at = now(),
        approved_by = NULL,
        revoked_at = NULL,
        revoked_by = NULL
    WHERE id = v_session.id
      AND approved_at IS NULL
      AND rejected_at IS NULL
      AND revoked_at IS NULL;

    IF NOT FOUND THEN
      UPDATE public.people_hours
      SET hours = hours - v_hours
      WHERE person_name = v_session.person_name
        AND work_date = v_session.work_date;
      CONTINUE;
    END IF;

    v_approved := v_approved + 1;

    IF v_session.job_ledger_id IS NOT NULL THEN
      PERFORM public.sync_crew_jobs_from_clock(v_session.person_name, v_session.work_date);
    END IF;
    IF v_session.bid_id IS NOT NULL THEN
      PERFORM public.sync_crew_bids_from_clock(v_session.person_name, v_session.work_date);
    END IF;
  END LOOP;

  RETURN QUERY SELECT v_approved;
END;
$$;

COMMENT ON FUNCTION public.auto_approve_salary_clock_sessions() IS
  'Approve closed salary_schedule clock sessions (system-materialized rows) with approve_clock_sessions'' write semantics. Cron-driven; dev may run by hand. Kill switch: app_settings auto_approve_salary_sessions_disabled_v1 = ''1''.';

GRANT EXECUTE ON FUNCTION public.auto_approve_salary_clock_sessions() TO authenticated;

-- Every 30 minutes; reschedule idempotently.
SELECT cron.unschedule('auto-approve-salary-sessions')
WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'auto-approve-salary-sessions'
);

SELECT cron.schedule(
  'auto-approve-salary-sessions',
  '*/30 * * * *',
  $cmd$SELECT public.auto_approve_salary_clock_sessions();$cmd$
);
