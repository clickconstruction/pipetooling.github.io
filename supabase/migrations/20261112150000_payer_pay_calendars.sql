SET lock_timeout = '3s';

-- Pay calendar (punch list #323, PR 1): a payer who pays on a set day of the month.
--
-- Some commercial contracts pay on a calendar, not at a pace: a pay application in by the
-- cutoff (the last day of the month, or an earlier day) is paid on a set day of a later
-- month, most often the next. The app has had no place for either day. One row here holds a
-- payer's calendar (job_id NULL). A job can carry its own row for that payer, or a row that
-- switches the payer's calendar off for that job (off = true); the job rows are read from
-- PR 1 and written from PR 4. A payer with no row reads exactly as before.
--
-- The contract says when a bill is DUE; the payer's record says when it lands. Nothing here
-- changes how pay speed is measured.
--
-- Reads: the roles that read a promised pay date (can_read_payment_promises()), by RLS.
-- Writes: only through set_payer_pay_calendar, gated on the roles that record one
-- (can_write_payment_promises()), which stamps who set it. One definition each, so the two
-- settings can never drift apart.

CREATE TABLE IF NOT EXISTS public.payer_pay_calendars (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payer_customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  job_id uuid REFERENCES public.jobs_ledger(id) ON DELETE CASCADE,
  off boolean NOT NULL DEFAULT false,
  cutoff_day smallint,
  pay_day smallint,
  months_after smallint NOT NULL DEFAULT 1,
  pay_when_paid boolean NOT NULL DEFAULT false,
  clause text NOT NULL DEFAULT '',
  words text NOT NULL DEFAULT '',
  set_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  set_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT payer_pay_calendars_cutoff_day_check CHECK (cutoff_day IS NULL OR cutoff_day BETWEEN 1 AND 28),
  CONSTRAINT payer_pay_calendars_pay_day_check CHECK (pay_day IS NULL OR pay_day BETWEEN 1 AND 31),
  CONSTRAINT payer_pay_calendars_months_after_check CHECK (months_after BETWEEN 0 AND 2),
  -- A row is a calendar (it has a pay day) or one job's off switch; the payer's own row is never an off switch.
  CONSTRAINT payer_pay_calendars_shape_check CHECK ((off AND job_id IS NOT NULL) OR (NOT off AND pay_day IS NOT NULL)),
  CONSTRAINT payer_pay_calendars_clause_len_check CHECK (char_length(clause) <= 40),
  CONSTRAINT payer_pay_calendars_words_len_check CHECK (char_length(words) <= 240)
);

COMMENT ON TABLE public.payer_pay_calendars IS
  'Pay calendar (punch list #323): the day of the month a payer''s bills must be in by (cutoff_day, NULL = the last day) and the day they pay (pay_day, months_after months later). job_id NULL is the payer''s own calendar; a job row is that job''s own, or off = true to switch the payer''s off there. Read by RLS (can_read_payment_promises()); written only by set_payer_pay_calendar.';

CREATE UNIQUE INDEX IF NOT EXISTS payer_pay_calendars_payer_uidx
  ON public.payer_pay_calendars (payer_customer_id) WHERE job_id IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS payer_pay_calendars_payer_job_uidx
  ON public.payer_pay_calendars (payer_customer_id, job_id) WHERE job_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS payer_pay_calendars_job_idx
  ON public.payer_pay_calendars (job_id) WHERE job_id IS NOT NULL;

ALTER TABLE public.payer_pay_calendars ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS payer_pay_calendars_select_billed_money ON public.payer_pay_calendars;
CREATE POLICY payer_pay_calendars_select_billed_money ON public.payer_pay_calendars
  FOR SELECT TO authenticated
  USING (public.can_read_payment_promises());

REVOKE ALL ON TABLE public.payer_pay_calendars FROM anon, authenticated;
GRANT SELECT ON TABLE public.payer_pay_calendars TO authenticated;
GRANT ALL ON TABLE public.payer_pay_calendars TO service_role;

-- Set, replace or clear one calendar. p_job_id NULL is the payer's own; p_calendar NULL clears
-- the row. The calendar is {cutoffDay, payDay, monthsAfter, payWhenPaid, clause, words}, or
-- {off: true} on a job's row. Returns the row as stored, or {cleared: true}.
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
  'Set, replace or clear (NULL calendar) a payer''s pay calendar, or one job''s own; stamps who set it. Gated on can_write_payment_promises() (punch list #323).';

REVOKE EXECUTE ON FUNCTION public.set_payer_pay_calendar(uuid, uuid, jsonb) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.set_payer_pay_calendar(uuid, uuid, jsonb) FROM anon;
GRANT EXECUTE ON FUNCTION public.set_payer_pay_calendar(uuid, uuid, jsonb) TO authenticated;

-- The four fences every CREATE TABLE migration closes with (CLAUDE.md → DB migrations).
SELECT public.apply_read_only_write_blocks();
SELECT public.apply_read_only_stmt_blocks();
SELECT public.apply_digital_twin_write_blocks();
SELECT public.apply_archived_read_blocks();
