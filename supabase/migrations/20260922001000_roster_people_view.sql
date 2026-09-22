SET lock_timeout = '3s';

-- v2.3698 — People spine, PR 1: one roster view, and the salary jobs stop for archived accounts.
--
-- Who is a person has been a question every roster, picker, pay list and email fan-out answered
-- for itself (archived_at, is_digital_twin, is_sample, role = 'dev', in every combination), and
-- the pay lists answered it wrong: they took every people_pay_config row minus the archived
-- *account names*, so a sample or a test account with a Salary-ticked pay row was credited 40 h a
-- week in the Hours grid, Draft Payroll, the Earlier-weeks scan and the team labor total (the
-- Training Helper, 2026-09-21). This view is the one answer. It joins the two halves of a person
-- (the login `users` row and the roster `people` row) and exposes the classification flags plus
-- two rollups every reader can take as-is:
--   is_pay_roster    — a real person (not a twin, not a sample) with neither half archived
--   is_active_roster — is_pay_roster and not a dev (the crew-picker rule in activeRoster.ts)
-- Ids are wrapped in CASE (the v2.2995 trick) so PostgREST does not relate every users / people
-- FK through the view and the generated types keep their shape. The view runs with its owner's
-- rights so every viewer gets the same roster (the Hours grid must not differ by viewer — J7-6);
-- it carries names, roles, kinds, flags and employment dates only — no email, phone, notes or
-- sign-in times, which stay behind the users / people row policies.
--
-- Second half: the salary machinery ignored archived_at. `salary_sync_one_user_clock_sessions`
-- kept materializing schedule sessions for a departed salaried person as long as a template row
-- survived, and the 30-minute `auto_approve_salary_clock_sessions` cron approved them into
-- people_hours. Both now stop at the archived stamp: the sync deletes the day's unapproved auto
-- sessions and returns, the daily loop skips archived users, the cron skips their sessions.
-- Each function is rewritten from its NEWEST definition (baseline for the two sync functions,
-- 20260903010000 for the cron) — see docs/recent-features/v2.3683.md for why that matters.
--
-- Idempotent: CREATE OR REPLACE throughout; no CREATE TABLE, so no read-only block re-apply.

CREATE OR REPLACE VIEW public.roster_people AS
  SELECT
    (CASE WHEN u.id IS NOT NULL THEN u.id END)                        AS user_id,
    (CASE WHEN p.id IS NOT NULL THEN p.id END)                        AS person_id,
    COALESCE('u:' || u.id::text, 'p:' || p.id::text)                  AS row_key,
    COALESCE(NULLIF(btrim(u.name), ''), btrim(p.name))                AS pay_name,
    NULLIF(btrim(u.name), '')                                         AS account_name,
    btrim(p.name)                                                     AS roster_name,
    u.role::text                                                      AS role,
    COALESCE(
      p.kind,
      CASE u.role::text
        WHEN 'helpers' THEN 'helper'
        WHEN 'subcontractor' THEN 'sub'
        ELSE u.role::text
      END
    )                                                                 AS kind,
    CASE
      WHEN u.is_digital_twin THEN 'twin'
      WHEN u.is_sample THEN 'sample'
      WHEN u.id IS NULL THEN 'external'
      ELSE 'person'
    END                                                               AS account_kind,
    COALESCE(u.is_digital_twin, false)                                AS is_digital_twin,
    COALESCE(u.is_sample, false)                                      AS is_sample,
    (u.role::text = 'dev')                                            AS is_dev,
    COALESCE(u.read_only, false)                                      AS read_only,
    COALESCE(u.needs_supervision, false)                              AS needs_supervision,
    u.archived_at                                                     AS user_archived_at,
    p.archived_at                                                     AS person_archived_at,
    (u.archived_at IS NOT NULL OR p.archived_at IS NOT NULL)          AS is_archived,
    (
      NOT COALESCE(u.is_digital_twin, false)
      AND NOT COALESCE(u.is_sample, false)
      AND u.archived_at IS NULL
      AND p.archived_at IS NULL
    )                                                                 AS is_pay_roster,
    (
      NOT COALESCE(u.is_digital_twin, false)
      AND NOT COALESCE(u.is_sample, false)
      AND u.archived_at IS NULL
      AND p.archived_at IS NULL
      AND (u.role IS NULL OR u.role::text <> 'dev')
    )                                                                 AS is_active_roster,
    (u.id IS NOT NULL)                                                AS has_login,
    (p.id IS NOT NULL)                                                AS has_roster_row,
    p.start_date                                                      AS start_date,
    p.end_date                                                        AS end_date,
    p.master_user_id                                                  AS master_user_id
  FROM public.users u
  FULL OUTER JOIN public.people p ON p.account_user_id = u.id
  WHERE (SELECT auth.uid()) IS NOT NULL
    AND COALESCE(NULLIF(btrim(u.name), ''), NULLIF(btrim(p.name), '')) IS NOT NULL;

