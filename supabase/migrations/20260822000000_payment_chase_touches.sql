SET lock_timeout = '3s';

-- Payment chase touches (v2.2025, chase-loop PR 1): the call log behind the
-- Pipeline's payment follow-up queue. Each row is one recorded outcome of a
-- collections-style touch on a customer (optionally pinned to one bill's
-- job): a promise taken, a can't-reach, a resend, a dispute, or a plain
-- note. The queue itself is DERIVED client-side (billed rows + expected-pay
-- models + promises + these touches) — a paid bill falls out of the loop on
-- its own; touches only add the memory the derivation can't infer: what was
-- already tried, when, and what the customer said.
--
-- Same access pattern as job_promised_pay_dates (v2.1944): the table is
-- dev-only for debugging; all traffic goes through the gated SECURITY
-- DEFINER RPCs below. Writers are the office roles that work the billed
-- section (dev / master / assistant-like); read-only training accounts are
-- stopped by the read_only_block_stmt statement trigger.

CREATE TABLE IF NOT EXISTS public.job_payment_chase_touches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  -- NULL = a whole-account touch (can't reach, account-level note).
  job_id uuid REFERENCES public.jobs_ledger(id) ON DELETE CASCADE,
  outcome text NOT NULL CHECK (outcome IN ('promised', 'cant_reach', 'resend', 'dispute', 'note')),
  note text,
  -- outcome = 'promised': the date the customer named (also written to
  -- job_promised_pay_dates by the client, which owns the chips).
  promised_date date,
  -- outcome = 'cant_reach': days before the customer re-enters the queue.
  snooze_days integer CHECK (snooze_days IS NULL OR snooze_days BETWEEN 1 AND 60),
  -- outcome = 'dispute': set when the dispute is resolved (bill fixed, sent
  -- to Collections, or dropped). Unresolved disputes hold the bill out of
  -- the ask queue.
  resolved_at timestamptz,
  resolved_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  created_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS job_payment_chase_touches_customer_created_idx
  ON public.job_payment_chase_touches (customer_id, created_at DESC);

COMMENT ON TABLE public.job_payment_chase_touches IS
  'Call log for the Pipeline payment follow-up queue: one row per recorded chase outcome (promised / cant_reach / resend / dispute / note) on a customer, optionally pinned to a job. Written via add_payment_chase_touch; read via list_payment_chase_touches; disputes resolved via resolve_payment_chase_dispute.';

ALTER TABLE public.job_payment_chase_touches ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Devs manage payment chase touches" ON public.job_payment_chase_touches;
CREATE POLICY "Devs manage payment chase touches" ON public.job_payment_chase_touches
  FOR ALL USING (public.is_dev()) WITH CHECK (public.is_dev());

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.job_payment_chase_touches TO authenticated;

CREATE OR REPLACE FUNCTION public.add_payment_chase_touch(
  p_customer_id uuid,
  p_job_id uuid,
  p_outcome text,
  p_note text,
  p_promised_date date,
  p_snooze_days integer
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ok boolean;
  v_id uuid;
BEGIN
  SELECT public.is_dev()
      OR public.is_assistant()
      OR EXISTS (
           SELECT 1 FROM public.users u
           WHERE u.id = auth.uid() AND u.role = 'master_technician'
         )
    INTO v_ok;
  IF NOT COALESCE(v_ok, false) THEN
    RAISE EXCEPTION 'Not allowed to record payment chase touches';
  END IF;
  IF p_outcome NOT IN ('promised', 'cant_reach', 'resend', 'dispute', 'note') THEN
    RAISE EXCEPTION 'Unknown chase outcome %', p_outcome;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.customers c WHERE c.id = p_customer_id) THEN
    RAISE EXCEPTION 'Customer not found';
  END IF;
  IF p_job_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.jobs_ledger j WHERE j.id = p_job_id) THEN
    RAISE EXCEPTION 'Job not found';
  END IF;

  INSERT INTO public.job_payment_chase_touches
    (customer_id, job_id, outcome, note, promised_date, snooze_days, created_by)
  VALUES
    (p_customer_id, p_job_id, p_outcome, NULLIF(trim(COALESCE(p_note, '')), ''), p_promised_date, p_snooze_days, auth.uid())
  RETURNING id INTO v_id;
  RETURN jsonb_build_object('id', v_id);
END;
$$;

COMMENT ON FUNCTION public.add_payment_chase_touch(uuid, uuid, text, text, date, integer) IS
  'Record one payment-chase outcome on a customer (optionally pinned to a job). Dev/master/assistant-like only.';

CREATE OR REPLACE FUNCTION public.resolve_payment_chase_dispute(p_touch_id uuid)
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
    RAISE EXCEPTION 'Not allowed to resolve payment disputes';
  END IF;

  UPDATE public.job_payment_chase_touches
     SET resolved_at = now(), resolved_by = auth.uid()
   WHERE id = p_touch_id AND outcome = 'dispute' AND resolved_at IS NULL;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Dispute not found or already resolved';
  END IF;
  RETURN jsonb_build_object('resolved', true);
END;
$$;

COMMENT ON FUNCTION public.resolve_payment_chase_dispute(uuid) IS
  'Mark a dispute touch resolved (bill fixed, sent to Collections, or dropped). Dev/master/assistant-like only.';

-- Recent touches for queue derivation: the last 180 days, newest first, with
-- recorder names. Same read gate as the writers (the chase queue is office
-- work — primary does not see the call log).
CREATE OR REPLACE FUNCTION public.list_payment_chase_touches()
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
           WHERE u.id = (SELECT auth.uid()) AND u.role = 'master_technician'
         )
      AS ok
)
SELECT CASE WHEN NOT (SELECT ok FROM gate) THEN NULL ELSE
  COALESCE(
    (SELECT jsonb_agg(
              jsonb_build_object(
                'id', t.id,
                'customerId', t.customer_id,
                'jobId', t.job_id,
                'outcome', t.outcome,
                'note', t.note,
                'promisedYmd', CASE WHEN t.promised_date IS NULL THEN NULL ELSE to_char(t.promised_date, 'YYYY-MM-DD') END,
                'snoozeDays', t.snooze_days,
                'resolvedAt', t.resolved_at,
                'createdAt', t.created_at,
                'createdByName', COALESCE(NULLIF(trim(u.name), ''), 'office')
              ) ORDER BY t.created_at DESC)
       FROM public.job_payment_chase_touches t
       LEFT JOIN public.users u ON u.id = t.created_by
       WHERE t.created_at >= now() - interval '180 days'),
    '[]'::jsonb
  )
END;
$$;

COMMENT ON FUNCTION public.list_payment_chase_touches() IS
  'Payment-chase touches from the last 180 days, newest first, with recorder names — feeds the Pipeline follow-up queue. NULL outside dev/master/assistant-like.';

REVOKE EXECUTE ON FUNCTION public.add_payment_chase_touch(uuid, uuid, text, text, date, integer) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.add_payment_chase_touch(uuid, uuid, text, text, date, integer) FROM anon;
GRANT EXECUTE ON FUNCTION public.add_payment_chase_touch(uuid, uuid, text, text, date, integer) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.resolve_payment_chase_dispute(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.resolve_payment_chase_dispute(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.resolve_payment_chase_dispute(uuid) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.list_payment_chase_touches() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.list_payment_chase_touches() FROM anon;
GRANT EXECUTE ON FUNCTION public.list_payment_chase_touches() TO authenticated;

SELECT public.apply_read_only_write_blocks();
SELECT public.apply_read_only_stmt_blocks();
