SET lock_timeout = '3s';

-- v2.4320 — punch list #76 PR 2: a check that came back is a case, and it opens itself.
--
-- Before: the office heard about a returned check only from mercury-webhook, and only
-- while a recorded payment still carried it (`mercury_bank_return_notices` held zero
-- rows on 2026-10-01). A check taken off its job before the bank sent it back (Loberg,
-- $5,622.49, 2026-10-01), a check that came back before it posted (Peter Garza, $2,700,
-- Jul 2025) and a status flipped by the Banking page's Sync (sync-mercury-transactions,
-- which sends nothing) told no one.
--
-- 1. mercury_bank_return_reason(): the bank-return rule in SQL, the twin of
--    mercuryBankReturn() in supabase/functions/_shared/bankReturnedDeposits.ts.
-- 2. mercury_transaction_ar_returned grows into the case: source (bank / hand /
--    rejected), the bank's reason, opened, closed with a reason and who, replaced by.
--    A case is open while returned and closed_at is null.
-- 3. A trigger on mercury_transactions opens a bank case whenever any writer sets a
--    deposit to a bank return — the webhook, the Banking Sync, a backfill.
-- 4. The backfill: every return Mercury already holds becomes a case; a past return
--    with a later deposit from the same payer for the same amount closes as replaced.
--    The notice ledger is seeded for cases older than two days so the first run tells
--    the office only about today's (Loberg).
-- 5. open_ar_rejected_check_cases(): a check Mercury could not take in (never posted,
--    not a bank reason) is a case only when a payment recorded by hand matches it and
--    it was not deposited again within 5 days. Re-run hourly; also closes a rejected
--    case once the check goes in again.
-- 6. list_ar_return_cases(): the cases with what the office needs to act — the jobs
--    a payment still carries, the job it was on last, the recorded payment a rejected
--    check matches. Office roles, and the service role for the notifier.
-- 7. set_mercury_transaction_ar_returned(): a hand mark opens a hand case; unticking
--    a check the bank returned is refused (it used to delete the row).
-- 8. pg_cron 'ar-returned-checks-hourly' calls the ar-returned-checks function.

-- 1 ---------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.mercury_bank_return_reason(
  p_status text,
  p_posted_at timestamptz,
  p_amount numeric,
  p_kind text,
  p_reason text
)
 RETURNS text
 LANGUAGE sql
 IMMUTABLE
AS $function$
  SELECT CASE
    WHEN coalesce(btrim(p_status), '') <> 'failed' OR coalesce(p_amount, 0) <= 0 THEN NULL
    WHEN p_posted_at IS NOT NULL THEN coalesce(btrim(p_reason), '')
    WHEN coalesce(btrim(p_kind), '') = 'checkDeposit'
     AND EXISTS (
       SELECT 1
       FROM unnest(ARRAY[
         'insufficient funds',
         'not sufficient funds',
         'stop payment',
         'payment stopped',
         'refer to maker',
         'account closed',
         'closed account',
         'uncollected funds',
         'unable to locate',
         'frozen',
         'blocked account'
       ]) AS ph(p)
       WHERE position(ph.p IN lower(coalesce(p_reason, ''))) > 0
     ) THEN btrim(p_reason)
    ELSE NULL
  END
$function$;

