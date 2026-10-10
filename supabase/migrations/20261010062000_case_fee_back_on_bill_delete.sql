SET lock_timeout = '3s';

-- A deleted bill gives its returned check fee back to its case (punch list #105, gap 1; v2.5144).
--
-- add_ar_return_case_fee (20261010003000) writes the $30 three times: the case's fee_* columns, an entry on the
-- bill's fee_lines that names the case, and the job's revenue. Deleting the bill (send back, Delete on a Ready to
-- Bill line, Split's void) took the entry with the row and set the case's fee_invoice_id to null, but kept
-- fee_added_at. So the case still said the fee was on, the press refused a second fee, and the next rewrite of the
-- revenue dropped the $30 (job_rider_fees no longer finds the entry). The office could not put it back.
--
-- 1. mercury_transaction_ar_returned.fee_came_off_at: when the case's fee last left with its bill, so the case
--    pane can say so beside the press.
-- 2. jobs_ledger_invoices_give_case_fee_back(), BEFORE DELETE on jobs_ledger_invoices, for a row whose fee_lines
--    holds an entry that names a case: each such case with its fee on gets its fee_* columns cleared and
--    fee_came_off_at stamped, so add_ar_return_case_fee runs again; the job's revenue loses the entries' amounts,
--    as the next rewrite would, so a second press does not count the fee twice; and the job's history gets a line.
--    A case is matched by the entry's case id or by its fee_invoice_id naming this bill, compared as text, so an
--    entry whose id is not a uuid cannot stop a delete. When the job itself is being deleted, its row is already
--    gone: the revenue update and the history line find nothing to write, and the case still gets its fee back.
-- 3. list_ar_return_case_fees returns fee_came_off_at. Its return type changes, so it is dropped and created
--    again, with the same grants.
-- 4. A case whose fee left with a bill before this file (fee_added_at set, fee_invoice_id null, no bill's
--    fee_lines naming it) gets its fee back the same way. Its job's revenue is left alone: whether a rewrite
--    already dropped the $30 cannot be told from here, and the next rewrite settles it either way.
--
-- No table is created, so the read-only and twin blocks already on both tables stand. A training account or a twin
-- cannot delete a bill, so the trigger never runs for one.

-- 1 ---------------------------------------------------------------------------------------------------------

ALTER TABLE public.mercury_transaction_ar_returned
  ADD COLUMN IF NOT EXISTS fee_came_off_at timestamptz;

COMMENT ON COLUMN public.mercury_transaction_ar_returned.fee_came_off_at IS
  'v2.5144: when the case''s returned check fee last left with its bill (jobs_ledger_invoices_give_case_fee_back); the fee_* columns were cleared then, so add_ar_return_case_fee can put it on again.';

-- 2 ---------------------------------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.jobs_ledger_invoices_give_case_fee_back()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_case_ids text[];
  v_off numeric;
  v_bill text := 'bill ' || (coalesce(OLD.sequence_order, 0) + 1)::text;
  v_case record;
BEGIN
  -- The entries that name a case, and their amounts as job_rider_fees reads them.
  SELECT coalesce(array_agg(DISTINCT btrim(l->>'case_id')), ARRAY[]::text[]),
         coalesce(sum(CASE
                        WHEN jsonb_typeof(l->'amount') = 'number'
                             OR (jsonb_typeof(l->'amount') = 'string' AND btrim(l->>'amount') ~ '^[0-9]+(\.[0-9]+)?$')
                        THEN greatest(round(btrim(l->>'amount')::numeric, 2), 0)
                      END), 0)
  INTO v_case_ids, v_off
  FROM jsonb_array_elements(CASE WHEN jsonb_typeof(OLD.fee_lines) = 'array' THEN OLD.fee_lines ELSE '[]'::jsonb END) AS l
  WHERE jsonb_typeof(l->'case_id') = 'string' AND btrim(l->>'case_id') <> '';

  IF cardinality(v_case_ids) = 0 THEN
    RETURN OLD;
  END IF;

  FOR v_case IN
    SELECT r.mercury_transaction_id AS id, r.fee_amount
    FROM public.mercury_transaction_ar_returned r
    WHERE r.fee_added_at IS NOT NULL
      AND (r.mercury_transaction_id::text = ANY (v_case_ids) OR r.fee_invoice_id = OLD.id)
    FOR UPDATE
  LOOP
    UPDATE public.mercury_transaction_ar_returned
    SET fee_amount = NULL,
        fee_invoice_id = NULL,
        fee_added_at = NULL,
        fee_added_by = NULL,
        fee_came_off_at = now(),
        updated_at = now(),
        updated_by = coalesce(auth.uid(), updated_by)
    WHERE mercury_transaction_id = v_case.id;

    INSERT INTO public.job_activity_events (job_id, event_type, occurred_at, actor_user_id, summary, detail, financial)
    SELECT OLD.job_id, 'returned_check_fee_off', now(), auth.uid(),
           'Returned check fee: $' || rtrim(to_char(coalesce(v_case.fee_amount, 0), 'FM999999990.99'), '.')
             || ' came off with ' || v_bill || '. The case can add it again.',
           jsonb_build_object('source_id', v_case.id::text, 'case_id', v_case.id::text, 'invoice_id', OLD.id::text, 'amount', v_case.fee_amount),
           true
    WHERE EXISTS (SELECT 1 FROM public.jobs_ledger j WHERE j.id = OLD.job_id);
  END LOOP;

  -- The job's total loses what the entries carried, as the next rewrite would (job_rider_fees no longer finds them).
  IF v_off > 0 THEN
    UPDATE public.jobs_ledger
    SET revenue = coalesce(revenue, 0) - v_off,
        updated_at = now()
    WHERE id = OLD.job_id;
  END IF;

  RETURN OLD;
END;
$function$;

REVOKE ALL ON FUNCTION public.jobs_ledger_invoices_give_case_fee_back() FROM PUBLIC, anon, authenticated;

COMMENT ON FUNCTION public.jobs_ledger_invoices_give_case_fee_back() IS
  'v2.5144 (punch list #105, gap 1): BEFORE DELETE on jobs_ledger_invoices. A bill that carries a returned check fee entry gives the fee back to its case (fee_* cleared, fee_came_off_at stamped, so add_ar_return_case_fee runs again), takes the entries'' amounts off the job''s revenue and writes a line in the job''s history.';

DROP TRIGGER IF EXISTS jobs_ledger_invoices_give_case_fee_back ON public.jobs_ledger_invoices;
CREATE TRIGGER jobs_ledger_invoices_give_case_fee_back
  BEFORE DELETE ON public.jobs_ledger_invoices
  FOR EACH ROW
  WHEN (OLD.fee_lines IS NOT NULL)
  EXECUTE FUNCTION public.jobs_ledger_invoices_give_case_fee_back();

-- 3 ---------------------------------------------------------------------------------------------------------

-- Restated from 20261010003000 with one more column out, fee_came_off_at; the body is otherwise the same.
DROP FUNCTION IF EXISTS public.list_ar_return_case_fees(uuid[]);

CREATE FUNCTION public.list_ar_return_case_fees(p_case_ids uuid[])
RETURNS TABLE(
  case_id uuid,
  fee_amount numeric,
  fee_invoice_id uuid,
  fee_added_at timestamptz,
  fee_added_by text,
  bills jsonb,
  fee_came_off_at timestamptz
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'list_ar_return_case_fees: not authenticated';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.id = auth.uid() AND u.role IN ('dev', 'master_technician', 'assistant', 'controller', 'primary')
  ) THEN
    RAISE EXCEPTION 'list_ar_return_case_fees: not authorized';
  END IF;
  IF p_case_ids IS NULL OR cardinality(p_case_ids) = 0 THEN
    RETURN;
  END IF;
  RETURN QUERY
  WITH paid AS (
    SELECT p.mercury_transaction_id AS case_id, p.invoice_id
    FROM public.jobs_ledger_payments p
    WHERE p.mercury_transaction_id = ANY (p_case_ids) AND p.invoice_id IS NOT NULL
    UNION
    SELECT (a.row_data->>'mercury_transaction_id')::uuid, (a.row_data->>'invoice_id')::uuid
    FROM public.deleted_records_archive a
    WHERE a.table_name = 'jobs_ledger_payments'
      AND a.restored_at IS NULL
      AND (a.row_data->>'mercury_transaction_id') = ANY (p_case_ids::text[])
      AND nullif(a.row_data->>'invoice_id', '') IS NOT NULL
  ), bills AS (
    SELECT pd.case_id,
           jsonb_agg(jsonb_build_object(
             'invoice_id', i.id,
             'job_id', i.job_id,
             'sequence_order', i.sequence_order,
             'status', i.status,
             'stripe', coalesce(btrim(i.stripe_invoice_id), '') <> '',
             'job_number', coalesce(nullif(btrim(j.hcp_number), ''), nullif(btrim(j.click_number), ''), ''),
             'job_name', j.job_name
           ) ORDER BY i.sequence_order, i.id) AS bills
    FROM paid pd
    JOIN public.jobs_ledger_invoices i ON i.id = pd.invoice_id
    JOIN public.jobs_ledger j ON j.id = i.job_id
    GROUP BY pd.case_id
  )
  SELECT r.mercury_transaction_id,
         r.fee_amount,
         r.fee_invoice_id,
         r.fee_added_at,
         (SELECT coalesce(nullif(u.name, ''), u.email) FROM public.users u WHERE u.id = r.fee_added_by),
         coalesce(b.bills, '[]'::jsonb),
         r.fee_came_off_at
  FROM public.mercury_transaction_ar_returned r
  LEFT JOIN bills b ON b.case_id = r.mercury_transaction_id
  WHERE r.mercury_transaction_id = ANY (p_case_ids);
END;
$function$;

REVOKE ALL ON FUNCTION public.list_ar_return_case_fees(uuid[]) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.list_ar_return_case_fees(uuid[]) TO authenticated, service_role;

-- 4 ---------------------------------------------------------------------------------------------------------

UPDATE public.mercury_transaction_ar_returned r
SET fee_amount = NULL,
    fee_invoice_id = NULL,
    fee_added_at = NULL,
    fee_added_by = NULL,
    fee_came_off_at = now(),
    updated_at = now()
WHERE r.fee_added_at IS NOT NULL
  AND r.fee_invoice_id IS NULL
  AND NOT EXISTS (
    SELECT 1
    FROM public.jobs_ledger_invoices i
    CROSS JOIN LATERAL jsonb_array_elements(CASE WHEN jsonb_typeof(i.fee_lines) = 'array' THEN i.fee_lines ELSE '[]'::jsonb END) AS l
    WHERE jsonb_typeof(l->'case_id') = 'string' AND btrim(l->>'case_id') = r.mercury_transaction_id::text
  );
