SET lock_timeout = '3s';

-- Split a trip in two (v2.7891, punch list #379, one of the parts the trip record owed).
--
-- A trip is one going out to a site and coming back. A trip that grew on the phone a day at a time, or one typed
-- from memory, can turn out to be two: the crew went home in the middle and came back. Until now the only fix was to
-- change the trip to its first part and type the second part again as a new trip.
--
-- One function, no table, column or index. `trip_split(trip, from_day, dry_run)` cuts a trip at a day:
--   * the trip keeps its id, its number and every day before that day;
--   * a new trip on the same home takes that day and every day after it, with the number the home hands out next.
-- Each person goes where their days are, and somebody with days on both sides is on both trips. Both keep what the
-- trip was for, who asked, how it went and the jobs its work goes on.
--
-- It writes through `trip_save`, twice, inside this one call, so the two saves land together or not at all, and
-- every rule the save holds is held here without being written twice. SECURITY INVOKER, like the save: the trips
-- tables' own policies decide who, so a training account, a twin and somebody who left are refused where the save
-- refuses them.
--
-- Three things the save does not know:
--   1. A trip already on a bill keeps its line (`jobs_ledger_fixtures.trip_id` names the trip that stays). The new
--      trip then starts with no billing said, so nothing reads *Extra, not billed yet* for work a line may cover.
--   2. `trips.ended_at` (the phone's End the trip). The new trip takes the stamp the trip had: ended if it was, open
--      if it was, so a trip still growing on the phone keeps growing as the second trip. The first trip is ended
--      once its last day is behind today, so the phone stops offering it.
--   3. Nothing else follows the split. No clock row, bill or cost changes, as with every trip write.
--
-- The dry run is the save's own dry run for each half, and writes nothing. Idempotent. The client that calls this
-- ships in the same PR, so the push comes right after the merge.

CREATE OR REPLACE FUNCTION public.trip_split(p_trip_id uuid, p_from_day date, p_dry_run boolean DEFAULT false)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $fn$
DECLARE
  v_uid uuid := auth.uid();
  t record;
  v_day text;
  v_before jsonb;
  v_after jsonb;
  v_jobs jsonb;
  v_new uuid := gen_random_uuid();
  v_on_bill boolean;
  v_billing text;
  v_a jsonb;
  v_b jsonb;
  v_ra jsonb;
  v_rb jsonb;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Sign in to split a trip.' USING ERRCODE = '42501';
  END IF;
  IF NOT public.trips_office() THEN
    RAISE EXCEPTION 'A trip is split by the office or a leader.' USING ERRCODE = '42501';
  END IF;
  IF p_trip_id IS NULL OR p_from_day IS NULL THEN
    RAISE EXCEPTION 'Name the trip and the day its second part starts.' USING ERRCODE = '22023';
  END IF;

  SELECT tr.id, tr.development_id, tr.job_id, tr.purpose, tr.asked_by, tr.asked_who, tr.asked_how, tr.outcome,
         tr.billing, tr.ended_at, tr.trip_number
    INTO t
  FROM public.trips tr WHERE tr.id = p_trip_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'That trip is not here any more. Close this and look again.' USING ERRCODE = '22023';
  END IF;

  -- Each person's days on either side of the day. A day is a key like 2026-11-14, so the text order is the day order.
  v_day := to_char(p_from_day, 'YYYY-MM-DD');
  SELECT
    COALESCE(jsonb_agg(jsonb_build_object('person_id', tp.person_id, 'user_id', tp.user_id, 'name', tp.person_name, 'days', b.days)
                       ORDER BY tp.person_name, tp.id) FILTER (WHERE b.days <> '{}'::jsonb), '[]'::jsonb),
    COALESCE(jsonb_agg(jsonb_build_object('person_id', tp.person_id, 'user_id', tp.user_id, 'name', tp.person_name, 'days', a.days)
                       ORDER BY tp.person_name, tp.id) FILTER (WHERE a.days <> '{}'::jsonb), '[]'::jsonb)
    INTO v_before, v_after
  FROM public.trip_people tp
  CROSS JOIN LATERAL (SELECT COALESCE(jsonb_object_agg(e.key, e.value), '{}'::jsonb) AS days FROM jsonb_each(tp.days) AS e WHERE e.key < v_day) AS b
  CROSS JOIN LATERAL (SELECT COALESCE(jsonb_object_agg(e.key, e.value), '{}'::jsonb) AS days FROM jsonb_each(tp.days) AS e WHERE e.key >= v_day) AS a
  WHERE tp.trip_id = p_trip_id;

  IF jsonb_array_length(v_before) = 0 THEN
    RAISE EXCEPTION 'Pick a later day. No day of this trip is before %.', v_day USING ERRCODE = '22023';
  END IF;
  IF jsonb_array_length(v_after) = 0 THEN
    RAISE EXCEPTION 'Pick an earlier day. No day of this trip is on or after %.', v_day USING ERRCODE = '22023';
  END IF;

  SELECT COALESCE(jsonb_agg(tj.job_id ORDER BY tj.job_id), '[]'::jsonb) INTO v_jobs FROM public.trip_jobs tj WHERE tj.trip_id = p_trip_id;
  -- One trip, one line. The line stays with the trip that keeps the id.
  SELECT EXISTS (SELECT 1 FROM public.jobs_ledger_fixtures f WHERE f.trip_id = p_trip_id) INTO v_on_bill;
  v_billing := CASE WHEN v_on_bill THEN NULL ELSE t.billing END;

  v_a := jsonb_build_object(
    'id', p_trip_id, 'development_id', t.development_id, 'job_id', t.job_id, 'purpose', t.purpose,
    'asked_by', t.asked_by, 'asked_who', t.asked_who, 'asked_how', t.asked_how, 'outcome', t.outcome,
    'billing', t.billing, 'people', v_before, 'job_ids', v_jobs);
  v_b := jsonb_build_object(
    'id', v_new, 'development_id', t.development_id, 'job_id', t.job_id, 'purpose', t.purpose,
    'asked_by', t.asked_by, 'asked_who', t.asked_who, 'asked_how', t.asked_how, 'outcome', t.outcome,
    'billing', v_billing, 'via', 'app', 'people', v_after, 'job_ids', v_jobs);

  IF p_dry_run THEN
    v_ra := public.trip_save(v_a, true);
    v_rb := public.trip_save(v_b, true);
    RETURN jsonb_build_object('dry_run', true, 'would', 'split', 'trip_id', p_trip_id, 'trip_number', t.trip_number,
      'from_day', v_day, 'first', v_ra, 'second', v_rb - 'trip_id', 'on_bill', v_on_bill, 'second_billing', v_billing);
  END IF;

  -- The new trip first, then the trip cut down to its first part. One call, so both land or neither does.
  v_rb := public.trip_save(v_b, false);
  v_ra := public.trip_save(v_a, false);

  IF t.ended_at IS NOT NULL THEN
    UPDATE public.trips SET ended_at = t.ended_at WHERE id = v_new;
  END IF;
  IF (v_ra ->> 'last_day') < public.app_today()::text THEN
    UPDATE public.trips SET ended_at = COALESCE(ended_at, now()) WHERE id = p_trip_id;
  END IF;

  RETURN jsonb_build_object('dry_run', false, 'did', 'split', 'trip_id', p_trip_id, 'trip_number', v_ra -> 'trip_number',
    'new_trip_id', v_new, 'new_trip_number', v_rb -> 'trip_number', 'from_day', v_day,
    'first', v_ra, 'second', v_rb, 'on_bill', v_on_bill, 'second_billing', v_billing);
END
$fn$;

ALTER FUNCTION public.trip_split(uuid, date, boolean) OWNER TO postgres;
COMMENT ON FUNCTION public.trip_split(uuid, date, boolean) IS 'Trips (#379): split a trip in two at a day. The trip keeps its id, its number and every day before the day; a new trip on the same home takes the day and every day after it, with the next number. Each person goes where their days are. Both keep what it was for, who asked, how it went and the jobs. Written through trip_save twice inside this call, so both land or neither. SECURITY INVOKER: the trips tables'' policies decide who. A trip on a bill keeps its line and the new trip starts with no billing said. The new trip takes the trip''s ended stamp, and the first is ended once its last day is behind today. The dry run writes nothing.';
REVOKE EXECUTE ON FUNCTION public.trip_split(uuid, date, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.trip_split(uuid, date, boolean) TO authenticated, service_role;
