SET lock_timeout = '3s';

-- Pay calendar, a number of days after the bill (punch list #341, PR 5).
--
-- A Pay calendar has held one shape of terms: bills in by a cutoff are paid on a set day of a
-- later month. Some contracts pay the other way: a set number of days after the bill is
-- accepted, "net 45". #323 left that out for a payer, since a payer's measured pace is the
-- better guess. A big job on a new contract has no pace of its own, and its contract names the
-- number. One column holds it: days_after. A row is then a calendar (it has a pay day), days
-- after the bill (it has days_after), or one job's off switch, and never two of them.
--
-- The table's reads and its one writer are as they were: RLS through
-- can_read_payment_promises(), set_payer_pay_calendar behind can_write_payment_promises().
-- The function takes {daysAfter, payWhenPaid, clause, words} beside the calendar it took
-- before. A client from before this migration sends no daysAfter and is answered as before.
-- A reader from before it selects no days_after, finds no pay day on such a row, and reads
-- the pace guess for it: the row is skipped, never misread.

ALTER TABLE public.payer_pay_calendars
  ADD COLUMN IF NOT EXISTS days_after smallint;

COMMENT ON COLUMN public.payer_pay_calendars.days_after IS
  'Paid this many days after the bill is accepted (1 to 180), in place of a cutoff and a pay day (punch list #341). NULL on a row that is a calendar or a job''s off switch.';

ALTER TABLE public.payer_pay_calendars
  DROP CONSTRAINT IF EXISTS payer_pay_calendars_days_after_check;
ALTER TABLE public.payer_pay_calendars
  ADD CONSTRAINT payer_pay_calendars_days_after_check CHECK (days_after IS NULL OR days_after BETWEEN 1 AND 180);

-- A row is one job's off switch, a calendar (a pay day) or days after the bill, and only one of them.
ALTER TABLE public.payer_pay_calendars
  DROP CONSTRAINT IF EXISTS payer_pay_calendars_shape_check;
ALTER TABLE public.payer_pay_calendars
  ADD CONSTRAINT payer_pay_calendars_shape_check CHECK (
    (off AND job_id IS NOT NULL AND days_after IS NULL)
    OR (NOT off AND pay_day IS NOT NULL AND days_after IS NULL)
    OR (NOT off AND pay_day IS NULL AND days_after IS NOT NULL)
  );

COMMENT ON TABLE public.payer_pay_calendars IS
  'Pay calendar (punch list #323): the day of the month a payer''s bills must be in by (cutoff_day, NULL = the last day) and the day they pay (pay_day, months_after months later); or, since punch list #341, days_after: paid that many days after the bill is accepted. job_id NULL is the payer''s own; a job row is that job''s own, or off = true to switch the payer''s off there. Read by RLS (can_read_payment_promises()); written only by set_payer_pay_calendar.';

-- Set, replace or clear one calendar. p_job_id NULL is the payer's own; p_calendar NULL clears
-- the row. The calendar is {cutoffDay, payDay, monthsAfter, payWhenPaid, clause, words}, or
-- {daysAfter, payWhenPaid, clause, words}, or {off: true} on a job's row. Returns the row as
-- stored, or {cleared: true}.
CREATE OR REPLACE FUNCTION public.set_payer_pay_calendar(p_payer_customer_id uuid, p_job_id uuid, p_calendar jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_off boolean;
  v_cutoff int;
  v_pay int;
  v_months int;
  v_days int;
  v_row public.payer_pay_calendars;
BEGIN
  IF NOT COALESCE(public.can_write_payment_promises(), false) THEN
    RAISE EXCEPTION 'Not allowed to set a pay calendar';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.customers c WHERE c.id = p_payer_customer_id) THEN
    RAISE EXCEPTION 'Payer not found';
  END IF;
  IF p_job_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.jobs_ledger j WHERE j.id = p_job_id) THEN
    RAISE EXCEPTION 'Job not found';
  END IF;

  DELETE FROM public.payer_pay_calendars
   WHERE payer_customer_id = p_payer_customer_id
     AND job_id IS NOT DISTINCT FROM p_job_id;

  IF p_calendar IS NULL OR jsonb_typeof(p_calendar) = 'null' THEN
    RETURN jsonb_build_object('cleared', true);
  END IF;

  v_off := COALESCE((p_calendar ->> 'off')::boolean, false);
  IF v_off THEN
    IF p_job_id IS NULL THEN
      RAISE EXCEPTION 'Only a job can switch a pay calendar off';
    END IF;
    INSERT INTO public.payer_pay_calendars (payer_customer_id, job_id, off, set_by)
    VALUES (p_payer_customer_id, p_job_id, true, auth.uid())
    RETURNING * INTO v_row;
    RETURN to_jsonb(v_row);
  END IF;

  -- A number of days after the bill: no cutoff and no pay day.
  v_days := NULLIF(p_calendar ->> 'daysAfter', '')::int;
  IF v_days IS NOT NULL THEN
    IF v_days < 1 OR v_days > 180 THEN
      RAISE EXCEPTION 'The number of days after the bill is 1 to 180';
    END IF;
    INSERT INTO public.payer_pay_calendars
      (payer_customer_id, job_id, off, days_after, pay_when_paid, clause, words, set_by)
    VALUES (
      p_payer_customer_id,
      p_job_id,
      false,
      v_days,
      COALESCE((p_calendar ->> 'payWhenPaid')::boolean, false),
      left(btrim(COALESCE(p_calendar ->> 'clause', '')), 40),
      left(btrim(COALESCE(p_calendar ->> 'words', '')), 240),
      auth.uid()
    )
    RETURNING * INTO v_row;
    RETURN to_jsonb(v_row);
  END IF;

  v_cutoff := NULLIF(p_calendar ->> 'cutoffDay', '')::int;
  v_pay := NULLIF(p_calendar ->> 'payDay', '')::int;
  v_months := COALESCE(NULLIF(p_calendar ->> 'monthsAfter', '')::int, 1);
  IF v_pay IS NULL OR v_pay < 1 OR v_pay > 31 THEN
    RAISE EXCEPTION 'The pay day is a day of the month, 1 to 31';
  END IF;
  IF v_cutoff IS NOT NULL AND (v_cutoff < 1 OR v_cutoff > 28) THEN
    RAISE EXCEPTION 'The cutoff is the last day of the month, or a day 1 to 28';
  END IF;
  IF v_months < 0 OR v_months > 2 THEN
    RAISE EXCEPTION 'The pay day is in the same month, the next, or the month after that';
  END IF;

  INSERT INTO public.payer_pay_calendars
    (payer_customer_id, job_id, off, cutoff_day, pay_day, months_after, pay_when_paid, clause, words, set_by)
  VALUES (
    p_payer_customer_id,
    p_job_id,
    false,
    v_cutoff,
    v_pay,
    v_months,
    COALESCE((p_calendar ->> 'payWhenPaid')::boolean, false),
    left(btrim(COALESCE(p_calendar ->> 'clause', '')), 40),
    left(btrim(COALESCE(p_calendar ->> 'words', '')), 240),
    auth.uid()
  )
  RETURNING * INTO v_row;
  RETURN to_jsonb(v_row);
END;
$$;

COMMENT ON FUNCTION public.set_payer_pay_calendar(uuid, uuid, jsonb) IS
  'Set, replace or clear (NULL calendar) a payer''s pay calendar, or one job''s own: a cutoff and a pay day, or daysAfter, a number of days after the bill is accepted (punch list #341); stamps who set it. Gated on can_write_payment_promises() (punch list #323).';

REVOKE EXECUTE ON FUNCTION public.set_payer_pay_calendar(uuid, uuid, jsonb) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.set_payer_pay_calendar(uuid, uuid, jsonb) FROM anon;
GRANT EXECUTE ON FUNCTION public.set_payer_pay_calendar(uuid, uuid, jsonb) TO authenticated;