COMMENT ON VIEW public.roster_people IS
  'People spine (v2.3698): one row per person — the users row, the people row, or the linked pair (people.account_user_id). Flags say what the row is (account_kind person | external | sample | twin, is_archived, is_dev); is_pay_roster / is_active_roster are the rollups pay lists and crew pickers take as-is. Owner rights: every signed-in viewer sees the same roster. Names, roles, kinds and dates only. Ids CASE-wrapped (v2.2995) so PostgREST does not relate users / people FKs through it.';

REVOKE ALL ON public.roster_people FROM PUBLIC, anon;
GRANT SELECT ON public.roster_people TO authenticated, service_role;

-- ---------------------------------------------------------------------------------------------
-- Salary machinery: archived accounts get nothing materialized and nothing approved.
-- ---------------------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION "public"."salary_sync_one_user_clock_sessions"("p_user_id" "uuid", "p_work_date" "date", "p_now" timestamp with time zone) RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
-- Half-open semantics: each template slot is [t_open, t_close); clocked_out_at stores the
-- exclusive end instant. Approved-but-open rows are still closed at t_end (approval does not
-- pin a session past the template end). Rejected / revoked rows are never modified.
DECLARE
  r_t record;
  r_o record;
  tz text;
  v_mode text;
  sa_time time;
  sa_dur int;
  sb_time time;
  sb_dur int;
  v_use_split_focus boolean;
  jl_a uuid;
  bid_a uuid;
  jl_b uuid;
  bid_b uuid;
  t_start timestamptz;
  t_end timestamptz;
  t_start2 timestamptz;
  t_end2 timestamptz;
  cs record;
  v_override_meaningful boolean;
