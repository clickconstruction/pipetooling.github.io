SET lock_timeout = '3s';

-- Who pays the bill (v2.3374): a payment promise is filed under the payer.
--
-- The promise writers from 20260911051414 snapshot the promise's customer_id
-- as COALESCE(j.gc_customer_id, j.customer_id) — the pre-v2.3345 guess that a
-- job with a GC is a job the GC pays. Since v2.3345 the job says who pays
-- (jobs_ledger.bill_to_party) and every reader follows it: the statement RPC
-- (20260911223500), the Stages board and the payment forecast key a promise
-- on the payer (payerCustomerId in billToParty.ts). The writers never caught
-- up, so on a job that names a GC but bills the homeowner (Done Right's
-- pretests) the homeowner's promise landed on the GC's reliability record and
-- pay-speed spread.
--
-- One helper holds the rule both writers now share — the statement RPC's own
-- CASE for a job with no invoice in play:
--   * the GC entered as the job customer pays by definition;
--   * bill_to_party = 'gc' with a GC set → the GC;
--   * 'customer', 'split' (each invoice picks; a job-level promise has none),
--     or 'gc' with no GC → the job customer.
-- The client mirror is jobPromisePayerCustomerId (src/lib/jobs/billToParty.ts);
-- keep the two in step.
--
-- Re-snapshot: prod held ONE promise row at write time (2026-09-13), already
-- filed correctly, so the UPDATE below matches nothing today. It stays in for
-- any office promise recorded between merge and the push on a customer-pays
-- job with a distinct GC — the only rows the old COALESCE misfiled. Portal
-- self-promises (source = 'customer') carry the customer who actually
-- promised and are never rewritten. Idempotent; no CREATE TABLE.
--
-- add_customer_payment_promise (20260911052931) is unchanged: it accepts a job
-- where the caller is either party because the portal narrows the job list to
-- what the viewer owes (owedJobIdsForViewer), which knows invoice-level picks
-- on split jobs that this job-level rule cannot.

CREATE OR REPLACE FUNCTION public.job_bill_payer_customer_id(
  p_bill_to_party text,
  p_customer_id uuid,
  p_gc_customer_id uuid
)
RETURNS uuid
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
AS $$
  SELECT CASE
    WHEN p_gc_customer_id IS NOT NULL
         AND (p_gc_customer_id = p_customer_id OR p_bill_to_party = 'gc')
      THEN p_gc_customer_id
    ELSE p_customer_id
  END;
$$;

COMMENT ON FUNCTION public.job_bill_payer_customer_id(text, uuid, uuid) IS
  'Who pays (v2.3374): the customers row that pays a job under its bill_to_party rule with no invoice pick in play — the GC when it is the job customer or the rule says gc; else the job customer. Pure; mirrors jobPromisePayerCustomerId in the client kernel.';

-- ---------------------------------------------------------------------------
-- Trigger: the legacy upsert path (set_job_promised_pay_date) logs an event.
-- Body from 20260911051414; only the payer line changes.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.job_promised_pay_dates_log_promise()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- add_job_payment_promise already wrote the event; don't double-log.
  IF current_setting('app.promise_event_written', true) = 'on' THEN
    RETURN NEW;
  END IF;
  -- An UPDATE that keeps the same date is a re-stamp, not a new promise.
  IF TG_OP = 'UPDATE' AND OLD.promised_date = NEW.promised_date THEN
    RETURN NEW;
  END IF;
  INSERT INTO public.job_payment_promises (job_id, customer_id, promised_date, heard_by, channel, source, created_at)
  SELECT NEW.job_id,
         public.job_bill_payer_customer_id(j.bill_to_party, j.customer_id, j.gc_customer_id),
         NEW.promised_date,
         NEW.marked_by,
         NULL,
         'office',
         COALESCE(NEW.marked_at, now())
  FROM public.jobs_ledger j
  WHERE j.id = NEW.job_id;
  RETURN NEW;
END;
$$;

-- ---------------------------------------------------------------------------
-- add_job_payment_promise: the full-detail write ("They said…").
-- Body from 20260911051414; only the payer lookup changes.
-- ---------------------------------------------------------------------------

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
  IF NOT public.can_write_payment_promises() THEN
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
  'Record a customer payment promise on a job (who said it, channel, note) as an event filed under the job''s payer (bill_to_party rule), and set it as the job''s current promised date. Dev/master/assistant-like only.';

-- ---------------------------------------------------------------------------
-- Re-snapshot the rows the old COALESCE misfiled: office promises on a job
-- whose rule bills the customer while a distinct GC is named. Nothing else.
-- ---------------------------------------------------------------------------

UPDATE public.job_payment_promises e
   SET customer_id = public.job_bill_payer_customer_id(j.bill_to_party, j.customer_id, j.gc_customer_id)
  FROM public.jobs_ledger j
 WHERE j.id = e.job_id
   AND e.source = 'office'
   AND j.gc_customer_id IS NOT NULL
   AND j.gc_customer_id IS DISTINCT FROM j.customer_id
   AND e.customer_id = j.gc_customer_id
   AND e.customer_id IS DISTINCT FROM public.job_bill_payer_customer_id(j.bill_to_party, j.customer_id, j.gc_customer_id);
