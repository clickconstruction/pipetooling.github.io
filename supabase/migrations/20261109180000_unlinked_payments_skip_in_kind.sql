SET lock_timeout = '3s';

-- An in-kind payment is not money a deposit could carry (v2.6816).
--
-- The office's landlord settles finished work by taking it off the rent the company owes him, a
-- month at a time: the jobs' revenue stays whole, each credit pays the bills down, and no cash
-- arrives. Recorded with any of the cash kinds, the row sat on the deposit-matching list
-- (Accounts Receivable's recorded-payment candidates, the Dashboard's money-in week) waiting for
-- a deposit that never comes. The row's kind is the word "In kind" in payment_type (the app's
-- pickers write it; `supabase/functions/_shared/inKindPayment.ts` reads it), and this list leaves
-- such rows out. Body otherwise as 20260927230000_controller_money_functions.sql; same
-- signature, grants and answer shape, so no caller changes. Idempotent; no table created.

CREATE OR REPLACE FUNCTION public.list_unlinked_payments_for_bank_payments()
 RETURNS TABLE(payment_id uuid, job_id uuid, amount numeric, paid_on date, note text, payment_type text, reference_number text, invoice_id uuid, hcp_number text, click_number text, job_name text, stripe_hosted boolean)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT
    p.id,
    p.job_id,
    p.amount::numeric,
    p.paid_on,
    p.note,
    p.payment_type,
    p.reference_number,
    p.invoice_id,
    j.hcp_number,
    j.click_number,
    j.job_name,
    (coalesce(trim(i.stripe_invoice_id), '') <> '') AS stripe_hosted
  FROM public.jobs_ledger_payments p
  JOIN public.jobs_ledger j ON j.id = p.job_id
  LEFT JOIN public.jobs_ledger_invoices i ON i.id = p.invoice_id
  WHERE EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid()
        AND u.role IN ('dev', 'master_technician', 'assistant', 'controller', 'primary')
    )
    AND p.mercury_transaction_id IS NULL
    AND lower(coalesce(trim(p.note), '')) <> 'stripe'
    AND coalesce(p.amount, 0) > 0
    -- v2.6816: an in-kind payment is not money; no deposit will ever carry it.
    AND NOT (lower(coalesce(trim(p.payment_type), '')) ~ '(^|[^a-z])in[[:space:]-]?kind')
    AND (
      p.paid_on IS NULL
      OR p.paid_on >= ((CURRENT_TIMESTAMP AT TIME ZONE 'America/Chicago')::date - 180)
    )
  ORDER BY p.paid_on DESC NULLS LAST, p.id DESC
  LIMIT 500;
$function$;

COMMENT ON FUNCTION public.list_unlinked_payments_for_bank_payments() IS
  'Accounts Receivable: recorded payments no deposit carries yet (hand-typed, not Stripe, not in kind — v2.6816), the last 180 days, for matching to bank deposits. Dev/master/assistant/controller/primary.';