BEGIN
  -- People spine (v2.3698): an archived account is out of every roster, so nothing is
  -- materialized for it — and any unapproved auto session already minted for the day goes.
  IF EXISTS (SELECT 1 FROM public.users WHERE id = p_user_id AND archived_at IS NOT NULL) THEN
    DELETE FROM public.clock_sessions
    WHERE user_id = p_user_id
      AND work_date = p_work_date
      AND origin = 'salary_schedule'
      AND approved_at IS NULL
      AND rejected_at IS NULL
      AND revoked_at IS NULL;
    RETURN;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.user_time_off
    WHERE user_id = p_user_id
      AND p_work_date >= start_date
      AND p_work_date <= end_date
  ) THEN
    DELETE FROM public.clock_sessions
    WHERE user_id = p_user_id
      AND work_date = p_work_date
      AND origin = 'salary_schedule'
      AND approved_at IS NULL
      AND rejected_at IS NULL
      AND revoked_at IS NULL;
    RETURN;
  END IF;

  SELECT * INTO r_t FROM public.salary_work_schedule_templates WHERE user_id = p_user_id;
  IF NOT FOUND THEN
    DELETE FROM public.clock_sessions
    WHERE user_id = p_user_id
      AND work_date = p_work_date
      AND origin = 'salary_schedule'
      AND approved_at IS NULL
      AND rejected_at IS NULL
      AND revoked_at IS NULL;
    RETURN;
  END IF;

  SELECT * INTO r_o
  FROM public.salary_work_schedule_day_overrides
  WHERE user_id = p_user_id AND work_date = p_work_date;

  v_override_meaningful := FOUND AND (r_o.mode IS NOT NULL OR r_o.segment_a_start_local IS NOT NULL);

  IF r_t.exclude_weekends
     AND NOT v_override_meaningful
     AND to_char(p_work_date, 'ID')::int IN (6, 7) THEN
    DELETE FROM public.clock_sessions
    WHERE user_id = p_user_id
      AND work_date = p_work_date
      AND origin = 'salary_schedule'
      AND approved_at IS NULL
      AND rejected_at IS NULL
      AND revoked_at IS NULL;
    RETURN;
  END IF;

  tz := COALESCE(r_o.timezone, r_t.timezone, 'America/Chicago');
  v_mode := COALESCE(r_o.mode, r_t.mode);
  sa_time := COALESCE(r_o.segment_a_start_local, r_t.segment_a_start_local);
  sa_dur := COALESCE(r_o.segment_a_duration_minutes, r_t.segment_a_duration_minutes);
  sb_time := COALESCE(r_o.segment_b_start_local, r_t.segment_b_start_local);
  sb_dur := COALESCE(r_o.segment_b_duration_minutes, r_t.segment_b_duration_minutes);
  v_use_split_focus := COALESCE(r_o.use_split_focus, r_t.use_split_focus);
  jl_a := COALESCE(r_o.job_ledger_id, r_t.job_ledger_id);
  bid_a := COALESCE(r_o.bid_id, r_t.bid_id);
  jl_b := COALESCE(r_o.segment_b_job_ledger_id, r_t.segment_b_job_ledger_id);
  bid_b := COALESCE(r_o.segment_b_bid_id, r_t.segment_b_bid_id);

  IF v_mode = 'continuous' THEN
    t_start := (p_work_date::timestamp + sa_time) AT TIME ZONE tz;
    t_end := t_start + (sa_dur || ' minutes')::interval;

    -- Close any open indexed (segment_index 1..N from My Time splits) salary_schedule rows at
    -- t_end once past the block end. Includes approved-but-open rows; rejected / revoked unchanged.
    IF p_now >= t_end THEN
      UPDATE public.clock_sessions
      SET clocked_out_at = t_end
      WHERE user_id = p_user_id
        AND work_date = p_work_date
        AND origin = 'salary_schedule'
        AND salary_segment_index IS NOT NULL
        AND rejected_at IS NULL
        AND revoked_at IS NULL
        AND clocked_in_at < t_end
        AND clocked_out_at IS NULL;
    END IF;

    SELECT id, clocked_in_at, clocked_out_at, approved_at, rejected_at, revoked_at
    INTO cs
    FROM public.clock_sessions
    WHERE user_id = p_user_id
      AND work_date = p_work_date
      AND origin = 'salary_schedule'
      AND salary_segment_index IS NULL
    FOR UPDATE;

    IF FOUND THEN
      IF cs.rejected_at IS NOT NULL OR cs.revoked_at IS NOT NULL THEN
        RETURN;
      END IF;
      IF cs.clocked_out_at IS NULL AND p_now >= t_end THEN
        UPDATE public.clock_sessions
        SET clocked_out_at = t_end
        WHERE id = cs.id;
      END IF;
    ELSE
      IF NOT EXISTS (
        SELECT 1
        FROM public.clock_sessions
        WHERE user_id = p_user_id
          AND work_date = p_work_date
          AND origin = 'salary_schedule'
          AND salary_segment_index IS NOT NULL
          AND rejected_at IS NULL
          AND revoked_at IS NULL
      ) THEN
        IF p_now >= t_start AND p_now < t_end THEN
          INSERT INTO public.clock_sessions (
            user_id, clocked_in_at, clocked_out_at, work_date, notes,
            job_ledger_id, bid_id, origin, salary_segment_index
          ) VALUES (
            p_user_id, t_start, NULL, p_work_date, '',
            jl_a, bid_a, 'salary_schedule', NULL
          );
        ELSIF p_now >= t_end THEN
          INSERT INTO public.clock_sessions (
            user_id, clocked_in_at, clocked_out_at, work_date, notes,
            job_ledger_id, bid_id, origin, salary_segment_index
          ) VALUES (
            p_user_id, t_start, t_end, p_work_date, '',
            jl_a, bid_a, 'salary_schedule', NULL
          );
        END IF;
      END IF;
    END IF;
    RETURN;
  END IF;

  IF sb_time IS NULL OR sb_dur IS NULL THEN
    RETURN;
  END IF;

  t_start := (p_work_date::timestamp + sa_time) AT TIME ZONE tz;
  t_end := t_start + (sa_dur || ' minutes')::interval;
  t_start2 := (p_work_date::timestamp + sb_time) AT TIME ZONE tz;
  t_end2 := t_start2 + (sb_dur || ' minutes')::interval;

  -- Degenerate template: segment B starts at the same instant as A. Remap slot 2 to begin at A's t_end
  -- so the half-open overlap check on slot 1 cannot block slot 2's canonical INSERT.
  IF t_start2 = t_start THEN
    t_start2 := t_end;
    t_end2 := t_start2 + (sb_dur || ' minutes')::interval;
  END IF;

  SELECT id, clocked_in_at, clocked_out_at, approved_at, rejected_at, revoked_at
  INTO cs
  FROM public.clock_sessions
  WHERE user_id = p_user_id
    AND work_date = p_work_date
    AND origin = 'salary_schedule'
    AND salary_segment_index = 1
  FOR UPDATE;

  IF FOUND THEN
    IF cs.rejected_at IS NULL AND cs.revoked_at IS NULL THEN
      IF cs.clocked_out_at IS NULL AND p_now >= t_end THEN
        UPDATE public.clock_sessions SET clocked_out_at = t_end WHERE id = cs.id;
      END IF;
    END IF;
  ELSE
    IF NOT EXISTS (
      SELECT 1
      FROM public.clock_sessions sess
      WHERE sess.user_id = p_user_id
        AND sess.rejected_at IS NULL
        AND sess.revoked_at IS NULL
        AND sess.clocked_in_at < t_end
        AND t_start < COALESCE(sess.clocked_out_at, p_now)
        AND (
          sess.work_date = p_work_date
          OR (sess.clocked_in_at AT TIME ZONE tz)::date = p_work_date
        )
    ) THEN
      IF p_now >= t_start AND p_now < t_end THEN
        INSERT INTO public.clock_sessions (
          user_id, clocked_in_at, clocked_out_at, work_date, notes,
          job_ledger_id, bid_id, origin, salary_segment_index
        ) VALUES (
          p_user_id, t_start, NULL, p_work_date, '',
          jl_a, bid_a, 'salary_schedule', 1
        );
      ELSIF p_now >= t_end THEN
        INSERT INTO public.clock_sessions (
          user_id, clocked_in_at, clocked_out_at, work_date, notes,
          job_ledger_id, bid_id, origin, salary_segment_index
        ) VALUES (
          p_user_id, t_start, t_end, p_work_date, '',
          jl_a, bid_a, 'salary_schedule', 1
        );
      END IF;
    END IF;
  END IF;

  SELECT id, clocked_in_at, clocked_out_at, approved_at, rejected_at, revoked_at
  INTO cs
  FROM public.clock_sessions
  WHERE user_id = p_user_id
    AND work_date = p_work_date
    AND origin = 'salary_schedule'
    AND salary_segment_index = 2
  FOR UPDATE;

  IF FOUND THEN
    IF cs.rejected_at IS NULL AND cs.revoked_at IS NULL THEN
      IF cs.clocked_out_at IS NULL AND p_now >= t_end2 THEN
        UPDATE public.clock_sessions SET clocked_out_at = t_end2 WHERE id = cs.id;
      END IF;
    END IF;
  ELSE
    IF NOT EXISTS (
      SELECT 1
      FROM public.clock_sessions sess
      WHERE sess.user_id = p_user_id
        AND sess.rejected_at IS NULL
        AND sess.revoked_at IS NULL
        AND sess.clocked_in_at < t_end2
        AND t_start2 < COALESCE(sess.clocked_out_at, p_now)
        AND (
          sess.work_date = p_work_date
          OR (sess.clocked_in_at AT TIME ZONE tz)::date = p_work_date
        )
    ) THEN
      IF p_now >= t_start2 AND p_now < t_end2 THEN
        INSERT INTO public.clock_sessions (
          user_id, clocked_in_at, clocked_out_at, work_date, notes,
          job_ledger_id, bid_id, origin, salary_segment_index
        ) VALUES (
          p_user_id, t_start2, NULL, p_work_date, '',
          CASE WHEN v_use_split_focus THEN jl_b ELSE jl_a END,
          CASE WHEN v_use_split_focus THEN bid_b ELSE bid_a END,
          'salary_schedule', 2
        );
      ELSIF p_now >= t_end2 THEN
        INSERT INTO public.clock_sessions (
          user_id, clocked_in_at, clocked_out_at, work_date, notes,
          job_ledger_id, bid_id, origin, salary_segment_index
        ) VALUES (
          p_user_id, t_start2, t_end2, p_work_date, '',
          CASE WHEN v_use_split_focus THEN jl_b ELSE jl_a END,
          CASE WHEN v_use_split_focus THEN bid_b ELSE bid_a END,
          'salary_schedule', 2
        );
      END IF;
    END IF;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION "public"."sync_salary_clock_sessions_for_day"("p_work_date" "date" DEFAULT NULL::"date") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  d date;
  r_user record;
