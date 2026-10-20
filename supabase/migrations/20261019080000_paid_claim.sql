SET lock_timeout = '3s';

-- They say they paid (punch list #129, PR 3a; to-dos/estimator-money-word/README.md). The customer's word on paying is
-- one record: a day they will pay by (a promise, as before) or that they already paid (a paid claim: how they say they
-- paid, the day they name, the amount when it is not all of it). A claim is written by the same people as a promise
-- (the office, or the job's people, 20261019060000), shows in the job's trail as They said, and voids the same way.
-- It never marks the job paid and never touches the board's one-per-job promised date: paid stays the bank's word,
-- and PR 4 pairs the claim with the deposit when it lands. The company-wide promise reads (the Lien desk, the legal
-- packet, Owner Billing, the pay-speed record) keep answering promises only, so no reader that counts a promise's
-- outcome counts a claim; the per-job read (the sheet, the trail, the money line) answers both kinds, each named.
-- Idempotent: IF NOT EXISTS on the columns, a guarded ADD CONSTRAINT, CREATE OR REPLACE on the functions.

-- ---------- 1 · the kind, the method, the amount ----------

ALTER TABLE public.job_payment_promises
  ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'promise',
  ADD COLUMN IF NOT EXISTS method text,
  ADD COLUMN IF NOT EXISTS amount numeric;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'job_payment_promises_kind_known') THEN
    ALTER TABLE public.job_payment_promises
      ADD CONSTRAINT job_payment_promises_kind_known CHECK (kind IN ('promise', 'paid_claim'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'job_payment_promises_method_known') THEN
    ALTER TABLE public.job_payment_promises
      ADD CONSTRAINT job_payment_promises_method_known
      CHECK (method IS NULL OR method IN ('check_mailed', 'paid_online', 'bank_transfer', 'card_by_phone', 'not_sure'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'job_payment_promises_amount_positive') THEN
    ALTER TABLE public.job_payment_promises
      ADD CONSTRAINT job_payment_promises_amount_positive CHECK (amount IS NULL OR amount > 0);
  END IF;
  -- A claim names how; a promise names neither how nor an amount.
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'job_payment_promises_kind_shape') THEN
    ALTER TABLE public.job_payment_promises
      ADD CONSTRAINT job_payment_promises_kind_shape
      CHECK ((kind = 'paid_claim' AND method IS NOT NULL) OR (kind = 'promise' AND method IS NULL AND amount IS NULL));
  END IF;
END $$;

COMMENT ON COLUMN public.job_payment_promises.kind IS
  'promise: a day they will pay by (promised_date). paid_claim: they say they already paid, promised_date the day they name (punch list #129).';
COMMENT ON COLUMN public.job_payment_promises.method IS
  'A paid claim''s how, as they said it: check_mailed, paid_online, bank_transfer, card_by_phone or not_sure. NULL on a promise.';
COMMENT ON COLUMN public.job_payment_promises.amount IS
  'A paid claim''s amount when it is not all of what is open; NULL for all of it, and on a promise.';

-- ---------- 2 · the writer ----------

CREATE OR REPLACE FUNCTION public.add_job_payment_claim(
  p_job_id uuid,
  p_date date,
  p_method text,
  p_amount numeric DEFAULT NULL,
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
    RAISE EXCEPTION 'A claim needs the day they say they paid';
  END IF;
  IF p_method IS NULL OR p_method NOT IN ('check_mailed', 'paid_online', 'bank_transfer', 'card_by_phone', 'not_sure') THEN
    RAISE EXCEPTION 'Unknown method %', COALESCE(p_method, 'none');
  END IF;
  IF p_amount IS NOT NULL AND p_amount <= 0 THEN
    RAISE EXCEPTION 'An amount must be more than nothing';
  END IF;
  IF p_channel IS NOT NULL AND p_channel NOT IN ('phone', 'text', 'email', 'in_person') THEN
    RAISE EXCEPTION 'Unknown channel %', p_channel;
  END IF;
  SELECT public.job_bill_payer_customer_id(j.bill_to_party, j.customer_id, j.gc_customer_id) INTO v_customer
  FROM public.jobs_ledger j WHERE j.id = p_job_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Job not found';
  END IF;

  INSERT INTO public.job_payment_promises (job_id, customer_id, promised_date, said_by, heard_by, channel, source, note, kind, method, amount)
  VALUES (p_job_id, v_customer, p_date, NULLIF(trim(p_said_by), ''), auth.uid(), p_channel, 'office', NULLIF(trim(p_note), ''), 'paid_claim', p_method, p_amount)
  RETURNING id INTO v_id;

  RETURN jsonb_build_object('id', v_id, 'paidDate', p_date);
END;
$$;

COMMENT ON FUNCTION public.add_job_payment_claim(uuid, date, text, numeric, text, text, text) IS
  'They say they paid (punch list #129): a paid_claim row on the job, how they say they paid, the day they name, the amount when not all of it, who said it and how, filed under the job''s payer; the job stays as it is and the board''s date is untouched. The office, or the job''s people.';

REVOKE ALL ON FUNCTION public.add_job_payment_claim(uuid, date, text, numeric, text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.add_job_payment_claim(uuid, date, text, numeric, text, text, text) TO authenticated, service_role;

-- ---------- 3 · the reads: the company-wide ones promises only, the per-job one both kinds ----------

CREATE OR REPLACE FUNCTION public.list_job_payment_promises()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
SELECT CASE WHEN NOT public.can_read_payment_promises() THEN NULL ELSE
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
       WHERE e.voided_at IS NULL AND e.kind = 'promise'),
    '[]'::jsonb
  )
END;
$$;

COMMENT ON FUNCTION public.list_job_payment_promises() IS
  'All live (non-voided) payment promises, newest first; a paid claim (kind paid_claim) is not among them. NULL outside dev/master/assistant-like/primary.';

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
                'createdAt', e.created_at,
                'kind', e.kind,
                'method', e.method,
                'amount', e.amount
              ) ORDER BY e.created_at DESC)
       FROM public.job_payment_promises e
       LEFT JOIN public.users u ON u.id = e.heard_by
       WHERE e.voided_at IS NULL AND e.job_id = p_job_id),
    '[]'::jsonb
  )
