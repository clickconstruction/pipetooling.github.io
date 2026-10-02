SET lock_timeout = '3s';

-- v2.4362 — Pay speed counts each payment for whoever the bill went to.
--
-- Until now every pay-speed reader sampled payments per `jobs_ledger.customer_id`:
-- a bill the GC pays taught the homeowner's pace, and a job with no customer (every
-- GC job since the v2.3404 sweep, 20260914160000) taught nobody, not even the company
-- median. Three copies of the sampling SQL had also drifted: the payment-forecast email
-- still ran the August 21 rules (no est-date clock, no quarantine, no exclusions, no
-- billed-after-paid guard, no No Count Date).
--
-- 1. `invoice_bill_payer_customer_id` — who pays one bill: a typed bill_to_email is
--    someone else (null); else the invoice's own pick, else the job's rule, through
--    `job_bill_payer_customer_id` (v2.3374/v2.3404). Mirrors `effectiveInvoiceParty`
--    + `payerCustomerId` in src/lib/jobs/billToParty.ts.
-- 2. `pay_speed_samples()` — the one sampler (the v11 rules of 20260826150000), each
--    row carrying its payer. Not callable by app roles; the gated readers call it.
-- 3. The four readers use it, same JSON shapes: `get_billed_customer_pay_speeds` (v12),
--    `get_pay_speed_transactions` (v6: the payer's name, and a GC job's payment is no
--    longer "unlinked"), `get_money_waiting_email_payload` and
--    `get_payment_forecast_email_payload` (rows gain `payer_id` / `payer_name`).

-- ---------------------------------------------------------------------------
-- 1. Who pays one bill
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.invoice_bill_payer_customer_id(
  p_invoice_bill_to_party text,
  p_invoice_bill_to_email text,
  p_job_bill_to_party text,
  p_customer_id uuid,
  p_gc_customer_id uuid
)
RETURNS uuid
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
AS $$
  SELECT CASE
    WHEN NULLIF(btrim(COALESCE(p_invoice_bill_to_email, '')), '') IS NOT NULL THEN NULL
    ELSE public.job_bill_payer_customer_id(
      CASE WHEN p_invoice_bill_to_party IN ('gc', 'customer') THEN p_invoice_bill_to_party ELSE p_job_bill_to_party END,
      p_customer_id,
      p_gc_customer_id
    )
  END
$$;
COMMENT ON FUNCTION public.invoice_bill_payer_customer_id(text, text, text, uuid, uuid) IS
  'Who pays one bill (v2.4362): NULL for a typed bill_to_email (someone else); else the invoice''s own gc/customer pick, else the job''s bill_to_party, resolved by job_bill_payer_customer_id. Mirrors effectiveInvoiceParty + payerCustomerId (src/lib/jobs/billToParty.ts).';

-- ---------------------------------------------------------------------------
-- 2. The one sampler
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.pay_speed_samples()
RETURNS TABLE (
  payment_id uuid,
  payer_id uuid,
  job_id uuid,
  job_name text,
  job_address text,
  billed_on date,
  paid_on date,
  gap_days integer
)
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT
    p.id,
    public.invoice_bill_payer_customer_id(i.bill_to_party, i.bill_to_email, j.bill_to_party, j.customer_id, j.gc_customer_id),
    j.id,
    j.job_name,
    j.job_address,
    b.billed_on,
    p.paid_on,
    GREATEST(0, p.paid_on - b.billed_on)::int
  FROM public.jobs_ledger_payments p
  JOIN public.jobs_ledger_invoices i ON i.id = p.invoice_id
  JOIN public.jobs_ledger j ON j.id = i.job_id
  CROSS JOIN LATERAL (
    SELECT COALESCE((i.billed_at AT TIME ZONE 'America/Chicago')::date, i.estimated_bill_date) AS billed_on
  ) b
  WHERE p.invoice_id IS NOT NULL
    AND p.paid_on IS NOT NULL
    AND b.billed_on IS NOT NULL
    -- The v11 guard: a payment before its bill's date is not a measurable pair.
    AND p.paid_on >= b.billed_on
    -- A job with a customer or a GC: someone was billed (was `customer_id IS NOT NULL`, which dropped GC jobs).
    AND (j.customer_id IS NOT NULL OR j.gc_customer_id IS NOT NULL)
    AND p.paid_on >= (public.app_today() - INTERVAL '12 months')::date
    AND p.paid_on >= (SELECT COALESCE((SELECT NULLIF(value_text, '')::date FROM public.app_settings WHERE key = 'pay_speed_no_count_date_v1'), DATE '0001-01-01'))
    AND NOT EXISTS (SELECT 1 FROM public.pay_speed_exclusions x WHERE x.payment_id = p.id)
    -- The HCP same-day quarantine. COALESCE (v2.4362): a blank payment_type made the
    -- whole test NULL, so NOT (...) dropped every same-day payment with no type (Stripe
    -- card payments, 15 on 2026-10-01) that the Data health list counts as measurable.
    AND NOT (
      p.paid_on <= b.billed_on
      AND COALESCE(p.payment_type, '') ILIKE 'hcp%'
      AND COALESCE(p.note, '') NOT LIKE '%hcp-paydate-corrected%'
      AND COALESCE(p.note, '') NOT LIKE '%hcp-payments-split%'
    )
