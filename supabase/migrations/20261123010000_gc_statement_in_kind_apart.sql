SET lock_timeout = '3s';

-- A GC's statement leaves out a bill an in kind deal pays (v2.8309, punch list #301, the owner's
-- call of 2026-11-22). get_gc_statement_email_payload (last defined in 20260928213000) listed
-- every open bill as owed. A job on a deal carries jobs_ledger.in_kind_arrangement_id, and its
-- bill is paid down by credits, so it is scheduled and is not money owed.
--
-- Each group now holds two lists. `rows` is the money bills, as before, and every sum on the
-- group (subtotal, job_count, oldest_age_days) and the grand total count those alone. The bills a
-- deal pays ride beside them in `in_kind_rows`, the same shape, so the dispatcher can net them by
-- the one payment rule and say one line: how much is scheduled in kind. `in_kind` is the count and
-- the dollars by this function's own netting, for a reader in SQL (get_statement_week_for_office).
--
-- A group whose every bill is on a deal stays, with no rows and a subtotal of 0. The dispatcher
-- counts it and drops it, and the statement week's $10,000 line already leaves it out.
--
-- Body otherwise verbatim (who pays, row keys, address order, the collections flag, what paid
-- each bill). Additive for a reader that does not know the new keys: it sees fewer rows and
-- smaller sums. Service-role only, unchanged grants.