BEGIN
  d := COALESCE(p_work_date, (timezone('America/Chicago', now()))::date);
  FOR r_user IN
    SELECT t.user_id
    FROM public.salary_work_schedule_templates t
    JOIN public.users u ON u.id = t.user_id
    WHERE u.archived_at IS NULL
  LOOP
    PERFORM public.salary_sync_one_user_clock_sessions(r_user.user_id, d - 1, now());
    PERFORM public.salary_sync_one_user_clock_sessions(r_user.user_id, d, now());
  END LOOP;
END;
$$;

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
      AND u.archived_at IS NULL
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

COMMENT ON FUNCTION public.salary_sync_one_user_clock_sessions(uuid, date, timestamptz) IS
  'Materialize one salaried user''s schedule sessions for one day (half-open slots; approved rows closed at the slot end; rejected / revoked never touched). Since v2.3698 an archived account gets nothing: the day''s unapproved auto sessions are deleted and the function returns.';

COMMENT ON FUNCTION public.sync_salary_clock_sessions_for_day(date) IS
  'Service role: sync all salary templates for d-1 and d (Chicago calendar anchor; default Chicago today). Since v2.3698 templates whose user is archived are skipped.';

COMMENT ON FUNCTION public.auto_approve_salary_clock_sessions() IS
  'Approve closed salary_schedule clock sessions (system-materialized rows) with approve_clock_sessions'' write semantics. Cron-driven; dev may run by hand. Kill switch: app_settings auto_approve_salary_sessions_disabled_v1 = ''1''. Since v2.3698 sessions of archived accounts are skipped.';
