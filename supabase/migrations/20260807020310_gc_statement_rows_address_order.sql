SET lock_timeout = '3s';

-- GC statement rows in address order (v2.1434). The GC Review modal now sorts
-- each group's rows by job address A->Z (blank last; oldest/largest as the
-- tiebreak — gcReviewRollup.sortReviewRows). Scheduled statement emails are
-- rebuilt server-side by get_gc_statement_email_payload, so its per-group
-- jsonb_agg ORDER BY gains the same address key to keep send-now and
-- scheduled statements identical.
--
-- Body is the LIVE prod definition (pg_get_functiondef, v2.1400 rule) with
-- only the ORDER BY widened; closer semicolon-terminated (v2.1428 lesson).

CREATE OR REPLACE FUNCTION public.get_gc_statement_email_payload(p_group_by text DEFAULT 'gc'::text, p_entity_id uuid DEFAULT NULL::uuid, p_include_collections boolean DEFAULT false)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
WITH params AS (
  SELECT CASE WHEN p_group_by = 'development' THEN 'development' ELSE 'gc' END AS group_by
),
billed_inv AS (
  SELECT i.id, i.job_id, i.amount, i.billed_at, i.estimated_bill_date,
         j.hcp_number, j.click_number, j.job_name, j.job_address, j.customer_name,
         CASE WHEN (SELECT group_by FROM params) = 'development' THEN j.development_id ELSE j.gc_customer_id END AS entity_id,
         (j.status = 'billed' AND j.collections_at IS NOT NULL) AS in_collections
  FROM public.jobs_ledger_invoices i
  JOIN public.jobs_ledger j ON j.id = i.job_id
  WHERE i.status = 'billed'
    AND j.status <> 'paid'
),
shell_jobs AS (
  SELECT j.id, j.hcp_number, j.click_number, j.job_name, j.job_address, j.customer_name,
         j.revenue, j.payments_made,
         CASE WHEN (SELECT group_by FROM params) = 'development' THEN j.development_id ELSE j.gc_customer_id END AS entity_id,
         (j.collections_at IS NOT NULL) AS in_collections
  FROM public.jobs_ledger j
  WHERE j.status = 'billed'
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
    i.entity_id,
    i.in_collections,
    COALESCE(NULLIF(trim(i.hcp_number), ''), i.click_number) AS display_number,
    i.job_name,
    i.job_address,
    i.customer_name,
    COALESCE((i.billed_at AT TIME ZONE 'America/Chicago')::date, i.estimated_bill_date) AS ref_date,
    (i.billed_at IS NULL AND i.estimated_bill_date IS NOT NULL) AS ref_is_estimate,
    GREATEST(0, COALESCE(i.amount, 0) - COALESCE(a.applied, 0)) AS remaining
  FROM billed_inv i
  LEFT JOIN inv_applied a ON a.invoice_id = i.id
  UNION ALL
  SELECT
    j.id,
    j.entity_id,
    j.in_collections,
    COALESCE(NULLIF(trim(j.hcp_number), ''), j.click_number),
    j.job_name,
    j.job_address,
    j.customer_name,
    NULL::date,
    false,
    COALESCE(j.revenue, 0) - COALESCE(j.payments_made, 0)
  FROM shell_jobs j
),
rows_scoped AS (
  SELECT r.*,
         CASE WHEN r.ref_date IS NOT NULL AND r.ref_date <= ct.today
              THEN (ct.today - r.ref_date)
              ELSE NULL END AS age_days
  FROM rows_all r
  CROSS JOIN chicago_today ct
  WHERE (r.in_collections = false OR p_include_collections)
    AND (p_entity_id IS NULL OR r.entity_id = p_entity_id)
),
rows_named AS (
  SELECT r.*,
         CASE WHEN (SELECT group_by FROM params) = 'development'
              THEN (SELECT NULLIF(trim(d.name), '') FROM public.developments d WHERE d.id = r.entity_id)
              ELSE (SELECT NULLIF(trim(c.name), '') FROM public.customers c WHERE c.id = r.entity_id)
         END AS entity_name
  FROM rows_scoped r
),
grouped AS (
  SELECT
    r.entity_id,
    CASE WHEN r.entity_id IS NULL THEN
           CASE WHEN (SELECT group_by FROM params) = 'development' THEN 'No development set' ELSE 'No GC set' END
         ELSE COALESCE(MAX(r.entity_name), CHR(8212)) -- em dash: entity row missing/unnamed
    END AS entity_name,
    (r.entity_id IS NULL) AS is_no_entity,
    COUNT(DISTINCT r.job_id) AS job_count,
    round(SUM(r.remaining)::numeric, 2) AS subtotal,
    MAX(r.age_days) AS oldest_age_days,
    jsonb_agg(jsonb_build_object(
      'job_id', r.job_id,
      'display_number', r.display_number,
      'job_name', r.job_name,
      'job_address', r.job_address,
      'customer_name', r.customer_name,
      'ref_date', r.ref_date,
      'ref_is_estimate', r.ref_is_estimate,
      'age_days', r.age_days,
      'remaining', round(r.remaining::numeric, 2),
      'in_collections', r.in_collections
    ) ORDER BY NULLIF(lower(trim(r.job_address)), '') ASC NULLS LAST, r.age_days DESC NULLS LAST, r.remaining DESC) AS rows
  FROM rows_named r
  GROUP BY r.entity_id
)
SELECT jsonb_build_object(
  'generated_at', now(),
  'group_by', (SELECT group_by FROM params),
  'include_collections', p_include_collections,
  'grand_total', COALESCE((SELECT round(SUM(subtotal)::numeric, 2) FROM grouped), 0),
  'groups', COALESCE((SELECT jsonb_agg(jsonb_build_object(
      'entity_id', g.entity_id,
      'entity_name', g.entity_name,
      'is_no_entity', g.is_no_entity,
      'job_count', g.job_count,
      'subtotal', g.subtotal,
      'oldest_age_days', g.oldest_age_days,
      'rows', g.rows
    ) ORDER BY g.is_no_entity ASC, g.subtotal DESC, g.entity_name ASC) FROM grouped g), '[]'::jsonb)
);
$function$;
