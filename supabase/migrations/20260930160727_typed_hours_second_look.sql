SET lock_timeout = '3s';

-- Typed hours get a second look (v2.4242).
--
-- A clock session is either punched (the clock button, in real time) or typed (someone wrote
-- the times). Until now the two looked the same: an assistant could type a day for someone,
-- approve it herself, and nothing recorded that she had. This migration:
--
--   1. keeps a ledger, clock_typed_entries: every time a signed-in person makes time exist on
--      someone's day that the clock had not recorded ('added'), or makes punched time stop
--      existing ('trimmed'), one row says who, when, which stretch, and the day's total before
--      and after;
--   2. holds an approval when the approver typed the hours, or the hours are the approver's
--      own ("whoever typed it cannot approve it; nobody approves their own");
--   3. records the second look: another person's approval, or their "Looks right" on a typed
--      change to hours that were already approved.
--
-- How "typed" is decided. Not per row: the split / replace RPCs delete a day's rows and insert
-- new ones, so a row-level view sees hours vanish and reappear. Instead a BEFORE row trigger
-- remembers, once per (person, day) per transaction, what was on the day before the first
-- write; a deferred constraint trigger compares it with the day at commit. Only the net change
-- is recorded, so cutting a punched day into job segments records nothing.
--
--   * An open session counts as running to now + 10 minutes when it is what existed, and to
--     now - 10 minutes when it is what was added: a real clock-in or clock-out adds nothing, a
--     session started "three hours ago" adds those hours.
--   * Writes with no signed-in person (cron, service role, the cost_agent / hr_agent roles) are
--     never "typed". Salary-schedule sessions and quick adds are never the added time (both
--     have their own rules), though they count as time that already existed.
--   * Pieces under one minute are dropped and a change under two minutes is not recorded.
--   * Both triggers swallow their own errors: the ledger must never stop a punch.
--
-- The hold is switched by app_settings.typed_hours_second_look_v1: 'off' (ledger only),
-- 'test' (the hold applies to sample accounts and ZZ-named people only — what this migration
-- seeds, so the client can be walked on prod before anyone real is held) or 'on'. A dev flips
-- it in Settings. The ledger and the second-look record run in every mode.
--
-- approve_clock_sessions is rewritten from its live body (read 2026-09-30): the one change is
-- that a held session is skipped instead of approved. approve_clock_sessions_v2 returns the
-- same result plus how many were held and why; the client calls it and falls back to the old
-- name until this is pushed.

-- ─────────────────────────────────────────────────────────────────────────────────────────────
-- 1. The ledger
-- ─────────────────────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.clock_typed_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  work_date date NOT NULL,
  kind text NOT NULL CHECK (kind IN ('added', 'trimmed')),
  typed_range tstzmultirange NOT NULL,
  typed_seconds integer NOT NULL,
  day_seconds_before integer NOT NULL,
  day_seconds_after integer NOT NULL,
  typed_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  typed_by_name text NOT NULL DEFAULT '',
  typed_at timestamptz NOT NULL DEFAULT now(),
  confirmed_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  confirmed_by_name text,
  confirmed_at timestamptz
);

COMMENT ON TABLE public.clock_typed_entries IS
  'Hours typed by hand: one row each time a signed-in person makes time exist on a day that the clock had not recorded (added) or makes punched time stop existing (trimmed). Written only by the clock_sessions triggers. confirmed_* is the second look by someone other than the typist. v2.4242.';

CREATE INDEX IF NOT EXISTS idx_clock_typed_entries_user_date
  ON public.clock_typed_entries (user_id, work_date);
CREATE INDEX IF NOT EXISTS idx_clock_typed_entries_waiting
  ON public.clock_typed_entries (typed_at)
  WHERE kind = 'added' AND confirmed_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_clock_typed_entries_typed_by
  ON public.clock_typed_entries (typed_by);
CREATE INDEX IF NOT EXISTS idx_clock_typed_entries_confirmed_by
  ON public.clock_typed_entries (confirmed_by);

ALTER TABLE public.clock_typed_entries ENABLE ROW LEVEL SECURITY;

