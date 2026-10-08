SET lock_timeout = '3s';

-- v2.4902 — punch list #76, piece 3: a check typed in by hand that never reached the bank.
--
-- A payment typed as a check and recorded on a job with no deposit linked to it reads paid,
-- whether or not the check was ever deposited. The returned-check train (v2.4313–v2.4333)
-- opens a case only for a check the bank holds: one it sent back, or one Mercury could not
-- take in. A check that was never deposited leaves nothing at the bank, so nothing told the
-- office. On 2026-10-07 eight check payments since Jul 1 had no deposit after ten days (six
-- DRF $250 checks typed Aug 19–21, $185 on Jul 30, $1,200 on Aug 19).
--
-- 1. ar_unbanked_check_cases: the case, keyed by the payment. There is no Mercury row to key
--    it on. No foreign key, so a case outlives a payment taken off its job; the job, the
--    amount and the day are kept on the case.
-- 2. ar_check_payment_type(): the check test in SQL, the twin of isCheckPayment()
--    (src/lib/jobs/checkClearing.ts).
-- 3. open_ar_unbanked_check_cases(p_days, p_floor, p_quiet): a check payment with no deposit
--    link, typed in on or after p_floor and at least p_days ago, on a job, opens a case,
--    unless a check deposit of at least its amount that nothing has used up posted since
--    three days before it was typed in (it may sit in To match, waiting to be linked).
--    It also closes a case whose payment now has a deposit, or whose payment is gone.
--    p_days defaults to 10, AR_UNBANKED_CHECK_DAYS in _shared/bankReturnedDeposits.ts (a
--    test keeps them equal). That is not CHECK_CLEAR_DAYS (7): that clock counts a deposited
--    check clearing; this one counts a check that never got deposited. p_floor defaults to
--    2026-07-01: before spring 2026 the office did not link checks to deposits, so most older
--    check payments have no link and are not cases. pg_cron runs it hourly through
--    ar-returned-checks.
-- 4. Two triggers on jobs_ledger_payments close a case the moment its payment gets a deposit
--    (deposited) or comes off its job (taken_off).
-- 5. close_ar_unbanked_check_case() and reopen_ar_unbanked_check_case(): the pane's More.
-- 6. list_ar_return_cases() adds these cases as rows with source 'unbanked'. The case's own
--    id rides in mercury_transaction_id (a uuid that names no deposit), the payment in
--    recorded_payment. The columns are unchanged, so every reader gets them as is.
-- 7. The backfill opens the cases already due, quietly: told now, so the first hourly run
--    sends nothing for them. They sit on top of To match under Came back.

-- 1 ---------------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.ar_unbanked_check_cases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id uuid NOT NULL,
  job_id uuid,
  amount numeric NOT NULL,
  paid_on date,
  payment_type text,
  reference_number text,
  opened_at timestamptz NOT NULL DEFAULT now(),
  closed_at timestamptz,
  closed_reason text,
  closed_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  closed_note text,
  deposited_mercury_transaction_id uuid,
  notified_at timestamptz,
  CONSTRAINT ar_unbanked_check_cases_payment_uniq UNIQUE (payment_id),
  CONSTRAINT ar_unbanked_check_cases_reason_chk CHECK (closed_reason IS NULL OR closed_reason IN ('deposited', 'settled_other_way', 'not_coming', 'taken_off'))
);

COMMENT ON TABLE public.ar_unbanked_check_cases IS
  'A check typed in by hand that never reached the bank (v2.4902, punch list #76 piece 3): one case per payment typed as a check with no deposit linked after AR_UNBANKED_CHECK_DAYS. Opened by open_ar_unbanked_check_cases (hourly, ar-returned-checks); closed as deposited or taken_off by triggers on jobs_ledger_payments, or by the office (settled_other_way, not_coming). No foreign key to the payment: the case outlives a payment taken off its job.';

ALTER TABLE public.ar_unbanked_check_cases ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS ar_unbanked_check_cases_select_office ON public.ar_unbanked_check_cases;
CREATE POLICY ar_unbanked_check_cases_select_office ON public.ar_unbanked_check_cases FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.id = auth.uid()
      AND u.role IN ('dev', 'master_technician', 'assistant', 'controller', 'primary')
  ));

