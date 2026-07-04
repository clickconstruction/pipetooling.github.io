-- Bid Board → Customer review modal: lifetime job clock hours per customer.
--
-- SECURITY DEFINER aggregate so bid-board roles can see per-customer job hours
-- without direct SELECT on other users' clock_sessions rows — same pattern and
-- session filters as list_bid_estimators_all_time_hours (Estimators tab).
-- Estimating (bid) hours are NOT here: the client reuses
-- list_bid_estimators_all_time_hours per bid so hours group client-side under
-- the same customer/gc-builder key as the bid category counts.

CREATE OR REPLACE FUNCTION public.list_customer_review_job_hours()
RETURNS TABLE("customer_id" uuid, "customer_name" text, "hours" numeric)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT
    jl.customer_id,
    c.name AS customer_name,
    SUM(
      EXTRACT(EPOCH FROM (COALESCE(cs.clocked_out_at, now()) - cs.clocked_in_at)) / 3600.0
    )::numeric AS hours
  FROM public.clock_sessions cs
  JOIN public.jobs_ledger jl ON jl.id = cs.job_ledger_id
  JOIN public.customers c ON c.id = jl.customer_id
  WHERE cs.rejected_at IS NULL
    AND cs.revoked_at IS NULL
    AND COALESCE(cs.clocked_out_at, now()) > cs.clocked_in_at
  GROUP BY jl.customer_id, c.name;
$$;

COMMENT ON FUNCTION public.list_customer_review_job_hours() IS
  'Bid Board → Customer review modal: lifetime total job clock hours grouped by jobs_ledger.customer_id. Excludes rejected/revoked sessions; clips open sessions at now(). Aggregated-only (RLS-safe for bid-board roles).';

GRANT EXECUTE ON FUNCTION public.list_customer_review_job_hours() TO authenticated;
