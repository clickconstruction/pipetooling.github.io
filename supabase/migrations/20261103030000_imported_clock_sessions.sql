SET lock_timeout = '3s';

-- Imported clock sessions (v2.6425): a third origin and one dev-only door for the days the app never recorded.
--
-- The clock began on 2026-03-12, so a worker's days before it live only in the bank, in trip records and in
-- the person's own word. The Signed hours statement (#212) prints such a span as the worker's declaration and
-- nothing else; the Costs tab and the development scoreboard see nothing. This migration lets a dev put those
-- days into clock_sessions as ordinary rows with origin = 'imported', one row a day, unapproved, each note
-- naming where the day came from, so a controller or dev approves them through the normal door and every
-- reader of the clock sees them as it sees a punch.
--
--   * origin gains 'imported' beside 'user_punch' and 'salary_schedule'. The insert policies still admit
--     only user_punch, so nothing but this function (or the service role) writes an imported row.
--   * One imported row a person, a day and a job: a partial unique index. A second run of the same rows
--     inserts nothing and says how many it skipped, so the import is safe to run again.
--   * import_clock_sessions(p_rows jsonb) — SECURITY DEFINER, devs only, every row checked (a known person who
--     is not a sample, a job that is not billing-only, out after in and within sixteen hours, the day equal to
--     the clock-in's calendar day in the company's zone, a note that names the source). A row that fails is
--     named in the answer with its reason and the rest still go in; the answer is
--     { inserted, skipped, refused: [{ row, reason }] }.
--   * approved_at stays null. The typed-hours triggers record only user_punch rows, so an imported row holds
--     nobody from approving it; the approval door (approve_clock_sessions_v2) treats it as any pending
--     session, and the crew-day and last-work-date triggers run as for a punch.

ALTER TABLE public.clock_sessions DROP CONSTRAINT IF EXISTS clock_sessions_origin_check;
ALTER TABLE public.clock_sessions
  ADD CONSTRAINT clock_sessions_origin_check
  CHECK (origin = ANY (ARRAY['user_punch'::text, 'salary_schedule'::text, 'imported'::text])) NOT VALID;
ALTER TABLE public.clock_sessions VALIDATE CONSTRAINT clock_sessions_origin_check;

CREATE UNIQUE INDEX IF NOT EXISTS clock_sessions_imported_one_a_day_a_job
  ON public.clock_sessions (user_id, work_date, job_ledger_id)
  WHERE origin = 'imported';

CREATE OR REPLACE FUNCTION public.import_clock_sessions(p_rows jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row jsonb;
  v_i int := 0;
  v_user uuid;
  v_job uuid;
  v_day date;
  v_in timestamptz;
  v_out timestamptz;
  v_note text;
  v_id uuid;
  v_inserted int := 0;
  v_skipped int := 0;
  v_refused jsonb := '[]'::jsonb;
  v_reason text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  IF NOT public.is_dev() THEN
    RAISE EXCEPTION 'import_clock_sessions: only a dev imports clock sessions' USING ERRCODE = '42501';
  END IF;
  IF p_rows IS NULL OR jsonb_typeof(p_rows) <> 'array' THEN
    RAISE EXCEPTION 'import_clock_sessions: p_rows must be a JSON array of rows';
  END IF;

  FOR v_row IN SELECT value FROM jsonb_array_elements(p_rows) LOOP
    v_i := v_i + 1;
    v_reason := NULL;
    BEGIN
      v_user := (v_row->>'user_id')::uuid;
      v_job := (v_row->>'job_ledger_id')::uuid;
      v_day := (v_row->>'work_date')::date;
      v_in := (v_row->>'clocked_in_at')::timestamptz;
      v_out := (v_row->>'clocked_out_at')::timestamptz;
      v_note := btrim(COALESCE(v_row->>'notes', ''));
    EXCEPTION WHEN OTHERS THEN
      v_refused := v_refused || jsonb_build_object('row', v_i, 'reason', 'a field would not read: ' || SQLERRM);
      CONTINUE;
    END;

    IF v_user IS NULL OR v_job IS NULL OR v_day IS NULL OR v_in IS NULL OR v_out IS NULL THEN
      v_reason := 'user_id, job_ledger_id, work_date, clocked_in_at and clocked_out_at are all required';
    ELSIF NOT EXISTS (SELECT 1 FROM public.users u WHERE u.id = v_user AND COALESCE(u.is_sample, false) = false) THEN
      v_reason := 'no such person, or a sample account';
    ELSIF NOT EXISTS (SELECT 1 FROM public.jobs_ledger j WHERE j.id = v_job AND COALESCE(j.billing_only, false) = false) THEN
      v_reason := 'no such job, or a billing-only job';
    ELSIF v_out <= v_in THEN
      v_reason := 'clocked_out_at must be after clocked_in_at';
    ELSIF v_out - v_in > interval '16 hours' THEN
      v_reason := 'a day of more than sixteen hours';
    ELSIF v_day <> (v_in AT TIME ZONE 'America/Chicago')::date THEN
      v_reason := 'work_date must be the calendar day of clocked_in_at in the company''s time zone';
    ELSIF v_note = '' THEN
      v_reason := 'the note must name where the day came from';
    END IF;

    IF v_reason IS NOT NULL THEN
      v_refused := v_refused || jsonb_build_object('row', v_i, 'reason', v_reason);
      CONTINUE;
    END IF;

    v_id := NULL;
    INSERT INTO public.clock_sessions (user_id, job_ledger_id, work_date, clocked_in_at, clocked_out_at, notes, origin)
    VALUES (v_user, v_job, v_day, v_in, v_out, v_note, 'imported')
    ON CONFLICT (user_id, work_date, job_ledger_id) WHERE origin = 'imported' DO NOTHING
    RETURNING id INTO v_id;
    IF v_id IS NULL THEN
      v_skipped := v_skipped + 1;
    ELSE
      v_inserted := v_inserted + 1;
    END IF;
  END LOOP;

  RETURN jsonb_build_object('inserted', v_inserted, 'skipped', v_skipped, 'refused', v_refused);
END;
$$;

COMMENT ON FUNCTION public.import_clock_sessions(jsonb) IS
  'Devs only. Puts days the app never recorded into clock_sessions as origin = imported, one row a day, unapproved, each note naming its source; one imported row a person, a day and a job, so a second run skips what is there. Answers { inserted, skipped, refused: [{ row, reason }] }. v2.6425.';

REVOKE ALL ON FUNCTION public.import_clock_sessions(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.import_clock_sessions(jsonb) TO authenticated;
