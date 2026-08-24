SET lock_timeout = '3s';

-- Payment forecast payload: match the BOARD's row scope, not the billed-report
-- email's (v2.2227, fixes v2.2223).
--
-- Found during live fidelity verification: the modal showed 58 rows /
-- $233,291 while the email built 54 rows / $171,187. The board flatMaps
-- billed INVOICE LINES across ALL loaded jobs (jobsStagesBoard.ts
-- `billedInvoices` — progressive billing bills break-off lines while the job
-- is still Working: e.g. jobs 878 / 650 / 967 on 2026-08-24), excluding only
-- collections (jobInCollections: job status 'billed' AND collections_at set).
-- v2.2223 copied the billed-report payload's `j.status = 'billed'` job filter
-- and missed those lines. (The billed-report EMAIL has the same drift vs its
-- print sibling — tracked separately.)
--
-- Only the `billed_inv`/`forecast_rows` scope changes; pay-speed and promise
-- mirrors are unchanged from 20260824133529 (see its fidelity notes).

CREATE OR REPLACE FUNCTION public.get_payment_forecast_email_payload()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
WITH forecast_rows AS (
  SELECT
    i.id AS invoice_id,
    j.id AS job_id,
    COALESCE(NULLIF(trim(j.hcp_number), ''), j.click_number) AS display_number,
    j.job_name,
    j.customer_id,
    j.customer_name,
    i.billed_at,
    i.estimated_bill_date AS est_bill_ymd,
    GREATEST(0, COALESCE(i.amount, 0) - COALESCE(a.applied, 0)) AS remaining
  FROM public.jobs_ledger_invoices i
  JOIN public.jobs_ledger j ON j.id = i.job_id
  LEFT JOIN (
    SELECT p.invoice_id, COALESCE(SUM(p.amount), 0) AS applied
    FROM public.jobs_ledger_payments p
    WHERE p.invoice_id IS NOT NULL
    GROUP BY p.invoice_id
  ) a ON a.invoice_id = i.id
  WHERE i.status = 'billed'
    -- The board's collections exclusion, verbatim (jobInCollections).
    AND NOT (j.status = 'billed' AND j.collections_at IS NOT NULL)
),
-- Pay speeds (mirror of get_billed_customer_pay_speeds v2, gate removed).
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
)
SELECT jsonb_build_object(
  'generated_at', now(),
  'today', to_char((now() AT TIME ZONE 'America/Chicago')::date, 'YYYY-MM-DD'),
  'rows', COALESCE((SELECT jsonb_agg(jsonb_build_object(
    'invoice_id', r.invoice_id,
    'job_id', r.job_id,
    'display_number', r.display_number,
    'job_name', r.job_name,
    'customer_id', r.customer_id,
    'customer_name', r.customer_name,
    'billed_at', r.billed_at,
    'est_bill_ymd', r.est_bill_ymd,
    'remaining', round(r.remaining::numeric, 2)
  )) FROM forecast_rows r), '[]'::jsonb),
  'pay_speeds', jsonb_build_object(
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
    )
  ),
  'promises', COALESCE(
    (SELECT jsonb_object_agg(
              p.job_id::text,
              jsonb_build_object(
                'promisedYmd', to_char(p.promised_date, 'YYYY-MM-DD'),
                'markedByName', COALESCE(NULLIF(trim(u.name), ''), 'office')
              ))
       FROM public.job_promised_pay_dates p
       LEFT JOIN public.users u ON u.id = p.marked_by),
    '{}'::jsonb
  )
);
$$;

COMMENT ON FUNCTION public.get_payment_forecast_email_payload() IS
  'Payment forecast email payload for payment-forecast-email-dispatch (v2.2227, scope-fixed). Service-role only. Rows = every billed invoice line on any non-collections job (the BOARD''s rule — jobsStagesBoard.ts billedInvoices flatMap; progressive billing bills lines while jobs are still Working) + pay-speed medians + promised dates; bucketing runs in the dispatcher kernel port. Fidelity notes: migrations 20260824133529 + 20260824140029.';
