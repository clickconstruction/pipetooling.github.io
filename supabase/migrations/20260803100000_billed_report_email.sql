SET lock_timeout = '3s';

-- Billed Awaiting Payment report → email (v2.1315): the Stages print report,
-- shareable. Office staff (dev / master_technician / assistant-like) pick a
-- recipient and a send time; a queue row waits until due; the
-- billed-report-email edge function (pg_cron */5) rebuilds the billed board
-- SERVER-SIDE at send time (fresh numbers, never a stale snapshot) and emails
-- the report with tel:/mailto: contacts and per-job ?jobDetail= app links.
--
-- Pieces: billed_report_email_requests (one row per requested send),
-- get_billed_report_email_payload() (service-role payload RPC mirroring the
-- client board kernels — see the fidelity notes on the function), and the
-- cron registration (same Vault PROJECT_URL + CRON_SECRET pattern as
-- 20260722260000_paid_job_email.sql).

-- ── Requests table ───────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.billed_report_email_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  requested_by uuid NOT NULL REFERENCES public.users (id) ON DELETE CASCADE,
  recipient_user_id uuid NOT NULL REFERENCES public.users (id) ON DELETE CASCADE,
  send_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  sent_at timestamptz,
  error text,
  attempts int NOT NULL DEFAULT 0
);

COMMENT ON TABLE public.billed_report_email_requests IS
  'Requested sends of the Billed Awaiting Payment report email (v2.1315). Staff insert; the billed-report-email edge function (pg_cron */5) processes rows with send_at <= now() and stamps sent_at/error. The report is rebuilt at send time — rows carry no snapshot.';

CREATE INDEX IF NOT EXISTS idx_billed_report_email_requests_due
  ON public.billed_report_email_requests (send_at)
  WHERE sent_at IS NULL;

ALTER TABLE public.billed_report_email_requests ENABLE ROW LEVEL SECURITY;

-- Staff create their own requests (controller rides is_assistant()).
DROP POLICY IF EXISTS "Staff insert own billed report email requests" ON public.billed_report_email_requests;
CREATE POLICY "Staff insert own billed report email requests" ON public.billed_report_email_requests
  FOR INSERT WITH CHECK (
    requested_by = (SELECT auth.uid())
    AND (
      public.is_dev()
      OR public.is_assistant()
      OR EXISTS (
        SELECT 1 FROM public.users u
        WHERE u.id = (SELECT auth.uid()) AND u.role = 'master_technician'
      )
    )
  );

-- Creators see their own requests (the modal's "Scheduled sends" list); devs see all.
DROP POLICY IF EXISTS "Creators and devs read billed report email requests" ON public.billed_report_email_requests;
CREATE POLICY "Creators and devs read billed report email requests" ON public.billed_report_email_requests
  FOR SELECT USING (requested_by = (SELECT auth.uid()) OR public.is_dev());

-- Cancel = creator deletes an UNSENT row (sent rows are audit history; devs may clean up).
DROP POLICY IF EXISTS "Creators cancel own unsent billed report email requests" ON public.billed_report_email_requests;
CREATE POLICY "Creators cancel own unsent billed report email requests" ON public.billed_report_email_requests
  FOR DELETE USING (
    (requested_by = (SELECT auth.uid()) AND sent_at IS NULL) OR public.is_dev()
  );

-- No client UPDATE policy — only the service-role edge function stamps rows.

-- ── Payload RPC (service_role only; the edge function role-gates callers) ────
--
-- Fidelity notes (mirrors the client board kernels; keep in sync):
--   * Row selection = buildBilledStageRows (src/lib/jobsStagesBoard.ts):
--     billed job with 0 billed invoices → one job-shell row
--       (remaining = revenue − payments_made, no reference date);
--     billed job with 1+ billed invoices → one row per billed invoice
--       (remaining = GREATEST(0, amount − Σ payments(invoice_id)); a single
--       billed invoice is the board's merged row — detail 'Billed line').
--   * Collections rows excluded (jobInCollections: status billed AND
--     collections_at set) — matches the board's billedActiveRows.
--   * days_past reference = billed_at first, else estimated_bill_date with
--     ref_is_estimate (printBilledRowReferenceDate).
--   * aging_bucket = estimated_bill_date ONLY + remaining > 0 at 30/90 days
--     (billedStageRowAgingBucket — the header chips' rule).

CREATE OR REPLACE FUNCTION public.get_billed_report_email_payload()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
WITH billed_jobs AS (
  SELECT j.*
  FROM public.jobs_ledger j
  WHERE j.status = 'billed'
    AND j.collections_at IS NULL
),
billed_inv AS (
  SELECT i.*, j.id AS jid,
         COUNT(*) OVER (PARTITION BY i.job_id) AS n_billed
  FROM public.jobs_ledger_invoices i
  JOIN billed_jobs j ON j.id = i.job_id
  WHERE i.status = 'billed'
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
  -- invoice rows (incl. the board's merged single-invoice rows)
  SELECT
    j.id AS job_id,
    COALESCE(NULLIF(trim(j.hcp_number), ''), j.click_number) AS display_number,
    j.job_name,
    j.job_address,
    j.customer_id,
    j.customer_name,
    j.customer_email,
    j.customer_phone,
    CASE WHEN i.n_billed = 1 THEN 'Billed line' ELSE 'Invoice #' || i.sequence_order END AS detail,
    COALESCE((i.billed_at AT TIME ZONE 'America/Chicago')::date, i.estimated_bill_date) AS ref_date,
    (i.billed_at IS NULL AND i.estimated_bill_date IS NOT NULL) AS ref_is_estimate,
    GREATEST(0, COALESCE(i.amount, 0) - COALESCE(a.applied, 0)) AS remaining,
    i.estimated_bill_date AS aging_ref_date
  FROM billed_inv i
  JOIN billed_jobs j ON j.id = i.job_id
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
  'Billed Awaiting Payment report payload for billed-report-email (v2.1315). Service-role only; mirrors the client board kernels (buildBilledStageRows row selection, printBilledRowReferenceDate dates, billedStageRowAgingBucket chips) — see the fidelity notes in migration 20260803100000.';

REVOKE EXECUTE ON FUNCTION public.get_billed_report_email_payload() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_billed_report_email_payload() FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_billed_report_email_payload() FROM authenticated;
GRANT EXECUTE ON FUNCTION public.get_billed_report_email_payload() TO service_role;

-- ── pg_cron: dispatch every 5 minutes (Vault PROJECT_URL + CRON_SECRET,
-- same pattern as 20260722260000_paid_job_email.sql). ──

SELECT cron.unschedule(jobid) FROM cron.job WHERE jobname = 'billed-report-email';

SELECT cron.schedule(
  'billed-report-email',
  '*/5 * * * *',
  $$
  SELECT net.http_post(
    url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'PROJECT_URL') || '/functions/v1/billed-report-email',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'X-Cron-Secret', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'CRON_SECRET')
    ),
    body := '{}'::jsonb
  ) AS request_id;
  $$
);

-- Training-mode write blocks (required for every CREATE TABLE — see CLAUDE.md).
SELECT public.apply_read_only_write_blocks();
SELECT public.apply_read_only_stmt_blocks();
