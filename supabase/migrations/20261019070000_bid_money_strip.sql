SET lock_timeout = '3s';

-- The money line under a won bid (punch list #129, PR 2; to-dos/estimator-money-word/README.md). The job's people
-- (is_job_people, 20261019060000) read where the job born of a bid stands on money without a jobs_ledger row of their
-- own: one SECURITY DEFINER read per bid, the shape the client's own kernels already take (papers.ts's billPapers over
-- the bill truth, billLink.ts's newestBillLink, paymentPromises.ts's parse), so the open amount, the pay page and the
-- customer's word are worked out by the same code the Pipeline and the reply box use. Nothing on jobs_ledger's
-- policies changes. A bid whose newest job the caller is no person of comes back with no entry.
-- Idempotent: CREATE OR REPLACE.

CREATE OR REPLACE FUNCTION public.list_bid_money_strip(p_bid_ids uuid[])
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH job_for_bid AS (
    SELECT DISTINCT ON (j.bid_id) j.bid_id, j.*
    FROM public.jobs_ledger j
    WHERE j.bid_id = ANY (COALESCE(p_bid_ids, '{}'::uuid[]))
    ORDER BY j.bid_id, j.created_at DESC
  ),
  mine AS (
    SELECT jb.* FROM job_for_bid jb WHERE public.is_job_people(jb.id)
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
    ) ORDER BY m.bid_id), '[]'::jsonb)
  FROM mine m;
$$;

COMMENT ON FUNCTION public.list_bid_money_strip(uuid[]) IS
  'The money line under a won bid (punch list #129): per bid, the newest job opened from it with its bills, payments and live promises, in the rows the client''s bill-truth and promise kernels take; only the bids whose job the caller is a person of (is_job_people). No entry for a bid with no job or no standing.';

REVOKE ALL ON FUNCTION public.list_bid_money_strip(uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_bid_money_strip(uuid[]) TO authenticated, service_role;