-- Read: whoever may read the person's clock sessions. No INSERT / UPDATE / DELETE policy — the
-- SECURITY DEFINER triggers and RPCs below are the only writers.
DROP POLICY IF EXISTS clock_typed_entries_select ON public.clock_typed_entries;
CREATE POLICY clock_typed_entries_select ON public.clock_typed_entries
  FOR SELECT TO authenticated
  USING (
    (SELECT public.is_dev())
    OR (SELECT public.has_payroll_access())
    OR (SELECT public.is_assistant())
    OR public.is_team_lead_for_member((SELECT auth.uid()), user_id)
    OR user_id = (SELECT auth.uid())
  );

REVOKE ALL ON public.clock_typed_entries FROM anon;
GRANT SELECT ON public.clock_typed_entries TO authenticated;
GRANT ALL ON public.clock_typed_entries TO service_role;

INSERT INTO public.app_settings (key, value_text)
VALUES ('typed_hours_second_look_v1', 'test')
ON CONFLICT (key) DO NOTHING;

-- ─────────────────────────────────────────────────────────────────────────────────────────────
-- 2. Small helpers
-- ─────────────────────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.clock_typed_drop_slivers(p tstzmultirange, p_min_seconds integer)
RETURNS tstzmultirange
LANGUAGE sql IMMUTABLE
SET search_path TO 'public'
AS $$
  SELECT COALESCE(range_agg(r), '{}'::tstzmultirange)
  FROM unnest(p) AS r
  WHERE EXTRACT(EPOCH FROM (upper(r) - lower(r))) >= p_min_seconds;
$$;

CREATE OR REPLACE FUNCTION public.clock_typed_seconds(p tstzmultirange)
RETURNS integer
LANGUAGE sql IMMUTABLE
SET search_path TO 'public'
AS $$
  SELECT COALESCE(SUM(EXTRACT(EPOCH FROM (upper(r) - lower(r)))), 0)::integer
  FROM unnest(p) AS r;
$$;

-- Does the hold apply to this person's hours? 'on' → everyone; 'test' → sample accounts and
-- ZZ-named people; anything else → nobody.
CREATE OR REPLACE FUNCTION public.typed_hours_rule_applies(p_subject uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT CASE COALESCE(
      (SELECT s.value_text FROM public.app_settings s WHERE s.key = 'typed_hours_second_look_v1'),
      'off')
    WHEN 'on' THEN true
    WHEN 'test' THEN EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = p_subject AND (COALESCE(u.is_sample, false) OR trim(COALESCE(u.name, '')) ILIKE 'ZZ%')
    )
    ELSE false
  END;
$$;

-- ─────────────────────────────────────────────────────────────────────────────────────────────
-- 3. The two ledger triggers
-- ─────────────────────────────────────────────────────────────────────────────────────────────

-- BEFORE row: remember what was on the (person, day) before this transaction first touched it.
-- State is a transaction-local setting: { "<user>|<date>": [[in, out|null, is_punch], …] }.
CREATE OR REPLACE FUNCTION public.clock_sessions_typed_snapshot()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_state jsonb;
  v_changed boolean := false;
  v_user uuid;
  v_date date;
  v_key text;
  v_rows jsonb;
  v_i int;
BEGIN
  BEGIN
    IF auth.uid() IS NULL THEN
      IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
      RETURN NEW;
    END IF;

    v_state := COALESCE(NULLIF(current_setting('pt_clock.before', true), '')::jsonb, '{}'::jsonb);

    FOR v_i IN 1 .. 2 LOOP
      IF v_i = 1 THEN
        IF TG_OP = 'INSERT' THEN CONTINUE; END IF;
        v_user := OLD.user_id; v_date := OLD.work_date;
      ELSE
        IF TG_OP = 'DELETE' THEN CONTINUE; END IF;
        v_user := NEW.user_id; v_date := NEW.work_date;
      END IF;
      v_key := v_user::text || '|' || v_date::text;
      IF v_state ? v_key THEN CONTINUE; END IF;

      SELECT COALESCE(jsonb_agg(jsonb_build_array(
               cs.clocked_in_at,
               cs.clocked_out_at,
               (cs.origin = 'user_punch' AND cs.quick_add_minutes IS NULL)
             )), '[]'::jsonb)
      INTO v_rows
      FROM public.clock_sessions cs
      WHERE cs.user_id = v_user AND cs.work_date = v_date;

      v_state := v_state || jsonb_build_object(v_key, v_rows);
      v_changed := true;
    END LOOP;

    IF v_changed THEN
      PERFORM set_config('pt_clock.before', v_state::text, true);
    END IF;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'clock_sessions_typed_snapshot: % (%)', SQLERRM, SQLSTATE;
  END;

  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;