$$;
COMMENT ON FUNCTION public.pay_speed_samples() IS
  'The one pay-speed sampler (v2.4362): every measurable 12-month bill→paid pair with its payer (invoice_bill_payer_customer_id; NULL = billed to someone else, which counts toward the company median only). Rules = get_billed_customer_pay_speeds v11 (est-date clock, billed-after-paid guard, HCP same-day quarantine, owner exclusions, No Count Date), plus a same-day payment with no payment_type now counts (the v11 quarantine test went NULL and dropped it). Read by the four pay-speed readers; not callable by app roles.';
REVOKE EXECUTE ON FUNCTION public.pay_speed_samples() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.pay_speed_samples() FROM anon;
REVOKE EXECUTE ON FUNCTION public.pay_speed_samples() FROM authenticated;

-- ---------------------------------------------------------------------------
-- 3a. get_billed_customer_pay_speeds v12 (from v11, 20260826150000)
-- ---------------------------------------------------------------------------
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
$$;
COMMENT ON FUNCTION public.get_billed_customer_pay_speeds() IS
  'Per-payer median bill→paid gap (v12, v2.4362: keyed on whoever each bill went to — the GC on a GC-billed bill — via pay_speed_samples(); GC jobs with no customer count again) + company/segment medians + customer types + receipts + data-health quality counts. Rules unchanged from v11 (12 months; bill clock = COALESCE(billed_at, estimated_bill_date); HCP same-day pairs quarantined; billed-after-paid pairs never sampled). NULL outside dev/master/assistant-like/primary.';
REVOKE EXECUTE ON FUNCTION public.get_billed_customer_pay_speeds() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_billed_customer_pay_speeds() FROM anon;
GRANT EXECUTE ON FUNCTION public.get_billed_customer_pay_speeds() TO authenticated;

-- ---------------------------------------------------------------------------
-- 3b. get_pay_speed_transactions v6 (from v5, 20260826150000)
-- ---------------------------------------------------------------------------
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
    -- v6: the name of whoever the bill went to (the GC on a GC-billed bill), else the job's customer.
    COALESCE(NULLIF(trim(pc.name), ''), j.customer_name) AS customer_name,
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
      -- v5 guard: a payment before its bill's date is never measurable.
      AND p.paid_on >= COALESCE((i.billed_at AT TIME ZONE 'America/Chicago')::date, i.estimated_bill_date)
      -- v6: a GC job with no customer is measurable too (pay_speed_samples' rule).
      AND (j.customer_id IS NOT NULL OR j.gc_customer_id IS NOT NULL)
    ) AS is_linked_dated
  FROM public.jobs_ledger_payments p
  JOIN public.jobs_ledger j ON j.id = p.job_id
  LEFT JOIN public.jobs_ledger_invoices i ON i.id = p.invoice_id
  LEFT JOIN public.pay_speed_exclusions x ON x.payment_id = p.id
  LEFT JOIN public.customers pc ON pc.id = CASE
    WHEN i.id IS NOT NULL THEN public.invoice_bill_payer_customer_id(i.bill_to_party, i.bill_to_email, j.bill_to_party, j.customer_id, j.gc_customer_id)
    ELSE public.job_bill_payer_customer_id(j.bill_to_party, j.customer_id, j.gc_customer_id)
  END
  WHERE p.paid_on IS NOT NULL
    AND p.paid_on >= (public.app_today() - INTERVAL '12 months')::date
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
                  'invoiceId', invoice_id,
                  'billedYmd', CASE WHEN billed_on IS NULL THEN NULL ELSE to_char(billed_on, 'YYYY-MM-DD') END,
                  'gapDays', CASE WHEN billed_on IS NULL OR paid_on < billed_on THEN NULL ELSE GREATEST(0, paid_on - billed_on) END,
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
'Every 12-month payment with job identity, invoiceId + status bucket (measurable/unlinked/quarantined/excluded; billed-after-paid buckets as unlinked - v5 guard) and the all-time undated-bills backlog - the Data health drill-down. v6 (v2.4362): customerName is whoever the bill went to; a GC job''s payment is measurable. NULL outside dev/master/assistant-like/primary.';

