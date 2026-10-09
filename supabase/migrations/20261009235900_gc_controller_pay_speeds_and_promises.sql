SET lock_timeout = '3s';

-- GC mode, Owner Billing's O5e (v2.5029): the controller reads pay speeds and promises, and records a promise. The
-- controller is on the money team, but these three gates left it out, so a controller's Money and Bill the customer
-- read no customer's usual days to pay and no promise, and a controller's "They said when…" was refused. The
-- controller audit's form (20260927230000): each function is its live definition (pg_get_functiondef, read
-- 2026-10-09, the same as the repo's last) with 'controller' named beside the others, and nothing else changed.
-- CREATE OR REPLACE keeps each function's grants and owner. get_pay_speed_transactions, the Data health reader with
-- the same gate, stays as it is (the lead's call).

-- can_read_payment_promises(): list_job_payment_promises and list_payment_promise_records read through it.
CREATE OR REPLACE FUNCTION public.can_read_payment_promises()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT public.is_dev()
      OR public.is_assistant()
      OR EXISTS (
           SELECT 1 FROM public.users u
           WHERE u.id = (SELECT auth.uid()) AND u.role IN ('master_technician', 'controller', 'primary')
         );
$function$;

-- can_write_payment_promises(): add_job_payment_promise and void_job_payment_promise write through it.
CREATE OR REPLACE FUNCTION public.can_write_payment_promises()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT public.is_dev()
      OR public.is_assistant()
      OR EXISTS (
           SELECT 1 FROM public.users u
           WHERE u.id = (SELECT auth.uid()) AND u.role IN ('master_technician', 'controller')
         );
$function$;

-- get_billed_customer_pay_speeds(): each customer's median days to pay, Bill the customer's and Money's expected day.
CREATE OR REPLACE FUNCTION public.get_billed_customer_pay_speeds()
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
WITH gate AS (
  SELECT public.is_dev()
      OR public.is_assistant()
      OR EXISTS (
           SELECT 1 FROM public.users u
           WHERE u.id = (SELECT auth.uid())
             AND u.role IN ('master_technician', 'controller', 'primary')
         )
      AS ok
),
samples AS (
  SELECT * FROM public.pay_speed_samples()
),
quarantined AS (
  SELECT count(*)::int AS n
  FROM public.jobs_ledger_payments p
  JOIN public.jobs_ledger_invoices i ON i.id = p.invoice_id
  JOIN public.jobs_ledger j ON j.id = i.job_id
  WHERE p.invoice_id IS NOT NULL
    AND p.paid_on IS NOT NULL
    AND COALESCE((i.billed_at AT TIME ZONE 'America/Chicago')::date, i.estimated_bill_date) IS NOT NULL
    AND (j.customer_id IS NOT NULL OR j.gc_customer_id IS NOT NULL)
    AND p.paid_on >= (public.app_today() - INTERVAL '12 months')::date
    AND p.paid_on >= (SELECT COALESCE((SELECT NULLIF(value_text, '')::date FROM public.app_settings WHERE key = 'pay_speed_no_count_date_v1'), DATE '0001-01-01'))
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
        AND p.paid_on >= (public.app_today() - INTERVAL '12 months')::date
    AND p.paid_on >= (SELECT COALESCE((SELECT NULLIF(value_text, '')::date FROM public.app_settings WHERE key = 'pay_speed_no_count_date_v1'), DATE '0001-01-01'))) AS payments_12mo,
    (SELECT count(*)::int FROM samples) AS measurable,
    (SELECT count(*)::int FROM public.jobs_ledger_payments p
      WHERE p.invoice_id IS NULL
        AND p.paid_on IS NOT NULL
        AND p.paid_on >= (public.app_today() - INTERVAL '12 months')::date
    AND p.paid_on >= (SELECT COALESCE((SELECT NULLIF(value_text, '')::date FROM public.app_settings WHERE key = 'pay_speed_no_count_date_v1'), DATE '0001-01-01'))
        AND NOT EXISTS (SELECT 1 FROM public.pay_speed_exclusions x WHERE x.payment_id = p.id)) AS unlinked,
    (SELECT count(*)::int FROM public.jobs_ledger_invoices i
      WHERE i.status IN ('billed', 'paid')
        AND i.billed_at IS NULL
        AND i.estimated_bill_date IS NULL) AS undated_invoices,
    (SELECT n FROM quarantined) AS quarantined,
    (SELECT count(*)::int FROM public.jobs_ledger_payments p
      JOIN public.pay_speed_exclusions x ON x.payment_id = p.id
      WHERE p.paid_on IS NOT NULL
        AND p.paid_on >= (public.app_today() - INTERVAL '12 months')::date
    AND p.paid_on >= (SELECT COALESCE((SELECT NULLIF(value_text, '')::date FROM public.app_settings WHERE key = 'pay_speed_no_count_date_v1'), DATE '0001-01-01'))) AS excluded
),
per_customer AS (
  SELECT
    payer_id AS customer_id,
    round(percentile_cont(0.5) WITHIN GROUP (ORDER BY gap_days))::int AS median_days,
    count(*)::int AS n
  FROM samples
  WHERE payer_id IS NOT NULL
  GROUP BY payer_id
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
  JOIN public.customers c ON c.id = s.payer_id
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
    payer_id AS customer_id,
    job_id,
    job_name,
    job_address,
    billed_on,
    paid_on,
    gap_days,
    row_number() OVER (
      PARTITION BY payer_id
      ORDER BY paid_on DESC, billed_on DESC
    ) AS rn
  FROM samples
  WHERE payer_id IS NOT NULL
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
$function$;

-- Its comment named who it answers; it names the controller now.
COMMENT ON FUNCTION public.get_billed_customer_pay_speeds() IS
  'Per-payer median bill→paid gap (v12, v2.4362: keyed on whoever each bill went to — the GC on a GC-billed bill — via pay_speed_samples(); GC jobs with no customer count again) + company/segment medians + customer types + receipts + data-health quality counts. Rules unchanged from v11 (12 months; bill clock = COALESCE(billed_at, estimated_bill_date); HCP same-day pairs quarantined; billed-after-paid pairs never sampled). NULL outside dev/master/controller/assistant-like/primary (the controller since v2.5029).';