-- AFTER row, deferred to commit: the first event does the whole comparison and clears the state.
CREATE OR REPLACE FUNCTION public.clock_sessions_typed_record()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_raw text;
  v_state jsonb;
  v_actor uuid;
  v_actor_name text;
  v_now timestamptz := now();
  v_slack interval := interval '10 minutes';
  v_user uuid;
  v_key text;
  v_date date;
  v_dates date[];
  v_before_all tstzmultirange;
  v_after_all tstzmultirange;
  v_before_punch tstzmultirange;
  v_after_punch tstzmultirange;
  v_before_day tstzmultirange;
  v_after_day tstzmultirange;
  v_added tstzmultirange;
  v_removed tstzmultirange;
BEGIN
  BEGIN
    v_raw := current_setting('pt_clock.before', true);
    IF v_raw IS NULL OR v_raw = '' THEN
      RETURN NULL;
    END IF;
    PERFORM set_config('pt_clock.before', '', true);

    v_actor := auth.uid();
    IF v_actor IS NULL THEN
      RETURN NULL;
    END IF;
    v_state := v_raw::jsonb;

    SELECT NULLIF(trim(u.name), '') INTO v_actor_name FROM public.users u WHERE u.id = v_actor;
    v_actor_name := COALESCE(v_actor_name, 'Someone');

    FOR v_user IN
      SELECT DISTINCT split_part(k, '|', 1)::uuid FROM jsonb_object_keys(v_state) AS k
    LOOP
      SELECT array_agg(split_part(k, '|', 2)::date) INTO v_dates
      FROM jsonb_object_keys(v_state) AS k
      WHERE split_part(k, '|', 1)::uuid = v_user;

      -- Everything that existed for this person on the touched days, generously: an open
      -- session runs to now + slack.
      SELECT COALESCE(range_agg(tstzrange(LEAST(x.a, x.b), GREATEST(x.a, x.b))), '{}'::tstzmultirange)
      INTO v_before_all
      FROM (
        SELECT (r ->> 0)::timestamptz AS a,
               COALESCE((r ->> 1)::timestamptz, v_now + v_slack) AS b
        FROM jsonb_each(v_state) AS s(k, day_rows),
             jsonb_array_elements(s.day_rows) AS r
        WHERE split_part(s.k, '|', 1)::uuid = v_user
      ) x;

      SELECT COALESCE(range_agg(tstzrange(LEAST(x.a, x.b), GREATEST(x.a, x.b))), '{}'::tstzmultirange)
      INTO v_after_all
      FROM (
        SELECT cs.clocked_in_at AS a,
               COALESCE(cs.clocked_out_at, v_now + v_slack) AS b
        FROM public.clock_sessions cs
        WHERE cs.user_id = v_user AND cs.work_date = ANY (v_dates)
      ) x;

      FOR v_key IN
        SELECT k FROM jsonb_object_keys(v_state) AS k WHERE split_part(k, '|', 1)::uuid = v_user
      LOOP
        v_date := split_part(v_key, '|', 2)::date;

        -- Punched time on the day, strictly: an open session runs only to now - slack.
        SELECT COALESCE(range_agg(tstzrange(LEAST(x.a, x.b), GREATEST(x.a, x.b))), '{}'::tstzmultirange)
        INTO v_before_punch
        FROM (
          SELECT (r ->> 0)::timestamptz AS a,
                 COALESCE((r ->> 1)::timestamptz, GREATEST((r ->> 0)::timestamptz, v_now - v_slack)) AS b
          FROM jsonb_array_elements(v_state -> v_key) AS r
          WHERE (r ->> 2)::boolean
        ) x;

        SELECT COALESCE(range_agg(tstzrange(LEAST(x.a, x.b), GREATEST(x.a, x.b))), '{}'::tstzmultirange)
        INTO v_after_punch
        FROM (
          SELECT cs.clocked_in_at AS a,
                 COALESCE(cs.clocked_out_at, GREATEST(cs.clocked_in_at, v_now - v_slack)) AS b
          FROM public.clock_sessions cs
          WHERE cs.user_id = v_user AND cs.work_date = v_date
            AND cs.origin = 'user_punch' AND cs.quick_add_minutes IS NULL
        ) x;

        v_added := public.clock_typed_drop_slivers(v_after_punch - v_before_all, 60);
        v_removed := public.clock_typed_drop_slivers(v_before_punch - v_after_all, 60);

        IF public.clock_typed_seconds(v_added) < 120 AND public.clock_typed_seconds(v_removed) < 120 THEN
          CONTINUE;
        END IF;

        -- The day's total before and after, every origin, an open session running to now.
        SELECT COALESCE(range_agg(tstzrange(LEAST(x.a, x.b), GREATEST(x.a, x.b))), '{}'::tstzmultirange)
        INTO v_before_day
        FROM (
          SELECT (r ->> 0)::timestamptz AS a,
                 COALESCE((r ->> 1)::timestamptz, GREATEST((r ->> 0)::timestamptz, v_now)) AS b
          FROM jsonb_array_elements(v_state -> v_key) AS r
        ) x;

        SELECT COALESCE(range_agg(tstzrange(LEAST(x.a, x.b), GREATEST(x.a, x.b))), '{}'::tstzmultirange)
        INTO v_after_day
        FROM (
          SELECT cs.clocked_in_at AS a,
                 COALESCE(cs.clocked_out_at, GREATEST(cs.clocked_in_at, v_now)) AS b
          FROM public.clock_sessions cs
          WHERE cs.user_id = v_user AND cs.work_date = v_date
        ) x;

        IF public.clock_typed_seconds(v_added) >= 120 THEN
          INSERT INTO public.clock_typed_entries
            (user_id, work_date, kind, typed_range, typed_seconds, day_seconds_before, day_seconds_after, typed_by, typed_by_name)
          VALUES
            (v_user, v_date, 'added', v_added, public.clock_typed_seconds(v_added),
             public.clock_typed_seconds(v_before_day), public.clock_typed_seconds(v_after_day), v_actor, v_actor_name);
        END IF;

        IF public.clock_typed_seconds(v_removed) >= 120 THEN
          INSERT INTO public.clock_typed_entries
            (user_id, work_date, kind, typed_range, typed_seconds, day_seconds_before, day_seconds_after, typed_by, typed_by_name)
          VALUES
            (v_user, v_date, 'trimmed', v_removed, public.clock_typed_seconds(v_removed),
             public.clock_typed_seconds(v_before_day), public.clock_typed_seconds(v_after_day), v_actor, v_actor_name);
        END IF;
      END LOOP;
    END LOOP;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'clock_sessions_typed_record: % (%)', SQLERRM, SQLSTATE;
  END;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS clock_sessions_typed_snapshot ON public.clock_sessions;
