SET lock_timeout = '3s';

-- The job's people (punch list #129, PR 1; to-dos/estimator-money-word/README.md). On a job an estimator bid, the
-- estimator often hears first when the customer will pay or that they paid, and today phones the assistant to have
-- it marked: the promise gates name roles (dev, assistant, master, controller, primary for the read), and an
-- estimator is none of them. The scope here is the job's, not the role's: the office, the job's account manager
-- (jobs_ledger.account_manager_user_id, the field primary_scope already runs on) and the bid's estimator or account
-- manager through jobs_ledger.bid_id. The promise writes and a per-job read open to them. Nothing on jobs_ledger's
-- policies changes: the estimator still reads no job row and reads the money through SECURITY DEFINER functions.
-- The company-wide list_job_payment_promises() stays as it is for the office's readers (the Lien desk, the legal
-- packet, Owner Billing); list_job_payment_promises_for(job) is the per-job read beside it.
-- Idempotent: every function is CREATE OR REPLACE, so a second run changes nothing.

-- ---------- 1 · the predicate ----------

CREATE OR REPLACE FUNCTION public.is_job_people(p_job_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT (SELECT auth.uid()) IS NOT NULL
     AND p_job_id IS NOT NULL
     AND (
       public.is_office_staff()
       OR EXISTS (
            SELECT 1
            FROM public.jobs_ledger j
            LEFT JOIN public.bids b ON b.id = j.bid_id
            JOIN public.users u ON u.id = (SELECT auth.uid())
            WHERE j.id = p_job_id
              AND u.role IN ('estimator', 'primary')
              AND (
                j.account_manager_user_id = u.id
                OR b.estimator_id = u.id
                OR b.account_manager_id = u.id
              )
          )
     );
$$;

COMMENT ON FUNCTION public.is_job_people(uuid) IS
  'The job''s people (punch list #129): the office (dev, master, assistant, controller), or an estimator or primary who is the job''s account manager or the estimator or account manager of the bid the job came from. The scope for the customer''s word on paying.';

REVOKE ALL ON FUNCTION public.is_job_people(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_job_people(uuid) TO authenticated, service_role;

-- ---------- 2 · the writes open to the job's people ----------

-- add_job_payment_promise: the body of 20260913150812, the gate widened. heard_by stays auth.uid().
CREATE OR REPLACE FUNCTION public.add_job_payment_promise(
  p_job_id uuid,
  p_date date,
  p_said_by text DEFAULT NULL,
  p_channel text DEFAULT NULL,
  p_note text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
  v_customer uuid;
BEGIN
  IF NOT (public.can_write_payment_promises() OR public.is_job_people(p_job_id)) THEN
    RAISE EXCEPTION 'Not allowed to record payment promises';
  END IF;
  IF p_date IS NULL THEN
    RAISE EXCEPTION 'A promise needs a date';
  END IF;
  IF p_channel IS NOT NULL AND p_channel NOT IN ('phone', 'text', 'email', 'in_person', 'backfill') THEN
    RAISE EXCEPTION 'Unknown channel %', p_channel;
  END IF;
  SELECT public.job_bill_payer_customer_id(j.bill_to_party, j.customer_id, j.gc_customer_id) INTO v_customer
  FROM public.jobs_ledger j WHERE j.id = p_job_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Job not found';
  END IF;

  INSERT INTO public.job_payment_promises (job_id, customer_id, promised_date, said_by, heard_by, channel, source, note)
  VALUES (p_job_id, v_customer, p_date, NULLIF(trim(p_said_by), ''), auth.uid(), p_channel, 'office', NULLIF(trim(p_note), ''))
  RETURNING id INTO v_id;

  PERFORM set_config('app.promise_event_written', 'on', true);
  INSERT INTO public.job_promised_pay_dates (job_id, promised_date, marked_by, marked_at)
  VALUES (p_job_id, p_date, auth.uid(), now())
  ON CONFLICT (job_id)
  DO UPDATE SET promised_date = EXCLUDED.promised_date,
                marked_by = EXCLUDED.marked_by,
                marked_at = now();
  PERFORM set_config('app.promise_event_written', 'off', true);

  RETURN jsonb_build_object('id', v_id, 'promisedDate', p_date);
END;
$$;

COMMENT ON FUNCTION public.add_job_payment_promise(uuid, date, text, text, text) IS
  'Record a customer payment promise on a job (who said it, channel, note) as an event filed under the job''s payer (bill_to_party rule), and set it as the job''s current promised date. The office, or the job''s people (is_job_people).';

-- void_job_payment_promise: the promise's own job decides.
CREATE OR REPLACE FUNCTION public.void_job_payment_promise(p_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_job uuid;
BEGIN
  SELECT job_id INTO v_job FROM public.job_payment_promises WHERE id = p_id;
  IF NOT (public.can_write_payment_promises() OR (v_job IS NOT NULL AND public.is_job_people(v_job))) THEN
    RAISE EXCEPTION 'Not allowed to void payment promises';
  END IF;
  UPDATE public.job_payment_promises
     SET voided_at = now(), voided_by = auth.uid()
   WHERE id = p_id AND voided_at IS NULL;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Promise not found or already voided';
  END IF;
  RETURN jsonb_build_object('voided', true);
END;
$$;

COMMENT ON FUNCTION public.void_job_payment_promise(uuid) IS
  'Mark a payment promise as never made (voided). The office, or the job''s people (is_job_people).';

-- set_job_promised_pay_date: the board's one-per-job date (the sheet's Clear, and the pre-v2.3280 fallback).
CREATE OR REPLACE FUNCTION public.set_job_promised_pay_date(p_job_id uuid, p_date date)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT (public.can_write_payment_promises() OR public.is_job_people(p_job_id)) THEN
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
  'Mark (or clear, with NULL) the customer-promised payment date on a job; stamps who marked it. The office, or the job''s people (is_job_people).';

-- ---------- 3 · the per-job read ----------

CREATE OR REPLACE FUNCTION public.list_job_payment_promises_for(p_job_id uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
SELECT CASE WHEN NOT (public.can_read_payment_promises() OR public.is_job_people(p_job_id)) THEN NULL ELSE
  COALESCE(
    (SELECT jsonb_agg(
              jsonb_build_object(
                'id', e.id,
                'jobId', e.job_id,
                'customerId', e.customer_id,
                'promisedYmd', to_char(e.promised_date, 'YYYY-MM-DD'),
                'saidBy', e.said_by,
                'heardByName', CASE WHEN e.heard_by IS NULL THEN NULL ELSE COALESCE(NULLIF(trim(u.name), ''), 'office') END,
                'channel', e.channel,
                'source', e.source,
                'note', e.note,
                'createdAt', e.created_at
              ) ORDER BY e.created_at DESC)
       FROM public.job_payment_promises e
       LEFT JOIN public.users u ON u.id = e.heard_by
       WHERE e.voided_at IS NULL AND e.job_id = p_job_id),
    '[]'::jsonb
  )
END;
$$;

COMMENT ON FUNCTION public.list_job_payment_promises_for(uuid) IS
  'One job''s live (non-voided) payment promise events, newest first, the shape of list_job_payment_promises(). NULL outside the promise readers and the job''s people (is_job_people).';

REVOKE ALL ON FUNCTION public.list_job_payment_promises_for(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_job_payment_promises_for(uuid) TO authenticated, service_role;
