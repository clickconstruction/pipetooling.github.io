SET lock_timeout = '3s';

-- The returned-check fee (v2.5033; the owner's call of 2026-10-09, sent by Punchlist). On a case for a check that
-- came back, one press adds the $30 Texas allows to the bill the check was meant for, once, recorded on the case.
--
-- Tex. Bus. & Com. Code § 3.506(b), as amended by H.B. 2793 (82nd Leg., R.S., ch. 333, eff. Sept. 1, 2011): "On
-- return of a payment device to the holder following dishonor of the payment device by a payor, the holder ... may
-- charge the drawer or indorser a maximum processing fee of $30." § 3.506(c): no fee when a reimbursement fee was
-- collected under Code of Criminal Procedure art. 102.007(e); a fee already collected is refunded if one is.
--
-- 1. The case records its fee: mercury_transaction_ar_returned.fee_amount / fee_invoice_id / fee_added_at /
--    fee_added_by. fee_added_at set means the case has its fee: once per case.
-- 2. The bill carries the line: jobs_ledger_invoices.fee_lines, a jsonb array of {description, amount, case_id,
--    added_at}, so the printed bill shows the fee as its own row inside the bill's amount (as a folded hazmat fee
--    does) instead of spreading it over the work lines.
-- 3. list_ar_return_case_fees(case ids): each case's fee and the bills its check paid — the live payments and the
--    ones taken off (deleted_records_archive), the same two places list_ar_deposit_trails reads.
-- 4. add_ar_return_case_fee(case, bill): the one press. Refused unless (a) the case is open and its check came
--    back (source bank or hand), (b) the case has no fee yet, (c) the check paid that bill, (d) the bill is not a
--    Stripe invoice — a sent Stripe invoice cannot take a line. Then, in one transaction: the bill's amount and
--    fee_lines, the job's revenue (as create_hazmat_fee_incident does, so the part of the job on no bill stays
--    where it was), the case's fee columns, and a line in the job's history.
-- No table is created, so the read-only and twin blocks already on both tables stand; the RPCs say it in words first.

-- 1 ---------------------------------------------------------------------------------------------------------