-- ---------------------------------------------------------------------------
-- 3c. get_money_waiting_email_payload (from 20260901120000)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_money_waiting_email_payload()
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
  SELECT i.*
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
forecast_rows AS (
  SELECT
    i.id AS invoice_id,
    j.id AS job_id,
    COALESCE(NULLIF(trim(j.hcp_number), ''), j.click_number) AS display_number,
    j.job_name,
    j.job_address,
    j.customer_id,
    j.customer_name,
    pr.payer_id,
    COALESCE(NULLIF(trim(pc.name), ''), j.customer_name) AS payer_name,
    i.billed_at,
    i.estimated_bill_date AS est_bill_ymd,
    GREATEST(0, COALESCE(i.amount, 0) - COALESCE(a.applied, 0)) AS remaining
  FROM billed_inv i
  JOIN billed_jobs j ON j.id = i.job_id
  LEFT JOIN inv_applied a ON a.invoice_id = i.id
  CROSS JOIN LATERAL (
    SELECT public.invoice_bill_payer_customer_id(i.bill_to_party, i.bill_to_email, j.bill_to_party, j.customer_id, j.gc_customer_id) AS payer_id
  ) pr
  LEFT JOIN public.customers pc ON pc.id = pr.payer_id
),
samples AS (
  SELECT * FROM public.pay_speed_samples()
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
)
SELECT jsonb_build_object(
  'generated_at', now(),
  'today', to_char((now() AT TIME ZONE 'America/Chicago')::date, 'YYYY-MM-DD'),
  'rows', COALESCE((SELECT jsonb_agg(jsonb_build_object(
    'invoice_id', r.invoice_id,
    'job_id', r.job_id,
    'display_number', r.display_number,
    'job_name', r.job_name,
    'job_address', r.job_address,
    'customer_id', r.customer_id,
    'customer_name', r.customer_name,
    'payer_id', r.payer_id,
    'payer_name', r.payer_name,
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
  )
);
$$;
COMMENT ON FUNCTION public.get_money_waiting_email_payload() IS
  'Money waiting email payload for money-waiting-email-dispatch (v2.2565; v2.4362: rows carry payer_id / payer_name — whoever each bill went to — and the medians come from pay_speed_samples(), keyed on the payer). Service-role only; the grouping happens in the dispatcher via the moneyWaiting kernel port.';
REVOKE EXECUTE ON FUNCTION public.get_money_waiting_email_payload() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_money_waiting_email_payload() FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_money_waiting_email_payload() FROM authenticated;
GRANT EXECUTE ON FUNCTION public.get_money_waiting_email_payload() TO service_role;

-- ---------------------------------------------------------------------------
-- 3d. get_payment_forecast_email_payload (from 20260824140029)
-- ---------------------------------------------------------------------------
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
    pr.payer_id,
    COALESCE(NULLIF(trim(pc.name), ''), j.customer_name) AS payer_name,
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
  CROSS JOIN LATERAL (
    SELECT public.invoice_bill_payer_customer_id(i.bill_to_party, i.bill_to_email, j.bill_to_party, j.customer_id, j.gc_customer_id) AS payer_id
  ) pr
  LEFT JOIN public.customers pc ON pc.id = pr.payer_id
  WHERE i.status = 'billed'
    -- The board's collections exclusion, verbatim (jobInCollections).
    AND NOT (j.status = 'billed' AND j.collections_at IS NOT NULL)
),
-- v2.4362: the one sampler (was a copy of get_billed_customer_pay_speeds v2, August 21's rules).
samples AS (
  SELECT * FROM public.pay_speed_samples()
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
    'payer_id', r.payer_id,
    'payer_name', r.payer_name,
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
  'Payment forecast email payload for payment-forecast-email-dispatch (v2.2227, scope-fixed; v2.4362: rows carry payer_id / payer_name and the medians come from pay_speed_samples(), keyed on the payer, on the app''s current rules). Service-role only. Rows = every billed invoice line on any non-collections job (the BOARD''s rule) + pay-speed medians + promised dates; bucketing runs in the dispatcher kernel port.';
REVOKE EXECUTE ON FUNCTION public.get_payment_forecast_email_payload() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_payment_forecast_email_payload() FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_payment_forecast_email_payload() FROM authenticated;
GRANT EXECUTE ON FUNCTION public.get_payment_forecast_email_payload() TO service_role;