CREATE TRIGGER clock_sessions_typed_snapshot
  BEFORE INSERT OR DELETE OR UPDATE OF clocked_in_at, clocked_out_at, work_date, user_id, origin, quick_add_minutes
  ON public.clock_sessions
  FOR EACH ROW EXECUTE FUNCTION public.clock_sessions_typed_snapshot();

DROP TRIGGER IF EXISTS clock_sessions_typed_record ON public.clock_sessions;
CREATE CONSTRAINT TRIGGER clock_sessions_typed_record
  AFTER INSERT OR DELETE OR UPDATE OF clocked_in_at, clocked_out_at, work_date, user_id, origin, quick_add_minutes
  ON public.clock_sessions
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION public.clock_sessions_typed_record();

-- ─────────────────────────────────────────────────────────────────────────────────────────────
-- 4. The hold, and the second look
-- ─────────────────────────────────────────────────────────────────────────────────────────────

-- 'own'   — the hours are the approver's own.
-- 'typed' — the approver typed hours onto this session for someone else and nobody else has
--           looked yet.
-- NULL    — nothing holds it (or the rule is not switched on for this person).
-- Always about the caller: nobody can ask what would hold someone else.
CREATE OR REPLACE FUNCTION public.clock_session_approval_hold(p_session_id uuid)
RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT CASE
    WHEN auth.uid() IS NULL THEN NULL
    WHEN cs.origin <> 'user_punch' THEN NULL
    WHEN NOT public.typed_hours_rule_applies(cs.user_id) THEN NULL
    WHEN cs.user_id = auth.uid() THEN 'own'
    WHEN EXISTS (
      SELECT 1 FROM public.clock_typed_entries e
      WHERE e.user_id = cs.user_id
        AND e.kind = 'added'
        AND e.confirmed_at IS NULL
        AND e.typed_by = auth.uid()
        AND e.typed_range && tstzrange(
              LEAST(cs.clocked_in_at, COALESCE(cs.clocked_out_at, cs.clocked_in_at)),
              GREATEST(cs.clocked_in_at, COALESCE(cs.clocked_out_at, cs.clocked_in_at)))
    ) THEN 'typed'
    ELSE NULL
  END
  FROM public.clock_sessions cs
  WHERE cs.id = p_session_id;
