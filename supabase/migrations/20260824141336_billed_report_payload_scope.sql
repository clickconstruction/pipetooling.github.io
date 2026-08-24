SET lock_timeout = '3s';

-- Billed-report email payload: match the BOARD's row scope, not just
-- status='billed' jobs (v2.2228, fixes v2.1315's 20260803100000).
--
-- The board flatMaps billed INVOICE LINES across ALL loaded jobs
-- (jobsStagesBoard.ts `billedInvoices` — progressive billing bills break-off
-- lines while the job is still Working: e.g. jobs 878 / 650 / 967 on
-- 2026-08-24), excluding only collections (jobInCollections: job status
-- 'billed' AND collections_at set). The original payload selected invoices
-- only from status='billed' jobs, so the emailed report was missing rows the
-- print report showed. Same drift, same fix as the payment-forecast payload
-- (20260824140029, v2.2227).
--
-- Fidelity notes (mirrors the client board kernels; keep in sync):
--   * Invoice rows = billed invoice lines on ANY non-collections job
--     (buildBilledStageRows over billedActiveRows' inputs). The merged
--     'Billed line' detail applies only when the JOB is billed with exactly
--     one billed line (the merge loop iterates billedActiveJobs only) — a
--     Working job's single billed line renders 'Invoice #N' on the board.
--   * Job-shell rows unchanged: billed non-collections job with 0 billed
--     lines → 'Job balance' (remaining = revenue − payments_made, no date).
--   * days_past reference = billed_at first, else estimated_bill_date with
--     ref_is_estimate (printBilledRowReferenceDate).
--   * aging_bucket = estimated_bill_date ONLY + remaining > 0 at 30/90 days
--     (the 20260803100000 rule, unchanged here — only the scope changes).

CREATE OR REPLACE FUNCTION public.get_billed_report_email_payload()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
WITH billed_jobs AS (
  -- Job shells + the merged-row rule live here (status='billed', active).
  SELECT j.*
  FROM public.jobs_ledger j
  WHERE j.status = 'billed'
    AND j.collections_at IS NULL
),
billed_inv AS (
  -- The board's rule: every billed line on any non-collections job.
  SELECT i.*, j.status AS job_status,
         COUNT(*) OVER (PARTITION BY i.job_id) AS n_billed
  FROM public.jobs_ledger_invoices i
  JOIN public.jobs_ledger j ON j.id = i.job_id
  WHERE i.status = 'billed'
    AND NOT (j.status = 'billed' AND j.collections_at IS NOT NULL)
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
  -- invoice rows (incl. the board's merged single-invoice rows on billed jobs)
  SELECT
    j.id AS job_id,
    COALESCE(NULLIF(trim(j.hcp_number), ''), j.click_number) AS display_number,
    j.job_name,
    j.job_address,
    j.customer_id,
    j.customer_name,
    j.customer_email,
    j.customer_phone,
    CASE WHEN i.job_status = 'billed' AND i.n_billed = 1
         THEN 'Billed line'
         ELSE 'Invoice #' || i.sequence_order END AS detail,
    COALESCE((i.billed_at AT TIME ZONE 'America/Chicago')::date, i.estimated_bill_date) AS ref_date,
    (i.billed_at IS NULL AND i.estimated_bill_date IS NOT NULL) AS ref_is_estimate,
    GREATEST(0, COALESCE(i.amount, 0) - COALESCE(a.applied, 0)) AS remaining,
    i.estimated_bill_date AS aging_ref_date
  FROM billed_inv i
  JOIN public.jobs_ledger j ON j.id = i.job_id
  LEFT JOIN inv_applied a ON a.invoice_id = i.id
  UNION ALL
  -- job-shell rows (billed jobs with no billed invoice lines)
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
  FROM billed_jobs j
  WHERE NOT EXISTS (SELECT 1 FROM billed_inv i WHERE i.job_id = j.id)
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

COMMENT ON FUNCTION public.get_billed_report_email_payload() IS
  'Billed Awaiting Payment report payload for billed-report-email (v2.2228, scope-fixed). Service-role only; mirrors the client board kernels — invoice rows are every billed line on any non-collections job (jobsStagesBoard.ts billedInvoices flatMap), job shells and merged rows come from status=billed jobs only. Fidelity notes: migrations 20260803100000 + 20260824141336.';
