SET lock_timeout = '3s';

-- Bills sent, punch list #422, PR 2: a Stripe payment is filed on the company's day.
--
-- mark_invoice_paid_from_stripe writes the payment row when Stripe says a bill was paid. Its day was
-- COALESCE(p_paid_on, (CURRENT_TIMESTAMP AT TIME ZONE 'UTC')::date), beside a note that the webhook always sends the
-- day. It does not: stripe-webhook passes p_paid_on only from the invoice's pt_paid_on metadata, which is written for
-- a bill marked paid outside Stripe (record-stripe-invoice-out-of-band-payment). A customer who pays by card or bank
-- debit names no day, so the row took the UTC date of the webhook: a payment made after 6 PM Central in winter, or
-- 7 PM in summer, was filed on the next day. Every reader of jobs_ledger_payments.paid_on carried it: the Dashboard's
-- Money in bar, the Bridge, Weekly money, a customer's timeline, and now Bills sent.
--
-- The one change is that default: public.app_today() (20260903190000), today in the company's calendar. The rest of
-- the body is 20261001153000_payment_actor_and_link.sql's, line for line. Same six arguments, so CREATE OR REPLACE
-- keeps its grants (service_role alone), which are named again below in case they were ever widened.
--
-- Rows already written are not touched here. Correcting them is a separate step, after their list is read.
--
-- No table, so no house calls. See docs/migrations/20261123074206_stripe_paid_day_is_the_company_day.md.

create or replace function public.mark_invoice_paid_from_stripe(
  p_invoice_id uuid,
  p_payment_type text default null,
  p_reference_number text default null,
  p_paid_on date default null,
  p_internal_note text default null,
  p_recorded_by uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
DECLARE
  v_invoice RECORD;
  v_next_order INTEGER;
  v_applied NUMERIC;
  v_remaining NUMERIC;
  v_paid_on DATE;
  v_pt TEXT;
  v_ref TEXT;
  v_note TEXT;
  v_row_note TEXT;
BEGIN
  -- B6: FOR UPDATE serializes the dual-event webhook race (invoice.paid +
  -- invoice.payment_succeeded) — the second call waits, then exits on the
  -- 'paid' / remaining<=0 checks instead of inserting a duplicate row.
  SELECT id, job_id, amount, status INTO v_invoice
  FROM public.jobs_ledger_invoices
  WHERE id = p_invoice_id
  FOR UPDATE;

  IF v_invoice.id IS NULL THEN
    RETURN jsonb_build_object('error', 'Invoice not found');
  END IF;

  IF v_invoice.status = 'paid' THEN
    RETURN jsonb_build_object('ok', true);
  END IF;

  IF v_invoice.status <> 'billed' THEN
    RETURN jsonb_build_object('error', 'Invoice must be in Billed status to mark as paid');
  END IF;

  SELECT COALESCE(SUM(amount), 0) INTO v_applied
  FROM public.jobs_ledger_payments
  WHERE invoice_id = p_invoice_id;

  v_remaining := COALESCE(v_invoice.amount, 0) - v_applied;

  IF v_remaining <= 0 THEN
    UPDATE public.jobs_ledger_invoices SET status = 'paid' WHERE id = p_invoice_id;
    RETURN jsonb_build_object('ok', true);
  END IF;

  -- The company's day, not the UTC clock's: the webhook names a day only for a bill marked paid outside Stripe.
  v_paid_on := COALESCE(p_paid_on, public.app_today());
  v_pt := NULLIF(trim(COALESCE(p_payment_type, '')), '');
  v_ref := NULLIF(trim(COALESCE(p_reference_number, '')), '');
  v_note := NULLIF(trim(COALESCE(p_internal_note, '')), '');

  IF v_pt IS NULL AND v_ref IS NULL AND v_note IS NULL THEN
    v_row_note := 'Stripe';
  ELSE
    v_row_note := v_note;
  END IF;

  SELECT COALESCE(MAX(sequence_order), -1) + 1 INTO v_next_order
  FROM public.jobs_ledger_payments
  WHERE job_id = v_invoice.job_id;

  INSERT INTO public.jobs_ledger_payments (
    job_id,
    amount,
    sequence_order,
    paid_on,
    note,
    invoice_id,
    payment_type,
    reference_number,
    created_by
  )
  VALUES (
    v_invoice.job_id,
    v_remaining,
    v_next_order,
    v_paid_on,
    v_row_note,
    p_invoice_id,
    v_pt,
    v_ref,
    p_recorded_by
  );

  -- B3: payments_made is trigger-maintained (already includes this payment).
  UPDATE public.jobs_ledger
  SET status = CASE
        WHEN COALESCE(revenue, 0) <= COALESCE(payments_made, 0) THEN 'paid'
        ELSE status
      END,
      updated_at = NOW()
  WHERE id = v_invoice.job_id;

  UPDATE public.jobs_ledger_invoices
  SET status = 'paid'
  WHERE id = p_invoice_id;

  RETURN jsonb_build_object('ok', true);
END;
$function$;

COMMENT ON FUNCTION public.mark_invoice_paid_from_stripe(uuid, text, text, date, text, uuid) IS
  'stripe-webhook''s write when Stripe says a bill was paid: one jobs_ledger_payments row for what was still open on the bill, the bill and (when fully paid) the job marked paid. The day is p_paid_on when the webhook names one (a bill marked paid outside Stripe), else today in the company''s calendar (public.app_today(), since 20261123074206; it was the UTC date before). Service role only.';

REVOKE ALL ON FUNCTION public.mark_invoice_paid_from_stripe(uuid, text, text, date, text, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mark_invoice_paid_from_stripe(uuid, text, text, date, text, uuid) TO service_role;
