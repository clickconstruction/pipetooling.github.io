SET lock_timeout = '3s';

-- get_payment_line_items_bulk (v2.2315): the Data health drill-down now shows
-- every payment's line items always-expanded, so it needs them in batches
-- instead of one RPC per row. Same shape per payment as
-- get_payment_line_items (which stays for other callers), keyed by payment
-- id; input capped at 200 ids per call (the client chunks).

CREATE OR REPLACE FUNCTION public.get_payment_line_items_bulk(p_payment_ids uuid[])
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
  SELECT p.id, p.invoice_id, p.job_id, i.amount AS bill_amount
  FROM public.jobs_ledger_payments p
  LEFT JOIN public.jobs_ledger_invoices i ON i.id = p.invoice_id
  WHERE p.id = ANY (p_payment_ids[1:200])
),
items AS (
  SELECT
    pm.id AS payment_id,
    f.name, f.count, f.line_unit_price, f.line_description, f.sequence_order
  FROM pmts pm
  JOIN public.jobs_ledger_fixtures f
    ON (pm.invoice_id IS NOT NULL AND f.invoice_id = pm.invoice_id)
    OR (pm.invoice_id IS NULL AND f.job_id = pm.job_id)
)
SELECT CASE WHEN NOT (SELECT ok FROM gate) THEN NULL ELSE
  COALESCE(
    (SELECT jsonb_object_agg(
              pm.id::text,
              jsonb_build_object(
                'linked', pm.invoice_id IS NOT NULL,
                'billAmount', pm.bill_amount,
                'items',
                COALESCE(
                  (SELECT jsonb_agg(
                            jsonb_build_object(
                              'name', it.name,
                              'count', it.count,
                              'unitPrice', it.line_unit_price,
                              'description', it.line_description,
                              'amount', CASE WHEN it.line_unit_price IS NULL THEN NULL ELSE round((it.count * it.line_unit_price)::numeric, 2) END
                            )
                            ORDER BY it.sequence_order, it.name
                          )
                     FROM items it
                    WHERE it.payment_id = pm.id),
                  '[]'::jsonb
                )
              )
            )
       FROM pmts pm),
    '{}'::jsonb
  )
END
$$;

REVOKE ALL ON FUNCTION public.get_payment_line_items_bulk(uuid[]) FROM anon;
COMMENT ON FUNCTION public.get_payment_line_items_bulk(uuid[]) IS
'Line items behind up to 200 payments at once, keyed by payment id — feeds the always-expanded Data health drill-down (v2.2315). NULL outside dev/master/assistant-like/primary.';
