SET lock_timeout = '3s';

-- Pay-speed exclusions + the data-health drill-down (v2.2290).
--
-- 1) pay_speed_exclusions — owner-curated per-payment opt-outs of the
--    pay-speed math. Auditable (who / when / optional why); including a
--    payment back is a DELETE. Devs + master techs write; the pay-speeds
--    gate roles read.
-- 2) get_billed_customer_pay_speeds v8 (v7 was 20260825160000): samples,
--    quarantine and the unlinked count skip excluded payments; quality
--    gains `excluded`.
-- 3) get_pay_speed_transactions() — every 12-month payment with its job and
--    status bucket (measurable / unlinked / quarantined / excluded) plus the
--    all-time undated-bills backlog: the list behind the Data health strip.

CREATE TABLE IF NOT EXISTS public.pay_speed_exclusions (
  payment_id uuid PRIMARY KEY REFERENCES public.jobs_ledger_payments(id) ON DELETE CASCADE,
  excluded_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  excluded_by_name text NOT NULL DEFAULT '',
  excluded_at timestamptz NOT NULL DEFAULT now(),
  reason text
);

ALTER TABLE public.pay_speed_exclusions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Pay speed viewers read exclusions" ON public.pay_speed_exclusions;
CREATE POLICY "Pay speed viewers read exclusions" ON public.pay_speed_exclusions
  FOR SELECT USING (
    public.is_dev() OR public.is_assistant()
    OR EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = (SELECT auth.uid()) AND u.role IN ('master_technician', 'primary')
    )
  );

DROP POLICY IF EXISTS "Devs and masters exclude payments" ON public.pay_speed_exclusions;
CREATE POLICY "Devs and masters exclude payments" ON public.pay_speed_exclusions
  FOR INSERT WITH CHECK (
    public.is_dev() OR EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = (SELECT auth.uid()) AND u.role = 'master_technician'
    )
  );