GRANT SELECT ON public.ar_unbanked_check_cases TO authenticated;
GRANT ALL ON public.ar_unbanked_check_cases TO service_role;

-- 2 ---------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.ar_check_payment_type(p text)
 RETURNS boolean
 LANGUAGE sql
 IMMUTABLE
AS $function$
  SELECT coalesce(p, '') ~* '(check|cheque|\mck\M)'
$function$;

COMMENT ON FUNCTION public.ar_check_payment_type(text) IS
  'Whether a payment type names a check (v2.4902): Check, Cheque, checkDeposit, ck. The twin of isCheckPayment() in src/lib/jobs/checkClearing.ts.';

-- 3 ---------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.open_ar_unbanked_check_cases(
  p_days integer DEFAULT 10,
  p_floor date DEFAULT '2026-07-01',
  p_quiet boolean DEFAULT false
)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_deposited integer := 0;
  v_taken_off integer := 0;
  v_opened integer := 0;
BEGIN
  IF coalesce(p_days, 0) < 1 THEN
    RAISE EXCEPTION 'open_ar_unbanked_check_cases: p_days must be at least 1';
  END IF;

  -- The payment got a deposit: the check reached the bank after all.
  UPDATE public.ar_unbanked_check_cases c
  SET closed_at = now(), closed_reason = 'deposited', deposited_mercury_transaction_id = p.mercury_transaction_id
  FROM public.jobs_ledger_payments p
  WHERE p.id = c.payment_id
    AND c.closed_at IS NULL
    AND p.mercury_transaction_id IS NOT NULL;
  GET DIAGNOSTICS v_deposited = ROW_COUNT;

  -- The payment is gone: someone took it off the job.
  UPDATE public.ar_unbanked_check_cases c
  SET closed_at = now(), closed_reason = 'taken_off'
  WHERE c.closed_at IS NULL
    AND NOT EXISTS (SELECT 1 FROM public.jobs_ledger_payments p WHERE p.id = c.payment_id);
  GET DIAGNOSTICS v_taken_off = ROW_COUNT;

  INSERT INTO public.ar_unbanked_check_cases (payment_id, job_id, amount, paid_on, payment_type, reference_number, notified_at)
  SELECT p.id, p.job_id, p.amount, p.paid_on, p.payment_type, nullif(btrim(coalesce(p.reference_number, '')), ''),
         CASE WHEN p_quiet THEN now() END
  FROM public.jobs_ledger_payments p
  JOIN public.jobs_ledger j ON j.id = p.job_id
  WHERE p.mercury_transaction_id IS NULL
    AND p.amount > 0
    AND public.ar_check_payment_type(p.payment_type)
    AND p.paid_on IS NOT NULL
    AND p.paid_on >= p_floor
    AND p.paid_on <= public.app_today() - p_days
    AND NOT EXISTS (SELECT 1 FROM public.ar_unbanked_check_cases c WHERE c.payment_id = p.id)
    -- A check deposit of at least this much that nothing has used up, posted since three days
    -- before the check was typed in: it may be this check, waiting in To match to be linked.
    AND NOT EXISTS (
      SELECT 1
      FROM public.mercury_transactions t
      WHERE t.kind = 'checkDeposit'
        AND t.amount > 0
        AND coalesce(t.status, '') <> 'failed'
        AND (coalesce(t.posted_at, t.created_at) AT TIME ZONE 'America/Chicago')::date >= p.paid_on - 3
        AND NOT EXISTS (
          SELECT 1 FROM public.mercury_transaction_ar_returned r
          WHERE r.mercury_transaction_id = t.id AND r.returned
        )
        AND t.amount - coalesce((
              SELECT sum(lp.amount) FROM public.jobs_ledger_payments lp WHERE lp.mercury_transaction_id = t.id
            ), 0) >= p.amount - 0.005
    );
  GET DIAGNOSTICS v_opened = ROW_COUNT;

  RETURN jsonb_build_object('opened', v_opened, 'closed_deposited', v_deposited, 'closed_taken_off', v_taken_off);
END;
$function$;

