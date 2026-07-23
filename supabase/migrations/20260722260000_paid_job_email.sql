-- "Customer paid" email notifications (v2.965): when a jobs_ledger row transitions
-- to status = 'paid' (any writer — update_job_status RPC, mark_invoice_paid,
-- mark_job_paid, the stripe-webhook's mark_invoice_paid_from_stripe,
-- apply_mercury_bank_payment_allocations — the trigger below is the single choke
-- point), enqueue a row that the paid-job-email edge function (pg_cron */15)
-- turns into detailed (dev/master) or sterilized (everyone else) emails.

-- ── Queue table ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.paid_job_email_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_ledger_id uuid NOT NULL REFERENCES public.jobs_ledger (id) ON DELETE CASCADE,
  queued_at timestamptz DEFAULT now(),
  sent_at timestamptz,
  error text,
  attempts int DEFAULT 0
);

COMMENT ON TABLE public.paid_job_email_queue IS
  'Jobs that just hit status=paid, awaiting the paid-job-email edge function (pg_cron dispatch). Trigger enqueue_paid_job_email() writes; service role stamps sent_at/error.';

CREATE INDEX IF NOT EXISTS idx_paid_job_email_queue_pending
  ON public.paid_job_email_queue (queued_at)
  WHERE sent_at IS NULL;

ALTER TABLE public.paid_job_email_queue ENABLE ROW LEVEL SECURITY;

-- Devs may inspect the queue; nobody writes from the client (the SECURITY
-- DEFINER trigger and the service-role edge function are the only writers).
DROP POLICY IF EXISTS "Devs read paid job email queue" ON public.paid_job_email_queue;
CREATE POLICY "Devs read paid job email queue" ON public.paid_job_email_queue
  FOR SELECT USING (public.is_dev());