$$;

-- The rule holds on the table itself, so no screen can approve around it; and an approval by
-- someone else is the second look on the typed hours it covers.
CREATE OR REPLACE FUNCTION public.clock_sessions_guard_approval()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_hold text;
  v_name text;
BEGIN
  IF NEW.approved_at IS NULL OR v_actor IS NULL THEN
    RETURN NEW;
  END IF;

  -- A session written already approved is typed and approved in one stroke: the same rule.
  IF TG_OP = 'INSERT' THEN
    IF NEW.origin = 'user_punch' AND public.typed_hours_rule_applies(NEW.user_id) THEN
      RAISE EXCEPTION 'Hours typed in start unapproved. Someone else approves them.' USING ERRCODE = 'P0001';
    END IF;
    RETURN NEW;
  END IF;

  IF OLD.approved_at IS NOT NULL THEN
    RETURN NEW;
  END IF;

  v_hold := public.clock_session_approval_hold(OLD.id);
  IF v_hold = 'own' THEN
    RAISE EXCEPTION 'You cannot approve your own hours. Someone else who approves hours has to.' USING ERRCODE = 'P0001';
  ELSIF v_hold = 'typed' THEN
    RAISE EXCEPTION 'You typed these hours, so someone else has to approve them.' USING ERRCODE = 'P0001';
  END IF;

  BEGIN
    SELECT NULLIF(trim(u.name), '') INTO v_name FROM public.users u WHERE u.id = v_actor;
    v_name := COALESCE(v_name, 'Someone');
    UPDATE public.clock_typed_entries e
    SET confirmed_by = v_actor, confirmed_by_name = v_name, confirmed_at = now()
    WHERE e.user_id = NEW.user_id
      AND e.kind = 'added'
      AND e.confirmed_at IS NULL
      AND e.typed_by IS DISTINCT FROM v_actor
      AND NEW.user_id <> v_actor
      AND NEW.clocked_out_at IS NOT NULL
      AND e.typed_range && tstzrange(LEAST(NEW.clocked_in_at, NEW.clocked_out_at), GREATEST(NEW.clocked_in_at, NEW.clocked_out_at));
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'clock_sessions_guard_approval (second look): % (%)', SQLERRM, SQLSTATE;
  END;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS clock_sessions_guard_approval ON public.clock_sessions;
CREATE TRIGGER clock_sessions_guard_approval
  BEFORE INSERT OR UPDATE OF approved_at ON public.clock_sessions
  FOR EACH ROW EXECUTE FUNCTION public.clock_sessions_guard_approval();

-- "Looks right" on typed hours that were already approved when they were typed (an in-place
-- change to an approved session stays approved): the second look without a re-approval.
CREATE OR REPLACE FUNCTION public.confirm_clock_typed_entry(p_entry_id uuid)
RETURNS text
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_entry public.clock_typed_entries%ROWTYPE;
  v_name text;