REVOKE ALL ON FUNCTION public.open_ar_unbanked_check_cases(integer, date, boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.open_ar_unbanked_check_cases(integer, date, boolean) TO service_role;

COMMENT ON FUNCTION public.open_ar_unbanked_check_cases(integer, date, boolean) IS
  'The hourly sweep for checks typed in by hand that never reached the bank (v2.4902): opens a case for a check payment with no deposit link, typed in on or after p_floor and at least p_days ago (AR_UNBANKED_CHECK_DAYS, 10), unless an unused check deposit of at least its amount posted since three days before it; closes a case whose payment got a deposit (deposited) or is gone (taken_off). p_quiet marks new cases told (the backfill). Service role only (ar-returned-checks).';

-- 4 ---------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.jobs_ledger_payments_close_unbanked_case()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF TG_OP = 'DELETE' THEN
    UPDATE public.ar_unbanked_check_cases
    SET closed_at = now(), closed_reason = 'taken_off'
    WHERE payment_id = OLD.id AND closed_at IS NULL;
    RETURN OLD;
  END IF;
  IF NEW.mercury_transaction_id IS NOT NULL THEN
    UPDATE public.ar_unbanked_check_cases
    SET closed_at = now(), closed_reason = 'deposited', deposited_mercury_transaction_id = NEW.mercury_transaction_id
    WHERE payment_id = NEW.id AND closed_at IS NULL;
  END IF;
  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION public.jobs_ledger_payments_close_unbanked_case() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS jobs_ledger_payments_close_unbanked_case_link ON public.jobs_ledger_payments;
CREATE TRIGGER jobs_ledger_payments_close_unbanked_case_link
  AFTER UPDATE OF mercury_transaction_id ON public.jobs_ledger_payments
  FOR EACH ROW
  WHEN (NEW.mercury_transaction_id IS NOT NULL AND NEW.mercury_transaction_id IS DISTINCT FROM OLD.mercury_transaction_id)
  EXECUTE FUNCTION public.jobs_ledger_payments_close_unbanked_case();

DROP TRIGGER IF EXISTS jobs_ledger_payments_close_unbanked_case_gone ON public.jobs_ledger_payments;
CREATE TRIGGER jobs_ledger_payments_close_unbanked_case_gone
  AFTER DELETE ON public.jobs_ledger_payments
  FOR EACH ROW
  EXECUTE FUNCTION public.jobs_ledger_payments_close_unbanked_case();

-- 5 ---------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.close_ar_unbanked_check_case(
  p_case_id uuid,
  p_reason text,
  p_note text DEFAULT NULL
)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_note text := nullif(btrim(coalesce(p_note, '')), '');
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'close_ar_unbanked_check_case: not authenticated';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.id = auth.uid()
      AND u.role IN ('dev', 'master_technician', 'assistant', 'controller', 'primary')
  ) THEN
    RAISE EXCEPTION 'close_ar_unbanked_check_case: not authorized';
  END IF;
  IF p_reason IS NULL OR p_reason NOT IN ('settled_other_way', 'not_coming') THEN
    RAISE EXCEPTION 'close_ar_unbanked_check_case: reason must be settled_other_way or not_coming';
  END IF;
  IF v_note IS NOT NULL AND length(v_note) > 500 THEN
    RAISE EXCEPTION 'close_ar_unbanked_check_case: the note is at most 500 characters';
  END IF;
  UPDATE public.ar_unbanked_check_cases
  SET closed_at = now(), closed_by = auth.uid(), closed_reason = p_reason, closed_note = v_note
  WHERE id = p_case_id AND closed_at IS NULL;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'This check has no open case to close.' USING ERRCODE = 'P0001';
  END IF;
  RETURN jsonb_build_object('ok', true);
END;
$function$;