-- ── Enqueue trigger ──────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.enqueue_paid_job_email()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.paid_job_email_queue (job_ledger_id) VALUES (NEW.id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enqueue_paid_job_email_au ON public.jobs_ledger;

CREATE TRIGGER enqueue_paid_job_email_au
AFTER UPDATE OF status ON public.jobs_ledger
FOR EACH ROW
WHEN (NEW.status = 'paid' AND OLD.status IS DISTINCT FROM NEW.status)
EXECUTE FUNCTION public.enqueue_paid_job_email();

-- ── Payload RPC (service_role only; the edge function role-gates callers) ────

CREATE OR REPLACE FUNCTION public.get_paid_job_email_payload(p_job_id uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
WITH job AS (
  SELECT
    j.id,
    j.hcp_number,
    COALESCE(NULLIF(trim(j.hcp_number), ''), j.click_number) AS display_number,
    j.job_name,
    j.job_address,
    j.customer_name,
    st.name AS service_type_name,
    COALESCE(j.revenue, 0) AS revenue,
    j.last_work_date
  FROM public.jobs_ledger j
  LEFT JOIN public.service_types st ON st.id = j.service_type_id
  WHERE j.id = p_job_id
),
-- Team labor: approved, non-revoked clock sessions; hours × people_pay_config
-- hourly_wage joined on lower(trim(person_name)) = lower(trim(users.name)) —
-- the app's established name join (docs/SALARY_CLOCK_SESSIONS.md).
team_labor AS (
  SELECT
    COALESCE(NULLIF(trim(u.name), ''), 'Unknown') AS person_name,
    SUM(EXTRACT(EPOCH FROM (cs.clocked_out_at - cs.clocked_in_at)) / 3600.0) AS hours,
    COALESCE(MAX(ppc.hourly_wage), 0) AS wage
  FROM public.clock_sessions cs
  JOIN public.users u ON u.id = cs.user_id
  LEFT JOIN public.people_pay_config ppc
    ON lower(trim(ppc.person_name)) = lower(trim(u.name))
  WHERE cs.job_ledger_id = p_job_id
    AND cs.approved_at IS NOT NULL
    AND cs.revoked_at IS NULL
    AND cs.clocked_out_at IS NOT NULL
  GROUP BY u.id, u.name
),
team_labor_rows AS (
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
           'name', person_name,
           'hours', round(hours::numeric, 2),
           'wage', wage,
           'cost', round((hours * COALESCE(wage, 0))::numeric, 2)
         ) ORDER BY hours DESC), '[]'::jsonb) AS people,
         COALESCE(SUM(round((hours * COALESCE(wage, 0))::numeric, 2)), 0) AS total
  FROM team_labor
),
-- Sub labor: Sub Labor books (people_labor_jobs) matched to the job's HCP #
-- (trimmed, case-insensitive — same as laborJobMatchesHcp / laborCostByHcp),
-- costing line items via people_labor_job_items (direct amount wins, else
-- hours × effective rate) plus drive cost (miles × drive_mileage_cost +
-- miles × drive_time_per_mile × book rate) — mirrors src/lib/jobs/subLaborCost.ts.
drive_settings AS (
  SELECT
    COALESCE((SELECT value_num FROM public.app_settings WHERE key = 'drive_mileage_cost'), 0.7) AS mileage_cost,
    COALESCE((SELECT value_num FROM public.app_settings WHERE key = 'drive_time_per_mile'), 0.02) AS time_per_mile
),
sub_labor_books AS (
  SELECT plj.id, COALESCE(plj.labor_rate, 0) AS job_rate, COALESCE(plj.distance_miles, 0) AS miles
  FROM public.people_labor_jobs plj
  JOIN job ON trim(COALESCE(job.hcp_number, '')) <> ''
    AND lower(trim(COALESCE(plj.job_number, ''))) = lower(trim(job.hcp_number))
),
sub_labor_lines AS (
  SELECT b.id AS book_id,
         COALESCE(SUM(
           COALESCE(
             i.direct_labor_amount,
             (CASE WHEN i.is_fixed THEN COALESCE(i.hrs_per_unit, 0)
                   ELSE COALESCE(i.count, 0) * COALESCE(i.hrs_per_unit, 0) END)
             * COALESCE(i.labor_rate, b.job_rate)
           )
         ), 0) AS line_total
  FROM sub_labor_books b
  LEFT JOIN public.people_labor_job_items i ON i.job_id = b.id
  GROUP BY b.id
),
sub_labor_total AS (
  SELECT COALESCE(SUM(
           l.line_total
           + CASE
               WHEN b.miles > 0 AND b.job_rate > 0
                 THEN b.miles * ds.mileage_cost + b.miles * ds.time_per_mile * b.job_rate
               WHEN b.miles > 0 THEN b.miles * ds.mileage_cost
               ELSE 0
             END
         ), 0) AS total
  FROM sub_labor_books b
  JOIN sub_labor_lines l ON l.book_id = b.id
  CROSS JOIN drive_settings ds
),
-- Parts: Mercury card-charge allocations only (mercury_transaction_job_allocations,
-- SUM of ABS(amount)) — the Job Summary tab's cardCharges figure. APPROXIMATION:
-- Job Summary's on-screen "Parts" also adds tally parts, supply-house invoice
-- allocations, and billed materials; this email mirrors the Mercury allocations
-- (the primary bank-truth source) only.
parts AS (
  SELECT COALESCE(SUM(ABS(a.amount)), 0) AS total
  FROM public.mercury_transaction_job_allocations a
  WHERE a.job_id = p_job_id
),
payments AS (
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
           'amount', p.amount,
           'payment_date', p.paid_on,
           'method', p.payment_type
         ) ORDER BY p.paid_on NULLS LAST, p.sequence_order), '[]'::jsonb) AS rows,
         COALESCE(SUM(p.amount), 0) AS total
  FROM public.jobs_ledger_payments p
  WHERE p.job_id = p_job_id
),
-- Monthly timeline: labor by clock-session month, parts by Mercury posted_at
-- month (allocation created_at when the transaction row is missing), payments
-- by paid_on month (created_at fallback).
labor_by_month AS (
  SELECT to_char(date_trunc('month', cs.clocked_in_at), 'YYYY-MM') AS month,
         SUM(EXTRACT(EPOCH FROM (cs.clocked_out_at - cs.clocked_in_at)) / 3600.0
             * COALESCE(ppc.hourly_wage, 0)) AS labor_cost
  FROM public.clock_sessions cs
  JOIN public.users u ON u.id = cs.user_id
  LEFT JOIN public.people_pay_config ppc
    ON lower(trim(ppc.person_name)) = lower(trim(u.name))
  WHERE cs.job_ledger_id = p_job_id
    AND cs.approved_at IS NOT NULL
    AND cs.revoked_at IS NULL
    AND cs.clocked_out_at IS NOT NULL
  GROUP BY 1
),
parts_by_month AS (
  SELECT to_char(date_trunc('month', COALESCE(mt.posted_at::timestamptz, a.created_at)), 'YYYY-MM') AS month,
         SUM(ABS(a.amount)) AS parts_cost
  FROM public.mercury_transaction_job_allocations a
  LEFT JOIN public.mercury_transactions mt ON mt.id = a.mercury_transaction_id
  WHERE a.job_id = p_job_id
  GROUP BY 1
),
payments_by_month AS (
  SELECT to_char(date_trunc('month', COALESCE(p.paid_on::timestamptz, p.created_at)), 'YYYY-MM') AS month,
         SUM(p.amount) AS payments
  FROM public.jobs_ledger_payments p
  WHERE p.job_id = p_job_id
  GROUP BY 1
),
timeline AS (
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
           'month', m.month,
           'labor_cost', round(COALESCE(l.labor_cost, 0)::numeric, 2),
           'parts_cost', round(COALESCE(pc.parts_cost, 0)::numeric, 2),
           'payments', round(COALESCE(pm.payments, 0)::numeric, 2)
         ) ORDER BY m.month), '[]'::jsonb) AS rows
  FROM (
    SELECT month FROM labor_by_month
    UNION SELECT month FROM parts_by_month
    UNION SELECT month FROM payments_by_month
  ) m
  LEFT JOIN labor_by_month l ON l.month = m.month
  LEFT JOIN parts_by_month pc ON pc.month = m.month
  LEFT JOIN payments_by_month pm ON pm.month = m.month
),
job_start AS (
  SELECT MIN(cs.clocked_in_at) AS started_at
  FROM public.clock_sessions cs
  WHERE cs.job_ledger_id = p_job_id
    AND cs.approved_at IS NOT NULL
    AND cs.revoked_at IS NULL
)
SELECT jsonb_build_object(
  'job', jsonb_build_object(
    'id', job.id,
    'display_number', job.display_number,
    'job_name', job.job_name,
    'job_address', job.job_address,
    'customer_name', job.customer_name,
    'service_type_name', job.service_type_name
  ),
  'money', jsonb_build_object(
    'revenue', job.revenue,
    'payments', payments.rows,
    'payments_total', payments.total
  ),
  'costs', jsonb_build_object(
    'team_labor', jsonb_build_object(
      'total', team_labor_rows.total,
      'people', team_labor_rows.people
    ),
    'sub_labor_total', round(sub_labor_total.total::numeric, 2),
    'parts_total', parts.total
  ),
  'profit', round((job.revenue - (team_labor_rows.total + sub_labor_total.total + parts.total))::numeric, 2),
  'timeline', timeline.rows,
  'dates', jsonb_build_object(
    'job_start', job_start.started_at,
    'last_work', job.last_work_date,
    'paid_at', now()
  )
)
FROM job, team_labor_rows, sub_labor_total, parts, payments, timeline, job_start;
$$;

REVOKE EXECUTE ON FUNCTION public.get_paid_job_email_payload(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_paid_job_email_payload(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_paid_job_email_payload(uuid) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.get_paid_job_email_payload(uuid) TO service_role;

-- ── pg_cron: dispatch every 15 minutes (same Vault pattern as
-- 20260430054614_recurring_job_report_schedules.sql: PROJECT_URL + CRON_SECRET). ──

SELECT cron.unschedule(jobid) FROM cron.job WHERE jobname = 'paid-job-email';

SELECT cron.schedule(
  'paid-job-email',
  '*/15 * * * *',
  $$
  SELECT net.http_post(
    url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'PROJECT_URL') || '/functions/v1/paid-job-email',
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