BEGIN
  IF v_actor IS NULL THEN
    RETURN 'Not signed in.';
  END IF;
  SELECT * INTO v_entry FROM public.clock_typed_entries WHERE id = p_entry_id;
  IF NOT FOUND THEN
    RETURN 'That entry is gone.';
  END IF;
  IF NOT (public.is_dev() OR public.has_payroll_access() OR public.is_assistant()
          OR public.is_team_lead_for_member(v_actor, v_entry.user_id)) THEN
    RETURN 'Only someone who approves hours can do this.';
  END IF;
  IF v_entry.kind <> 'added' THEN
    RETURN 'Only added hours need a second look.';
  END IF;
  IF v_entry.confirmed_at IS NOT NULL THEN
    RETURN NULL;
  END IF;
  IF v_entry.typed_by = v_actor THEN
    RETURN 'You typed these hours, so someone else has to look at them.';
  END IF;
  IF v_entry.user_id = v_actor THEN
    RETURN 'These are your own hours. Someone else has to look at them.';
  END IF;

  SELECT NULLIF(trim(u.name), '') INTO v_name FROM public.users u WHERE u.id = v_actor;
  v_name := COALESCE(v_name, 'Someone');
  UPDATE public.clock_typed_entries
  SET confirmed_by = v_actor, confirmed_by_name = v_name, confirmed_at = now()
  WHERE id = p_entry_id AND confirmed_at IS NULL;
  RETURN NULL;
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────────────────────────
-- 5. Approving
-- ─────────────────────────────────────────────────────────────────────────────────────────────

-- From the live body of 2026-09-30. The one change: a held session is skipped, not approved.
CREATE OR REPLACE FUNCTION public.approve_clock_sessions(p_session_ids uuid[])
RETURNS TABLE(approved_count integer, error_message text)
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
DECLARE
  v_approved int := 0;
  v_session RECORD;
  v_hours numeric;
  v_to_sync RECORD;
  v_pay boolean;
  v_person_id uuid;
BEGIN
  v_pay :=
    public.has_payroll_access()
    OR public.is_assistant()
    OR public.is_assistant();

  FOR v_session IN
    SELECT cs.id, cs.user_id, cs.clocked_in_at, cs.clocked_out_at, cs.work_date, trim(u.name) AS person_name, cs.job_ledger_id, cs.bid_id
    FROM public.clock_sessions cs
    JOIN public.users u ON u.id = cs.user_id
    WHERE cs.id = ANY(p_session_ids)
      AND cs.clocked_out_at IS NOT NULL
      AND cs.approved_at IS NULL
      AND cs.rejected_at IS NULL
  LOOP
    IF NOT v_pay THEN
      IF NOT public.is_team_lead_for_member(auth.uid(), v_session.user_id) THEN
        RETURN QUERY SELECT 0, 'Access denied'::text;
        RETURN;
      END IF;
    END IF;

    -- Typed by the approver, or the approver's own hours: left for someone else (v2.4242).
    IF public.clock_session_approval_hold(v_session.id) IS NOT NULL THEN
      CONTINUE;
    END IF;

    IF v_session.person_name IS NULL OR v_session.person_name = '' THEN
      RETURN QUERY SELECT 0, ('User has no name for session ' || v_session.id::text)::text;
      RETURN;
    END IF;

    v_hours := EXTRACT(EPOCH FROM (v_session.clocked_out_at - v_session.clocked_in_at)) / 3600.0;
    IF v_hours <= 0 THEN
      CONTINUE;
    END IF;

    v_person_id := public.resolve_pay_person_id_from_clock_user(v_session.user_id, v_session.person_name);

    INSERT INTO public.people_hours (person_name, work_date, hours, entered_by, person_id)
    VALUES (v_session.person_name, v_session.work_date, v_hours, auth.uid(), v_person_id)
    ON CONFLICT (person_name, work_date) DO UPDATE SET
      hours = public.people_hours.hours + EXCLUDED.hours,
      entered_by = EXCLUDED.entered_by,
      person_id = COALESCE(public.people_hours.person_id, EXCLUDED.person_id);

    UPDATE public.clock_sessions
    SET approved_at = NOW(), approved_by = auth.uid(),
        revoked_at = NULL, revoked_by = NULL
    WHERE id = v_session.id;

    v_approved := v_approved + 1;
  END LOOP;

  FOR v_to_sync IN
    SELECT DISTINCT trim(u.name) AS person_name, cs.work_date
    FROM public.clock_sessions cs
    JOIN public.users u ON u.id = cs.user_id
    WHERE cs.id = ANY(p_session_ids)
      AND cs.job_ledger_id IS NOT NULL
      AND trim(u.name) IS NOT NULL
      AND trim(u.name) != ''
  LOOP
    PERFORM public.sync_crew_jobs_from_clock(v_to_sync.person_name, v_to_sync.work_date);
  END LOOP;

  FOR v_to_sync IN
    SELECT DISTINCT trim(u.name) AS person_name, cs.work_date
    FROM public.clock_sessions cs
    JOIN public.users u ON u.id = cs.user_id
    WHERE cs.id = ANY(p_session_ids)
      AND cs.bid_id IS NOT NULL
      AND trim(u.name) IS NOT NULL
      AND trim(u.name) != ''
  LOOP
    PERFORM public.sync_crew_bids_from_clock(v_to_sync.person_name, v_to_sync.work_date);
  END LOOP;

  RETURN QUERY SELECT v_approved, NULL::text;
