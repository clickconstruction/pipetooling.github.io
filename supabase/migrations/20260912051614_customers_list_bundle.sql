SET lock_timeout = '3s';

-- Customers list in one round trip (v2.3365). The Customers page used to make
-- 55 follow-up requests after the customer rows — five per-customer count
-- tables in chunks of 150 ids, then invoices and payments in chunks of 150
-- job ids, each chunk awaited in turn — and held "Loading customers…" until
-- the last one landed (3.7 s on a fast link, far longer on a phone). This
-- function returns every row those requests fetched, as one jsonb, so the
-- page makes one call. It is SECURITY INVOKER: every table is read under the
-- caller's own RLS, exactly as the client reads were. No money math lives
-- here — the client's tested kernel (customersListRollup) still does it.

CREATE OR REPLACE FUNCTION public.get_customers_list_bundle()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  WITH j AS (
    SELECT jl.id, jl.customer_id, jl.status, jl.revenue, jl.payments_made, jl.created_at
    FROM public.jobs_ledger jl
    WHERE jl.customer_id IS NOT NULL
  )
  SELECT jsonb_build_object(
    'projects', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('customer_id', p.customer_id, 'n', p.n))
      FROM (SELECT customer_id, count(*)::int AS n FROM public.projects WHERE customer_id IS NOT NULL GROUP BY customer_id) p
    ), '[]'::jsonb),
    'bids', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('customer_id', b.customer_id, 'n', b.n, 'latest', b.latest))
      FROM (SELECT customer_id, count(*)::int AS n, max(created_at) AS latest FROM public.bids WHERE customer_id IS NOT NULL GROUP BY customer_id) b
    ), '[]'::jsonb),
    'notes', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('customer_id', n.customer_id, 'n', n.n))
      FROM (SELECT customer_id, count(*)::int AS n FROM public.customer_contacts WHERE customer_id IS NOT NULL GROUP BY customer_id) n
    ), '[]'::jsonb),
    'estimates', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('customer_id', e.customer_id, 'latest', e.latest))
      FROM (SELECT customer_id, max(created_at) AS latest FROM public.estimates WHERE customer_id IS NOT NULL GROUP BY customer_id) e
    ), '[]'::jsonb),
    'jobs', COALESCE((SELECT jsonb_agg(to_jsonb(j)) FROM j), '[]'::jsonb),
    'invoices', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('id', i.id, 'job_id', i.job_id, 'status', i.status, 'amount', i.amount))
      FROM public.jobs_ledger_invoices i
      WHERE i.job_id IN (SELECT id FROM j)
    ), '[]'::jsonb),
    'payments', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('job_id', p.job_id, 'invoice_id', p.invoice_id, 'amount', p.amount, 'paid_on', p.paid_on))
      FROM public.jobs_ledger_payments p
      WHERE p.job_id IN (SELECT id FROM j)
    ), '[]'::jsonb),
    'unlinked_jobs', (SELECT count(*)::int FROM public.jobs_ledger WHERE customer_id IS NULL)
  );
$$;

COMMENT ON FUNCTION public.get_customers_list_bundle() IS
  'v2.3365: everything the Customers page needs after the customer rows — per-customer project / bid / note counts, latest bid and estimate stamps, the jobs with a customer, their invoices and payments, the unlinked-jobs count — in one jsonb. SECURITY INVOKER: the caller''s RLS applies to every table.';

REVOKE ALL ON FUNCTION public.get_customers_list_bundle() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_customers_list_bundle() FROM anon;
GRANT EXECUTE ON FUNCTION public.get_customers_list_bundle() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_customers_list_bundle() TO service_role;
