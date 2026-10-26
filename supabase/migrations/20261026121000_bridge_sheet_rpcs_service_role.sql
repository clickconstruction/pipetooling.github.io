-- v2.5883 (the Bridge's weekly send, bridge-weekly-sheet): the five RPCs the Monday sheet reads let the SERVICE ROLE
-- through their role gate, so the function builds on Monday morning the same sheet the page builds for a dev:
-- get_billed_customer_pay_speeds (each payer's pace), list_job_promised_pay_dates (the promises), list_payment_chase_touches
-- (the Collect desk's last touches), list_tally_parts_with_po (the office parts in the overhead pool) and
-- count_unattributed_noncard_mercury_transactions (the hygiene count). The shape of 20260924030000_lien_rpcs_service_role.sql:
-- bodies verbatim from their newest definitions (20261009235900, 20260911052931, 20260822000000, 20260927233000,
-- 20260802220000); only the gate gains `OR auth.role() = 'service_role'` (the count's not-authenticated check steps aside
-- for it too), and the GRANT names service_role. CREATE OR REPLACE: same signatures, same returns, no drop window. The
-- service role already reads every table these functions read, so nothing new is reachable; a signed-in caller's answer
-- is unchanged. count_unlinked_mercury_transactions_for_tally stays as it is: it counts the caller's own debit cards, which
-- the service role has none of, and the sheet reads a refusal there as "not read", as the page does for a role it refuses.
SET lock_timeout = '3s';

-- ---------- 1 · get_billed_customer_pay_speeds ----------

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
      OR auth.role() = 'service_role'
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

REVOKE EXECUTE ON FUNCTION public.get_billed_customer_pay_speeds() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_billed_customer_pay_speeds() TO authenticated, service_role;

-- ---------- 2 · list_job_promised_pay_dates ----------

CREATE OR REPLACE FUNCTION public.list_job_promised_pay_dates()
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
      OR auth.role() = 'service_role'
      AS ok
)
SELECT CASE WHEN NOT (SELECT ok FROM gate) THEN NULL ELSE
  COALESCE(
    (SELECT jsonb_object_agg(
              p.job_id::text,
              jsonb_build_object(
                'promisedYmd', to_char(p.promised_date, 'YYYY-MM-DD'),
                'markedByName', CASE
                  WHEN p.marked_by IS NULL AND ev.source = 'customer' THEN 'customer'
                  ELSE COALESCE(NULLIF(trim(u.name), ''), 'office')
                END,
                'source', CASE WHEN p.marked_by IS NULL AND ev.source = 'customer' THEN 'customer' ELSE 'office' END,
                'markedAt', p.marked_at
              ))
       FROM public.job_promised_pay_dates p
       LEFT JOIN public.users u ON u.id = p.marked_by
       LEFT JOIN LATERAL (
         SELECT e.source
         FROM public.job_payment_promises e
         WHERE e.job_id = p.job_id AND e.promised_date = p.promised_date AND e.voided_at IS NULL
         ORDER BY e.created_at DESC
         LIMIT 1
       ) ev ON true),
    '{}'::jsonb
  )
END;
$$;

REVOKE EXECUTE ON FUNCTION public.list_job_promised_pay_dates() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_job_promised_pay_dates() TO authenticated, service_role;

-- ---------- 3 · list_payment_chase_touches ----------

CREATE OR REPLACE FUNCTION public.list_payment_chase_touches()
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
           WHERE u.id = (SELECT auth.uid()) AND u.role = 'master_technician'
         )
      OR auth.role() = 'service_role'
      AS ok
)
SELECT CASE WHEN NOT (SELECT ok FROM gate) THEN NULL ELSE
  COALESCE(
    (SELECT jsonb_agg(
              jsonb_build_object(
                'id', t.id,
                'customerId', t.customer_id,
                'jobId', t.job_id,
                'outcome', t.outcome,
                'note', t.note,
                'promisedYmd', CASE WHEN t.promised_date IS NULL THEN NULL ELSE to_char(t.promised_date, 'YYYY-MM-DD') END,
                'snoozeDays', t.snooze_days,
                'resolvedAt', t.resolved_at,
                'createdAt', t.created_at,
                'createdByName', COALESCE(NULLIF(trim(u.name), ''), 'office')
              ) ORDER BY t.created_at DESC)
       FROM public.job_payment_chase_touches t
       LEFT JOIN public.users u ON u.id = t.created_by
       WHERE t.created_at >= now() - interval '180 days'),
    '[]'::jsonb
  )
END;
$$;

REVOKE EXECUTE ON FUNCTION public.list_payment_chase_touches() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_payment_chase_touches() TO authenticated, service_role;