END;
$$;

-- The same approval, plus how many were left for someone else and why.
CREATE OR REPLACE FUNCTION public.approve_clock_sessions_v2(p_session_ids uuid[])
RETURNS TABLE(approved_count integer, held_own integer, held_typed integer, error_message text)
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
DECLARE
  v_own int := 0;
  v_typed int := 0;
BEGIN
  SELECT COUNT(*) FILTER (WHERE x.hold = 'own')::int, COUNT(*) FILTER (WHERE x.hold = 'typed')::int
  INTO v_own, v_typed
  FROM (
    SELECT public.clock_session_approval_hold(cs.id) AS hold
    FROM public.clock_sessions cs
    WHERE cs.id = ANY(p_session_ids)
      AND cs.clocked_out_at IS NOT NULL
      AND cs.approved_at IS NULL
      AND cs.rejected_at IS NULL
  ) x;

  RETURN QUERY
  SELECT r.approved_count, v_own, v_typed, r.error_message
  FROM public.approve_clock_sessions(p_session_ids) r;
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────────────────────────
-- 6. Reading: the stamp for a list of sessions, and what is waiting on a second look
-- ─────────────────────────────────────────────────────────────────────────────────────────────

-- One row per session the caller may read: whether the caller is held from approving it, and
-- the typed entries that touch it (added: overlapping; trimmed: on the same day and touching).
CREATE OR REPLACE FUNCTION public.clock_typed_stamps(p_session_ids uuid[])
RETURNS TABLE(session_id uuid, hold text, entries jsonb)
LANGUAGE sql STABLE
SET search_path TO 'public'
AS $$
  SELECT
    cs.id,
    CASE
      WHEN cs.approved_at IS NULL AND cs.rejected_at IS NULL AND cs.clocked_out_at IS NOT NULL
        THEN public.clock_session_approval_hold(cs.id)
    END,
    COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
               'id', e.id,
               'kind', e.kind,
               'typed_by', e.typed_by,
               'typed_by_name', e.typed_by_name,
               'typed_at', e.typed_at,
               'seconds', e.typed_seconds,
               'day_seconds_before', e.day_seconds_before,
               'day_seconds_after', e.day_seconds_after,
               'self', (e.typed_by = e.user_id),
               'confirmed_by_name', e.confirmed_by_name,
               'confirmed_at', e.confirmed_at
             ) ORDER BY e.typed_at)
      FROM public.clock_typed_entries e
      WHERE e.user_id = cs.user_id
        AND (
          (e.kind = 'added' AND e.typed_range && s.span)
          OR (e.kind = 'trimmed' AND e.work_date = cs.work_date AND (e.typed_range && s.span OR e.typed_range -|- s.span))
        )
    ), '[]'::jsonb)
  FROM public.clock_sessions cs
  CROSS JOIN LATERAL (
    SELECT tstzrange(
      LEAST(cs.clocked_in_at, COALESCE(cs.clocked_out_at, now())),
      GREATEST(cs.clocked_in_at, COALESCE(cs.clocked_out_at, now()))) AS span
  ) s
  WHERE cs.id = ANY(p_session_ids);
$$;

