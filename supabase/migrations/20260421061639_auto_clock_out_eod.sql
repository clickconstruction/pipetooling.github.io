-- End-of-day auto clock-out: close open clock_sessions at last instant of each row's work_date
-- in America/Chicago (company calendar). Runs once per day when local time is 23:59 via pg_cron.
-- Covers user_punch and salary_schedule; includes stale rows (work_date before today).

CREATE OR REPLACE FUNCTION public.auto_clock_out_open_sessions_eod()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_today date;
BEGIN
  v_today := (clock_timestamp() AT TIME ZONE 'America/Chicago')::date;

  UPDATE public.clock_sessions cs
  SET clocked_out_at = GREATEST(
    ((cs.work_date + interval '1 day')::timestamp AT TIME ZONE 'America/Chicago') - interval '1 microsecond',
    cs.clocked_in_at + interval '1 millisecond'
  )
  WHERE cs.clocked_out_at IS NULL
    AND cs.rejected_at IS NULL
    AND cs.revoked_at IS NULL
    AND cs.work_date <= v_today;
END;
$$;

COMMENT ON FUNCTION public.auto_clock_out_open_sessions_eod() IS
  'Definer: set clocked_out_at to end of cs.work_date in America/Chicago (last microsecond before next calendar day) for all open sessions with work_date <= today (Chicago). Stale rows get end-of-that-day; same-day rows get tonight''s EOD. clocked_out_at is strictly after clocked_in_at. Service role only; idempotent.';

CREATE OR REPLACE FUNCTION public.auto_clock_out_eod_if_due()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_hour integer;
  v_minute integer;
BEGIN
  v_hour := EXTRACT(HOUR FROM (clock_timestamp() AT TIME ZONE 'America/Chicago'))::integer;
  v_minute := EXTRACT(MINUTE FROM (clock_timestamp() AT TIME ZONE 'America/Chicago'))::integer;

  IF v_hour = 23 AND v_minute = 59 THEN
    PERFORM public.auto_clock_out_open_sessions_eod();
  END IF;
END;
$$;

COMMENT ON FUNCTION public.auto_clock_out_eod_if_due() IS
  'Definer: when America/Chicago local time is 23:59, call auto_clock_out_open_sessions_eod. Invoked every minute by pg_cron; no-op other minutes.';

REVOKE ALL ON FUNCTION public.auto_clock_out_open_sessions_eod() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.auto_clock_out_eod_if_due() FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.auto_clock_out_open_sessions_eod() TO service_role;
GRANT EXECUTE ON FUNCTION public.auto_clock_out_eod_if_due() TO service_role;

-- pg_cron: run every minute; guard inside function (Chicago 23:59 only).
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;

SELECT cron.unschedule(jobid) FROM cron.job WHERE jobname = 'auto-clock-out-eod';

SELECT cron.schedule(
  'auto-clock-out-eod',
  '* * * * *',
  $$ SELECT public.auto_clock_out_eod_if_due(); $$
);