ALTER TABLE public.mercury_transaction_ar_returned
  ADD COLUMN IF NOT EXISTS fee_amount numeric,
  ADD COLUMN IF NOT EXISTS fee_invoice_id uuid REFERENCES public.jobs_ledger_invoices(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS fee_added_at timestamptz,
  ADD COLUMN IF NOT EXISTS fee_added_by uuid REFERENCES public.users(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.mercury_transaction_ar_returned.fee_added_at IS
  'v2.5033: when the returned-check fee (Tex. Bus. & Com. Code § 3.506, $30) went on fee_invoice_id; set once per case by add_ar_return_case_fee.';

-- 2 ---------------------------------------------------------------------------------------------------------

ALTER TABLE public.jobs_ledger_invoices
  ADD COLUMN IF NOT EXISTS fee_lines jsonb;

COMMENT ON COLUMN public.jobs_ledger_invoices.fee_lines IS
  'v2.5033: fees added to the bill after it went out — [{description, amount, case_id, added_at}], inside amount; the printed bill shows each as its own row.';

-- 3 ---------------------------------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.list_ar_return_case_fees(p_case_ids uuid[])
RETURNS TABLE(
  case_id uuid,
  fee_amount numeric,
  fee_invoice_id uuid,
  fee_added_at timestamptz,
  fee_added_by text,
  bills jsonb
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
         coalesce(b.bills, '[]'::jsonb)
  FROM public.mercury_transaction_ar_returned r
  LEFT JOIN bills b ON b.case_id = r.mercury_transaction_id
  WHERE r.mercury_transaction_id = ANY (p_case_ids);
END;
$function$;

REVOKE ALL ON FUNCTION public.list_ar_return_case_fees(uuid[]) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.list_ar_return_case_fees(uuid[]) TO authenticated, service_role;

-- 4 ---------------------------------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.add_ar_return_case_fee(p_case_id uuid, p_invoice_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_fee constant numeric := 30;
  v_case public.mercury_transaction_ar_returned%ROWTYPE;
  v_inv public.jobs_ledger_invoices%ROWTYPE;
  v_bill text;
  v_who text;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Sign in first.' USING ERRCODE = 'P0001';
  END IF;
  -- The tables' read-only blocks and the twin fence refuse the writes too; this says it in words first.
  IF public.is_read_only() THEN
    RAISE EXCEPTION 'A training account cannot add a fee.' USING ERRCODE = '42501';
  END IF;
  IF public.is_digital_twin() THEN
    RAISE EXCEPTION 'A digital twin cannot add a fee.' USING ERRCODE = '42501';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.id = v_uid AND u.role IN ('dev', 'master_technician', 'assistant', 'controller', 'primary')
  ) THEN
    RAISE EXCEPTION 'Only the office adds a returned check fee.' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_case FROM public.mercury_transaction_ar_returned WHERE mercury_transaction_id = p_case_id FOR UPDATE;
  -- (a) An open case for a check that came back.
  IF NOT FOUND OR NOT coalesce(v_case.returned, false) OR v_case.closed_at IS NOT NULL OR coalesce(v_case.source, '') NOT IN ('bank', 'hand') THEN
    RAISE EXCEPTION 'Only an open case for a check that came back takes the fee.' USING ERRCODE = 'P0001';
  END IF;
  -- (b) Once per case.
  IF v_case.fee_added_at IS NOT NULL THEN
    RAISE EXCEPTION 'This case already has its fee.' USING ERRCODE = 'P0001';
  END IF;

  SELECT * INTO v_inv FROM public.jobs_ledger_invoices WHERE id = p_invoice_id FOR UPDATE;
  -- (c) The bill the check paid: a live payment of this check on it, or one taken off it.
  IF NOT FOUND OR NOT (
    EXISTS (SELECT 1 FROM public.jobs_ledger_payments p WHERE p.mercury_transaction_id = p_case_id AND p.invoice_id = p_invoice_id)
    OR EXISTS (
      SELECT 1 FROM public.deleted_records_archive a
      WHERE a.table_name = 'jobs_ledger_payments' AND a.restored_at IS NULL
        AND (a.row_data->>'mercury_transaction_id') = p_case_id::text
        AND (a.row_data->>'invoice_id') = p_invoice_id::text
    )
  ) THEN
    RAISE EXCEPTION 'That bill is not one this check paid.' USING ERRCODE = 'P0001';
  END IF;
  v_bill := 'bill ' || (coalesce(v_inv.sequence_order, 0) + 1)::text;
  -- (d) A sent Stripe invoice cannot take a line.
  IF coalesce(btrim(v_inv.stripe_invoice_id), '') <> '' THEN
    RAISE EXCEPTION 'Stripe holds %: a sent Stripe invoice cannot take a line.', initcap(v_bill) USING ERRCODE = 'P0001';
  END IF;

  UPDATE public.jobs_ledger_invoices
  SET amount = coalesce(amount, 0) + v_fee,
      fee_lines = coalesce(fee_lines, '[]'::jsonb) || jsonb_build_array(jsonb_build_object(
        'description', 'Returned check fee (Tex. Bus. & Com. Code § 3.506)',
        'amount', v_fee,
        'case_id', p_case_id,
        'added_at', now()
      ))
  WHERE id = p_invoice_id;

  -- The job's total grows with the bill, as create_hazmat_fee_incident's does.
  UPDATE public.jobs_ledger
  SET revenue = coalesce(revenue, 0) + v_fee,
      updated_at = now()
  WHERE id = v_inv.job_id;

  UPDATE public.mercury_transaction_ar_returned
  SET fee_amount = v_fee,
      fee_invoice_id = p_invoice_id,
      fee_added_at = now(),
      fee_added_by = v_uid,
      updated_at = now(),
      updated_by = v_uid
  WHERE mercury_transaction_id = p_case_id;

  SELECT coalesce(nullif(u.name, ''), u.email) INTO v_who FROM public.users u WHERE u.id = v_uid;
  INSERT INTO public.job_activity_events (job_id, event_type, occurred_at, actor_user_id, summary, detail, financial)
  VALUES (
    v_inv.job_id, 'returned_check_fee', now(), v_uid,
    'Returned check fee: $30 added to ' || v_bill || ' (Tex. Bus. & Com. Code § 3.506)',
    jsonb_build_object('source_id', p_case_id::text, 'case_id', p_case_id::text, 'invoice_id', p_invoice_id::text, 'amount', v_fee, 'by', v_who),
    true
  );

  RETURN jsonb_build_object('ok', true, 'case_id', p_case_id, 'invoice_id', p_invoice_id, 'job_id', v_inv.job_id, 'amount', v_fee, 'bill', v_bill);
END;
$function$;

REVOKE ALL ON FUNCTION public.add_ar_return_case_fee(uuid, uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.add_ar_return_case_fee(uuid, uuid) TO authenticated;