-- Added hours nobody else has looked at yet, for the people who approve hours. state:
-- 'pending' — a session under it still waits for approval; 'approved' — every session under it
-- is approved (typed onto approved hours, or approved by the typist before the rule was on).
CREATE OR REPLACE FUNCTION public.list_typed_hours_waiting()
RETURNS TABLE(
  entry_id uuid,
  user_id uuid,
  person_name text,
  work_date date,
  typed_by uuid,
  typed_by_name text,
  typed_at timestamptz,
  typed_seconds integer,
  day_seconds_before integer,
  day_seconds_after integer,
  self_typed boolean,
  state text,
  session_ids uuid[],
  can_act boolean
)
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_actor uuid := auth.uid();
BEGIN
  IF v_actor IS NULL OR NOT (public.is_dev() OR public.has_payroll_access() OR public.is_assistant()) THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    e.id,
    e.user_id,
    COALESCE(NULLIF(trim(u.name), ''), 'Someone'),
    e.work_date,
    e.typed_by,
    e.typed_by_name,
    e.typed_at,
    e.typed_seconds,
    e.day_seconds_before,
    e.day_seconds_after,
    (e.typed_by = e.user_id),
    CASE WHEN ss.any_pending THEN 'pending' ELSE 'approved' END,
    ss.ids,
    (e.typed_by IS DISTINCT FROM v_actor AND e.user_id <> v_actor)
  FROM public.clock_typed_entries e
  JOIN public.users u ON u.id = e.user_id
  CROSS JOIN LATERAL (
    SELECT array_agg(cs.id ORDER BY cs.clocked_in_at) AS ids,
           bool_or(cs.approved_at IS NULL) AS any_pending
    FROM public.clock_sessions cs
    WHERE cs.user_id = e.user_id
      AND cs.clocked_out_at IS NOT NULL
      AND cs.rejected_at IS NULL
      AND e.typed_range && tstzrange(LEAST(cs.clocked_in_at, cs.clocked_out_at), GREATEST(cs.clocked_in_at, cs.clocked_out_at))
  ) ss
  WHERE e.kind = 'added'
    AND e.confirmed_at IS NULL
    AND ss.ids IS NOT NULL
  ORDER BY e.typed_at;
END;
$$;

COMMENT ON FUNCTION public.clock_session_approval_hold(uuid) IS
  'Why the caller may not approve this clock session: own (their own hours), typed (they typed hours onto it and nobody else has looked), or NULL. Switched by app_settings.typed_hours_second_look_v1. v2.4242.';
COMMENT ON FUNCTION public.approve_clock_sessions_v2(uuid[]) IS
  'approve_clock_sessions plus held_own / held_typed: the sessions left for someone else. v2.4242.';
COMMENT ON FUNCTION public.clock_typed_stamps(uuid[]) IS
  'Per clock session: the caller''s approval hold and the typed-hours ledger entries that touch it. v2.4242.';
COMMENT ON FUNCTION public.list_typed_hours_waiting() IS
  'Added hours with no second look yet, for the people who approve hours (dev, payroll access, office). v2.4242.';
COMMENT ON FUNCTION public.confirm_clock_typed_entry(uuid) IS
  'The second look on typed hours that are already approved. Returns NULL, or the reason it was refused. v2.4242.';

REVOKE ALL ON FUNCTION public.clock_typed_drop_slivers(tstzmultirange, integer) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.clock_typed_seconds(tstzmultirange) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.typed_hours_rule_applies(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.clock_sessions_typed_snapshot() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.clock_sessions_typed_record() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.clock_session_approval_hold(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.clock_sessions_guard_approval() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.confirm_clock_typed_entry(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.approve_clock_sessions_v2(uuid[]) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.clock_typed_stamps(uuid[]) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.list_typed_hours_waiting() FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.clock_typed_drop_slivers(tstzmultirange, integer) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.clock_typed_seconds(tstzmultirange) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.typed_hours_rule_applies(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.clock_session_approval_hold(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.confirm_clock_typed_entry(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.approve_clock_sessions_v2(uuid[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.clock_typed_stamps(uuid[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_typed_hours_waiting() TO authenticated;

SELECT public.apply_read_only_write_blocks();
SELECT public.apply_read_only_stmt_blocks();
