SET lock_timeout = '3s';

-- A deleted bill gives its returned check fee back to its case (punch list #105, gap 1; v2.5144).
--
-- add_ar_return_case_fee (20261010003000) writes the $30 three times: the case's fee_* columns, an entry on the
-- bill's fee_lines that names the case, and the job's revenue. Deleting the bill (send back, Delete on a Ready to
-- Bill line, Split's void) took the entry with the row and set the case's fee_invoice_id to null, but kept
-- fee_added_at. So the case still said the fee was on, the press refused a second fee, and the next rewrite of the
-- revenue dropped the $30 (job_rider_fees no longer finds the entry). The office could not put it back.
--
-- The rules this file keeps: a case's fee is on exactly one live bill, the one that carries its entry; and
-- fee_came_off_at is set exactly when the fee left with its bill and took its amount off the job's revenue.
--
-- 1. mercury_transaction_ar_returned.fee_came_off_at: when the case's fee last left with its bill, so the case
--    pane can say so beside the press.
-- 2. jobs_ledger_invoices_give_case_fee_back(), BEFORE DELETE on jobs_ledger_invoices, for a row whose fee_lines
--    holds an entry that names a case whose fee is on this bill (its fee_invoice_id is this bill, or names no live
--    bill): the case gets fee_amount, fee_invoice_id and fee_added_at cleared, so add_ar_return_case_fee runs again
--    (fee_added_by stays, so a bill that comes back can say who added it); the job's revenue loses that case's
--    entry, as the next rewrite would, so a second press does not count the fee twice; fee_came_off_at is stamped;
--    and the job's history gets a line. A case whose fee is on another live bill keeps it, and an entry that names
--    no case is left to the next rewrite, as a deleted trip charge is. Case ids are compared as text, so an entry
--    whose id is not a uuid cannot stop a delete. When the job itself is being deleted, its row is already gone:
--    the case still gets its fee back, but no revenue is lowered, so no stamp and no history line are written.
-- 3. jobs_ledger_invoices_take_case_fee_on(), AFTER INSERT on jobs_ledger_invoices, for a row whose fee_lines holds
--    an entry that names a case (a Split part, or a bill restored from Recently deleted). If the case's fee is on
--    another live bill, the insert is refused in words, so the $30 is never on two bills (a restore rolls back
--    whole). Otherwise the case is attached to the new bill (fee_invoice_id, fee_amount and fee_added_at from the
--    entry), so the press refuses a second fee. If the case was stamped, the revenue gets the amount back, the
--    stamp is cleared and the history gets a line; a case released when its whole job was deleted was never
--    stamped, and its restored job row already holds the fee.
-- 4. list_ar_return_case_fees returns fee_came_off_at. Its return type changes, so it is dropped and created
--    again, with the same grants.
-- 5. add_ar_return_case_fee, restated byte for byte from 20261010003000 but for one more refusal (a case whose entry
--    is already on a live bill takes no second fee) and one more column it writes (the stamp is cleared).
-- 6. A case whose fee left with a bill before this file (fee_added_at set, fee_invoice_id null, no bill's
--    fee_lines naming it) gets its fee back, unstamped. Its job's revenue is left alone: whether a rewrite already
--    dropped the $30 cannot be told from here, and the next rewrite settles it either way. Unstamped, a restore of
--    its old bill raises nothing on a total that may still hold it.
--
-- No table is created, so the read-only and twin blocks already on both tables stand. A training account or a twin
-- cannot delete or add a bill, so neither trigger runs for one.

-- 1 ---------------------------------------------------------------------------------------------------------

ALTER TABLE public.mercury_transaction_ar_returned
  ADD COLUMN IF NOT EXISTS fee_came_off_at timestamptz;

COMMENT ON COLUMN public.mercury_transaction_ar_returned.fee_came_off_at IS
  'v2.5144: set when the case''s returned check fee left with its bill and its amount came off the job''s revenue (jobs_ledger_invoices_give_case_fee_back); fee_amount, fee_invoice_id and fee_added_at were cleared then, so add_ar_return_case_fee can put it on again. Cleared when a bill carrying the entry comes back (jobs_ledger_invoices_take_case_fee_on).';

-- 2 ---------------------------------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.jobs_ledger_invoices_give_case_fee_back()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_case_ids text[];
  v_off numeric := 0;
  v_amount numeric;
  v_bill text := 'bill ' || (coalesce(OLD.sequence_order, 0) + 1)::text;
  v_job_here boolean;
  v_case record;
BEGIN
  SELECT coalesce(array_agg(DISTINCT btrim(l->>'case_id')), ARRAY[]::text[])
  INTO v_case_ids
  FROM jsonb_array_elements(CASE WHEN jsonb_typeof(OLD.fee_lines) = 'array' THEN OLD.fee_lines ELSE '[]'::jsonb END) AS l
  WHERE jsonb_typeof(l->'case_id') = 'string' AND btrim(l->>'case_id') <> '';

  IF cardinality(v_case_ids) = 0 THEN
    RETURN OLD;
  END IF;

  -- A whole job being deleted takes its bills by cascade after its own row: nothing is left to lower or to note.
  v_job_here := EXISTS (SELECT 1 FROM public.jobs_ledger j WHERE j.id = OLD.job_id);

  -- The cases whose fee is on this bill: its fee_invoice_id is this bill or names no other live bill, and no other
  -- live bill carries its entry.
  FOR v_case IN
    SELECT r.mercury_transaction_id AS id, r.fee_amount
    FROM public.mercury_transaction_ar_returned r
    WHERE r.fee_added_at IS NOT NULL
      AND (r.mercury_transaction_id::text = ANY (v_case_ids) OR r.fee_invoice_id = OLD.id)
      AND (r.fee_invoice_id IS NULL OR r.fee_invoice_id = OLD.id
           OR NOT EXISTS (SELECT 1 FROM public.jobs_ledger_invoices i WHERE i.id = r.fee_invoice_id AND i.id <> OLD.id))
      AND NOT EXISTS (
        SELECT 1
        FROM public.jobs_ledger_invoices i
        CROSS JOIN LATERAL jsonb_array_elements(CASE WHEN jsonb_typeof(i.fee_lines) = 'array' THEN i.fee_lines ELSE '[]'::jsonb END) AS l
        WHERE i.id <> OLD.id AND jsonb_typeof(l->'case_id') = 'string' AND btrim(l->>'case_id') = r.mercury_transaction_id::text)
    FOR UPDATE
  LOOP
    -- This case's entries, as job_rider_fees reads them.
    SELECT coalesce(sum(CASE
                          WHEN jsonb_typeof(l->'amount') = 'number'
                               OR (jsonb_typeof(l->'amount') = 'string' AND btrim(l->>'amount') ~ '^[0-9]+(\.[0-9]+)?$')
                          THEN greatest(round(btrim(l->>'amount')::numeric, 2), 0)
                        END), 0)
    INTO v_amount
    FROM jsonb_array_elements(CASE WHEN jsonb_typeof(OLD.fee_lines) = 'array' THEN OLD.fee_lines ELSE '[]'::jsonb END) AS l
    WHERE jsonb_typeof(l->'case_id') = 'string' AND btrim(l->>'case_id') = v_case.id::text;

    UPDATE public.mercury_transaction_ar_returned
    SET fee_amount = NULL,
        fee_invoice_id = NULL,
        fee_added_at = NULL,
        fee_came_off_at = CASE WHEN v_job_here THEN now() ELSE NULL END,
        updated_at = now(),
        updated_by = coalesce(auth.uid(), updated_by)
    WHERE mercury_transaction_id = v_case.id;

    IF v_job_here THEN
      v_off := v_off + v_amount;
      INSERT INTO public.job_activity_events (job_id, event_type, occurred_at, actor_user_id, summary, detail, financial)
      VALUES (
        OLD.job_id, 'returned_check_fee_off', now(), auth.uid(),
        'Returned check fee: $' || to_char(v_amount, 'FM999999990.00')
          || ' came off with ' || v_bill || '. The case can add it again.',
        jsonb_build_object('source_id', v_case.id::text, 'case_id', v_case.id::text, 'invoice_id', OLD.id::text, 'amount', v_amount),
        true
      );
    END IF;
  END LOOP;

  -- The job's total loses what the released cases' entries carried, as the next rewrite would.
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
  'v2.5144 (punch list #105, gap 1): BEFORE DELETE on jobs_ledger_invoices. A bill that carries a returned check fee whose case''s fee is on it gives the fee back to that case (fee_amount, fee_invoice_id and fee_added_at cleared, so add_ar_return_case_fee runs again); while the job stays, its revenue loses that entry, the case is stamped fee_came_off_at and the job''s history gets a line.';

DROP TRIGGER IF EXISTS jobs_ledger_invoices_give_case_fee_back ON public.jobs_ledger_invoices;
CREATE TRIGGER jobs_ledger_invoices_give_case_fee_back
  BEFORE DELETE ON public.jobs_ledger_invoices
  FOR EACH ROW
  WHEN (OLD.fee_lines IS NOT NULL)
  EXECUTE FUNCTION public.jobs_ledger_invoices_give_case_fee_back();

-- 3 ---------------------------------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.jobs_ledger_invoices_take_case_fee_on()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_bill text := 'bill ' || (coalesce(NEW.sequence_order, 0) + 1)::text;
  v_line jsonb;
  v_amount numeric;
  v_added_at timestamptz;
  v_case public.mercury_transaction_ar_returned%ROWTYPE;
  v_other record;
  v_other_bill text;
BEGIN
  FOR v_line IN
    SELECT l
    FROM jsonb_array_elements(CASE WHEN jsonb_typeof(NEW.fee_lines) = 'array' THEN NEW.fee_lines ELSE '[]'::jsonb END) AS l
    WHERE jsonb_typeof(l->'case_id') = 'string' AND btrim(l->>'case_id') <> ''
  LOOP
    SELECT r.* INTO v_case
    FROM public.mercury_transaction_ar_returned r
    WHERE r.mercury_transaction_id::text = btrim(v_line->>'case_id')
    FOR UPDATE;
    CONTINUE WHEN NOT FOUND;
    -- A case whose fee is on another live bill keeps it there, and this bill does not come in: the $30 would be on two.
    SELECT i.id, i.sequence_order, i.job_id INTO v_other
    FROM public.jobs_ledger_invoices i
    WHERE i.id <> NEW.id
      AND (i.id = v_case.fee_invoice_id
           OR EXISTS (
             SELECT 1
             FROM jsonb_array_elements(CASE WHEN jsonb_typeof(i.fee_lines) = 'array' THEN i.fee_lines ELSE '[]'::jsonb END) AS l2
             WHERE jsonb_typeof(l2->'case_id') = 'string' AND btrim(l2->>'case_id') = v_case.mercury_transaction_id::text))
    ORDER BY (i.id = v_case.fee_invoice_id) DESC NULLS LAST, i.sequence_order, i.id
    LIMIT 1;
    IF FOUND THEN
      v_other_bill := 'bill ' || (coalesce(v_other.sequence_order, 0) + 1)::text;
      IF v_other.job_id IS DISTINCT FROM NEW.job_id THEN
        v_other_bill := v_other_bill || coalesce(' on ' || (
          SELECT coalesce(nullif(btrim(j.hcp_number), ''), nullif(btrim(j.click_number), ''))
          FROM public.jobs_ledger j WHERE j.id = v_other.job_id), ' on another job');
      END IF;
      RAISE EXCEPTION '% carries the returned check fee that is on % now. Take it off % first.', initcap(v_bill), v_other_bill, v_other_bill
        USING ERRCODE = 'P0001';
    END IF;

    v_amount := CASE
                  WHEN jsonb_typeof(v_line->'amount') = 'number'
                       OR (jsonb_typeof(v_line->'amount') = 'string' AND btrim(v_line->>'amount') ~ '^[0-9]+(\.[0-9]+)?$')
                  THEN greatest(round(btrim(v_line->>'amount')::numeric, 2), 0)
                  ELSE 0
                END;
    v_added_at := NULL;
    BEGIN
      v_added_at := nullif(btrim(v_line->>'added_at'), '')::timestamptz;
    EXCEPTION WHEN others THEN
      v_added_at := NULL;
    END;

    UPDATE public.mercury_transaction_ar_returned
    SET fee_amount = v_amount,
        fee_invoice_id = NEW.id,
        fee_added_at = coalesce(v_case.fee_added_at, v_added_at, now()),
        fee_came_off_at = NULL,
        updated_at = now(),
        updated_by = coalesce(auth.uid(), updated_by)
    WHERE mercury_transaction_id = v_case.mercury_transaction_id;

    -- Only a stamped case had its amount taken off the revenue, so only it gets the amount back.
    IF v_case.fee_came_off_at IS NOT NULL AND v_case.fee_added_at IS NULL THEN
      IF v_amount > 0 THEN
        UPDATE public.jobs_ledger
        SET revenue = coalesce(revenue, 0) + v_amount,
            updated_at = now()
        WHERE id = NEW.job_id;
      END IF;
      INSERT INTO public.job_activity_events (job_id, event_type, occurred_at, actor_user_id, summary, detail, financial)
      VALUES (
        NEW.job_id, 'returned_check_fee_back', now(), auth.uid(),
        'Returned check fee: $' || to_char(v_amount, 'FM999999990.00') || ' is back on ' || v_bill || '.',
        jsonb_build_object('source_id', v_case.mercury_transaction_id::text, 'case_id', v_case.mercury_transaction_id::text, 'invoice_id', NEW.id::text, 'amount', v_amount),
        true
      );
    END IF;
  END LOOP;
  RETURN NULL;
END;
$function$;

REVOKE ALL ON FUNCTION public.jobs_ledger_invoices_take_case_fee_on() FROM PUBLIC, anon, authenticated;

COMMENT ON FUNCTION public.jobs_ledger_invoices_take_case_fee_on() IS
  'v2.5144 (punch list #105, gap 1, review on #5283): AFTER INSERT on jobs_ledger_invoices. A new bill carrying a returned check fee entry (a Split part, a bill restored from Recently deleted) is refused in words when the case''s fee is on another live bill; otherwise the case is attached to it, so add_ar_return_case_fee refuses a second fee, and a case stamped fee_came_off_at gets its amount back on the job''s revenue, its stamp cleared and a line in the job''s history.';

DROP TRIGGER IF EXISTS jobs_ledger_invoices_take_case_fee_on ON public.jobs_ledger_invoices;
CREATE TRIGGER jobs_ledger_invoices_take_case_fee_on
  AFTER INSERT ON public.jobs_ledger_invoices
  FOR EACH ROW
  WHEN (NEW.fee_lines IS NOT NULL)
  EXECUTE FUNCTION public.jobs_ledger_invoices_take_case_fee_on();

-- 4 ---------------------------------------------------------------------------------------------------------

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

-- 5 ---------------------------------------------------------------------------------------------------------

-- Restated byte for byte from 20261010003000 but for refusal (b2) and fee_came_off_at = NULL on the case. Same
-- signature, so the grants stand; they are restated as the source has them.
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
  -- (b2) v2.5144: nor while a live bill still carries the case's entry (one written without the press, or a bill that
  -- came back before its case was attached again), so the $30 is never on two bills.
  IF EXISTS (
    SELECT 1
    FROM public.jobs_ledger_invoices i
    CROSS JOIN LATERAL jsonb_array_elements(CASE WHEN jsonb_typeof(i.fee_lines) = 'array' THEN i.fee_lines ELSE '[]'::jsonb END) AS l
    WHERE jsonb_typeof(l->'case_id') = 'string' AND btrim(l->>'case_id') = p_case_id::text
  ) THEN
    RAISE EXCEPTION 'A bill already carries this case''s fee.' USING ERRCODE = 'P0001';
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
      fee_came_off_at = NULL,
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

-- 6 ---------------------------------------------------------------------------------------------------------

UPDATE public.mercury_transaction_ar_returned r
SET fee_amount = NULL,
    fee_invoice_id = NULL,
    fee_added_at = NULL,
    fee_added_by = NULL,
    updated_at = now()
WHERE r.fee_added_at IS NOT NULL
  AND r.fee_invoice_id IS NULL
  AND NOT EXISTS (
    SELECT 1
    FROM public.jobs_ledger_invoices i
    CROSS JOIN LATERAL jsonb_array_elements(CASE WHEN jsonb_typeof(i.fee_lines) = 'array' THEN i.fee_lines ELSE '[]'::jsonb END) AS l
    WHERE jsonb_typeof(l->'case_id') = 'string' AND btrim(l->>'case_id') = r.mercury_transaction_id::text
  );
