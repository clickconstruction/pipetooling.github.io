SET lock_timeout = '3s';

-- get_billed_customer_pay_speeds v3 — adds per-customer payment receipts for
-- the Pay speeds breakdown modal (v3 of 20260821120000; the live body IS that
-- migration, so replacing from this repo copy is safe):
--
--   * receipts — customer id → array of the customer's measurable payments
--     ({billedYmd, paidYmd, gapDays}, newest paid first, capped at 12 per
--     customer), so the breakdown can show the evidence behind each median
--     instead of just the aggregate.
--
-- Everything else (company/segment medians, per-customer medians, the
-- customer-type map, the role gate) is unchanged from v2.

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
    (i.billed_at AT TIME ZONE 'America/Chicago')::date AS billed_on,
    p.paid_on,
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
),
segments AS (
  SELECT
    c.customer_type AS seg,
    round(percentile_cont(0.5) WITHIN GROUP (ORDER BY s.gap_days))::int AS median_days,
    count(*)::int AS n
  FROM samples s
  JOIN public.customers c ON c.id = s.customer_id
  WHERE c.customer_type IN ('residential', 'commercial')
  GROUP BY c.customer_type
),
typed_customers AS (
  SELECT id, customer_type
  FROM public.customers
  WHERE customer_type IN ('residential', 'commercial')
),
recent_samples AS (
  SELECT
    customer_id,
    billed_on,
    paid_on,
    gap_days,
    row_number() OVER (
      PARTITION BY customer_id
      ORDER BY paid_on DESC, billed_on DESC
    ) AS rn
  FROM samples
),
receipts AS (
  SELECT
    customer_id,
    jsonb_agg(
      jsonb_build_object(
        'billedYmd', to_char(billed_on, 'YYYY-MM-DD'),
        'paidYmd', to_char(paid_on, 'YYYY-MM-DD'),
        'gapDays', gap_days
      )
      ORDER BY paid_on DESC, billed_on DESC
    ) AS arr
  FROM recent_samples
  WHERE rn <= 12
  GROUP BY customer_id
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
    ),
    'segments',
    jsonb_build_object(
      'residential',
      (SELECT jsonb_build_object('medianDays', median_days, 'samples', n)
         FROM segments WHERE seg = 'residential'),
      'commercial',
      (SELECT jsonb_build_object('medianDays', median_days, 'samples', n)
         FROM segments WHERE seg = 'commercial')
    ),
    'customerTypes',
    COALESCE(
      (SELECT jsonb_object_agg(id::text, customer_type) FROM typed_customers),
      '{}'::jsonb
    ),
    'receipts',
    COALESCE(
      (SELECT jsonb_object_agg(customer_id::text, arr) FROM receipts),
      '{}'::jsonb
    )
  )
END;
$$;

COMMENT ON FUNCTION public.get_billed_customer_pay_speeds() IS
  'Per-customer median billed_at→paid_on gap (last 12 months, invoice-linked payments only) + company-wide median + residential/commercial segment medians + customer-type map + per-customer payment receipts (billed/paid dates, newest 12) — the Billed expected-payment chips and Payment forecast pay-speeds surfaces. NULL for callers outside dev/master/assistant-like/primary.';

REVOKE EXECUTE ON FUNCTION public.get_billed_customer_pay_speeds() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_billed_customer_pay_speeds() FROM anon;
GRANT EXECUTE ON FUNCTION public.get_billed_customer_pay_speeds() TO authenticated;