begin;

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
         i.id AS invoice_id, i.amount AS invoice_amount, j.lien_retainage_held AS retainage_held,
         i.id AS row_key,
         j.hcp_number, j.click_number, j.job_name, j.job_address, j.customer_name,
         CASE WHEN (SELECT group_by FROM params) = 'development' THEN j.development_id
              -- Who pays (v2.3346): the GC's group holds only what the GC pays —
              -- the invoice's own pick, else the job's rule (a typed bill_to_email
              -- is someone else); a GC entered as the customer pays by definition.
              WHEN j.gc_customer_id IS NOT NULL AND (
                     j.gc_customer_id = j.customer_id
                     OR (NULLIF(trim(COALESCE(i.bill_to_email, '')), '') IS NULL
                         AND (i.bill_to_party = 'gc' OR (i.bill_to_party IS NULL AND j.bill_to_party = 'gc')))
                   ) THEN j.gc_customer_id
              ELSE NULL END AS entity_id,
         (j.status = 'billed' AND j.collections_at IS NOT NULL) AS in_collections,
         -- A job on an in kind deal (v2.8309): its bill is scheduled, not owed.
         (j.in_kind_arrangement_id IS NOT NULL) AS on_deal
  FROM public.jobs_ledger_invoices i
  JOIN public.jobs_ledger j ON j.id = i.job_id
  WHERE i.status = 'billed'
    AND j.status <> 'paid'
),
shell_jobs AS (
  SELECT j.id, j.hcp_number, j.click_number, j.job_name, j.job_address, j.customer_name,
         j.id AS row_key,
         j.revenue, j.payments_made,
         NULL::uuid AS invoice_id, NULL::numeric AS invoice_amount, j.lien_retainage_held AS retainage_held,
         CASE WHEN (SELECT group_by FROM params) = 'development' THEN j.development_id
              WHEN j.gc_customer_id IS NOT NULL AND (j.gc_customer_id = j.customer_id OR j.bill_to_party = 'gc')
                   THEN j.gc_customer_id
              ELSE NULL END AS entity_id,
         (j.collections_at IS NOT NULL) AS in_collections,
         (j.in_kind_arrangement_id IS NOT NULL) AS on_deal
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
    i.row_key,
    i.entity_id,
    i.in_collections,
    i.on_deal,
    i.invoice_id,
    i.invoice_amount,
    i.retainage_held,
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
    j.row_key,
    j.entity_id,
    j.in_collections,
    j.on_deal,
    j.invoice_id,
    j.invoice_amount,
    j.retainage_held,
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
-- Each row as the payload carries it, built once so both lists of a group hold the same shape.
rows_obj AS (
  SELECT r.*,
         jsonb_build_object(
           'job_id', r.job_id,
           'row_key', r.row_key,
           'display_number', r.display_number,
           'job_name', r.job_name,
           'job_address', r.job_address,
           'customer_name', r.customer_name,
           'ref_date', r.ref_date,
           'ref_is_estimate', r.ref_is_estimate,
           'age_days', r.age_days,
           'remaining', round(r.remaining::numeric, 2),
           'in_collections', r.in_collections,
           -- What paid the bill (v2.4100): the row's bill and the job's sent bills and payments, so the
           -- dispatcher's render can word "paid $12,000.00 by #48211 on Sep 24 · $1,333.00 still open"
           -- with the same shared rule the client uses (_shared/billPaidBy.ts). No internal note rides along.
           'invoice_id', r.invoice_id,
           'invoice_amount', r.invoice_amount,
           'retainage_held', r.retainage_held,
           'job_bills', (SELECT COALESCE(jsonb_agg(jsonb_build_object(
               'id', b.id, 'amount', b.amount, 'status', b.status, 'sequence_order', b.sequence_order,
               'billed_at', b.billed_at) ORDER BY b.sequence_order, b.billed_at), '[]'::jsonb)
             FROM public.jobs_ledger_invoices b WHERE b.job_id = r.job_id AND b.status IN ('billed', 'paid')),
           'job_payments', (SELECT COALESCE(jsonb_agg(jsonb_build_object(
               'invoice_id', p.invoice_id, 'amount', p.amount, 'paid_on', p.paid_on, 'payment_type', p.payment_type,
               'reference_number', p.reference_number, 'sequence_order', p.sequence_order) ORDER BY p.sequence_order, p.paid_on), '[]'::jsonb)
             FROM public.jobs_ledger_payments p WHERE p.job_id = r.job_id)
         ) AS obj
  FROM rows_named r
),
grouped AS (
  SELECT
    r.entity_id,
    CASE WHEN r.entity_id IS NULL THEN
           CASE WHEN (SELECT group_by FROM params) = 'development' THEN 'No development set' ELSE 'Not billed to a GC' END
         ELSE COALESCE(MAX(r.entity_name), CHR(8212)) -- em dash: entity row missing/unnamed
    END AS entity_name,
    (r.entity_id IS NULL) AS is_no_entity,
    -- Money alone (v2.8309): a bill a deal pays is on no sum of the group.
    COUNT(DISTINCT r.job_id) FILTER (WHERE NOT r.on_deal) AS job_count,
    round(COALESCE(SUM(r.remaining) FILTER (WHERE NOT r.on_deal), 0)::numeric, 2) AS subtotal,
    MAX(r.age_days) FILTER (WHERE NOT r.on_deal) AS oldest_age_days,
    COALESCE(jsonb_agg(r.obj ORDER BY NULLIF(lower(trim(r.job_address)), '') ASC NULLS LAST, r.age_days DESC NULLS LAST, r.remaining DESC)
             FILTER (WHERE NOT r.on_deal), '[]'::jsonb) AS rows,
    COALESCE(jsonb_agg(r.obj ORDER BY NULLIF(lower(trim(r.job_address)), '') ASC NULLS LAST, r.age_days DESC NULLS LAST, r.remaining DESC)
             FILTER (WHERE r.on_deal), '[]'::jsonb) AS in_kind_rows,
    -- The bills a deal still has to pay, by this function's own netting. A cent or less open is settled.
    COUNT(*) FILTER (WHERE r.on_deal AND r.remaining > 0.005) AS in_kind_count,
    round(COALESCE(SUM(r.remaining) FILTER (WHERE r.on_deal AND r.remaining > 0.005), 0)::numeric, 2) AS in_kind_dollars
  FROM rows_obj r
  GROUP BY r.entity_id
)
SELECT jsonb_build_object(
  'generated_at', now(),
  'group_by', (SELECT group_by FROM params),
  'include_collections', p_include_collections,
  'grand_total', COALESCE((SELECT round(SUM(subtotal)::numeric, 2) FROM grouped), 0),
  'in_kind', jsonb_build_object(
    'count', COALESCE((SELECT SUM(in_kind_count) FROM grouped), 0),
    'dollars', round(COALESCE((SELECT SUM(in_kind_dollars) FROM grouped), 0)::numeric, 2)
  ),
  'groups', COALESCE((SELECT jsonb_agg(jsonb_build_object(
      'entity_id', g.entity_id,
      'entity_name', g.entity_name,
      'is_no_entity', g.is_no_entity,
      'job_count', g.job_count,
      'subtotal', g.subtotal,
      'oldest_age_days', g.oldest_age_days,
      'rows', g.rows,
      'in_kind_rows', g.in_kind_rows,
      'in_kind', jsonb_build_object('count', g.in_kind_count, 'dollars', g.in_kind_dollars)
    ) ORDER BY g.is_no_entity ASC, g.subtotal DESC, g.entity_name ASC) FROM grouped g), '[]'::jsonb)
);
$function$;

commit;
