SET lock_timeout = '3s';

-- Promised pay dates (expected-payment train part 3, after the v2.1924 chips
-- and v2.1925 forecast): when a customer actually names a payment date ("the
-- check run is on the 25th"), the office marks it on the job. The promise
-- overrides the statistical expected-pay estimate on the board chips and in
-- the payment forecast, and records who marked it — the durable home for the
-- answer an assistant used to have to go ask for.
--
-- One promise per job (Malachi's mental model is "when does this JOB get
-- paid", and a GC's promise covers the whole balance). All access goes
-- through the two gated SECURITY DEFINER RPCs below; the table itself is
-- dev-only for debugging.

CREATE TABLE IF NOT EXISTS public.job_promised_pay_dates (
  job_id uuid PRIMARY KEY REFERENCES public.jobs_ledger(id) ON DELETE CASCADE,
  promised_date date NOT NULL,
  marked_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  marked_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.job_promised_pay_dates IS
  'Customer-promised payment date per billed job (overrides the statistical expected-pay estimate on the Stages board + payment forecast). Written via set_job_promised_pay_date; read via list_job_promised_pay_dates.';

ALTER TABLE public.job_promised_pay_dates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Devs manage job promised pay dates" ON public.job_promised_pay_dates;
CREATE POLICY "Devs manage job promised pay dates" ON public.job_promised_pay_dates
  FOR ALL USING (public.is_dev()) WITH CHECK (public.is_dev());

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.job_promised_pay_dates TO authenticated;

-- Upsert / clear (NULL date deletes). Office writers only: the roles that
-- work the billed section (dev, master, assistant-like) — primary reads but
-- does not mark. Read-only training accounts are stopped by the
-- read_only_block_stmt statement trigger like every other write RPC.
CREATE OR REPLACE FUNCTION public.set_job_promised_pay_date(p_job_id uuid, p_date date)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ok boolean;
BEGIN
  SELECT public.is_dev()
      OR public.is_assistant()
      OR EXISTS (
           SELECT 1 FROM public.users u
           WHERE u.id = auth.uid() AND u.role = 'master_technician'
         )
    INTO v_ok;
  IF NOT COALESCE(v_ok, false) THEN
    RAISE EXCEPTION 'Not allowed to set promised pay dates';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.jobs_ledger j WHERE j.id = p_job_id) THEN
    RAISE EXCEPTION 'Job not found';
  END IF;

  IF p_date IS NULL THEN
    DELETE FROM public.job_promised_pay_dates WHERE job_id = p_job_id;
    RETURN jsonb_build_object('cleared', true);
  END IF;

  INSERT INTO public.job_promised_pay_dates (job_id, promised_date, marked_by, marked_at)
  VALUES (p_job_id, p_date, auth.uid(), now())
  ON CONFLICT (job_id)
  DO UPDATE SET promised_date = EXCLUDED.promised_date,
                marked_by = EXCLUDED.marked_by,
                marked_at = now();
  RETURN jsonb_build_object('promisedDate', p_date);
END;
$$;

COMMENT ON FUNCTION public.set_job_promised_pay_date(uuid, date) IS
  'Mark (or clear, with NULL) the customer-promised payment date on a job; stamps who marked it. Dev/master/assistant-like only.';

-- All current promises with the marker's display name, for the board's
-- promised chips. Same read gate as get_billed_customer_pay_speeds (the
-- billed-money roles, primary included); NULL for everyone else.
CREATE OR REPLACE FUNCTION public.list_job_promised_pay_dates()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
WITH gate AS (
  SELECT public.is_dev()
      OR public.is_assistant()
      OR EXISTS (
           SELECT 1 FROM public.users u
           WHERE u.id = (SELECT auth.uid())
             AND u.role IN ('master_technician', 'primary')
         )
      AS ok
)
SELECT CASE WHEN NOT (SELECT ok FROM gate) THEN NULL ELSE
  COALESCE(
    (SELECT jsonb_object_agg(
              p.job_id::text,
              jsonb_build_object(
                'promisedYmd', to_char(p.promised_date, 'YYYY-MM-DD'),
                'markedByName', COALESCE(NULLIF(trim(u.name), ''), 'office'),
                'markedAt', p.marked_at
              ))
       FROM public.job_promised_pay_dates p
       LEFT JOIN public.users u ON u.id = p.marked_by),
    '{}'::jsonb
  )
END;
$$;

COMMENT ON FUNCTION public.list_job_promised_pay_dates() IS
  'All promised pay dates keyed by job id, with marker names — the Stages board''s promised chips. NULL outside dev/master/assistant-like/primary.';

REVOKE EXECUTE ON FUNCTION public.set_job_promised_pay_date(uuid, date) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.set_job_promised_pay_date(uuid, date) FROM anon;
GRANT EXECUTE ON FUNCTION public.set_job_promised_pay_date(uuid, date) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.list_job_promised_pay_dates() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.list_job_promised_pay_dates() FROM anon;
GRANT EXECUTE ON FUNCTION public.list_job_promised_pay_dates() TO authenticated;

SELECT public.apply_read_only_write_blocks();
SELECT public.apply_read_only_stmt_blocks();
