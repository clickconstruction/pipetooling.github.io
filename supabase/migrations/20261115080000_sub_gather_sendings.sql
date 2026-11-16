SET lock_timeout = '3s';

-- Old payments typed one per sheet, gathered into the sendings they were (punch list #347's
-- residue; card #350 needs it for a payment record per sending).
--
-- Before v2.7235 one check that paid three sheets was typed as three payment rows with nothing
-- tying them. 68 of the 87 payment rows are like that. Each is ticked and matched to the bank
-- alone, and each would print as its own payment record with no number.
--
-- gather_sub_payments_into_sending makes one numbered sending for the rows the office says were
-- one payment and points each row at it. Nothing about the money changes: no amount, no date, no
-- sheet. The ledger then draws them as one sending, a tick covers them together, and a payment
-- record prints once, as PR-<n>.
--
-- The office picks the rows. The app only proposes groups (one person, one day, one way of
-- paying: src/lib/subWorkOrders/subSendingRepair.ts) and holds any group it is unsure of. The
-- function refuses a row that is already in a sending, a back-charge, a payment made from a
-- credit, and a row on a sheet the person is not on.
--
-- No new table. Additive: one function. Idempotent: safe to apply twice.

CREATE OR REPLACE FUNCTION public.gather_sub_payments_into_sending(
  p_person_id uuid,
  p_payment_ids uuid[]
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_ids uuid[] := ARRAY(SELECT DISTINCT unnest(COALESCE(p_payment_ids, '{}'::uuid[])));
  v_bad text;
  v_sending uuid;
  v_number bigint;
BEGIN
  IF NOT public.is_office_staff() THEN
    RAISE EXCEPTION 'Only the office roles who see sub pay can gather payments into a sending.' USING ERRCODE = '42501';
  END IF;
  IF p_person_id IS NULL THEN
    RAISE EXCEPTION 'a sending is to one person on the roster' USING ERRCODE = '22023';
  END IF;
  IF COALESCE(array_length(v_ids, 1), 0) < 2 THEN
    RAISE EXCEPTION 'gather two or more payments; one payment is already one sending' USING ERRCODE = '22023';
  END IF;

  -- Lock the rows, then check every one. The first that fails names its reason.
  PERFORM 1 FROM public.people_labor_job_payments p WHERE p.id = ANY (v_ids) FOR UPDATE;
  IF (SELECT count(*) FROM public.people_labor_job_payments p WHERE p.id = ANY (v_ids)) <> array_length(v_ids, 1) THEN
    RAISE EXCEPTION 'one of those payments is gone' USING ERRCODE = 'P0002';
  END IF;
  SELECT CASE
           WHEN p.sending_id IS NOT NULL THEN 'a payment of ' || p.amount::text || ' is already part of a sending'
           WHEN p.amount <= 0 THEN 'a back-charge is not part of a sending'
           WHEN p.method = 'credit' THEN 'a payment made from a credit is not money that left'
           WHEN NOT EXISTS (SELECT 1 FROM public.people_labor_job_assignees a WHERE a.labor_job_id = p.job_id AND a.person_id = p_person_id)
             THEN 'a payment of ' || p.amount::text || ' is on a sheet that person is not on'
         END
    INTO v_bad
    FROM public.people_labor_job_payments p
    WHERE p.id = ANY (v_ids)
    ORDER BY 1 NULLS LAST
    LIMIT 1;
  IF v_bad IS NOT NULL THEN
    RAISE EXCEPTION '%', v_bad USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.sub_payment_sendings (person_id) VALUES (p_person_id) RETURNING id, number INTO v_sending, v_number;
  UPDATE public.people_labor_job_payments SET sending_id = v_sending WHERE id = ANY (v_ids);
  -- A credit a row already kept moves under the sending with it.
  UPDATE public.sub_credit_entries SET sending_id = v_sending WHERE payment_id = ANY (v_ids) AND sending_id IS NULL;

  RETURN jsonb_build_object('sending_id', v_sending, 'number', v_number, 'payments', array_length(v_ids, 1));
END;
$$;

COMMENT ON FUNCTION public.gather_sub_payments_into_sending(uuid, uuid[]) IS
  'Punch list #347: point payment rows typed one per sheet at one new numbered sending, because they were one check or one transfer. Changes no amount, date or sheet. Office staff only.';

REVOKE ALL ON FUNCTION public.gather_sub_payments_into_sending(uuid, uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.gather_sub_payments_into_sending(uuid, uuid[]) TO authenticated;