-- ---------- 4 · list_tally_parts_with_po ----------

CREATE OR REPLACE FUNCTION public.list_tally_parts_with_po()
 RETURNS TABLE(id uuid, job_id uuid, fixture_name text, part_id uuid, quantity numeric, created_by_user_id uuid, created_at timestamp with time zone, price_at_time numeric, fixture_cost numeric, purchase_order_id uuid, purchase_order_name text, purchase_order_status text, hcp_number text, job_name text, job_address text, part_name text, part_manufacturer text, created_by_name text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT
    jtp.id, jtp.job_id, jtp.fixture_name, jtp.part_id, jtp.quantity, jtp.created_by_user_id, jtp.created_at,
    poi.price_at_time, jtp.fixture_cost, jtp.purchase_order_id, po.name AS purchase_order_name, po.status::TEXT AS purchase_order_status,
    COALESCE(NULLIF(jl.hcp_number, ''), NULLIF(jl.click_number, ''), ''),
    jl.job_name, jl.job_address, mp.name AS part_name, mp.manufacturer AS part_manufacturer, u.name AS created_by_name
  FROM public.jobs_tally_parts jtp
  INNER JOIN public.jobs_ledger jl ON jl.id = jtp.job_id
  LEFT JOIN public.material_parts mp ON mp.id = jtp.part_id
  LEFT JOIN public.users u ON u.id = jtp.created_by_user_id
  LEFT JOIN public.purchase_orders po ON po.id = jtp.purchase_order_id
  LEFT JOIN public.purchase_order_items poi ON poi.purchase_order_id = jtp.purchase_order_id AND poi.part_id = jtp.part_id
  WHERE auth.role() = 'service_role'
  OR EXISTS (
    SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('dev', 'master_technician', 'assistant', 'controller')
    AND (jl.master_user_id = auth.uid() OR public.is_dev()
      OR public.is_office_or_estimator()
      OR public.is_office_or_estimator()
      OR public.assistants_share_master(auth.uid(), jl.master_user_id)))
  OR (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'primary')
    AND EXISTS (SELECT 1 FROM public.master_primaries WHERE master_id = jl.master_user_id AND primary_id = auth.uid()))
  OR (public.auth_uid_is_helpers_or_subcontractor()
    AND EXISTS (SELECT 1 FROM public.jobs_ledger_team_members jtm WHERE jtm.job_id = jtp.job_id AND jtm.user_id = auth.uid()))
  ORDER BY jtp.created_at DESC;
$function$;

REVOKE EXECUTE ON FUNCTION public.list_tally_parts_with_po() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_tally_parts_with_po() TO authenticated, service_role;

-- ---------- 5 · count_unattributed_noncard_mercury_transactions ----------

CREATE OR REPLACE FUNCTION public.count_unattributed_noncard_mercury_transactions() RETURNS bigint
 LANGUAGE plpgsql STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $$
BEGIN
  IF auth.uid() IS NULL AND auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'count_unattributed_noncard_mercury_transactions: not authenticated';
  END IF;
  IF NOT (auth.role() = 'service_role' OR is_dev() OR is_banking_attributor()) THEN
    RAISE EXCEPTION 'Not authorized' USING ERRCODE = '42501';
  END IF;

  RETURN (
    SELECT count(*)::bigint
    FROM public.mercury_transactions t
    WHERE t.posted_at IS NOT NULL
      AND t.kind NOT IN ('debitCardTransaction', 'internalTransfer')
      AND t.duplicate_of_transaction_id IS NULL
      AND t.amount < 0
      AND NOT EXISTS (SELECT 1 FROM public.mercury_transaction_job_allocations a
                      WHERE a.mercury_transaction_id = t.id)
      AND NOT EXISTS (SELECT 1 FROM public.mercury_transaction_supply_house_invoice_links il
                      WHERE il.mercury_transaction_id = t.id)
      AND NOT EXISTS (SELECT 1 FROM public.mercury_tally_payroll_flags pf
                      WHERE pf.mercury_transaction_id = t.id AND pf.is_payroll)
      AND NOT EXISTS (SELECT 1
                      FROM public.mercury_transaction_drag_sort_assignments dsa
                      JOIN public.mercury_drag_sort_labels dl ON dl.id = dsa.label_id
                      WHERE dsa.mercury_transaction_id = t.id
                        AND dl.default_key = 'internal_transfers')
      AND NOT EXISTS (SELECT 1 FROM public.mercury_transaction_attribution_resolutions r
                      WHERE r.mercury_transaction_id = t.id)
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.count_unattributed_noncard_mercury_transactions() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.count_unattributed_noncard_mercury_transactions() TO authenticated, service_role;