COMMENT ON FUNCTION public.mercury_bank_return_reason(text, timestamptz, numeric, text, text) IS
  'The bank-return rule (v2.4320): the bank''s reason ('''' when it gave none) when a deposit came back — money in that went failed after it posted, or a check deposit that failed with a bank return reason before it posted — else NULL. Twin of mercuryBankReturn() in _shared/bankReturnedDeposits.ts; the phrase lists are kept equal by a test.';

-- Timestamps out of Mercury's raw payload, never raising on a bad one.
CREATE OR REPLACE FUNCTION public._ar_try_timestamptz(p text)
 RETURNS timestamptz
 LANGUAGE plpgsql
 IMMUTABLE
AS $function$
BEGIN
  IF p IS NULL OR p !~ '^\d{4}-\d{2}-\d{2}' THEN
    RETURN NULL;
  END IF;
  RETURN p::timestamptz;
EXCEPTION WHEN OTHERS THEN
  RETURN NULL;
END;
$function$;

-- The first five letters of a payer's name: "Southern Post" = "Southern Post Construction".
CREATE OR REPLACE FUNCTION public._ar_payer_key(p text)
 RETURNS text
 LANGUAGE sql
 IMMUTABLE
AS $function$
  SELECT CASE
    WHEN length(regexp_replace(coalesce(p, ''), '[^A-Za-z]', '', 'g')) < 3 THEN NULL
    ELSE left(lower(regexp_replace(coalesce(p, ''), '[^A-Za-z]', '', 'g')), 5)
  END
$function$;

-- 2 ---------------------------------------------------------------------------------

ALTER TABLE public.mercury_transaction_ar_returned
  ADD COLUMN IF NOT EXISTS source text,
  ADD COLUMN IF NOT EXISTS bank_reason text,
  ADD COLUMN IF NOT EXISTS opened_at timestamptz,
  ADD COLUMN IF NOT EXISTS closed_at timestamptz,
  ADD COLUMN IF NOT EXISTS closed_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS closed_reason text,
  ADD COLUMN IF NOT EXISTS closed_note text,
  ADD COLUMN IF NOT EXISTS replaced_by_mercury_transaction_id uuid REFERENCES public.mercury_transactions(id) ON DELETE SET NULL;

ALTER TABLE public.mercury_transaction_ar_returned ALTER COLUMN opened_at SET DEFAULT now();

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'mercury_transaction_ar_returned_source_check') THEN
    ALTER TABLE public.mercury_transaction_ar_returned
      ADD CONSTRAINT mercury_transaction_ar_returned_source_check
      CHECK (source IS NULL OR source IN ('bank', 'hand', 'rejected'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'mercury_transaction_ar_returned_closed_reason_check') THEN
    ALTER TABLE public.mercury_transaction_ar_returned
      ADD CONSTRAINT mercury_transaction_ar_returned_closed_reason_check
      CHECK (closed_reason IS NULL OR closed_reason IN ('replaced', 'settled_other_way', 'not_coming'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'mercury_transaction_ar_returned_closed_pair_check') THEN
    ALTER TABLE public.mercury_transaction_ar_returned
      ADD CONSTRAINT mercury_transaction_ar_returned_closed_pair_check
      CHECK ((closed_at IS NULL) = (closed_reason IS NULL));
  END IF;
END $$;

COMMENT ON TABLE public.mercury_transaction_ar_returned IS
  'A deposit that came back, and since v2.4320 the case that follows it: source bank (Mercury says the bank returned it), hand (a person marked it returned) or rejected (Mercury could not take the check in and a payment recorded by hand matches it). Open while returned and closed_at is null; closed as replaced (replaced_by_mercury_transaction_id), settled_other_way or not_coming. A returned deposit can pay no bill (trigger jobs_ledger_payments_refuse_returned_deposit, v2.4313).';

-- Rows written before v2.4320: a person marked them, or Unlink and remove did on a bank return.
UPDATE public.mercury_transaction_ar_returned r
SET source = CASE
      WHEN public.mercury_bank_return_reason(t.status, t.posted_at, t.amount, t.kind, t.raw->>'reasonForFailure') IS NOT NULL THEN 'bank'
      WHEN t.status = 'failed' THEN 'rejected'
      ELSE 'hand'
    END,
    bank_reason = coalesce(r.bank_reason, nullif(btrim(t.raw->>'reasonForFailure'), '')),
    opened_at = coalesce(r.opened_at, public._ar_try_timestamptz(t.raw->>'failedAt'), r.updated_at)
FROM public.mercury_transactions t
WHERE t.id = r.mercury_transaction_id
  AND r.source IS NULL;

-- 3 ---------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.mercury_transactions_open_return_case()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_reason text;
BEGIN
  BEGIN
    v_reason := public.mercury_bank_return_reason(NEW.status, NEW.posted_at, NEW.amount, NEW.kind, NEW.raw->>'reasonForFailure');
    IF v_reason IS NULL THEN
      RETURN NEW;
    END IF;
    INSERT INTO public.mercury_transaction_ar_returned AS r
      (mercury_transaction_id, returned, source, bank_reason, opened_at, updated_at, updated_by)
    VALUES
      (NEW.id, true, 'bank', nullif(v_reason, ''), coalesce(public._ar_try_timestamptz(NEW.raw->>'failedAt'), now()), now(), NULL)
    ON CONFLICT (mercury_transaction_id) DO UPDATE SET
      returned = true,
      source = 'bank',
      bank_reason = coalesce(excluded.bank_reason, r.bank_reason),
      opened_at = coalesce(r.opened_at, excluded.opened_at)
    WHERE r.returned IS DISTINCT FROM true
       OR r.source IS DISTINCT FROM 'bank'
       OR r.bank_reason IS DISTINCT FROM coalesce(excluded.bank_reason, r.bank_reason)
       OR r.opened_at IS NULL;
  EXCEPTION WHEN OTHERS THEN
    -- Never fail a bank sync over the case: the hourly sweep's list reads the rule again.
    RAISE WARNING 'mercury_transactions_open_return_case(%): %', NEW.id, SQLERRM;
  END;
  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION public.mercury_transactions_open_return_case() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS mercury_transactions_open_return_case ON public.mercury_transactions;
CREATE TRIGGER mercury_transactions_open_return_case
  AFTER INSERT OR UPDATE OF status, posted_at, raw ON public.mercury_transactions
  FOR EACH ROW EXECUTE FUNCTION public.mercury_transactions_open_return_case();

-- 4 ---------------------------------------------------------------------------------

INSERT INTO public.mercury_transaction_ar_returned AS r
  (mercury_transaction_id, returned, source, bank_reason, opened_at, updated_at, updated_by)
SELECT t.id, true, 'bank',
       nullif(public.mercury_bank_return_reason(t.status, t.posted_at, t.amount, t.kind, t.raw->>'reasonForFailure'), ''),
       coalesce(public._ar_try_timestamptz(t.raw->>'failedAt'), t.created_at),
       now(), NULL
FROM public.mercury_transactions t
WHERE public.mercury_bank_return_reason(t.status, t.posted_at, t.amount, t.kind, t.raw->>'reasonForFailure') IS NOT NULL
ON CONFLICT (mercury_transaction_id) DO UPDATE SET
  returned = true,
  source = 'bank',
  bank_reason = coalesce(excluded.bank_reason, r.bank_reason),
  opened_at = coalesce(r.opened_at, excluded.opened_at);

-- A past return with a later deposit from the same payer for the same amount, and no
-- job still carrying it, was replaced (Dudley, M&M Roofing, Poolcorp twice). Backfill
-- only: from here on the office says so in Accounts Receivable.
WITH cand AS (
  SELECT r.mercury_transaction_id AS case_id,
         (SELECT t2.id
            FROM public.mercury_transactions t2
           WHERE t2.id <> t.id
             AND t2.status IS DISTINCT FROM 'failed'
             AND t2.posted_at IS NOT NULL
             AND t2.amount > 0
             AND abs(t2.amount - t.amount) < 0.005
             AND t2.created_at > t.created_at
             AND t2.created_at < t.created_at + interval '60 days'
             AND public._ar_payer_key(t2.counterparty_name) = public._ar_payer_key(t.counterparty_name)
           ORDER BY t2.created_at
           LIMIT 1) AS repl
  FROM public.mercury_transaction_ar_returned r
  JOIN public.mercury_transactions t ON t.id = r.mercury_transaction_id
  WHERE r.source = 'bank'
    AND r.closed_at IS NULL
    AND r.opened_at < now() - interval '2 days'
    AND NOT EXISTS (SELECT 1 FROM public.jobs_ledger_payments p WHERE p.mercury_transaction_id = t.id)
)
UPDATE public.mercury_transaction_ar_returned r
SET closed_at = t2.created_at,
    closed_reason = 'replaced',
    replaced_by_mercury_transaction_id = c.repl,
    closed_note = 'Found when the cases began (v2.4320): a later check from the same payer for the same amount.'
FROM cand c
JOIN public.mercury_transactions t2 ON t2.id = c.repl
WHERE r.mercury_transaction_id = c.case_id;

-- The office already knew about anything older than two days; tell it only about today's.
INSERT INTO public.mercury_bank_return_notices (mercury_transaction_id, notified_at, payment_ids, recipient_count, emails_sent, pushes_sent)
SELECT r.mercury_transaction_id, now(), '{}', 0, 0, 0
FROM public.mercury_transaction_ar_returned r
WHERE r.opened_at < now() - interval '2 days'
ON CONFLICT (mercury_transaction_id) DO NOTHING;

-- 5 ---------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.open_ar_rejected_check_cases()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_opened integer := 0;
  v_replaced integer := 0;
BEGIN
  -- Close a rejected case once the check went in again.
  WITH again AS (
    SELECT r.mercury_transaction_id AS case_id,
           (SELECT t2.id
              FROM public.mercury_transactions t2
             WHERE t2.id <> t.id
               AND t2.kind = 'checkDeposit'
               AND t2.status IS DISTINCT FROM 'failed'
               AND t2.posted_at IS NOT NULL
               AND abs(t2.amount - t.amount) < 0.005
               AND t2.created_at > t.created_at
               AND t2.created_at < t.created_at + interval '30 days'
               AND public._ar_payer_key(t2.counterparty_name) = public._ar_payer_key(t.counterparty_name)
             ORDER BY t2.created_at
             LIMIT 1) AS repl
    FROM public.mercury_transaction_ar_returned r
    JOIN public.mercury_transactions t ON t.id = r.mercury_transaction_id
    WHERE r.source = 'rejected' AND r.closed_at IS NULL
  )
  UPDATE public.mercury_transaction_ar_returned r
  SET closed_at = now(), closed_reason = 'replaced', replaced_by_mercury_transaction_id = a.repl,
      closed_note = 'The check went in again.'
  FROM again a
  WHERE r.mercury_transaction_id = a.case_id AND a.repl IS NOT NULL;
  GET DIAGNOSTICS v_replaced = ROW_COUNT;

  INSERT INTO public.mercury_transaction_ar_returned
    (mercury_transaction_id, returned, source, bank_reason, opened_at, updated_at, updated_by)
  SELECT t.id, true, 'rejected', nullif(btrim(t.raw->>'reasonForFailure'), ''), now(), now(), NULL
  FROM public.mercury_transactions t
  CROSS JOIN LATERAL (SELECT coalesce(public._ar_try_timestamptz(t.raw->>'failedAt'), t.created_at) AS failed_at) f
  WHERE t.status = 'failed'
    AND t.kind = 'checkDeposit'
    AND t.amount > 0
    AND t.posted_at IS NULL
    AND public.mercury_bank_return_reason(t.status, t.posted_at, t.amount, t.kind, t.raw->>'reasonForFailure') IS NULL
    AND f.failed_at > now() - interval '90 days'
    AND f.failed_at < now() - interval '5 days'
    AND NOT EXISTS (SELECT 1 FROM public.mercury_transaction_ar_returned r WHERE r.mercury_transaction_id = t.id)
    -- A payment recorded by hand, for the same amount, around the day Mercury refused it.
    AND EXISTS (
      SELECT 1 FROM public.jobs_ledger_payments p
      WHERE p.mercury_transaction_id IS NULL
        AND p.amount > 0
        AND abs(p.amount - t.amount) < 0.005
        AND p.paid_on BETWEEN (f.failed_at AT TIME ZONE 'America/Chicago')::date - 3
                          AND (f.failed_at AT TIME ZONE 'America/Chicago')::date + 10
    )
    -- Not deposited again.
    AND NOT EXISTS (
      SELECT 1 FROM public.mercury_transactions t2
      WHERE t2.id <> t.id
        AND t2.kind = 'checkDeposit'
        AND t2.status IS DISTINCT FROM 'failed'
        AND abs(t2.amount - t.amount) < 0.005
        AND t2.created_at > t.created_at
        AND t2.created_at < t.created_at + interval '30 days'
        AND public._ar_payer_key(t2.counterparty_name) = public._ar_payer_key(t.counterparty_name)
    )
  ON CONFLICT (mercury_transaction_id) DO NOTHING;
  GET DIAGNOSTICS v_opened = ROW_COUNT;

  RETURN jsonb_build_object('opened', v_opened, 'replaced', v_replaced);
END;
$function$;

REVOKE ALL ON FUNCTION public.open_ar_rejected_check_cases() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.open_ar_rejected_check_cases() TO service_role;

-- 6 ---------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.list_ar_return_cases(p_include_closed boolean DEFAULT false)
 RETURNS TABLE(
   mercury_transaction_id uuid,
   counterparty_name text,
   amount numeric,
   kind text,
   posted_at timestamptz,
   failed_at timestamptz,
   bank_reason text,
   source text,
   opened_at timestamptz,
   closed_at timestamptz,
   closed_reason text,
   closed_note text,
   closed_by text,
   replaced_by_mercury_transaction_id uuid,
   notified_at timestamptz,
   live_payments jsonb,
   last_job jsonb,
   recorded_payment jsonb,
   promise jsonb
 )
 LANGUAGE plpgsql
 STABLE
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF coalesce(auth.role(), '') <> 'service_role' THEN
    IF auth.uid() IS NULL THEN
      RAISE EXCEPTION 'list_ar_return_cases: not authenticated';
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid()
        AND u.role IN ('dev', 'master_technician', 'assistant', 'controller', 'primary')
    ) THEN
      RAISE EXCEPTION 'list_ar_return_cases: not authorized';
    END IF;
  END IF;

  RETURN QUERY
  SELECT
    t.id,
    t.counterparty_name,
    abs(t.amount)::numeric,
    t.kind,
    t.posted_at,
    public._ar_try_timestamptz(t.raw->>'failedAt'),
    coalesce(r.bank_reason, nullif(btrim(t.raw->>'reasonForFailure'), '')),
    coalesce(r.source, CASE WHEN t.status = 'failed' THEN 'bank' ELSE 'hand' END),
    coalesce(r.opened_at, r.updated_at),
    r.closed_at,
    r.closed_reason,
    r.closed_note,
    (SELECT coalesce(nullif(u.name, ''), u.email) FROM public.users u WHERE u.id = r.closed_by),
    r.replaced_by_mercury_transaction_id,
    (SELECT n.notified_at FROM public.mercury_bank_return_notices n WHERE n.mercury_transaction_id = t.id),
    coalesce((
      SELECT jsonb_agg(jsonb_build_object(
               'payment_id', p.id,
               'job_id', p.job_id,
               'job_number', coalesce(nullif(j.hcp_number, ''), nullif(j.click_number, ''), ''),
               'job_name', j.job_name,
               'amount', p.amount,
               'invoice_id', p.invoice_id,
               'invoice_sequence_order', i.sequence_order,
               'invoice_status', i.status,
               'invoice_amount', i.amount,
               'stripe_bill', (nullif(btrim(coalesce(i.stripe_invoice_id, '')), '') IS NOT NULL),
               'stripe_credit_note', (nullif(btrim(coalesce(p.stripe_credit_note_id, '')), '') IS NOT NULL),
               'job_status', j.status,
               'job_revenue', j.revenue,
               'job_payments_made', j.payments_made
             ) ORDER BY p.amount DESC, p.id)
      FROM public.jobs_ledger_payments p
      LEFT JOIN public.jobs_ledger j ON j.id = p.job_id
      LEFT JOIN public.jobs_ledger_invoices i ON i.id = p.invoice_id
      WHERE p.mercury_transaction_id = t.id
    ), '[]'::jsonb),
    (
      SELECT jsonb_build_object(
               'job_id', j.id,
               'job_number', coalesce(nullif(j.hcp_number, ''), nullif(j.click_number, ''), ''),
               'job_name', j.job_name,
               'removed_at', a.deleted_at,
               'removed_by', (SELECT coalesce(nullif(u.name, ''), u.email) FROM public.users u WHERE u.id = a.deleted_by),
               'job_revenue', j.revenue,
               'job_payments_made', j.payments_made
             )
      FROM public.deleted_records_archive a
      JOIN public.jobs_ledger j ON j.id = (a.row_data->>'job_id')::uuid
      WHERE a.table_name = 'jobs_ledger_payments'
        AND a.restored_at IS NULL
        AND (a.row_data->>'mercury_transaction_id') = t.id::text
      ORDER BY a.deleted_at DESC
      LIMIT 1
    ),
    -- A payment recorded by hand that matches a check no job carries: a rejected check, or a
    -- bank return nobody linked (Peter Garza's $2,700 on #120, Jul 2025).
    CASE WHEN NOT EXISTS (SELECT 1 FROM public.jobs_ledger_payments lp WHERE lp.mercury_transaction_id = t.id) THEN (
      SELECT jsonb_build_object(
               'payment_id', p.id,
               'job_id', p.job_id,
               'job_number', coalesce(nullif(j.hcp_number, ''), nullif(j.click_number, ''), ''),
               'job_name', j.job_name,
               'amount', p.amount,
               'paid_on', p.paid_on,
               'job_revenue', j.revenue,
               'job_payments_made', j.payments_made
             )
      FROM public.jobs_ledger_payments p
      LEFT JOIN public.jobs_ledger j ON j.id = p.job_id
      WHERE p.mercury_transaction_id IS NULL
        AND p.amount > 0
        AND abs(p.amount - t.amount) < 0.005
        AND p.paid_on BETWEEN (coalesce(public._ar_try_timestamptz(t.raw->>'failedAt'), t.created_at) AT TIME ZONE 'America/Chicago')::date - CASE WHEN r.source = 'rejected' THEN 3 ELSE 14 END
                          AND (coalesce(public._ar_try_timestamptz(t.raw->>'failedAt'), t.created_at) AT TIME ZONE 'America/Chicago')::date + 10
        AND NOT EXISTS (
          SELECT 1 FROM public.deleted_records_archive a2
          WHERE a2.table_name = 'jobs_ledger_payments' AND a2.restored_at IS NULL
            AND (a2.row_data->>'mercury_transaction_id') = t.id::text
        )
      ORDER BY p.paid_on, p.id
      LIMIT 1
    ) END,
    -- The newest promise the customer made after the check came back, on any job it touched.
    (
      SELECT jsonb_build_object(
               'job_id', pp.job_id,
               'promised_date', pp.promised_date,
               'said_by', pp.said_by,
               'created_at', pp.created_at
             )
      FROM public.job_payment_promises pp
      WHERE pp.voided_at IS NULL
        AND pp.created_at > coalesce(r.opened_at, r.updated_at)
        AND pp.job_id IN (
          SELECT p.job_id FROM public.jobs_ledger_payments p WHERE p.mercury_transaction_id = t.id
          UNION
          SELECT (a.row_data->>'job_id')::uuid FROM public.deleted_records_archive a
          WHERE a.table_name = 'jobs_ledger_payments' AND a.restored_at IS NULL
            AND (a.row_data->>'mercury_transaction_id') = t.id::text
        )
      ORDER BY pp.created_at DESC
      LIMIT 1
    )
  FROM public.mercury_transaction_ar_returned r
  JOIN public.mercury_transactions t ON t.id = r.mercury_transaction_id
  WHERE r.returned
    AND (p_include_closed OR r.closed_at IS NULL)
  ORDER BY coalesce(r.opened_at, r.updated_at) DESC, t.id;
END;
$function$;

REVOKE ALL ON FUNCTION public.list_ar_return_cases(boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_ar_return_cases(boolean) TO authenticated, service_role;

COMMENT ON FUNCTION public.list_ar_return_cases(boolean) IS
  'Accounts Receivable (v2.4320): every open case of a check that came back (all of them with p_include_closed) — the deposit, the bank''s reason, the case''s source and close, whether the office was told, the payments still carrying it (live_payments), the job it was on last (last_job, from deleted_records_archive) and, when no job ever carried it, the payment recorded by hand it matches (recorded_payment); promise = the newest They said… on those jobs since the check came back. Dev/master/assistant/controller/primary, and the service role (the notifier).';

-- 7 ---------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.set_mercury_transaction_ar_returned(p_mercury_transaction_id uuid, p_returned boolean)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_bank text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'set_mercury_transaction_ar_returned: not authenticated';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.id = auth.uid()
      AND u.role IN ('dev', 'master_technician', 'assistant', 'controller', 'primary')
  ) THEN
    RAISE EXCEPTION 'set_mercury_transaction_ar_returned: not authorized';
  END IF;

  IF p_mercury_transaction_id IS NULL THEN
    RAISE EXCEPTION 'set_mercury_transaction_ar_returned: mercury transaction required';
  END IF;

  SELECT public.mercury_bank_return_reason(t.status, t.posted_at, t.amount, t.kind, t.raw->>'reasonForFailure')
  INTO v_bank
  FROM public.mercury_transactions t
  WHERE t.id = p_mercury_transaction_id;

  IF p_returned THEN
    INSERT INTO public.mercury_transaction_ar_returned AS r (mercury_transaction_id, returned, updated_by, source, opened_at, bank_reason)
    VALUES (p_mercury_transaction_id, true, auth.uid(), CASE WHEN v_bank IS NOT NULL THEN 'bank' ELSE 'hand' END, now(), nullif(v_bank, ''))
    ON CONFLICT (mercury_transaction_id) DO UPDATE SET
      returned = excluded.returned,
      updated_at = now(),
      updated_by = excluded.updated_by,
      source = coalesce(r.source, excluded.source),
      opened_at = coalesce(r.opened_at, excluded.opened_at);
  ELSE
    IF v_bank IS NOT NULL THEN
      RAISE EXCEPTION 'The bank returned this check, so it stays returned. Close it in Accounts Receivable instead.'
        USING ERRCODE = 'P0001', HINT = 'bank_returned';
    END IF;
    DELETE FROM public.mercury_transaction_ar_returned
    WHERE mercury_transaction_id = p_mercury_transaction_id;
  END IF;
END;
$function$;

-- 8 ---------------------------------------------------------------------------------

SELECT cron.unschedule(jobid) FROM cron.job WHERE jobname = 'ar-returned-checks-hourly';

SELECT cron.schedule(
  'ar-returned-checks-hourly',
  '17 * * * *',
  $$
  SELECT net.http_post(
    url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'PROJECT_URL') || '/functions/v1/ar-returned-checks',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'X-Cron-Secret', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'CRON_SECRET')
    ),
    body := '{}'::jsonb
  ) AS request_id;
  $$
);
