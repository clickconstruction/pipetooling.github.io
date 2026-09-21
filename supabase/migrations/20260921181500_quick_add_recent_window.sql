SET lock_timeout = '3s';

-- Quick time add, PR 6 (to-dos/quick-time-add, v2.3678): the after-midnight rule. "Today only"
-- meant a call that ran 11:54 pm – 12:04 am could not be added at 12:05 (its window starts
-- yesterday), nor could one that ended just before midnight — the sentence sent them to My Time.
-- Now: today on the company calendar, start and end, OR ended within the last two hours. The row
-- is dated by the day it started, like a punch, and the daily ceiling counts on that day.
-- add_quick_time() is re-created whole from 20260921174057 with that one block changed. No table
-- change. Idempotent.

CREATE OR REPLACE FUNCTION public.add_quick_time(p_minutes integer, p_note text, p_ended_at timestamptz DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid uuid := (SELECT auth.uid());
  v_user record;
  v_salary record;
  v_note text := btrim(COALESCE(p_note, ''));
  -- v2.3677: who gets the door is the owner's list on Settings → People & teams (app_settings
  -- quick_add_roles_v1, a comma list); missing or blank = the PR 1 default. The client reads the
  -- same row (parseQuickAddRoles), so the door and the refusal agree.
  v_roles text[] := COALESCE(
    (SELECT string_to_array(regexp_replace(NULLIF(btrim(a.value_text), ''), '\s', '', 'g'), ',')
       FROM public.app_settings a WHERE a.key = 'quick_add_roles_v1'),
    ARRAY['assistant', 'controller', 'estimator', 'dev']);
  v_end timestamptz := date_trunc('minute', COALESCE(p_ended_at, now()));
  v_start timestamptz;
  v_today date := public.app_today();
  v_work_date date;
  v_clash record;
  v_ceiling integer;
  v_day_total integer;
  v_office_job uuid;
  v_id uuid;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Sign in to add time.' USING ERRCODE = '42501';
  END IF;

  SELECT u.role::text AS role, u.read_only, u.is_digital_twin, u.archived_at INTO v_user FROM public.users u WHERE u.id = v_uid;
  IF NOT FOUND OR v_user.archived_at IS NOT NULL OR COALESCE(v_user.is_digital_twin, false)
     OR NOT (v_user.role = ANY (v_roles)) THEN
    RAISE EXCEPTION 'Quick time is for office staff.' USING ERRCODE = '42501';
  END IF;
  IF COALESCE(v_user.read_only, false) THEN
    RAISE EXCEPTION 'Training mode is read-only — nothing was added.' USING ERRCODE = '42501';
  END IF;
  SELECT s.is_salary, s.record_hours_but_salary INTO v_salary FROM public.self_salary_clock_state() s;
  IF COALESCE(v_salary.is_salary, false) AND NOT COALESCE(v_salary.record_hours_but_salary, false) THEN
    RAISE EXCEPTION 'Your hours come from your salary schedule, so there is nothing to add.' USING ERRCODE = '42501';
  END IF;

  IF p_minutes IS NULL OR p_minutes NOT IN (5, 10, 15, 20, 25, 30) THEN
    RAISE EXCEPTION 'Quick time is 5 to 30 minutes, in fives.' USING ERRCODE = 'P0001';
  END IF;
  IF char_length(v_note) < 3 THEN
    RAISE EXCEPTION 'Say what it was — the office reads this when it approves your hours.' USING ERRCODE = 'P0001';
  END IF;
  v_note := left(v_note, 200);

  v_start := v_end - make_interval(mins => p_minutes);
  -- v2.3678: today on the company calendar, start and end — or ended within the last two hours,
  -- so the call that ran 11:54 pm – 12:04 am can still be added at 12:05 (found when a test run
  -- crossed midnight Central). Never the future.
  IF v_end > now() + interval '1 minute'
     OR (((v_end AT TIME ZONE 'America/Chicago')::date <> v_today
          OR (v_start AT TIME ZONE 'America/Chicago')::date <> v_today)
         AND v_end < now() - interval '2 hours') THEN
    RAISE EXCEPTION 'Quick time is for today, or the last two hours. For another day, use My Time.' USING ERRCODE = 'P0001';
  END IF;
  -- The row is dated like a punch: by the day it started (a 11:54 pm call is yesterday's).
  v_work_date := (v_start AT TIME ZONE 'America/Chicago')::date;

  -- One at a time per person: two fast taps must not both pass the checks below.
  PERFORM pg_advisory_xact_lock(hashtextextended('quick_add:' || v_uid::text, 0));

  IF EXISTS (SELECT 1 FROM public.clock_sessions s
              WHERE s.user_id = v_uid AND s.clocked_out_at IS NULL AND s.rejected_at IS NULL AND s.revoked_at IS NULL) THEN
    RAISE EXCEPTION 'You are clocked in — this time is already counting.' USING ERRCODE = 'P0001';
  END IF;

  SELECT s.clocked_in_at, s.clocked_out_at INTO v_clash
    FROM public.clock_sessions s
   WHERE s.user_id = v_uid AND s.rejected_at IS NULL AND s.revoked_at IS NULL AND s.clocked_out_at IS NOT NULL
     AND s.clocked_in_at < v_end AND s.clocked_out_at > v_start
   ORDER BY s.clocked_in_at LIMIT 1;
  IF FOUND THEN
    RAISE EXCEPTION 'You already have hours % – %. Pick an end time outside that, or edit that day on My Time.',
      to_char(v_clash.clocked_in_at AT TIME ZONE 'America/Chicago', 'FMHH12:MI am'),
      to_char(v_clash.clocked_out_at AT TIME ZONE 'America/Chicago', 'FMHH12:MI am') USING ERRCODE = 'P0001';
  END IF;

  SELECT COALESCE((SELECT a.value_num FROM public.app_settings a WHERE a.key = 'quick_add_daily_ceiling_minutes'), 120)::integer INTO v_ceiling;
  SELECT COALESCE(sum(s.quick_add_minutes), 0)::integer INTO v_day_total
    FROM public.clock_sessions s
   WHERE s.user_id = v_uid AND s.work_date = v_work_date AND s.quick_add_minutes IS NOT NULL
     AND s.rejected_at IS NULL AND s.revoked_at IS NULL;
  IF v_day_total + p_minutes > v_ceiling THEN
    RAISE EXCEPTION 'That would be % minutes of quick adds today (the most is %). If you are working a stretch, clock in instead.', v_day_total + p_minutes, v_ceiling USING ERRCODE = 'P0001';
  END IF;

  BEGIN
    SELECT NULLIF(btrim(a.value_text), '')::uuid INTO v_office_job FROM public.app_settings a WHERE a.key = 'overhead_office_job_ledger_id_v1';
  EXCEPTION WHEN invalid_text_representation THEN
    v_office_job := NULL;
  END;
  IF v_office_job IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.jobs_ledger j WHERE j.id = v_office_job) THEN
    v_office_job := NULL;
  END IF;

  PERFORM set_config('app.quick_add_rpc', '1', true);
  INSERT INTO public.clock_sessions (user_id, work_date, clocked_in_at, clocked_out_at, notes, job_ledger_id, origin, quick_add_minutes)
  VALUES (v_uid, v_work_date, v_start, v_end, v_note, v_office_job, 'user_punch', p_minutes)
  RETURNING id INTO v_id;
  PERFORM set_config('app.quick_add_rpc', '', true);

  RETURN jsonb_build_object('id', v_id, 'minutes', p_minutes, 'clocked_in_at', v_start, 'clocked_out_at', v_end,
                            'job_ledger_id', v_office_job, 'day_total_minutes', v_day_total + p_minutes, 'daily_ceiling_minutes', v_ceiling);
END;
$$;

COMMENT ON FUNCTION public.add_quick_time(integer, text, timestamptz) IS
  'Quick time add: the one way a quick add is written. The roles on Settings → People & teams (app_settings quick_add_roles_v1; default assistant, controller, estimator, dev), not salaried, not read-only; 5–30 minutes in fives; a note; today, or ended in the last two hours; never while clocked in; never over existing hours; under the daily ceiling (app_settings quick_add_daily_ceiling_minutes). Writes one finished clock session on the Office job, marked quick_add_minutes.';

REVOKE EXECUTE ON FUNCTION public.add_quick_time(integer, text, timestamptz) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.add_quick_time(integer, text, timestamptz) TO authenticated;