END;
$$;

COMMENT ON FUNCTION public.list_job_payment_promises_for(uuid) IS
  'One job''s live customer words on paying, newest first: promises and paid claims, each with its kind, a claim with its method and amount. NULL outside the promise readers and the job''s people (is_job_people).';

CREATE OR REPLACE FUNCTION public.list_payment_promise_records()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
SELECT CASE WHEN NOT public.can_read_payment_promises() THEN NULL ELSE
  COALESCE(
    (SELECT jsonb_agg(
              jsonb_build_object(
                'id', e.id,
                'jobId', e.job_id,
                'customerId', e.customer_id,
                'promisedYmd', to_char(e.promised_date, 'YYYY-MM-DD'),
                'createdAt', e.created_at,
                'source', e.source,
                'billedTotal', COALESCE((
                  SELECT SUM(i.amount) FROM public.jobs_ledger_invoices i
                  WHERE i.job_id = e.job_id
                    AND i.status IN ('billed', 'paid')
                    AND COALESCE(i.billed_at, i.created_at) <= e.created_at
                ), 0),
                'payments', COALESCE((
                  SELECT jsonb_agg(jsonb_build_object('paidOn', to_char(p.paid_on, 'YYYY-MM-DD'), 'amount', p.amount) ORDER BY p.paid_on)
                  FROM public.jobs_ledger_payments p
                  WHERE p.job_id = e.job_id AND p.paid_on IS NOT NULL
                ), '[]'::jsonb)
              ) ORDER BY e.created_at)
       FROM public.job_payment_promises e
       WHERE e.voided_at IS NULL AND e.kind = 'promise'),
    '[]'::jsonb
  )
END;
$$;

COMMENT ON FUNCTION public.list_payment_promise_records() IS
  'Per live promise (kind promise; a paid claim is no promise to keep): what was billed on the job at promise time and the job''s payment dates/amounts — the inputs for the client''s kept/late/broken derivation. NULL outside dev/master/assistant-like/primary.';
