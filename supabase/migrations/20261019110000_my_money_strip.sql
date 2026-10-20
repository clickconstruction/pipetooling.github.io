SET lock_timeout = '3s';

-- Money on my bids (punch list #129, PR 5; to-dos/estimator-money-word/README.md). The Dashboard's card and the Bid
-- Board's lens read the jobs the signed-in person sold or holds: the jobs of the bids they estimated or account-manage,
-- and the jobs they account-manage, each with its bills, payments and live words in the rows the client's own kernels
-- take (as list_bid_money_strip, 20261019070000, does per bid). Nothing on jobs_ledger's policies changes; the office
-- reads its own through the same rule, since an assistant who account-manages a job is its person too.
-- Idempotent: CREATE OR REPLACE.

CREATE OR REPLACE FUNCTION public.list_my_money_strip()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH me AS (SELECT (SELECT auth.uid()) AS id),
  mine AS (
    SELECT DISTINCT j.*
    FROM public.jobs_ledger j
    LEFT JOIN public.bids b ON b.id = j.bid_id
    CROSS JOIN me
    WHERE me.id IS NOT NULL
      AND (j.account_manager_user_id = me.id OR b.estimator_id = me.id OR b.account_manager_id = me.id)
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

COMMENT ON FUNCTION public.list_my_money_strip() IS
  'Money on my bids (punch list #129): the signed-in person''s jobs, the ones of the bids they estimated or account-manage and the ones they account-manage, newest first, each with its bills, payments and live words in the rows the client''s bill-truth and promise kernels take. [] for nobody.';

REVOKE ALL ON FUNCTION public.list_my_money_strip() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_my_money_strip() TO authenticated, service_role;
