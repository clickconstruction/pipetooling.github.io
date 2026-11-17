SET lock_timeout = '3s';

-- Supply house payments: the bank match (the owner, 2026-11-16: "most of our supply house bills are
-- paid via credit card or ach"). PR 7 of the train.
--
-- A payment is what the office typed. The bank holds what really left. This ties the two: the
-- Mercury transaction a payment left on. Read from the feed on 2026-11-16, both kinds are there:
-- a card payment to a house is a debitCardTransaction and an ACH pull is kind 'other', each with
-- the house as its counterparty, and a failed attempt sits beside the one that went through.
--
-- A payment has one bank line. A bank line may carry more than one payment (two bills paid in the
-- portal as one charge and typed as two payments), and what is matched to one line never adds up
-- to more than the line.
--
-- Two directions use the same match:
--   - a payment is offered the bank line for the same money, and a person presses it;
--   - a bank line to a house that no payment claims opens Record a payment with its day, its amount
--     and its method filled, and the payment recorded there is matched to it.
-- p_fill is the second half of "use this line" on the finish-later list: a payment made by Mark
-- paid takes its day and its method from the line it is matched to.
--
-- A match is cleared when its payment's amount changes or the payment is removed: a matched
-- payment is always one whose money the bank agrees with.
--
-- Needs 20261116230000. No new table. Additive and idempotent.

ALTER TABLE public.supply_house_payments
  ADD COLUMN IF NOT EXISTS mercury_transaction_id uuid REFERENCES public.mercury_transactions(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS bank_matched_at timestamptz,
  ADD COLUMN IF NOT EXISTS bank_matched_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS bank_matched_by_name text;

COMMENT ON COLUMN public.supply_house_payments.mercury_transaction_id IS
  'The Mercury transaction this payment left on, set by match_supply_house_payment and cleared by unmatch_supply_house_payment, by a change to the amount and by a removal. NULL while unmatched, and always for a payment whose method is not in the feed.';

CREATE INDEX IF NOT EXISTS supply_house_payments_bank_idx
  ON public.supply_house_payments (mercury_transaction_id) WHERE mercury_transaction_id IS NOT NULL;

-- A payment whose amount changes, or that is removed, lets go of its bank line.
CREATE OR REPLACE FUNCTION public.supply_house_payments_bank_guard()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF OLD.mercury_transaction_id IS NOT NULL
     AND NEW.mercury_transaction_id IS NOT DISTINCT FROM OLD.mercury_transaction_id
     AND (NEW.amount IS DISTINCT FROM OLD.amount OR (NEW.removed_at IS NOT NULL AND OLD.removed_at IS NULL)) THEN
    NEW.mercury_transaction_id := NULL;
    NEW.bank_matched_at := NULL;
    NEW.bank_matched_by := NULL;
    NEW.bank_matched_by_name := NULL;
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.supply_house_payments_bank_guard() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS supply_house_payments_bank_guard ON public.supply_house_payments;
CREATE TRIGGER supply_house_payments_bank_guard
  BEFORE UPDATE OF amount, removed_at ON public.supply_house_payments
  FOR EACH ROW EXECUTE FUNCTION public.supply_house_payments_bank_guard();

-- Match a payment to one outgoing bank line. The caller must be able to read the line: the
-- transactions table's own policies decide that. With p_fill, a payment that has no method takes
-- its method from the line's kind (a card line is card, anything else is ACH) and its day from the
-- day the line posted, in the company's time zone.
CREATE OR REPLACE FUNCTION public.match_supply_house_payment(p_payment_id uuid, p_transaction_id uuid, p_fill boolean DEFAULT false)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_pay public.supply_house_payments%ROWTYPE;
  v_tx_amount numeric;
  v_tx_status text;
  v_tx_kind text;
  v_tx_at timestamptz;
  v_others numeric(12,2);
  v_name text;
BEGIN
  IF NOT public.is_office_staff() THEN
    RAISE EXCEPTION 'only the office matches a supply house payment to the bank' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO v_pay FROM public.supply_house_payments WHERE id = p_payment_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'that payment was not found' USING ERRCODE = 'P0002'; END IF;
  IF v_pay.removed_at IS NOT NULL THEN RAISE EXCEPTION 'this payment was removed; put it back before matching it' USING ERRCODE = '22023'; END IF;
  IF v_pay.amount <= 0 THEN RAISE EXCEPTION 'this payment sent no money, so there is no bank line to match it to' USING ERRCODE = '22023'; END IF;

  SELECT amount, status, kind, COALESCE(posted_at, created_at) INTO v_tx_amount, v_tx_status, v_tx_kind, v_tx_at
    FROM public.mercury_transactions WHERE id = p_transaction_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'that bank line was not found, or this login cannot read the bank' USING ERRCODE = 'P0002'; END IF;
  IF v_tx_amount >= 0 THEN RAISE EXCEPTION 'that bank line is money in, not a payment out' USING ERRCODE = '22023'; END IF;
  IF v_tx_status IN ('failed', 'cancelled') THEN RAISE EXCEPTION 'that bank line % and moved no money', v_tx_status USING ERRCODE = '22023'; END IF;

  -- What other live payments already claim of this line.
  SELECT COALESCE(SUM(p.amount), 0) INTO v_others
    FROM public.supply_house_payments p
   WHERE p.mercury_transaction_id = p_transaction_id AND p.removed_at IS NULL AND p.id <> p_payment_id;
  IF v_pay.amount + v_others > ABS(v_tx_amount) + 0.005 THEN
    RAISE EXCEPTION 'that bank line is % and the payments on it would come to %', ROUND(ABS(v_tx_amount), 2), v_pay.amount + v_others USING ERRCODE = '22023';
  END IF;

  SELECT name INTO v_name FROM public.users WHERE id = auth.uid();
  UPDATE public.supply_house_payments
     SET mercury_transaction_id = p_transaction_id,
         bank_matched_at = now(),
         bank_matched_by = auth.uid(),
         bank_matched_by_name = v_name,
         method = CASE WHEN COALESCE(p_fill, false) AND method IS NULL THEN CASE WHEN v_tx_kind ILIKE '%card%' THEN 'card' ELSE 'ach' END ELSE method END,
         paid_on = CASE WHEN COALESCE(p_fill, false) AND v_tx_at IS NOT NULL THEN (v_tx_at AT TIME ZONE 'America/Chicago')::date ELSE paid_on END
   WHERE id = p_payment_id;
END;
$$;

-- Take a payment off its bank line.
CREATE OR REPLACE FUNCTION public.unmatch_supply_house_payment(p_payment_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_office_staff() THEN
    RAISE EXCEPTION 'only the office changes a supply house payment''s bank match' USING ERRCODE = '42501';
  END IF;
  UPDATE public.supply_house_payments
     SET mercury_transaction_id = NULL, bank_matched_at = NULL, bank_matched_by = NULL, bank_matched_by_name = NULL
   WHERE id = p_payment_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'that payment was not found' USING ERRCODE = 'P0002'; END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.match_supply_house_payment(uuid, uuid, boolean) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.unmatch_supply_house_payment(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.match_supply_house_payment(uuid, uuid, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.unmatch_supply_house_payment(uuid) TO authenticated;