DROP POLICY IF EXISTS "Devs and masters include payments back" ON public.pay_speed_exclusions;
CREATE POLICY "Devs and masters include payments back" ON public.pay_speed_exclusions
  FOR DELETE USING (
    public.is_dev() OR EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = (SELECT auth.uid()) AND u.role = 'master_technician'
    )
  );

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
    j.id AS job_id,
    j.job_name,
    j.job_address,
    COALESCE(
      (i.billed_at AT TIME ZONE 'America/Chicago')::date,
      i.estimated_bill_date
    ) AS billed_on,
    p.paid_on,
    GREATEST(
      0,
      p.paid_on - COALESCE(
        (i.billed_at AT TIME ZONE 'America/Chicago')::date,
        i.estimated_bill_date
      )
    ) AS gap_days
  FROM public.jobs_ledger_payments p
  JOIN public.jobs_ledger_invoices i ON i.id = p.invoice_id
  JOIN public.jobs_ledger j ON j.id = i.job_id
  WHERE p.invoice_id IS NOT NULL
    AND p.paid_on IS NOT NULL
    AND COALESCE((i.billed_at AT TIME ZONE 'America/Chicago')::date, i.estimated_bill_date) IS NOT NULL
    AND j.customer_id IS NOT NULL
    AND p.paid_on >= (CURRENT_DATE - INTERVAL '12 months')::date
    AND NOT EXISTS (SELECT 1 FROM public.pay_speed_exclusions x WHERE x.payment_id = p.id)
    AND NOT (
      p.paid_on <= COALESCE((i.billed_at AT TIME ZONE 'America/Chicago')::date, i.estimated_bill_date)
      AND p.payment_type ILIKE 'hcp%'
      AND COALESCE(p.note, '') NOT LIKE '%hcp-paydate-corrected%'
      AND COALESCE(p.note, '') NOT LIKE '%hcp-payments-split%'
    )
),
quarantined AS (
  SELECT count(*)::int AS n
  FROM public.jobs_ledger_payments p
  JOIN public.jobs_ledger_invoices i ON i.id = p.invoice_id
  JOIN public.jobs_ledger j ON j.id = i.job_id
  WHERE p.invoice_id IS NOT NULL
    AND p.paid_on IS NOT NULL
    AND COALESCE((i.billed_at AT TIME ZONE 'America/Chicago')::date, i.estimated_bill_date) IS NOT NULL
    AND j.customer_id IS NOT NULL
    AND p.paid_on >= (CURRENT_DATE - INTERVAL '12 months')::date
    AND NOT EXISTS (SELECT 1 FROM public.pay_speed_exclusions x WHERE x.payment_id = p.id)
    AND (
      p.paid_on <= COALESCE((i.billed_at AT TIME ZONE 'America/Chicago')::date, i.estimated_bill_date)
      AND p.payment_type ILIKE 'hcp%'
      AND COALESCE(p.note, '') NOT LIKE '%hcp-paydate-corrected%'
      AND COALESCE(p.note, '') NOT LIKE '%hcp-payments-split%'
    )
),
quality AS (
  SELECT
    (SELECT count(*)::int FROM public.jobs_ledger_payments p
      WHERE p.paid_on IS NOT NULL
        AND p.paid_on >= (CURRENT_DATE - INTERVAL '12 months')::date) AS payments_12mo,
    (SELECT count(*)::int FROM samples) AS measurable,
    (SELECT count(*)::int FROM public.jobs_ledger_payments p
      WHERE p.invoice_id IS NULL
        AND p.paid_on IS NOT NULL
        AND p.paid_on >= (CURRENT_DATE - INTERVAL '12 months')::date
        AND NOT EXISTS (SELECT 1 FROM public.pay_speed_exclusions x WHERE x.payment_id = p.id)) AS unlinked,
    (SELECT count(*)::int FROM public.jobs_ledger_invoices i
      WHERE i.status IN ('billed', 'paid')
        AND i.billed_at IS NULL
        AND i.estimated_bill_date IS NULL) AS undated_invoices,
    (SELECT n FROM quarantined) AS quarantined,
    (SELECT count(*)::int FROM public.jobs_ledger_payments p
      JOIN public.pay_speed_exclusions x ON x.payment_id = p.id
      WHERE p.paid_on IS NOT NULL
        AND p.paid_on >= (CURRENT_DATE - INTERVAL '12 months')::date) AS excluded
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
    job_id,
    job_name,
    job_address,
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
        'gapDays', gap_days,
        'jobId', job_id,
        'jobName', job_name,
        'address', job_address
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
    ),
    'quality',
    (SELECT jsonb_build_object(
       'payments12mo', payments_12mo,
       'measurable', measurable,
       'unlinked', unlinked,
       'undatedInvoices', undated_invoices,
       'quarantined', quarantined,
       'excluded', excluded
     ) FROM quality)
  )
END;
$$;

COMMENT ON FUNCTION public.get_billed_customer_pay_speeds() IS
  'Per-customer median bill→paid gap (12 months; bill clock = COALESCE(billed_at, estimated_bill_date); unverified HCP-import same-day pairs quarantined) + company/segment medians + customer types + receipts (with jobId/jobName/address) + data-health quality counts (incl. owner exclusions). NULL outside dev/master/assistant-like/primary.';

REVOKE EXECUTE ON FUNCTION public.get_billed_customer_pay_speeds() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_billed_customer_pay_speeds() FROM anon;
GRANT EXECUTE ON FUNCTION public.get_billed_customer_pay_speeds() TO authenticated;


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
)
SELECT CASE WHEN NOT (SELECT ok FROM gate) THEN NULL ELSE
  jsonb_build_object(
    'payments',
    COALESCE(
      (SELECT jsonb_agg(
                jsonb_build_object(
                  'paymentId', id,
                  'paidYmd', to_char(paid_on, 'YYYY-MM-DD'),
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

SELECT public.apply_read_only_write_blocks();
SELECT public.apply_read_only_stmt_blocks();
