SET lock_timeout = '3s';

-- v2.4271 — the assistant hours window fences what an assistant can type, not only what she sees.
--
-- `app_settings.assistant_hours_window_weeks_v1` (v2.1592) clamps the People → Hours tab, the
-- clock strip and Who's where on the client: an assistant sees the current week plus N-1 back.
-- Nothing on the server knew the window, so the Add / Edit clock session doors — and the leader
-- split RPCs, which bypass their this-or-last-week fence for assistants — could put hours on any
-- day. This migration gives the database the same floor (the same Sunday math as
-- `src/lib/people/assistantHoursWindow.ts`, America/Chicago) and a BEFORE trigger on
-- `clock_sessions` that refuses an insert, or a change to the time columns, on a day before it.
-- Approvals, rejections, job links and notes are not time columns and pass. Whoever is not an
-- assistant (role = 'assistant' exactly, as the client reads it — controllers, devs and
-- pay-approved masters are never limited) gets a NULL floor and is untouched; so is a write with
-- no signed-in person (edge functions, the service role).

-- The pure math, so the test bed can pin it on fixed dates against the TypeScript kernel.
CREATE OR REPLACE FUNCTION public.assistant_hours_window_floor_for(p_today date, p_weeks integer)
RETURNS date
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT CASE
    WHEN p_today IS NULL OR p_weeks IS NULL OR p_weeks <= 0 THEN NULL
    ELSE p_today - EXTRACT(DOW FROM p_today)::integer - (p_weeks - 1) * 7
  END;
$$;

COMMENT ON FUNCTION public.assistant_hours_window_floor_for(date, integer) IS
  'Earliest day of an hours window of p_weeks (the current week counts as 1) on p_today: the Sunday (p_weeks - 1) weeks before this week''s Sunday. NULL for no limit (weeks <= 0). Mirrors assistantHoursWindowFloorYmd in src/lib/people/assistantHoursWindow.ts.';

-- The caller's floor: NULL unless the caller is an assistant and the setting limits them.
CREATE OR REPLACE FUNCTION public.assistant_hours_window_floor()
RETURNS date
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_role text;
  v_raw numeric;
  v_weeks integer;
BEGIN
  IF v_uid IS NULL THEN
    RETURN NULL;
  END IF;
  SELECT role INTO v_role FROM public.users WHERE id = v_uid;
  IF v_role IS DISTINCT FROM 'assistant' THEN
    RETURN NULL;
  END IF;
  SELECT value_num INTO v_raw FROM public.app_settings WHERE key = 'assistant_hours_window_weeks_v1';
  -- Same reading as parseAssistantHoursWindowWeeks: missing or negative = 3, 0 = unlimited, else whole weeks, at least 1.
  IF v_raw IS NULL OR v_raw < 0 THEN
    v_weeks := 3;
  ELSIF v_raw = 0 THEN
    RETURN NULL;
  ELSE
    v_weeks := GREATEST(1, floor(v_raw)::integer);
  END IF;
  RETURN public.assistant_hours_window_floor_for((now() AT TIME ZONE 'America/Chicago')::date, v_weeks);
END;
$$;

COMMENT ON FUNCTION public.assistant_hours_window_floor() IS
  'The earliest day the signed-in assistant may see or type hours on (app_settings.assistant_hours_window_weeks_v1, America/Chicago); NULL for anyone who is not limited. Read by clock_sessions_window_fence.';

REVOKE ALL ON FUNCTION public.assistant_hours_window_floor_for(date, integer) FROM public;
REVOKE ALL ON FUNCTION public.assistant_hours_window_floor() FROM public;
GRANT EXECUTE ON FUNCTION public.assistant_hours_window_floor_for(date, integer) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.assistant_hours_window_floor() TO authenticated, service_role;

-- The fence. BEFORE INSERT, and BEFORE UPDATE of the time columns only, so approving, rejecting,
-- revoking, linking a job or editing notes on an older session still goes through.
CREATE OR REPLACE FUNCTION public.clock_sessions_window_fence()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_floor date;
  v_day date;
BEGIN
  v_floor := public.assistant_hours_window_floor();
  IF v_floor IS NULL THEN
    RETURN NEW;
  END IF;
  v_day := LEAST(NEW.work_date, (NEW.clocked_in_at AT TIME ZONE 'America/Chicago')::date);
  IF TG_OP = 'UPDATE' THEN
    v_day := LEAST(v_day, OLD.work_date);
  END IF;
  IF v_day < v_floor THEN
    RAISE EXCEPTION '% is the earliest day in your hours window. Ask the owner for earlier days.',
      to_char(v_floor, 'Dy Mon FMDD')
      USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS clock_sessions_window_fence ON public.clock_sessions;
CREATE TRIGGER clock_sessions_window_fence
  BEFORE INSERT OR UPDATE OF clocked_in_at, clocked_out_at, work_date ON public.clock_sessions
  FOR EACH ROW EXECUTE FUNCTION public.clock_sessions_window_fence();

COMMENT ON TRIGGER clock_sessions_window_fence ON public.clock_sessions IS
  'An assistant limited by assistant_hours_window_weeks_v1 cannot insert a session, or move one, onto a day before her window''s floor (v2.4271).';
