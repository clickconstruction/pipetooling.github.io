SET lock_timeout = '3s';

-- Quickfill "Missing bill dates" station (v2.2326): get_undated_bill_worklist()
-- — the undated-bills backlog (billed/paid, no billed_at, no
-- estimated_bill_date) scoped by the dev-set No Count Date
-- (pay_speed_no_count_date_v1): a bill is in the worklist only while it still
-- affects the pay-speed math — it has a payment received on/after the floor,
-- or it has no payments yet and was created on/after it. No floor set → the
-- whole backlog. Each row carries the clues an assistant needs to deduce the
-- bill date (job identity, HCP number, payment dates); the client writes the
-- date straight to jobs_ledger_invoices.billed_at under existing RLS.

CREATE OR REPLACE FUNCTION public.get_undated_bill_worklist()
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
             AND u.role = 'master_technician'
         )
      AS ok
),
ncd AS (
  SELECT COALESCE(
           (SELECT NULLIF(value_text, '')::date FROM public.app_settings WHERE key = 'pay_speed_no_count_date_v1'),
           DATE '0001-01-01'
         ) AS floor_date
),
bills AS (
  SELECT
    i.id,
    i.amount,
    i.status,
    (i.created_at AT TIME ZONE 'America/Chicago')::date AS created_on,
    j.id AS job_id,
    j.job_name,
    j.job_address,
    j.customer_name,
    j.hcp_number,
    pay.payments,
    pay.latest_paid_on
  FROM public.jobs_ledger_invoices i
  JOIN public.jobs_ledger j ON j.id = i.job_id
  CROSS JOIN LATERAL (
    SELECT
      COALESCE(
        jsonb_agg(
          jsonb_build_object('paidYmd', to_char(p.paid_on, 'YYYY-MM-DD'), 'amount', p.amount)
          ORDER BY p.paid_on DESC
        ) FILTER (WHERE p.paid_on IS NOT NULL),
        '[]'::jsonb
      ) AS payments,
      MAX(p.paid_on) AS latest_paid_on
    FROM public.jobs_ledger_payments p
    WHERE p.invoice_id = i.id
  ) pay
  WHERE i.status IN ('billed', 'paid')
    AND i.billed_at IS NULL
    AND i.estimated_bill_date IS NULL
    AND (
      EXISTS (
        SELECT 1 FROM public.jobs_ledger_payments p2, ncd
        WHERE p2.invoice_id = i.id AND p2.paid_on >= ncd.floor_date
      )
      OR (
        pay.latest_paid_on IS NULL
        AND (i.created_at AT TIME ZONE 'America/Chicago')::date >= (SELECT floor_date FROM ncd)
      )
    )
)
SELECT CASE WHEN NOT (SELECT ok FROM gate) THEN NULL ELSE
  jsonb_build_object(
    'noCountDate',
    (SELECT CASE WHEN floor_date = DATE '0001-01-01' THEN NULL ELSE to_char(floor_date, 'YYYY-MM-DD') END FROM ncd),
    'bills',
    COALESCE(
      (SELECT jsonb_agg(
                jsonb_build_object(
                  'invoiceId', id,
                  'amount', amount,
                  'status', status,
                  'createdYmd', to_char(created_on, 'YYYY-MM-DD'),
                  'customerName', customer_name,
                  'jobId', job_id,
                  'jobName', job_name,
                  'address', job_address,
                  'hcpNumber', hcp_number,
                  'payments', payments
                )
                ORDER BY COALESCE(latest_paid_on, created_on) DESC, id
              )
         FROM bills),
      '[]'::jsonb
    )
  )
END
$$;

REVOKE ALL ON FUNCTION public.get_undated_bill_worklist() FROM anon;
COMMENT ON FUNCTION public.get_undated_bill_worklist() IS
'Undated billed/paid bills still relevant past the No Count Date, with the clues (job identity, HCP, payment dates) to deduce each bill date - the Quickfill Missing bill dates station. NULL outside dev/master/assistant-like.';
