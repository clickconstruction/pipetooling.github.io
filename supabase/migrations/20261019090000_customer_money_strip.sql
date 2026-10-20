SET lock_timeout = '3s';

-- The word from the thread (punch list #129, PR 3b; to-dos/estimator-money-word/README.md). Under a customer's line in
-- Messages, the office or the job's people write down the customer's word on paying, and the word lands on the job
-- the line is tied to, else on the customer's one job with money open, else the person picks. This read hands the
-- thread the customer's jobs the caller is a person of (is_job_people, 20261019060000), each with its bills, payments
-- and live words, in the rows the client's own kernels take, as list_bid_money_strip (20261019070000) does per bid.
-- Nothing on jobs_ledger's policies changes. Idempotent: CREATE OR REPLACE.

CREATE OR REPLACE FUNCTION public.list_customer_money_strip(p_customer_id uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH mine AS (
    SELECT j.* FROM public.jobs_ledger j
    WHERE p_customer_id IS NOT NULL
      AND j.customer_id = p_customer_id
      AND public.is_job_people(j.id)
  )
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'bidId', m.bid_id,
      'job', jsonb_build_object(
        'id', m.id,
        'status', m.status,
        'revenue', m.revenue,
        'payments_made', m.payments_made,
        'collections_at', m.collections_at,
        'uncollectible_at', m.uncollectible_at,
        'job_name', m.job_name,
        'hcp_number', m.hcp_number,
        'click_number', m.click_number,
        'billing_only', m.billing_only,
        'customer_id', m.customer_id,
        'customer_name', m.customer_name,
        'customer_phone', m.customer_phone,
        'customer_email', m.customer_email,
        'created_at', m.created_at
      ),
      'invoices', COALESCE((
        SELECT jsonb_agg(jsonb_build_object(
          'id', i.id, 'job_id', i.job_id, 'status', i.status, 'amount', i.amount, 'sequence_order', i.sequence_order,
          'billed_at', i.billed_at, 'created_at', i.created_at, 'stripe_invoice_id', i.stripe_invoice_id
        ) ORDER BY i.sequence_order, i.created_at)
        FROM public.jobs_ledger_invoices i WHERE i.job_id = m.id), '[]'::jsonb),
      'payments', COALESCE((
        SELECT jsonb_agg(jsonb_build_object(
          'invoice_id', p.invoice_id, 'job_id', p.job_id, 'amount', p.amount, 'paid_on', p.paid_on, 'sequence_order', p.sequence_order
        ) ORDER BY p.paid_on, p.sequence_order)
        FROM public.jobs_ledger_payments p WHERE p.job_id = m.id), '[]'::jsonb),
      'promises', COALESCE(public.list_job_payment_promises_for(m.id), '[]'::jsonb)
    ) ORDER BY m.created_at DESC), '[]'::jsonb)
  FROM mine m;
$$;

COMMENT ON FUNCTION public.list_customer_money_strip(uuid) IS
  'The word from the thread (punch list #129): a customer''s jobs the caller is a person of (is_job_people), newest first, each with its bills, payments and live words in the rows the client''s bill-truth and promise kernels take. [] for a customer with none, or nobody''s.';

REVOKE ALL ON FUNCTION public.list_customer_money_strip(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_customer_money_strip(uuid) TO authenticated, service_role;