REVOKE ALL ON FUNCTION public.close_ar_unbanked_check_case(uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.close_ar_unbanked_check_case(uuid, text, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.reopen_ar_unbanked_check_case(p_case_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'reopen_ar_unbanked_check_case: not authenticated';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.id = auth.uid()
      AND u.role IN ('dev', 'master_technician', 'assistant', 'controller', 'primary')
  ) THEN
    RAISE EXCEPTION 'reopen_ar_unbanked_check_case: not authorized';
  END IF;
  -- Only a case the office closed reopens: a deposited or taken-off case has nothing left to chase.
  UPDATE public.ar_unbanked_check_cases
  SET closed_at = NULL, closed_by = NULL, closed_reason = NULL, closed_note = NULL
  WHERE id = p_case_id AND closed_reason IN ('settled_other_way', 'not_coming');
  IF NOT FOUND THEN
    RAISE EXCEPTION 'This case cannot be opened again.' USING ERRCODE = 'P0001';
  END IF;
  RETURN jsonb_build_object('ok', true);
END;
$function$;

REVOKE ALL ON FUNCTION public.reopen_ar_unbanked_check_case(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reopen_ar_unbanked_check_case(uuid) TO authenticated;

-- 6 ---------------------------------------------------------------------------------
-- The body through the first RETURN QUERY is 20261001230000's, unchanged; the unbanked cases
-- follow as a second RETURN QUERY.

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

  -- v2.4902: a check typed in by hand that never reached the bank. The case's id stands in for the
  -- deposit; the payment, live or as the case kept it, is the recorded payment.
  RETURN QUERY
  SELECT
    c.id,
    coalesce(
      CASE WHEN j.bill_to_party = 'gc' THEN nullif(btrim(coalesce(gcc.name, '')), '') END,
      nullif(btrim(coalesce(j.customer_name, '')), ''),
      nullif(btrim(coalesce(cc.name, '')), '')
    ),
    abs(c.amount)::numeric,
    coalesce(c.payment_type, 'check'),
    NULL::timestamptz,
    NULL::timestamptz,
    NULL::text,
    'unbanked'::text,
    c.opened_at,
    c.closed_at,
    c.closed_reason,
    c.closed_note,
    (SELECT coalesce(nullif(u.name, ''), u.email) FROM public.users u WHERE u.id = c.closed_by),
    NULL::uuid,
    c.notified_at,
    '[]'::jsonb,
    NULL::jsonb,
    jsonb_build_object(
      'payment_id', c.payment_id,
      'job_id', coalesce(p.job_id, c.job_id),
      'job_number', coalesce(nullif(j.hcp_number, ''), nullif(j.click_number, ''), ''),
      'job_name', j.job_name,
      'amount', coalesce(p.amount, c.amount),
      'paid_on', coalesce(p.paid_on, c.paid_on),
      'reference_number', c.reference_number,
      'job_revenue', j.revenue,
      'job_payments_made', j.payments_made
    ),
    NULL::jsonb
  FROM public.ar_unbanked_check_cases c
  LEFT JOIN public.jobs_ledger_payments p ON p.id = c.payment_id
  LEFT JOIN public.jobs_ledger j ON j.id = coalesce(p.job_id, c.job_id)
  LEFT JOIN public.customers cc ON cc.id = j.customer_id
  LEFT JOIN public.customers gcc ON gcc.id = j.gc_customer_id
  WHERE p_include_closed OR c.closed_at IS NULL
  ORDER BY c.opened_at DESC, c.id;
END;
$function$;

REVOKE ALL ON FUNCTION public.list_ar_return_cases(boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_ar_return_cases(boolean) TO authenticated, service_role;

COMMENT ON FUNCTION public.list_ar_return_cases(boolean) IS
  'Accounts Receivable (v2.4320; unbanked cases v2.4902): every open case of a check that came back (all of them with p_include_closed) — the deposit, the bank''s reason, the case''s source and close, whether the office was told, the payments still carrying it (live_payments), the job it was on last (last_job, from deleted_records_archive) and, when no job ever carried it, the payment recorded by hand it matches (recorded_payment); promise = the newest They said… on those jobs since the check came back. Then the checks typed in by hand that never reached the bank (source unbanked, ar_unbanked_check_cases): the case''s own id in mercury_transaction_id, the payment in recorded_payment. Dev/master/assistant/controller/primary, and the service role (the notifier).';

-- 7 ---------------------------------------------------------------------------------

SELECT public.open_ar_unbanked_check_cases(10, '2026-07-01', true);

-- House rules: read-only training mode + the twin write fence cover every new table.
SELECT public.apply_read_only_write_blocks();
SELECT public.apply_read_only_stmt_blocks();
SELECT public.apply_digital_twin_write_blocks();
