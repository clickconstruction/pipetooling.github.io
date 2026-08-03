SET lock_timeout = '3s';

-- Billed-report payload fidelity fix (v2.1316). The v2.1315 body restricted
-- invoice rows to jobs with status='billed', but the board's Billed section
-- (stagesBoardLists in src/lib/jobsStagesBoard.ts) takes billed-STATUS invoice
-- rows from jobs of ANY status — a working job with a billed break-off invoice
-- shows in Billed Awaiting Payment. Post-push comparison against prod caught
-- the gap (RPC 52 rows / $95,484.73 vs board 58 rows / $188.1k).
--
-- Corrected semantics (kernel-faithful):
--   * invoice rows: billed-status invoices from jobs of any NON-PAID status,
--     excluding Collections jobs (status='billed' AND collections_at set) —
--     paid jobs are excluded to match the board, whose shared jobs list omits
--     Paid in Full (a leftover open billed row on a paid job is a
--     reconciliation artifact, not receivable money; prod has exactly one:
--     $487.50, which was the off-by-one in the first verification pass);
--   * job-shell rows: billed non-collections jobs with ZERO billed invoices;
--   * 'Billed line' merged label only when the JOB is status='billed' with
--     exactly one billed invoice (buildBilledStageRows merge rule) — a
--     working job's billed invoice is a plain 'Invoice #N' row.

CREATE OR REPLACE FUNCTION public.get_billed_report_email_payload()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
WITH billed_inv AS (
  SELECT i.id, i.job_id, i.amount, i.sequence_order, i.billed_at, i.estimated_bill_date,
         j.status AS job_status,
         j.hcp_number, j.click_number, j.job_name, j.job_address,
         j.customer_id, j.customer_name, j.customer_email, j.customer_phone,
         COUNT(*) OVER (PARTITION BY i.job_id) AS n_billed
  FROM public.jobs_ledger_invoices i
  JOIN public.jobs_ledger j ON j.id = i.job_id
  WHERE i.status = 'billed'
    AND j.status <> 'paid'
    AND NOT (j.status = 'billed' AND j.collections_at IS NOT NULL)
),
shell_jobs AS (
  SELECT j.*
  FROM public.jobs_ledger j
  WHERE j.status = 'billed'
    AND j.collections_at IS NULL
    AND NOT EXISTS (
      SELECT 1 FROM public.jobs_ledger_invoices i
      WHERE i.job_id = j.id AND i.status = 'billed'
    )
),
inv_applied AS (
  SELECT p.invoice_id, COALESCE(SUM(p.amount), 0) AS applied
  FROM public.jobs_ledger_payments p
  WHERE p.invoice_id IS NOT NULL
  GROUP BY p.invoice_id
),
chicago_today AS (
  SELECT (now() AT TIME ZONE 'America/Chicago')::date AS today
),
rows_all AS (
  SELECT
    i.job_id,
    COALESCE(NULLIF(trim(i.hcp_number), ''), i.click_number) AS display_number,
    i.job_name,
    i.job_address,
    i.customer_id,
    i.customer_name,
    i.customer_email,
    i.customer_phone,
    CASE WHEN i.job_status = 'billed' AND i.n_billed = 1 THEN 'Billed line'
         ELSE 'Invoice #' || i.sequence_order END AS detail,
    COALESCE((i.billed_at AT TIME ZONE 'America/Chicago')::date, i.estimated_bill_date) AS ref_date,
    (i.billed_at IS NULL AND i.estimated_bill_date IS NOT NULL) AS ref_is_estimate,
    GREATEST(0, COALESCE(i.amount, 0) - COALESCE(a.applied, 0)) AS remaining,
    i.estimated_bill_date AS aging_ref_date
  FROM billed_inv i
  LEFT JOIN inv_applied a ON a.invoice_id = i.id
  UNION ALL
  SELECT
    j.id,
    COALESCE(NULLIF(trim(j.hcp_number), ''), j.click_number),
    j.job_name,
    j.job_address,
    j.customer_id,
    j.customer_name,
    j.customer_email,
    j.customer_phone,
    'Job balance',
    NULL::date,
    false,
    COALESCE(j.revenue, 0) - COALESCE(j.payments_made, 0),
    NULL::date
  FROM shell_jobs j
),
rows_dated AS (
  SELECT r.*,
         CASE WHEN r.ref_date IS NOT NULL AND r.ref_date <= ct.today
              THEN (ct.today - r.ref_date)
              ELSE NULL END AS days_past,
         CASE
           WHEN r.aging_ref_date IS NULL OR r.remaining <= 0 THEN NULL
           WHEN (ct.today - r.aging_ref_date) >= 90 THEN '90'
           WHEN (ct.today - r.aging_ref_date) >= 30 THEN '30_90'
           ELSE NULL
         END AS aging_bucket
  FROM rows_all r
  CROSS JOIN chicago_today ct
)
SELECT jsonb_build_object(
  'generated_at', now(),
  'totals', jsonb_build_object(
    'row_count', (SELECT COUNT(*) FROM rows_dated),
    'grand_total', COALESCE((SELECT round(SUM(remaining)::numeric, 2) FROM rows_dated), 0),
    'count30_90', (SELECT COUNT(*) FROM rows_dated WHERE aging_bucket = '30_90'),
    'sum30_90', COALESCE((SELECT round(SUM(remaining)::numeric, 2) FROM rows_dated WHERE aging_bucket = '30_90'), 0),
    'count90', (SELECT COUNT(*) FROM rows_dated WHERE aging_bucket = '90'),
    'sum90', COALESCE((SELECT round(SUM(remaining)::numeric, 2) FROM rows_dated WHERE aging_bucket = '90'), 0)
  ),
  'rows', COALESCE((SELECT jsonb_agg(jsonb_build_object(
    'job_id', r.job_id,
    'display_number', r.display_number,
    'job_name', r.job_name,
    'job_address', r.job_address,
    'customer_id', r.customer_id,
    'customer_name', r.customer_name,
    'customer_email', r.customer_email,
    'customer_phone', r.customer_phone,
    'detail', r.detail,
    'ref_date', r.ref_date,
    'ref_is_estimate', r.ref_is_estimate,
    'days_past', r.days_past,
    'remaining', round(r.remaining::numeric, 2),
    'aging_bucket', r.aging_bucket
  )) FROM rows_dated r), '[]'::jsonb)
);
$$;
