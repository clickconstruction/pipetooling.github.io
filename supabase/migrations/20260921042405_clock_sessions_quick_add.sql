SET lock_timeout = '3s';

-- Quick time add, PR 1 (to-dos/quick-time-add): office staff add 5–30 minutes for an off-hours
-- call or email without clocking in. A quick add is an ORDINARY finished clock session
-- (origin stays 'user_punch', so hours, approval, pay and every reader that branches on origin
-- are untouched) carrying one mark: quick_add_minutes. The rules live here, not on the screen.
--
-- PUSH IN A QUIET MOMENT: step 1 takes a brief ACCESS EXCLUSIVE on clock_sessions, the busiest
-- table in the app. It is metadata-only (a nullable column, no default, no scan), and the
-- lock_timeout above makes it fail fast rather than queue the office behind it. The CHECK is
-- added NOT VALID and validated separately, which scans under a lock that blocks nobody.

-- 1. The mark --------------------------------------------------------------------------------
ALTER TABLE public.clock_sessions ADD COLUMN IF NOT EXISTS quick_add_minutes smallint;

COMMENT ON COLUMN public.clock_sessions.quick_add_minutes IS
  'Quick time add: NULL = an ordinary punch; 5…30 (fives) = a self-reported block added after the fact through add_quick_time() — its length, which the session''s times must keep matching. Set only by that RPC (clock_sessions_guard_quick_add).';

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'clock_sessions_quick_add_minutes_check') THEN
    ALTER TABLE public.clock_sessions
      ADD CONSTRAINT clock_sessions_quick_add_minutes_check
      CHECK (quick_add_minutes IS NULL OR quick_add_minutes IN (5, 10, 15, 20, 25, 30)) NOT VALID;
  END IF;
END $$;
ALTER TABLE public.clock_sessions VALIDATE CONSTRAINT clock_sessions_quick_add_minutes_check;

CREATE INDEX IF NOT EXISTS idx_clock_sessions_quick_add_user_day
  ON public.clock_sessions (user_id, work_date) WHERE quick_add_minutes IS NOT NULL;

-- 2. The guard: the mark is the RPC's, and a quick add keeps its length --------------------------
-- The insert policy lets a person insert their own finished session, so without this the rules
-- below could be skipped from a console. add_quick_time() sets a transaction-local flag; a
-- service-role / no-JWT writer and the people who approve hours are not bound.
CREATE OR REPLACE FUNCTION public.clock_sessions_guard_quick_add()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_via_rpc boolean := COALESCE(current_setting('app.quick_add_rpc', true), '') = '1';
  v_office boolean;
BEGIN
  IF (SELECT auth.uid()) IS NULL OR v_via_rpc THEN
    RETURN NEW;
  END IF;
  -- The people who approve hours may correct someone else's entry; nobody overrides their own
  -- (an assistant both uses this door and approves hours).
  v_office := public.is_dev()
    OR ((public.is_pay_approved_master() OR public.is_assistant()) AND NEW.user_id <> (SELECT auth.uid()));

  IF TG_OP = 'INSERT' THEN
    IF NEW.quick_add_minutes IS NOT NULL THEN
      RAISE EXCEPTION 'Quick time is added with the Add quick time button, not written directly.' USING ERRCODE = '42501';
    END IF;
    RETURN NEW;
  END IF;

  IF NEW.quick_add_minutes IS DISTINCT FROM OLD.quick_add_minutes AND NOT v_office THEN
    RAISE EXCEPTION 'The quick-add mark on an hours entry cannot be changed.' USING ERRCODE = '42501';
  END IF;
  -- A quick add stays the length it says it is. To record a different length, the office
  -- edits it (and may clear the mark), or the person adds a new one.
  IF NEW.quick_add_minutes IS NOT NULL AND NOT v_office
     AND (NEW.clocked_out_at IS NULL
          OR NEW.clocked_out_at - NEW.clocked_in_at <> make_interval(mins => NEW.quick_add_minutes)) THEN
    RAISE EXCEPTION 'A quick add stays % minutes. To change the length, ask the office, or add a new one.', NEW.quick_add_minutes USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS clock_sessions_guard_quick_add ON public.clock_sessions;
CREATE TRIGGER clock_sessions_guard_quick_add
  BEFORE INSERT OR UPDATE OF quick_add_minutes, clocked_in_at, clocked_out_at ON public.clock_sessions
  FOR EACH ROW EXECUTE FUNCTION public.clock_sessions_guard_quick_add();

-- 3. The daily ceiling (owner call 2, default 120 minutes) ------------------------------------
INSERT INTO public.app_settings (key, value_num)
VALUES ('quick_add_daily_ceiling_minutes', 120)
ON CONFLICT (key) DO NOTHING;

-- 4. The one entrypoint -----------------------------------------------------------------------
-- Office-only in PR 1: a session on a real job promotes it waiting → working, moves its last
-- work date (lien deadlines), fills the customer's date met and joins the job's crew — none of
-- which a phone call should do. Pinning a quick add to a job is its own decision (the to-do).
CREATE OR REPLACE FUNCTION public.add_quick_time(p_minutes integer, p_note text, p_ended_at timestamptz DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid uuid := (SELECT auth.uid());
  v_user record;
  v_salary record;
  v_note text := btrim(COALESCE(p_note, ''));
  v_end timestamptz := date_trunc('minute', COALESCE(p_ended_at, now()));
  v_start timestamptz;
  v_today date := public.app_today();
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
     OR v_user.role NOT IN ('assistant', 'controller', 'estimator', 'dev') THEN
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
  IF v_end > now() + interval '1 minute'
     OR (v_end AT TIME ZONE 'America/Chicago')::date <> v_today
     OR (v_start AT TIME ZONE 'America/Chicago')::date <> v_today THEN
    RAISE EXCEPTION 'Quick time is for today. For another day, use My Time.' USING ERRCODE = 'P0001';
  END IF;

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
   WHERE s.user_id = v_uid AND s.work_date = v_today AND s.quick_add_minutes IS NOT NULL
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
  VALUES (v_uid, v_today, v_start, v_end, v_note, v_office_job, 'user_punch', p_minutes)
  RETURNING id INTO v_id;
  PERFORM set_config('app.quick_add_rpc', '', true);

  RETURN jsonb_build_object('id', v_id, 'minutes', p_minutes, 'clocked_in_at', v_start, 'clocked_out_at', v_end,
                            'job_ledger_id', v_office_job, 'day_total_minutes', v_day_total + p_minutes, 'daily_ceiling_minutes', v_ceiling);
END;
$$;

COMMENT ON FUNCTION public.add_quick_time(integer, text, timestamptz) IS
  'Quick time add: the one way a quick add is written. Office roles only (assistant, controller, estimator, dev), not salaried, not read-only; 5–30 minutes in fives; a note; today only; never while clocked in; never over existing hours; under the daily ceiling (app_settings quick_add_daily_ceiling_minutes). Writes one finished clock session on the Office job, marked quick_add_minutes.';

REVOKE EXECUTE ON FUNCTION public.add_quick_time(integer, text, timestamptz) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.add_quick_time(integer, text, timestamptz) TO authenticated;
