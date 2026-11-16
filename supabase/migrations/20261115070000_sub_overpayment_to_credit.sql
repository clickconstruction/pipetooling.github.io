SET lock_timeout = '3s';

-- A sheet already paid past its total becomes a credit (punch list #347's residue; the owner,
-- 2026-11-13: "overpayment -> credit").
--
-- Since v2.7235 a payment typed past what its sheets need keeps the extra as the sub's credit. A
-- sheet that was over-paid BEFORE then still reads "Over": the extra sits on a payment row and
-- counts against nothing. One sheet is in that state.
--
-- convert_sub_overpayment_to_credit moves the overage off one payment row and into the credit
-- ledger, tied to that same payment:
--   * the payment's amount goes down by the overage, so the sheet reads paid in full;
--   * a credit entry of the same amount is kept with the payment (sub_credit_entries.payment_id),
--     which is the shape record_sub_sending writes for a sending that went past its sheets;
--   * what left the bank, the row's amount plus the credit kept with it, is unchanged, so a tick
--     against the bank and a bank match both still stand. The tick is put back after the update,
--     because the amount trigger clears it and nothing about the money changed.
--
-- The client says which payment and how much: it shows the office that plan before the press
-- (src/lib/subWorkOrders/subSendingRepair.ts, overToCreditPlan). The function refuses a payment
-- made from a credit, one that already carries a credit, an amount that would leave the row at
-- zero or below, and a person who is not on the sheet.
--
-- No new table. Additive: one function. Idempotent: safe to apply twice.

CREATE OR REPLACE FUNCTION public.convert_sub_overpayment_to_credit(
  p_person_id uuid,
  p_payment_id uuid,
  p_amount numeric
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_amount numeric(12,2) := ROUND(COALESCE(p_amount, 0), 2);
  v_pay public.people_labor_job_payments%ROWTYPE;
BEGIN
  IF NOT public.is_office_staff() THEN
    RAISE EXCEPTION 'Only the office roles who see sub pay can turn an overpayment into a credit.' USING ERRCODE = '42501';
  END IF;
  IF p_person_id IS NULL THEN
    RAISE EXCEPTION 'a credit needs a person on the roster to belong to' USING ERRCODE = '22023';
  END IF;
  IF v_amount <= 0 THEN
    RAISE EXCEPTION 'the amount to keep as credit must be above zero' USING ERRCODE = '22023';
  END IF;

  PERFORM public.sub_credit_lock(p_person_id);
  SELECT * INTO v_pay FROM public.people_labor_job_payments WHERE id = p_payment_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'that payment is gone' USING ERRCODE = 'P0002';
  END IF;
  IF v_pay.method = 'credit' THEN
    RAISE EXCEPTION 'a payment made from a credit cannot carry one' USING ERRCODE = '22023';
  END IF;
  IF v_pay.amount <= v_amount THEN
    RAISE EXCEPTION 'the payment must stay above zero on its sheet; pick a larger payment' USING ERRCODE = '22023';
  END IF;
  IF EXISTS (SELECT 1 FROM public.sub_credit_entries e WHERE e.payment_id = p_payment_id) THEN
    RAISE EXCEPTION 'this payment already carries a credit' USING ERRCODE = '22023';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.people_labor_job_assignees a WHERE a.labor_job_id = v_pay.job_id AND a.person_id = p_person_id) THEN
    RAISE EXCEPTION 'that person is not on the sheet this payment is on' USING ERRCODE = '22023';
  END IF;

  UPDATE public.people_labor_job_payments SET amount = v_pay.amount - v_amount WHERE id = p_payment_id;
  -- The money that left is the same, so a tick against the bank stands.
  IF v_pay.checked_at IS NOT NULL THEN
    UPDATE public.people_labor_job_payments
      SET checked_at = v_pay.checked_at, checked_by = v_pay.checked_by, checked_by_name = v_pay.checked_by_name
      WHERE id = p_payment_id;
  END IF;
  INSERT INTO public.sub_credit_entries (person_id, amount, payment_id, sending_id, note)
    VALUES (p_person_id, v_amount, p_payment_id, v_pay.sending_id, 'Paid past the sheet''s total before credits existed');

  RETURN jsonb_build_object('payment_id', p_payment_id, 'amount_on_sheet', v_pay.amount - v_amount, 'credit', v_amount);
END;
$$;

COMMENT ON FUNCTION public.convert_sub_overpayment_to_credit(uuid, uuid, numeric) IS
  'Punch list #347: move what a payment put past its sheet''s total into the sub''s credit, kept with that payment. The row''s amount plus the credit is what left the bank, unchanged, so a bank tick stands. Office staff only.';

REVOKE ALL ON FUNCTION public.convert_sub_overpayment_to_credit(uuid, uuid, numeric) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.convert_sub_overpayment_to_credit(uuid, uuid, numeric) TO authenticated;
