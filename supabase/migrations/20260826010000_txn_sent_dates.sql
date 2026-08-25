SET lock_timeout = '3s';

-- Data health rows tell their whole story (v2.2309):
-- 1) get_pay_speed_transactions v3 (v2 was 20260826000000): each payment row
--    also carries `sentYmd` (jobs_ledger_payments.sent_on) so the drill-down
--    shows sent → paid per row.
-- 2) get_payment_line_items(p_payment_id) — the line items behind one
--    payment: its bill's jobs_ledger_fixtures when linked, the job's line
--    items as context when not. Lazy-loaded on row expand.

CREATE OR REPLACE FUNCTION public.get_pay_speed_transactions()
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
pmts AS (
  SELECT
    p.id,
    p.paid_on,
    p.sent_on,
    p.amount,
    p.payment_type,
    p.invoice_id,
    j.id AS job_id,
    j.job_name,
    j.job_address,
    j.customer_name,
    COALESCE(
      (i.billed_at AT TIME ZONE 'America/Chicago')::date,
      i.estimated_bill_date
    ) AS billed_on,
    (x.payment_id IS NOT NULL) AS is_excluded,
    (
      p.invoice_id IS NOT NULL
      AND p.paid_on <= COALESCE((i.billed_at AT TIME ZONE 'America/Chicago')::date, i.estimated_bill_date)
      AND p.payment_type ILIKE 'hcp%'
      AND COALESCE(p.note, '') NOT LIKE '%hcp-paydate-corrected%'
      AND COALESCE(p.note, '') NOT LIKE '%hcp-payments-split%'
    ) AS is_quarantined,
    (
      p.invoice_id IS NOT NULL
      AND COALESCE((i.billed_at AT TIME ZONE 'America/Chicago')::date, i.estimated_bill_date) IS NOT NULL
      AND j.customer_id IS NOT NULL
    ) AS is_linked_dated
  FROM public.jobs_ledger_payments p
  JOIN public.jobs_ledger j ON j.id = p.job_id
  LEFT JOIN public.jobs_ledger_invoices i ON i.id = p.invoice_id
  LEFT JOIN public.pay_speed_exclusions x ON x.payment_id = p.id
  WHERE p.paid_on IS NOT NULL
    AND p.paid_on >= (CURRENT_DATE - INTERVAL '12 months')::date
    AND p.paid_on >= (SELECT COALESCE((SELECT NULLIF(value_text, '')::date FROM public.app_settings WHERE key = 'pay_speed_no_count_date_v1'), DATE '0001-01-01'))
)
SELECT CASE WHEN NOT (SELECT ok FROM gate) THEN NULL ELSE
  jsonb_build_object(
    'payments',
    COALESCE(
      (SELECT jsonb_agg(
                jsonb_build_object(
                  'paymentId', id,
                  'paidYmd', to_char(paid_on, 'YYYY-MM-DD'),
                  'sentYmd', CASE WHEN sent_on IS NULL THEN NULL ELSE to_char(sent_on, 'YYYY-MM-DD') END,
                  'amount', amount,
                  'paymentType', payment_type,
                  'customerName', customer_name,
                  'jobId', job_id,
                  'jobName', job_name,
                  'address', job_address,
                  'billedYmd', CASE WHEN billed_on IS NULL THEN NULL ELSE to_char(billed_on, 'YYYY-MM-DD') END,
                  'gapDays', CASE WHEN billed_on IS NULL THEN NULL ELSE GREATEST(0, paid_on - billed_on) END,
                  'status', CASE
                    WHEN is_excluded THEN 'excluded'
                    WHEN invoice_id IS NULL THEN 'unlinked'
                    WHEN is_quarantined THEN 'quarantined'
                    WHEN is_linked_dated THEN 'measurable'
                    ELSE 'unlinked'
                  END
                )
                ORDER BY paid_on DESC, id
              )
         FROM pmts),
      '[]'::jsonb
    ),
    'noCountDate',
    (SELECT CASE WHEN v = DATE '0001-01-01' THEN NULL ELSE to_char(v, 'YYYY-MM-DD') END
       FROM (SELECT (SELECT COALESCE((SELECT NULLIF(value_text, '')::date FROM public.app_settings WHERE key = 'pay_speed_no_count_date_v1'), DATE '0001-01-01')) AS v) s),
    'undatedInvoices',
    COALESCE(
      (SELECT jsonb_agg(
                jsonb_build_object(
                  'invoiceId', i.id,
                  'amount', i.amount,
                  'status', i.status,
                  'customerName', j.customer_name,
                  'jobId', j.id,
                  'jobName', j.job_name,
                  'address', j.job_address
                )
                ORDER BY i.created_at DESC NULLS LAST, i.id
              )
         FROM public.jobs_ledger_invoices i
         JOIN public.jobs_ledger j ON j.id = i.job_id
        WHERE i.status IN ('billed', 'paid')
          AND i.billed_at IS NULL
          AND i.estimated_bill_date IS NULL),
      '[]'::jsonb
    )
  )
END
$$;

REVOKE ALL ON FUNCTION public.get_pay_speed_transactions() FROM anon;
COMMENT ON FUNCTION public.get_pay_speed_transactions() IS
'Every 12-month payment with job identity + status bucket (measurable/unlinked/quarantined/excluded) and the all-time undated-bills backlog - the Data health drill-down. NULL outside dev/master/assistant-like/primary.';


CREATE OR REPLACE FUNCTION public.get_payment_line_items(p_payment_id uuid)
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
pmt AS (
  SELECT p.id, p.invoice_id, p.job_id, i.amount AS bill_amount
  FROM public.jobs_ledger_payments p
  LEFT JOIN public.jobs_ledger_invoices i ON i.id = p.invoice_id
  WHERE p.id = p_payment_id
),
items AS (
  SELECT f.name, f.count, f.line_unit_price, f.line_description, f.sequence_order
  FROM public.jobs_ledger_fixtures f, pmt
  WHERE (pmt.invoice_id IS NOT NULL AND f.invoice_id = pmt.invoice_id)
     OR (pmt.invoice_id IS NULL AND f.job_id = pmt.job_id)
)
SELECT CASE WHEN NOT (SELECT ok FROM gate) OR NOT EXISTS (SELECT 1 FROM pmt) THEN NULL ELSE
  jsonb_build_object(
    'linked', (SELECT invoice_id IS NOT NULL FROM pmt),
    'billAmount', (SELECT bill_amount FROM pmt),
    'items',
    COALESCE(
      (SELECT jsonb_agg(
                jsonb_build_object(
                  'name', name,
                  'count', count,
                  'unitPrice', line_unit_price,
                  'description', line_description,
                  'amount', CASE WHEN line_unit_price IS NULL THEN NULL ELSE round((count * line_unit_price)::numeric, 2) END
                )
                ORDER BY sequence_order, name
              )
         FROM items),
      '[]'::jsonb
    )
  )
END
$$;

REVOKE ALL ON FUNCTION public.get_payment_line_items(uuid) FROM anon;
COMMENT ON FUNCTION public.get_payment_line_items(uuid) IS
'Line items behind one payment for the Data health drill-down: the bill''s fixtures when linked, the job''s as context when not. NULL outside dev/master/assistant-like/primary or for unknown payments.';
