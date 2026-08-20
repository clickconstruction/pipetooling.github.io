SET lock_timeout = '3s';

-- get_billed_customer_pay_speeds — per-customer "pays in ~N days" for the
-- Billed Awaiting Payment expected-payment chips.
--
-- Same rule as the Customer profile modal's "pays in ~N days" stat
-- (src/lib/customers/customerProfileStats.ts customerDaysToPay, v2.1322),
-- computed set-based across ALL customers in one call instead of per-profile:
--   * one sample per invoice-linked payment whose invoice has a billed_at
--     (job-level payments have no bill date to measure from — excluded);
--   * gap = paid_on − billed_at's calendar date in America/Chicago
--     (APP_CALENDAR_TZ), negative gaps clamped to 0;
--   * last 12 months by paid_on;
--   * median per customer (percentile_cont — interpolates the two middle
--     values on even counts, matching the kernel's rounded midpoint).
-- Also returns one company-wide median over the same samples, the fallback
-- for customers with too little history (the client decides the threshold).
--
-- Shape: { "company": { "medianDays": n, "samples": n } | null,
--          "customers": { "<customer_id>": { "medianDays": n, "samples": n } } }
--
-- Money-timing metadata only (no wage-derived data) ⇒ gate matches the roles
-- that can already see the Billed Awaiting Payment money on the Stages board:
-- dev, master_technician, assistant-like (is_assistant() = assistant +
-- controller), primary. Everyone else gets NULL and the chips simply don't
-- render.

CREATE OR REPLACE FUNCTION public.get_billed_customer_pay_speeds()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
WITH gate AS (
  SELECT public.is_dev()
      OR public.is_assistant()
      OR EXISTS (
           SELECT 1 FROM public.users u
           WHERE u.id = (SELECT auth.uid())
             AND u.role IN ('master_technician', 'primary')
         )
      AS ok
),
samples AS (
  SELECT
    j.customer_id,
    GREATEST(
      0,
      p.paid_on - (i.billed_at AT TIME ZONE 'America/Chicago')::date
    ) AS gap_days
  FROM public.jobs_ledger_payments p
  JOIN public.jobs_ledger_invoices i ON i.id = p.invoice_id
  JOIN public.jobs_ledger j ON j.id = i.job_id
  WHERE p.invoice_id IS NOT NULL
    AND p.paid_on IS NOT NULL
    AND i.billed_at IS NOT NULL
    AND j.customer_id IS NOT NULL
    AND p.paid_on >= (CURRENT_DATE - INTERVAL '12 months')::date
),
per_customer AS (
  SELECT
    customer_id,
    round(percentile_cont(0.5) WITHIN GROUP (ORDER BY gap_days))::int AS median_days,
    count(*)::int AS n
  FROM samples
  GROUP BY customer_id
),
company AS (
  SELECT
    round(percentile_cont(0.5) WITHIN GROUP (ORDER BY gap_days))::int AS median_days,
    count(*)::int AS n
  FROM samples
)
SELECT CASE WHEN NOT (SELECT ok FROM gate) THEN NULL ELSE
  jsonb_build_object(
    'company',
    (SELECT CASE WHEN n > 0
              THEN jsonb_build_object('medianDays', median_days, 'samples', n)
              ELSE NULL END
       FROM company),
    'customers',
    COALESCE(
      (SELECT jsonb_object_agg(
                customer_id::text,
                jsonb_build_object('medianDays', median_days, 'samples', n))
         FROM per_customer),
      '{}'::jsonb
    )
  )
END;
$$;

COMMENT ON FUNCTION public.get_billed_customer_pay_speeds() IS
  'Per-customer median billed_at→paid_on gap (last 12 months, invoice-linked payments only) + company-wide median — the Billed Awaiting Payment expected-payment chips. Mirrors customerProfileStats.customerDaysToPay. NULL for callers outside dev/master/assistant-like/primary.';

REVOKE EXECUTE ON FUNCTION public.get_billed_customer_pay_speeds() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_billed_customer_pay_speeds() FROM anon;
GRANT EXECUTE ON FUNCTION public.get_billed_customer_pay_speeds() TO authenticated;
